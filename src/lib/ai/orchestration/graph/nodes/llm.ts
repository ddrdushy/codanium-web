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
// Sets the agent to WORKING before streaming and accumulates the full
// content + thinking for downstream parsing.
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { getAgentDefinition } from '@/lib/ai/agents/registry';
import { llmGateway } from '@/lib/ai/gateway';
import { agentStateManager } from '../../state-manager';

/**
 * LLM node.
 * Streams the LLM response and emits SSE events via StreamWriter.
 */
export async function llmNode(
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> {
  const writer = (config as any).writer;
  const agentDef = getAgentDefinition(state.routedAgent);

  // ── Signal agent start ────────────────────────────────────────────────
  if (writer) {
    writer.push({
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

  // ── Stream LLM response ──────────────────────────────────────────────
  let fullContent = '';
  let fullThinking = '';
  let tokensUsed: { prompt: number; completion: number; total: number } | null = null;

  for await (const chunk of llmGateway.stream({
    messages: state.llmMessages,
    temperature: agentDef.temperature,
    agentId: state.routedAgent,
    projectId: state.projectId,
    metadata: { userId: state.userId },
  })) {
    if (chunk.thinking) {
      fullThinking += chunk.thinking;
      if (writer) {
        writer.push({ type: 'thinking', data: { content: chunk.thinking } });
      }
    }

    if (chunk.content) {
      fullContent += chunk.content;
      if (writer) {
        writer.push({ type: 'chunk', data: { content: chunk.content } });
      }
    }

    if (chunk.done && chunk.tokensUsed) {
      tokensUsed = chunk.tokensUsed;
      if (writer) {
        writer.push({ type: 'usage', data: { tokensUsed: chunk.tokensUsed } });
      }
    }
  }

  return {
    rawContent: fullContent,
    rawThinking: fullThinking,
    tokensUsed,
  };
}
