import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import { seedProject, autoKickoffBA } from '@/lib/project-seed';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects
 * List projects the current user is a member of.
 * Filtered by ProjectMember table — users only see their own projects.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = (session.user as any)?.id;

    const projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } },
      },
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
 * Body: { name, description?, color? }
 * Owner is automatically set to the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const body = await request.json();

    const userId = (session.user as any)?.id;
    const { name, description, color } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? '',
        color: color ?? '#f59e0b',
        ownerId: userId,
        members: {
          create: {
            userId,
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

    // Seed agents + SDLC stages (synchronous, fast batch inserts)
    try {
      const seed = await seedProject(project.id);
      console.log(`[Project ${project.id}] Seeded ${seed.agentCount} agents, ${seed.stageCount} stages`);
    } catch (seedError) {
      console.error('Project seed failed (non-fatal):', seedError);
    }

    // Auto-kickoff BA agent (async background job)
    if (description?.trim()) {
      autoKickoffBA(project.id, description.trim(), userId)
        .then((runId) => console.log(`[Project ${project.id}] BA kickoff queued: ${runId}`))
        .catch((err) => console.error('BA auto-kickoff failed (non-fatal):', err));
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
