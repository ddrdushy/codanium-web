// =============================================================================
// Codanium — Event Bus with Redis Pub/Sub
// =============================================================================
// Lightweight pub/sub for system events (agent transitions, action execution,
// delegation chains, errors, etc.) with optional Redis pub/sub for cross-
// container event propagation.
//
// Features:
//   - Type-specific handlers: bus.on('agent.started', handler)
//   - Wildcard handlers:      bus.on('*', handler)  — receives ALL events
//   - Async handlers:         handlers can return Promises; errors are caught
//   - Auto-timestamping:      events get a timestamp if not already set
//   - Redis pub/sub:          events propagate across app + worker containers
//
// When Redis is available, emit() publishes to a Redis channel so all
// containers receive every event. A _source field prevents re-processing
// events that originated from the same process.
// =============================================================================

import { SystemEvent } from './types';
import { redis, isRedisAvailable } from '@/lib/redis';
import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REDIS_CHANNEL = 'ats:events';

/** Unique identifier for this process (to skip self-originated events) */
const processId = `${process.pid}-${Date.now()}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventHandler = (event: SystemEvent) => void | Promise<void>;

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private subscriber: Redis | null = null;
  private subscriberReady = false;

  /**
   * Register a handler for a specific event type.
   * Use '*' to listen to all events.
   */
  on(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  /**
   * Unregister a previously registered handler.
   */
  off(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType);
    if (!existing) return;
    this.handlers.set(
      eventType,
      existing.filter((h) => h !== handler),
    );
  }

  /**
   * Register a handler that fires only once for the given event type,
   * then automatically unregisters itself.
   */
  once(eventType: string, handler: EventHandler): void {
    const wrapper: EventHandler = async (event) => {
      this.off(eventType, wrapper);
      await handler(event);
    };
    this.on(eventType, wrapper);
  }

  /**
   * Initialize Redis pub/sub subscription for cross-container events.
   * Call once at startup in both app and worker containers.
   * Non-fatal — if Redis is unavailable, EventBus works in local-only mode.
   */
  async initRedisSubscriber(): Promise<void> {
    try {
      const redisUp = await isRedisAvailable();
      if (!redisUp) return;

      // Redis requires a dedicated connection for subscriptions
      const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
      this.subscriber = new Redis(url, {
        maxRetriesPerRequest: null,
        lazyConnect: false,
      });

      await this.subscriber.subscribe(REDIS_CHANNEL);

      this.subscriber.on('message', async (channel: string, message: string) => {
        if (channel !== REDIS_CHANNEL) return;

        try {
          const event = JSON.parse(message) as SystemEvent & { _source?: string };

          // Skip events that originated from this process (avoid double-handling)
          if (event._source === processId) return;

          // Dispatch to local handlers only (don't re-publish)
          await this.dispatchLocal(event);
        } catch (err) {
          console.error('[EventBus] Failed to handle Redis message:', err);
        }
      });

      this.subscriberReady = true;
      console.log('[EventBus] Redis subscriber initialized');
    } catch (err) {
      console.warn('[EventBus] Redis subscriber init failed, running in local-only mode:', err);
    }
  }

  /**
   * Dispatch event to local handlers only (no Redis publish).
   * Used by the subscriber to avoid re-publish loops.
   */
  private async dispatchLocal(event: SystemEvent): Promise<void> {
    event.timestamp = event.timestamp ?? new Date();

    const typeHandlers = this.handlers.get(event.type) ?? [];
    const wildcardHandlers = this.handlers.get('*') ?? [];
    const allHandlers = [...typeHandlers, ...wildcardHandlers];

    for (const handler of allHandlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(
          `[EventBus] Handler error for event "${event.type}":`,
          err,
        );
      }
    }
  }

  /**
   * Emit an event. All matching handlers (type-specific + wildcard)
   * are invoked sequentially. Handler errors are caught and logged
   * so one broken handler never blocks the pipeline.
   *
   * If Redis pub/sub is active, also publishes to the Redis channel
   * for cross-container propagation.
   */
  async emit(event: SystemEvent): Promise<void> {
    // Auto-timestamp if not already set
    event.timestamp = event.timestamp ?? new Date();

    // 1. Dispatch to local handlers
    await this.dispatchLocal(event);

    // 2. Publish to Redis channel (best-effort, non-blocking)
    if (this.subscriberReady) {
      try {
        await redis.publish(
          REDIS_CHANNEL,
          JSON.stringify({ ...event, _source: processId }),
        );
      } catch {
        // Non-fatal — local handlers already ran
      }
    }
  }

  /**
   * Remove all handlers for a specific event type, or all handlers if
   * no type is provided.
   */
  clear(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Return the count of registered handlers for a specific event type.
   * Useful for testing and diagnostics.
   */
  listenerCount(eventType: string): number {
    return (this.handlers.get(eventType) ?? []).length;
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const eventBus = new EventBus();
