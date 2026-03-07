'use client';

import { useState, useCallback, useRef } from 'react';

// ─── SSE Event Types ────────────────────────────────────────────────────────

export interface AgentStartData {
  agentShortName: string;
  agentName: string;
}

export interface ChunkData {
  content: string;
}

export interface ThinkingData {
  content: string;
}

export interface ArtifactData {
  name: string;
  type: string;
}

export interface UsageData {
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface DelegationData {
  fromAgent: string;
  toAgent: string;
}

export interface DoneData {
  messageId: string;
  agentShortName: string;
}

export interface ErrorData {
  message: string;
}

// ─── Stream Callbacks ───────────────────────────────────────────────────────

export interface StreamCallbacks {
  onAgentStart?: (data: AgentStartData) => void;
  onChunk?: (data: ChunkData) => void;
  onThinking?: (data: ThinkingData) => void;
  onArtifact?: (data: ArtifactData) => void;
  onUsage?: (data: UsageData) => void;
  onDelegation?: (data: DelegationData) => void;
  onDone?: (data: DoneData) => void;
  onError?: (data: ErrorData) => void;
}

// ─── SSE Parser ─────────────────────────────────────────────────────────────

interface ParsedSSEEvent {
  event: string;
  data: string;
}

/**
 * Parses a buffer of SSE text into discrete events.
 * Returns the parsed events and any remaining incomplete text
 * that should be kept in the buffer for the next chunk.
 *
 * SSE spec: events are separated by blank lines (\n\n).
 * Each event can have `event:` and `data:` fields.
 * Multiple `data:` lines are joined with newlines.
 */
function parseSSEBuffer(buffer: string): {
  events: ParsedSSEEvent[];
  remaining: string;
} {
  const events: ParsedSSEEvent[] = [];

  // Split on double newlines to find complete event blocks.
  // We use a regex that matches \n\n, \r\n\r\n, or \r\r to handle
  // all line-ending conventions.
  const blocks = buffer.split(/\r?\n\r?\n/);

  // The last element might be an incomplete block if the chunk
  // was cut mid-event. Keep it as the remaining buffer.
  const remaining = blocks.pop() ?? '';

  for (const block of blocks) {
    // Skip empty blocks (e.g. leading double-newlines)
    const trimmed = block.trim();
    if (!trimmed) continue;

    let eventType = 'message'; // SSE default event type
    const dataLines: string[] = [];

    const lines = trimmed.split(/\r?\n/);
    for (const line of lines) {
      // Ignore SSE comments (lines starting with ':')
      if (line.startsWith(':')) continue;

      if (line.startsWith('event:')) {
        eventType = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
      // Ignore other fields (id:, retry:, etc.) — not needed here
    }

    // Only emit if we actually got data
    if (dataLines.length > 0) {
      events.push({
        event: eventType,
        data: dataLines.join('\n'),
      });
    }
  }

  return { events, remaining };
}

/**
 * Dispatches a parsed SSE event to the appropriate callback.
 */
function dispatchSSEEvent(
  event: ParsedSSEEvent,
  callbacks: StreamCallbacks,
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.data);
  } catch {
    // If we can't parse the JSON, treat it as an error
    callbacks.onError?.({ message: `Failed to parse event data: ${event.data}` });
    return;
  }

  switch (event.event) {
    case 'agent_start':
      callbacks.onAgentStart?.(parsed as AgentStartData);
      break;
    case 'chunk':
      callbacks.onChunk?.(parsed as ChunkData);
      break;
    case 'thinking':
      callbacks.onThinking?.(parsed as ThinkingData);
      break;
    case 'artifact':
      callbacks.onArtifact?.(parsed as ArtifactData);
      break;
    case 'usage':
      callbacks.onUsage?.(parsed as UsageData);
      break;
    case 'delegation':
      callbacks.onDelegation?.(parsed as DelegationData);
      break;
    case 'done':
      callbacks.onDone?.(parsed as DoneData);
      break;
    case 'error':
      callbacks.onError?.(parsed as ErrorData);
      break;
    default:
      // Unknown event types are silently ignored per SSE spec
      break;
  }
}

// ─── streamChat Utility ─────────────────────────────────────────────────────

/**
 * Imperatively streams a chat request to the AI team SSE endpoint.
 * Calls the provided callbacks as events arrive.
 *
 * @param projectId  - The project to send the message in
 * @param content    - The user's message content
 * @param agentShortName - Optional specific agent to address
 * @param callbacks  - SSE event handlers
 * @param signal     - Optional AbortSignal for cancellation
 */
