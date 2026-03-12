// =============================================================================
// AI Team Studio — Delegation Handler
// =============================================================================
// Manages agent-to-agent delegation chains. When an agent's response includes
// a delegation marker (e.g. [DELEGATE:SA]context[/DELEGATE]), the orchestration
// engine calls the delegation handler to recursively invoke the target agent.
//
// Safety: Delegation depth is capped at MAX_DELEGATION_DEPTH to prevent
// infinite loops (e.g. agent A delegates to B, B delegates to A).
// =============================================================================

import { AgentExecutionResult } from '@/lib/ai/agents/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum recursion depth for delegation chains.
 *  Full chain: BA → SA → PE/DO/IE/SM → DEC → User = 4-5 levels.
 *  Depth 3 would silently truncate; 5 gives room for the full pipeline. */
const MAX_DELEGATION_DEPTH = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single entry in a delegation chain, recording which agent delegated
 * to which other agent, the context passed, and the result returned.
 */
export interface DelegationChainEntry {
  /** Agent that initiated the delegation (or "user" for the root call). */
  fromAgent: string;
  /** Agent that was delegated to. */
  toAgent: string;
  /** Context / instructions passed to the target agent. */
  context: string;
  /** Full execution result from the target agent. */
  result: AgentExecutionResult;
}

// ---------------------------------------------------------------------------
// DelegationHandler
// ---------------------------------------------------------------------------

export class DelegationHandler {
  /**
   * Process a delegation chain starting from a specific target agent.
   *
   * Each agent in the chain can itself delegate to another agent,
   * producing a chain of DelegationChainEntry records. The chain
   * terminates when:
   *   1. An agent does not delegate further, OR
   *   2. MAX_DELEGATION_DEPTH is reached (silent stop, no error).
   *
   * @param targetAgent        ShortName of the agent to delegate to.
   * @param delegationContext  Instructions / context for the target agent.
   * @param projectId          Project scope.
   * @param executeAgent       Callback that invokes an agent and returns its result.
   *                           Provided by the orchestration engine.
   * @param fromAgent          ShortName of the agent initiating this delegation.
   * @param depth              Current recursion depth (internal, start at 0).
   * @returns Array of DelegationChainEntry objects in execution order.
   */
  async handleDelegation(
    targetAgent: string,
    delegationContext: string,
    projectId: string,
    executeAgent: (
      shortName: string,
      message: string,
      projectId: string,
    ) => Promise<AgentExecutionResult>,
    fromAgent: string = 'user',
    depth: number = 0,
  ): Promise<DelegationChainEntry[]> {
    // Guard: prevent infinite delegation loops
    if (depth >= MAX_DELEGATION_DEPTH) {
      console.warn(
        `[DelegationHandler] Max delegation depth (${MAX_DELEGATION_DEPTH}) reached. ` +
        `Stopping chain at: ${fromAgent} -> ${targetAgent}`,
      );
      return [];
    }

    // Execute the target agent
    let result: AgentExecutionResult;
    try {
      result = await executeAgent(targetAgent, delegationContext, projectId);
    } catch (err) {
      console.error(
        `[DelegationHandler] Agent "${targetAgent}" failed during delegation:`,
        err,
      );
      // Return a synthetic error result so the chain doesn't break
      result = {
        message: `I encountered an error while processing the delegated task. The team should review this manually.`,
        agentShortName: targetAgent,
        actions: [],
      };
    }

    const entry: DelegationChainEntry = {
      fromAgent,
      toAgent: targetAgent,
      context: delegationContext,
      result,
    };

    const chain: DelegationChainEntry[] = [entry];

    // If this agent also delegates, continue the chain recursively
    if (result.delegateTo) {
      const subChain = await this.handleDelegation(
        result.delegateTo,
        result.message, // Pass the agent's response as context for the next agent
        projectId,
        executeAgent,
        targetAgent,   // The current agent becomes fromAgent in the next link
        depth + 1,
      );
      chain.push(...subChain);
    }

    return chain;
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const delegationHandler = new DelegationHandler();
