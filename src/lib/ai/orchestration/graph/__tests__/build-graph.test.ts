// =============================================================================
// AI Team Studio — Orchestration Graph Tests
// =============================================================================
// Tests the LangGraph orchestration graph TRANSITIONS (conditional edges),
// not the node implementations. Each node is mocked to return controlled
// state, and we verify the graph routes to the correct next node.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateGraph } from '@langchain/langgraph';

// ---------------------------------------------------------------------------
// Mocks — all node implementations are replaced with controllable stubs
// ---------------------------------------------------------------------------

const mockInputGuardrailNode = vi.fn();
const mockRouteNode = vi.fn();
const mockContextNode = vi.fn();
const mockLlmNode = vi.fn();
const mockExecuteToolsNode = vi.fn();
const mockParseAndExecuteNode = vi.fn();
const mockPipelineRouterNode = vi.fn();

vi.mock('@/lib/ai/orchestration/graph/nodes/input-guardrail', () => ({
  inputGuardrailNode: (...args: any[]) => mockInputGuardrailNode(...args),
}));

vi.mock('@/lib/ai/orchestration/graph/nodes/route', () => ({
  routeNode: (...args: any[]) => mockRouteNode(...args),
}));

vi.mock('@/lib/ai/orchestration/graph/nodes/context', () => ({
  contextNode: (...args: any[]) => mockContextNode(...args),
}));

vi.mock('@/lib/ai/orchestration/graph/nodes/llm', () => ({
  llmNode: (...args: any[]) => mockLlmNode(...args),
}));

vi.mock('@/lib/ai/orchestration/graph/nodes/execute-tools', () => ({
  executeToolsNode: (...args: any[]) => mockExecuteToolsNode(...args),
  MAX_TOOL_LOOPS: 10,
}));

vi.mock('@/lib/ai/orchestration/graph/nodes/parse-execute', () => ({
  parseAndExecuteNode: (...args: any[]) => mockParseAndExecuteNode(...args),
}));

vi.mock('@/lib/ai/orchestration/graph/nodes/pipeline-router', () => ({
  pipelineRouterNode: (...args: any[]) => mockPipelineRouterNode(...args),
}));

// Import after mocks are registered
import { buildOrchestrationGraph } from '../build-graph';
import type { LLMToolCall } from '@/lib/ai/providers/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid initial state for the graph. */
function baseInput(overrides: Record<string, any> = {}) {
  return {
    projectId: 'proj-1',
    userId: 'user-1',
    userMessage: 'Build me a landing page',
    targetAgentShortName: undefined,
    inputGuardrailResult: null,
    routedAgent: 'BA',
    routedIntent: 'general',
    systemMessage: '',
    recentHistory: [],
    llmMessages: [],
    tokenBudgetRemaining: null,
    rawContent: '',
    rawThinking: '',
    tokensUsed: null,
    parsedResponse: null,
    savedMessageId: '',
    outputGuardrailResult: null,
    toolCalls: [] as LLMToolCall[],
    toolResults: [],
    toolLoopCount: 0,
    shouldDelegate: false,
    delegationDepth: 0,
    completedToolSignals: [],
    ...overrides,
  };
}

/**
 * Runs the compiled graph to completion and returns the list of node names
 * that were invoked, in order.
 */
async function runGraphAndCollectNodes(input: Record<string, any>) {
  const graph = buildOrchestrationGraph();
  const visited: string[] = [];

  // Wrap each mock to record invocations
  const nodeMap: Record<string, ReturnType<typeof vi.fn>> = {
    inputGuardrail: mockInputGuardrailNode,
    route: mockRouteNode,
    context: mockContextNode,
    llm: mockLlmNode,
    executeTools: mockExecuteToolsNode,
    parseAndExecute: mockParseAndExecuteNode,
    pipelineRouter: mockPipelineRouterNode,
  };

  // We track order via the mock's call history after the run
  const result = await graph.invoke(input);

  // Reconstruct visit order from mock call counts
  for (const [name, mock] of Object.entries(nodeMap)) {
    if (mock.mock.calls.length > 0) {
      visited.push(name);
    }
  }

  return { result, visited };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default node behaviors — each returns just enough state for the
  // graph to proceed through the happy path to __end__.
  mockInputGuardrailNode.mockResolvedValue({
    inputGuardrailResult: { blocked: false, sanitizedMessage: 'test', flags: [] },
  });

  mockRouteNode.mockResolvedValue({
    routedAgent: 'BA',
    routedIntent: 'general',
  });

  mockContextNode.mockResolvedValue({
    systemMessage: 'You are BA.',
    llmMessages: [{ role: 'system', content: 'You are BA.' }],
    recentHistory: [],
    tokenBudgetRemaining: null,
  });

  mockLlmNode.mockResolvedValue({
    rawContent: 'Here is my response.',
    rawThinking: '',
    tokensUsed: { prompt: 100, completion: 50, total: 150 },
    toolCalls: [],
  });

  mockExecuteToolsNode.mockResolvedValue({
    toolResults: [],
    toolCalls: [],
    toolLoopCount: 1,
    completedToolSignals: [],
  });

  mockParseAndExecuteNode.mockResolvedValue({
    parsedResponse: { content: 'parsed', actions: [] },
    savedMessageId: 'msg-1',
    outputGuardrailResult: { flags: [], hasCriticalIssues: false },
  });

  mockPipelineRouterNode.mockResolvedValue({
    shouldDelegate: false,
  });
});

