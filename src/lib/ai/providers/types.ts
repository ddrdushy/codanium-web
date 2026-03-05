// =============================================================================
// AI Team Studio — BYOM Provider Type System
// =============================================================================
// Core interfaces for the Bring-Your-Own-Model provider architecture.
// Every LLM adapter (OpenAI, Anthropic, Gemini, local, mock, etc.)
// implements these contracts so the rest of the platform stays provider-agnostic.
// =============================================================================

/**
 * Universal message format exchanged between the platform and any LLM.
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Standardized response returned by every non-streaming LLM call.
 */
export interface LLMResponse {
  content: string;
  thinking?: string;
  tokensUsed: { prompt: number; completion: number; total: number };
  model: string;
  provider: string;
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'error';
}

/**
 * Individual chunk emitted during a streaming LLM call.
 * The final chunk carries `done: true` and includes accumulated token counts.
 */
export interface LLMStreamChunk {
  content: string;
  thinking?: string;
  done: boolean;
  tokensUsed?: LLMResponse['tokensUsed'];
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
