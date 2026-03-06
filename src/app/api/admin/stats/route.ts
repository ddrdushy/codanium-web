import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics: total users, projects, costs, agents.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    // Run all count queries in parallel for performance
    const [
      totalUsers,
      activeUsers,
      totalProjects,
      activeProjects,
      totalAgents,
      activeAgents,
      totalCards,
      totalDecisions,
      totalDocuments,
      costData,
      usersByPlan,
      recentTransactions,
    ] = await Promise.all([
      // User counts
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),

      // Project counts
      prisma.project.count(),
      prisma.project.count({ where: { status: 'ACTIVE' } }),

      // Agent counts
      prisma.agent.count(),
      prisma.agent.count({ where: { status: { not: 'IDLE' } } }),

      // Card count
      prisma.card.count(),

      // Decision count
      prisma.decision.count(),

      // Document count
      prisma.document.count(),

      // Total LLM cost
      prisma.lLMUsage.aggregate({
        _sum: { cost: true, tokensUsed: true },
      }),

      // Users by plan
      prisma.user.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),

      // Recent transaction revenue
      prisma.transaction.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: 'COMPLETED' },
      }),
    ]);

    const planBreakdown: Record<string, number> = {};
    for (const entry of usersByPlan) {
      planBreakdown[entry.plan] = entry._count.plan;
    }

    return NextResponse.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        byPlan: planBreakdown,
      },
      projects: {
        total: totalProjects,
        active: activeProjects,
      },
      agents: {
        total: totalAgents,
        active: activeAgents,
      },
      cards: {
        total: totalCards,
      },
      decisions: {
        total: totalDecisions,
      },
      documents: {
        total: totalDocuments,
      },
      costs: {
        totalLLMCost: costData._sum.cost ?? 0,
        totalTokensUsed: costData._sum.tokensUsed ?? 0,
      },
      revenue: {
        total: recentTransactions._sum.amount ?? 0,
        transactionCount: recentTransactions._count,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
