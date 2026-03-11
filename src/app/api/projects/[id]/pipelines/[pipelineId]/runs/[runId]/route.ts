import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; pipelineId: string; runId: string }>;
}

/**
 * GET /api/projects/:id/pipelines/:pipelineId/runs/:runId
 * Get run details with logs.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, pipelineId, runId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const run = await prisma.deploymentRun.findFirst({
      where: { id: runId, pipelineId, projectId },
      include: {
        pipeline: {
          select: { id: true, name: true, environment: true, trigger: true },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Deployment run not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error('GET /api/projects/[id]/pipelines/[pipelineId]/runs/[runId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployment run' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id/pipelines/:pipelineId/runs/:runId
 * Cancel a run or update its logs/status.
 * Body: { status?, currentStage?, buildLogs?, testLogs?, deployLogs?, errorMessage?, durationMs? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, pipelineId, runId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();

    // Verify run exists and belongs to pipeline/project
    const existing = await prisma.deploymentRun.findFirst({
      where: { id: runId, pipelineId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Deployment run not found' },
        { status: 404 }
      );
    }

    const allowedFields = [
      'status', 'currentStage', 'buildLogs', 'testLogs',
      'deployLogs', 'errorMessage', 'durationMs',
    ];
    const data: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    // If cancelling, set completedAt
    if (body.status === 'CANCELLED' || body.status === 'FAILED' || body.status === 'SUCCESS') {
      data.completedAt = new Date();
    }

    // If starting, set startedAt
    if (body.status === 'RUNNING' && !existing.startedAt) {
      data.startedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const run = await prisma.deploymentRun.update({
      where: { id: runId },
      data,
    });

    return NextResponse.json(run);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/pipelines/[pipelineId]/runs/[runId] error:', error);
    return NextResponse.json(
      { error: 'Failed to update deployment run' },
      { status: 500 }
    );
  }
}
