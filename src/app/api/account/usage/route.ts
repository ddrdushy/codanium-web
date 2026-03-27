import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/usage
 * Returns the current user's LLM usage history with summary stats.
 * Supports pagination + filters: from, to, provider, billingType
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const userId = (session as any).user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip  = (page - 1) * limit;
    const from  = searchParams.get('from');
    const to    = searchParams.get('to');
    const provider    = searchParams.get('provider');
    const billingType = searchParams.get('billingType'); // PLATFORM | BYOK

    const where: Record<string, unknown> = { userId };
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }
    if (provider)    where.provider    = provider;
    if (billingType) where.billingType = billingType;

    const [records, total, summary] = await Promise.all([
      prisma.lLMUsage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          provider: true,
          model: true,
          tokensUsed: true,
          actualCost: true,
          markedUpCost: true,
          billingType: true,
          agentName: true,
          projectId: true,
        },
      }),
      prisma.lLMUsage.count({ where }),
      // Summary stats for the same filter window
      prisma.lLMUsage.aggregate({
        where,
        _sum: { tokensUsed: true, actualCost: true, markedUpCost: true },
        _count: true,
      }),
    ]);

    // This month summary (always unfiltered by page, but scoped to userId + current month)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthSummary = await prisma.lLMUsage.aggregate({
      where: { userId, createdAt: { gte: monthStart } },
      _sum: { tokensUsed: true, actualCost: true, markedUpCost: true },
      _count: true,
    });

    // Daily breakdown for chart (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
    const dailyRecords = await prisma.lLMUsage.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, tokensUsed: true, markedUpCost: true, actualCost: true, billingType: true },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by day
    const dailyMap: Record<string, { date: string; tokens: number; cost: number }> = {};
    for (const r of dailyRecords) {
      const day = r.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { date: day, tokens: 0, cost: 0 };
      dailyMap[day].tokens += r.tokensUsed;
      dailyMap[day].cost   += r.markedUpCost ?? r.actualCost;
    }
    const dailyUsage = Object.values(dailyMap);

    return NextResponse.json({
      usage: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalTokens:    summary._sum.tokensUsed    ?? 0,
        totalCost:      summary._sum.markedUpCost  ?? summary._sum.actualCost ?? 0,
        totalCalls:     summary._count,
      },
      thisMonth: {
        tokens:  monthSummary._sum.tokensUsed    ?? 0,
        cost:    monthSummary._sum.markedUpCost  ?? monthSummary._sum.actualCost ?? 0,
        calls:   monthSummary._count,
      },
      dailyUsage,
    });
  } catch (error) {
    console.error('GET /api/account/usage error:', error);
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }
}
