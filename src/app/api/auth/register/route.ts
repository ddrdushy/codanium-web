import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateToken, hashToken, getAppUrl } from '@/lib/email';
import { addEmailJob } from '@/lib/queue';
import { isRedisAvailable } from '@/lib/redis';
import { validateBody } from '@/lib/validations/validate';
import { registerSchema } from '@/lib/validations/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/register
 * Create a new user account with email + password.
 * Sends verification email and optionally accepts a pending project invitation.
 *
 * Body: { name, email, password, invitationToken? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error: validationError } = validateBody(registerSchema, body);
    if (validationError) return validationError;

    const invitationToken = body.invitationToken;
    const normalizedEmail = data.email.toLowerCase();

    // ── Check for existing user ──────────────────────────────────────────────
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    // ── Create user ──────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
        plan: 'STARTER',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // ── Send verification email ──────────────────────────────────────────────
    try {
      const { raw, hashed } = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await prisma.emailToken.create({
        data: {
          type: 'VERIFICATION',
          token: hashed,
          email: normalizedEmail,
          expiresAt,
          userId: user.id,
        },
      });

      const appUrl = getAppUrl();
      const verificationUrl = `${appUrl}/api/auth/verify-email?token=${raw}`;

      if (await isRedisAvailable()) {
        await addEmailJob({
          to: normalizedEmail,
          subject: 'Verify Your Email — AI Team Studio',
          template: 'verification',
          props: {
            name: user.name,
            verificationUrl,
          },
        });
      }
    } catch (err) {
      console.error('[Register] Failed to send verification email:', err);
      // Non-fatal — user account is still created
    }

    // ── Auto-accept invitation if token provided ─────────────────────────────
    if (invitationToken && typeof invitationToken === 'string') {
      try {
        const invTokenHashed = hashToken(invitationToken);
        const invitation = await prisma.projectInvitation.findUnique({
          where: { token: invTokenHashed },
        });

        if (
          invitation &&
          invitation.status === 'PENDING' &&
          invitation.email.toLowerCase() === normalizedEmail &&
          new Date() < invitation.expiresAt
        ) {
          await prisma.$transaction([
            prisma.projectMember.create({
              data: {
                projectId: invitation.projectId,
                userId: user.id,
                role: invitation.role,
              },
            }),
            prisma.projectInvitation.update({
              where: { id: invitation.id },
              data: { status: 'ACCEPTED', acceptedAt: new Date() },
            }),
          ]);
        }
      } catch (err) {
        console.error('[Register] Failed to auto-accept invitation:', err);
        // Non-fatal — user can accept later
      }
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('POST /api/auth/register error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 },
    );
  }
}
