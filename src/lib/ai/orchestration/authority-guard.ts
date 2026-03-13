// =============================================================================
// AI Team Studio — Agent Authority Enforcement
// =============================================================================
// Runtime validation of agent actions against their authority definitions.
// Each agent has canWrite/canRead/canNever arrays that define what resources
// they're allowed to interact with. This module enforces those boundaries
// before any side effect is executed.
//
// Key rule: If a resource appears in canNever, the action is ALWAYS blocked.
//           If a resource is NOT in canWrite, the action is blocked.
//
// This is the third and final enforcement layer in the pipeline:
//   1. Quality Gates — block stage/delegation progression
//   2. Definition of Done — block invalid card state transitions
//   3. Authority Guard — block unauthorized agent actions (THIS MODULE)
// =============================================================================

import { AgentAction, AgentDefinition } from '@/lib/ai/agents/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthorityCheckResult {
  allowed: boolean;
  /** Human-readable reason when action is blocked. */
  reason?: string;
  /** The resource that was checked. */
  resource?: string;
  /** Whether it was blocked by canNever (hard block) or missing from canWrite (soft block). */
  blockType?: 'canNever' | 'missingCanWrite';
}

// ---------------------------------------------------------------------------
// Action → Resource Mapping
// ---------------------------------------------------------------------------

/**
 * Maps each action type to the resource authority required.
 * An action is allowed if the resource is in canWrite and NOT in canNever.
 *
 * Special cases:
 *   - update_card with state change requires 'card_state' authority
 *   - update_card without state change requires 'cards' authority
 *   - remember action requires no authority (all agents can remember)
 *   - delegate action requires no authority (handled by delegation gates)
 */
function getRequiredResource(action: AgentAction): string | null {
  switch (action.type) {
    case 'create_card':
      return 'cards';

    case 'update_card':
      // If the action includes a state change, require card_state authority
      // Otherwise just require cards authority
      if (action.data.state) {
        return 'card_state';
      }
      return 'cards';

    case 'create_decision':
      return 'decisions';

    case 'create_document':
    case 'update_document':
    case 'approve_document':
      return 'documents';

    case 'advance_sdlc':
      return 'sdlc_stage';

    case 'update_agent_status':
      return 'agent_assignments';

    case 'create_branch':
    case 'create_pr':
    case 'create_release':
    case 'create_pipeline':
    case 'create_repo':
      return 'code_artifacts';

    case 'trigger_deploy':
      return 'infrastructure';

    case 'run_code':
      return 'code_artifacts';

    case 'remember':
      // All agents can save to project memory
      return null;

    case 'delegate':
      // Delegation is handled by delegation gates, not authority
      return null;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether an agent is authorized to perform a specific action.
 *
 * @param agentDef - The agent definition with authority rules.
 * @param action   - The action being attempted.
 * @returns AuthorityCheckResult with allowed=true if the agent can perform the action.
 */
export function checkAgentAuthority(
  agentDef: AgentDefinition,
  action: AgentAction,
): AuthorityCheckResult {
  const resource = getRequiredResource(action);

  // No resource required — always allowed
  if (!resource) {
    return { allowed: true };
  }

  const { canWrite, canNever } = agentDef.authority;

  // Check canNever first — hard block
  if (canNever.includes(resource)) {
    const reason = `Agent "${agentDef.shortName}" (${agentDef.name}) is NEVER allowed to access "${resource}". Action "${action.type}" was blocked.`;
    console.warn(`[AuthorityGuard] BLOCKED (canNever): ${reason}`);
    return {
      allowed: false,
      reason,
      resource,
      blockType: 'canNever',
    };
  }

  // Check canWrite — must be present for write actions
  if (!canWrite.includes(resource)) {
    const reason = `Agent "${agentDef.shortName}" (${agentDef.name}) does not have write access to "${resource}". Action "${action.type}" was blocked. Allowed writes: [${canWrite.join(', ')}].`;
    console.warn(`[AuthorityGuard] BLOCKED (missingCanWrite): ${reason}`);
    return {
      allowed: false,
      reason,
      resource,
      blockType: 'missingCanWrite',
    };
  }

  // Allowed
  return { allowed: true };
}

/**
 * Filter a list of actions, keeping only those the agent is authorized to perform.
 * Returns the filtered list and a list of blocked actions with reasons.
 *
 * @param agentDef - The agent definition.
 * @param actions  - Full list of parsed actions.
 * @returns Object with allowed actions and blocked actions.
 */
export function filterAuthorizedActions(
  agentDef: AgentDefinition,
  actions: AgentAction[],
): {
  allowed: AgentAction[];
  blocked: Array<{ action: AgentAction; result: AuthorityCheckResult }>;
} {
  const allowed: AgentAction[] = [];
  const blocked: Array<{ action: AgentAction; result: AuthorityCheckResult }> = [];

  for (const action of actions) {
    const result = checkAgentAuthority(agentDef, action);
    if (result.allowed) {
      allowed.push(action);
    } else {
      blocked.push({ action, result });
    }
  }

  if (blocked.length > 0) {
    console.warn(
      `[AuthorityGuard] Agent ${agentDef.shortName}: ${blocked.length}/${actions.length} actions blocked by authority rules`,
    );
    for (const b of blocked) {
      console.warn(`  ❌ ${b.action.type}: ${b.result.reason}`);
    }
  }

  return { allowed, blocked };
}

/**
 * Get a human-readable summary of what an agent can and cannot do.
 * Used in agent context to remind agents of their boundaries.
 */
export function getAuthorityDescription(agentDef: AgentDefinition): string {
  const lines: string[] = [];
  lines.push(`Authority for ${agentDef.shortName} (${agentDef.name}):`);

  if (agentDef.authority.canWrite.length > 0) {
    lines.push(`  ✅ Can write: ${agentDef.authority.canWrite.join(', ')}`);
  }

  if (agentDef.authority.canNever.length > 0) {
    lines.push(`  🚫 Never allowed: ${agentDef.authority.canNever.join(', ')}`);
  }

  return lines.join('\n');
}
