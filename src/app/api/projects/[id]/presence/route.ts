import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/presence
 * List online users for a project (seen within last 60 seconds).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const cutoff = new Date(Date.now() - 60000); // 60s ago

  const presenceRecords = await prisma.userPresence.findMany({
    where: {
      projectId,
      lastSeenAt: { gte: cutoff },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarColor: true,
        },
      },
    },
    orderBy: { lastSeenAt: 'desc' },
  });

  const users = presenceRecords.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    email: p.user.email,
    avatarColor: p.user.avatarColor,
    status: p.status,
    lastSeenAt: p.lastSeenAt.toISOString(),
  }));

  return NextResponse.json({ users });
}

/**
 * POST /api/projects/[id]/presence
 * Heartbeat: upsert presence record for current user.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as any).id;

  await prisma.userPresence.upsert({
    where: {
      userId_projectId: { userId, projectId },
    },
    update: {
      lastSeenAt: new Date(),
      status: 'online',
    },
    create: {
      userId,
      projectId,
      status: 'online',
    },
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/projects/[id]/presence
 * Leave: remove presence record for current user.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as any).id;

  await prisma.userPresence.deleteMany({
    where: { userId, projectId },
  });

  return NextResponse.json({ success: true });
}
