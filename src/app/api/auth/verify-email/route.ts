import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken, getAppUrl } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/verify-email?token=<raw-token>
 * Verify a user's email address using the token from the verification email.
 * Redirects to /projects?verified=true on success, /login?error=invalid-token on failure.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawToken = searchParams.get('token');
    const appUrl = getAppUrl();

    if (!rawToken) {
      return NextResponse.redirect(`${appUrl}/login?error=missing-token`);
    }

    // Hash the incoming token and look it up
    const hashed = hashToken(rawToken);

    const emailToken = await prisma.emailToken.findUnique({
      where: { token: hashed },
    });

    if (!emailToken) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid-token`);
    }

    // Check type
    if (emailToken.type !== 'VERIFICATION') {
      return NextResponse.redirect(`${appUrl}/login?error=invalid-token`);
    }

    // Check if already used
    if (emailToken.usedAt) {
      return NextResponse.redirect(`${appUrl}/login?error=token-used`);
    }

    // Check expiry
    if (new Date() > emailToken.expiresAt) {
      return NextResponse.redirect(`${appUrl}/login?error=token-expired`);
    }

    // Verify the user's email
    await prisma.$transaction([
      // Mark user as verified
      prisma.user.update({
        where: { email: emailToken.email },
        data: { emailVerified: new Date() },
      }),
      // Mark token as used
      prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.redirect(`${appUrl}/projects?verified=true`);
  } catch (error) {
    console.error('GET /api/auth/verify-email error:', error);
    const appUrl = getAppUrl();
    return NextResponse.redirect(`${appUrl}/login?error=verification-failed`);
  }
}
