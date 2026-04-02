// =============================================================================
// Codanium — Outbound Webhook Dispatcher
// =============================================================================
// When an EventBus event fires, this module finds all matching webhook
// endpoints for the project and queues delivery jobs via BullMQ.
// =============================================================================

import { prisma } from '@/lib/prisma';
import { addWebhookDeliveryJob } from '@/lib/queue/webhook-queue';
import type { SystemEvent } from '@/lib/ai/orchestration/types';

// ---------------------------------------------------------------------------
// Internal Events to Skip (never forward to external webhooks)
// ---------------------------------------------------------------------------

const INTERNAL_EVENTS = new Set([
  'notification.created',
  'webhook.delivery',
]);

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch an EventBus event to all matching outbound webhook endpoints.
 *
 * 1. Skip internal-only events
 * 2. Query all enabled webhook endpoints for the project
 * 3. Filter by event type matching (supports "*" wildcard)
 * 4. Queue a delivery job for each matching endpoint
 */
export async function dispatchWebhook(event: SystemEvent): Promise<void> {
  try {
    // Skip events without project context or internal events
    if (!event.projectId) return;
    if (INTERNAL_EVENTS.has(event.type)) return;

    // Find all enabled webhook endpoints for this project
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        projectId: event.projectId,
        enabled: true,
      },
      select: {
        id: true,
        events: true,
      },
    });

    if (endpoints.length === 0) return;

    // Build the payload once
    const payload = JSON.stringify({
      event: event.type,
      timestamp: event.timestamp ?? new Date().toISOString(),
      actor: event.actor,
      projectId: event.projectId,
      data: event.payload ?? {},
    });

    // Queue delivery jobs for matching endpoints
    for (const endpoint of endpoints) {
      const shouldDeliver = matchesEventFilter(event.type, endpoint.events);
      if (!shouldDeliver) continue;

      await addWebhookDeliveryJob({
        endpointId: endpoint.id,
        eventType: event.type,
        payload,
      });
    }
  } catch (err) {
    // Non-fatal — don't let webhook dispatch failures affect the event pipeline
    console.error('[WebhookDispatch] Error dispatching webhooks:', err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if an event type matches an endpoint's event filter.
 *
 * Supports:
 *   - `["*"]` — matches all events
 *   - `["pr.created", "build.complete"]` — exact match
 *   - `[]` (empty) — matches all events (default)
 */
function matchesEventFilter(eventType: string, filters: string[]): boolean {
  // Empty array or ["*"] means "all events"
  if (filters.length === 0) return true;
  if (filters.includes('*')) return true;
  return filters.includes(eventType);
}
