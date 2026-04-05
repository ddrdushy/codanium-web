'use client';

import { useState, useEffect } from 'react';
import type {
  ChunkData,
  ThinkingData,
  ArtifactData,
  UsageData,
  DelegationData,
  DoneData,
  ErrorData,
  ToolCallData,
  ToolResultData,
  PipelineProgressData,
  ToolActivity,
  AgentStartData
} from './use-agent-stream';

export interface ProjectStreamState {
  isBackgroundStreaming: boolean;
  backgroundAgent: { shortName: string; name: string } | null;
  backgroundContent: string;
  backgroundThinking: string;
  backgroundArtifacts: Array<{ name: string; type: string }>;
  backgroundToolActivities: ToolActivity[];
  backgroundPipelineProgress: PipelineProgressData | null;
  backgroundError: string | null;
  /** Increments each time a background agent completes — use to trigger refetch */
  backgroundDoneCounter: number;
}

/**
 * React hook that connects to the project-wide SSE event stream via EventSource.
 * It listens to all background agents currently processing queue items.
 */
export function useProjectStream(projectId: string | undefined): ProjectStreamState {
  const [isBackgroundStreaming, setIsBackgroundStreaming] = useState(false);
  const [backgroundAgent, setBackgroundAgent] = useState<{ shortName: string; name: string } | null>(null);
  const [backgroundContent, setBackgroundContent] = useState('');
  const [backgroundThinking, setBackgroundThinking] = useState('');
  const [backgroundArtifacts, setBackgroundArtifacts] = useState<Array<{ name: string; type: string }>>([]);
  const [backgroundToolActivities, setBackgroundToolActivities] = useState<ToolActivity[]>([]);
  const [backgroundPipelineProgress, setBackgroundPipelineProgress] = useState<PipelineProgressData | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [backgroundDoneCounter, setBackgroundDoneCounter] = useState(0);

  useEffect(() => {
    if (!projectId) return;

    let eventSource: EventSource;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      eventSource = new EventSource(`/api/projects/${projectId}/stream`);

      eventSource.addEventListener('agent_start', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as AgentStartData;
        setIsBackgroundStreaming(true);
        setBackgroundAgent({ shortName: data.agentShortName, name: data.agentName });
        setBackgroundContent('');
        setBackgroundThinking('');
        setBackgroundArtifacts([]);
        setBackgroundToolActivities([]);
        setBackgroundError(null);
        setBackgroundPipelineProgress(null);
      });

      eventSource.addEventListener('chunk', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as ChunkData;
        setBackgroundContent((prev) => prev + data.content);
      });

      eventSource.addEventListener('thinking', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as ThinkingData;
        setBackgroundThinking((prev) => prev + data.content);
      });

      eventSource.addEventListener('artifact', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as ArtifactData;
        setBackgroundArtifacts((prev) => [...prev, { name: data.name, type: data.type }]);
      });

      eventSource.addEventListener('tool_call', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as ToolCallData;
        setBackgroundToolActivities((prev) => [
          ...prev,
          { name: data.name, arguments: data.arguments, status: 'calling' },
        ]);
      });

      eventSource.addEventListener('tool_result', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as ToolResultData;
        setBackgroundToolActivities((prev) => {
          const idx = [...prev].reverse().findIndex(
            (t) => t.name === data.name && t.status === 'calling'
          );
          if (idx === -1) {
            return [
              ...prev,
              { name: data.name, result: data.result, success: data.success, status: data.success ? 'completed' : 'failed' },
            ];
          }
          const realIdx = prev.length - 1 - idx;
          const updated = [...prev];
          updated[realIdx] = {
            ...updated[realIdx],
            result: data.result,
            success: data.success,
            status: data.success ? 'completed' : 'failed',
          };
          return updated;
        });
      });

      eventSource.addEventListener('pipeline_progress', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as PipelineProgressData;
        setBackgroundPipelineProgress(data);
      });

      eventSource.addEventListener('done', (e: MessageEvent) => {
        setIsBackgroundStreaming(false);
        // Signal chat page to refetch messages from DB
        setBackgroundDoneCounter((c) => c + 1);
      });

      eventSource.addEventListener('error', (e: MessageEvent) => {
        // SSE error events are sometimes blank; we handle app-level error payloads explicitly
        try {
          const data = JSON.parse(e.data) as ErrorData;
          setBackgroundError(data.message);
        } catch {}
        setIsBackgroundStreaming(false);
      });

      // Browser handles auto-reconnect, but if it fundamentally fails, we reconnect manually.
      eventSource.onerror = (e) => {
        eventSource.close();
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [projectId]);

  return {
    isBackgroundStreaming,
    backgroundAgent,
    backgroundContent,
    backgroundThinking,
    backgroundArtifacts,
    backgroundToolActivities,
    backgroundPipelineProgress,
    backgroundError,
    backgroundDoneCounter,
  };
}
