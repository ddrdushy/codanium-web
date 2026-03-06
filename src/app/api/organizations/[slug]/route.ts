import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations/[slug]
 * Get organization details with members.
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

    const org = await prisma.organization.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarColor: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            color: true,
            completion: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
        _count: {
          select: { members: true, projects: true },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify membership
    const isMember = org.members.some((m) => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    return NextResponse.json(org);
  } catch (err) {
    console.error('GET /api/organizations/[slug] error:', err);
    return NextResponse.json({ error: 'Failed to load organization' }, { status: 500 });
  }
}

/**
 * PATCH /api/organizations/[slug]
 * Update organization name/slug. Auth: org owner/admin.
 *
 * Body: { name?, slug? }
 */
export async function PATCH(
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
        { error: 'Only organization owners and admins can update settings' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const data: Record<string, string> = {};

    if (body.name && typeof body.name === 'string') {
      data.name = body.name.trim();
    }

    if (body.slug && typeof body.slug === 'string') {
      const newSlug = body.slug
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-');

      // Check collision
      const existing = await prisma.organization.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== org.id) {
        return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
      }
      data.slug = newSlug;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/organizations/[slug] error:', err);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[slug]
 * Delete organization. Auth: org owner only.
 * Projects are detached (orgId set to null), not deleted.
 */
export async function DELETE(
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

    // Only owner can delete
    if (org.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Only the organization owner can delete it' },
        { status: 403 },
      );
    }

    // Detach projects and delete org in a transaction
    await prisma.$transaction(async (tx) => {
      // Detach projects (set orgId to null)
      await tx.project.updateMany({
        where: { orgId: org.id },
        data: { orgId: null },
      });

      // Delete org (cascade deletes members)
      await tx.organization.delete({ where: { id: org.id } });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/organizations/[slug] error:', err);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}
