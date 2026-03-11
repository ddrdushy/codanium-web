import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/pipelines
 * List all deployment pipelines with latest run status.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const pipelines = await prisma.deploymentPipeline.findMany({
      where: { projectId },
      include: {
        runs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(pipelines);
  } catch (error) {
    console.error('GET /api/projects/[id]/pipelines error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipelines' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/pipelines
 * Create a new deployment pipeline.
 * Body: { name, environment?, trigger?, config? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { name, environment, trigger, config } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Pipeline name is required' },
        { status: 400 }
      );
    }

    const pipeline = await prisma.deploymentPipeline.create({
      data: {
        name: name.trim(),
        environment: environment ?? 'STAGING',
        trigger: trigger ?? 'MANUAL',
        config: config ? JSON.stringify(config) : '{}',
        projectId,
      },
    });

    return NextResponse.json(pipeline, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/pipelines error:', error);
    return NextResponse.json(
      { error: 'Failed to create pipeline' },
      { status: 500 }
    );
  }
}
