import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { generateToken, getAppUrl } from '@/lib/email';
import { addEmailJob } from '@/lib/queue';
import { isRedisAvailable } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/invitations
 * List all invitations for a project. Requires owner/admin role.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const userId = (session.user as any)?.id;

    // Verify user is project owner or admin
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only project owners and admins can manage invitations' },
        { status: 403 },
      );
    }

    const invitations = await prisma.projectInvitation.findMany({
      where: { projectId },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('GET /api/projects/[id]/invitations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects/[id]/invitations
 * Send a new invitation to an email address. Requires owner/admin role.
 *
 * Body: { email: string, role?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const userId = (session.user as any)?.id;
    const body = await request.json();
    const { email, role } = body;

    // ── Validate inputs ──────────────────────────────────────────────────
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const inviteRole = role && ['admin', 'member', 'viewer'].includes(role) ? role : 'member';

    // ── Verify user is project owner or admin ────────────────────────────
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only project owners and admins can send invitations' },
        { status: 403 },
      );
    }

    // ── Check if already a member ────────────────────────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const existingMembership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: existingUser.id } },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: 'This user is already a member of the project' },
          { status: 409 },
        );
      }
    }

    // ── Check for existing pending invitation ────────────────────────────
    const existingInvitation = await prisma.projectInvitation.findUnique({
      where: { projectId_email: { projectId, email: normalizedEmail } },
    });

    if (existingInvitation && existingInvitation.status === 'PENDING') {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 409 },
      );
    }

    // If there's a revoked/expired invite, delete it first
    if (existingInvitation) {
      await prisma.projectInvitation.delete({
        where: { id: existingInvitation.id },
      });
    }

    // ── Create invitation ────────────────────────────────────────────────
    const { raw, hashed } = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.projectInvitation.create({
      data: {
        email: normalizedEmail,
        role: inviteRole,
        token: hashed,
        invitedById: userId,
        projectId,
        expiresAt,
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
      },
    });

    // ── Get project name for email ───────────────────────────────────────
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    // ── Dispatch invitation email ────────────────────────────────────────
    const appUrl = getAppUrl();
    const inviterName = session.user?.name ?? 'Someone';

    // Build accept URL — if user exists, direct to accept; if not, direct to signup
    const acceptUrl = existingUser
      ? `${appUrl}/projects?accept-invitation=${raw}`
      : `${appUrl}/signup?invitation=${raw}`;

    try {
      if (await isRedisAvailable()) {
        await addEmailJob({
          to: normalizedEmail,
          subject: `${inviterName} invited you to ${project?.name ?? 'a project'} — Codanium`,
          template: 'team-invitation',
          props: {
            inviterName,
            projectName: project?.name ?? 'a project',
            role: inviteRole,
            acceptUrl,
          },
        });
      }
    } catch (err) {
      console.error('[Invitations] Failed to queue email job:', err);
      // Non-fatal — invitation is still in DB
    }

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/invitations error:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/projects/[id]/invitations?id=<invitationId>
 * Revoke an invitation. Requires owner/admin role.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const userId = (session.user as any)?.id;
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 },
      );
    }

    // Verify user is project owner or admin
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only project owners and admins can revoke invitations' },
        { status: 403 },
      );
    }

    // Find and revoke
    const invitation = await prisma.projectInvitation.findFirst({
      where: { id: invitationId, projectId },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 },
      );
    }

    await prisma.projectInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/invitations error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 },
    );
  }
}
