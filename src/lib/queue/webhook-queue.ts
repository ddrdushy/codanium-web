// =============================================================================
// AI Team Studio — Webhook Delivery Job Queue (BullMQ)
// =============================================================================
// Mirrors email-queue.ts pattern. Dispatches outbound webhook delivery jobs
// to the worker for async HTTP delivery to registered endpoints.
// =============================================================================

import { Queue } from 'bullmq';
import { getQueueConnection } from './connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Webhook delivery job payload */
export interface WebhookDeliveryJobData {
  endpointId: string;
  eventType: string;
  payload: string; // JSON stringified event data
}

export const WEBHOOK_QUEUE_NAME = 'webhook-delivery';

// ---------------------------------------------------------------------------
// Queue Singleton
// ---------------------------------------------------------------------------

let _queue: Queue<WebhookDeliveryJobData> | null = null;

export function getWebhookQueue(): Queue<WebhookDeliveryJobData> {
  if (!_queue) {
    _queue = new Queue<WebhookDeliveryJobData>(WEBHOOK_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10s → 30s → 90s → 270s → 810s
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return _queue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a webhook delivery job to the BullMQ queue.
 *
 * @param data    Webhook delivery payload
 * @returns       BullMQ job ID
 */
export async function addWebhookDeliveryJob(data: WebhookDeliveryJobData): Promise<string> {
  const queue = getWebhookQueue();
  const job = await queue.add('deliver-webhook', data);
  return job.id ?? 'unknown';
}
