import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { getOrCreateCustomer, createCreditCheckoutSession, getStripeConfig } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Credit packs (exported for use in UI too)
// ---------------------------------------------------------------------------

export const CREDIT_PACKS = [
  { id: 'starter',  label: 'Starter',  priceInCents: 1000,  credits: 10  },
  { id: 'pro',      label: 'Pro',      priceInCents: 2500,  credits: 25  },
  { id: 'team',     label: 'Team',     priceInCents: 5000,  credits: 55  }, // 10% bonus
  { id: 'business', label: 'Business', priceInCents: 10000, credits: 115 }, // 15% bonus
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

// ---------------------------------------------------------------------------
// GET /api/billing/credits
// ---------------------------------------------------------------------------
// Returns available credit packs.
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({ packs: CREDIT_PACKS });
}

// ---------------------------------------------------------------------------
// POST /api/billing/credits
// ---------------------------------------------------------------------------
// Creates a Stripe Checkout session for a one-time credit pack purchase.
//
// Body: { packId: 'starter' | 'pro' | 'team' | 'business' }
// Returns: { url } — redirect to Stripe hosted checkout
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const config = await getStripeConfig();
    if (!config.secretKey) {
      return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const { packId } = body as { packId?: string };

    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json(
        { error: `Invalid packId. Choose one of: ${CREDIT_PACKS.map((p) => p.id).join(', ')}` },
        { status: 400 },
      );
    }

    const user = session.user as { id: string; email?: string | null; name?: string | null };
    const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

    const customerId = await getOrCreateCustomer(
      user.id,
      user.email ?? '',
      user.name ?? 'User',
    );

    const url = await createCreditCheckoutSession({
      customerId,
      userId: user.id,
      packId: pack.id,
      packLabel: pack.label,
      priceInCents: pack.priceInCents,
      credits: pack.credits,
      successUrl: `${appUrl}/account/billing?success=1&pack=${pack.id}`,
      cancelUrl: `${appUrl}/account/billing?cancelled=1`,
    });

    if (!url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('POST /api/billing/credits error:', err);
    return NextResponse.json({ error: err.message ?? 'Failed to create checkout session' }, { status: 500 });
  }
}
