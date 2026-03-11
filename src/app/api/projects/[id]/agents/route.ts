import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { validateBody } from '@/lib/validations/validate';
import { updateAgentSchema } from '@/lib/validations/schemas';
import type { AgentGroup } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/agents
 * List agents for a project with optional group filter.
 * Query params: ?group=GOVERNANCE|SDLC|ENGINEERING|PLATFORM|AI_COST
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

    const where: Record<string, unknown> = { projectId };

    const group = searchParams.get('group');
    if (group) {
      where.group = group as AgentGroup;
    }

    const agents = await prisma.agent.findMany({
      where,
      include: {
        _count: {
          select: { cards: true },
        },
      },
      orderBy: [
        { group: 'asc' },
        { name: 'asc' },
      ],
    });

    const result = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      shortName: agent.shortName,
      group: agent.group,
      status: agent.status,
      currentTask: agent.currentTask,
      avatar: agent.avatar,
      cardCount: agent._count.cards,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/projects/[id]/agents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id/agents
 * Update an agent's status and/or current task.
 * Body: { agentId: string, status?: AgentStatus, currentTask?: string | null }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const body = await request.json();

    const { data, error: validationError } = validateBody(updateAgentSchema, body);
    if (validationError) return validationError;

    // Verify agent exists and belongs to project
    const existing = await prisma.agent.findFirst({
      where: { id: data.agentId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found in this project' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.currentTask !== undefined) {
      updateData.currentTask = data.currentTask;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.update({
      where: { id: data.agentId },
      data: updateData,
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    return NextResponse.json({
      id: agent.id,
      name: agent.name,
      shortName: agent.shortName,
      group: agent.group,
      status: agent.status,
      currentTask: agent.currentTask,
      avatar: agent.avatar,
      cardCount: agent._count.cards,
      updatedAt: agent.updatedAt,
    });
  } catch (error) {
    console.error('PATCH /api/projects/[id]/agents error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}
