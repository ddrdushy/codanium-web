import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/projects/[id]/decisions/[decisionId]
 * Update a decision — approve, reject, or change status.
 * Body: { status?, approvedOption?, recommendation? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  try {
    const { id: projectId, decisionId } = await params;
    const body = await request.json();

    const decision = await prisma.decision.findFirst({
      where: { id: decisionId, projectId },
    });

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (body.status) updateData.status = body.status;
    if (body.approvedOption !== undefined) updateData.approvedOption = body.approvedOption;
    if (body.recommendation !== undefined) updateData.recommendation = body.recommendation;

    // Auto-set approvedAt when approving
    if (body.status === 'APPROVED' && !decision.approvedAt) {
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.decision.update({
      where: { id: decisionId },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true, avatarColor: true } },
        options: { orderBy: { name: 'asc' } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/decisions/[decisionId] error:', error);
    return NextResponse.json({ error: 'Failed to update decision' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/decisions/[decisionId]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  try {
    const { id: projectId, decisionId } = await params;

    const decision = await prisma.decision.findFirst({
      where: { id: decisionId, projectId },
    });

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    await prisma.decision.delete({ where: { id: decisionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/decisions/[decisionId] error:', error);
    return NextResponse.json({ error: 'Failed to delete decision' }, { status: 500 });
  }
}
