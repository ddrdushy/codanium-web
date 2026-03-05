// =============================================================================
// AI Team Studio — OpenAI Provider Adapter
// =============================================================================
// Raw fetch-based adapter for the OpenAI Chat Completions API.
// No SDK dependency — uses standard `fetch` for all HTTP calls.
// Supports streaming (SSE), custom base URLs, and organization headers.
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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o';

// Chat-capable model prefixes (used to filter the models list)
const CHAT_MODEL_PREFIXES = [
  'gpt-4',
  'gpt-3.5',
  'o1',
  'o3',
  'chatgpt',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseUrl(config: ProviderConfig): string {
  const url = config.baseUrl?.replace(/\/+$/, '') || DEFAULT_BASE_URL;
  return url;
}

function headers(config: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    h['Authorization'] = `Bearer ${config.apiKey}`;
  }
  if (config.organizationId) {
    h['OpenAI-Organization'] = config.organizationId;
  }
  if (config.extraHeaders) {
    Object.assign(h, config.extraHeaders);
  }
  return h;
}

/** Map our universal messages to OpenAI's format. System messages go first. */
function formatMessages(messages: LLMMessage[]): LLMMessage[] {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const otherMsgs = messages.filter((m) => m.role !== 'system');
  return [...systemMsgs, ...otherMsgs];
}

/** Extract an error message from an OpenAI error response body. */
function extractError(body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (obj.error && typeof obj.error === 'object') {
      const err = obj.error as Record<string, unknown>;
      return (err.message as string) || 'Unknown OpenAI error';
    }
  }
  return 'Unknown OpenAI error';
}

// ---------------------------------------------------------------------------
// OpenAI Adapter
// ---------------------------------------------------------------------------

export class OpenAIAdapter implements LLMProvider {
  readonly name = 'OpenAI';

  // -------------------------------------------------------------------------
  // Validate Connection
  // -------------------------------------------------------------------------

  async validateConnection(config: ProviderConfig): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl(config)}/chat/completions`, {
        method: 'POST',
        headers: headers(config),
        body: JSON.stringify({
          model: config.defaultModel || DEFAULT_MODEL,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
        }),
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

    const body: Record<string, unknown> = {
      model,
      messages: formatMessages(options.messages),
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const res = await fetch(`${baseUrl(config)}/chat/completions`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`OpenAI API error (${res.status}): ${extractError(data)}`);
    }

    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? '';
    const finishReason =
      choice?.finish_reason === 'length' ? 'length' : 'stop';

    return {
      content,
      tokensUsed: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      model,
      provider: 'openai',
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

    const body: Record<string, unknown> = {
      model,
      messages: formatMessages(options.messages),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const res = await fetch(`${baseUrl(config)}/chat/completions`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMsg = `OpenAI streaming error (${res.status})`;
      try {
        const errorData = await res.json();
        errorMsg += `: ${extractError(errorData)}`;
      } catch {
        // Could not parse error body
      }
      throw new Error(errorMsg);
    }

    if (!res.body) {
      throw new Error('OpenAI streaming: no response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: { prompt: number; completion: number; total: number } | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);

          if (payload === '[DONE]') {
            yield {
              content: '',
              done: true,
              tokensUsed: usage,
            };
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content ?? '';
            const finishReason = parsed.choices?.[0]?.finish_reason;

            // Capture usage if present (sent with stream_options)
            if (parsed.usage) {
              usage = {
                prompt: parsed.usage.prompt_tokens ?? 0,
                completion: parsed.usage.completion_tokens ?? 0,
                total: parsed.usage.total_tokens ?? 0,
              };
            }

            if (content || finishReason) {
              yield {
                content,
                done: false,
              };
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // If we exited without [DONE], yield a final chunk
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

  async listModels(config: ProviderConfig): Promise<string[]> {
    const res = await fetch(`${baseUrl(config)}/models`, {
      method: 'GET',
      headers: headers(config),
    });

    if (!res.ok) {
      throw new Error(`OpenAI list models error (${res.status})`);
    }

    const data = await res.json();
    const models: string[] = (data.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) =>
        CHAT_MODEL_PREFIXES.some((prefix) => id.startsWith(prefix)),
      )
      .sort();

    return models;
  }
}
