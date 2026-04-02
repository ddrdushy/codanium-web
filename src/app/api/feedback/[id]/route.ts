import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** PATCH /api/feedback/[id] — update status/reply (admin only) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.status) data.status = body.status;
  if (body.adminReply !== undefined) data.adminReply = body.adminReply;

  const updated = await prisma.feedback.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
