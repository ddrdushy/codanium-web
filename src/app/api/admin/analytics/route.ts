import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics
 * Returns LLM usage data aggregated by day, provider, and project.
 */
export async function GET() {
  try {
    const usageRecords = await prisma.lLMUsage.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    // Map to frontend format
    const usage = usageRecords.map((r) => ({
      date: r.createdAt.toISOString().split('T')[0],
      tokens_used: r.tokensUsed,
      cost: r.cost,
      provider: r.provider.toLowerCase(),
      project_id: r.projectId,
      project_name: r.project.name,
    }));

    return NextResponse.json({ usage });
  } catch (error) {
    console.error('GET /api/admin/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
