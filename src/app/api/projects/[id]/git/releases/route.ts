import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const releases = await prisma.gitRelease.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(releases);
  } catch (error) {
    console.error('GET /api/projects/[id]/git/releases error:', error);
    return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 500 });
  }
}
