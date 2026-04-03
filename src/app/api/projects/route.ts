import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { seedProject, autoKickoffPM } from '@/lib/project-seed';
import { validateBody } from '@/lib/validations/validate';
import { createProjectSchema } from '@/lib/validations/schemas';
import { initializeWorkspace } from '@/lib/ai/tools/workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects
 * List projects the current user is a member of.
 * Filtered by ProjectMember table — users only see their own projects.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAuthOrApiKey();
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
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const body = await request.json();

    const userId = (session.user as any)?.id;
    const { data, error: validationError } = validateBody(createProjectSchema, body);
    if (validationError) return validationError;

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description ?? '',
        color: data.color ?? '#f59e0b',
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

    // Initialize workspace directory structure for the project
    try {
      await initializeWorkspace(project.id);
      console.log(`[Project ${project.id}] Workspace initialized`);
    } catch (workspaceError) {
      console.error('Workspace initialization failed (non-fatal):', workspaceError);
    }

    // Auto-seed project memories from wizard data (structured for BA context)
    try {
      const memories: Array<{ projectId: string; category: string; content: string; source: string }> = [];

      if (data.name) {
        memories.push({
          projectId: project.id,
          category: 'idea',
          content: `Project name: ${data.name}`,
          source: 'system',
        });
      }

      // Parse structured fields from description (wizard packs them as "Idea: ...\n\nTarget audience: ...\n\nPriorities: ...")
      const descriptionText = data.description ?? '';
      const ideaMatch = descriptionText.match(/^Idea:\s*([\s\S]+?)(?:\n\n|$)/);
      const audienceMatch = descriptionText.match(/Target audience:\s*([\s\S]+?)(?:\n\n|$)/);
      const prioritiesMatch = descriptionText.match(/Priorities:\s*([\s\S]+?)(?:\n\n|$)/);

      if (ideaMatch?.[1]?.trim()) {
        memories.push({
          projectId: project.id,
          category: 'idea',
          content: `Product idea: ${ideaMatch[1].trim()}`,
          source: 'system',
        });
      }
      if (audienceMatch?.[1]?.trim()) {
        memories.push({
          projectId: project.id,
          category: 'audience',
          content: `Target audience: ${audienceMatch[1].trim()}`,
          source: 'system',
        });
      }
      if (prioritiesMatch?.[1]?.trim()) {
        memories.push({
          projectId: project.id,
          category: 'priorities',
          content: `Project priorities: ${prioritiesMatch[1].trim()}`,
          source: 'system',
        });
      }

      // Fallback: if no structured fields parsed, store raw description
      if (!ideaMatch && !audienceMatch && !prioritiesMatch && descriptionText.trim()) {
        memories.push({
          projectId: project.id,
          category: 'idea',
          content: `Description: ${descriptionText.trim()}`,
          source: 'system',
        });
      }

      if (memories.length > 0) {
        await prisma.projectMemory.createMany({ data: memories });
        console.log(`[Project ${project.id}] Seeded ${memories.length} memories`);
      }
    } catch (memoryError) {
      console.error('Memory seed failed (non-fatal):', memoryError);
    }

    // Auto-kickoff PM agent — greets user and creates BA requirement card
    if (data.description) {
      autoKickoffPM(project.id, data.description, userId)
        .then((runId) => console.log(`[Project ${project.id}] PM kickoff queued: ${runId}`))
        .catch((err) => console.error('PM auto-kickoff failed (non-fatal):', err));
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
