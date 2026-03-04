import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
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
    const session = await auth();

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
    const session = await auth();
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

    const { trigger, context: decisionContext, riskRating, recommendation, ownerId, options } = body;

    if (!trigger || typeof trigger !== 'string') {
      return NextResponse.json(
        { error: 'Decision trigger is required' },
        { status: 400 }
      );
    }

    if (!ownerId || typeof ownerId !== 'string') {
      return NextResponse.json(
        { error: 'Owner ID is required' },
        { status: 400 }
      );
    }

    const decision = await prisma.decision.create({
      data: {
        trigger: trigger.trim(),
        context: decisionContext?.trim() ?? '',
        riskRating: riskRating ?? 'MEDIUM',
        recommendation: recommendation?.trim() ?? '',
        ownerId,
        projectId,
        options: options && Array.isArray(options) && options.length > 0
          ? {
              create: options.map((opt: {
                name: string;
                description?: string;
                pros?: string[];
                cons?: string[];
                risk?: RiskRating;
                effort?: Effort;
              }) => ({
                name: opt.name.trim(),
                description: opt.description?.trim() ?? '',
                pros: opt.pros ?? [],
                cons: opt.cons ?? [],
                risk: opt.risk ?? ('MEDIUM' as RiskRating),
                effort: opt.effort ?? ('MEDIUM' as Effort),
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
