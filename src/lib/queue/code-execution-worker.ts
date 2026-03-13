// =============================================================================
// AI Team Studio — Code Execution Worker (BullMQ)
// =============================================================================
// BullMQ Worker that processes sandboxed code execution jobs.
//
// Flow:
//   1. Fetch CodeExecution row from Postgres
//   2. Idempotency guard (skip terminal states)
//   3. Mark RUNNING
//   4. Execute code in Docker sandbox
//   5. Update CodeExecution with results (stdout, stderr, exitCode)
//   6. Emit event for real-time UI updates
// =============================================================================

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from './connection';
import { CODE_EXECUTION_QUEUE_NAME } from './code-execution-queue';
import type { CodeExecutionJobData } from './code-execution-queue';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/ai/orchestration/event-bus';
import { executeInSandbox } from '@/lib/sandbox/docker-runner';

// ---------------------------------------------------------------------------
// Worker Singleton
// ---------------------------------------------------------------------------

let _worker: Worker<CodeExecutionJobData> | null = null;

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

/**
 * Process a single code execution job.
 */
async function processCodeExecutionJob(
  job: Job<CodeExecutionJobData>,
): Promise<void> {
  const { executionId, projectId } = job.data;

  // 1. Fetch CodeExecution from Postgres
  const execution = await prisma.codeExecution.findUnique({
    where: { id: executionId },
  });

  if (!execution) {
    throw new Error(`CodeExecution ${executionId} not found`);
  }

  // 2. Idempotency guard — skip if already terminal
  if (['SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED'].includes(execution.status)) {
    console.log(
      `[CodeExecutionWorker] Skipping ${executionId} — already ${execution.status}`,
    );
    return;
  }

  // 3. Mark as RUNNING
  await prisma.codeExecution.update({
    where: { id: executionId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  console.log(
    `[CodeExecutionWorker] Executing ${executionId} — language: ${execution.language}`,
  );

  try {
    // 4. Execute in Docker sandbox
    const result = await executeInSandbox({
      language: execution.language,
      code: execution.code,
      stdin: execution.stdin || undefined,
      timeoutMs: 30_000, // 30 second timeout
      memoryMb: 256,
    });

    // 5. Determine status
    let status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' = 'SUCCESS';
    if (result.timedOut) {
      status = 'TIMEOUT';
    } else if (result.exitCode !== 0) {
      status = 'FAILED';
    }

    // 6. Update CodeExecution with results
    await prisma.codeExecution.update({
      where: { id: executionId },
      data: {
        status,
        stdout: result.stdout.slice(0, 500_000), // Limit to 500KB
        stderr: result.stderr.slice(0, 500_000),
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        memoryUsedMb: result.memoryUsedMb,
        errorMessage: result.error || null,
        completedAt: new Date(),
      },
    });

    console.log(
      `[CodeExecutionWorker] Completed ${executionId} — status: ${status} exitCode: ${result.exitCode} duration: ${result.durationMs}ms`,
    );

    // 7. Emit event for real-time UI updates
    await eventBus.emit({
      type: 'action.executed',
      actor: 'system',
      projectId,
      payload: {
        actionType: 'code_execution_complete',
        executionId,
        status,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[CodeExecutionWorker] Error executing ${executionId}:`,
      errorMsg,
    );

    await prisma.codeExecution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        errorMessage: errorMsg,
        completedAt: new Date(),
      },
    });

    await eventBus.emit({
      type: 'action.executed',
      actor: 'system',
      projectId,
      payload: {
        actionType: 'code_execution_failed',
        executionId,
        error: errorMsg,
      },
    });

    throw err; // Let BullMQ handle the failure
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create and start the code execution BullMQ worker.
 * Called from worker-entrypoint.ts.
 */
export function createCodeExecutionWorker(): Worker<CodeExecutionJobData> {
  if (_worker) return _worker;

  _worker = new Worker<CodeExecutionJobData>(
    CODE_EXECUTION_QUEUE_NAME,
    processCodeExecutionJob,
    {
      connection: getQueueConnection(),
      concurrency: 3, // Max 3 parallel executions
      limiter: {
        max: 5,
        duration: 1000, // 5 jobs/second max
      },
    },
  );

  _worker.on('completed', (job) => {
    console.log(`[CodeExecutionWorker] Job ${job.id} completed`);
  });

  _worker.on('failed', (job, err) => {
    console.error(`[CodeExecutionWorker] Job ${job?.id} failed:`, err.message);
  });

  return _worker;
}
