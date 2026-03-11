import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/user/preferences
// ---------------------------------------------------------------------------

/**
 * Returns the current user's platform-level preferences.
 * Creates defaults via upsert if no preferences exist yet.
 */
export async function GET() {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const userId = (session.user as any)?.id;

    const prefs = await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return NextResponse.json({
      approvalLevel: prefs.approvalLevel,
      communicationStyle: prefs.communicationStyle,
      monthlyBudget: prefs.monthlyBudget,
      alertThreshold: prefs.alertThreshold,
      notifyApprovals: prefs.notifyApprovals,
      notifyProgress: prefs.notifyProgress,
      notifyAttention: prefs.notifyAttention,
      notifyDailySummary: prefs.notifyDailySummary,
      notifyBudgetAlerts: prefs.notifyBudgetAlerts,
    });
  } catch (err) {
    console.error('GET /api/user/preferences error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch user preferences' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/user/preferences
// ---------------------------------------------------------------------------

/**
 * Create or update the current user's platform-level preferences.
 * All fields are optional — only provided fields are updated.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const userId = (session.user as any)?.id;

    const body = await request.json();

    // Build update data from provided fields
    const data: Record<string, any> = {};

    if (body.approvalLevel && ['everything', 'big-stuff', 'autonomous'].includes(body.approvalLevel)) {
      data.approvalLevel = body.approvalLevel;
    }
    if (body.communicationStyle && ['simple', 'detailed'].includes(body.communicationStyle)) {
      data.communicationStyle = body.communicationStyle;
    }
    if (typeof body.monthlyBudget === 'number' && body.monthlyBudget >= 0 && body.monthlyBudget <= 10000) {
      data.monthlyBudget = body.monthlyBudget;
    }
    if (typeof body.alertThreshold === 'number' && [50, 75, 90].includes(body.alertThreshold)) {
      data.alertThreshold = body.alertThreshold;
    }
    if (typeof body.notifyApprovals === 'boolean') data.notifyApprovals = body.notifyApprovals;
    if (typeof body.notifyProgress === 'boolean') data.notifyProgress = body.notifyProgress;
    if (typeof body.notifyAttention === 'boolean') data.notifyAttention = body.notifyAttention;
    if (typeof body.notifyDailySummary === 'boolean') data.notifyDailySummary = body.notifyDailySummary;
    if (typeof body.notifyBudgetAlerts === 'boolean') data.notifyBudgetAlerts = body.notifyBudgetAlerts;

    const prefs = await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return NextResponse.json({
      success: true,
      approvalLevel: prefs.approvalLevel,
      communicationStyle: prefs.communicationStyle,
      monthlyBudget: prefs.monthlyBudget,
      alertThreshold: prefs.alertThreshold,
      notifyApprovals: prefs.notifyApprovals,
      notifyProgress: prefs.notifyProgress,
      notifyAttention: prefs.notifyAttention,
      notifyDailySummary: prefs.notifyDailySummary,
      notifyBudgetAlerts: prefs.notifyBudgetAlerts,
    });
  } catch (err) {
    console.error('POST /api/user/preferences error:', err);
    return NextResponse.json(
      { error: 'Failed to save user preferences' },
      { status: 500 },
    );
  }
}
