import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { ArtifactType } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/artifacts
 * List all artifacts for a project (excludes content for performance).
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const artifacts = await prisma.artifact.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        ownerAgent: true,
        version: true,
        createdAt: true,
        messageId: true,
      },
    });

    return NextResponse.json(artifacts);
  } catch (error) {
    console.error('GET /api/projects/[id]/artifacts error:', error);
    return NextResponse.json({ error: 'Failed to fetch artifacts' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/artifacts
 * Create a new artifact.
 * Body: { name, type, content, ownerAgent, version?, messageId? }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!body.type?.trim()) {
      return NextResponse.json({ error: 'Type is required' }, { status: 400 });
    }

    const validTypes: ArtifactType[] = ['CODE', 'DOCUMENT', 'CONFIG', 'WIREFRAME', 'TEST'];
    const type = validTypes.includes(body.type as ArtifactType)
      ? (body.type as ArtifactType)
      : 'CODE';

    const artifact = await prisma.artifact.create({
      data: {
        name: body.name.trim(),
        type,
        content: body.content?.trim() ?? '',
        ownerAgent: body.ownerAgent ?? 'unknown',
        version: body.version ?? 1,
        messageId: body.messageId ?? null,
        projectId,
      },
    });

    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/artifacts error:', error);
    return NextResponse.json({ error: 'Failed to create artifact' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/artifacts?id=xxx
 * Delete an artifact by id (passed as query parameter).
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const artifactId = request.nextUrl.searchParams.get('id');

    if (!artifactId) {
      return NextResponse.json({ error: 'Artifact id query parameter is required' }, { status: 400 });
    }

    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, projectId },
    });

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    await prisma.artifact.delete({
      where: { id: artifactId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/artifacts error:', error);
    return NextResponse.json({ error: 'Failed to delete artifact' }, { status: 500 });
  }
}
