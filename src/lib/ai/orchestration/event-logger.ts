// =============================================================================
// Codanium — Event Logger (Persistent Event Tracking)
// =============================================================================
// Enterprise Spec §7.3 — Persists all significant system events to the
// database Event table. Provides the append-only event journal described
// in the specification (events.jsonl equivalent in PostgreSQL).
//
// Event types tracked:
//   - Phase transitions (FSM state changes)
//   - Document operations (create, update, approve, lock)
//   - Decision lifecycle (created, approved, rejected)
//   - Card state transitions
//   - Agent activations and completions
//   - Tool execution (success/failure)
//   - Output guard triggers
//   - LLM failures and fallbacks
// =============================================================================

import { prisma } from '@/lib/prisma';
import { eventBus } from './event-bus';

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

export type EventType =
  | 'phase.transition'
  | 'document.created'
  | 'document.updated'
  | 'document.approved'
  | 'document.locked'
  | 'document.section_saved'
  | 'decision.created'
  | 'decision.approved'
  | 'decision.rejected'
  | 'card.created'
  | 'card.transition'
  | 'agent.activated'
  | 'agent.completed'
  | 'agent.enqueued'
  | 'tool.executed'
  | 'tool.failed'
  | 'tool.blocked'
  | 'output_guard.triggered'
  | 'llm.failure'
  | 'llm.fallback'
  | 'ide.handover'
  | 'ide.heartbeat';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log a persistent event to the database and emit it on the event bus.
 * Non-blocking — errors are caught and logged, never thrown.
 */
export async function logEvent(
  projectId: string,
  type: EventType,
  actor: string,
  payload: Record<string, any> = {},
): Promise<void> {
  try {
    // Persist to DB
    await prisma.event.create({
      data: {
        type,
        actor,
        payload: JSON.stringify(payload),
        projectId,
      },
    });

    // Also emit on event bus for real-time subscribers
    eventBus.emit({
      type,
      actor,
      projectId,
      payload,
      timestamp: new Date(),
    }).catch(() => {}); // Non-blocking
  } catch (err) {
    console.error(`[EventLogger] Failed to log event ${type}:`, err);
  }
}

/**
 * Log a phase transition event.
 */
export async function logPhaseTransition(
  projectId: string,
  fromPhase: string,
  toPhase: string,
  trigger: string,
): Promise<void> {
  await logEvent(projectId, 'phase.transition', 'system', {
    from: fromPhase,
    to: toPhase,
    trigger,
  });
}

/**
 * Log a document operation event.
 */
export async function logDocumentEvent(
  projectId: string,
  type: 'document.created' | 'document.updated' | 'document.approved' | 'document.locked' | 'document.section_saved',
  actor: string,
  payload: { docType: string; documentId?: string; version?: number; sectionId?: string },
): Promise<void> {
  await logEvent(projectId, type, actor, payload);
}

/**
 * Log a decision lifecycle event.
 */
export async function logDecisionEvent(
  projectId: string,
  type: 'decision.created' | 'decision.approved' | 'decision.rejected',
  actor: string,
  payload: { decisionId: string; title?: string; trigger?: string },
): Promise<void> {
  await logEvent(projectId, type, actor, payload);
}

/**
 * Log a card state transition.
 */
export async function logCardTransition(
  projectId: string,
  actor: string,
  payload: { cardId: string; title?: string; fromState: string; toState: string },
): Promise<void> {
  await logEvent(projectId, 'card.transition', actor, payload);
}

/**
 * Log a tool execution event (success or failure).
 */
export async function logToolExecution(
  projectId: string,
  agent: string,
  payload: { tool: string; success: boolean; error?: string; durationMs?: number },
): Promise<void> {
  const type = payload.success ? 'tool.executed' : 'tool.failed';
  await logEvent(projectId, type, agent, payload);
}

/**
 * Log an LLM failure or fallback event.
 */
export async function logLLMEvent(
  projectId: string,
  type: 'llm.failure' | 'llm.fallback',
  payload: { provider: string; model?: string; error?: string; fallbackProvider?: string },
): Promise<void> {
  await logEvent(projectId, type, 'system', payload);
}

/**
 * Query events for a project, optionally filtered by type.
 */
export async function getProjectEvents(
  projectId: string,
  options: { type?: string; limit?: number; offset?: number } = {},
): Promise<Array<{ id: string; type: string; actor: string; payload: any; createdAt: Date }>> {
  const events = await prisma.event.findMany({
    where: {
      projectId,
      ...(options.type ? { type: options.type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit || 50,
    skip: options.offset || 0,
  });

  return events.map((e) => ({
    ...e,
    payload: JSON.parse(e.payload || '{}'),
  }));
}
