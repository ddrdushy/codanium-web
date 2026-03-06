// =============================================================================
// AI Team Studio — Route Node
// =============================================================================
// Determines which agent should handle the user's message.
// Wraps the existing MessageRouter for backward compatibility.
//
// If targetAgentShortName is provided in state, uses it directly.
// Otherwise, auto-routes based on intent classification.
// =============================================================================

import type { GraphStateType } from '../state';
import { messageRouter } from '../../router';

/**
 * Route node.
 * Selects the target agent based on explicit targeting or auto-routing.
 */
export async function routeNode(
  state: GraphStateType,
): Promise<Partial<GraphStateType>> {
  let routedAgent: string;
  let routedIntent: string;

  if (state.targetAgentShortName) {
    // Explicit targeting — use the specified agent
    routedAgent = state.targetAgentShortName;
    routedIntent = 'explicit';
  } else {
    // Auto-route based on message intent
    routedIntent = messageRouter.classifyIntent(state.userMessage);
    routedAgent = await messageRouter.route(state.userMessage, state.projectId);
  }

  return {
    routedAgent,
    routedIntent,
  };
}
