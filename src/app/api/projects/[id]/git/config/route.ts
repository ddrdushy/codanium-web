import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { encrypt } from '@/lib/ai/encryption';
import { randomBytes } from 'crypto';
import { addRepeatableGitSync, removeRepeatableGitSync } from '@/lib/queue/git-sync-queue';
import { isRedisAvailable } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/git/config
 * Return git configuration for a project (token is redacted).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
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

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        gitProvider: true,
        gitRepoOwner: true,
        gitRepoName: true,
        gitDefaultBranch: true,
        gitTokenEncrypted: true,
        gitWebhookSecret: true,
        gitSyncEnabled: true,
        gitLastSyncAt: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      provider: project.gitProvider ?? null,
      repoOwner: project.gitRepoOwner ?? '',
      repoName: project.gitRepoName ?? '',
      defaultBranch: project.gitDefaultBranch ?? 'main',
      hasToken: !!project.gitTokenEncrypted,
      webhookSecret: project.gitWebhookSecret ?? null,
      syncEnabled: project.gitSyncEnabled,
      lastSyncAt: project.gitLastSyncAt,
    });
  } catch (err) {
    console.error('GET /api/projects/[id]/git/config error:', err);
    return NextResponse.json({ error: 'Failed to load git config' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]/git/config
 * Update git configuration for a project.
 *
 * Body: { provider?, repoOwner?, repoName?, defaultBranch?, token?, syncEnabled? }
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id } = await context.params;

    // Verify owner/admin membership
    const userId = (session.user as any)?.id;
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only project owners and admins can modify git config' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { provider, repoOwner, repoName, defaultBranch, token, syncEnabled } = body;

    // Build update data
    const data: Record<string, unknown> = {};

    if (provider !== undefined) data.gitProvider = provider;
    if (repoOwner !== undefined) data.gitRepoOwner = repoOwner;
    if (repoName !== undefined) data.gitRepoName = repoName;
    if (defaultBranch !== undefined) data.gitDefaultBranch = defaultBranch;

    // Encrypt token if provided (non-empty string)
    if (token && typeof token === 'string' && token.trim().length > 0) {
      data.gitTokenEncrypted = encrypt(token.trim());
    }

    // Generate webhook secret if not already set
    const project = await prisma.project.findUnique({
      where: { id },
      select: { gitWebhookSecret: true },
    });

    if (!project?.gitWebhookSecret) {
      data.gitWebhookSecret = randomBytes(32).toString('hex');
    }

    if (syncEnabled !== undefined) {
      data.gitSyncEnabled = Boolean(syncEnabled);
    }

    // Update project
    const updated = await prisma.project.update({
      where: { id },
      data,
      select: {
        gitProvider: true,
        gitRepoOwner: true,
        gitRepoName: true,
        gitDefaultBranch: true,
        gitTokenEncrypted: true,
        gitWebhookSecret: true,
        gitSyncEnabled: true,
        gitLastSyncAt: true,
      },
    });

    // Manage repeatable sync job
    if (await isRedisAvailable()) {
      if (updated.gitSyncEnabled && updated.gitTokenEncrypted && updated.gitRepoOwner && updated.gitRepoName) {
        await addRepeatableGitSync(id);
      } else {
        await removeRepeatableGitSync(id);
      }
    }

    return NextResponse.json({
      provider: updated.gitProvider,
      repoOwner: updated.gitRepoOwner ?? '',
      repoName: updated.gitRepoName ?? '',
      defaultBranch: updated.gitDefaultBranch ?? 'main',
      hasToken: !!updated.gitTokenEncrypted,
      webhookSecret: updated.gitWebhookSecret,
      syncEnabled: updated.gitSyncEnabled,
      lastSyncAt: updated.gitLastSyncAt,
    });
  } catch (err) {
    console.error('PUT /api/projects/[id]/git/config error:', err);
    return NextResponse.json({ error: 'Failed to update git config' }, { status: 500 });
  }
}
