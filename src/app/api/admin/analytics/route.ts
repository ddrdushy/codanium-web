import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics
 * Returns LLM usage data with pagination, date range, and provider filtering.
 * Query params: ?page=1&limit=100&from=2025-01-01&to=2025-12-31&provider=openai
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)));
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const provider = searchParams.get('provider');

    const where: Record<string, unknown> = {};

    // Date range filter
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

    // Provider filter (case-insensitive match)
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

    // Map to frontend format
    const usage = usageRecords.map((r) => ({
      date: r.createdAt.toISOString().split('T')[0],
      tokens_used: r.tokensUsed,
      cost: r.cost,
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
  } catch (error) {
    console.error('GET /api/admin/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
