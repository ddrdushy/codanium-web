import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { runDeploy } from '@/lib/deploy/runner';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/:id/deploy
 * Trigger a deployment for a project.
 *
 * Body: { environment: 'staging' | 'production', branch?, commitHash? }
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
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const environment: 'staging' | 'production' = body.environment === 'production' ? 'production' : 'staging';

    const result = await runDeploy({
      projectId,
      environment,
      triggeredBy: session.user?.name ?? userId ?? 'user',
      commitHash: body.commitHash,
      branch: body.branch,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    console.error('POST /api/projects/[id]/deploy error:', err);
    return NextResponse.json({ error: 'Failed to trigger deployment' }, { status: 500 });
  }
}
