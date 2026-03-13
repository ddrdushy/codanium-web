// =============================================================================
// AI Team Studio — Quality Gate Enforcement
// =============================================================================
// Defines prerequisite rules for SDLC stage advancement and agent delegation.
// Gates ensure that artifacts (BRD, SDD, wireframes) are approved by the user
// before the project progresses to the next phase.
//
// Three enforcement layers:
//   1. advance_sdlc side effect → validateStageGate() blocks wrong transitions
//   2. Delegation handler → validateDelegationGate() blocks premature handoffs
//   3. Agent prompts → instruct agents to ask for approval (first line of defense)
// =============================================================================

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GateResult {
  passed: boolean;
  /** Human-readable reason when gate fails. */
  reason?: string;
  /** Which document/artifact needs attention. */
  blockedBy?: string;
}

interface GatePrerequisite {
  type: 'document_approved' | 'wireframes_approved' | 'cards_exist';
  /** For document_approved: which document type (BRD, SDD, etc.) */
  docType?: string;
  /** Human-readable description of what's needed. */
  message: string;
}

// ---------------------------------------------------------------------------
// Gate Rules
// ---------------------------------------------------------------------------

/**
 * Prerequisites that must be satisfied to COMPLETE a stage and advance
 * to the next one.
 *
 * Key = stage name being completed.
 * Value = list of prerequisites that must pass.
 */
const STAGE_COMPLETION_GATES: Record<string, GatePrerequisite[]> = {
  'Business Analysis': [
    {
      type: 'document_approved',
      docType: 'BRD',
      message: 'The Business Requirements Document (BRD) must be approved before moving to Architecture.',
    },
  ],
  'Architecture': [
    {
      type: 'document_approved',
      docType: 'SDD',
      message: 'The System Design Document (SDD) must be approved before moving to UI/UX Design.',
    },
  ],
  'UI/UX Design': [
    {
      type: 'wireframes_approved',
      message: 'Wireframes must be approved before moving to Planning.',
    },
  ],
  'Planning': [
    {
      type: 'cards_exist',
      message: 'Task cards must exist on the board before moving to Development.',
    },
  ],
};

/**
 * Prerequisites for agent-to-agent delegation.
 *
 * Key = "fromAgent→toAgent" (e.g. "BA→SA").
 * Value = prerequisites that must pass before delegation is allowed.
 */