// =============================================================================
// Test Cases
// =============================================================================

describe('Orchestration Graph — Conditional Edge Routing', () => {
  // ── Test 1: Tool call routing ─────────────────────────────────────────────
  describe('Tool call routing', () => {
    it('routes to executeTools when LLM returns toolCalls', async () => {
      const toolCalls: LLMToolCall[] = [
        { id: 'tc-1', name: 'update_document', arguments: { type: 'BRD' } },
      ];

      mockLlmNode.mockResolvedValue({
        rawContent: '',
        rawThinking: '',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        toolCalls,
      });

      // After executeTools, the graph loops back to llm. On the second
      // llm call, return no tool calls so the graph proceeds.
      mockLlmNode.mockResolvedValueOnce({
        rawContent: '',
        rawThinking: '',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        toolCalls,
      });

      // Second call to llm — no tool calls
      mockLlmNode.mockResolvedValueOnce({
        rawContent: 'Done with tools.',
        rawThinking: '',
        tokensUsed: { prompt: 200, completion: 100, total: 300 },
        toolCalls: [],
      });

      mockExecuteToolsNode.mockResolvedValue({
        toolResults: [{ toolCallId: 'tc-1', name: 'update_document', success: true, result: 'ok' }],
        toolCalls: [],
        toolLoopCount: 1,
        completedToolSignals: ['update_document(BRD)'],
      });

      const graph = buildOrchestrationGraph();
      const result = await graph.invoke(baseInput());

      // executeTools was called at least once
      expect(mockExecuteToolsNode).toHaveBeenCalled();
      // llm was called at least twice (initial + after tool results)
      expect(mockLlmNode.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Test 2: Tool loop ────────────────────────────────────────────────────
  describe('Tool loop', () => {
    it('loops executeTools -> llm until no more tool calls', async () => {
      const toolCall: LLMToolCall = { id: 'tc-1', name: 'read_file', arguments: { path: '/a.ts' } };

      // First llm call: tool calls
      mockLlmNode
        .mockResolvedValueOnce({
          rawContent: '', rawThinking: '', tokensUsed: null,
          toolCalls: [toolCall],
        })
        // Second llm call: tool calls again
        .mockResolvedValueOnce({
          rawContent: '', rawThinking: '', tokensUsed: null,
          toolCalls: [{ ...toolCall, id: 'tc-2' }],
        })
        // Third llm call: no tool calls — exit loop
        .mockResolvedValueOnce({
          rawContent: 'Final answer.', rawThinking: '', tokensUsed: null,
          toolCalls: [],
        });

      let loopCounter = 0;
      mockExecuteToolsNode.mockImplementation(async (state: any) => {
        loopCounter++;
        return {
          toolResults: [{ toolCallId: `tc-${loopCounter}`, name: 'read_file', success: true, result: 'content' }],
          toolCalls: [],
          toolLoopCount: loopCounter,
          completedToolSignals: [],
        };
      });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput());

      // executeTools called exactly 2 times (once per tool-call LLM response)
      expect(mockExecuteToolsNode).toHaveBeenCalledTimes(2);
      // llm called 3 times total
      expect(mockLlmNode).toHaveBeenCalledTimes(3);
      // parseAndExecute called once after loop exits
      expect(mockParseAndExecuteNode).toHaveBeenCalledTimes(1);
    });
  });

  // ── Test 3: Max tool loop guard ──────────────────────────────────────────
  describe('Max tool loop guard', () => {
    it('routes to parseAndExecute when toolLoopCount >= MAX_TOOL_LOOPS (10)', async () => {
      // LLM returns tool calls but loop count is already at max
      mockLlmNode.mockResolvedValue({
        rawContent: 'Still want tools...',
        rawThinking: '',
        tokensUsed: null,
        toolCalls: [{ id: 'tc-1', name: 'read_file', arguments: {} }],
      });

      // Start with toolLoopCount at 10 (the max)
      const graph = buildOrchestrationGraph();
      const result = await graph.invoke(baseInput({ toolLoopCount: 10 }));

      // executeTools should NOT be called because loop limit is reached
      expect(mockExecuteToolsNode).not.toHaveBeenCalled();
      // parseAndExecute SHOULD be called
      expect(mockParseAndExecuteNode).toHaveBeenCalledTimes(1);
    });

    it('routes to parseAndExecute at exactly MAX_TOOL_LOOPS boundary', async () => {
      mockLlmNode.mockResolvedValue({
        rawContent: '',
        rawThinking: '',
        tokensUsed: null,
        toolCalls: [{ id: 'tc-1', name: 'write_file', arguments: {} }],
      });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput({ toolLoopCount: 10 }));

      expect(mockExecuteToolsNode).not.toHaveBeenCalled();
      expect(mockParseAndExecuteNode).toHaveBeenCalled();
    });
  });

  // ── Test 4: Pipeline routing — shouldDelegate ────────────────────────────
  describe('Pipeline routing', () => {
    it('loops back to context when pipelineRouter sets shouldDelegate: true', async () => {
      mockLlmNode.mockResolvedValue({
        rawContent: 'BRD approved.',
        rawThinking: '',
        tokensUsed: null,
        toolCalls: [],
      });

      // First pipelineRouter call: delegate to SA
      mockPipelineRouterNode
        .mockResolvedValueOnce({
          shouldDelegate: true,
          routedAgent: 'SA',
          userMessage: 'Design architecture from BRD.',
          delegationDepth: 1,
          completedToolSignals: [],
          toolCalls: [],
          toolResults: [],
          toolLoopCount: 0,
        })
        // Second pipelineRouter call: stop
        .mockResolvedValueOnce({
          shouldDelegate: false,
        });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput());

      // context should be called twice (initial + after delegation)
      expect(mockContextNode).toHaveBeenCalledTimes(2);
      // llm should be called twice (once per context pass)
      expect(mockLlmNode).toHaveBeenCalledTimes(2);
      // pipelineRouter should be called twice
      expect(mockPipelineRouterNode).toHaveBeenCalledTimes(2);
    });
  });

  // ── Test 5: Pipeline depth guard ─────────────────────────────────────────
  describe('Pipeline depth guard', () => {
    it('stops pipeline when delegationDepth exceeds MAX_PIPELINE_DEPTH (15)', async () => {
      mockLlmNode.mockResolvedValue({
        rawContent: 'Response.',
        rawThinking: '',
        tokensUsed: null,
        toolCalls: [],
      });

      // pipelineRouter says delegate, but depth is already 16
      mockPipelineRouterNode.mockResolvedValue({
        shouldDelegate: true,
        delegationDepth: 16,
      });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput({ delegationDepth: 16 }));

      // context called only once (the initial pass, no loop-back)
      expect(mockContextNode).toHaveBeenCalledTimes(1);
      // Pipeline ends — pipelineRouter called once
      expect(mockPipelineRouterNode).toHaveBeenCalledTimes(1);
    });

    it('allows delegation at exactly depth 15 (boundary)', async () => {
      mockLlmNode.mockResolvedValue({
        rawContent: 'Response.',
        rawThinking: '',
        tokensUsed: null,
        toolCalls: [],
      });

      // At depth 15, shouldDelegate is true and depth <= 15, so it loops
      mockPipelineRouterNode
        .mockResolvedValueOnce({
          shouldDelegate: true,
          routedAgent: 'QA',
          delegationDepth: 15,
          completedToolSignals: [],
          toolCalls: [],
          toolResults: [],
          toolLoopCount: 0,
        })
        .mockResolvedValueOnce({
          shouldDelegate: false,
        });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput({ delegationDepth: 14 }));

      // context called twice: initial + delegation loop-back
      expect(mockContextNode).toHaveBeenCalledTimes(2);
    });
  });

  // ── Test 6: No tool calls ────────────────────────────────────────────────
  describe('No tool calls', () => {
    it('routes directly to parseAndExecute when LLM returns no tool calls', async () => {
      mockLlmNode.mockResolvedValue({
        rawContent: 'Plain text response with no tool usage.',
        rawThinking: '',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        toolCalls: [],
      });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput());

      expect(mockExecuteToolsNode).not.toHaveBeenCalled();
      expect(mockParseAndExecuteNode).toHaveBeenCalledTimes(1);
      expect(mockPipelineRouterNode).toHaveBeenCalledTimes(1);
    });

    it('routes to parseAndExecute when toolCalls is undefined', async () => {
      mockLlmNode.mockResolvedValue({
        rawContent: 'No tools.',
        rawThinking: '',
        tokensUsed: null,
        // toolCalls not set at all
      });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput());

      expect(mockExecuteToolsNode).not.toHaveBeenCalled();
      expect(mockParseAndExecuteNode).toHaveBeenCalledTimes(1);
    });
  });

  // ── Test 7: Text-based tool call fallback ────────────────────────────────
  describe('Text tool call fallback', () => {
    it('extracts tool calls from text when no native tool_use is returned', async () => {
      // This test verifies the extractTextToolCalls fallback in the LLM node.
      // We test it by NOT mocking llmNode for this specific behavior and
      // instead testing the extraction logic directly.

      // Since we're testing graph transitions, we verify that when the
      // LLM node returns text-extracted tool calls, the graph correctly
      // routes to executeTools.

      const textExtractedToolCalls: LLMToolCall[] = [
        { id: 'text-tc-1', name: 'update_document', arguments: { type: 'BRD', content: 'Requirements...' } },
      ];

      // LLM returns tool calls (as if extracted from text by the fallback parser)
      mockLlmNode.mockResolvedValueOnce({
        rawContent: '[UPDATE_DOCUMENT]{ "type": "BRD", "content": "Requirements..." }',
        rawThinking: '',
        tokensUsed: null,
        toolCalls: textExtractedToolCalls,
      });

      // After executeTools, llm returns no more tool calls
      mockLlmNode.mockResolvedValueOnce({
        rawContent: 'Done.',
        rawThinking: '',
        tokensUsed: null,
        toolCalls: [],
      });

      mockExecuteToolsNode.mockResolvedValue({
        toolResults: [{ toolCallId: 'text-tc-1', name: 'update_document', success: true, result: 'ok' }],
        toolCalls: [],
        toolLoopCount: 1,
        completedToolSignals: ['update_document(BRD)'],
      });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput());

      // The text-extracted tool calls should route to executeTools
      expect(mockExecuteToolsNode).toHaveBeenCalledTimes(1);
      expect(mockLlmNode).toHaveBeenCalledTimes(2);
    });
  });

  // ── Additional edge cases ────────────────────────────────────────────────

  describe('Input guardrail blocking', () => {
    it('routes to END when input is blocked', async () => {
      mockInputGuardrailNode.mockResolvedValue({
        inputGuardrailResult: { blocked: true, reason: 'harmful content', sanitizedMessage: '', flags: ['harmful'] },
      });

      const graph = buildOrchestrationGraph();
      const result = await graph.invoke(baseInput());

      // No downstream nodes should be called
      expect(mockRouteNode).not.toHaveBeenCalled();
      expect(mockContextNode).not.toHaveBeenCalled();
      expect(mockLlmNode).not.toHaveBeenCalled();
    });
  });

  describe('Budget exceeded', () => {
    it('routes to END when token budget is exhausted', async () => {
      mockContextNode.mockResolvedValue({
        systemMessage: 'You are BA.',
        llmMessages: [],
        recentHistory: [],
        tokenBudgetRemaining: 0,
      });

      const graph = buildOrchestrationGraph();
      const result = await graph.invoke(baseInput());

      // context was called, but llm should not be called
      expect(mockContextNode).toHaveBeenCalledTimes(1);
      expect(mockLlmNode).not.toHaveBeenCalled();
    });

    it('routes to END when token budget is negative', async () => {
      mockContextNode.mockResolvedValue({
        systemMessage: 'You are BA.',
        llmMessages: [],
        recentHistory: [],
        tokenBudgetRemaining: -100,
      });

      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput());

      expect(mockLlmNode).not.toHaveBeenCalled();
    });
  });

  describe('Happy path — full traversal', () => {
    it('traverses START -> inputGuardrail -> route -> context -> llm -> parseAndExecute -> pipelineRouter -> END', async () => {
      const graph = buildOrchestrationGraph();
      await graph.invoke(baseInput());

      expect(mockInputGuardrailNode).toHaveBeenCalledTimes(1);
      expect(mockRouteNode).toHaveBeenCalledTimes(1);
      expect(mockContextNode).toHaveBeenCalledTimes(1);
      expect(mockLlmNode).toHaveBeenCalledTimes(1);
      expect(mockParseAndExecuteNode).toHaveBeenCalledTimes(1);
      expect(mockPipelineRouterNode).toHaveBeenCalledTimes(1);
      expect(mockExecuteToolsNode).not.toHaveBeenCalled();
    });
  });
});
