import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import { addEmailJob } from '@/lib/queue/email-queue';
import { isRedisAvailable } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations/[slug]/members
 * List organization members with user details.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await context.params;
    const userId = (session.user as any)?.id;

    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify membership
    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId } },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    const members = await prisma.orgMember.findMany({
      where: { orgId: org.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarColor: true,
            lastLogin: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json(members);
  } catch (err) {
    console.error('GET /api/organizations/[slug]/members error:', err);
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/members
 * Invite a member by email. If user exists, add immediately.
 *
 * Body: { email, role? }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await context.params;
    const userId = (session.user as any)?.id;

    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify owner/admin
    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId } },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can invite members' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const validRoles = ['ADMIN', 'MEMBER', 'VIEWER'];
    const memberRole = validRoles.includes(role) ? role : 'MEMBER';

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true },
    });

    if (targetUser) {
      // Check if already a member
      const existing = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: org.id, userId: targetUser.id } },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 409 },
        );
      }

      // Add as member
      const member = await prisma.orgMember.create({
        data: {
          orgId: org.id,
          userId: targetUser.id,
          role: memberRole,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarColor: true },
          },
        },
      });

      // Send notification email
      if (await isRedisAvailable()) {
        const inviter = session.user as any;
        await addEmailJob({
          to: email.toLowerCase(),
          subject: `You've been added to ${org.name}`,
          template: 'team-invitation',
          props: {
            inviterName: inviter.name ?? 'Someone',
            projectName: org.name,
            role: memberRole.toLowerCase(),
            acceptUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/organizations/${slug}`,
          },
        });
      }

      return NextResponse.json(member, { status: 201 });
    }

    // User doesn't exist — send invitation email
    if (await isRedisAvailable()) {
      const inviter = session.user as any;
      await addEmailJob({
        to: email.toLowerCase(),
        subject: `You're invited to join ${org.name} on AI Team Studio`,
        template: 'team-invitation',
        props: {
          inviterName: inviter.name ?? 'Someone',
          projectName: org.name,
          role: memberRole.toLowerCase(),
          acceptUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/register`,
        },
      });
    }

    return NextResponse.json(
      { message: 'Invitation sent. User will be added when they register.' },
      { status: 202 },
    );
  } catch (err) {
    console.error('POST /api/organizations/[slug]/members error:', err);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}
