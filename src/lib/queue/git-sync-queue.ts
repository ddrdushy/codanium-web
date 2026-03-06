// =============================================================================
// AI Team Studio — Git Sync Job Queue (BullMQ)
// =============================================================================
// Mirrors email-queue.ts pattern. Dispatches git sync jobs to the worker
// for periodic or manual repository synchronization.
// =============================================================================

import { Queue } from 'bullmq';
import { getQueueConnection } from './connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Git sync job payload */
export interface GitSyncJobData {
  projectId: string;
  triggeredBy: 'manual' | 'scheduled' | 'webhook';
}

export const GIT_SYNC_QUEUE_NAME = 'git-sync';

// ---------------------------------------------------------------------------
// Queue Singleton
// ---------------------------------------------------------------------------

let _queue: Queue<GitSyncJobData> | null = null;

export function getGitSyncQueue(): Queue<GitSyncJobData> {
  if (!_queue) {
    _queue = new Queue<GitSyncJobData>(GIT_SYNC_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s → 15s → 45s
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return _queue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a git sync job to the BullMQ queue.
 *
 * @param data    Git sync job payload
 * @returns       BullMQ job ID
 */
export async function addGitSyncJob(data: GitSyncJobData): Promise<string> {
  const queue = getGitSyncQueue();
  const job = await queue.add('sync-git', data, {
    // Deduplicate by projectId — don't queue multiple syncs for same project
    jobId: `git-sync-${data.projectId}-${Date.now()}`,
  });
  return job.id ?? 'unknown';
}

/**
 * Add a repeatable git sync job for a project (every 15 minutes).
 * Call when a project enables git sync.
 */
export async function addRepeatableGitSync(projectId: string): Promise<void> {
  const queue = getGitSyncQueue();
  await queue.upsertJobScheduler(
    `git-sync-repeat-${projectId}`,
    { every: 15 * 60 * 1000 }, // 15 minutes
    {
      name: 'sync-git',
      data: { projectId, triggeredBy: 'scheduled' as const },
    },
  );
  console.log(`[GitSyncQueue] Repeatable sync enabled for project ${projectId} (every 15 min)`);
}

/**
 * Remove the repeatable git sync job for a project.
 * Call when a project disables git sync.
 */
export async function removeRepeatableGitSync(projectId: string): Promise<void> {
  const queue = getGitSyncQueue();
  const removed = await queue.removeJobScheduler(`git-sync-repeat-${projectId}`);
  if (removed) {
    console.log(`[GitSyncQueue] Repeatable sync disabled for project ${projectId}`);
  }
}
