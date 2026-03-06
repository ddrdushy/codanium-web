import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import { ArtifactType } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; artifactId: string }> };

/**
 * GET /api/projects/[id]/artifacts/[artifactId]
 * Get a single artifact with full content.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId, artifactId } = await params;
    const { session, error } = await requireAuth();
    if (error) return error;

    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, projectId },
    });

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    return NextResponse.json(artifact);
  } catch (error) {
    console.error('GET /api/projects/[id]/artifacts/[artifactId] error:', error);
    return NextResponse.json({ error: 'Failed to fetch artifact' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/artifacts/[artifactId]
 * Update an artifact.
 * Body: { name?, content?, type? }
 * If content is changed, version is auto-incremented.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId, artifactId } = await params;
    const { session, error } = await requireAuth();
    if (error) return error;
    const body = await request.json();

    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, projectId },
    });

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = body.name.trim();

    if (body.type !== undefined) {
      const validTypes: ArtifactType[] = ['CODE', 'DOCUMENT', 'CONFIG', 'WIREFRAME', 'TEST'];
      if (validTypes.includes(body.type as ArtifactType)) {
        updateData.type = body.type as ArtifactType;
      }
    }

    if (body.content !== undefined) {
      updateData.content = body.content;
      // Auto-increment version when content changes
      updateData.version = artifact.version + 1;
    }

    const updated = await prisma.artifact.update({
      where: { id: artifactId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/artifacts/[artifactId] error:', error);
    return NextResponse.json({ error: 'Failed to update artifact' }, { status: 500 });
  }
}
