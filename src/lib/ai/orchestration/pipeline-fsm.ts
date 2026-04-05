/**
 * Pipeline Finite State Machine (FSM)
 *
 * Single source of truth for SDLC pipeline routing.
 * Phase is persisted in `Project.pipelinePhase` — not computed from tool signals.
 *
 * Flow:
 *   PM_GREETING → BA_WORKING → BA_NEEDS_APPROVAL
 *     → (user approves) → SA_WORKING → SA_NEEDS_APPROVAL
 *     → (user approves) → DO_WORKING → DO_NEEDS_APPROVAL
 *     → (user approves) → UX_WORKING → UI_NEEDS_APPROVAL
 *     → (user approves) → DEV_WORKING → ... → COMPLETE
 */

import { prisma } from '@/lib/prisma';
import { taskQueue } from './task-queue';

// ---------------------------------------------------------------------------
// Pipeline Phases
// ---------------------------------------------------------------------------

export type PipelinePhase =
  | 'PM_GREETING'
  | 'BA_WORKING'
  | 'BA_NEEDS_APPROVAL'
  | 'SA_WORKING'
  | 'SA_NEEDS_APPROVAL'
  | 'DO_WORKING'
  | 'DO_NEEDS_APPROVAL'
  | 'UX_WORKING'
  | 'UI_NEEDS_APPROVAL'
  | 'DEV_WORKING'
  | 'COMPLETE';

export type PipelineTrigger =
  | 'agent_done'
  | 'document_created'
  | 'user_approved'
  | 'user_rejected'
  | 'needs_user_input'
  | 'all_cards_done';

// ---------------------------------------------------------------------------
// Transition Table
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<PipelinePhase, Partial<Record<PipelineTrigger, PipelinePhase>>> = {
  PM_GREETING:        { agent_done: 'BA_WORKING' },
  BA_WORKING:         { document_created: 'BA_NEEDS_APPROVAL', needs_user_input: 'BA_WORKING' },
  BA_NEEDS_APPROVAL:  { user_approved: 'SA_WORKING', user_rejected: 'BA_WORKING' },
  SA_WORKING:         { document_created: 'SA_NEEDS_APPROVAL' },
  SA_NEEDS_APPROVAL:  { user_approved: 'DO_WORKING', user_rejected: 'SA_WORKING' },
  DO_WORKING:         { agent_done: 'DO_NEEDS_APPROVAL' },
  DO_NEEDS_APPROVAL:  { user_approved: 'UX_WORKING', user_rejected: 'DO_WORKING' },
  UX_WORKING:         { agent_done: 'UI_NEEDS_APPROVAL' },
  UI_NEEDS_APPROVAL:  { user_approved: 'DEV_WORKING', user_rejected: 'UX_WORKING' },
  DEV_WORKING:        { all_cards_done: 'COMPLETE' },
  COMPLETE:           {},
};

// ---------------------------------------------------------------------------
// Phase → Agent Map
// ---------------------------------------------------------------------------

const PHASE_AGENT: Record<PipelinePhase, string> = {
  PM_GREETING:        'PM',
  BA_WORKING:         'BA',
  BA_NEEDS_APPROVAL:  'PM',   // PM presents approval decision to user
  SA_WORKING:         'SA',
  SA_NEEDS_APPROVAL:  'PM',
  DO_WORKING:         'DO',
  DO_NEEDS_APPROVAL:  'PM',
  UX_WORKING:         'UX',   // UX creates design system, then UID creates wireframes
  UI_NEEDS_APPROVAL:  'TL',   // TL reviews UI and presents for user approval
  DEV_WORKING:        'TL',   // TL coordinates dev cycle
  COMPLETE:           'PM',   // PM for final summary
};

