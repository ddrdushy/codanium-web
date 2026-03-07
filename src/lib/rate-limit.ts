import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ai/orchestration/graph/guardrails';

// ---------------------------------------------------------------------------
// Rate-Limit Configuration
// ---------------------------------------------------------------------------

/** Requests per window for different route categories. */
export const RATE_LIMITS = {
  /** GET endpoints — reads (60 req/min) */
  read: { maxRequests: 60, windowMs: 60_000 },
  /** POST/PATCH/DELETE — mutations (30 req/min) */
  mutation: { maxRequests: 30, windowMs: 60_000 },
  /** Auth endpoints — login/register (10 req/min, IP-based) */
  auth: { maxRequests: 10, windowMs: 60_000 },
  /** Webhook inbound endpoints — external services (120 req/min) */
  webhook: { maxRequests: 120, windowMs: 60_000 },
} as const;

type RateLimitCategory = keyof typeof RATE_LIMITS;

// ---------------------------------------------------------------------------
// rateLimit — Thin wrapper around guardrails checkRateLimit()
// ---------------------------------------------------------------------------

/**
 * Check if a user/IP has exceeded the rate limit for a given category.
 *
 * Returns `null` if the request is allowed.
 * Returns a `429 Too Many Requests` NextResponse if blocked.
 *
 * Reuses the Redis-backed sliding-window implementation from
 * `src/lib/ai/orchestration/graph/guardrails.ts` with per-endpoint keys.
 *
 * @param identifier — userId or IP address
 * @param category — rate limit tier (read, mutation, auth, webhook)
 * @param endpoint — optional route path for per-endpoint tracking
 */
export async function rateLimit(
  identifier: string,
  category: RateLimitCategory = 'read',
  endpoint?: string,
): Promise<NextResponse | null> {
  const { maxRequests, windowMs } = RATE_LIMITS[category];

  // Build a namespaced key so API rate limits don't collide with AI guardrails
  const key = endpoint
    ? `api:${category}:${endpoint}:${identifier}`
    : `api:${category}:${identifier}`;

  const isBlocked = await checkRateLimit(key, maxRequests, windowMs);

  if (isBlocked) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(windowMs / 1000)),
        },
      },
    );
  }

  return null;
}
