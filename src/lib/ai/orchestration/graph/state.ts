// =============================================================================
// AI Team Studio — LangGraph State Schema
// =============================================================================
// Defines the typed state object that flows through the orchestration graph.
// Uses LangGraph's Annotation.Root for type-safe state management.
// Each node reads and writes to distinct keys — no custom reducers needed.
// =============================================================================

import { Annotation } from '@langchain/langgraph';
import { LLMMessage, LLMToolCall } from '@/lib/ai/providers/types';
import { AgentAction } from '@/lib/ai/agents/types';
import { ParsedResponse } from '@/lib/ai/agents/response-parser';
import { ToolResult } from '@/lib/ai/tools/tool-definitions';
import type { TrackedToolCall } from '../loop-detector';

// ---------------------------------------------------------------------------
// Guardrail Result Types
// ---------------------------------------------------------------------------

export interface InputGuardrailResult {
  /** Whether the input was blocked by guardrails. */
  blocked: boolean;
  /** Reason the input was blocked, if applicable. */
  reason?: string;
  /** The sanitized user message (PII redacted, etc.). */
  sanitizedMessage: string;
  /** Flags raised during input validation (informational, not blocking). */
  flags: string[];
}

export interface OutputGuardrailResult {
  /** Flags raised during output validation (logged but typically non-blocking). */
  flags: string[];
  /** Whether any critical output issue was detected. */
  hasCriticalIssues: boolean;
}

// ---------------------------------------------------------------------------
// Graph State Annotation
// ---------------------------------------------------------------------------

export const GraphState = Annotation.Root({
  // ── Request Inputs ──────────────────────────────────────────────────────
  /** The project scope for all operations. */
  projectId: Annotation<string>,
  /** The authenticated user ID. */
  userId: Annotation<string>,
  /** The raw user message as submitted. */
  userMessage: Annotation<string>,
  /** Explicit target agent shortName (if user specified one). */
  targetAgentShortName: Annotation<string | undefined>,

  // ── Input Guardrails ────────────────────────────────────────────────────
  /** Result from the input guardrail node. */
  inputGuardrailResult: Annotation<InputGuardrailResult | null>,

  // ── Routing ─────────────────────────────────────────────────────────────
  /** The agent shortName selected by routing (auto or explicit). */
  routedAgent: Annotation<string>,
  /** The classified user intent. */
  routedIntent: Annotation<string>,

  // ── Context ─────────────────────────────────────────────────────────────
  /** Composed system message for the LLM. */
  systemMessage: Annotation<string>,
  /** Recent conversation history as LLM messages. */
  recentHistory: Annotation<LLMMessage[]>,
  /** Full LLM messages array (system + history + user). */
  llmMessages: Annotation<LLMMessage[]>,
  /** Remaining token budget for this project (null = unlimited). */
  tokenBudgetRemaining: Annotation<number | null>,

  // ── LLM Output ──────────────────────────────────────────────────────────
  /** Accumulated raw content from the LLM stream. */
  rawContent: Annotation<string>,
  /** Accumulated thinking/reasoning tokens from the LLM. */
  rawThinking: Annotation<string>,
  /** Token counts from the LLM response. */
  tokensUsed: Annotation<{ prompt: number; completion: number; total: number } | null>,

  // ── Parsed Response ─────────────────────────────────────────────────────
  /** Parsed response after processing LLM output. */
  parsedResponse: Annotation<ParsedResponse | null>,
  /** ID of the saved agent message in the database. */
  savedMessageId: Annotation<string>,

  // ── Output Guardrails ───────────────────────────────────────────────────
  /** Result from the output guardrail checks. */
  outputGuardrailResult: Annotation<OutputGuardrailResult | null>,

  // ── Tool Calling ────────────────────────────────────────────────────────
  /** Pending tool calls from the LLM (to be executed by executeTools node). */
  toolCalls: Annotation<LLMToolCall[]>,
  /** Results of executed tool calls (appended to messages for next LLM call). */
  toolResults: Annotation<ToolResult[]>,
  /** Number of tool call → execute → LLM loops in this turn (max 10). */
  toolLoopCount: Annotation<number>,
  /** Number of consecutive tool execution failures (resets on success, max 3). */
  toolErrorCount: Annotation<number>,

  // ── Loop Detection ──────────────────────────────────────────────────────
  /** Recent tool calls tracked for loop detection (sliding window). */
  recentToolCalls: Annotation<TrackedToolCall[]>,
  /** Recent agent responses tracked for text repetition & question re-ask detection. */
  recentResponses: Annotation<string[]>,

  // ── Pipeline & Delegation ─────────────────────────────────────────────
  /** Whether this response triggers a delegation to another agent. */
  shouldDelegate: Annotation<boolean>,
  /** Current pipeline depth (max 15 to prevent infinite loops). */
  delegationDepth: Annotation<number>,
  /** Tool signals completed during this agent's turn (for pipeline routing). */
  completedToolSignals: Annotation<string[]>,
});

/** TypeScript type for the graph state. */
export type GraphStateType = typeof GraphState.State;
