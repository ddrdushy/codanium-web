import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import { addGitSyncJob } from '@/lib/queue/git-sync-queue';
import { isRedisAvailable } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/git/sync
 * Trigger an immediate git sync for a project.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await context.params;

    // Verify membership
    const userId = (session.user as any)?.id;
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    // Verify git is configured
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        gitProvider: true,
        gitRepoOwner: true,
        gitRepoName: true,
        gitTokenEncrypted: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.gitTokenEncrypted || !project.gitRepoOwner || !project.gitRepoName) {
      return NextResponse.json(
        { error: 'Git integration is not configured for this project' },
        { status: 400 },
      );
    }

    // Queue the sync job
    if (!(await isRedisAvailable())) {
      return NextResponse.json(
        { error: 'Queue service unavailable. Cannot trigger sync.' },
        { status: 503 },
      );
    }

    const jobId = await addGitSyncJob({
      projectId: id,
      triggeredBy: 'manual',
    });

    return NextResponse.json({
      success: true,
      message: 'Git sync started',
      jobId,
    });
  } catch (err) {
    console.error('POST /api/projects/[id]/git/sync error:', err);
    return NextResponse.json({ error: 'Failed to trigger git sync' }, { status: 500 });
  }
}
