'use client';
import { useState, useEffect, useCallback } from 'react';

interface Task {
  id: string;
  status: string;
  routedTo: string;
  userMessage: string;
  tokensTotal: number;
  latencyMs: number;
  errorMessage?: string;
  retryCount: number;
  isBackground: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export function useTaskQueue(projectId: string) {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setActiveTasks(data.active);
        setRecentTasks(data.recent);
      }
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
    // Auto-poll when there are active tasks
    if (activeTasks.length > 0) {
      const interval = setInterval(fetchTasks, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchTasks, activeTasks.length]);

  const cancelTask = async (taskId: string) => {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    if (res.ok) await fetchTasks();
  };

  return { activeTasks, recentTasks, loading, cancelTask, refetch: fetchTasks };
}
