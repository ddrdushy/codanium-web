// =============================================================================
// AI Team Studio — LLM Node
// =============================================================================
// Wraps the LLM Gateway's stream() method as a LangGraph node.
// Uses LangGraph's StreamWriter to emit SSE events in real-time:
//   - agent_start: signals which agent is responding
//   - thinking: reasoning tokens
//   - chunk: content tokens
//   - usage: final token counts
//
// Passes tools (filtered by agent authority) to the LLM provider.
// Collects tool calls from the stream and sets them in state for
// the executeTools node to process.
//
// When tool results are present (from a previous tool execution loop),
// appends them to the message history so the LLM can see the results.
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { getAgentDefinition } from '@/lib/ai/agents/registry';
import { llmGateway } from '@/lib/ai/gateway';
import { agentStateManager } from '../../state-manager';
import { getToolsForAgent } from '@/lib/ai/tools/tool-filter';
import type { LLMMessage, LLMToolCall, LLMToolDefinition } from '@/lib/ai/providers/types';
import type { ToolResult } from '@/lib/ai/tools/tool-definitions';

/**
 * LLM node.
 * Streams the LLM response, passes tools, and collects tool calls.
 * Emits SSE events via StreamWriter.
 */
export async function llmNode(
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> {
  const writer = (config as any).writer;
  const agentDef = getAgentDefinition(state.routedAgent);
  const toolLoopCount = state.toolLoopCount ?? 0;

  // ── Signal agent start (only on first call, not tool loops) ─────────
  if (toolLoopCount === 0 && writer) {
    writer({
      type: 'agent_start',
      data: { agentShortName: state.routedAgent, agentName: agentDef.name },
    });
  }

  // Set agent to WORKING
  await agentStateManager.setWorking(
    state.projectId,
    state.routedAgent,
    `Processing: ${state.userMessage.slice(0, 80)}`,
  );

  // ── Build messages with tool results if present ─────────────────────
  let messages: LLMMessage[] = [...state.llmMessages];

  // If we have tool results from a previous loop, append them
  const toolResults = state.toolResults ?? [];

  if (toolResults.length > 0 && toolLoopCount > 0) {
    // Add the assistant message that made the tool calls (with content so far)
    const assistantToolCalls: LLMToolCall[] = toolResults.map(r => ({
      id: r.toolCallId,
      name: r.name,
      arguments: {},
    }));

    messages.push({
      role: 'assistant',
      content: state.rawContent || '',
      toolCalls: assistantToolCalls,
    });

    // Add tool result messages
    for (const result of toolResults) {
      messages.push({
        role: 'tool',
        content: result.success
          ? (typeof result.result === 'string' ? result.result : JSON.stringify(result.result))
          : `Error: ${result.error}`,
        toolCallId: result.toolCallId,
      });
    }
  }

  // ── Get tools for this agent ────────────────────────────────────────
  const agentTools = getToolsForAgent(state.routedAgent);
  const toolDefs: LLMToolDefinition[] = agentTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  // ── Stream LLM response ────────────────────────────────────────────
  let fullContent = '';
  let fullThinking = '';
  let tokensUsed: { prompt: number; completion: number; total: number } | null = null;
  let collectedToolCalls: LLMToolCall[] = [];

  for await (const chunk of llmGateway.stream({
    messages,
    temperature: agentDef.temperature,
    agentId: state.routedAgent,
    projectId: state.projectId,
    metadata: { userId: state.userId },
    tools: toolDefs.length > 0 ? toolDefs : undefined,
    toolChoice: toolDefs.length > 0 ? 'auto' : undefined,
  })) {
    if (chunk.thinking) {
      fullThinking += chunk.thinking;
      if (writer) {
        writer({ type: 'thinking', data: { content: chunk.thinking } });
      }
    }

    if (chunk.content) {
      fullContent += chunk.content;
      if (writer) {
        writer({ type: 'chunk', data: { content: chunk.content } });
      }
    }

    if (chunk.done) {
      if (chunk.tokensUsed) {
        tokensUsed = chunk.tokensUsed;
        if (writer) {
          writer({ type: 'usage', data: { tokensUsed: chunk.tokensUsed } });
        }
      }
      // Collect tool calls from final chunk
      if (chunk.toolCalls && chunk.toolCalls.length > 0) {
        collectedToolCalls = chunk.toolCalls;
        console.log(
          `[LLMNode] Tool calls received: ${collectedToolCalls.map(tc => tc.name).join(', ')}`,
        );
      }
    }
  }

  return {
    rawContent: fullContent,
    rawThinking: fullThinking,
    tokensUsed,
    toolCalls: collectedToolCalls,
  };
}
