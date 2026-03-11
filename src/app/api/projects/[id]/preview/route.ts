import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { validateBody } from '@/lib/validations/validate';
import { previewTierSchema } from '@/lib/validations/schemas';
import { canAccessTier, PREVIEW_TIER_ACCESS, getTierUpgradeRequired } from '@/lib/plan-limits';
import type { UserPlan } from '@/generated/prisma/enums';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/preview
// Returns the project's current preview tier + user's allowed tiers
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const userId = (session.user as any).id;

    // Get project + user plan
    const [project, user] = await Promise.all([
      prisma.project.findFirst({
        where: {
          id: projectId,
          members: { some: { userId } },
        },
        select: { previewTier: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      }),
    ]);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const plan = (user?.plan ?? 'STARTER') as UserPlan;
    const allowedTiers = PREVIEW_TIER_ACCESS[plan];

    return NextResponse.json({
      currentTier: project.previewTier,
      allowedTiers,
      plan,
    });
  } catch (err) {
    console.error('GET /api/projects/[id]/preview error:', err);
    return NextResponse.json({ error: 'Failed to fetch preview config' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/[id]/preview
// Update the project's preview tier (validates against user's plan)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const userId = (session.user as any).id;
    const body = await request.json();

    // Validate input
    const { data, error: validationError } = validateBody(previewTierSchema, body);
    if (validationError) return validationError;

    // Get user plan
    const [project, user] = await Promise.all([
      prisma.project.findFirst({
        where: {
          id: projectId,
          members: { some: { userId } },
        },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      }),
    ]);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const plan = (user?.plan ?? 'STARTER') as UserPlan;

    // Check tier access
    if (!canAccessTier(plan, data.tier)) {
      const requiredPlan = getTierUpgradeRequired(data.tier);
      return NextResponse.json(
        {
          error: `Your ${plan} plan does not include ${data.tier} preview. Upgrade to ${requiredPlan} to unlock it.`,
          requiredPlan,
          currentPlan: plan,
        },
        { status: 403 },
      );
    }

    // Update project
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { previewTier: data.tier },
      select: { previewTier: true },
    });

    return NextResponse.json({
      tier: updated.previewTier,
      message: `Preview tier updated to ${data.tier}`,
    });
  } catch (err) {
    console.error('PATCH /api/projects/[id]/preview error:', err);
    return NextResponse.json({ error: 'Failed to update preview tier' }, { status: 500 });
  }
}
