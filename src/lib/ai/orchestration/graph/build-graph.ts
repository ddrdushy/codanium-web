// =============================================================================
// AI Team Studio — Orchestration Graph Builder
// =============================================================================
// Constructs the LangGraph StateGraph that implements the full AI orchestration
// pipeline with guardrails, routing, context building, LLM streaming,
// response parsing, side effect execution, and agent delegation.
//
// Graph topology:
//
//   START
//     │
//     ▼
//   [inputGuardrail] ──blocked──► END (error SSE)
//     │ passed
//     ▼
//   [route] ──► sets routedAgent in state
//     │
//     ▼
//   [context] ──budget exceeded──► END (budget SSE)
//     │
//     ▼
//   [llm] ──► streams tokens via StreamWriter → SSE
//     │
//     ▼
//   [parseAndExecute] ──► parse, guardrails, side effects, persist
//     │
//     ├──(delegateTo && depth < 3)──► back to [context]
//     │
//     ▼
//   END
//
// Delegation loops back to the context node with routedAgent updated
// to the delegation target and delegationDepth incremented.
// =============================================================================

import { StateGraph } from '@langchain/langgraph';
import { GraphState } from './state';
import { inputGuardrailNode } from './nodes/input-guardrail';
import { routeNode } from './nodes/route';
import { contextNode } from './nodes/context';
import { llmNode } from './nodes/llm';
import { parseAndExecuteNode } from './nodes/parse-execute';

/**
 * Build and compile the orchestration StateGraph.
 * Returns a compiled graph ready to be invoked with `.stream()`.
 */
export function buildOrchestrationGraph() {
  const graph = new StateGraph(GraphState)
    // ── Register nodes ──────────────────────────────────────────────────
    .addNode('inputGuardrail', inputGuardrailNode)
    .addNode('route', routeNode)
    .addNode('context', contextNode)
    .addNode('llm', llmNode)
    .addNode('parseAndExecute', parseAndExecuteNode)

    // ── Edges ───────────────────────────────────────────────────────────

    // START → inputGuardrail
    .addEdge('__start__', 'inputGuardrail')

    // inputGuardrail → route (if passed) or END (if blocked)
    .addConditionalEdges('inputGuardrail', (state) => {
      if (state.inputGuardrailResult?.blocked) {
        return '__end__';
      }
      return 'route';
    })

    // route → context
    .addEdge('route', 'context')

    // context → llm (if budget available) or END (if budget exceeded)
    .addConditionalEdges('context', (state) => {
      if (state.tokenBudgetRemaining !== null && state.tokenBudgetRemaining <= 0) {
        return '__end__';
      }
      return 'llm';
    })

    // llm → parseAndExecute
    .addEdge('llm', 'parseAndExecute')

    // parseAndExecute → context (if delegating) or END
    .addConditionalEdges('parseAndExecute', (state) => {
      if (state.shouldDelegate && (state.delegationDepth ?? 0) < 3) {
        return 'context';
      }
      return '__end__';
    });

  return graph.compile();
}
