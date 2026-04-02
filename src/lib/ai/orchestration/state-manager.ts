// =============================================================================
// Codanium — Agent State Manager
// =============================================================================
// Manages agent lifecycle status transitions in the database.
// Each agent has a status (IDLE, WORKING, WAITING, BLOCKED) and an optional
// currentTask string describing what it's currently doing.
//
// Uses updateMany with (projectId + shortName) compound filter to avoid
// needing the agent's primary key, which isn't always available at call sites.
// =============================================================================

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// AgentStateManager
// ---------------------------------------------------------------------------

export class AgentStateManager {
  /**
   * Transition an agent to WORKING status with a task description.
   */
  async setWorking(projectId: string, shortName: string, task: string): Promise<void> {
    await prisma.agent.updateMany({
      where: { projectId, shortName },
      data: { status: 'WORKING', currentTask: task },
    });
  }

  /**
   * Transition an agent to IDLE status, clearing its task.
   */
  async setIdle(projectId: string, shortName: string): Promise<void> {
    await prisma.agent.updateMany({
      where: { projectId, shortName },
      data: { status: 'IDLE', currentTask: null },
    });
  }

  /**
   * Transition an agent to WAITING status (e.g. waiting on a decision or another agent).
   */
  async setWaiting(projectId: string, shortName: string, reason: string): Promise<void> {
    await prisma.agent.updateMany({
      where: { projectId, shortName },
      data: { status: 'WAITING', currentTask: reason },
    });
  }

  /**
   * Transition an agent to BLOCKED status (e.g. missing info, dependency unresolved).
   */
  async setBlocked(projectId: string, shortName: string, reason: string): Promise<void> {
    await prisma.agent.updateMany({
      where: { projectId, shortName },
      data: { status: 'BLOCKED', currentTask: reason },
    });
  }

  /**
   * Set agent status to an arbitrary value.
   * Useful when the desired status comes from parsed action data.
   */
  async setStatus(
    projectId: string,
    shortName: string,
    status: 'IDLE' | 'WORKING' | 'WAITING' | 'BLOCKED',
    task: string | null = null,
  ): Promise<void> {
    await prisma.agent.updateMany({
      where: { projectId, shortName },
      data: { status, currentTask: task },
    });
  }

  /**
   * Retrieve a single agent record by project + shortName.
   * Returns null if no matching agent exists.
   */
  async getAgent(projectId: string, shortName: string) {
    return prisma.agent.findFirst({
      where: { projectId, shortName },
      select: {
        id: true,
        name: true,
        shortName: true,
        group: true,
        status: true,
        currentTask: true,
      },
    });
  }

  /**
   * Bulk-reset all agents in a project to IDLE.
   * Useful for project resets or error recovery.
   */
  async resetAll(projectId: string): Promise<void> {
    await prisma.agent.updateMany({
      where: { projectId },
      data: { status: 'IDLE', currentTask: null },
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const agentStateManager = new AgentStateManager();
