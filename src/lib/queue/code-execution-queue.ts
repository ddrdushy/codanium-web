// =============================================================================
// AI Team Studio — Code Execution Job Queue (BullMQ)
// =============================================================================
// Wraps BullMQ Queue for dispatching code execution jobs. Job payloads are
// minimal — the worker fetches full data from PostgreSQL using the executionId.
// =============================================================================

import { Queue } from 'bullmq';
import { getQueueConnection } from './connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal job payload — worker fetches full data from Postgres */
export interface CodeExecutionJobData {
  executionId: string;
  projectId: string;
}

export const CODE_EXECUTION_QUEUE_NAME = 'code-execution';

// ---------------------------------------------------------------------------
// Queue Singleton
// ---------------------------------------------------------------------------

let _queue: Queue<CodeExecutionJobData> | null = null;

export function getCodeExecutionQueue(): Queue<CodeExecutionJobData> {
  if (!_queue) {
    _queue = new Queue<CodeExecutionJobData>(CODE_EXECUTION_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 1, // Code execution should not retry — results must be deterministic
        removeOnComplete: { count: 500 },
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
 * Enqueue a code execution job.
 * Called after creating the CodeExecution row in Postgres.
 *
 * @param data    Minimal job payload
 * @returns       BullMQ job ID (same as executionId)
 */
export async function addCodeExecutionJob(
  data: CodeExecutionJobData,
): Promise<string> {
  const queue = getCodeExecutionQueue();
  const job = await queue.add('run-code', data, {
    jobId: data.executionId, // 1:1 mapping for dedup
  });
  return job.id ?? data.executionId;
}
