// =============================================================================
// Codanium — Context Cache
// =============================================================================
// Simple in-memory TTL cache for frequently-accessed context sources.
// Stable sources like project_info, sdlc_stages, and agents_status rarely
// change between rapid agent calls (especially during delegation chains).
// This avoids redundant DB queries and saves ~50-100ms per chained call.
//
// Cache is invalidated after side effects modify project data.
// =============================================================================

interface CacheEntry {
  data: unknown;
  expires: number;
}

/** In-memory cache store keyed by "source:projectId" */
const cache = new Map<string, CacheEntry>();

/** Default TTL: 60 seconds */
const DEFAULT_TTL_MS = 60_000;

/**
 * Sources that are safe to cache (change infrequently during a conversation).
 * Do NOT cache: cards, chat_history, artifacts, decisions (change on every agent call).
 */
export const CACHEABLE_SOURCES = new Set([
  'project_info',
  'sdlc_stages',
  'agents_status',
  'wireframes',
]);

/**
 * Get a cached value if it exists and hasn't expired.
 */
export function getCached(source: string, projectId: string): unknown | null {
  const key = `${source}:${projectId}`;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store a value in cache with a TTL.
 */
export function setCache(source: string, projectId: string, data: unknown, ttlMs = DEFAULT_TTL_MS): void {
  const key = `${source}:${projectId}`;
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

/**
 * Invalidate all cached context for a project.
 * Call this after executeSideEffects() modifies project data.
 */
export function invalidateProjectCache(projectId: string): void {
  const prefix = `:${projectId}`;
  for (const key of cache.keys()) {
    if (key.endsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear the entire cache (e.g., on server restart).
 */
export function clearCache(): void {
  cache.clear();
}
