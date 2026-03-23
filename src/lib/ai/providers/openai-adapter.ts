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
  LLMToolCall,
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

/**
 * Map our universal messages to OpenAI's format.
 * System messages go first. Tool messages include tool_call_id.
 * Assistant messages with tool calls include the tool_calls array.
 */
function formatMessages(messages: LLMMessage[]): Array<Record<string, unknown>> {
  // Collect system messages that appear BEFORE any non-system message (true system prompts)
  const leadingSystemMsgs: LLMMessage[] = [];
  let foundNonSystem = false;
  const rest: LLMMessage[] = [];

  for (const msg of messages) {
    if (!foundNonSystem && msg.role === 'system') {
      leadingSystemMsgs.push(msg);
    } else {
      foundNonSystem = true;
      if (msg.role === 'system') {
        // Mid-conversation system message (e.g., loop warning) — convert to user message
        // so it doesn't break APIs that require system messages only at the start
        rest.push({ ...msg, role: 'user', content: `[System Note] ${msg.content}` });
      } else {
        rest.push(msg);
      }
    }
  }

  const ordered = [...leadingSystemMsgs, ...rest];

  return ordered.map((msg) => {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: msg.content,
        tool_call_id: msg.toolCallId,
      };
    }
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }
    return { role: msg.role, content: msg.content };
  });
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
      if (options.toolChoice) {
        body.tool_choice = options.toolChoice === 'required'
          ? 'required'
          : options.toolChoice === 'none'
            ? 'none'
            : 'auto';
      }
    }

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

    // Parse tool calls from response
    const toolCalls: LLMToolCall[] = [];
    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        let parsedArgs: Record<string, any> = {};
        try {
          parsedArgs = JSON.parse(tc.function?.arguments ?? '{}');
        } catch {
          // ignore parse errors
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function?.name ?? '',
          arguments: parsedArgs,
        });
      }
    }

    const finishReason =
      choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'function_call'
        ? 'tool_calls'
        : choice?.finish_reason === 'length'
          ? 'length'
          : 'stop';

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
      if (options.toolChoice) {
        body.tool_choice = options.toolChoice === 'required'
          ? 'required'
          : options.toolChoice === 'none'
            ? 'none'
            : 'auto';
      }
    }

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
    let lastFinishReason: string | null = null;

    // Accumulate tool calls across streaming chunks
    // OpenAI streams tool calls with index-based accumulation
    const toolCallAccumulators: Map<number, { id: string; name: string; argsJson: string }> = new Map();

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
            // Finalize any accumulated tool calls
            const toolCalls: LLMToolCall[] = [];
            for (const [, acc] of toolCallAccumulators) {
              let parsedArgs: Record<string, any> = {};
              try {
                parsedArgs = JSON.parse(acc.argsJson || '{}');
              } catch {
                // ignore parse errors
              }
              toolCalls.push({
                id: acc.id,
                name: acc.name,
                arguments: parsedArgs,
              });
            }

            const finishReason = lastFinishReason === 'tool_calls' || lastFinishReason === 'function_call'
              ? 'tool_calls' as const
              : lastFinishReason === 'length'
                ? 'length' as const
                : 'stop' as const;

            yield {
              content: '',
              done: true,
              tokensUsed: usage,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              finishReason,
            };
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content ?? '';
            const finishReason = parsed.choices?.[0]?.finish_reason;

            if (finishReason) {
              lastFinishReason = finishReason;
            }

            // Capture usage if present (sent with stream_options)
            if (parsed.usage) {
              usage = {
                prompt: parsed.usage.prompt_tokens ?? 0,
                completion: parsed.usage.completion_tokens ?? 0,
                total: parsed.usage.total_tokens ?? 0,
              };
            }

            // Accumulate tool calls from delta
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls as Array<Record<string, any>>) {
                const idx = tc.index ?? 0;
                if (!toolCallAccumulators.has(idx)) {
                  toolCallAccumulators.set(idx, {
                    id: tc.id ?? '',
                    name: tc.function?.name ?? '',
                    argsJson: '',
                  });
                }
                const acc = toolCallAccumulators.get(idx)!;
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name = tc.function.name;
                if (tc.function?.arguments) acc.argsJson += tc.function.arguments;
              }
            }

            if (content) {
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

      // If we exited without [DONE], finalize
      const toolCalls: LLMToolCall[] = [];
      for (const [, acc] of toolCallAccumulators) {
        let parsedArgs: Record<string, any> = {};
        try {
          parsedArgs = JSON.parse(acc.argsJson || '{}');
        } catch { /* ignore */ }
        toolCalls.push({ id: acc.id, name: acc.name, arguments: parsedArgs });
      }

      yield {
        content: '',
        done: true,
        tokensUsed: usage,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
