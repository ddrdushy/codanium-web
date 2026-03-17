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
import { resolveAgentShortName } from '@/lib/ai/agents/registry';
import { runOutputGuardrails } from '../guardrails';
import {
  executeSideEffects,
  saveAgentMessage,
  persistArtifact,
} from '../../engine';
import { agentStateManager } from '../../state-manager';
import { eventBus } from '../../event-bus';
import { getAgentDefinition } from '@/lib/ai/agents/registry';
import { filterAuthorizedActions } from '../../authority-guard';

/** Maximum delegation depth — must match build-graph.ts conditional edge. */
const MAX_DELEGATION_DEPTH = 5;

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

  // ── 4. Authority guard + execute side effects ────────────────────────
  const agentDef = getAgentDefinition(state.routedAgent);
  const { allowed: authorizedActions, blocked: blockedActions } =
    filterAuthorizedActions(agentDef, parsed.actions);
  if (blockedActions.length > 0 && writer) {
    writer.push({
      type: 'info',
      data: {
        message: `Authority guard blocked ${blockedActions.length} action(s) from ${agentDef.shortName}: ${blockedActions.map(b => b.action.type).join(', ')}`,
      },
    });
  }
  const agentRecord = await agentStateManager.getAgent(
    state.projectId,
    state.routedAgent,
  );
  await executeSideEffects(
    authorizedActions,
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
  const currentDepth = state.delegationDepth ?? 0;
  let delegateTo = parsed.delegateTo;
  let delegateContext = parsed.delegateContext;

  // Auto-chain: if agent didn't explicitly delegate but completed a card,
  // auto-route to the next pipeline agent based on current agent role
  if (!delegateTo && currentDepth < MAX_DELEGATION_DEPTH) {
    const completedCard = authorizedActions.find(
      (a: any) => a.type === 'update_card' && (a.state === 'DONE' || a.state === 'REVIEW'),
    );
    if (completedCard) {
      const PIPELINE_NEXT: Record<string, { agent: string; context: string }> = {
        JD:  { agent: 'QA', context: 'Review and test the implementation that was just completed. Verify it meets acceptance criteria.' },
        SD:  { agent: 'QA', context: 'Review the senior developer implementation. Run quality checks and verify standards.' },
        QA:  { agent: 'SEC', context: 'Security review the tested implementation. Check for vulnerabilities.' },
        SEC: { agent: 'DO', context: 'Deploy the reviewed and tested implementation to staging.' },
        UX:  { agent: 'JD', context: 'Implement the UI/UX design that was just created.' },
        BA:  { agent: 'SA', context: 'Design the technical architecture based on the requirements just documented.' },
        SA:  { agent: 'TL', context: 'Plan and coordinate development based on the architecture just designed.' },
      };
      const next = PIPELINE_NEXT[state.routedAgent];
      if (next) {
        delegateTo = next.agent;
        delegateContext = next.context + ` Original task: ${parsed.message.slice(0, 200)}`;
        console.log(`[ParseAndExecute] Auto-chain: ${state.routedAgent} completed card → routing to ${next.agent}`);
      }
    }
  }

  const shouldDelegate = !!delegateTo && currentDepth < MAX_DELEGATION_DEPTH;

  // Resolve the delegation target to a known short name (e.g. "SOLUTION_ARCHITECT" → "SA")
  const resolvedDelegateTo = delegateTo
    ? resolveAgentShortName(delegateTo)
    : undefined;

  console.log(
    `[ParseAndExecute] Delegation check — delegateTo: ${parsed.delegateTo ?? 'none'}` +
    ` → resolved: ${resolvedDelegateTo ?? 'none'}` +
    ` | depth: ${currentDepth}/${MAX_DELEGATION_DEPTH}` +
    ` | shouldDelegate: ${shouldDelegate}` +
    ` | delegateContext: ${parsed.delegateContext?.substring(0, 80) ?? 'none'}`,
  );

  // If delegating, emit delegation event and update routedAgent for next iteration
  if (shouldDelegate && resolvedDelegateTo) {
    console.log(
      `[ParseAndExecute] ✅ Delegating: ${state.routedAgent} → ${resolvedDelegateTo} (depth ${currentDepth + 1})`,
    );
    if (writer) {
      writer.push({
        type: 'delegation',
        data: {
          fromAgent: state.routedAgent,
          toAgent: resolvedDelegateTo,
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
    ...(shouldDelegate && resolvedDelegateTo
      ? {
          routedAgent: resolvedDelegateTo,
          userMessage: delegateContext ?? parsed.message,
          delegationDepth: currentDepth + 1,
        }
      : {}),
  };
}
