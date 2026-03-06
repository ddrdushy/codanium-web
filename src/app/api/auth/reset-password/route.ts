import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/email';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-password
 * Set a new password using a valid reset token.
 *
 * Body: { token: string, password: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    // ── Validate inputs ──────────────────────────────────────────────────
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 },
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 },
      );
    }

    // ── Find and validate token ──────────────────────────────────────────
    const hashed = hashToken(token);

    const emailToken = await prisma.emailToken.findUnique({
      where: { token: hashed },
    });

    if (!emailToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 },
      );
    }

    if (emailToken.type !== 'PASSWORD_RESET') {
      return NextResponse.json(
        { error: 'Invalid token type' },
        { status: 400 },
      );
    }

    if (emailToken.usedAt) {
      return NextResponse.json(
        { error: 'This reset token has already been used' },
        { status: 400 },
      );
    }

    if (new Date() > emailToken.expiresAt) {
      return NextResponse.json(
        { error: 'This reset token has expired. Please request a new one.' },
        { status: 400 },
      );
    }

    // ── Update password ──────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      // Update user's password
      prisma.user.update({
        where: { email: emailToken.email },
        data: { passwordHash },
      }),
      // Mark token as used
      prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/auth/reset-password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 },
    );
  }
}
