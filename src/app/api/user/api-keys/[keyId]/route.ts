import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/user/api-keys/[keyId]
 * Revoke (soft-delete) an API key.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ keyId: string }> },
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { keyId } = await context.params;
    const userId = (session.user as any)?.id;

    // Verify key belongs to user
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: { userId: true, revokedAt: true },
    });

    if (!apiKey || apiKey.userId !== userId) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    if (apiKey.revokedAt) {
      return NextResponse.json({ error: 'API key already revoked' }, { status: 400 });
    }

    // Soft-delete by setting revokedAt
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/user/api-keys/[keyId] error:', err);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
