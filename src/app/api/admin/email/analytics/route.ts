import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email/analytics
 * Returns aggregated email event statistics.
 * Query params: ?days=30 (default 30)
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Aggregate counts by event type
    const eventCounts = await prisma.emailEvent.groupBy({
      by: ['event'],
      where: { timestamp: { gte: since } },
      _count: { event: true },
    });

    // Build summary
    const summary: Record<string, number> = {};
    for (const ec of eventCounts) {
      summary[ec.event] = ec._count.event;
    }

    // Daily breakdown for charts
    const dailyEvents = await prisma.emailEvent.findMany({
      where: { timestamp: { gte: since } },
      select: { event: true, timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const dailyMap: Record<string, Record<string, number>> = {};
    for (const evt of dailyEvents) {
      const dateKey = evt.timestamp.toISOString().split('T')[0];
      if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
      dailyMap[dateKey][evt.event] = (dailyMap[dateKey][evt.event] ?? 0) + 1;
    }

    const daily = Object.entries(dailyMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Recent events for activity feed
    const recentEvents = await prisma.emailEvent.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: {
        id: true,
        event: true,
        email: true,
        timestamp: true,
        customId: true,
        url: true,
        bounceError: true,
        isHardBounce: true,
        spamSource: true,
      },
    });

    return NextResponse.json({ summary, daily, recentEvents });
  } catch (err) {
    console.error('GET /api/admin/email/analytics error:', err);
    return NextResponse.json({ error: 'Failed to fetch email analytics' }, { status: 500 });
  }
}
