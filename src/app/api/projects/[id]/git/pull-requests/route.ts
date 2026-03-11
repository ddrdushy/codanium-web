import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/git/pull-requests
 * List all pull requests for a project.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const pullRequests = await prisma.gitPullRequest.findMany({
      where: { projectId },
      orderBy: { number: 'desc' },
    });

    return NextResponse.json(pullRequests);
  } catch (error) {
    console.error('GET /api/projects/[id]/git/pull-requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch pull requests' }, { status: 500 });
  }
}

/**
 * POST /api/projects/:id/git/pull-requests
 * Create a new pull request. Auto-increments PR number.
 * Body: { title, branch, author?, reviewers?, additions?, deletions? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { title, branch, author, reviewers, additions, deletions } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Pull request title is required' },
        { status: 400 }
      );
    }

    if (!branch || typeof branch !== 'string') {
      return NextResponse.json(
        { error: 'Branch name is required' },
        { status: 400 }
      );
    }

    // Auto-increment PR number: find max number for this project, then +1
    const maxPR = await prisma.gitPullRequest.findFirst({
      where: { projectId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    const nextNumber = (maxPR?.number ?? 0) + 1;

    const pullRequest = await prisma.gitPullRequest.create({
      data: {
        number: nextNumber,
        title: title.trim(),
        branch: branch.trim(),
        status: 'OPEN',
        author: author ?? session.user?.name ?? '',
        reviewers: reviewers ?? [],
        additions: additions ?? 0,
        deletions: deletions ?? 0,
        projectId,
      },
    });

    return NextResponse.json(pullRequest, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/git/pull-requests error:', error);
    return NextResponse.json(
      { error: 'Failed to create pull request' },
      { status: 500 }
    );
  }
}
