import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { validateBody } from '@/lib/validations/validate';
import { createWireframeSchema, updateWireframeSchema } from '@/lib/validations/schemas';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/wireframes
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;

    // Fetch from wireframes table
    const wireframes = await prisma.wireframe.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });

    // Also fetch WIREFRAME and DESIGN_SYSTEM documents created by UX/UI agents
    const designDocs = await prisma.document.findMany({
      where: {
        projectId,
        type: { in: ['WIREFRAME', 'DESIGN_SYSTEM'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Merge: convert documents into wireframe-compatible shape
    const docWireframes = designDocs.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      screen: doc.type === 'DESIGN_SYSTEM' ? 'Design System' : doc.title,
      status: doc.status === 'APPROVED' ? 'approved' : 'review',
      device: 'desktop' as const,
      owner: 'UX Designer',
      ownerAvatar: '',
      lastUpdated: doc.updatedAt?.toISOString() ?? doc.createdAt.toISOString(),
      components: 0,
      version: doc.version ?? 1,
      content: doc.content,
      type: doc.type,
      isDocument: true,
    }));

    return NextResponse.json([...docWireframes, ...wireframes]);
  } catch (error) {
    console.error('GET /api/projects/[id]/wireframes error:', error);
    return NextResponse.json({ error: 'Failed to fetch wireframes' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/wireframes
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const body = await request.json();

    // Validate input
    const { data, error: validationError } = validateBody(createWireframeSchema, body);
    if (validationError) return validationError;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const wireframe = await prisma.wireframe.create({
      data: {
        title: data.title,
        screen: data.screen ?? '',
        device: data.device,
        status: data.status,
        owner: (session.user as any)?.name ?? 'Unknown',
        ownerAvatar: '🎨',
        projectId,
      },
    });

    return NextResponse.json(wireframe, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/wireframes error:', error);
    return NextResponse.json({ error: 'Failed to create wireframe' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/[id]/wireframes
// Body: { wireframeId, ...updateFields }
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const body = await request.json();

    const { wireframeId, ...updateFields } = body;

    if (!wireframeId || typeof wireframeId !== 'string') {
      return NextResponse.json({ error: 'wireframeId is required' }, { status: 400 });
    }

    // Verify wireframe belongs to this project
    const existing = await prisma.wireframe.findFirst({
      where: { id: wireframeId, projectId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Wireframe not found' }, { status: 404 });
    }

    // Validate update fields
    const { data, error: validationError } = validateBody(updateWireframeSchema, updateFields);
    if (validationError) return validationError;

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.screen !== undefined) updateData.screen = data.screen;
    if (data.device !== undefined) updateData.device = data.device;
    if (data.status !== undefined) updateData.status = data.status;

    const wireframe = await prisma.wireframe.update({
      where: { id: wireframeId },
      data: updateData,
    });

    return NextResponse.json(wireframe);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/wireframes error:', error);
    return NextResponse.json({ error: 'Failed to update wireframe' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]/wireframes?wireframeId=xxx
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const wireframeId = searchParams.get('wireframeId');

    if (!wireframeId) {
      return NextResponse.json(
        { error: 'wireframeId query param is required' },
        { status: 400 },
      );
    }

    // Verify wireframe belongs to this project
    const existing = await prisma.wireframe.findFirst({
      where: { id: wireframeId, projectId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Wireframe not found' }, { status: 404 });
    }

    await prisma.wireframe.delete({ where: { id: wireframeId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/wireframes error:', error);
    return NextResponse.json({ error: 'Failed to delete wireframe' }, { status: 500 });
  }
}
