import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { createPortalSession, getStripeConfig } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/portal
 * Create a Stripe Customer Portal session.
 *
 * Returns: { url } — redirect URL to Stripe Portal
 */
export async function POST() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const config = await getStripeConfig();
    if (!config.enabled || !config.secretKey) {
      return NextResponse.json(
        { error: 'Billing is not configured' },
        { status: 503 },
      );
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'User data missing' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe to a plan first.' },
        { status: 400 },
      );
    }

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const url = await createPortalSession(
      user.stripeCustomerId,
      `${appUrl}/billing`,
    );

    return NextResponse.json({ url });
  } catch (err) {
    console.error('POST /api/billing/portal error:', err);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 },
    );
  }
}