// Phase context — what the agent should know when activated in this phase
const PHASE_CONTEXT: Record<PipelinePhase, string> = {
  PM_GREETING: 'Greet the user, summarize the project, and tell them the BA will start gathering requirements.',
  BA_WORKING: `You are the Business Analyst. Ask the user clarifying questions ONE AT A TIME about their project requirements. After gathering enough information (5-10 questions), generate the BRD using SECTION-BY-SECTION approach:

1. First call: [CREATE_DOCUMENT]{"type":"BRD","title":"Business Requirements Document","content":"# Business Requirements Document\\n\\n## 1. Overview\\n..."} — write Overview + Business Objectives
2. Then call: [UPDATE_DOCUMENT]{"type":"BRD","mode":"append","content":"## 3. Stakeholders\\n..."} — add Stakeholders
3. Then call: [UPDATE_DOCUMENT]{"type":"BRD","mode":"append","content":"## 4. Functional Requirements\\n\\nFR-001: ...\\nFR-002: ..."} — add FRs
4. Continue for: Non-Functional Requirements, Assumptions, Constraints, Success Criteria

RULES: Generate 1-2 sections per tool call (max ~1500 tokens each). NEVER put the entire BRD in one call. Each section is saved immediately. Tell the user your progress: "Generating section 3/8: Stakeholders..."`,
  BA_NEEDS_APPROVAL: 'The BRD has been created. Validate it — check for completeness, functional requirements with FR-IDs, user personas, and acceptance criteria. Create a decision for the user to approve or request changes using [APPROVE_DOCUMENT]{"type":"BRD"}.',
  SA_WORKING: `You are the Solution Architect. Read the approved BRD from context. Generate the SDD using SECTION-BY-SECTION approach:

1. First call: [CREATE_DOCUMENT]{"type":"SDD","title":"System Design Document","content":"# System Design Document\\n\\n## 1. System Overview\\n..."} — write System Overview
2. Then call: [UPDATE_DOCUMENT]{"type":"SDD","mode":"append","content":"## 2. Architecture\\n..."} — add Architecture + diagrams
3. Continue for: Components, Data Flow, APIs & Integrations, Tech Stack, Security, Scalability, Error Handling, Assumptions

RULES: Reference BRD requirement IDs (FR-XXX) for traceability. Generate 1-2 sections per tool call (max ~1500 tokens each). NEVER put the entire SDD in one call. Each section is saved immediately. Tell the user your progress: "Generating section 4/10: Data Flow..."`,
  SA_NEEDS_APPROVAL: 'The SDD has been created. Validate it — check all BRD requirements (FR-XXX) are mapped to architecture components. Create a decision for the user to approve or request changes using [APPROVE_DOCUMENT]{"type":"SDD"}.',
  DO_WORKING: 'You are DevOps. Read the SDD from context. Scaffold the project structure: package.json, tsconfig.json, framework configuration, directory structure, Dockerfile, .gitignore, and entry point files. After writing all files, run `npm install` and `npx tsc --noEmit` to verify the build. Then call task_progress to signal completion.',
  DO_NEEDS_APPROVAL: 'The project scaffold is complete. Review the scaffolded files and summarize them for the user. Create a decision for the user to approve using create_decision with title "Scaffolding Approval" and trigger "scaffolding". Include options: "Approve scaffold and start development" or "Request changes".',
  UX_WORKING: 'You are the UX Designer. The project scaffold is approved. Now create the Design System / UI Kit document using [CREATE_DOCUMENT]{"type":"DESIGN_SYSTEM"}. Include: branding guidelines, color palette (primary, secondary, neutral, semantic), typography scale, spacing system, component inventory (buttons, inputs, cards, modals, navigation), and design tokens. After the UI Kit is complete, delegate to UID to create wireframes based on the design system and BRD user flows.',
  UI_NEEDS_APPROVAL: 'The UI Kit and wireframes are ready. Review the design system and wireframes for completeness — all pages from the BRD user flows must have wireframe coverage. Create a decision for the user to approve using create_decision with title "UI Design Approval" and trigger "ui approval". Include options: "Approve UI designs and start development" or "Request changes to designs".',
  DEV_WORKING: 'You are the Tech Lead. Read the approved BRD, SDD, UI Kit, and wireframes from context. Break down the SDD into development task cards — one card per component/feature. Create cards for: Frontend (based on wireframes + UI Kit), Backend (based on SDD APIs), and Integration. Assign each card to JD (Junior Developer) or SD (Senior Developer). Each task goes through: code → QA → SEC → DO → PE sign-off cycle. Pick ONE card at a time.',
  COMPLETE: 'All development is complete! Provide a final summary to the user: what was built, key decisions made, and next steps for deployment.',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the current pipeline phase for a project.
 */
export async function getProjectPhase(projectId: string): Promise<PipelinePhase> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { pipelinePhase: true },
  });
  return (project?.pipelinePhase || 'PM_GREETING') as PipelinePhase;
}