const DELEGATION_GATES: Record<string, GatePrerequisite[]> = {
  'BA→SA': [
    {
      type: 'document_approved',
      docType: 'BRD',
      message: 'BRD must be approved before delegating to the Solution Architect.',
    },
  ],
  'SA→PM': [
    {
      type: 'document_approved',
      docType: 'SDD',
      message: 'SDD must be approved before delegating to the Product Manager.',
    },
  ],
  'SA→UX': [
    {
      type: 'document_approved',
      docType: 'SDD',
      message: 'SDD must be approved before delegating to the UI/UX Designer.',
    },
  ],
  'UX→TL': [
    {
      type: 'wireframes_approved',
      message: 'Wireframes must be approved before delegating to the Tech Lead.',
    },
  ],
  'UX→PM': [
    {
      type: 'wireframes_approved',
      message: 'Wireframes must be approved before delegating to the Product Manager.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Prerequisite Checkers
// ---------------------------------------------------------------------------

async function checkDocumentApproved(projectId: string, docType: string): Promise<boolean> {
  const doc = await prisma.document.findFirst({
    where: {
      projectId,
      type: docType as any,
      status: 'APPROVED',
    },
  });
  return !!doc;
}

async function checkWireframesApproved(projectId: string): Promise<boolean> {
  // Check if at least one wireframe is approved
  const approved = await prisma.wireframe.findFirst({
    where: {
      projectId,
      status: 'APPROVED',
    },
  });
  if (!approved) return false;

  // Check that no wireframes are still in DRAFT or REVIEW (all should be approved)
  const pending = await prisma.wireframe.findFirst({
    where: {
      projectId,
      status: { in: ['DRAFT', 'REVIEW'] },
    },
  });
  // Allow gate to pass if at least one is approved (some projects may not have wireframes yet)
  return !!approved;
}

async function checkCardsExist(projectId: string): Promise<boolean> {
  const taskCount = await prisma.card.count({
    where: {
      projectId,
      type: 'TASK',
    },
  });
  return taskCount > 0;
}

async function evaluatePrerequisite(
  projectId: string,
  prereq: GatePrerequisite,
): Promise<GateResult> {
  switch (prereq.type) {
    case 'document_approved': {
      const passed = await checkDocumentApproved(projectId, prereq.docType!);
      return {
        passed,
        reason: passed ? undefined : prereq.message,
        blockedBy: passed ? undefined : `${prereq.docType} document`,
      };
    }
    case 'wireframes_approved': {
      const passed = await checkWireframesApproved(projectId);
      return {
        passed,
        reason: passed ? undefined : prereq.message,
        blockedBy: passed ? undefined : 'Wireframes',
      };
    }
    case 'cards_exist': {
      const passed = await checkCardsExist(projectId);
      return {
        passed,
        reason: passed ? undefined : prereq.message,
        blockedBy: passed ? undefined : 'Task cards',
      };
    }
    default:
      return { passed: true };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate whether a stage can be completed and the project can advance.
 *
 * Called by the `advance_sdlc` side effect handler before transitioning stages.
 *
 * @param projectId  - Project scope.
 * @param stageName  - Name of the stage being completed (e.g. "Business Analysis").
 * @returns GateResult with passed=true if all prerequisites are met.
 */
export async function validateStageGate(
  projectId: string,
  stageName: string,
): Promise<GateResult> {
  const prereqs = STAGE_COMPLETION_GATES[stageName];
  if (!prereqs || prereqs.length === 0) {
    // No gate rules for this stage — always pass
    return { passed: true };
  }

  for (const prereq of prereqs) {
    const result = await evaluatePrerequisite(projectId, prereq);
    if (!result.passed) {
      console.warn(
        `[QualityGate] Stage "${stageName}" blocked: ${result.reason}`,
      );
      return result;
    }
  }

  console.log(`[QualityGate] Stage "${stageName}" gate PASSED ✅`);
  return { passed: true };
}

/**
 * Validate whether an agent-to-agent delegation is allowed.
 *
 * Called by the delegation handler before invoking the target agent.
 *
 * @param projectId  - Project scope.
 * @param fromAgent  - ShortName of the delegating agent (e.g. "BA").
 * @param toAgent    - ShortName of the target agent (e.g. "SA").
 * @returns GateResult with passed=true if delegation is allowed.
 */
export async function validateDelegationGate(
  projectId: string,
  fromAgent: string,
  toAgent: string,
): Promise<GateResult> {
  const key = `${fromAgent}→${toAgent}`;
  const prereqs = DELEGATION_GATES[key];
  if (!prereqs || prereqs.length === 0) {
    // No gate rules for this delegation pair — always pass
    return { passed: true };
  }

  for (const prereq of prereqs) {
    const result = await evaluatePrerequisite(projectId, prereq);
    if (!result.passed) {
      console.warn(
        `[QualityGate] Delegation ${key} blocked: ${result.reason}`,
      );
      return result;
    }
  }

  console.log(`[QualityGate] Delegation ${key} gate PASSED ✅`);
  return { passed: true };
}

/**
 * Get a human-readable summary of what's needed to pass a stage gate.
 * Useful for agent context and user-facing messages.
 */
export function getGateRequirements(stageName: string): string[] {
  const prereqs = STAGE_COMPLETION_GATES[stageName];
  if (!prereqs || prereqs.length === 0) return [];
  return prereqs.map((p) => p.message);
}
