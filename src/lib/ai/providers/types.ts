// =============================================================================
// AI Team Studio — BYOM Provider Type System
// =============================================================================
// Core interfaces for the Bring-Your-Own-Model provider architecture.
// Every LLM adapter (OpenAI, Anthropic, Gemini, local, mock, etc.)
// implements these contracts so the rest of the platform stays provider-agnostic.
// =============================================================================

/**
 * Universal message format exchanged between the platform and any LLM.
 * Supports text content as well as tool calls and tool results.
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Tool calls made by the assistant (role=assistant only). */
  toolCalls?: LLMToolCall[];
  /** Tool result reference (role=tool only). */
  toolCallId?: string;
}

/**
 * A tool call requested by the LLM during a response.
 */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Tool definition passed to the LLM provider.
 * Each provider adapter converts this to its native format.
 */
export interface LLMToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Standardized response returned by every non-streaming LLM call.
 */
export interface LLMResponse {
  content: string;
  thinking?: string;
  toolCalls?: LLMToolCall[];
  tokensUsed: { prompt: number; completion: number; total: number };
  model: string;
  provider: string;
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
}

/**
 * Individual chunk emitted during a streaming LLM call.
 * The final chunk carries `done: true` and includes accumulated token counts.
 * Tool calls are accumulated across chunks and emitted on the final chunk.
 */
export interface LLMStreamChunk {
  content: string;
  thinking?: string;
  done: boolean;
  tokensUsed?: LLMResponse['tokensUsed'];
  /** Completed tool calls (only on final chunk or when a tool_use block completes). */
  toolCalls?: LLMToolCall[];
  /** Finish reason — 'tool_calls' means LLM wants to call tools before continuing. */
  finishReason?: 'stop' | 'length' | 'tool_calls';
}

/**
 * Configuration bag for a single LLM request.
 */
export interface LLMRequestOptions {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  agentId?: string;
  projectId?: string;
  metadata?: Record<string, string>;
  /** Tools available to the LLM for this request. */
  tools?: LLMToolDefinition[];
  /** Tool choice strategy: 'auto' lets the model decide, 'required' forces a tool call, 'none' disables tools. */
  toolChoice?: 'auto' | 'required' | 'none';
}

/**
 * User-supplied provider configuration (stored encrypted per-workspace).
 */
export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  defaultModel: string;
  extraHeaders?: Record<string, string>;
}

/**
 * Contract that every provider adapter must implement.
 */
export interface LLMProvider {
  /** Human-readable provider name (e.g. "OpenAI", "Mock"). */
  readonly name: string;

  /** Verify the API key / endpoint is reachable. */
  validateConnection(config: ProviderConfig): Promise<boolean>;

  /** Single-shot completion — returns the full response. */
  complete(
    options: LLMRequestOptions,
    config: ProviderConfig,
  ): Promise<LLMResponse>;

  /** Streaming completion — yields word-level chunks. */
  stream(
    options: LLMRequestOptions,
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk>;

  /** List models available under the current config. */
  listModels(config: ProviderConfig): Promise<string[]>;
}
