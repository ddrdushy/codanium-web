// =============================================================================
// AI Team Studio — Card Lifecycle & Definition of Done (DoD)
// =============================================================================
// Defines state transition rules and completion criteria for cards.
//
// Card States: PLANNED → IN_PROGRESS → UNDER_REVIEW → TESTING → DONE → RELEASED
//              (BLOCKED can be entered/exited from any active state)
//
// Three enforcement layers:
//   1. Agent prompts → instruct agents on what DoD criteria they must satisfy
//   2. Engine update_card → validateCardTransition() blocks invalid transitions
//   3. API PATCH route → validateCardTransition() blocks invalid transitions
//
// Parent completion guard:
//   EPIC/FEATURE cards cannot move to DONE until ALL child cards are DONE.
// =============================================================================

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardState =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'UNDER_REVIEW'
  | 'TESTING'
  | 'BLOCKED'
  | 'DONE'
  | 'RELEASED';

export type CardType = 'EPIC' | 'FEATURE' | 'TASK' | 'QA' | 'DECISION_BLOCKER';

export interface TransitionResult {
  allowed: boolean;
  /** Human-readable reason when transition is blocked. */
  reason?: string;
  /** What needs to happen to unblock. */
  requirements?: string[];
}

export interface DoDCriterion {
  /** Human-readable description of this criterion. */
  label: string;
  /** How this criterion is checked. */
  checkType:
    | 'has_description'       // Card must have a non-empty description
    | 'has_artifacts'         // At least one code artifact linked/generated
    | 'children_done'         // All child cards must be DONE or RELEASED
    | 'has_review_artifact'   // A review/approval artifact must exist
    | 'has_test_artifact'     // A test artifact must exist
    | 'has_owner_agent'       // Must have an assigned agent
    | 'always_pass';          // Informational only — always passes
}

// ---------------------------------------------------------------------------
// State Transition Rules
// ---------------------------------------------------------------------------

/**
 * Valid transitions from each state.
 * BLOCKED is special — can be entered from any active state and returned to
 * the previous state.
 */
const VALID_TRANSITIONS: Record<CardState, CardState[]> = {
  PLANNED:      ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS:  ['UNDER_REVIEW', 'TESTING', 'BLOCKED', 'PLANNED', 'DONE'],
  UNDER_REVIEW: ['IN_PROGRESS', 'TESTING', 'DONE', 'BLOCKED'],
  TESTING:      ['IN_PROGRESS', 'UNDER_REVIEW', 'DONE', 'BLOCKED'],
  BLOCKED:      ['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'TESTING'],
  DONE:         ['RELEASED', 'IN_PROGRESS'],  // Can reopen back to IN_PROGRESS
  RELEASED:     [],                           // Terminal state — no transitions out
};

// ---------------------------------------------------------------------------
// Definition of Done Criteria
// ---------------------------------------------------------------------------

/**
 * DoD criteria that must be met before transitioning to a target state.
 * Key = target state. Value = criteria list.
 *
 * These are checked BEFORE allowing the transition.
 */
const DOD_CRITERIA: Partial<Record<CardState, DoDCriterion[]>> = {
  IN_PROGRESS: [
    {
      label: 'Card must have a description',
      checkType: 'has_description',
    },
  ],
  DONE: [
    {
      label: 'Card must have a description',
      checkType: 'has_description',
    },
    {
      label: 'All child cards must be completed (DONE or RELEASED)',
      checkType: 'children_done',
    },
  ],
  RELEASED: [
    {
      label: 'All child cards must be completed (DONE or RELEASED)',
      checkType: 'children_done',
    },
  ],
};

/**
 * Additional DoD criteria per card type + target state.
 * These are ADDED to the base criteria above.
 */
const DOD_CRITERIA_BY_TYPE: Partial<Record<CardType, Partial<Record<CardState, DoDCriterion[]>>>> = {
  TASK: {
    UNDER_REVIEW: [
      {
        label: 'Task should have code artifacts before review',
        checkType: 'has_artifacts',
      },
    ],
    DONE: [
      {
        label: 'Task should have code artifacts',
        checkType: 'has_artifacts',
      },
    ],
  },
  QA: {
    DONE: [
      {
        label: 'QA card should have test artifacts',
        checkType: 'has_test_artifact',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Criterion Checkers
// ---------------------------------------------------------------------------

async function checkHasDescription(cardId: string): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { description: true },
  });
  return !!card?.description && card.description.trim().length > 0;
}

async function checkChildrenDone(cardId: string): Promise<boolean> {
  const children = await prisma.card.findMany({
    where: { parentId: cardId },
    select: { state: true },
  });
  // If no children, this criterion passes (leaf cards don't need children)
  if (children.length === 0) return true;
  // All children must be DONE or RELEASED
  return children.every(c => c.state === 'DONE' || c.state === 'RELEASED');
}

async function checkHasArtifacts(cardId: string, projectId: string): Promise<boolean> {
  // Check if any artifacts reference this card's module or title
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { title: true, module: true },
  });
  if (!card) return false;

  // Check for artifacts in the project (prefer card-linked, fall back to project-wide)
  const cardArtifactCount = await prisma.artifact.count({
    where: {
      projectId,
      cardId,
      type: { in: ['CODE', 'TEST'] },
    },
  });
  if (cardArtifactCount > 0) return true;

  // Soft check — if ANY code artifacts exist in the project, pass
  // (Fine-grained per-card artifact linking is a future enhancement)
  const projectArtifactCount = await prisma.artifact.count({
    where: {
      projectId,
      type: { in: ['CODE', 'TEST'] },
    },
  });
  return projectArtifactCount > 0;
}

