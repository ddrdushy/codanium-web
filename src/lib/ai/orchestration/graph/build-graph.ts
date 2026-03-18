// =============================================================================
// AI Team Studio — Orchestration Graph Builder
// =============================================================================
// Constructs the LangGraph StateGraph that implements the full AI orchestration
// pipeline with guardrails, routing, context building, LLM streaming,
// tool calling loop, response parsing, and deterministic pipeline routing.
//
// New graph topology (Phase 3 rebuild):
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
//   [llm] ──► streams tokens via StreamWriter, collects tool calls
//     │
//     ▼
//   ┌──(has tool calls && depth < 10)──► [executeTools] ──► back to [llm]
//   │
//   └──(no tool calls)
//     │
//     ▼
//   [parseAndExecute] ──► parse, guardrails, persist
//     │
//     ▼
//   [pipelineRouter] ──► deterministic SDLC routing
//     │
//     ├──(next agent && depth ≤ 15)──► back to [context]
//     │
//     ▼
//   END
//
// Key differences from previous topology:
// 1. NEW: Tool calling loop (llm → executeTools → llm) for structured actions
// 2. NEW: pipelineRouter node for deterministic SDLC routing
// 3. REMOVED: Agent-driven delegation via [DELEGATE:X] markers
// 4. SIMPLIFIED: parseAndExecute no longer handles routing/delegation
// =============================================================================

import { StateGraph } from '@langchain/langgraph';
import { GraphState } from './state';
import { inputGuardrailNode } from './nodes/input-guardrail';
import { routeNode } from './nodes/route';
import { contextNode } from './nodes/context';
import { llmNode } from './nodes/llm';
import { executeToolsNode, MAX_TOOL_LOOPS } from './nodes/execute-tools';
import { parseAndExecuteNode } from './nodes/parse-execute';
import { pipelineRouterNode } from './nodes/pipeline-router';
import { createTraceCollector, withTelemetry, type TraceCollector } from '../telemetry';

/**
 * Build and compile the orchestration StateGraph.
 * Returns a compiled graph and its TraceCollector for finalization.
 *
 * The caller should call `collector.finalize()` after the graph run
 * completes to persist the telemetry summary.
 */
export function buildOrchestrationGraph(): {
  graph: any;
  collector: TraceCollector;
} {
  const collector = createTraceCollector();

  const graph = new StateGraph(GraphState)
    // ── Register nodes (key nodes wrapped with telemetry) ───────────────
    .addNode('inputGuardrail', withTelemetry('inputGuardrail', inputGuardrailNode, collector))
    .addNode('route', withTelemetry('route', routeNode, collector))
    .addNode('context', withTelemetry('context', contextNode, collector))
    .addNode('llm', withTelemetry('llm', llmNode, collector))
    .addNode('executeTools', withTelemetry('executeTools', executeToolsNode, collector))
    .addNode('parseAndExecute', withTelemetry('parseAndExecute', parseAndExecuteNode, collector))
    .addNode('pipelineRouter', withTelemetry('pipelineRouter', pipelineRouterNode, collector))

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

    // llm → tool routing decision
    // If LLM returned tool calls AND we haven't hit max loops → executeTools
    // Otherwise → parseAndExecute
    .addConditionalEdges('llm', (state) => {
      const hasToolCalls = state.toolCalls && state.toolCalls.length > 0;
      const withinLoopLimit = (state.toolLoopCount ?? 0) < MAX_TOOL_LOOPS;

      if (hasToolCalls && withinLoopLimit) {
        console.log(
          `[BuildGraph] Tool loop → executeTools (loop ${(state.toolLoopCount ?? 0) + 1}/${MAX_TOOL_LOOPS}, calls: ${state.toolCalls?.length})`,
        );
        return 'executeTools';
      }

      if (hasToolCalls && !withinLoopLimit) {
        console.warn(
          `[BuildGraph] Tool loop limit reached (${MAX_TOOL_LOOPS}), proceeding to parseAndExecute`,
        );
      }

      return 'parseAndExecute';
    })

    // executeTools → back to llm (tool loop) OR parseAndExecute (circuit breaker)
    // If 3+ consecutive tool failures, stop looping and proceed without the tool result.
    .addConditionalEdges('executeTools', (state) => {
      const errorCount = state.toolErrorCount ?? 0;
      if (errorCount >= 3) {
        console.warn(
          `[BuildGraph] Circuit breaker: ${errorCount} consecutive tool failures, skipping to parseAndExecute`,
        );
        return 'parseAndExecute';
      }
      return 'llm';
    })

    // parseAndExecute → pipelineRouter
    .addEdge('parseAndExecute', 'pipelineRouter')

    // pipelineRouter → context (if delegating to next agent) or END
    .addConditionalEdges('pipelineRouter', (state) => {
      if (state.shouldDelegate && (state.delegationDepth ?? 0) <= 15) {
        console.log(
          `[BuildGraph] Pipeline loop → context (depth: ${state.delegationDepth}, next agent: ${state.routedAgent})`,
        );
        return 'context';
      }
      return '__end__';
    });

  return { graph: graph.compile(), collector };
}
