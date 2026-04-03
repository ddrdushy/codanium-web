// =============================================================================
// Codanium — Orchestration Worker (BullMQ)
// =============================================================================
// BullMQ Worker that processes background orchestration jobs. Mirrors the logic
// in task-processor.ts but is driven by BullMQ instead of PostgreSQL polling.
//
// Key design:
//   - Fetches full OrchestrationRun from Postgres (BullMQ payload is minimal)
//   - Idempotency guard: skips already completed/failed/cancelled runs
//   - Syncs retry state back to Postgres on failure
//   - Dynamic import of agentLoop to avoid circular deps
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
  const { agentLoop } = await import(
    '@/lib/ai/orchestration/agent-loop'
  );

  // 5. Execute orchestration via agent loop
  const events = agentLoop({
    projectId: run.projectId,
    userId: run.userId,
    userMessage: run.userMessage,
    targetAgentShortName: run.routedTo,
    isPipeline: true,
  });

  // Drain the generator — handle pipeline_next events for auto-continuation
  let pipelineNext: { nextAgent: string; context: string; depth: number } | null = null;
  for await (const event of events) {
    // Capture pipeline_next to continue the chain after this agent completes
    if (event.type === 'pipeline_next' && event.data) {
      pipelineNext = event.data as { nextAgent: string; context: string; depth: number };
    }
  }

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

  // 8. If this was a child of a parallel team, check if team is now complete
  if (run.parentRunId) {
    const { maybeCompleteTeam } = await import('@/lib/ai/orchestration/team-dispatch');
    await maybeCompleteTeam(run.parentRunId, run.projectId).catch((err) => {
      console.warn('[Worker] maybeCompleteTeam failed:', err.message);
    });
  }

  // 9. Pipeline continuation — if the agent yielded a pipeline_next event,
  //    enqueue the next agent as a new background task (e.g., PM → BA)
  if (pipelineNext) {
    console.log(`[Worker] Pipeline continuation: ${run.routedTo} -> ${pipelineNext.nextAgent}`);
    const { taskQueue } = await import('@/lib/ai/orchestration/task-queue');
    await taskQueue.enqueue({
      projectId: run.projectId,
      userId: run.userId,
      userMessage: pipelineNext.context,
      targetAgent: pipelineNext.nextAgent,
      autoRouted: true,
      isBackground: true,
      priority: 10,
    }).catch((err) => {
      console.error(`[Worker] Pipeline continuation failed: ${err.message}`);
    });
  }
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
