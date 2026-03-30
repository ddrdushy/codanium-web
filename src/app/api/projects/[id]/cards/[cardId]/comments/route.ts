import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; cardId: string }>;
}

/**
 * GET /api/projects/:id/cards/:cardId/comments
 * Returns all comments for a card, ordered by creation time.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cardId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    // Verify card exists and belongs to project
    const card = await prisma.card.findFirst({
      where: { id: cardId, projectId },
      select: { id: true },
    });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found in this project' },
        { status: 404 }
      );
    }

    const comments = await prisma.cardComment.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('GET /api/projects/[id]/cards/[cardId]/comments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/cards/:cardId/comments
 * Creates a new comment on a card.
 * Body: { agentName, content, type? }
 * type: COMMENT | SIGN_OFF | REJECTION | REWORK_REQUEST (defaults to COMMENT)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cardId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { agentName, content, type } = body;

    if (!agentName || !content) {
      return NextResponse.json(
        { error: 'agentName and content are required' },
        { status: 400 }
      );
    }

    // Verify card exists and belongs to project
    const card = await prisma.card.findFirst({
      where: { id: cardId, projectId },
      select: { id: true },
    });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found in this project' },
        { status: 404 }
      );
    }

    const validTypes = ['COMMENT', 'SIGN_OFF', 'REJECTION', 'REWORK_REQUEST'];
    const commentType = validTypes.includes(type) ? type : 'COMMENT';

    const comment = await prisma.cardComment.create({
      data: {
        cardId,
        agentName,
        content,
        type: commentType,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/cards/[cardId]/comments error:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
