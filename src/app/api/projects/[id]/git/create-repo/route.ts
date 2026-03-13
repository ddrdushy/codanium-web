import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { createProjectRepo } from '@/lib/git/create-repo';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/git/create-repo
 *
 * Create a new GitHub repository for the project and save the config.
 *
 * Body: {
 *   token: string;         // GitHub PAT (plain text)
 *   repoName: string;      // Repository name
 *   description?: string;  // Optional description
 *   org?: string;           // GitHub org (omit for personal account)
 *   isPrivate?: boolean;    // Default: true
 *   pushArtifacts?: boolean; // Push existing artifacts? Default: false
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id } = await context.params;
    const userId = (session.user as any)?.id;

    // Verify owner/admin membership
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only project owners and admins can create repositories' },
        { status: 403 },
      );
    }

    // Check if repo is already configured
    const project = await prisma.project.findUnique({
      where: { id },
      select: { gitRepoName: true, gitRepoOwner: true },
    });

    if (project?.gitRepoName && project?.gitRepoOwner) {
      return NextResponse.json(
        { error: `Repository already configured: ${project.gitRepoOwner}/${project.gitRepoName}. Disconnect the current repo first.` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const { token, repoName, description, org, isPrivate, pushArtifacts } = body;

    // Validate required fields
    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return NextResponse.json(
        { error: 'A valid GitHub Personal Access Token is required' },
        { status: 400 },
      );
    }

    if (!repoName || typeof repoName !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(repoName.trim())) {
      return NextResponse.json(
        { error: 'Invalid repository name. Use only letters, numbers, dots, hyphens, and underscores.' },
        { status: 400 },
      );
    }

    const result = await createProjectRepo({
      projectId: id,
      token: token.trim(),
      repoName: repoName.trim(),
      description,
      org: org?.trim() || undefined,
      isPrivate: isPrivate ?? true,
      pushArtifacts: pushArtifacts ?? false,
      triggeredBy: userId,
    });

    return NextResponse.json({
      success: true,
      repo: {
        fullName: result.repo.fullName,
        htmlUrl: result.repo.htmlUrl,
        defaultBranch: result.repo.defaultBranch,
        isPrivate: result.repo.isPrivate,
      },
      pushJobId: result.pushJobId ?? null,
    });
  } catch (err: any) {
    console.error('POST /api/projects/[id]/git/create-repo error:', err);

    // Parse GitHub API errors
    const message = err?.response?.data?.message ?? err?.message ?? 'Failed to create repository';

    // Common GitHub error: repo already exists
    if (message.includes('name already exists')) {
      return NextResponse.json(
        { error: 'A repository with this name already exists on GitHub. Choose a different name.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
