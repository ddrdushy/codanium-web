import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Check if user is a member of the given project. */
async function isMember(userId: string, projectId: string): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return !!member;
}

/**
 * GET /api/projects/:id
 * Get a single project with full details: members, card counts by state, agent summary.
 * Only accessible to project members.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const userId = (session.user as any)?.id;
    if (!(await isMember(userId, id))) {
      return NextResponse.json(
        { error: 'You do not have access to this project' },
        { status: 403 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarColor: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        cards: {
          select: { state: true },
        },
        agents: {
          select: {
            id: true,
            name: true,
            shortName: true,
            group: true,
            status: true,
            currentTask: true,
            avatar: true,
          },
          orderBy: { name: 'asc' },
        },
        sdlcStages: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            cards: true,
            decisions: true,
            documents: true,
            agents: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Compute card counts by state
    const cardCountsByState: Record<string, number> = {};
    for (const card of project.cards) {
      cardCountsByState[card.state] = (cardCountsByState[card.state] || 0) + 1;
    }

    // Agent summary by group
    const agentsByGroup: Record<string, typeof project.agents> = {};
    for (const agent of project.agents) {
      if (!agentsByGroup[agent.group]) {
        agentsByGroup[agent.group] = [];
      }
      agentsByGroup[agent.group].push(agent);
    }

    const result = {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      currentStage: project.currentStage,
      completion: project.completion,
      color: project.color,
      owner: project.owner,
      members: project.members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      cardCountsByState,
      agents: project.agents,
      agentsByGroup,
      sdlcStages: project.sdlcStages,
      counts: project._count,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id
 * Update project fields: name, description, status, currentStage, completion, color.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const userId = (session.user as any)?.id;
    if (!(await isMember(userId, id))) {
      return NextResponse.json(
        { error: 'You do not have access to this project' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate project exists
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const allowedFields = ['name', 'description', 'status', 'currentStage', 'completion', 'color'];
    const data: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = field === 'name' || field === 'description'
          ? (body[field] as string).trim()
          : body[field];
      }
    }

    if (data.completion !== undefined) {
      const completion = Number(data.completion);
      if (isNaN(completion) || completion < 0 || completion > 100) {
        return NextResponse.json(
          { error: 'Completion must be a number between 0 and 100' },
          { status: 400 }
        );
      }
      data.completion = completion;
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id
 * Delete a project and all related data (cascade).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const userId = (session.user as any)?.id;
    if (!(await isMember(userId, id))) {
      return NextResponse.json(
        { error: 'You do not have access to this project' },
        { status: 403 }
      );
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
