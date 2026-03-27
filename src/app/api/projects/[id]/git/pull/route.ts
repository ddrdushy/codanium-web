import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { pullBranchFiles } from '@/lib/git/pull';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/git/pull
 * Pull files from a GitHub branch into the project's artifact store.
 * Body: { branch?: string }  — defaults to the project's default branch.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const userId  = (session.user as any)?.id as string;
    const isAdmin = (session.user as any)?.role === 'admin';

    // Verify project membership
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    });
    if (!member && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body   = await request.json().catch(() => ({}));
    const branch = typeof body.branch === 'string' ? body.branch : undefined;

    const result = await pullBranchFiles({ projectId, branch, triggeredBy: userId });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pull failed';
    console.error('[git/pull] error:', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
