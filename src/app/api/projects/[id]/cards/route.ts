import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { validateBody } from '@/lib/validations/validate';
import { createCardSchema } from '@/lib/validations/schemas';
import type { CardState, CardType, Priority } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/cards
 * List cards for a project with optional filters: state, type, priority, assignee.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const { searchParams } = new URL(request.url);

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

    // Build filter conditions
    const where: Record<string, unknown> = { projectId };

    const state = searchParams.get('state');
    if (state) {
      where.state = state as CardState;
    }

    const type = searchParams.get('type');
    if (type) {
      where.type = type as CardType;
    }

    const priority = searchParams.get('priority');
    if (priority) {
      where.priority = priority as Priority;
    }

    const assigneeId = searchParams.get('assigneeId');
    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    const module = searchParams.get('module');
    if (module) {
      where.module = module;
    }

    const cards = await prisma.card.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        ownerAgent: {
          select: { id: true, name: true, shortName: true, avatar: true },
        },
        children: {
          select: { id: true, title: true, state: true, priority: true },
        },
        _count: {
          select: { children: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error('GET /api/projects/[id]/cards error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cards' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/cards
 * Create a new card.
 * Body: { title, description?, type?, state?, priority?, assigneeId?, ownerAgentId?, parentId?, linkedDecisionId? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
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

    const { data, error: validationError } = validateBody(createCardSchema, body);
    if (validationError) return validationError;

    const linkedDecisionId = body.linkedDecisionId;

    const card = await prisma.card.create({
      data: {
        title: data.title,
        description: data.description ?? '',
        type: data.type,
        state: data.state,
        priority: data.priority,
        projectId,
        assigneeId: data.assigneeId ?? null,
        ownerAgentId: data.ownerAgentId ?? null,
        parentId: data.parentId ?? null,
        linkedDecisionId: linkedDecisionId ?? null,
        module: data.module ?? null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        ownerAgent: {
          select: { id: true, name: true, shortName: true, avatar: true },
        },
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/cards error:', error);
    return NextResponse.json(
      { error: 'Failed to create card' },
      { status: 500 }
    );
  }
}
