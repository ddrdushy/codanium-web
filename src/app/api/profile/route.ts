import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile
 * Get the current user's profile.
 */
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      plan: true,
      avatarColor: true,
      lastLogin: true,
      createdAt: true,
      _count: {
        select: {
          ownedProjects: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    projectCount: user._count.ownedProjects,
    _count: undefined,
  });
}

/**
 * PATCH /api/profile
 * Update the current user's profile.
 * Body: { name?, avatarColor?, currentPassword?, newPassword? }
 */
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session.user as any).id;
  const body = await request.json();
  const { name, avatarColor, currentPassword, newPassword } = body;

  // Build update data
  const updateData: Record<string, any> = {};

  if (name && typeof name === 'string' && name.trim().length >= 2) {
    updateData.name = name.trim();
  }

  if (avatarColor && typeof avatarColor === 'string') {
    updateData.avatarColor = avatarColor;
  }

  // Password change
  if (currentPassword && newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: 'Cannot change password for OAuth accounts' },
        { status: 400 },
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 },
      );
    }

    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
    },
  });

  return NextResponse.json(updated);
}
