import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/sdlc
 * Returns SDLC stages for a project, ordered by stage order.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stages = await prisma.sDLCStage.findMany({
      where: { projectId: id },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(stages);
  } catch (error) {
    console.error('GET /api/projects/[id]/sdlc error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SDLC stages' },
      { status: 500 }
    );
  }
}
