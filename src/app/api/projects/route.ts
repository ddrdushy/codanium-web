import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects
 * List all projects with member count, card count, and active agent count.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        _count: {
          select: {
            members: true,
            cards: true,
            agents: true,
          },
        },
        agents: {
          where: { status: 'WORKING' },
          select: { id: true },
        },
      },
    });

    const result = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      currentStage: project.currentStage,
      completion: project.completion,
      color: project.color,
      owner: project.owner,
      memberCount: project._count.members,
      cardCount: project._count.cards,
      totalAgents: project._count.agents,
      activeAgentCount: project.agents.length,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project.
 * Body: { name, description?, color?, ownerId }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { name, description, color, ownerId } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    if (!ownerId || typeof ownerId !== 'string') {
      return NextResponse.json(
        { error: 'Owner ID is required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? '',
        color: color ?? '#f59e0b',
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'owner',
          },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        _count: {
          select: { members: true, cards: true },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
