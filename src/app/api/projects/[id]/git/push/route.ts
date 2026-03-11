import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { addGitPushJob } from '@/lib/queue/git-push-queue';
import { isRedisAvailable } from '@/lib/redis';
import { validateBody } from '@/lib/validations/validate';
import { gitPushSchema } from '@/lib/validations/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/git/push
 * Queue a git push job to push project artifacts to GitHub.
 *
 * Body: {
 *   branchName?: string;     // defaults to "ai-team-studio/delivery-{timestamp}"
 *   commitMessage?: string;  // defaults to "AI Team Studio: deliver project artifacts"
 *   createPR?: boolean;      // defaults to true
 *   prTitle?: string;        // defaults to commitMessage
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const userId = (session.user as any)?.id;

    // Verify membership
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this project' },
        { status: 403 },
      );
    }

    // Verify git is configured
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        gitProvider: true,
        gitRepoOwner: true,
        gitRepoName: true,
        gitTokenEncrypted: true,
        gitDefaultBranch: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.gitTokenEncrypted || !project.gitRepoOwner || !project.gitRepoName) {
      return NextResponse.json(
        { error: 'Git integration is not configured. Go to Settings to connect your GitHub repository.' },
        { status: 400 },
      );
    }

    // Check that artifacts exist
    const artifactCount = await prisma.artifact.count({
      where: { projectId },
    });

    if (artifactCount === 0) {
      return NextResponse.json(
        { error: 'No artifacts to push. Generate some files first by chatting with your AI team.' },
        { status: 400 },
      );
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const { data: pushData, error: validationError } = validateBody(gitPushSchema, body);
    if (validationError) return validationError;

    const timestamp = Date.now();
    const branchName = pushData.branchName || `ai-team-studio/delivery-${timestamp}`;
    const commitMessage = pushData.commitMessage || 'AI Team Studio: deliver project artifacts';
    const createPR = pushData.createPR;
    const prTitle = body.prTitle?.trim() || undefined;

    // Prevent pushing to default branch
    const defaultBranch = project.gitDefaultBranch ?? 'main';
    if (branchName === defaultBranch || branchName === 'main' || branchName === 'master') {
      return NextResponse.json(
        { error: 'Cannot push directly to the default branch. Use a feature branch instead.' },
        { status: 400 },
      );
    }

    // Check Redis availability
    if (!(await isRedisAvailable())) {
      return NextResponse.json(
        { error: 'Queue service unavailable. Cannot start push.' },
        { status: 503 },
      );
    }

    // Queue the push job
    const jobId = await addGitPushJob({
      projectId,
      branchName,
      commitMessage,
      createPR,
      prTitle,
      triggeredBy: userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Push started',
      jobId,
      branchName,
      artifactCount,
    });
  } catch (err) {
    console.error('POST /api/projects/[id]/git/push error:', err);
    return NextResponse.json(
      { error: 'Failed to start push' },
      { status: 500 },
    );
  }
}
