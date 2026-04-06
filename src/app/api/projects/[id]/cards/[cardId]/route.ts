import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { createCardBranch, mergeBranch } from '@/lib/git/repo-manager';
import {
  validateCardTransition,
  CardState as LifecycleCardState,
  CardType as LifecycleCardType,
} from '@/lib/ai/orchestration/card-lifecycle';
import { recalculateProjectCompletion } from '@/lib/completion-calculator';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; cardId: string }>;
}

/**
 * GET /api/projects/:id/cards/:cardId
 * Returns a single card with its comments and token usage summary.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cardId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const card = await prisma.card.findFirst({
      where: { id: cardId, projectId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        ownerAgent: {
          select: { id: true, name: true, shortName: true, avatar: true },
        },
        children: {
          select: { id: true, title: true, state: true, priority: true },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found in this project' },
        { status: 404 }
      );
    }

    // Aggregate token usage for this card
    const tokenUsage = await prisma.lLMUsage.aggregate({
      where: { projectId, cardId },
      _sum: {
        tokensUsed: true,
        promptTokens: true,
        completionTokens: true,
        actualCost: true,
      },
    });

    return NextResponse.json({
      ...card,
      tokenUsage: {
        totalTokens: tokenUsage._sum.tokensUsed ?? 0,
        promptTokens: tokenUsage._sum.promptTokens ?? 0,
        completionTokens: tokenUsage._sum.completionTokens ?? 0,
        totalCost: tokenUsage._sum.actualCost ?? 0,
      },
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/cards/[cardId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id/cards/:cardId
 * Update a card's fields: state, title, description, priority, type, assigneeId, ownerAgentId, parentId, linkedDecisionId.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cardId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const body = await request.json();

    // Verify card exists and belongs to project
    const existing = await prisma.card.findFirst({
      where: { id: cardId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Card not found in this project' },
        { status: 404 }
      );
    }

    const allowedFields = [
      'title',
      'description',
      'type',
      'state',
      'priority',
      'assigneeId',
      'ownerAgentId',
      'parentId',
      'linkedDecisionId',
      'module',
    ];

    const data: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'title' || field === 'description') {
          data[field] = (body[field] as string).trim();
        } else {
          // Allow null to clear optional relations
          data[field] = body[field];
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // ── Definition of Done Validation ───────────────────────────────────
    // When changing card state, validate the transition is allowed
    if (data.state && data.state !== existing.state) {
      const transitionResult = await validateCardTransition(
        cardId,
        projectId,
        existing.state as LifecycleCardState,
        data.state as LifecycleCardState,
        existing.type as LifecycleCardType,
      );
      if (!transitionResult.allowed) {
        return NextResponse.json(
          {
            error: transitionResult.reason,
            requirements: transitionResult.requirements,
            currentState: existing.state,
            requestedState: data.state,
          },
          { status: 422 }
        );
      }
    }

    const card = await prisma.card.update({
      where: { id: cardId },
      data,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        ownerAgent: {
          select: { id: true, name: true, shortName: true, avatar: true },
        },
        children: {
          select: { id: true, title: true, state: true, priority: true },
        },
      },
    });

    // ── Git Branch Lifecycle ──────────────────────────────────────────────
    // When card → IN_PROGRESS: create a feature branch
    // When card → DONE: merge the branch into main
    if (body.state) {
      try {
        if (body.state === 'IN_PROGRESS' && !existing.gitBranchId) {
          const { branchId } = await createCardBranch(projectId, cardId, existing.title);
          await prisma.card.update({
            where: { id: cardId },
            data: { gitBranchId: branchId },
          });
        } else if (body.state === 'DONE' && existing.gitBranchId) {
          await mergeBranch(existing.gitBranchId, projectId);
        }
      } catch (gitErr) {
        console.error(`[Card PATCH] Git branch operation failed for card ${cardId}:`, gitErr);
        // Non-fatal: card state change succeeds even if git fails
      }
    }

    // Recalculate project completion when card state changes
    if (body.state) {
      await recalculateProjectCompletion(projectId).catch(console.error);
    }

    return NextResponse.json(card);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/cards/[cardId] error:', error);
    return NextResponse.json(
      { error: 'Failed to update card' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/cards/:cardId
 * Delete a card from a project.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cardId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    // Verify card exists and belongs to project
    const existing = await prisma.card.findFirst({
      where: { id: cardId, projectId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Card not found in this project' },
        { status: 404 }
      );
    }

    await prisma.card.delete({ where: { id: cardId } });

    return NextResponse.json({ success: true, id: cardId });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/cards/[cardId] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete card' },
      { status: 500 }
    );
  }
}
