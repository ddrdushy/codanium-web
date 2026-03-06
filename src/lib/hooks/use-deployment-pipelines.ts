'use client';
import { useState, useEffect, useCallback } from 'react';

interface DeploymentRun {
  id: string;
  status: string;
  currentStage: string;
  triggeredBy: string;
  branch: string;
  commitHash: string;
  durationMs: number;
  errorMessage?: string;
  buildLogs: string;
  testLogs: string;
  deployLogs: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface Pipeline {
  id: string;
  name: string;
  environment: string;
  trigger: string;
  config: string;
  runs: DeploymentRun[];
  createdAt: string;
}

export function useDeploymentPipelines(projectId: string) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/pipelines`);
      if (res.ok) {
        const data = await res.json();
        setPipelines(data);
      }
    } catch (e) {
      console.error('Failed to fetch pipelines:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPipelines();
    // Auto-poll when any run is active
    const hasActiveRun = pipelines.some(p => p.runs.some(r => r.status === 'RUNNING' || r.status === 'PENDING'));
    if (hasActiveRun) {
      const interval = setInterval(fetchPipelines, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchPipelines, pipelines]);

  const triggerDeploy = async (pipelineId: string, branch = 'main') => {
    const res = await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch }),
    });
    if (res.ok) {
      await fetchPipelines();
    }
    return res.ok;
  };

  const cancelRun = async (pipelineId: string, runId: string) => {
    const res = await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}/runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    if (res.ok) await fetchPipelines();
  };

  return { pipelines, loading, triggerDeploy, cancelRun, refetch: fetchPipelines };
}