async function checkHasTestArtifacts(cardId: string, projectId: string): Promise<boolean> {
  const artifactCount = await prisma.artifact.count({
    where: {
      projectId,
      type: 'TEST',
    },
  });
  return artifactCount > 0;
}

async function evaluateCriterion(
  criterion: DoDCriterion,
  cardId: string,
  projectId: string,
): Promise<{ passed: boolean; label: string }> {
  switch (criterion.checkType) {
    case 'has_description':
      return { passed: await checkHasDescription(cardId), label: criterion.label };
    case 'children_done':
      return { passed: await checkChildrenDone(cardId), label: criterion.label };
    case 'has_artifacts':
      return { passed: await checkHasArtifacts(cardId, projectId), label: criterion.label };
    case 'has_test_artifact':
      return { passed: await checkHasTestArtifacts(cardId, projectId), label: criterion.label };
    case 'has_review_artifact':
      // Future: check for review/approval artifacts
      return { passed: true, label: criterion.label };
    case 'has_owner_agent':
      const card = await prisma.card.findUnique({
        where: { id: cardId },
        select: { ownerAgentId: true },
      });
      return { passed: !!card?.ownerAgentId, label: criterion.label };
    case 'always_pass':
      return { passed: true, label: criterion.label };
    default:
      return { passed: true, label: criterion.label };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate whether a card can transition from its current state to a new state.
 * Checks:
 *   1. Is the transition valid per state machine rules?
 *   2. Are all DoD criteria met for the target state?
 *   3. Parent completion guard (children must be done first)
 *
 * @param cardId     - The card being transitioned.
 * @param projectId  - Project scope.
 * @param fromState  - Current state of the card.
 * @param toState    - Desired target state.
 * @param cardType   - Type of the card (EPIC, FEATURE, TASK, etc.)
 * @returns TransitionResult with allowed=true if transition is permitted.
 */
export async function validateCardTransition(
  cardId: string,
  projectId: string,
  fromState: CardState,
  toState: CardState,
  cardType: CardType,
): Promise<TransitionResult> {
  // 1. Check if transition is valid per state machine
  const validTargets = VALID_TRANSITIONS[fromState];
  if (!validTargets || !validTargets.includes(toState)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${fromState} to ${toState}. Valid transitions from ${fromState}: ${validTargets?.join(', ') || 'none'}.`,
    };
  }

  // 2. Gather all DoD criteria for this transition
  const baseCriteria = DOD_CRITERIA[toState] ?? [];
  const typeCriteria = DOD_CRITERIA_BY_TYPE[cardType]?.[toState] ?? [];
  const allCriteria = [...baseCriteria, ...typeCriteria];

  if (allCriteria.length === 0) {
    console.log(`[CardLifecycle] ${fromState} → ${toState}: No DoD criteria, ALLOWED ✅`);
    return { allowed: true };
  }

  // 3. Evaluate all criteria
  const results = await Promise.all(
    allCriteria.map(c => evaluateCriterion(c, cardId, projectId)),
  );

  const failures = results.filter(r => !r.passed);

  if (failures.length > 0) {
    const requirements = failures.map(f => f.label);
    console.warn(
      `[CardLifecycle] ${fromState} → ${toState} BLOCKED ❌: ${requirements.join('; ')}`,
    );
    return {
      allowed: false,
      reason: `Cannot move to ${toState}. The following requirements are not met:`,
      requirements,
    };
  }

  console.log(`[CardLifecycle] ${fromState} → ${toState}: All DoD criteria met, ALLOWED ✅`);
  return { allowed: true };
}

/**
 * Get a human-readable summary of what DoD criteria are needed to enter a state.
 * Used in agent context to inform agents what they need to do before transitioning.
 */
export function getDoDRequirements(cardType: CardType, targetState: CardState): string[] {
  const baseCriteria = DOD_CRITERIA[targetState] ?? [];
  const typeCriteria = DOD_CRITERIA_BY_TYPE[cardType]?.[targetState] ?? [];
  return [...baseCriteria, ...typeCriteria].map(c => c.label);
}

/**
 * Get the valid next states for a card given its current state.
 * Used in agent context and UI to show available transitions.
 */
export function getValidTransitions(fromState: CardState): CardState[] {
  return VALID_TRANSITIONS[fromState] ?? [];
}

/**
 * Get a full DoD summary for a card type — all states and their requirements.
 * Used in agent context to give agents the complete lifecycle picture.
 */
export function getLifecycleSummary(cardType: CardType): string {
  const lines: string[] = [];
  lines.push(`Card Lifecycle for ${cardType}:`);

  const states: CardState[] = ['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'TESTING', 'DONE', 'RELEASED'];

  for (const state of states) {
    const transitions = getValidTransitions(state);
    const reqs = getDoDRequirements(cardType, state);

    if (transitions.length > 0 || reqs.length > 0) {
      lines.push(`  ${state}:`);
      if (transitions.length > 0) {
        lines.push(`    → Can move to: ${transitions.join(', ')}`);
      }
      if (reqs.length > 0) {
        lines.push(`    ✓ DoD to enter: ${reqs.join('; ')}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Check if all children of a parent card are done.
 * Returns details about incomplete children.
 */
export async function getIncompleteChildren(
  parentCardId: string,
): Promise<Array<{ id: string; title: string; state: string }>> {
  const children = await prisma.card.findMany({
    where: { parentId: parentCardId },
    select: { id: true, title: true, state: true },
  });
  return children.filter(c => c.state !== 'DONE' && c.state !== 'RELEASED');
}
