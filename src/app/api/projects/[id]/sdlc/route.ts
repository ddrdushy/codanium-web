import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/sdlc
 * Returns SDLC stages for a project, ordered by stage order.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
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

/**
 * PATCH /api/projects/[id]/sdlc
 * Update a stage's status or gatePassed.
 * Body: { stageId: string, status?: string, gatePassed?: boolean }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: projectId } = await params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { stageId, status, gatePassed } = body;

    if (!stageId) {
      return NextResponse.json({ error: 'stageId is required' }, { status: 400 });
    }

    // Verify stage belongs to project
    const existing = await prisma.sDLCStage.findFirst({
      where: { id: stageId, projectId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Stage not found in this project' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (gatePassed !== undefined) data.gatePassed = gatePassed;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.sDLCStage.update({
      where: { id: stageId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/sdlc error:', error);
    return NextResponse.json(
      { error: 'Failed to update SDLC stage' },
      { status: 500 }
    );
  }
}
