import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import { validateBody } from '@/lib/validations/validate';
import { createNotificationSchema } from '@/lib/validations/schemas';
import { NotificationType } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * List notifications for the current user.
 * Query params: ?unread=true&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const { searchParams } = new URL(request.url);

    // Use session user ID
    const userId = (session.user as any)?.id ?? searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required (provide via auth session or userId query param)' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { userId };

    const unread = searchParams.get('unread');
    if (unread === 'true') {
      where.read = false;
    }

    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });

    // Also return the unread count for badge display
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a new notification.
 * Body: { type, title, description?, actionLabel?, actionHref?, userId, projectId? }
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const body = await request.json();

    const { data, error: validationError } = validateBody(createNotificationSchema, body);
    if (validationError) return validationError;

    const notification = await prisma.notification.create({
      data: {
        type: data.type as NotificationType,
        title: data.title,
        description: data.description?.trim() ?? '',
        actionLabel: data.actionLabel ?? null,
        actionHref: data.actionHref ?? null,
        userId: data.userId,
        projectId: data.projectId ?? null,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('POST /api/notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 * Body: { ids: string[] } to mark specific notifications as read
 *   OR  { markAllRead: true, userId: string } to mark all as read for a user
 */
export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const body = await request.json();

    const { ids, markAllRead, userId: bodyUserId } = body;

    if (markAllRead === true) {
      const userId = (session.user as any)?.id ?? bodyUserId;

      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required to mark all as read' },
          { status: 400 }
        );
      }

      const result = await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
      });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const result = await prisma.notification.updateMany({
        where: { id: { in: ids } },
        data: { read: true },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
      });
    }

    return NextResponse.json(
      { error: 'Provide either { ids: string[] } or { markAllRead: true }' },
      { status: 400 }
    );
  } catch (error) {
    console.error('PATCH /api/notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}
