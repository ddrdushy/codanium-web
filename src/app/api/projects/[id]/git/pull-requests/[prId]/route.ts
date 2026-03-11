import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; prId: string }>;
}

/**
 * PATCH /api/projects/:id/git/pull-requests/:prId
 * Update a pull request's status, checks, or comments count.
 * Body: { status?, checks?, comments?, reviewers?, additions?, deletions? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, prId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();

    // Verify PR exists and belongs to project
    const existing = await prisma.gitPullRequest.findFirst({
      where: { id: prId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pull request not found in this project' },
        { status: 404 }
      );
    }

    const allowedFields = ['status', 'checks', 'comments', 'reviewers', 'additions', 'deletions'];
    const data: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const pullRequest = await prisma.gitPullRequest.update({
      where: { id: prId },
      data,
    });

    return NextResponse.json(pullRequest);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/git/pull-requests/[prId] error:', error);
    return NextResponse.json(
      { error: 'Failed to update pull request' },
      { status: 500 }
    );
  }
}
