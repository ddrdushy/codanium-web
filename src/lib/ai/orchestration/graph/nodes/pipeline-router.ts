// =============================================================================
// AI Team Studio — Pipeline Router Node
// =============================================================================
// Deterministic SDLC routing based on completed tool signals.
// Replaces agent-driven delegation ([DELEGATE:X] markers) with
// orchestrator-controlled pipeline progression.
//
// Pipeline:
//   BA → SA → UX → PM → DO → TL → JD/SD → QA → SEC → PM → TL (loop)
//
// Routing is triggered by tool signals (e.g., approve_document(BRD) from BA
// routes to SA). Agents no longer control routing — the graph does.
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { prisma } from '@/lib/prisma';

/** Maximum pipeline depth to prevent infinite loops. */
const MAX_PIPELINE_DEPTH = 15;

/**
 * Pipeline routing rules.
 * Each rule checks if a signal (or set of signals) was produced by
 * a specific agent, and if so, routes to the next agent in the pipeline.
 */
interface PipelineRule {
  from: string;
  signals: string[];          // Any of these signals triggers the rule
  next: string;
  context: string;            // Context message for the next agent
  matchMode?: 'any' | 'all'; // Default: 'any'
}

const PIPELINE_RULES: PipelineRule[] = [
  // ── Upstream: Requirements → Architecture → Design → Planning → Dev ──
  {
    from: 'BA',
    // ONLY approve_document triggers handoff — update_document is used for staging BRD
    // during discovery and must NOT trigger the BA→SA transition
    signals: ['approve_document(BRD)'],
    next: 'SA',
    context: 'Design the technical architecture based on the approved requirements. Read the BRD document in your context — it contains the full requirements. Produce a System Design Document (SDD).',
  },
  {
    from: 'SA',
    // ONLY approve_document triggers handoff — update/create are used during SA's work
    signals: ['approve_document(SDD)'],
    next: 'UX',
    context: 'Create wireframes and design system based on the BRD and SDD. Focus on user experience and interface design.',
  },
  {
    from: 'UX',
    signals: ['approve_document(DESIGN_SYSTEM)', 'task_progress()'],
    next: 'PM',
    context: 'Break down the project into task cards on the work board. Read the BRD, SDD, and design documents. Create task cards for each feature.',
  },
  {
    from: 'PM',
    signals: ['create_card()'],
    next: 'DO',
    context: 'Scaffold the project structure based on the SDD tech stack. Generate boilerplate files, package.json, config files.',
  },
  {
    from: 'DO',
    signals: ['write_file()', 'git_commit()', 'trigger_deploy()'],
    next: 'TL',
    context: 'Project scaffold is ready. Review the task cards and assign the first highest-priority task to a developer (JD or SD).',
  },
  {
    from: 'TL',
    signals: ['update_card(IN_PROGRESS)', 'update_card(PLANNED)'],
    next: 'JD',
    context: 'Implement the assigned task. Read the relevant files, write code, run tests, and commit when complete.',
  },

  // ── Downstream: Dev → QA → Security → PM (loop) ──────────────────────
  {
    from: 'JD',
    signals: ['update_card(DONE)', 'update_card(REVIEW)', 'git_commit()'],
    next: 'QA',
    context: 'Review and test the implementation that was just completed. Run tests, validate code quality, and check for bugs.',
  },
  {
    from: 'SD',
    signals: ['update_card(DONE)', 'update_card(REVIEW)', 'git_commit()'],
    next: 'QA',
    context: 'Review the senior developer implementation. Run quality checks and verify it meets standards.',
  },
  {
    from: 'QA',
    signals: ['validate_code()', 'review_changes()', 'run_tests()', 'update_card(DONE)'],
    next: 'SEC',
    context: 'Security review the tested implementation. Check for vulnerabilities and security best practices.',
  },
  {
    from: 'SEC',
    signals: ['validate_code()', 'validate_architecture()', 'review_changes()', 'update_card(DONE)'],
    next: 'PM',
    context: 'Provide a progress summary. Check if there are more PLANNED cards — if so, route to TL for the next task.',
  },

  // ── PM loop: check for more tasks ─────────────────────────────────────
  {
    from: 'PM',
    signals: ['update_card()', 'task_progress()'],
    next: 'TL',
    context: 'Check for remaining PLANNED cards. If any exist, assign the next highest-priority task to JD or SD.',
  },

  // ── Backward routing: bugs and vulnerabilities ────────────────────────
  // These are handled by checking specific tool results (bug_found, vulnerability)
  // in the executeTools node signals
];

