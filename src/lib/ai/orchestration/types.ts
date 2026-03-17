// =============================================================================
// AI Team Studio — Orchestration Type System
// =============================================================================
// Shared types for the orchestration engine, message router, event bus,
// delegation handler, and SSE streaming layer.
// =============================================================================

// ---------------------------------------------------------------------------
// Orchestration Request / Response
// ---------------------------------------------------------------------------

/**
 * Inbound request to the orchestration engine.
 */
export interface OrchestrationRequest {
  /** Project scope — all context and side effects are scoped to this project. */
  projectId: string;
  /** The user's message text. */
  userMessage: string;
  /** Explicit target agent. If null, the MessageRouter auto-selects one. */
  targetAgentShortName?: string;
  /** Authenticated user ID (owner of the message). */
  userId: string;
  /** Optional card ID to scope context to a specific card/module. */
  cardId?: string;
  /** If true, the caller already persisted the user message — skip saving again. */
  skipMessageSave?: boolean;
}

/**
 * Complete response from a non-streaming orchestration call.
 */
export interface OrchestrationResponse {
  /** All agent messages produced during this orchestration cycle (including delegations). */
  messages: Array<{
    agentShortName: string;
    agentName: string;
    content: string;
    thinking?: string;
    artifacts?: Array<{ name: string; type: string }>;
  }>;
  /** Agent status transitions that occurred during processing. */
  agentStatusUpdates: Array<{
    agentId: string;
    status: string;
    task: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// SSE Streaming
// ---------------------------------------------------------------------------

/**
 * Server-Sent Event emitted during a streaming orchestration call.
 */
export interface SSEEvent {
  type:
    | 'agent_start'   // Agent selected, about to begin processing
    | 'chunk'         // Content token(s) from the LLM
    | 'thinking'      // Thinking / reasoning token(s)
    | 'artifact'      // Artifact extracted from response
    | 'usage'         // Token usage summary (on final chunk)
    | 'done'          // Agent finished processing
    | 'error'         // Recoverable error
    | 'delegation'    // Agent delegating to another agent
    | 'info'          // Informational message (authority blocks, etc.)
    | 'execution'     // Code execution queued/started/completed
    | 'pipeline_progress' // Auto-chain pipeline step progress
    | 'tool_call'     // LLM requesting a tool call (name + arguments)
    | 'tool_result';  // Result of an executed tool call
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// User Intent Classification
// ---------------------------------------------------------------------------

/**
 * Classified intent of the user's message, used by the MessageRouter
 * to select the appropriate first-responder agent.
 */
export type UserIntent =
  | 'new_requirement'
  | 'approval'
  | 'status_query'
  | 'bug_report'
  | 'ui_feedback'
  | 'cost_query'
  | 'deployment'
  | 'testing'
  | 'architecture'
  | 'code_generation'
  | 'general';

// ---------------------------------------------------------------------------
// System Events
// ---------------------------------------------------------------------------

/**
 * Internal event emitted on the EventBus for cross-cutting concerns
 * (audit logging, notifications, real-time UI updates, etc.).
 */
export interface SystemEvent {
  /** Event type key (e.g. "agent.started", "action.executed", "delegation.chain"). */
  type: string;
  /** Who or what triggered this event (agent shortName, "system", "user"). */
  actor: string;
  /** Arbitrary payload — contents vary by event type. */
  payload: Record<string, unknown>;
  /** Project scope. */
  projectId: string;
  /** Auto-set by the EventBus if not provided. */
  timestamp?: Date;
}
