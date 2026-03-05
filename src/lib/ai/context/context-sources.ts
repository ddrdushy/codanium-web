// =============================================================================
// AI Team Studio — Context Sources
// =============================================================================
// Individual Prisma query functions for each ContextSource type.
// Each function fetches project-scoped data with minimal field selection
// to keep LLM context tokens compact.
// =============================================================================

import { prisma } from '@/lib/prisma';

/**
 * Fetch core project metadata.
 */
export async function fetchProjectInfo(projectId: string) {
  return prisma.project.findUnique({
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
}

/**
 * Fetch the SDLC pipeline stages in order.
 */
export async function fetchSDLCStages(projectId: string) {
  return prisma.sDLCStage.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    select: {
      name: true,
      order: true,
      status: true,
      gatePassed: true,
    },
  });
}

/**
 * Fetch board cards with owner agent info.
 * Limited to 30 most-recently-updated cards.
 */
export async function fetchCards(projectId: string) {
  return prisma.card.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      title: true,
      type: true,
      state: true,
      priority: true,
      description: true,
      ownerAgent: {
        select: {
          shortName: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Fetch pending and recent decisions with their options.
 */
export async function fetchDecisions(projectId: string) {
  return prisma.decision.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      trigger: true,
      status: true,
      riskRating: true,
      recommendation: true,
      approvedOption: true,
      options: {
        select: {
          name: true,
          description: true,
          pros: true,
          cons: true,
          risk: true,
          effort: true,
        },
      },
    },
  });
}

/**
 * Fetch project documents (metadata only — content is large).
 */
export async function fetchDocuments(projectId: string) {
  return prisma.document.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      wordCount: true,
      sections: true,
      owner: true,
    },
  });
}

/**
 * Fetch recent chat history for context injection.
 * Returns most recent messages first (caller should reverse for chronological order).
 */
export async function fetchChatHistory(projectId: string, limit: number = 30) {
  return prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      agent: {
        select: {
          shortName: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Fetch all agents and their current status for team awareness.
 */
export async function fetchAgentsStatus(projectId: string) {
  return prisma.agent.findMany({
    where: { projectId },
    orderBy: { shortName: 'asc' },
    select: {
      id: true,
      shortName: true,
      name: true,
      group: true,
      status: true,
      currentTask: true,
    },
  });
}

/**
 * Fetch aggregated LLM usage for budget awareness.
 * Returns last 50 usage records for cost/token context.
 */
export async function fetchLLMUsage(projectId: string) {
  return prisma.lLMUsage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      tokensUsed: true,
      cost: true,
      provider: true,
      model: true,
      agentName: true,
      createdAt: true,
    },
  });
}

/**
 * Fetch wireframes for UI/design context.
 */
export async function fetchWireframes(projectId: string) {
  return prisma.wireframe.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      screen: true,
      status: true,
      device: true,
      owner: true,
      components: true,
      version: true,
    },
  });
}
