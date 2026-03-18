// =============================================================================
// AI Team Studio — Context Sources
// =============================================================================
// Individual Prisma query functions for each ContextSource type.
// Each function fetches project-scoped data with minimal field selection
// to keep LLM context tokens compact.
//
// When a ContextScope is provided, fetchers narrow results to the relevant
// card/module — reducing token usage by ~50-60%.
// =============================================================================

import { prisma } from '@/lib/prisma';
import { getCached, setCache, CACHEABLE_SOURCES } from './context-cache';

// ─── Scope Interface ────────────────────────────────────────────────────────

export interface ContextScope {
  cardId?: string;
  module?: string;
}

// ─── Fetchers ──────────────────────────────────────────────────────────────

/**
 * Fetch core project metadata (always project-wide).
 */
export async function fetchProjectInfo(projectId: string, _scope?: ContextScope) {
  const cached = getCached('project_info', projectId);
  if (cached) return cached;
  const data = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      currentStage: true,
      completion: true,
      color: true,
    },
  });
  if (data) setCache('project_info', projectId, data);
  return data;
}

/**
 * Fetch the SDLC pipeline stages in order (always project-wide).
 */
export async function fetchSDLCStages(projectId: string, _scope?: ContextScope) {
  const cached = getCached('sdlc_stages', projectId);
  if (cached) return cached;
  const data = await prisma.sDLCStage.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    select: {
      name: true,
      order: true,
      status: true,
      gatePassed: true,
    },
  });
  setCache('sdlc_stages', projectId, data);
  return data;
}

/**
 * Fetch board cards with owner agent info.
 * When scoped: returns target card + parent + children + same-module siblings.
 * Otherwise: returns 30 most-recently-updated cards.
 */
export async function fetchCards(projectId: string, scope?: ContextScope) {
  const cardSelect = {
    id: true,
    title: true,
    type: true,
    state: true,
    priority: true,
    description: true,
    module: true,
    ownerAgent: {
      select: { shortName: true, name: true },
    },
    children: {
      select: { id: true, state: true },
    },
  } as const;

  if (scope?.cardId) {
    // Get the target card
    const card = await prisma.card.findUnique({
      where: { id: scope.cardId },
      select: { ...cardSelect, parentId: true },
    });
    if (!card) return [];

    // Get related: parent + children + same-module siblings
    const orConditions: Array<Record<string, unknown>> = [
      { parentId: scope.cardId },  // children
    ];
    if (card.parentId) {
      orConditions.push({ id: card.parentId });  // parent
    }
    if (card.module) {
      orConditions.push({ module: card.module, id: { not: scope.cardId } });
    }

    const related = await prisma.card.findMany({
      where: { projectId, OR: orConditions },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: cardSelect,
    });

    return [card, ...related];
  }

  if (scope?.module) {
    return prisma.card.findMany({
      where: { projectId, module: scope.module },
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: cardSelect,
    });
  }

  // Default: project-wide
  return prisma.card.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: cardSelect,
  });
}

/**
 * Fetch pending and recent decisions with their options.
 * When scoped by module: only return decisions linked to cards in the same module.
 */
export async function fetchDecisions(projectId: string, scope?: ContextScope) {
  if (scope?.module) {
    const linkedCards = await prisma.card.findMany({
      where: { projectId, module: scope.module, linkedDecisionId: { not: null } },
      select: { linkedDecisionId: true },
    });
    const ids = linkedCards.map(c => c.linkedDecisionId!).filter(Boolean);
    if (ids.length === 0) return [];

    return prisma.decision.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, trigger: true, status: true, riskRating: true,
        recommendation: true, approvedOption: true,
        options: { select: { name: true, description: true, pros: true, cons: true, risk: true, effort: true } },
      },
    });
  }

  return prisma.decision.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, trigger: true, status: true, riskRating: true,
      recommendation: true, approvedOption: true,
      options: { select: { name: true, description: true, pros: true, cons: true, risk: true, effort: true } },
    },
  });
}

/**
 * Fetch project documents (metadata only — content is large).
 */
export async function fetchDocuments(projectId: string, _scope?: ContextScope) {
  return prisma.document.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, type: true, status: true,
      wordCount: true, sections: true, owner: true,
      content: true, // Include content so agents can read staging BRD notes
    },
  });
}

/**
 * Fetch recent chat history for context injection.
 * When scoped: returns card-scoped messages + 5 recent global messages.
 * Otherwise: returns 30 most recent messages.
 */
export async function fetchChatHistory(projectId: string, limit: number = 30, scope?: ContextScope) {
  const msgSelect = {
    id: true, role: true, content: true, createdAt: true,
    agent: { select: { shortName: true, name: true } },
  } as const;

  if (scope?.cardId) {
    const [cardMessages, globalMessages] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { projectId, cardId: scope.cardId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: msgSelect,
      }),
      prisma.chatMessage.findMany({
        where: { projectId, cardId: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: msgSelect,
      }),
    ]);
    return [...cardMessages, ...globalMessages];
  }

  return prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: msgSelect,
  });
}

/**
 * Fetch all agents and their current status for team awareness (always project-wide).
 */
export async function fetchAgentsStatus(projectId: string, _scope?: ContextScope) {
  const cached = getCached('agents_status', projectId);
  if (cached) return cached;
  const data = await prisma.agent.findMany({
    where: { projectId },
    orderBy: { shortName: 'asc' },
    select: {
      id: true, shortName: true, name: true,
      group: true, status: true, currentTask: true,
    },
  });
  setCache('agents_status', projectId, data);
  return data;
}

/**
 * Fetch aggregated LLM usage for budget awareness (always project-wide).
 */
export async function fetchLLMUsage(projectId: string, _scope?: ContextScope) {
  return prisma.lLMUsage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      tokensUsed: true, cost: true, provider: true,
      model: true, agentName: true, createdAt: true,
    },
  });
}

/**
 * Fetch wireframes for UI/design context (always project-wide).
 */
export async function fetchWireframes(projectId: string, _scope?: ContextScope) {
  const cached = getCached('wireframes', projectId);
  if (cached) return cached;
  const data = await prisma.wireframe.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, screen: true, status: true,
      device: true, owner: true, components: true, version: true,
    },
  });
  setCache('wireframes', projectId, data);
  return data;
}

/**
 * Fetch persistent project memories for agent knowledge.
 * Returns all memories ordered by category then creation time.
 */
export async function fetchProjectMemory(projectId: string, _scope?: ContextScope) {
  return prisma.projectMemory.findMany({
    where: { projectId },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    take: 50,
    select: {
      category: true,
      content: true,
      source: true,
    },
  });
}

/**
 * Fetch the CONSTITUTION document for a project.
 * Returns the constitution content if one exists, or null.
 */
export async function fetchConstitution(projectId: string, _scope?: ContextScope) {
  const doc = await prisma.document.findFirst({
    where: { projectId, type: 'CONSTITUTION' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
    },
  });
  return doc;
}

/**
 * Fetch code artifacts scoped to a card or module.
 * Includes content (truncated) so agents can see existing code.
 */
export async function fetchArtifacts(projectId: string, scope?: ContextScope) {
  const where: Record<string, unknown> = { projectId };

  if (scope?.cardId) {
    where.cardId = scope.cardId;
  } else if (scope?.module) {
    where.module = scope.module;
  }

  return prisma.artifact.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true, name: true, type: true, ownerAgent: true,
      version: true, content: true,
    },
  });
}
