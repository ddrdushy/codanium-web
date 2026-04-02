// =============================================================================
// Codanium — Redis Client Singleton
// =============================================================================
// Shared ioredis client for caching, BullMQ queue, rate limiting, and pub/sub.
// Follows the same singleton pattern as src/lib/prisma.ts.
//
// If Redis is unavailable, all consumers fall back gracefully to in-memory or
// PostgreSQL-based alternatives. The `isRedisAvailable()` helper lets callers
// check connectivity before attempting Redis operations.
// =============================================================================

import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Singleton (survives HMR in development)
// ---------------------------------------------------------------------------

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  const client = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ workers
    enableReadyCheck: true,
    lazyConnect: true, // Don't crash on startup if Redis is down
    retryStrategy(times: number) {
      if (times > 10) return null; // Stop retrying after 10 attempts
      return Math.min(times * 200, 5000); // 200ms, 400ms, ... up to 5s
    },
  });

  client.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  return client;
}

export const redis: Redis =
  globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Non-throwing connectivity check. Returns true if Redis responds to PING.
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export default redis;
