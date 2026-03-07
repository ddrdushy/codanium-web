import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import { validateBody } from '@/lib/validations/validate';
import { createDecisionSchema } from '@/lib/validations/schemas';
import type { RiskRating, Effort } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/decisions
 * List all decisions for a project, including their options.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuth();
    if (error) return error;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const decisions = await prisma.decision.findMany({
      where: { projectId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        options: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(decisions);
  } catch (error) {
    console.error('GET /api/projects/[id]/decisions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/decisions
 * Create a new decision with options.
 * Body: {
 *   trigger: string,
 *   context?: string,
 *   riskRating?: RiskRating,
 *   recommendation?: string,
 *   ownerId: string,
 *   options?: Array<{ name: string, description?: string, pros?: string[], cons?: string[], risk?: RiskRating, effort?: Effort }>
 * }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuth();
    if (error) return error;
    const body = await request.json();

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const { data, error: validationError } = validateBody(createDecisionSchema, body);
    if (validationError) return validationError;

    const recommendation = body.recommendation;

    const decision = await prisma.decision.create({
      data: {
        trigger: data.trigger,
        context: data.context ?? '',
        riskRating: data.riskRating ?? 'MEDIUM',
        recommendation: recommendation?.trim() ?? '',
        ownerId: data.ownerId,
        projectId,
        options: data.options && data.options.length > 0
          ? {
              create: data.options.map((opt) => ({
                name: opt.title,
                description: opt.description?.trim() ?? '',
                pros: opt.pros ?? [],
                cons: opt.cons ?? [],
                risk: 'MEDIUM' as RiskRating,
                effort: 'MEDIUM' as Effort,
              })),
            }
          : undefined,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        options: true,
      },
    });

    return NextResponse.json(decision, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/decisions error:', error);
    return NextResponse.json(
      { error: 'Failed to create decision' },
      { status: 500 }
    );
  }
}
