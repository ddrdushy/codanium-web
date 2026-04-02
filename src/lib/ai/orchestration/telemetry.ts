// =============================================================================
// Codanium — Orchestration Telemetry
// =============================================================================
// Lightweight tracing module for the orchestration pipeline.
// Tracks node transitions, LLM call metrics, tool execution metrics, and
// persists a summary to the OrchestrationRun table at the end of each run.
//
// Design principles:
//   - Zero external dependencies (uses built-in console + Date)
//   - Non-blocking: telemetry errors never fail the pipeline
//   - Structured JSON logs for easy grep/parsing
//   - Minimal overhead: just timestamps and state snapshots
// =============================================================================

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Cost Estimation (mirrors gateway.ts rates)
// ---------------------------------------------------------------------------

const MODEL_COST_RATES: Record<string, { prompt: number; completion: number }> = {
  // OpenAI
  'gpt-4o':             { prompt: 0.000005,  completion: 0.000015  },
  'gpt-4o-mini':        { prompt: 0.00000015, completion: 0.0000006 },
  'gpt-4-turbo':        { prompt: 0.00001,   completion: 0.00003   },
  'gpt-4':              { prompt: 0.00003,   completion: 0.00006   },
  'gpt-3.5-turbo':      { prompt: 0.0000005, completion: 0.0000015 },
  // Anthropic
  'claude-3-opus':      { prompt: 0.000015,  completion: 0.000075  },
  'claude-3-sonnet':    { prompt: 0.000003,  completion: 0.000015  },
  'claude-3-haiku':     { prompt: 0.00000025, completion: 0.00000125 },
  'claude-3.5-sonnet':  { prompt: 0.000003,  completion: 0.000015  },
  'claude-4-sonnet':    { prompt: 0.000003,  completion: 0.000015  },
  // Fallback by provider
  openai:               { prompt: 0.00003,   completion: 0.00006   },
  anthropic:            { prompt: 0.000003,  completion: 0.000015  },
  ollama:               { prompt: 0,         completion: 0         },
};

