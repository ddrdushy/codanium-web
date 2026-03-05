// =============================================================================
// AI Team Studio — Anthropic Provider Adapter
// =============================================================================
// Raw fetch-based adapter for the Anthropic Messages API.
// No SDK dependency — uses standard `fetch` for all HTTP calls.
// Supports streaming (SSE), thinking blocks, and custom base URLs.
// =============================================================================

import type {
  LLMProvider,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  LLMMessage,
  ProviderConfig,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_VERSION = '2023-06-01';

// Anthropic does not expose a public models endpoint, so we hardcode the
// currently available models.
const AVAILABLE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-20250414',
  'claude-opus-4-20250514',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseUrl(config: ProviderConfig): string {
  return config.baseUrl?.replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

function headers(config: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': ANTHROPIC_VERSION,
  };
  if (config.apiKey) {
    h['x-api-key'] = config.apiKey;
  }
  if (config.extraHeaders) {
    Object.assign(h, config.extraHeaders);
  }
  return h;
}

/**
 * Anthropic separates the system prompt from conversational messages.
 * Extract system messages into a single `system` string and return the
 * remaining user/assistant messages.
 */
function splitMessages(messages: LLMMessage[]): {
  system: string | undefined;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const systemParts: string[] = [];
  const conversational: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
    } else {
      conversational.push({ role: msg.role, content: msg.content });
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: conversational,
  };
}

/** Extract error message from Anthropic error response. */
function extractError(body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (obj.error && typeof obj.error === 'object') {
      const err = obj.error as Record<string, unknown>;
      return (err.message as string) || 'Unknown Anthropic error';
    }
    if (typeof obj.message === 'string') {
      return obj.message;
    }
  }
  return 'Unknown Anthropic error';
}

// ---------------------------------------------------------------------------
// Anthropic Adapter
// ---------------------------------------------------------------------------

export class AnthropicAdapter implements LLMProvider {
  readonly name = 'Anthropic';

  // -------------------------------------------------------------------------
  // Validate Connection
  // -------------------------------------------------------------------------

  async validateConnection(config: ProviderConfig): Promise<boolean> {
    try {
      const { system, messages } = splitMessages([
        { role: 'user', content: 'test' },
      ]);

      const body: Record<string, unknown> = {
        model: config.defaultModel || DEFAULT_MODEL,
        max_tokens: 5,
        messages,
      };
      if (system) body.system = system;

      const res = await fetch(`${baseUrl(config)}/v1/messages`, {
        method: 'POST',
        headers: headers(config),
        body: JSON.stringify(body),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Non-Streaming Completion
  // -------------------------------------------------------------------------

  async complete(
    options: LLMRequestOptions,
    config: ProviderConfig,
  ): Promise<LLMResponse> {
    const model = options.model || config.defaultModel || DEFAULT_MODEL;
    const startTime = Date.now();

    const { system, messages } = splitMessages(options.messages);

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 4096,
      messages,
    };
    if (system) body.system = system;
    if (options.temperature !== undefined) body.temperature = options.temperature;

    const res = await fetch(`${baseUrl(config)}/v1/messages`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Anthropic API error (${res.status}): ${extractError(data)}`);
    }

    // Extract text and thinking blocks from the content array
    let content = '';
    let thinking: string | undefined;

    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'thinking') {
          thinking = (thinking ?? '') + block.thinking;
        }
      }
    }

    const finishReason =
      data.stop_reason === 'max_tokens' ? 'length' : 'stop';

    return {
      content,
      thinking,
      tokensUsed: {
        prompt: data.usage?.input_tokens ?? 0,
        completion: data.usage?.output_tokens ?? 0,
        total:
          (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      model,
      provider: 'anthropic',
      latencyMs: Date.now() - startTime,
      finishReason,
    };
  }

  // -------------------------------------------------------------------------
  // Streaming Completion
  // -------------------------------------------------------------------------

  async *stream(
    options: LLMRequestOptions,
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk> {
    const model = options.model || config.defaultModel || DEFAULT_MODEL;

    const { system, messages } = splitMessages(options.messages);

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 4096,
      messages,
      stream: true,
    };
    if (system) body.system = system;
    if (options.temperature !== undefined) body.temperature = options.temperature;

    const res = await fetch(`${baseUrl(config)}/v1/messages`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMsg = `Anthropic streaming error (${res.status})`;
      try {
        const errorData = await res.json();
        errorMsg += `: ${extractError(errorData)}`;
      } catch {
        // Could not parse error body
      }
      throw new Error(errorMsg);
    }

    if (!res.body) {
      throw new Error('Anthropic streaming: no response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentBlockType: 'text' | 'thinking' | null = null;
    let usage: { prompt: number; completion: number; total: number } | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';

        for (const line of lines) {
          const trimmed = line.trim();

          // SSE event type line
          if (trimmed.startsWith('event: ')) {
            eventType = trimmed.slice(7);
            continue;
          }

          // SSE data line
          if (trimmed.startsWith('data: ')) {
            const payload = trimmed.slice(6);
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(payload);
            } catch {
              continue;
            }

            switch (eventType) {
              case 'message_start': {
                // Extract initial usage from the message object
                const msg = parsed.message as Record<string, unknown> | undefined;
                if (msg?.usage) {
                  const u = msg.usage as Record<string, number>;
                  usage = {
                    prompt: u.input_tokens ?? 0,
                    completion: u.output_tokens ?? 0,
                    total: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
                  };
                }
                break;
              }

              case 'content_block_start': {
                const blockType = (
                  parsed.content_block as Record<string, unknown> | undefined
                )?.type as string | undefined;
                currentBlockType =
                  blockType === 'thinking' ? 'thinking' : 'text';
                break;
              }

              case 'content_block_delta': {
                const delta = parsed.delta as Record<string, unknown> | undefined;
                if (!delta) break;

                const deltaType = delta.type as string;
                const text =
                  deltaType === 'thinking_delta'
                    ? (delta.thinking as string) ?? ''
                    : (delta.text as string) ?? '';

                if (text) {
                  if (currentBlockType === 'thinking') {
                    yield { content: '', thinking: text, done: false };
                  } else {
                    yield { content: text, done: false };
                  }
                }
                break;
              }

              case 'content_block_stop': {
                currentBlockType = null;
                break;
              }

              case 'message_delta': {
                // Final usage and stop reason
                const deltaUsage = (parsed as Record<string, unknown>)
                  .usage as Record<string, number> | undefined;
                if (deltaUsage) {
                  const outputTokens = deltaUsage.output_tokens ?? 0;
                  usage = {
                    prompt: usage?.prompt ?? 0,
                    completion: outputTokens,
                    total: (usage?.prompt ?? 0) + outputTokens,
                  };
                }
                break;
              }

              case 'message_stop': {
                yield {
                  content: '',
                  done: true,
                  tokensUsed: usage,
                };
                return;
              }

              case 'error': {
                const errMsg = (
                  parsed.error as Record<string, unknown> | undefined
                )?.message as string | undefined;
                throw new Error(
                  `Anthropic stream error: ${errMsg ?? 'unknown'}`,
                );
              }
            }

            eventType = '';
          }
        }
      }

      // If we exited without message_stop, yield a final chunk
      yield {
        content: '',
        done: true,
        tokensUsed: usage,
      };
    } finally {
      reader.releaseLock();
    }
  }

  // -------------------------------------------------------------------------
  // List Models
  // -------------------------------------------------------------------------

  async listModels(_config: ProviderConfig): Promise<string[]> {
    // Anthropic does not expose a public models listing endpoint.
    // Return the known set of available models.
    return [...AVAILABLE_MODELS];
  }
}
