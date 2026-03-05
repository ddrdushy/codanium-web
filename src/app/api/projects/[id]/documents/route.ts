import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/documents
 * List all documents for a project.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const documents = await prisma.document.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('GET /api/projects/[id]/documents error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/documents
 * Create a new document.
 * Body: { title, type, content?, owner?, ownerAvatar? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const validTypes = ['BRD', 'SDD', 'API_SPEC', 'RUNBOOK', 'ADR'];
    const type = validTypes.includes(body.type) ? body.type : 'BRD';

    const content = body.content?.trim() ?? '';
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    const document = await prisma.document.create({
      data: {
        title: body.title.trim(),
        type,
        content,
        wordCount,
        sections: body.sections ?? 0,
        owner: body.owner ?? 'Unknown',
        ownerAvatar: body.ownerAvatar ?? '📋',
        projectId,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/documents error:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/documents
 * Update a document by id (passed in body).
 * Body: { id, title?, content?, status?, locked? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
    }

    const doc = await prisma.document.findFirst({
      where: { id: body.id, projectId },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.content !== undefined) {
      updateData.content = body.content;
      updateData.wordCount = body.content.split(/\s+/).filter(Boolean).length;
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.locked !== undefined) updateData.locked = body.locked;
    if (body.sections !== undefined) updateData.sections = body.sections;

    const updated = await prisma.document.update({
      where: { id: body.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/documents error:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
