// =============================================================================
// AI Team Studio — Parse & Execute Node
// =============================================================================
// Final processing node in the orchestration graph. Handles:
//   1. Parse the raw LLM content into structured response
//   2. Run output guardrails (log flags, don't block)
//   3. Execute side effects (cards, documents, decisions, etc.)
//   4. Persist agent message and artifacts to database
//   5. Reset agent to IDLE
//   6. Emit artifact and done SSE events
//   7. Check for delegation and set shouldDelegate flag
//   8. Emit events via eventBus
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { parseAgentResponse } from '@/lib/ai/agents/response-parser';
import { runOutputGuardrails } from '../guardrails';
import {
  executeSideEffects,
  saveAgentMessage,
  persistArtifact,
} from '../../engine';
import { agentStateManager } from '../../state-manager';
import { eventBus } from '../../event-bus';

/**
 * Parse and execute node.
 * Processes the raw LLM output, runs output guardrails, executes side effects,
 * persists data, and prepares for potential delegation.
 */
export async function parseAndExecuteNode(
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> {
  const writer = (config as any).writer;

  // ── 1. Parse the raw LLM response ────────────────────────────────────
  const parsed = parseAgentResponse(state.rawContent);

  // ── 2. Run output guardrails ──────────────────────────────────────────
  const outputGuardrails = await runOutputGuardrails(parsed, state.rawContent);

  if (outputGuardrails.flags.length > 0) {
    console.warn(
      `[ParseAndExecuteNode] Output guardrail flags: ${outputGuardrails.flags.join(', ')}`,
    );
  }

  if (outputGuardrails.hasCriticalIssues) {
    console.error(
      `[ParseAndExecuteNode] CRITICAL output issues detected for agent ${state.routedAgent}`,
    );
  }

  // ── 3. Emit artifact events ───────────────────────────────────────────
  for (const artifact of parsed.artifacts) {
    if (writer) {
      writer.push({
        type: 'artifact',
        data: { name: artifact.name, type: artifact.type },
      });
    }
  }

  // ── 4. Execute side effects ───────────────────────────────────────────
  const agentRecord = await agentStateManager.getAgent(
    state.projectId,
    state.routedAgent,
  );
  await executeSideEffects(
    parsed.actions,
    state.projectId,
    state.userId,
    agentRecord?.id,
  );

  // ── 5. Persist agent message ──────────────────────────────────────────
  const savedMessage = await saveAgentMessage(
    state.projectId,
    state.routedAgent,
    parsed.message,
    state.rawThinking || undefined,
    parsed.artifacts,
  );

  // Persist artifacts
  for (const artifact of parsed.artifacts) {
    await persistArtifact(
      artifact,
      state.projectId,
      state.routedAgent,
      savedMessage.id,
    );
  }

  // ── 6. Reset agent to IDLE ────────────────────────────────────────────
  await agentStateManager.setIdle(state.projectId, state.routedAgent);

  // ── 7. Check for delegation ───────────────────────────────────────────
  const shouldDelegate = !!parsed.delegateTo && (state.delegationDepth ?? 0) < 3;

  // If delegating, emit delegation event and update routedAgent for next iteration
  if (shouldDelegate && parsed.delegateTo) {
    if (writer) {
      writer.push({
        type: 'delegation',
        data: {
          fromAgent: state.routedAgent,
          toAgent: parsed.delegateTo,
        },
      });
    }
  }

  // ── 8. Emit done event ────────────────────────────────────────────────
  if (writer) {
    writer.push({
      type: 'done',
      data: {
        messageId: savedMessage.id,
        agentShortName: state.routedAgent,
      },
    });
  }

  // ── 9. Emit orchestration event ───────────────────────────────────────
  await eventBus.emit({
    type: 'orchestration.complete',
    actor: state.routedAgent,
    projectId: state.projectId,
    payload: {
      messageId: savedMessage.id,
      tokensUsed: state.tokensUsed?.total ?? 0,
      guardrailFlags: outputGuardrails.flags,
    },
  });

  return {
    parsedResponse: parsed,
    savedMessageId: savedMessage.id,
    outputGuardrailResult: outputGuardrails,
    shouldDelegate,
    // If delegating, prepare state for the next loop iteration
    ...(shouldDelegate && parsed.delegateTo
      ? {
          routedAgent: parsed.delegateTo,
          userMessage: parsed.delegateContext ?? parsed.message,
          delegationDepth: (state.delegationDepth ?? 0) + 1,
        }
      : {}),
  };
}
