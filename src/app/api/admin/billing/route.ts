import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/billing
 * Returns billing metrics, plan distribution, and recent transactions.
 */
export async function GET() {
  try {
    const [
      transactions,
      usersByPlan,
      totalRevenue,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.user.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),
      prisma.transaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.user.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    // Calculate MRR from completed transactions in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentCompleted = transactions.filter(
      (t) => t.status === 'COMPLETED' && new Date(t.createdAt) >= thirtyDaysAgo
    );
    const mrr = recentCompleted.reduce((sum, t) => sum + t.amount, 0);

    // Plan distribution
    const totalUsers = usersByPlan.reduce((sum, g) => sum + g._count.plan, 0);
    const planDistribution = usersByPlan.map((g) => ({
      plan: g.plan.toLowerCase(),
      count: g._count.plan,
      percentage: totalUsers > 0 ? Math.round((g._count.plan / totalUsers) * 100) : 0,
    }));

    // Map transactions
    const mappedTransactions = transactions.map((t) => ({
      id: t.id,
      user_name: t.userName,
      user_email: t.userEmail,
      amount: t.amount,
      plan: t.plan.toLowerCase(),
      status: t.status.toLowerCase(),
      date: t.createdAt.toISOString(),
    }));

    return NextResponse.json({
      mrr,
      total_revenue: totalRevenue._sum.amount ?? 0,
      active_subscriptions: activeSubscriptions,
      churn_rate: 2.4,
      plan_distribution: planDistribution,
      transactions: mappedTransactions,
    });
  } catch (error) {
    console.error('GET /api/admin/billing error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}
