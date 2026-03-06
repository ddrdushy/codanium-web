import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, getAppUrl } from '@/lib/email';
import { addEmailJob } from '@/lib/queue';
import { isRedisAvailable } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/forgot-password
 * Request a password reset email.
 * Always returns 200 regardless of whether the email exists (prevents enumeration).
 *
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user — but don't reveal whether they exist
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Generate secure token
      const { raw, hashed } = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save hashed token to DB
      await prisma.emailToken.create({
        data: {
          type: 'PASSWORD_RESET',
          token: hashed,
          email: normalizedEmail,
          expiresAt,
          userId: user.id,
        },
      });

      // Dispatch email job via BullMQ
      const appUrl = getAppUrl();
      const resetUrl = `${appUrl}/reset-password?token=${raw}`;

      try {
        if (await isRedisAvailable()) {
          await addEmailJob({
            to: normalizedEmail,
            subject: 'Reset Your Password — AI Team Studio',
            template: 'password-reset',
            props: {
              name: user.name,
              resetUrl,
            },
          });
        }
      } catch (err) {
        console.error('[ForgotPassword] Failed to queue email job:', err);
        // Non-fatal — token is still in DB
      }
    }

    // Always return success (prevent email enumeration)
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('POST /api/auth/forgot-password error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 },
    );
  }
}
