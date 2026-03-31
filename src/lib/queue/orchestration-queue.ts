// =============================================================================
// AI Team Studio — Orchestration Job Queue (BullMQ)
// =============================================================================
// Wraps BullMQ Queue for dispatching orchestration jobs. Job payloads are
// intentionally minimal — the worker fetches full data from PostgreSQL.
//
// The jobId is set to the OrchestrationRun.id for 1:1 mapping and dedup.
// =============================================================================

import { Queue } from 'bullmq';
import { getQueueConnection } from './connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal job payload — worker fetches full data from Postgres */
export interface OrchestrationJobData {
  runId: string;
  projectId: string;
  userId: string;
}

export const QUEUE_NAME = 'orchestration';

// ---------------------------------------------------------------------------
// Queue Singleton
// ---------------------------------------------------------------------------

let _queue: Queue<OrchestrationJobData> | null = null;

export function getOrchestrationQueue(): Queue<OrchestrationJobData> {
  if (!_queue) {
    _queue = new Queue<OrchestrationJobData>(QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s → 2s → 4s
        },
        removeOnComplete: { count: 1000 },  // Keep last 1000 completed
        removeOnFail: { count: 5000 },       // Keep last 5000 failed
      },
    });
  }
  return _queue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add an orchestration job to the BullMQ queue.
 * Called from TaskQueue.enqueue() after creating the OrchestrationRun row.
 *
 * @param data    Minimal job payload
 * @param options Priority and delay overrides
 * @returns       BullMQ job ID (same as runId)
 */
export async function addOrchestrationJob(
  data: OrchestrationJobData,
  options?: {
    priority?: number;  // Lower = higher priority (1=interactive, 5=pipeline, 10=background)
    delay?: number;     // Delay in ms before processing
  },
): Promise<string> {
  const queue = getOrchestrationQueue();
  const job = await queue.add('process-orchestration', data, {
    priority: options?.priority,
    delay: options?.delay,
    jobId: data.runId, // 1:1 mapping with OrchestrationRun for dedup
  });
  return job.id ?? data.runId;
}
