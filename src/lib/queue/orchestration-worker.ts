// =============================================================================
// AI Team Studio — Orchestration Worker (BullMQ)
// =============================================================================
// BullMQ Worker that processes background orchestration jobs. Mirrors the logic
// in task-processor.ts but is driven by BullMQ instead of PostgreSQL polling.
//
// Key design:
//   - Fetches full OrchestrationRun from Postgres (BullMQ payload is minimal)
//   - Idempotency guard: skips already completed/failed/cancelled runs
//   - Syncs retry state back to Postgres on failure
//   - Dynamic import of orchestrationEngine to avoid circular deps
//   - Concurrency 5, rate limited to 10 jobs/second
// =============================================================================

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from './connection';
import { QUEUE_NAME } from './orchestration-queue';
import type { OrchestrationJobData } from './orchestration-queue';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/ai/orchestration/event-bus';

// ---------------------------------------------------------------------------
// Worker Singleton
// ---------------------------------------------------------------------------

let _worker: Worker<OrchestrationJobData> | null = null;

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

/**
 * Process a single orchestration job. Called by BullMQ worker.
 */
async function processOrchestrationJob(
  job: Job<OrchestrationJobData>,
): Promise<void> {
  const { runId, projectId } = job.data;

  // 1. Fetch OrchestrationRun from Postgres
  const run = await prisma.orchestrationRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error(`OrchestrationRun ${runId} not found`);
  }

  // 2. Idempotency guard — skip if already terminal
  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
    console.log(`[Worker] Run ${runId} already ${run.status}, skipping`);
    return;
  }

  // 3. Mark RUNNING in Postgres
  await prisma.orchestrationRun.update({
    where: { id: runId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const startTime = Date.now();

  // 4. Dynamic import to avoid circular dependencies
  //    (same pattern as task-processor.ts)
  const { orchestrationEngine } = await import(
    '@/lib/ai/orchestration/engine'
  );

  // 5. Execute orchestration
  //    skipMessageSave: true — the auto-kickoff already saved a SYSTEM message;
  //    do NOT save userMessage again as a USER message (causes duplicates).
  await orchestrationEngine.process({
    projectId: run.projectId,
    userMessage: run.userMessage,
    targetAgentShortName: run.routedTo,
    userId: run.userId,
    skipMessageSave: true,
  });

  // 6. Mark COMPLETED in Postgres
  await prisma.orchestrationRun.update({
    where: { id: runId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      latencyMs: Date.now() - startTime,
    },
  });

  // 7. Emit completion event
  await eventBus.emit({
    type: 'task.completed',
    actor: run.routedTo,
    projectId: run.projectId,
    payload: { runId },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create and start the BullMQ orchestration worker.
 * Call once from worker-entrypoint.ts.
 */
export function createOrchestrationWorker(): Worker<OrchestrationJobData> {
  if (_worker) return _worker;

  _worker = new Worker<OrchestrationJobData>(
    QUEUE_NAME,
    processOrchestrationJob,
    {
      connection: getQueueConnection(),
      concurrency: 5, // Process up to 5 jobs in parallel
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
      },
    },
  );

  // ── Event Handlers ──────────────────────────────────────────────────────

  _worker.on('failed', async (job, err) => {
    if (!job) return;
    console.error(`[Worker] Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);

    const { runId, projectId } = job.data;
    const maxAttempts = job.opts.attempts ?? 3;

    if (job.attemptsMade >= maxAttempts) {
      // Out of retries — mark FAILED in Postgres
      await prisma.orchestrationRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: err.message,
          retryCount: job.attemptsMade,
        },
      });

      await eventBus.emit({
        type: 'task.failed',
        actor: 'system',
        projectId,
        payload: { runId, error: err.message },
      });
    } else {
      // Still has retries — revert to PENDING in Postgres
      await prisma.orchestrationRun.update({
        where: { id: runId },
        data: {
          status: 'PENDING',
          retryCount: job.attemptsMade,
          errorMessage: err.message,
          startedAt: null,
        },
      });
    }
  });

  _worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job?.id} completed`);
  });

  _worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  return _worker;
}