function estimateCost(
  model: string,
  tokens: { prompt: number; completion: number },
): number {
  const key = model.toLowerCase();
  const rate =
    MODEL_COST_RATES[key] ??
    // Try prefix match (e.g. "gpt-4o-2024-05-13" -> "gpt-4o")
    Object.entries(MODEL_COST_RATES).find(([k]) => key.startsWith(k))?.[1] ??
    { prompt: 0, completion: 0 };
  return tokens.prompt * rate.prompt + tokens.completion * rate.completion;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodeSpan {
  node: string;
  agent: string;
  startedAt: number;    // Date.now()
  endedAt: number;
  durationMs: number;
  stateSnapshot: Record<string, unknown>;
  error?: string;
}

export interface LLMCallMetric {
  model: string;
  agent: string;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;
  latencyMs: number;
  hasToolCalls: boolean;
  toolCallCount: number;
  costEstimate: number;
}

export interface ToolCallMetric {
  toolName: string;
  agent: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface RunSummary {
  runId: string;
  projectId: string;
  userId: string;
  userMessage: string;
  startedAt: number;
  endedAt: number;
  totalDurationMs: number;
  nodeSpans: NodeSpan[];
  llmCalls: LLMCallMetric[];
  toolCalls: ToolCallMetric[];
  agentChain: string[];        // ordered list of agents that ran
  totalTokens: number;
  totalCost: number;
  status: 'completed' | 'failed';
  error?: string;
}

// ---------------------------------------------------------------------------
// Trace Collector
// ---------------------------------------------------------------------------

/**
 * Collects telemetry spans for a single graph run.
 * Create one per invocation via `createTraceCollector()`.
 */
export class TraceCollector {
  readonly runId: string;
  private projectId = '';
  private userId = '';
  private userMessage = '';
  private startedAt: number;
  private nodeSpans: NodeSpan[] = [];
  private llmCalls: LLMCallMetric[] = [];
  private toolCalls: ToolCallMetric[] = [];
  private agentChain: string[] = [];
  private _status: 'completed' | 'failed' = 'completed';
  private _error?: string;

  constructor() {
    this.runId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.startedAt = Date.now();
  }

  /** Set run-level metadata (called once from the first node). */
  setRunContext(projectId: string, userId: string, userMessage: string): void {
    this.projectId = projectId;
    this.userId = userId;
    this.userMessage = userMessage;
  }

  // ── Node Spans ────────────────────────────────────────────────────────

  recordNodeSpan(span: NodeSpan): void {
    this.nodeSpans.push(span);
    if (span.agent && !this.agentChain.includes(span.agent)) {
      this.agentChain.push(span.agent);
    }
    this.logStructured('node_span', {
      node: span.node,
      agent: span.agent,
      durationMs: span.durationMs,
      ...span.stateSnapshot,
      ...(span.error ? { error: span.error } : {}),
    });
  }

  // ── LLM Calls ─────────────────────────────────────────────────────────

  recordLLMCall(metric: LLMCallMetric): void {
    this.llmCalls.push(metric);
    this.logStructured('llm_call', {
      model: metric.model,
      agent: metric.agent,
      tokensPrompt: metric.tokensPrompt,
      tokensCompletion: metric.tokensCompletion,
      tokensTotal: metric.tokensTotal,
      latencyMs: metric.latencyMs,
      hasToolCalls: metric.hasToolCalls,
      toolCallCount: metric.toolCallCount,
      costEstimate: `$${metric.costEstimate.toFixed(6)}`,
    });
  }

  // ── Tool Calls ────────────────────────────────────────────────────────

  recordToolCall(metric: ToolCallMetric): void {
    this.toolCalls.push(metric);
    this.logStructured('tool_call', {
      toolName: metric.toolName,
      agent: metric.agent,
      success: metric.success,
      durationMs: metric.durationMs,
      ...(metric.error ? { error: metric.error } : {}),
    });
  }

  // ── Finalize ──────────────────────────────────────────────────────────

  markFailed(error: string): void {
    this._status = 'failed';
    this._error = error;
  }

  /**
   * Build the final summary and persist it.
   * Called once at the end of the graph run.
   */
  async finalize(): Promise<RunSummary> {
    const endedAt = Date.now();
    const totalTokens = this.llmCalls.reduce((s, c) => s + c.tokensTotal, 0);
    const totalCost = this.llmCalls.reduce((s, c) => s + c.costEstimate, 0);

    const summary: RunSummary = {
      runId: this.runId,
      projectId: this.projectId,
      userId: this.userId,
      userMessage: this.userMessage,
      startedAt: this.startedAt,
      endedAt,
      totalDurationMs: endedAt - this.startedAt,
      nodeSpans: this.nodeSpans,
      llmCalls: this.llmCalls,
      toolCalls: this.toolCalls,
      agentChain: this.agentChain,
      totalTokens,
      totalCost,
      status: this._status,
      error: this._error,
    };

    this.logStructured('run_summary', {
      runId: summary.runId,
      totalDurationMs: summary.totalDurationMs,
      totalTokens,
      totalCost: `$${totalCost.toFixed(6)}`,
      agentChain: summary.agentChain,
      nodeCount: summary.nodeSpans.length,
      llmCallCount: summary.llmCalls.length,
      toolCallCount: summary.toolCalls.length,
      status: summary.status,
      ...(summary.error ? { error: summary.error } : {}),
    });

    // Persist to DB (non-blocking)
    this.persistToDb(summary).catch((err) => {
      console.error('[Telemetry] Failed to persist run summary:', err?.message);
    });

    return summary;
  }

  // ── DB Persistence ────────────────────────────────────────────────────

  private async persistToDb(summary: RunSummary): Promise<void> {
    try {
      await prisma.orchestrationRun.create({
        data: {
          status: summary.status === 'completed' ? 'COMPLETED' : 'FAILED',
          userMessage: summary.userMessage.slice(0, 2000),
          routedTo: summary.agentChain[0] ?? 'unknown',
          autoRouted: true,
          delegations: summary.agentChain.slice(1),
          tokensTotal: summary.totalTokens,
          costTotal: summary.totalCost,
          latencyMs: summary.totalDurationMs,
          errorMessage: summary.error ?? null,
          projectId: summary.projectId,
          userId: summary.userId,
          startedAt: new Date(summary.startedAt),
          completedAt: new Date(summary.endedAt),
        },
      });
    } catch (err: any) {
      // Non-blocking: log and move on
      console.error('[Telemetry] DB persist failed:', err?.message);
    }
  }

  // ── Structured Logging ────────────────────────────────────────────────

  private logStructured(event: string, data: Record<string, unknown>): void {
    try {
      console.log(
        JSON.stringify({
          _t: 'telemetry',
          event,
          runId: this.runId,
          ts: new Date().toISOString(),
          ...data,
        }),
      );
    } catch {
      // Never fail on logging
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a fresh TraceCollector for a new graph run. */
export function createTraceCollector(): TraceCollector {
  return new TraceCollector();
}