/**
 * Get which agent should handle messages in the current phase.
 */
export function getActiveAgent(phase: PipelinePhase): string {
  return PHASE_AGENT[phase] || 'PM';
}

/**
 * Get context instructions for the active agent in the current phase.
 */
export function getPhaseContext(phase: PipelinePhase): string {
  return PHASE_CONTEXT[phase] || '';
}

/**
 * Check if a transition is valid.
 */
export function canTransition(currentPhase: PipelinePhase, trigger: PipelineTrigger): boolean {
  const transitions = TRANSITIONS[currentPhase];
  return transitions ? trigger in transitions : false;
}

/**
 * Execute a state transition. Returns the new phase.
 * Throws if the transition is invalid.
 */
export async function transition(
  projectId: string,
  trigger: PipelineTrigger,
): Promise<PipelinePhase> {
  const currentPhase = await getProjectPhase(projectId);
  const transitions = TRANSITIONS[currentPhase];

  if (!transitions || !(trigger in transitions)) {
    console.warn(
      `[PipelineFSM] Invalid transition: ${currentPhase} + ${trigger} — no matching rule. Staying in ${currentPhase}.`,
    );
    return currentPhase;
  }

  const nextPhase = transitions[trigger]!;

  await prisma.project.update({
    where: { id: projectId },
    data: { pipelinePhase: nextPhase },
  });

  console.log(
    `[PipelineFSM] ✅ ${currentPhase} → ${nextPhase} (trigger: ${trigger}) for project ${projectId}`,
  );

  // Auto-trigger: when entering a WORKING phase after user approval,
  // enqueue a background task for the target agent
  if (trigger === 'user_approved' && isWorkingPhase(nextPhase)) {
    const targetAgent = getActiveAgent(nextPhase);
    const context = getPhaseContext(nextPhase);

    // Get project owner for task queue
    const member = await prisma.projectMember.findFirst({
      where: { projectId },
      select: { userId: true },
    });
    const userId = member?.userId || 'usr-001';

    // Move relevant card to IN_PROGRESS
    const cardTitleMap: Record<string, string> = {
      SA_WORKING: 'Solution Design',
      DO_WORKING: 'Scaffolding',
      UX_WORKING: 'UX Design',
      DEV_WORKING: 'Development',
    };
    const cardTitle = cardTitleMap[nextPhase];
    if (cardTitle) {
      try {
        const card = await prisma.card.findFirst({
          where: { projectId, title: { contains: cardTitle }, state: { not: 'DONE' } },
        });
        if (card) {
          await prisma.card.update({ where: { id: card.id }, data: { state: 'IN_PROGRESS' } });
          console.log(`[PipelineFSM] Card "${cardTitle}" → IN_PROGRESS`);
        }
      } catch (e) {
        console.error('[PipelineFSM] Failed to update card:', e);
      }
    }

    // Enqueue agent task
    try {
      await taskQueue.enqueue({
        projectId,
        userId,
        userMessage: `[PIPELINE] ${context}`,
        targetAgent,
        autoRouted: true,
        isBackground: true,
        priority: 10,
      });
      console.log(`[PipelineFSM] Enqueued ${targetAgent} agent for phase ${nextPhase}`);
    } catch (e) {
      console.error(`[PipelineFSM] Failed to enqueue ${targetAgent}:`, e);
    }
  }

  return nextPhase;
}

/**
 * Check if the phase is an approval-waiting phase (user action required).
 */
export function isApprovalPhase(phase: PipelinePhase): boolean {
  return phase.endsWith('_NEEDS_APPROVAL');
}

/**
 * Check if the phase is a working phase (agent should auto-continue).
 */
export function isWorkingPhase(phase: PipelinePhase): boolean {
  return phase.endsWith('_WORKING') || phase === 'PM_GREETING';
}
