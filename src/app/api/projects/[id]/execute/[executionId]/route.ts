// =============================================================================
// AI Team Studio — Single Code Execution API
// =============================================================================
// GET /api/projects/:id/execute/:executionId — Get execution details + output
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; executionId: string }>;
}

/**
 * GET /api/projects/:id/execute/:executionId
 * Get full execution details including stdout/stderr.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, executionId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const execution = await prisma.codeExecution.findFirst({
      where: { id: executionId, projectId },
      include: {
        artifact: {
          select: { id: true, name: true, type: true, ownerAgent: true },
        },
      },
    });

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found in this project' },
        { status: 404 },
      );
    }

    return NextResponse.json(execution);
  } catch (error) {
    console.error('GET /api/projects/[id]/execute/[executionId] error:', error);
    return NextResponse.json(
      { error: 'Failed to get execution' },
      { status: 500 },
    );
  }
}
