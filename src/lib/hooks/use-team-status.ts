'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTeamStatus, type TeamStatus } from '@/lib/api';

const POLL_INTERVAL_MS = 3000;

/**
 * Poll team execution status until overallStatus is no longer 'running'.
 *
 * @param projectId  - The project that owns the team run
 * @param teamId     - The parent coordinator run ID returned by dispatchTeam()
 * @param enabled    - Pass false to pause polling (e.g. before teamId is known)
 */
export function useTeamStatus(
  projectId: string,
  teamId: string | null,
  enabled = true,
) {
  const [status, setStatus] = useState<TeamStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    if (!teamId || !enabled) return;
    setLoading(true);
    try {
      const data = await fetchTeamStatus(projectId, teamId);
      setStatus(data);
      setError(null);
      // Keep polling while the team is still running
      if (data.overallStatus === 'running') {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch team status');
    } finally {
      setLoading(false);
    }
  }, [projectId, teamId, enabled]);

  useEffect(() => {
    if (!teamId || !enabled) return;
    poll();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll, teamId, enabled]);

  return { status, loading, error };
}
