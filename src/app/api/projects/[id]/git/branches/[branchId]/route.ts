import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; branchId: string }>;
}

/**
 * PATCH /api/projects/:id/git/branches/:branchId
 * Update a branch's status or metadata.
 * Body: { status?, lastCommit?, behind?, ahead? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, branchId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();

    // Verify branch exists and belongs to project
    const existing = await prisma.gitBranch.findFirst({
      where: { id: branchId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Branch not found in this project' },
        { status: 404 }
      );
    }

    const allowedFields = ['status', 'lastCommit', 'behind', 'ahead'];
    const data: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const branch = await prisma.gitBranch.update({
      where: { id: branchId },
      data,
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/git/branches/[branchId] error:', error);
    return NextResponse.json(
      { error: 'Failed to update branch' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/git/branches/:branchId
 * Remove a branch from a project.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, branchId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    // Verify branch exists and belongs to project
    const existing = await prisma.gitBranch.findFirst({
      where: { id: branchId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Branch not found in this project' },
        { status: 404 }
      );
    }

    await prisma.gitBranch.delete({ where: { id: branchId } });

    return NextResponse.json({ success: true, id: branchId });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/git/branches/[branchId] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete branch' },
      { status: 500 }
    );
  }
}
