import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/account/credits
// ---------------------------------------------------------------------------
// Returns the user's credit wallet balance + recent transactions.
// ---------------------------------------------------------------------------

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;
  const userId = (session.user as any).id as string;

  const wallet = await prisma.creditWallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!wallet) {
    return NextResponse.json({
      balance: 0,
      lifetimeAdded: 0,
      lifetimeUsed: 0,
      freeCreditsGranted: 0,
      freeCreditsExpiry: null,
      freeDataConsent: false,
      warningLevel: null,
      transactions: [],
    });
  }

  // Calculate warning level
  let warningLevel: 'warn' | 'critical' | null = null;
  if (wallet.balance <= 0) {
    warningLevel = 'critical';
  } else if (wallet.lifetimeAdded > 0 && wallet.lifetimeUsed / wallet.lifetimeAdded >= 0.8) {
    warningLevel = 'warn';
  }

  return NextResponse.json({
    balance: wallet.balance,
    lifetimeAdded: wallet.lifetimeAdded,
    lifetimeUsed: wallet.lifetimeUsed,
    freeCreditsGranted: wallet.freeCreditsGranted,
    freeCreditsExpiry: wallet.freeCreditsExpiry,
    freeDataConsent: wallet.freeDataConsent,
    warningLevel,
    transactions: wallet.transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
    })),
  });
}
