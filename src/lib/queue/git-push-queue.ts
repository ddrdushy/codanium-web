// =============================================================================
// AI Team Studio — Git Push Job Queue (BullMQ)
// =============================================================================
// Mirrors git-sync-queue.ts pattern. Dispatches git push jobs to the worker
// for async pushing of project artifacts to GitHub.
// =============================================================================

import { Queue } from 'bullmq';
import { getQueueConnection } from './connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Git push job payload */
export interface GitPushJobData {
  projectId: string;
  branchName: string;
  commitMessage: string;
  createPR: boolean;
  prTitle?: string;
  triggeredBy: string; // userId
}

export const GIT_PUSH_QUEUE_NAME = 'git-push';

// ---------------------------------------------------------------------------
// Queue Singleton
// ---------------------------------------------------------------------------

let _queue: Queue<GitPushJobData> | null = null;

export function getGitPushQueue(): Queue<GitPushJobData> {
  if (!_queue) {
    _queue = new Queue<GitPushJobData>(GIT_PUSH_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 2,      // Push creates side effects; fewer retries
        backoff: {
          type: 'exponential',
          delay: 10000,    // 10s → 20s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return _queue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a git push job to the BullMQ queue.
 */
export async function addGitPushJob(data: GitPushJobData): Promise<string> {
  const queue = getGitPushQueue();
  const job = await queue.add('push-to-github', data, {
    jobId: `git-push-${data.projectId}-${Date.now()}`,
  });
  return job.id ?? 'unknown';
}
