import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; pipelineId: string }>;
}

/**
 * GET /api/projects/:id/pipelines/:pipelineId/runs
 * List deployment runs for a pipeline (paginated).
 * Query: ?page=1&limit=20
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, pipelineId } = await context.params;
    const { session, error } = await requireAuth();
    if (error) return error;

    // Verify pipeline exists and belongs to project
    const pipeline = await prisma.deploymentPipeline.findFirst({
      where: { id: pipelineId, projectId },
      select: { id: true },
    });

    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found in this project' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      prisma.deploymentRun.findMany({
        where: { pipelineId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deploymentRun.count({ where: { pipelineId } }),
    ]);

    return NextResponse.json({ runs, total, page, limit });
  } catch (error) {
    console.error('GET /api/projects/[id]/pipelines/[pipelineId]/runs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployment runs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/pipelines/:pipelineId/runs
 * Trigger a new deployment run.
 * Body: { triggeredBy?, commitHash?, branch? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, pipelineId } = await context.params;
    const { session, error } = await requireAuth();
    if (error) return error;

    // Verify pipeline exists and belongs to project
    const pipeline = await prisma.deploymentPipeline.findFirst({
      where: { id: pipelineId, projectId },
      select: { id: true },
    });

    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found in this project' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { triggeredBy, commitHash, branch } = body;

    const run = await prisma.deploymentRun.create({
      data: {
        pipelineId,
        status: 'PENDING',
        currentStage: 'BUILD',
        triggeredBy: triggeredBy ?? session.user?.name ?? 'user',
        commitHash: commitHash ?? '',
        branch: branch ?? '',
        projectId,
      },
    });

    return NextResponse.json({ id: run.id, status: run.status }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/pipelines/[pipelineId]/runs error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger deployment run' },
      { status: 500 }
    );
  }
}
