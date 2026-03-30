import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics
 * Returns aggregated LLM usage analytics: daily usage, by agent, by provider,
 * top projects, and totals. All data comes from real DB queries.
 *
 * Also supports legacy flat-list mode via ?mode=list for backward compatibility.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    // ── Legacy list mode (backward compat with existing fetchAnalytics) ──
    if (mode === 'list') {
      return handleListMode(searchParams);
    }

    // ── Aggregated analytics mode (default) ──

    // Daily usage (last 30 days), grouped by provider
    const dailyUsage = await prisma.$queryRaw`
      SELECT
        DATE("createdAt") as date,
        provider,
        SUM("tokensUsed")::int as tokens,
        SUM("actualCost")::float as cost
      FROM llm_usage
      WHERE "createdAt" > NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt"), provider
      ORDER BY date
    `;

    // By agent breakdown
    const byAgent = await prisma.$queryRaw`
      SELECT
        "agentName" as agent,
        SUM("tokensUsed")::int as tokens,
        SUM("actualCost")::float as cost,
        COUNT(*)::int as calls
      FROM llm_usage
      GROUP BY "agentName"
      ORDER BY tokens DESC
    `;

    // By provider and model
    const byProvider = await prisma.$queryRaw`
      SELECT
        provider,
        model,
        SUM("tokensUsed")::int as tokens,
        SUM("actualCost")::float as cost,
        COUNT(*)::int as calls
      FROM llm_usage
      GROUP BY provider, model
      ORDER BY tokens DESC
    `;

    // Top 10 projects by token usage
    const topProjects = await prisma.$queryRaw`
      SELECT
        u."projectId" as project_id,
        p.name as project_name,
        SUM(u."tokensUsed")::int as tokens,
        SUM(u."actualCost")::float as cost
      FROM llm_usage u
      LEFT JOIN projects p ON p.id = u."projectId"
      GROUP BY u."projectId", p.name
      ORDER BY tokens DESC
      LIMIT 10
    `;

    // Totals
    const totals = await prisma.lLMUsage.aggregate({
      _sum: { tokensUsed: true, actualCost: true },
      _count: true,
    });

    return NextResponse.json({
      dailyUsage,
      byAgent,
      byProvider,
      topProjects,
      totals: {
        tokens: totals._sum?.tokensUsed ?? 0,
        cost: totals._sum?.actualCost ?? 0,
        totalCalls: totals._count,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

// ── Legacy list handler (keeps old flat-list API working) ──
async function handleListMode(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)));
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const provider = searchParams.get('provider');

  const where: Record<string, unknown> = {};

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) {
      createdAt.gte = new Date(from);
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      createdAt.lte = toDate;
    }
    where.createdAt = createdAt;
  }

  if (provider) {
    where.provider = { equals: provider, mode: 'insensitive' };
  }

  const [usageRecords, total] = await Promise.all([
    prisma.lLMUsage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.lLMUsage.count({ where }),
  ]);

  const usage = usageRecords.map((r) => ({
    date: r.createdAt.toISOString().split('T')[0],
    tokens_used: r.tokensUsed,
    prompt_tokens: r.promptTokens,
    completion_tokens: r.completionTokens,
    context_tokens: r.contextTokens,
    cost: r.actualCost,
    provider: r.provider.toLowerCase(),
    model: r.model,
    agent_name: r.agentName,
    project_id: r.projectId,
    project_name: r.project.name,
  }));

  return NextResponse.json({
    usage,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
