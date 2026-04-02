// =============================================================================
// Codanium — BullMQ Redis Connection Factory
// =============================================================================
// BullMQ manages its own ioredis connections internally. This module provides
// a ConnectionOptions factory that both Queue and Worker instances share.
// =============================================================================

import type { ConnectionOptions } from 'bullmq';

/**
 * Returns BullMQ-compatible Redis connection options derived from REDIS_URL.
 */
export function getQueueConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  // Parse the URL into host/port/password for BullMQ
  // ioredis ConnectionOptions can accept a URL directly when passed as string,
  // but BullMQ expects the ConnectionOptions object form.
  const parsed = new URL(url);

  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
  };
}
