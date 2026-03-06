'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface OnlineUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  status: string; // 'online' | 'idle' | 'away'
  lastSeenAt: string;
}

/**
 * Hook for presence management within a project.
 * - Sends heartbeat POST every 30s
 * - Fetches online users every 10s
 * - Cleans up on unmount (DELETE)
 */
export function usePresence(projectId: string | null) {
  const { status } = useSession();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupDone = useRef(false);

  const sendHeartbeat = useCallback(async () => {
    if (!projectId || status !== 'authenticated') return;
    try {
      const res = await fetch(`/api/projects/${projectId}/presence`, {
        method: 'POST',
      });
      if (res.ok) setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  }, [projectId, status]);

  const fetchOnlineUsers = useCallback(async () => {
    if (!projectId || status !== 'authenticated') return;
    try {
      const res = await fetch(`/api/projects/${projectId}/presence`);
      if (res.ok) {
        const data = await res.json();
        setOnlineUsers(data.users ?? []);
      }
    } catch {
      // Silent fail
    }
  }, [projectId, status]);

  const leave = useCallback(async () => {
    if (!projectId || cleanupDone.current) return;
    cleanupDone.current = true;
    try {
      // Use sendBeacon for reliability on unmount
      navigator.sendBeacon(
        `/api/projects/${projectId}/presence`,
        // sendBeacon doesn't support DELETE, so we'll use fetch
      );
      await fetch(`/api/projects/${projectId}/presence`, {
        method: 'DELETE',
        keepalive: true,
      });
    } catch {
      // Best effort
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || status !== 'authenticated') return;
    cleanupDone.current = false;

    // Initial heartbeat + fetch
    sendHeartbeat();
    fetchOnlineUsers();

    // Set up intervals
    heartbeatRef.current = setInterval(sendHeartbeat, 30000); // 30s heartbeat
    pollRef.current = setInterval(fetchOnlineUsers, 10000); // 10s poll

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      leave();
    };
  }, [projectId, status, sendHeartbeat, fetchOnlineUsers, leave]);

  return { onlineUsers, isConnected };
}
