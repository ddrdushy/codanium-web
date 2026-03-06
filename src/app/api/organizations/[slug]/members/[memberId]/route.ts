import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/organizations/[slug]/members/[memberId]
 * Update a member's role. Auth: org owner/admin.
 *
 * Body: { role }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string; memberId: string }> },
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug, memberId } = await context.params;
    const userId = (session.user as any)?.id;

    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify caller is owner/admin
    const callerMembership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId } },
    });

    if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can change roles' },
        { status: 403 },
      );
    }

    // Find target member
    const targetMember = await prisma.orgMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.orgId !== org.id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot change owner role
    if (targetMember.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot change the role of the organization owner' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { role } = body;

    const validRoles = ['ADMIN', 'MEMBER', 'VIEWER'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${validRoles.join(', ')}` },
        { status: 400 },
      );
    }

    const updated = await prisma.orgMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/organizations/[slug]/members/[memberId] error:', err);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[slug]/members/[memberId]
 * Remove a member from the organization.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ slug: string; memberId: string }> },
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug, memberId } = await context.params;
    const userId = (session.user as any)?.id;

    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify caller is owner/admin
    const callerMembership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId } },
    });

    if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can remove members' },
        { status: 403 },
      );
    }

    // Find target member
    const targetMember = await prisma.orgMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.orgId !== org.id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot remove owner
    if (targetMember.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot remove the organization owner' },
        { status: 403 },
      );
    }

    await prisma.orgMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/organizations/[slug]/members/[memberId] error:', err);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
