// =============================================================================
// AI Team Studio — In-Process Event Bus
// =============================================================================
// Lightweight pub/sub for system events (agent transitions, action execution,
// delegation chains, errors, etc.). Runs entirely in-process — no Redis or
// external message broker required.
//
// Features:
//   - Type-specific handlers: bus.on('agent.started', handler)
//   - Wildcard handlers:      bus.on('*', handler)  — receives ALL events
//   - Async handlers:         handlers can return Promises; errors are caught
//   - Auto-timestamping:      events get a timestamp if not already set
//
// Future: Add optional persistence to an Event table for audit trails and
// replay capability when the schema is extended.
// =============================================================================

import { SystemEvent } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventHandler = (event: SystemEvent) => void | Promise<void>;

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  /**
   * Register a handler for a specific event type.
   * Use '*' to listen to all events.
   *
   * @param eventType  Event type key (e.g. "agent.started") or "*" for all.
   * @param handler    Callback invoked when a matching event is emitted.
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
   * Emit an event. All matching handlers (type-specific + wildcard)
   * are invoked sequentially. Handler errors are caught and logged
   * so one broken handler never blocks the pipeline.
   *
   * @param event  The system event to emit.
   */
  async emit(event: SystemEvent): Promise<void> {
    // Auto-timestamp if not already set
    event.timestamp = event.timestamp ?? new Date();

    // Collect all applicable handlers
    const typeHandlers = this.handlers.get(event.type) ?? [];
    const wildcardHandlers = this.handlers.get('*') ?? [];
    const allHandlers = [...typeHandlers, ...wildcardHandlers];

    // Invoke sequentially — order matters for audit consistency
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
