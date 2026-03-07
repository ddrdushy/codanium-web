import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { addOrchestrationJob } from '@/lib/queue';
import { isRedisAvailable } from '@/lib/redis';

export class TaskQueue {
  async enqueue(params: {
    projectId: string;
    userId: string;
    userMessage: string;
    targetAgent: string;
    autoRouted: boolean;
    isBackground: boolean;
    priority?: number;
    parentRunId?: string;
    cardId?: string;
  }): Promise<string> {
    // 1. Always create the Postgres record first (source of truth)
    const run = await prisma.orchestrationRun.create({
      data: {
        status: 'PENDING',
        userMessage: params.userMessage,
        routedTo: params.targetAgent,
        autoRouted: params.autoRouted,
        projectId: params.projectId,
        userId: params.userId,
        isBackground: params.isBackground,
        priority: params.priority ?? 0,
        parentRunId: params.parentRunId ?? null,
        cardId: params.cardId ?? null,
      },
    });

    // 2. If background task AND Redis is available, dispatch via BullMQ
    if (params.isBackground) {
      try {
        const redisUp = await isRedisAvailable();
        if (redisUp) {
          await addOrchestrationJob(
            {
              runId: run.id,
              projectId: params.projectId,
              userId: params.userId,
            },
            {
              priority: params.priority,
            },
          );
        }
        // If Redis is down, the job stays PENDING in Postgres.
        // The fallback polling mechanism (process-tasks endpoint) can pick it up.
      } catch (err) {
        console.warn('[TaskQueue] Failed to dispatch to BullMQ, falling back to Postgres polling:', err);
      }
    }

    return run.id;
  }

  async claimNext(projectId?: string): Promise<any | null> {
    // Use raw SQL for atomic claim with SKIP LOCKED
    const conditions = projectId
      ? Prisma.sql`AND "projectId" = ${projectId}`
      : Prisma.empty;

    const result: any[] = await prisma.$queryRaw`
      UPDATE orchestration_runs
      SET status = 'RUNNING', "startedAt" = NOW()
      WHERE id = (
        SELECT id FROM orchestration_runs
        WHERE status = 'PENDING'
          AND "scheduledAt" <= NOW()
          AND "isBackground" = true
          ${conditions}
        ORDER BY priority DESC, "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;
    return result[0] ?? null;
  }

  async complete(runId: string, data: {
    tokensTotal?: number;
    costTotal?: number;
    latencyMs?: number;
    delegations?: string[];
  }): Promise<void> {
    await prisma.orchestrationRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        tokensTotal: data.tokensTotal ?? 0,
        costTotal: data.costTotal ?? 0,
        latencyMs: data.latencyMs ?? 0,
        delegations: data.delegations ?? [],
      },
    });
  }

  async fail(runId: string, error: string): Promise<void> {
    const run = await prisma.orchestrationRun.findUnique({ where: { id: runId } });
    if (!run) return;

    if (run.retryCount < run.maxRetries) {
      const backoffMs = Math.pow(2, run.retryCount) * 1000;
      await prisma.orchestrationRun.update({
        where: { id: runId },
        data: {
          status: 'PENDING',
          retryCount: { increment: 1 },
          scheduledAt: new Date(Date.now() + backoffMs),
          errorMessage: error,
          startedAt: null,
        },
      });
    } else {
      await prisma.orchestrationRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error,
        },
      });
    }
  }

  async cancel(runId: string): Promise<void> {
    await prisma.orchestrationRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  async getStatus(runId: string) {
    return prisma.orchestrationRun.findUnique({
      where: { id: runId },
      select: {
        id: true, status: true, routedTo: true,
        tokensTotal: true, latencyMs: true,
        errorMessage: true, createdAt: true,
        startedAt: true, completedAt: true,
        retryCount: true, isBackground: true,
      },
    });
  }

  async getActiveTasks(projectId: string) {
    return prisma.orchestrationRun.findMany({
      where: { projectId, status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getRecentTasks(projectId: string, limit = 20) {
    return prisma.orchestrationRun.findMany({
      where: { projectId, status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] } },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
  }
}

export const taskQueue = new TaskQueue();
