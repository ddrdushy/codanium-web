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
import { prisma } from '@/lib/prisma';

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

  // ── 4b. Auto-advance SDLC stages based on agent completing work ──────
  // Instead of requiring agents to explicitly emit [ACTION:advance_sdlc],
  // we auto-advance the pipeline stage when key agents finish their work.
  const AGENT_STAGE_MAP: Record<string, string> = {
    BA: 'Business Analysis',
    SA: 'Architecture',
    UX: 'UI/UX Design',
    PM: 'Planning',
    DO: 'Development',  // scaffold = dev starts
    TL: 'Development',
    JD: 'Development',
    SD: 'Development',
    QA: 'Testing',
    SEC: 'Code Review',
  };
  const stageToAdvance = AGENT_STAGE_MAP[state.routedAgent];
  if (stageToAdvance) {
    // Check if this stage is currently PENDING or if the current active stage is earlier
    try {
      const stages = await prisma.sDLCStage.findMany({
        where: { projectId: state.projectId },
        orderBy: { order: 'asc' },
      });
      const targetStage = stages.find(s => s.name === stageToAdvance);
      const activeStage = stages.find(s => s.status === 'ACTIVE');
      // Only advance if the target stage is ahead of or equal to the current active stage
      if (targetStage && activeStage && targetStage.order >= activeStage.order && targetStage.status !== 'COMPLETED') {
        // Complete all stages up to and including the one before target, and activate target
        for (const s of stages) {
          if (s.order < targetStage.order && s.status !== 'COMPLETED') {
            await prisma.sDLCStage.update({
              where: { id: s.id },
              data: { status: 'COMPLETED', gatePassed: true },
            });
          }
        }
        if (targetStage.status !== 'ACTIVE') {
          await prisma.sDLCStage.update({
            where: { id: targetStage.id },
            data: { status: 'ACTIVE' },
          });
        }
        await prisma.project.update({
          where: { id: state.projectId },
          data: { currentStage: targetStage.name },
        });
        console.log(`[ParseAndExecute] Auto-advanced SDLC stage to: ${stageToAdvance}`);
      }
    } catch (e) {
      console.warn(`[ParseAndExecute] SDLC auto-advance failed:`, e);
    }
  }

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

  // Auto-chain: if agent didn't explicitly delegate, auto-route to the
  // next pipeline agent. This handles BOTH card-completion chains and
  // artifact-based chains (e.g., BA approves BRD → SA designs SDD).
  // The full pipeline map mirrors engine.ts getAutoChainTarget():
  //   BA→SA→UX→PM→DO→TL→JD→QA→SEC→PM(summary)→TL(next task)
  if (!delegateTo && currentDepth < MAX_DELEGATION_DEPTH) {
    const completedCard = authorizedActions.find(
      (a: any) => a.type === 'update_card' && (a.state === 'DONE' || a.state === 'REVIEW'),
    );
    const hasArtifacts = parsed.artifacts && parsed.artifacts.length > 0;
    const hasCardCreation = authorizedActions.some((a: any) => a.type === 'create_card');
    const hasDocAction = authorizedActions.some(
      (a: any) => a.type === 'create_document' || a.type === 'update_document' || a.type === 'approve_document',
    );

    if (completedCard || hasArtifacts || hasCardCreation || hasDocAction) {
      const PIPELINE_NEXT: Record<string, { agent: string; context: string } | null> = {
        // Downstream: dev → review → next task
        JD:  { agent: 'QA', context: 'Review and test the implementation that was just completed. Verify it meets acceptance criteria.' },
        SD:  { agent: 'QA', context: 'Review the senior developer implementation. Run quality checks and verify standards.' },
        QA:  { agent: 'SEC', context: 'Security review the tested implementation. Check for vulnerabilities.' },
        SEC: { agent: 'PM', context: 'Provide a progress summary for the completed task. Then check if there are more PLANNED cards on the board — if so, hand off to TL to assign the next task.' },
        // Upstream: requirements → architecture → design → planning → scaffold → dev
        BA:  { agent: 'SA', context: 'Design the technical architecture based on the approved requirements. Read the BRD from your context and produce a System Design Document (SDD).' },
        SA:  { agent: 'UX', context: 'Create wireframes and design system based on the BRD and SDD. Read both documents from your context.' },
        UX:  { agent: 'PM', context: 'Break down the project into task cards on the work board. Read the BRD, SDD, and wireframes. Create TASK cards using [ACTION:create_card].' },
        PM:  hasCardCreation
          ? { agent: 'DO', context: 'Scaffold the project structure. Read the SDD for tech stack. Generate boilerplate files using [ARTIFACT] markers.' }
          : { agent: 'TL', context: 'Check for remaining PLANNED cards on the board. If any exist, assign the next highest-priority task to JD or SD and delegate to them.' },
        DO:  { agent: 'TL', context: 'Project scaffold is ready. Review the task cards and assign the first task to JD or SD based on complexity. Delegate to the developer.' },
      };
      const next = PIPELINE_NEXT[state.routedAgent];
      if (next) {
        delegateTo = next.agent;
        delegateContext = next.context + ` Original task: ${parsed.message.slice(0, 200)}`;
        console.log(`[ParseAndExecute] Auto-chain: ${state.routedAgent} → ${next.agent} (card=${!!completedCard}, artifacts=${!!hasArtifacts}, cards=${hasCardCreation}, doc=${hasDocAction})`);
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
