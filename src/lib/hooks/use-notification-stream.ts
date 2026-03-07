'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useNotificationStore, mapDbNotification } from '@/lib/notification-store';
import { useToastStore } from '@/lib/toast-store';

const MAX_RECONNECT_DELAY = 30000; // 30s max
const BASE_RECONNECT_DELAY = 1000; // 1s base

/**
 * Hook that connects to the notification SSE stream.
 * Automatically adds new notifications to the store and shows toasts.
 */
export function useNotificationStream() {
  const { status } = useSession();
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const addToast = useToastStore((s) => s.addToast);

  const connect = useCallback(() => {
    // Don't connect if not authenticated
    if (status !== 'authenticated') return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource('/api/notifications/stream');
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      reconnectAttemptRef.current = 0; // Reset on successful connect
    });

    es.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse(event.data);
        const notification = mapDbNotification(data);
        addNotification(notification);

        // Show toast for new unread notifications
        if (!notification.read) {
          const toastType = ['failure', 'security'].includes(notification.type)
            ? 'error'
            : notification.type === 'completion' || notification.type === 'build'
              ? 'success'
              : 'info';

          addToast({
            type: toastType as any,
            message: `${notification.title}: ${notification.description}`.slice(0, 100),
          });
        }
      } catch (err) {
        console.error('[useNotificationStream] Parse error:', err);
      }
    });

    es.addEventListener('heartbeat', () => {
      // Connection is alive — reset reconnect counter
      reconnectAttemptRef.current = 0;
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff reconnect
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY
      );
      reconnectAttemptRef.current++;

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [status, addNotification, addToast]);

  useEffect(() => {
    // Fetch badge count immediately on mount (before SSE connects)
    useNotificationStore.getState().fetchUnreadCount();
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

  return { connected };
}