/**
 * Pipeline router node.
 * Checks completed tool signals against pipeline rules to determine
 * the next agent in the SDLC pipeline. Also auto-advances SDLC stages.
 */
export async function pipelineRouterNode(
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> {
  const writer = (config as any).writer;
  const currentDepth = state.delegationDepth ?? 0;
  const signals = state.completedToolSignals ?? [];
  const currentAgent = state.routedAgent;

  console.log(
    `[PipelineRouter] Agent: ${currentAgent} | Depth: ${currentDepth}/${MAX_PIPELINE_DEPTH} | Signals: ${signals.join(', ') || 'none'}`,
  );

  // Don't route if we've hit max depth
  if (currentDepth >= MAX_PIPELINE_DEPTH) {
    console.log(`[PipelineRouter] Max depth reached (${MAX_PIPELINE_DEPTH}), stopping pipeline.`);
    return { shouldDelegate: false };
  }

  // Don't route if no tool signals were produced
  if (signals.length === 0) {
    console.log(`[PipelineRouter] No tool signals, stopping pipeline.`);
    return { shouldDelegate: false };
  }

  // Find matching pipeline rule
  let matchedRule: PipelineRule | null = null;

  for (const rule of PIPELINE_RULES) {
    if (rule.from !== currentAgent) continue;

    const matchMode = rule.matchMode ?? 'any';
    const matches = matchMode === 'all'
      ? rule.signals.every(sig => signals.some(s => s.startsWith(sig.replace('()', ''))))
      : rule.signals.some(sig => signals.some(s => s.startsWith(sig.replace('()', ''))));

    if (matches) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    console.log(`[PipelineRouter] No matching rule for ${currentAgent} with signals: ${signals.join(', ')}`);
    return { shouldDelegate: false };
  }

  console.log(
    `[PipelineRouter] ✅ Routing: ${currentAgent} → ${matchedRule.next} (depth ${currentDepth + 1})`,
  );

  // Auto-advance SDLC stages based on agent completing work
  await autoAdvanceSDLC(state.projectId, currentAgent);

  // Emit pipeline progress SSE
  if (writer) {
    writer({
      type: 'delegation',
      data: {
        fromAgent: currentAgent,
        toAgent: matchedRule.next,
      },
    });
    writer({
      type: 'pipeline_progress',
      data: {
        fromAgent: currentAgent,
        toAgent: matchedRule.next,
        depth: currentDepth + 1,
        maxDepth: MAX_PIPELINE_DEPTH,
      },
    });
  }

  return {
    shouldDelegate: true,
    routedAgent: matchedRule.next,
    userMessage: matchedRule.context,
    delegationDepth: currentDepth + 1,
    // Reset tool state for next agent
    completedToolSignals: [],
    toolCalls: [],
    toolResults: [],
    toolLoopCount: 0,
  };
}

// ─── SDLC Stage Auto-Advance ──────────────────────────────────────────────────

const AGENT_STAGE_MAP: Record<string, string> = {
  BA: 'Business Analysis',
  SA: 'Architecture',
  UX: 'UI/UX Design',
  PM: 'Planning',
  DO: 'Development',
  TL: 'Development',
  JD: 'Development',
  SD: 'Development',
  QA: 'Testing',
  SEC: 'Code Review',
};

async function autoAdvanceSDLC(projectId: string, agentShortName: string): Promise<void> {
  const stageToAdvance = AGENT_STAGE_MAP[agentShortName];
  if (!stageToAdvance) return;

  try {
    const stages = await prisma.sDLCStage.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    const targetStage = stages.find(s => s.name === stageToAdvance);
    const activeStage = stages.find(s => s.status === 'ACTIVE');

    if (targetStage && activeStage && targetStage.order >= activeStage.order && targetStage.status !== 'COMPLETED') {
      // Complete all stages before target
      for (const s of stages) {
        if (s.order < targetStage.order && s.status !== 'COMPLETED') {
          await prisma.sDLCStage.update({
            where: { id: s.id },
            data: { status: 'COMPLETED', gatePassed: true },
          });
        }
      }
      // Activate target stage
      if (targetStage.status !== 'ACTIVE') {
        await prisma.sDLCStage.update({
          where: { id: targetStage.id },
          data: { status: 'ACTIVE' },
        });
      }
      await prisma.project.update({
        where: { id: projectId },
        data: { currentStage: targetStage.name },
      });
      console.log(`[PipelineRouter] Auto-advanced SDLC stage to: ${stageToAdvance}`);
    }
  } catch (e) {
    console.warn(`[PipelineRouter] SDLC auto-advance failed:`, e);
  }
}
