import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const wireframes = await prisma.wireframe.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(wireframes);
  } catch (error) {
    console.error('GET /api/projects/[id]/wireframes error:', error);
    return NextResponse.json({ error: 'Failed to fetch wireframes' }, { status: 500 });
  }
}
