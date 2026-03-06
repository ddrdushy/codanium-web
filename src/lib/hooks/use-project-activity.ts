'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface ActivityEvent {
  id: string;
  type: string;
  category: string; // 'agent_status' | 'task_update' | 'deployment_update' | 'code_update' | 'build_update' | 'member_activity'
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const MAX_EVENTS = 50; // Keep last 50 events in memory
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

/**
 * Hook that connects to the project activity SSE stream.
 * Returns live events for the project.
 */
export function useProjectActivity(projectId: string | null) {
  const { status } = useSession();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!projectId || status !== 'authenticated') return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource(`/api/projects/${projectId}/activity/stream`);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      reconnectAttemptRef.current = 0;
    });

    es.addEventListener('activity', (event) => {
      try {
        const data: ActivityEvent = JSON.parse(event.data);
        setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
      } catch (err) {
        console.error('[useProjectActivity] Parse error:', err);
      }
    });

    es.addEventListener('heartbeat', () => {
      reconnectAttemptRef.current = 0;
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY
      );
      reconnectAttemptRef.current++;

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [projectId, status]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect]);

  // Reset events when project changes
  useEffect(() => {
    setEvents([]);
  }, [projectId]);

  return { events, connected };
}
