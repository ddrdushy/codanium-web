import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import {
  getOrCreateCustomer,
  createCheckoutSession,
  getStripeConfig,
} from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/checkout
 * Create a Stripe Checkout Session for subscription purchase.
 *
 * Body: { priceId, successUrl?, cancelUrl? }
 * Returns: { url } — redirect URL to Stripe Checkout
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { priceId, successUrl, cancelUrl } = body;

    if (!priceId || typeof priceId !== 'string') {
      return NextResponse.json({ error: 'priceId is required' }, { status: 400 });
    }

    const user = session.user as any;
    const userId = user?.id;
    const email = user?.email;
    const name = user?.name ?? 'User';

    if (!userId || !email) {
      return NextResponse.json({ error: 'User data missing' }, { status: 400 });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(userId, email, name);

    // Create checkout session
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const url = await createCheckoutSession(
      customerId,
      priceId,
      successUrl ?? `${appUrl}/billing?status=success`,
      cancelUrl ?? `${appUrl}/billing?status=canceled`,
    );

    if (!url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error('POST /api/billing/checkout error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
