// =============================================================================
// AI Team Studio — Parse & Execute Node
// =============================================================================
// Processing node in the orchestration graph. Handles:
//   1. Parse the raw LLM content into structured response
//   2. Run output guardrails (log flags, don't block)
//   3. Emit artifact events
//   4. Persist agent message and artifacts to database
//   5. Reset agent to IDLE
//   6. Emit done and orchestration events
//
// NOTE: Pipeline routing has been moved to the pipelineRouter node.
// This node no longer handles delegation or auto-chaining.
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { parseAgentResponse } from '@/lib/ai/agents/response-parser';
import { runOutputGuardrails } from '../guardrails';
import {
  saveAgentMessage,
  persistArtifact,
} from '../../engine';
import { agentStateManager } from '../../state-manager';
import { eventBus } from '../../event-bus';

/**
 * Parse and execute node.
 * Processes the raw LLM output, runs output guardrails, persists data.
 * No longer handles delegation — that's done by pipelineRouter.
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
      writer({
        type: 'artifact',
        data: { name: artifact.name, type: artifact.type },
      });
    }
  }

  // ── 4. Persist agent message ──────────────────────────────────────────
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

  // ── 5. Reset agent to IDLE ────────────────────────────────────────────
  await agentStateManager.setIdle(state.projectId, state.routedAgent);

  // ── 6. Emit done event ────────────────────────────────────────────────
  if (writer) {
    writer({
      type: 'done',
      data: {
        messageId: savedMessage.id,
        agentShortName: state.routedAgent,
      },
    });
  }

  // ── 7. Emit orchestration event ───────────────────────────────────────
  await eventBus.emit({
    type: 'orchestration.complete',
    actor: state.routedAgent,
    projectId: state.projectId,
    payload: {
      messageId: savedMessage.id,
      tokensUsed: state.tokensUsed?.total ?? 0,
      guardrailFlags: outputGuardrails.flags,
      toolSignals: state.completedToolSignals ?? [],
    },
  });

  return {
    parsedResponse: parsed,
    savedMessageId: savedMessage.id,
    outputGuardrailResult: outputGuardrails,
  };
}
