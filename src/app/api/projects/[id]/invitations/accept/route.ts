import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import { hashToken } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/invitations/accept
 * Accept a project invitation. Must be logged in with matching email.
 *
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 },
      );
    }

    // ── Find and validate invitation ─────────────────────────────────────
    const hashed = hashToken(token);

    const invitation = await prisma.projectInvitation.findUnique({
      where: { token: hashed },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 400 },
      );
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: `This invitation has been ${invitation.status.toLowerCase()}` },
        { status: 400 },
      );
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 },
      );
    }

    // ── Verify email matches ─────────────────────────────────────────────
    const userEmail = (session.user as any)?.email?.toLowerCase();
    if (userEmail !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 },
      );
    }

    const userId = (session.user as any)?.id;

    // ── Check if already a member ────────────────────────────────────────
    const existingMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: invitation.projectId, userId } },
    });

    if (existingMembership) {
      // Already a member — mark invitation as accepted
      await prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        project: invitation.project,
        message: 'You are already a member of this project',
      });
    }

    // ── Accept invitation: create membership + mark accepted ─────────────
    await prisma.$transaction([
      prisma.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId,
          role: invitation.role,
        },
      }),
      prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      project: invitation.project,
    });
  } catch (error) {
    console.error('POST /api/projects/[id]/invitations/accept error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 },
    );
  }
}
