import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/billing
 * Returns billing metrics, plan distribution, and recent transactions.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;
    const [
      transactions,
      usersByPlan,
      totalRevenue,
      activeSubscriptions,
      creditWalletStats,
      creditTransactions,
      byokUserCount,
      platformUserCount,
      topSpenders,
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
      // Credit wallet aggregate
      prisma.creditWallet.aggregate({
        _sum: { balance: true, lifetimeAdded: true, lifetimeUsed: true },
        _count: true,
      }),
      // Recent credit transactions
      prisma.creditTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
          wallet: { select: { user: { select: { name: true, email: true } } } },
        },
      }),
      // BYOK users: have an active USER-scope LLMProviderConfig
      prisma.lLMProviderConfig.count({ where: { scope: 'USER', isActive: true } }),
      // Platform users with a wallet (non-BYOK)
      prisma.creditWallet.count(),
      // Top spenders by markedUpCost
      prisma.lLMUsage.groupBy({
        by: ['userId'],
        where: { userId: { not: null }, billingType: 'PLATFORM' },
        _sum: { markedUpCost: true, tokensUsed: true },
        _count: true,
        orderBy: { _sum: { markedUpCost: 'desc' } },
        take: 10,
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

    // Resolve top spender user details
    const topSpenderUserIds = topSpenders.map(s => s.userId).filter(Boolean) as string[];
    const topSpenderUsers = topSpenderUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: topSpenderUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = Object.fromEntries(topSpenderUsers.map(u => [u.id, u]));

    const topSpenderList = topSpenders.map(s => ({
      userId: s.userId,
      name:   s.userId ? (userMap[s.userId]?.name  ?? 'Unknown') : 'Unknown',
      email:  s.userId ? (userMap[s.userId]?.email ?? '')         : '',
      totalSpend:  s._sum.markedUpCost ?? 0,
      totalTokens: s._sum.tokensUsed   ?? 0,
      calls:       s._count,
    }));

    return NextResponse.json({
      mrr,
      total_revenue: totalRevenue._sum.amount ?? 0,
      active_subscriptions: activeSubscriptions,
      churn_rate: 2.4,
      plan_distribution: planDistribution,
      transactions: mappedTransactions,
      credits: {
        total_wallets:    creditWalletStats._count,
        total_balance:    creditWalletStats._sum.balance       ?? 0,
        lifetime_added:   creditWalletStats._sum.lifetimeAdded ?? 0,
        lifetime_used:    creditWalletStats._sum.lifetimeUsed  ?? 0,
        byok_users:       byokUserCount,
        platform_users:   platformUserCount,
        recent_transactions: creditTransactions.map(t => ({
          id:          t.id,
          amount:      t.amount,
          type:        t.type,
          description: t.description,
          createdAt:   t.createdAt.toISOString(),
          user_name:   t.wallet?.user?.name  ?? null,
          user_email:  t.wallet?.user?.email ?? null,
        })),
      },
      top_spenders: topSpenderList,
    });
  } catch (error) {
    console.error('GET /api/admin/billing error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}
