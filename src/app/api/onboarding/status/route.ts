import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/onboarding/status
// ---------------------------------------------------------------------------

/**
 * Returns the current user's onboarding completion status and step.
 */
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const userId = (session.user as any)?.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      completed: user.onboardingCompleted,
      step: user.onboardingStep,
      completedAt: user.onboardingCompletedAt,
    });
  } catch (err) {
    console.error('GET /api/onboarding/status error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding status' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/onboarding/status
// ---------------------------------------------------------------------------

/**
 * Update onboarding progress.
 * Body: { step?: number } — update last completed step
 *   OR: { completed: true } — mark onboarding as finished
 */
export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const userId = (session.user as any)?.id;

    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (typeof body.step === 'number' && body.step >= 0 && body.step <= 4) {
      updateData.onboardingStep = body.step;
    }

    if (body.completed === true) {
      updateData.onboardingCompleted = true;
      updateData.onboardingCompletedAt = new Date();
      updateData.onboardingStep = 4;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update. Provide "step" (0-4) or "completed: true".' },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/onboarding/status error:', err);
    return NextResponse.json(
      { error: 'Failed to update onboarding status' },
      { status: 500 },
    );
  }
}