export async function streamChat(
  projectId: string,
  content: string,
  agentShortName?: string,
  callbacks?: StreamCallbacks,
  signal?: AbortSignal,
  cardId?: string,
): Promise<void> {
  const cbs = callbacks ?? {};

  let response: Response;
  try {
    response = await fetch(`/api/projects/${projectId}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, agentShortName, cardId }),
      signal,
    });
  } catch (err: unknown) {
    // AbortError means the caller cancelled — not a real error
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    cbs.onError?.({
      message: err instanceof Error ? err.message : 'Failed to connect to AI team',
    });
    return;
  }

  if (!response.ok) {
    // Try to extract an error message from the response body
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.message) {
        errorMessage = errorBody.message;
      } else if (errorBody?.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Could not parse error body — use the status-based message
    }
    cbs.onError?.({ message: errorMessage });
    return;
  }

  if (!response.body) {
    cbs.onError?.({ message: 'Response body is empty — streaming not supported' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in the buffer.
        // Add a trailing double-newline so the parser treats
        // the last event block as complete.
        if (buffer.trim()) {
          const { events } = parseSSEBuffer(buffer + '\n\n');
          for (const event of events) {
            dispatchSSEEvent(event, cbs);
          }
        }
        break;
      }

      // Decode the chunk and append to the buffer.
      // `stream: true` ensures multi-byte characters split across
      // chunks are handled correctly.
      buffer += decoder.decode(value, { stream: true });

      // Parse complete events from the buffer
      const { events, remaining } = parseSSEBuffer(buffer);
      buffer = remaining;

      for (const event of events) {
        dispatchSSEEvent(event, cbs);
      }
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    cbs.onError?.({
      message: err instanceof Error ? err.message : 'Stream interrupted',
    });
  } finally {
    // Ensure the reader is released even if we exit early
    try {
      reader.releaseLock();
    } catch {
      // Reader may already be released
    }
  }
}

// ─── useAgentStream React Hook ──────────────────────────────────────────────

export interface AgentStreamState {
  /** Send a message and start streaming the response */
  send: (projectId: string, content: string, agentShortName?: string, cardId?: string) => Promise<void>;
  /** Abort the current stream */
  stop: () => void;
  /** Whether a stream is currently in progress */
  isStreaming: boolean;
  /** The agent currently responding */
  currentAgent: { shortName: string; name: string } | null;
  /** Accumulated text content from chunk events */
  streamContent: string;
  /** Accumulated thinking/reasoning content */
  streamThinking: string;
  /** Artifacts produced during this stream */
  artifacts: Array<{ name: string; type: string }>;
  /** The message ID returned on completion (null while streaming) */
  completedMessageId: string | null;
  /** Latest usage data from the stream */
  usage: UsageData['tokensUsed'] | null;
  /** Latest error message, if any */
  error: string | null;
}

/**
 * React hook that wraps `streamChat` with reactive state management.
 *
 * Usage:
 * ```tsx
 * const { send, stop, isStreaming, currentAgent, streamContent } = useAgentStream();
 *
 * // Send a message
 * await send(projectId, 'Build me a landing page');
 *
 * // Cancel mid-stream
 * stop();
 * ```
 */
export function useAgentStream(): AgentStreamState {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<{ shortName: string; name: string } | null>(null);
  const [streamContent, setStreamContent] = useState('');
  const [streamThinking, setStreamThinking] = useState('');
  const [artifacts, setArtifacts] = useState<Array<{ name: string; type: string }>>([]);
  const [completedMessageId, setCompletedMessageId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageData['tokensUsed'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (projectId: string, content: string, agentShortName?: string, cardId?: string) => {
      // Abort any in-flight stream before starting a new one
      if (abortRef.current) {
        abortRef.current.abort();
      }

      // Reset all state for the new stream
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setCurrentAgent(null);
      setStreamContent('');
      setStreamThinking('');
      setArtifacts([]);
      setCompletedMessageId(null);
      setUsage(null);
      setError(null);

      try {
        await streamChat(
          projectId,
          content,
          agentShortName,
          {
            onAgentStart: (data) => {
              setCurrentAgent({ shortName: data.agentShortName, name: data.agentName });
            },
            onChunk: (data) => {
              setStreamContent((prev) => prev + data.content);
            },
            onThinking: (data) => {
              setStreamThinking((prev) => prev + data.content);
            },
            onArtifact: (data) => {
              setArtifacts((prev) => [...prev, { name: data.name, type: data.type }]);
            },
            onUsage: (data) => {
              setUsage(data.tokensUsed);
            },
            onDelegation: (data) => {
              // When an agent delegates, update the current agent display.
              // The next agent_start event will set the full name,
              // but we can show the shortName immediately.
              setCurrentAgent({ shortName: data.toAgent, name: data.toAgent });
            },
            onDone: (data) => {
              setCompletedMessageId(data.messageId);
              setCurrentAgent((prev) =>
                prev?.shortName === data.agentShortName
                  ? prev
                  : { shortName: data.agentShortName, name: data.agentShortName },
              );
            },
            onError: (data) => {
              setError(data.message);
            },
          },
          controller.signal,
          cardId,
        );
      } catch (err: unknown) {
        // Only set error if it's not an abort
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }
      } finally {
        // Only update streaming state if this controller is still current
        // (prevents a race condition when a new send() replaces the old one)
        if (abortRef.current === controller) {
          setIsStreaming(false);
          abortRef.current = null;
        }
      }
    },
    [],
  );

  return {
    send,
    stop,
    isStreaming,
    currentAgent,
    streamContent,
    streamThinking,
    artifacts,
    completedMessageId,
    usage,
    error,
  };
}
