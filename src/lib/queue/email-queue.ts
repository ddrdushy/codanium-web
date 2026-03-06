// =============================================================================
// AI Team Studio — Email Job Queue (BullMQ)
// =============================================================================
// Mirrors orchestration-queue.ts pattern. Dispatches email jobs to the worker
// for async delivery via SendGrid.
// =============================================================================

import { Queue } from 'bullmq';
import { getQueueConnection } from './connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Email job payload — worker renders template + sends via SendGrid */
export interface EmailJobData {
  to: string;
  subject: string;
  template: 'verification' | 'password-reset' | 'team-invitation' | 'subscription' | 'payment-failed';
  props: Record<string, string>;
}

export const EMAIL_QUEUE_NAME = 'email';

// ---------------------------------------------------------------------------
// Queue Singleton
// ---------------------------------------------------------------------------

let _queue: Queue<EmailJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!_queue) {
    _queue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s → 4s → 8s
        },
        removeOnComplete: { count: 500 },   // Keep last 500 completed
        removeOnFail: { count: 2000 },       // Keep last 2000 failed
      },
    });
  }
  return _queue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add an email job to the BullMQ queue.
 *
 * @param data    Email job payload (template + props)
 * @returns       BullMQ job ID
 */
export async function addEmailJob(data: EmailJobData): Promise<string> {
  const queue = getEmailQueue();
  const job = await queue.add('send-email', data);
  return job.id ?? 'unknown';
}
