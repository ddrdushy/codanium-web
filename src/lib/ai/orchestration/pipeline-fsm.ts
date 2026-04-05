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
 *     → (user approves) → DEV_WORKING → ... → COMPLETE
 */

import { prisma } from '@/lib/prisma';

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
  DO_NEEDS_APPROVAL:  { user_approved: 'DEV_WORKING', user_rejected: 'DO_WORKING' },
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
  DEV_WORKING:        'TL',   // TL coordinates dev cycle
  COMPLETE:           'PM',   // PM for final summary
};

// Phase context — what the agent should know when activated in this phase
const PHASE_CONTEXT: Record<PipelinePhase, string> = {
  PM_GREETING: 'Greet the user, summarize the project, and tell them the BA will start gathering requirements.',
  BA_WORKING: 'You are the Business Analyst. Ask the user clarifying questions ONE AT A TIME about their project requirements. After gathering enough information (5-10 questions), produce the full Business Requirements Document (BRD) using [CREATE_DOCUMENT]. Include: Executive Summary, Functional Requirements (FR-001, FR-002...), User Personas, User Flows, NFRs, and Acceptance Criteria.',
  BA_NEEDS_APPROVAL: 'The BRD has been created. Validate it — check for completeness, functional requirements with FR-IDs, user personas, and acceptance criteria. Create a decision for the user to approve or request changes using [APPROVE_DOCUMENT]{"type":"BRD"}.',
  SA_WORKING: 'You are the Solution Architect. Read the approved BRD from context. Design the system architecture and produce the System Design Document (SDD) using [CREATE_DOCUMENT]. Include: tech stack with rationale, database schema, API design, component architecture, security, and deployment strategy. Reference BRD requirement IDs (FR-XXX) for traceability.',
  SA_NEEDS_APPROVAL: 'The SDD has been created. Validate it — check all BRD requirements (FR-XXX) are mapped to architecture components. Create a decision for the user to approve or request changes using [APPROVE_DOCUMENT]{"type":"SDD"}.',
  DO_WORKING: 'You are DevOps. Read the SDD from context. Scaffold the project structure: package.json, tsconfig.json, framework configuration, directory structure, Dockerfile, .gitignore, and entry point files.',
  DO_NEEDS_APPROVAL: 'The project scaffold is complete. Review it and inform the user. Create a decision for approval.',
  DEV_WORKING: 'Coordinate the development cycle. Assign tasks from the board to JD (Junior Developer) and SD (Senior Developer). Each task goes through: code → QA → SEC → sign-off.',
  COMPLETE: 'All phases are complete. Provide a final summary to the user.',
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
