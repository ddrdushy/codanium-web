import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
