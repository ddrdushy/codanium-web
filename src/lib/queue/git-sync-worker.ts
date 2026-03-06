// =============================================================================
// AI Team Studio — Git Sync Worker (BullMQ)
// =============================================================================
// Processes git sync jobs by calling the sync logic to fetch from GitHub
// and upsert into Prisma models.
//
// Mirrors email-worker.ts pattern.
// =============================================================================

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from './connection';
import { GIT_SYNC_QUEUE_NAME } from './git-sync-queue';
import type { GitSyncJobData } from './git-sync-queue';
import { syncProjectGit } from '@/lib/git/sync';

// ---------------------------------------------------------------------------
// Worker Singleton
// ---------------------------------------------------------------------------

let _worker: Worker<GitSyncJobData> | null = null;

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

/**
 * Process a single git sync job.
 */
async function processGitSyncJob(job: Job<GitSyncJobData>): Promise<void> {
  const { projectId, triggeredBy } = job.data;

  console.log(`[GitSyncWorker] Processing job ${job.id}: project=${projectId} trigger=${triggeredBy}`);

  const result = await syncProjectGit(projectId);

  if (result.errors.length > 0) {
    console.warn(
      `[GitSyncWorker] Job ${job.id} completed with errors:`,
      result.errors,
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create and start the BullMQ git sync worker.
 * Call once from worker-entrypoint.ts.
 */
export function createGitSyncWorker(): Worker<GitSyncJobData> {
  if (_worker) return _worker;

  _worker = new Worker<GitSyncJobData>(
    GIT_SYNC_QUEUE_NAME,
    processGitSyncJob,
    {
      connection: getQueueConnection(),
      concurrency: 2, // GitHub API rate limited
      limiter: {
        max: 3,
        duration: 1000, // Max 3 sync operations per second
      },
    },
  );

  // ── Event Handlers ──────────────────────────────────────────────────────

  _worker.on('failed', (job, err) => {
    if (!job) return;
    console.error(
      `[GitSyncWorker] Job ${job.id} failed (attempt ${job.attemptsMade}):`,
      err.message,
    );
  });

  _worker.on('completed', (job) => {
    console.log(
      `[GitSyncWorker] Job ${job?.id} completed: project=${job?.data.projectId}`,
    );
  });

  _worker.on('error', (err) => {
    console.error('[GitSyncWorker] Worker error:', err);
  });

  return _worker;
}
