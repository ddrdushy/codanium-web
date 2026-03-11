import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/memory
 * List all memories for a project with optional category filter.
 * Query params: ?category=idea (optional)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    const where: Record<string, unknown> = { projectId };
    if (category) {
      where.category = category;
    }

    const memories = await prisma.projectMemory.findMany({
      where,
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        category: true,
        content: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(memories);
  } catch (err) {
    console.error('GET /api/projects/[id]/memory error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects/[id]/memory
 * Add a new memory.
 * Body: { category, content, source? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const body = await request.json();

    const { category, content, source } = body;

    if (!category || !content) {
      return NextResponse.json(
        { error: 'category and content are required' },
        { status: 400 },
      );
    }

    const memory = await prisma.projectMemory.create({
      data: {
        projectId,
        category: String(category),
        content: String(content),
        source: source ? String(source) : 'user',
      },
    });

    return NextResponse.json(memory, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects/[id]/memory error:', err);
    return NextResponse.json(
      { error: 'Failed to create memory' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/projects/[id]/memory
 * Remove a memory by id.
 * Query params: ?memoryId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const url = new URL(request.url);
    const memoryId = url.searchParams.get('memoryId');

    if (!memoryId) {
      return NextResponse.json(
        { error: 'memoryId query parameter is required' },
        { status: 400 },
      );
    }

    // Verify the memory belongs to this project
    const existing = await prisma.projectMemory.findUnique({
      where: { id: memoryId },
      select: { projectId: true },
    });

    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 },
      );
    }

    await prisma.projectMemory.delete({
      where: { id: memoryId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id]/memory error:', err);
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 },
    );
  }
}
