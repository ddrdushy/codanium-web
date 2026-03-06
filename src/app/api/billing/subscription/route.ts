import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { getPriceIds } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/subscription
 * Get the current user's subscription status.
 */
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'User data missing' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        stripePriceId: true,
        stripeCustomerId: true,
        trialEndsAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get recent transactions
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        plan: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      plan: user.plan,
      status: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      priceId: user.stripePriceId,
      hasStripeCustomer: !!user.stripeCustomerId,
      trialEndsAt: user.trialEndsAt,
      priceIds: getPriceIds(),
      transactions,
    });
  } catch (err) {
    console.error('GET /api/billing/subscription error:', err);
    return NextResponse.json(
      { error: 'Failed to load subscription' },
      { status: 500 },
    );
  }
}
