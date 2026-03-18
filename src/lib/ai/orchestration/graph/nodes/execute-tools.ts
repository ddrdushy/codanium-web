// =============================================================================
// AI Team Studio — Execute Tools Node
// =============================================================================
// Executes pending tool calls from the LLM, validates agent authority,
// returns tool results to be fed back to the LLM in the next iteration.
// Emits tool_call and tool_result SSE events for real-time UI feedback.
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { executeToolCalls } from '@/lib/ai/tools/tool-executor';
import type { ToolCall, ToolResult } from '@/lib/ai/tools/tool-definitions';
import type { LLMToolCall } from '@/lib/ai/providers/types';

/** Maximum number of tool call → LLM loops per agent turn. */
export const MAX_TOOL_LOOPS = 10;

// ---------------------------------------------------------------------------
// Error Classification
// ---------------------------------------------------------------------------

export type ErrorClass = 'retryable' | 'non_retryable' | 'rate_limited';

/**
 * Classify a tool execution error to determine the appropriate recovery strategy.
 *
 * - retryable: transient failures (network, timeouts) — worth retrying
 * - non_retryable: permanent failures (auth, validation) — retry won't help
 * - rate_limited: back off before the next attempt
 */
export function classifyError(error: unknown): ErrorClass {
  const message = error instanceof Error ? error.message : String(error);

  // Rate limits — should back off, not retry immediately
  if (/rate.?limit|429|too many requests/i.test(message)) return 'rate_limited';

  // Auth/security — permanent failures, never retry
  if (/401|403|unauthorized|forbidden|invalid.*key|security/i.test(message)) return 'non_retryable';

  // Schema/validation — the tool call itself is wrong, retry won't help
  if (/invalid.*argument|missing.*required|validation.*failed/i.test(message)) return 'non_retryable';

  // Everything else is retryable
  return 'retryable';
}

/**
 * Execute tools node.
 * Takes pending toolCalls from state, executes them via the tool executor,
 * and returns results. The graph loops back to the LLM node with these
 * results appended to the message history.
 */
export async function executeToolsNode(
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> {
  const writer = (config as any).writer;
  const pendingCalls = state.toolCalls ?? [];

  if (pendingCalls.length === 0) {
    return { toolResults: [], toolCalls: [] };
  }

  console.log(
    `[ExecuteTools] Executing ${pendingCalls.length} tool call(s) for agent ${state.routedAgent}`,
  );

  // Convert LLMToolCall[] to ToolCall[] format
  const toolCalls: ToolCall[] = pendingCalls.map((tc: LLMToolCall) => ({
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
  }));

  // Emit tool_call SSE events
  for (const tc of toolCalls) {
    if (writer) {
      writer({
        type: 'tool_call',
        data: { name: tc.name, arguments: tc.arguments },
      });
    }
  }

  // Execute all tool calls individually with error recovery.
  // Each tool is wrapped in try/catch so a single failure doesn't abort the batch.
  // Failed tools return ToolResult with success: false so the LLM can self-correct.
  //
  // Error classification determines recovery strategy:
  //   retryable     → counts toward toolErrorCount (LLM can self-correct)
  //   non_retryable → immediately marked as failed, does NOT increment error count
  //   rate_limited  → short delay before next tool, counts toward error count
  const results: ToolResult[] = [];
  let nonRetryableCount = 0;
  let rateLimitedCount = 0;

  for (const tc of toolCalls) {
    try {
      const [result] = await executeToolCalls([tc], {
        projectId: state.projectId,
        agentShortName: state.routedAgent,
        userId: state.userId,
      });
      results.push(result);
    } catch (err: any) {
      const errorClass = classifyError(err);

      console.error(
        `[ExecuteTools] Tool "${tc.name}" threw unexpectedly (${errorClass}):`,
        err.message,
        err.stack,
      );

      const errorSuffix = errorClass === 'non_retryable'
        ? ' [NON-RETRYABLE: do not retry this tool call]'
        : errorClass === 'rate_limited'
          ? ' [RATE LIMITED: wait before retrying]'
          : '';

      results.push({
        toolCallId: tc.id,
        name: tc.name,
        success: false,
        result: null,
        error: `Tool execution failed: ${err.message}${errorSuffix}`,
      });

      if (errorClass === 'non_retryable') {
        nonRetryableCount++;
      } else if (errorClass === 'rate_limited') {
        rateLimitedCount++;
        // Short delay before executing the next tool to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Emit tool_result SSE events (including failures so the frontend can show them)
  for (const result of results) {
    if (writer) {
      writer({
        type: 'tool_result',
        data: {
          name: result.name,
          success: result.success,
          result: result.success
            ? (typeof result.result === 'string'
                ? result.result.slice(0, 500)
                : JSON.stringify(result.result).slice(0, 500))
            : result.error,
        },
      });
    }
  }

  // Track consecutive error count for circuit-breaker routing.
  // Non-retryable errors don't increment the counter — they are permanent
  // failures that should not trigger the circuit breaker (the LLM should
  // simply stop calling that tool).
  const failedResults = results.filter(r => !r.success);
  const retryableFailures = failedResults.length - nonRetryableCount;
  const anySucceeded = results.some(r => r.success);
  const allFailed = results.length > 0 && !anySucceeded;
  const prevErrorCount = state.toolErrorCount ?? 0;
  // Reset on any success; only increment for retryable failures
  const newErrorCount = anySucceeded
    ? 0
    : retryableFailures > 0
      ? prevErrorCount + 1
      : prevErrorCount;

  if (allFailed) {
    console.error(
      `[ExecuteTools] All ${results.length} tool(s) failed (${nonRetryableCount} non-retryable, ${rateLimitedCount} rate-limited). Consecutive error count: ${newErrorCount}/3`,
    );
  }

  // Track which tools were successfully called (for pipeline routing)
  const signals = results
    .filter(r => r.success)
    .map(r => {
      // Build signal strings like "approve_document(BRD)", "create_card()", etc.
      const args = toolCalls.find(tc => tc.id === r.toolCallId)?.arguments;
      if (args?.type) return `${r.name}(${args.type})`;
      if (args?.state) return `${r.name}(${args.state})`;
      return `${r.name}()`;
    });

  const existingSignals = state.completedToolSignals ?? [];

  console.log(
    `[ExecuteTools] Completed ${results.filter(r => r.success).length}/${results.length} tools. Signals: ${signals.join(', ')}`,
  );

  // ── Track tool calls for loop detection ─────────────────────────────
  const now = Date.now();
  const existingTracked = state.recentToolCalls ?? [];
  const newTrackedCalls = toolCalls.map(tc => ({
    name: tc.name,
    args: JSON.stringify(tc.arguments ?? {}),
    timestamp: now,
  }));
  // Keep only the last 10 calls within a 2-minute window
  const twoMinutesAgo = now - 2 * 60 * 1000;
  const updatedTrackedCalls = [...existingTracked, ...newTrackedCalls]
    .filter(tc => tc.timestamp > twoMinutesAgo)
    .slice(-10);

  return {
    toolResults: results,
    toolCalls: [], // Clear pending calls
    toolLoopCount: (state.toolLoopCount ?? 0) + 1,
    toolErrorCount: newErrorCount,
    completedToolSignals: [...existingSignals, ...signals],
    recentToolCalls: updatedTrackedCalls,
  };
}
