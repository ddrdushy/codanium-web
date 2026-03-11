import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/git/releases
 * List all releases for a project.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const releases = await prisma.gitRelease.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(releases);
  } catch (error) {
    console.error('GET /api/projects/[id]/git/releases error:', error);
    return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 500 });
  }
}

/**
 * POST /api/projects/:id/git/releases
 * Create a new release.
 * Body: { version, features?, status? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { version, features, status } = body;

    if (!version || typeof version !== 'string') {
      return NextResponse.json(
        { error: 'Release version is required' },
        { status: 400 }
      );
    }

    const release = await prisma.gitRelease.create({
      data: {
        version: version.trim(),
        status: status ?? 'DRAFT',
        features: features ?? [],
        projectId,
      },
    });

    return NextResponse.json(release, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/git/releases error:', error);
    return NextResponse.json(
      { error: 'Failed to create release' },
      { status: 500 }
    );
  }
}
