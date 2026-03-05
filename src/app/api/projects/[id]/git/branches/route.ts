import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const branches = await prisma.gitBranch.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(branches);
  } catch (error) {
    console.error('GET /api/projects/[id]/git/branches error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}
