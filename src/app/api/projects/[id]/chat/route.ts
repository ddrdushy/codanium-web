import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { validateBody } from '@/lib/validations/validate';
import { chatMessageSchema } from '@/lib/validations/schemas';

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
    const messages = await prisma.chatMessage.findMany({
      where: { projectId },
      include: {
        agent: {
          select: { id: true, name: true, shortName: true, avatar: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
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
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { data, error: validationError } = validateBody(chatMessageSchema, body);
    if (validationError) return validationError;

    const message = await prisma.chatMessage.create({
      data: {
        role: data.role,
        content: data.content,
        thinking: data.thinking ?? null,
        agentId: data.agentId ?? null,
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
