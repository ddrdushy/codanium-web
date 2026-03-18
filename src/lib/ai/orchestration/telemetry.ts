// =============================================================================
// AI Team Studio — Orchestration Telemetry
// =============================================================================
// Lightweight tracing module for the LangGraph orchestration pipeline.
// Tracks node transitions, LLM call metrics, tool execution metrics, and
// persists a summary to the OrchestrationRun table at the end of each run.
//
// Design principles:
//   - Zero external dependencies (uses built-in console + Date)
//   - Non-blocking: telemetry errors never fail the graph
//   - Structured JSON logs for easy grep/parsing
//   - Minimal overhead: just timestamps and state snapshots
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from './graph/state';
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

// ---------------------------------------------------------------------------
// withTelemetry — Node Wrapper
// ---------------------------------------------------------------------------

/**
 * Extracts a compact snapshot of state changes relevant to telemetry.
 */
function snapshotState(node: string, state: GraphStateType): Record<string, unknown> {
  const snap: Record<string, unknown> = {};

  switch (node) {
    case 'inputGuardrail':
      snap.blocked = state.inputGuardrailResult?.blocked ?? false;
      if (state.inputGuardrailResult?.reason) {
        snap.blockReason = state.inputGuardrailResult.reason;
      }
      break;

    case 'route':
      snap.routedAgent = state.routedAgent;
      snap.routedIntent = state.routedIntent;
      break;

    case 'context':
      snap.tokenBudgetRemaining = state.tokenBudgetRemaining;
      snap.messageCount = state.llmMessages?.length ?? 0;
      break;

    case 'llm':
      snap.hasToolCalls = (state.toolCalls?.length ?? 0) > 0;
      snap.toolCallCount = state.toolCalls?.length ?? 0;
      snap.toolLoopCount = state.toolLoopCount ?? 0;
      if (state.tokensUsed) {
        snap.tokensPrompt = state.tokensUsed.prompt;
        snap.tokensCompletion = state.tokensUsed.completion;
        snap.tokensTotal = state.tokensUsed.total;
      }
      break;

    case 'executeTools':
      snap.toolCallCount = state.toolCalls?.length ?? 0;
      snap.toolResultCount = state.toolResults?.length ?? 0;
      snap.toolLoopCount = state.toolLoopCount ?? 0;
      snap.toolErrorCount = state.toolErrorCount ?? 0;
      snap.completedSignals = state.completedToolSignals ?? [];
      break;

    case 'parseAndExecute':
      snap.hasParsedResponse = state.parsedResponse !== null;
      snap.savedMessageId = state.savedMessageId ?? null;
      break;

    case 'pipelineRouter':
      snap.shouldDelegate = state.shouldDelegate ?? false;
      snap.delegationDepth = state.delegationDepth ?? 0;
      snap.routedAgent = state.routedAgent;
      snap.completedSignals = state.completedToolSignals ?? [];
      break;

    default:
      break;
  }

  return snap;
}

/** Type for a LangGraph node function. */
type GraphNodeFn = (
  state: GraphStateType,
  config: RunnableConfig,
) => Promise<Partial<GraphStateType>>;

/**
 * Wraps a graph node function with automatic telemetry tracking.
 *
 * Usage in build-graph.ts:
 *   .addNode('llm', withTelemetry('llm', llmNode, collector))
 *
 * Captures:
 *   - Entry/exit timing
 *   - Agent shortName
 *   - Node-specific state snapshots
 *   - LLM call metrics (for 'llm' node)
 *   - Tool call metrics (for 'executeTools' node)
 *   - Errors (logged but re-thrown so graph routing still works)
 */
export function withTelemetry(
  nodeName: string,
  nodeFunction: GraphNodeFn,
  collector: TraceCollector,
): GraphNodeFn {
  return async (state: GraphStateType, config: RunnableConfig): Promise<Partial<GraphStateType>> => {
    const startTime = Date.now();

    // Initialize run context on first node
    if (collector['projectId'] === '' && state.projectId) {
      collector.setRunContext(state.projectId, state.userId, state.userMessage);
    }

    try {
      // Execute the actual node
      const result = await nodeFunction(state, config);

      const endTime = Date.now();
      const durationMs = endTime - startTime;

      // Merge result into state for snapshotting
      const mergedState = { ...state, ...result } as GraphStateType;

      // Record node span
      collector.recordNodeSpan({
        node: nodeName,
        agent: mergedState.routedAgent ?? state.routedAgent ?? 'unknown',
        startedAt: startTime,
        endedAt: endTime,
        durationMs,
        stateSnapshot: snapshotState(nodeName, mergedState),
      });

      // Record LLM-specific metrics (after 'llm' node)
      if (nodeName === 'llm' && mergedState.tokensUsed) {
        const tokens = mergedState.tokensUsed;
        const toolCallCount = mergedState.toolCalls?.length ?? 0;
        // Model is not directly available in state; use agent as proxy
        const model = mergedState.routedAgent ?? 'unknown';

        collector.recordLLMCall({
          model,
          agent: mergedState.routedAgent ?? 'unknown',
          tokensPrompt: tokens.prompt,
          tokensCompletion: tokens.completion,
          tokensTotal: tokens.total,
          latencyMs: durationMs,
          hasToolCalls: toolCallCount > 0,
          toolCallCount,
          costEstimate: estimateCost(model, tokens),
        });
      }

      // Record tool execution metrics (after 'executeTools' node)
      if (nodeName === 'executeTools' && mergedState.toolResults) {
        for (const tr of mergedState.toolResults) {
          collector.recordToolCall({
            toolName: tr.name,
            agent: mergedState.routedAgent ?? 'unknown',
            success: tr.success,
            durationMs, // per-batch duration (individual tool timing not available)
            error: tr.success ? undefined : (tr.error ?? 'Unknown error'),
          });
        }
      }

      return result;
    } catch (err: any) {
      const endTime = Date.now();

      // Record the failed span
      collector.recordNodeSpan({
        node: nodeName,
        agent: state.routedAgent ?? 'unknown',
        startedAt: startTime,
        endedAt: endTime,
        durationMs: endTime - startTime,
        stateSnapshot: snapshotState(nodeName, state),
        error: err?.message ?? 'Unknown error',
      });

      // Mark the overall run as failed
      collector.markFailed(`Node "${nodeName}" failed: ${err?.message}`);

      // Re-throw so graph error handling still works
      throw err;
    }
  };
}
