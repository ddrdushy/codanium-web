// =============================================================================
// AI Team Studio — Webhook Delivery Worker (BullMQ)
// =============================================================================
// Processes webhook delivery jobs by POSTing signed payloads to registered
// external endpoints. Records delivery results in the WebhookDelivery table.
//
// Mirrors email-worker.ts pattern.
// =============================================================================

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from './connection';
import { WEBHOOK_QUEUE_NAME } from './webhook-queue';
import type { WebhookDeliveryJobData } from './webhook-queue';
import { prisma } from '@/lib/prisma';
import { signWebhookPayload } from '@/lib/webhooks/verify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DELIVERY_TIMEOUT_MS = 30_000; // 30 second timeout per delivery
const MAX_RESPONSE_BODY_LENGTH = 1024; // Store first 1KB of response

// ---------------------------------------------------------------------------
// Worker Singleton
// ---------------------------------------------------------------------------

let _worker: Worker<WebhookDeliveryJobData> | null = null;

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

/**
 * Process a single webhook delivery job.
 *
 * 1. Load endpoint from DB (URL + secret)
 * 2. Sign payload with HMAC-SHA256
 * 3. POST to endpoint URL
 * 4. Record delivery result
 */
async function processWebhookDelivery(job: Job<WebhookDeliveryJobData>): Promise<void> {
  const { endpointId, eventType, payload } = job.data;

  console.log(`[WebhookWorker] Processing job ${job.id}: ${eventType} → endpoint=${endpointId}`);

  // Load endpoint
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
    select: { url: true, secret: true, enabled: true },
  });

  if (!endpoint) {
    console.warn(`[WebhookWorker] Endpoint ${endpointId} not found, skipping`);
    return;
  }

  if (!endpoint.enabled) {
    console.warn(`[WebhookWorker] Endpoint ${endpointId} is disabled, skipping`);
    return;
  }

  // Sign the payload
  const signature = signWebhookPayload(payload, endpoint.secret);

  // Deliver
  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;
  let error: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'User-Agent': 'AI-Team-Studio-Webhook/1.0',
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    statusCode = response.status;

    // Read response body (first 1KB)
    try {
      const text = await response.text();
      responseBody = text.slice(0, MAX_RESPONSE_BODY_LENGTH);
    } catch {
      responseBody = null;
    }

    success = statusCode >= 200 && statusCode < 300;

    if (!success) {
      error = `HTTP ${statusCode}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown delivery error';

    if (error.includes('abort')) {
      error = `Timeout after ${DELIVERY_TIMEOUT_MS}ms`;
    }
  }

  const duration = Date.now() - startTime;

  // Record delivery
  await prisma.webhookDelivery.create({
    data: {
      endpointId,
      eventType,
      payload,
      statusCode,
      responseBody,
      duration,
      success,
      attempt: job.attemptsMade + 1,
      error,
    },
  });

  if (!success) {
    throw new Error(`Webhook delivery failed: ${error}`);
  }

  console.log(
    `[WebhookWorker] Delivered ${eventType} to ${endpoint.url} — ${statusCode} (${duration}ms)`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create and start the BullMQ webhook delivery worker.
 * Call once from worker-entrypoint.ts.
 */
export function createWebhookWorker(): Worker<WebhookDeliveryJobData> {
  if (_worker) return _worker;

  _worker = new Worker<WebhookDeliveryJobData>(
    WEBHOOK_QUEUE_NAME,
    processWebhookDelivery,
    {
      connection: getQueueConnection(),
      concurrency: 5, // 5 concurrent deliveries
    },
  );

  // ── Event Handlers ──────────────────────────────────────────────────────

  _worker.on('failed', (job, err) => {
    if (!job) return;
    console.error(
      `[WebhookWorker] Job ${job.id} failed (attempt ${job.attemptsMade}):`,
      err.message,
    );
  });

  _worker.on('completed', (job) => {
    console.log(`[WebhookWorker] Job ${job?.id} completed`);
  });

  _worker.on('error', (err) => {
    console.error('[WebhookWorker] Worker error:', err);
  });

  return _worker;
}
