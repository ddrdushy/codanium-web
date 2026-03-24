// =============================================================================
// AI Team Studio — Ollama Provider Adapter
// =============================================================================
// Raw fetch-based adapter for the Ollama local inference API.
// No SDK dependency — uses standard `fetch` for all HTTP calls.
// Ollama uses newline-delimited JSON (NDJSON) for streaming, not SSE.
//
// Timeout & Retry:
//   - Configurable timeouts for first-byte and total response
//   - Automatic retry with exponential backoff for transient errors
//   - Pre-warm ping before streaming to handle cold model loads
//   - Graceful handling of Cloudflare 524 timeout errors
// =============================================================================

import type {
  LLMProvider,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  LLMToolCall,
  ProviderConfig,
} from './types';

// ---------------------------------------------------------------------------
// Constants & Timeouts
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3';

/**
 * Timeout for the initial fetch connection (before first byte arrives).
 * Must be generous because Ollama on CPU may take a while to load the model.
 * Cloudflare free tunnels timeout at 100s, so this won't help there, but it
 * protects against hanging requests when Ollama is truly down.
 */
const FETCH_TIMEOUT_MS = 300_000; // 5 minutes — CPU inference can be very slow

/**
 * Timeout for non-generation requests (list models, validate connection).
 */
const METADATA_TIMEOUT_MS = 15_000; // 15 seconds

/**
 * Number of retry attempts for transient errors (524, 502, 503, network).
 */
const MAX_RETRIES = 2;

/**
 * Base delay between retries (exponential backoff: delay * 2^attempt).
 */
const RETRY_BASE_DELAY_MS = 3_000; // 3 seconds

/**
 * Transient HTTP status codes that trigger a retry.
 */
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504, 524]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseUrl(config: ProviderConfig): string {
  let url = config.baseUrl?.replace(/\/+$/, '') || DEFAULT_BASE_URL;
  // When running inside Docker, localhost won't reach the host machine.
  // Detect Docker: /.dockerenv file exists, or DOCKER_ENV is set.
  const isDocker = process.env.DOCKER_ENV === 'true' ||
    (() => { try { return require('fs').existsSync('/.dockerenv'); } catch { return false; } })();
  if (isDocker) {
    url = url.replace('://localhost:', '://host.docker.internal:')
             .replace('://127.0.0.1:', '://host.docker.internal:');
  }
  return url;
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

/** Create a fetch with AbortController timeout. */
function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): { promise: Promise<Response>; abort: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const promise = fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  return { promise, abort: () => controller.abort() };
}

/** Check if an error is a Cloudflare tunnel timeout (HTML 524 page). */
function isCloudflareTimeout(status: number, body?: string): boolean {
  return status === 524 || (body?.includes('524: A timeout occurred') ?? false);
}

/** Check if an error is retryable. */
function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network errors, abort errors, and tunnel timeouts
    if (msg.includes('fetch failed') || msg.includes('econnrefused') ||
        msg.includes('econnreset') || msg.includes('socket hang up') ||
        msg.includes('network') || msg.includes('524') ||
        msg.includes('abort')) {
      return true;
    }
  }
  return false;
}

