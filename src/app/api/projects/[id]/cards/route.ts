import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
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
    const { session, error } = await requireAuth();
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

    const { title, description, type, state, priority, assigneeId, ownerAgentId, parentId, linkedDecisionId } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Card title is required' },
        { status: 400 }
      );
    }

    const card = await prisma.card.create({
      data: {
        title: title.trim(),
        description: description?.trim() ?? '',
        type: type ?? 'TASK',
        state: state ?? 'PLANNED',
        priority: priority ?? 'MEDIUM',
        projectId,
        assigneeId: assigneeId ?? null,
        ownerAgentId: ownerAgentId ?? null,
        parentId: parentId ?? null,
        linkedDecisionId: linkedDecisionId ?? null,
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
