// =============================================================================
// AI Team Studio — Ollama Provider Adapter
// =============================================================================
// Raw fetch-based adapter for the Ollama local inference API.
// No SDK dependency — uses standard `fetch` for all HTTP calls.
// Ollama uses newline-delimited JSON (NDJSON) for streaming, not SSE.
// =============================================================================

import type {
  LLMProvider,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  ProviderConfig,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseUrl(config: ProviderConfig): string {
  return config.baseUrl?.replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

function headers(config: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.extraHeaders) {
    Object.assign(h, config.extraHeaders);
  }
  return h;
}

/** Rough token estimate (~4 chars per token). Used when Ollama doesn't report counts. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

// ---------------------------------------------------------------------------
// Ollama Adapter
// ---------------------------------------------------------------------------

export class OllamaAdapter implements LLMProvider {
  readonly name = 'Ollama';

  // -------------------------------------------------------------------------
  // Validate Connection
  // -------------------------------------------------------------------------

  async validateConnection(config: ProviderConfig): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl(config)}/api/tags`, {
        method: 'GET',
        headers: headers(config),
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
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
    };

    // Merge Ollama-specific options (num_predict = max output tokens)
    const ollamaOptions: Record<string, unknown> = {
      num_predict: options.maxTokens ?? 8192,
    };
    if (options.temperature !== undefined) {
      ollamaOptions.temperature = options.temperature;
    }
    body.options = ollamaOptions;

    const res = await fetch(`${baseUrl(config)}/api/chat`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMsg = `Ollama API error (${res.status})`;
      try {
        const errorData = await res.json();
        if (errorData.error) errorMsg += `: ${errorData.error}`;
      } catch {
        // Could not parse error body
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    const content = data.message?.content ?? '';

    // Ollama may provide token counts in eval_count / prompt_eval_count
    const promptTokens = data.prompt_eval_count ?? estimateTokens(
      options.messages.map((m) => m.content).join(' '),
    );
    const completionTokens = data.eval_count ?? estimateTokens(content);

    return {
      content,
      tokensUsed: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
      model,
      provider: 'ollama',
      latencyMs: Date.now() - startTime,
      finishReason: data.done_reason === 'length' ? 'length' : 'stop',
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
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };

    // Merge Ollama-specific options (num_predict = max output tokens)
    const ollamaOpts: Record<string, unknown> = {
      num_predict: options.maxTokens ?? 8192,
    };
    if (options.temperature !== undefined) {
      ollamaOpts.temperature = options.temperature;
    }
    body.options = ollamaOpts;

    const res = await fetch(`${baseUrl(config)}/api/chat`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMsg = `Ollama streaming error (${res.status})`;
      try {
        const errorData = await res.json();
        if (errorData.error) errorMsg += `: ${errorData.error}`;
      } catch {
        // Could not parse error body
      }
      throw new Error(errorMsg);
    }

    if (!res.body) {
      throw new Error('Ollama streaming: no response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Ollama sends newline-delimited JSON
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }

          const message = parsed.message as
            | Record<string, unknown>
            | undefined;
          const content = (message?.content as string) ?? '';
          const isDone = parsed.done === true;

          if (content) {
            totalContent += content;
          }

          if (isDone) {
            // Ollama provides token counts on the final message
            promptTokens =
              (parsed.prompt_eval_count as number) ??
              estimateTokens(
                options.messages.map((m) => m.content).join(' '),
              );
            completionTokens =
              (parsed.eval_count as number) ??
              estimateTokens(totalContent);

            yield {
              content: content,
              done: true,
              tokensUsed: {
                prompt: promptTokens,
                completion: completionTokens,
                total: promptTokens + completionTokens,
              },
            };
            return;
          }

          if (content) {
            yield {
              content,
              done: false,
            };
          }
        }
      }

      // If stream ended without a done message, yield final chunk
      promptTokens = estimateTokens(
        options.messages.map((m) => m.content).join(' '),
      );
      completionTokens = estimateTokens(totalContent);

      yield {
        content: '',
        done: true,
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
      };
    } finally {
      reader.releaseLock();
    }
  }

  // -------------------------------------------------------------------------
  // List Models
  // -------------------------------------------------------------------------

  async listModels(config: ProviderConfig): Promise<string[]> {
    const res = await fetch(`${baseUrl(config)}/api/tags`, {
      method: 'GET',
      headers: headers(config),
    });

    if (!res.ok) {
      throw new Error(`Ollama list models error (${res.status})`);
    }

    const data = await res.json();
    const models: string[] = (data.models ?? [])
      .map((m: { name: string }) => m.name)
      .sort();

    return models;
  }
}
