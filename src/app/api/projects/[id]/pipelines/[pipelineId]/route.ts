import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; pipelineId: string }>;
}

/**
 * GET /api/projects/:id/pipelines/:pipelineId
 * Get pipeline details with last 10 runs.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, pipelineId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const pipeline = await prisma.deploymentPipeline.findFirst({
      where: { id: pipelineId, projectId },
      include: {
        runs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found in this project' },
        { status: 404 }
      );
    }

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error('GET /api/projects/[id]/pipelines/[pipelineId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id/pipelines/:pipelineId
 * Update pipeline configuration, trigger, or environment.
 * Body: { name?, environment?, trigger?, config? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, pipelineId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();

    // Verify pipeline exists and belongs to project
    const existing = await prisma.deploymentPipeline.findFirst({
      where: { id: pipelineId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pipeline not found in this project' },
        { status: 404 }
      );
    }

    const allowedFields = ['name', 'environment', 'trigger', 'config'];
    const data: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'name') {
          data[field] = (body[field] as string).trim();
        } else if (field === 'config' && typeof body[field] === 'object') {
          data[field] = JSON.stringify(body[field]);
        } else {
          data[field] = body[field];
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const pipeline = await prisma.deploymentPipeline.update({
      where: { id: pipelineId },
      data,
    });

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/pipelines/[pipelineId] error:', error);
    return NextResponse.json(
      { error: 'Failed to update pipeline' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/pipelines/:pipelineId
 * Remove a pipeline and all its runs.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, pipelineId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    // Verify pipeline exists and belongs to project
    const existing = await prisma.deploymentPipeline.findFirst({
      where: { id: pipelineId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pipeline not found in this project' },
        { status: 404 }
      );
    }

    // Cascade delete handles runs automatically (onDelete: Cascade in schema)
    await prisma.deploymentPipeline.delete({ where: { id: pipelineId } });

    return NextResponse.json({ success: true, id: pipelineId });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/pipelines/[pipelineId] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete pipeline' },
      { status: 500 }
    );
  }
}
