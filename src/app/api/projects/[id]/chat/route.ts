import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/chat
 * List chat messages for a project (most recent first, with agent data).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);

    const messages = await prisma.chatMessage.findMany({
      where: { projectId },
      include: {
        agent: {
          select: { id: true, name: true, shortName: true, avatar: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('GET /api/projects/[id]/chat error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/chat
 * Send a new chat message.
 * Body: { role: 'USER' | 'AGENT' | 'SYSTEM', content: string, agentId?: string, thinking?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const validRoles = ['USER', 'AGENT', 'SYSTEM'];
    const role = validRoles.includes(body.role) ? body.role : 'USER';

    const message = await prisma.chatMessage.create({
      data: {
        role,
        content: body.content.trim(),
        thinking: body.thinking?.trim() ?? null,
        agentId: body.agentId ?? null,
        projectId,
      },
      include: {
        agent: {
          select: { id: true, name: true, shortName: true, avatar: true, status: true },
        },
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/chat error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
