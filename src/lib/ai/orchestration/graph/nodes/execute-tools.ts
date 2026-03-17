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
      writer.push({
        type: 'tool_call',
        data: { name: tc.name, arguments: tc.arguments },
      });
    }
  }

  // Execute all tool calls (sequential — some may depend on prior results)
  const results = await executeToolCalls(toolCalls, {
    projectId: state.projectId,
    agentShortName: state.routedAgent,
    userId: state.userId,
  });

  // Emit tool_result SSE events
  for (const result of results) {
    if (writer) {
      writer.push({
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

  return {
    toolResults: results,
    toolCalls: [], // Clear pending calls
    toolLoopCount: (state.toolLoopCount ?? 0) + 1,
    completedToolSignals: [...existingSignals, ...signals],
  };
}