/** Sleep for a given duration. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Ollama Adapter
// ---------------------------------------------------------------------------

export class OllamaAdapter implements LLMProvider {
  readonly name = 'Ollama';

  // -------------------------------------------------------------------------
  // Pre-warm: send a tiny request to ensure model is loaded
  // -------------------------------------------------------------------------

  private async preWarm(config: ProviderConfig, model: string): Promise<void> {
    try {
      console.log(`[Ollama] Pre-warming model "${model}"...`);
      const { promise } = fetchWithTimeout(
        `${baseUrl(config)}/api/generate`,
        {
          method: 'POST',
          headers: headers(config),
          body: JSON.stringify({
            model,
            prompt: '',
            stream: false,
            options: { num_predict: 1 },
            keep_alive: '10m',
          }),
        },
        METADATA_TIMEOUT_MS,
      );
      await promise;
      console.log(`[Ollama] Model "${model}" pre-warmed ✅`);
    } catch {
      // Pre-warm is best-effort — don't fail the actual request
      console.warn(`[Ollama] Pre-warm failed (non-fatal)`);
    }
  }

  // -------------------------------------------------------------------------
  // Validate Connection
  // -------------------------------------------------------------------------

  async validateConnection(config: ProviderConfig): Promise<boolean> {
    try {
      const { promise } = fetchWithTimeout(
        `${baseUrl(config)}/api/tags`,
        {
          method: 'GET',
          headers: headers(config),
        },
        METADATA_TIMEOUT_MS,
      );
      const res = await promise;
      return res.ok;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Non-Streaming Completion (with retry)
  // -------------------------------------------------------------------------

  async complete(
    options: LLMRequestOptions,
    config: ProviderConfig,
  ): Promise<LLMResponse> {
    const model = options.model || config.defaultModel || DEFAULT_MODEL;
    const startTime = Date.now();

    // Format messages for Ollama (handles tool results)
    const formattedMessages = options.messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', content: m.content };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || '',
          tool_calls: m.toolCalls.map((tc) => ({
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const body: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      stream: false,
      keep_alive: '10m',
    };

    // Add tools if provided (Ollama supports tools for llama3.1+, qwen2.5+, etc.)
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    // Merge Ollama-specific options (num_predict = max output tokens)
    const ollamaOptions: Record<string, unknown> = {
      num_predict: options.maxTokens ?? 8192,
    };
    if (options.temperature !== undefined) {
      ollamaOptions.temperature = options.temperature;
    }
    body.options = ollamaOptions;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[Ollama] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
          await sleep(delay);
        }

        const { promise } = fetchWithTimeout(
          `${baseUrl(config)}/api/chat`,
          {
            method: 'POST',
            headers: headers(config),
            body: JSON.stringify(body),
          },
          FETCH_TIMEOUT_MS,
        );

        const res = await promise;

        if (!res.ok) {
          // Check for Cloudflare tunnel timeout
          if (RETRYABLE_STATUS_CODES.has(res.status)) {
            const errorBody = await res.text().catch(() => '');
            const isCF = isCloudflareTimeout(res.status, errorBody);
            lastError = new Error(
              isCF
                ? `Ollama: Cloudflare tunnel timeout (524). The model is taking too long to respond — it may be running on CPU. Try a smaller model or ensure GPU is available.`
                : `Ollama API error (${res.status})`,
            );
            console.warn(`[Ollama] ${lastError.message} — attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
            continue; // retry
          }

          let errorMsg = `Ollama API error (${res.status})`;
          try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const errorData = await res.json();
              if (errorData.error) errorMsg += `: ${errorData.error}`;
            }
          } catch {
            // Could not parse error body
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        const content = data.message?.content ?? '';

        // Parse tool calls from Ollama response
        const toolCalls: LLMToolCall[] = [];
        if (data.message?.tool_calls && Array.isArray(data.message.tool_calls)) {
          for (const tc of data.message.tool_calls) {
            toolCalls.push({
              id: `ollama-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: tc.function?.name ?? '',
              arguments: tc.function?.arguments ?? {},
            });
          }
        }

        // Ollama may provide token counts in eval_count / prompt_eval_count
        const promptTokens = data.prompt_eval_count ?? estimateTokens(
          options.messages.map((m) => m.content).join(' '),
        );
        const completionTokens = data.eval_count ?? estimateTokens(content);

        const hasToolCalls = toolCalls.length > 0;

        return {
          content,
          toolCalls: hasToolCalls ? toolCalls : undefined,
          tokensUsed: {
            prompt: promptTokens,
            completion: completionTokens,
            total: promptTokens + completionTokens,
          },
          model,
          provider: 'ollama',
          latencyMs: Date.now() - startTime,
          finishReason: hasToolCalls
            ? 'tool_calls'
            : data.done_reason === 'length'
              ? 'length'
              : 'stop',
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isRetryable(err) && attempt < MAX_RETRIES) {
          console.warn(`[Ollama] Transient error: ${lastError.message} — retrying...`);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error('Ollama: unknown error after retries');
  }

  // -------------------------------------------------------------------------
  // Streaming Completion (with retry)
  // -------------------------------------------------------------------------

  async *stream(
    options: LLMRequestOptions,
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk> {
    const model = options.model || config.defaultModel || DEFAULT_MODEL;

    // Format messages for Ollama (handles tool results)
    const streamMessages = options.messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', content: m.content };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || '',
          tool_calls: m.toolCalls.map((tc) => ({
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const body: Record<string, unknown> = {
      model,
      messages: streamMessages,
      stream: true,
      keep_alive: '10m',
    };

    // Add tools if provided
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    // Merge Ollama-specific options (num_predict = max output tokens)
    const ollamaOpts: Record<string, unknown> = {
      num_predict: options.maxTokens ?? 8192,
    };
    if (options.temperature !== undefined) {
      ollamaOpts.temperature = options.temperature;
    }
    body.options = ollamaOpts;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[Ollama] Stream retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
          await sleep(delay);
          // Pre-warm on retry to ensure model is loaded
          await this.preWarm(config, model);
        }

        const { promise } = fetchWithTimeout(
          `${baseUrl(config)}/api/chat`,
          {
            method: 'POST',
            headers: headers(config),
            body: JSON.stringify(body),
          },
          FETCH_TIMEOUT_MS,
        );

        const res = await promise;

        if (!res.ok) {
          // Check for Cloudflare tunnel timeout or other retryable errors
          if (RETRYABLE_STATUS_CODES.has(res.status)) {
            const errorBody = await res.text().catch(() => '');
            const isCF = isCloudflareTimeout(res.status, errorBody);
            lastError = new Error(
              isCF
                ? `Ollama: Cloudflare tunnel timeout (524). The model is taking too long to respond — it may be running on CPU. Try a smaller model or ensure GPU is available.`
                : `Ollama streaming error (${res.status})`,
            );
            console.warn(`[Ollama] ${lastError.message} — attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
            continue; // retry
          }

          let errorMsg = `Ollama streaming error (${res.status})`;
          try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const errorData = await res.json();
              if (errorData.error) errorMsg += `: ${errorData.error}`;
            }
          } catch {
            // Could not parse error body
          }
          throw new Error(errorMsg);
        }

        if (!res.body) {
          throw new Error('Ollama streaming: no response body');
        }

        // Successfully got a response — yield chunks from this stream
        yield* this.readStream(res.body, options);
        return; // success — don't retry
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isRetryable(err) && attempt < MAX_RETRIES) {
          console.warn(`[Ollama] Stream transient error: ${lastError.message} — retrying...`);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error('Ollama: unknown streaming error after retries');
  }

  // -------------------------------------------------------------------------
  // Stream Reader (extracted for retry logic)
  // -------------------------------------------------------------------------

  private async *readStream(
    body: ReadableStream<Uint8Array>,
    options: LLMRequestOptions,
  ): AsyncIterable<LLMStreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalContent = '';
    let promptTokens = 0;
    let completionTokens = 0;
    const accumulatedToolCalls: LLMToolCall[] = [];

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

          // Accumulate tool calls from streaming chunks
          if (message?.tool_calls && Array.isArray(message.tool_calls)) {
            for (const tc of message.tool_calls as Array<Record<string, any>>) {
              accumulatedToolCalls.push({
                id: `ollama-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: tc.function?.name ?? '',
                arguments: tc.function?.arguments ?? {},
              });
            }
          }

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

            const hasToolCalls = accumulatedToolCalls.length > 0;

            yield {
              content: content,
              done: true,
              tokensUsed: {
                prompt: promptTokens,
                completion: completionTokens,
                total: promptTokens + completionTokens,
              },
              toolCalls: hasToolCalls ? accumulatedToolCalls : undefined,
              finishReason: hasToolCalls ? 'tool_calls' : 'stop',
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

      // Process any remaining data in the buffer (the final done:true chunk
      // may not have a trailing newline, so it stays in the buffer)
      const remaining = buffer.trim();
      if (remaining) {
        try {
          const parsed = JSON.parse(remaining) as Record<string, unknown>;
          const message = parsed.message as Record<string, unknown> | undefined;
          const content = (message?.content as string) ?? '';

          if (message?.tool_calls && Array.isArray(message.tool_calls)) {
            for (const tc of message.tool_calls as Array<Record<string, any>>) {
              accumulatedToolCalls.push({
                id: `ollama-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: tc.function?.name ?? '',
                arguments: tc.function?.arguments ?? {},
              });
            }
          }

          if (content) {
            totalContent += content;
          }

          if (parsed.done === true) {
            // Extract real token counts from Ollama's final message
            promptTokens =
              (parsed.prompt_eval_count as number) ??
              estimateTokens(
                options.messages.map((m) => m.content).join(' '),
              );
            completionTokens =
              (parsed.eval_count as number) ??
              estimateTokens(totalContent);

            const hasToolCalls = accumulatedToolCalls.length > 0;

            yield {
              content: content,
              done: true,
              tokensUsed: {
                prompt: promptTokens,
                completion: completionTokens,
                total: promptTokens + completionTokens,
              },
              toolCalls: hasToolCalls ? accumulatedToolCalls : undefined,
              finishReason: hasToolCalls ? 'tool_calls' : 'stop',
            };
            return;
          }
        } catch {
          // Could not parse remaining buffer — fall through to estimate
        }
      }

      // If stream ended without a done message, yield final chunk with estimates
      promptTokens = estimateTokens(
        options.messages.map((m) => m.content).join(' '),
      );
      completionTokens = estimateTokens(totalContent);

      const hasToolCalls = accumulatedToolCalls.length > 0;

      yield {
        content: '',
        done: true,
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        toolCalls: hasToolCalls ? accumulatedToolCalls : undefined,
        finishReason: hasToolCalls ? 'tool_calls' : 'stop',
      };
    } finally {
      reader.releaseLock();
    }
  }

  // -------------------------------------------------------------------------
  // List Models
  // -------------------------------------------------------------------------

  async listModels(config: ProviderConfig): Promise<string[]> {
    const { promise } = fetchWithTimeout(
      `${baseUrl(config)}/api/tags`,
      {
        method: 'GET',
        headers: headers(config),
      },
      METADATA_TIMEOUT_MS,
    );
    const res = await promise;

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
