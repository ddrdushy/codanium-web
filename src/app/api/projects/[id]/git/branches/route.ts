import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/git/branches
 * List all branches for a project.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const branches = await prisma.gitBranch.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(branches);
  } catch (error) {
    console.error('GET /api/projects/[id]/git/branches error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

/**
 * POST /api/projects/:id/git/branches
 * Create a new branch.
 * Body: { name, author? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { name, author } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Branch name is required' },
        { status: 400 }
      );
    }

    const branch = await prisma.gitBranch.create({
      data: {
        name: name.trim(),
        status: 'ACTIVE',
        author: author ?? session.user?.name ?? '',
        projectId,
      },
    });

    return NextResponse.json(branch, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/git/branches error:', error);
    return NextResponse.json(
      { error: 'Failed to create branch' },
      { status: 500 }
    );
  }
}
