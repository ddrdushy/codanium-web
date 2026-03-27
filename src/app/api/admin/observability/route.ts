import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/observability
 * Returns deep observability metrics:
 *  - latencyPercentiles: p50/p95/p99 of OrchestrationRun.latencyMs by day (30d)
 *  - errorRates: success/fail counts by day (30d)
 *  - agentPerf: per-agent avg latency, p95, success rate, avg tokens/call
 *  - queueThroughput: completed+failed runs per day (30d)
 *  - topErrors: most common error messages (last 7d)
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const [
      latencyByDay,
      errorRateByDay,
      agentPerf,
      topErrors,
      totals,
    ] = await Promise.all([

      // Latency percentiles per day (last 30 days) — approximate p50/p95/p99
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "latencyMs") AS p50,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs") AS p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "latencyMs") AS p99,
          COUNT(*)::int AS total,
          AVG("latencyMs")::float AS avg_ms
        FROM orchestration_runs
        WHERE
          "createdAt" > NOW() - INTERVAL '30 days'
          AND "latencyMs" > 0
          AND status IN ('COMPLETED', 'FAILED')
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,

      // Error rate by day — success vs fail counts (last 30 days)
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS success,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int    AS failed,
          COUNT(*) FILTER (WHERE status = 'TIMEOUT')::int   AS timeout,
          COUNT(*)::int AS total
        FROM orchestration_runs
        WHERE "createdAt" > NOW() - INTERVAL '30 days'
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,

      // Per-agent performance
      prisma.$queryRaw`
        SELECT
          "routedTo" AS agent,
          COUNT(*)::int AS total_runs,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int    AS failed,
          ROUND(AVG("latencyMs") FILTER (WHERE "latencyMs" > 0))::int AS avg_latency_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (
            ORDER BY "latencyMs"
          ) FILTER (WHERE "latencyMs" > 0) AS p95_latency_ms,
          ROUND(AVG("tokensTotal") FILTER (WHERE "tokensTotal" > 0))::int AS avg_tokens
        FROM orchestration_runs
        GROUP BY "routedTo"
        ORDER BY total_runs DESC
        LIMIT 20
      `,

      // Top error messages (last 7 days)
      prisma.$queryRaw`
        SELECT
          COALESCE("errorMessage", 'Unknown error') AS error_message,
          COUNT(*)::int AS count
        FROM orchestration_runs
        WHERE
          status = 'FAILED'
          AND "createdAt" > NOW() - INTERVAL '7 days'
        GROUP BY "errorMessage"
        ORDER BY count DESC
        LIMIT 10
      `,

      // Overall totals
      prisma.orchestrationRun.aggregate({
        _count: true,
        _avg:   { latencyMs: true, tokensTotal: true },
        where:  { latencyMs: { gt: 0 } },
      }),
    ]);

    // Success rate overall
    const [completedCount, failedCount] = await Promise.all([
      prisma.orchestrationRun.count({ where: { status: 'COMPLETED' } }),
      prisma.orchestrationRun.count({ where: { status: 'FAILED' } }),
    ]);
    const totalRuns     = completedCount + failedCount;
    const successRate   = totalRuns > 0 ? Math.round((completedCount / totalRuns) * 100) : 100;

    return NextResponse.json({
      latencyByDay,
      errorRateByDay,
      agentPerf,
      topErrors,
      summary: {
        totalRuns,
        completedRuns:  completedCount,
        failedRuns:     failedCount,
        successRate,
        avgLatencyMs:   Math.round(totals._avg?.latencyMs ?? 0),
        avgTokensPerRun: Math.round(totals._avg?.tokensTotal ?? 0),
      },
    });
  } catch (err) {
    console.error('GET /api/admin/observability error:', err);
    return NextResponse.json({ error: 'Failed to fetch observability data' }, { status: 500 });
  }
}
