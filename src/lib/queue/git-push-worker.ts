// =============================================================================
// AI Team Studio — Git Push Worker (BullMQ)
// =============================================================================
// Processes git push jobs by calling pushProjectToGitHub() to create a branch,
// commit artifacts, and optionally create a PR on GitHub.
//
// Mirrors git-sync-worker.ts pattern.
// =============================================================================

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from './connection';
import { GIT_PUSH_QUEUE_NAME } from './git-push-queue';
import type { GitPushJobData } from './git-push-queue';
import { pushProjectToGitHub } from '@/lib/git/push';

// ---------------------------------------------------------------------------
// Worker Singleton
// ---------------------------------------------------------------------------

let _worker: Worker<GitPushJobData> | null = null;

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

async function processGitPushJob(job: Job<GitPushJobData>): Promise<void> {
  const { projectId, branchName, commitMessage, createPR, prTitle, triggeredBy } = job.data;

  console.log(
    `[GitPushWorker] Processing job ${job.id}: project=${projectId} branch=${branchName}`,
  );

  const result = await pushProjectToGitHub({
    projectId,
    branchName,
    commitMessage,
    createPR,
    prTitle,
    triggeredBy,
  });

  // Store result on job for API polling
  await job.updateProgress({
    success: result.success,
    branchName: result.branchName,
    commitSha: result.commitSha,
    commitUrl: result.commitUrl,
    filesCount: result.filesCount,
    prNumber: result.pr?.number ?? null,
    prUrl: result.pr?.htmlUrl ?? null,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create and start the BullMQ git push worker.
 * Called from worker-entrypoint.ts.
 */
export function createGitPushWorker(): Worker<GitPushJobData> {
  if (_worker) return _worker;

  _worker = new Worker<GitPushJobData>(
    GIT_PUSH_QUEUE_NAME,
    processGitPushJob,
    {
      connection: getQueueConnection(),
      concurrency: 1, // One push at a time to avoid branch conflicts
      limiter: {
        max: 2,
        duration: 1000,
      },
    },
  );

  _worker.on('failed', (job, err) => {
    if (!job) return;
    console.error(
      `[GitPushWorker] Job ${job.id} failed (attempt ${job.attemptsMade}):`,
      err.message,
    );
  });

  _worker.on('completed', (job) => {
    console.log(
      `[GitPushWorker] Job ${job?.id} completed: project=${job?.data.projectId}`,
    );
  });

  _worker.on('error', (err) => {
    console.error('[GitPushWorker] Worker error:', err);
  });

  return _worker;
}
