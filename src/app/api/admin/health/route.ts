import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { redis, isRedisAvailable } from '@/lib/redis';
import { getOrchestrationQueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/health
 * Returns system health metrics: database table counts, task queue status,
 * Redis status, BullMQ queue metrics, LLM stats, and recent errors.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    // Run all queries in parallel for performance
    const [
      usersCount,
      projectsCount,
      agentsCount,
      orchestrationRunsCount,
      eventsCount,
      deploymentPipelinesCount,
      deploymentRunsCount,
      pendingRuns,
      runningRuns,
      completedRuns,
      failedRuns,
      totalLlmCalls,
      llmCostAggregate,
      recentErrors,
    ] = await Promise.all([
      // Database table counts
      prisma.user.count(),
      prisma.project.count(),
      prisma.agent.count(),
      prisma.orchestrationRun.count(),
      prisma.event.count(),
      prisma.deploymentPipeline.count(),
      prisma.deploymentRun.count(),

      // Task queue status (OrchestrationRun by status)
      prisma.orchestrationRun.count({ where: { status: 'PENDING' } }),
      prisma.orchestrationRun.count({ where: { status: 'RUNNING' } }),
      prisma.orchestrationRun.count({ where: { status: 'COMPLETED' } }),
      prisma.orchestrationRun.count({ where: { status: 'FAILED' } }),

      // Platform-wide LLM stats
      prisma.lLMUsage.count(),
      prisma.lLMUsage.aggregate({ _sum: { actualCost: true } }),

      // Recent errors: last 10 failed orchestration runs
      prisma.orchestrationRun.findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          userMessage: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
    ]);

    // ── Redis + BullMQ Metrics ────────────────────────────────────────────

    let redisStatus: Record<string, unknown> = { status: 'unavailable' };
    let bullmqMetrics: Record<string, unknown> = {};

    try {
      const redisUp = await isRedisAvailable();
      if (redisUp) {
        const memInfo = await redis.info('memory');
        const usedMemoryMatch = memInfo.match(/used_memory_human:(\S+)/);
        const connectedClientsMatch = memInfo.match(/connected_clients:(\d+)/) ??
          (await redis.info('clients')).match(/connected_clients:(\d+)/);

        redisStatus = {
          status: 'healthy',
          usedMemory: usedMemoryMatch?.[1] ?? 'unknown',
          connectedClients: connectedClientsMatch
            ? parseInt(connectedClientsMatch[1], 10)
            : 'unknown',
        };

        // BullMQ queue metrics
        const queue = getOrchestrationQueue();
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

        bullmqMetrics = { waiting, active, completed, failed, delayed };
      }
    } catch (err) {
      redisStatus = {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    return NextResponse.json({
      database: {
        status: 'healthy',
        tables: {
          users: usersCount,
          projects: projectsCount,
          agents: agentsCount,
          orchestrationRuns: orchestrationRunsCount,
          events: eventsCount,
          deploymentPipelines: deploymentPipelinesCount,
          deploymentRuns: deploymentRunsCount,
        },
      },
      taskQueue: {
        pending: pendingRuns,
        running: runningRuns,
        completed: completedRuns,
        failed: failedRuns,
      },
      redis: redisStatus,
      bullmq: bullmqMetrics,
      platform: {
        totalLlmCalls: totalLlmCalls,
        totalLlmCost: llmCostAggregate._sum?.actualCost ?? 0,
        uptime: process.uptime(),
      },
      recentErrors,
    });
  } catch (error) {
    console.error('GET /api/admin/health error:', error);

    // If the database query itself failed, report unhealthy
    return NextResponse.json(
      {
        database: { status: 'unhealthy', error: 'Database query failed' },
        taskQueue: { pending: 0, running: 0, completed: 0, failed: 0 },
        redis: { status: 'unknown' },
        bullmq: {},
        platform: { totalLlmCalls: 0, totalLlmCost: 0, uptime: process.uptime() },
        recentErrors: [],
      },
      { status: 500 }
    );
  }
}
