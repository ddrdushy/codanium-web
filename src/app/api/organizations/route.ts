import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * Slugify a string — lowercase, replace spaces/special chars with hyphens.
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * GET /api/organizations
 * List organizations the current user belongs to.
 */
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = (session.user as any)?.id;

    const memberships = await prisma.orgMember.findMany({
      where: { userId },
      include: {
        org: {
          include: {
            _count: {
              select: {
                members: true,
                projects: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const orgs = memberships.map((m) => ({
      ...m.org,
      memberCount: m.org._count.members,
      projectCount: m.org._count.projects,
      myRole: m.role,
    }));

    return NextResponse.json(orgs);
  } catch (err) {
    console.error('GET /api/organizations error:', err);
    return NextResponse.json({ error: 'Failed to load organizations' }, { status: 500 });
  }
}

/**
 * POST /api/organizations
 * Create a new organization.
 *
 * Body: { name, slug? }
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = (session.user as any)?.id;
    const body = await request.json();
    const { name, slug: providedSlug } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    // Generate or validate slug
    let slug = providedSlug ? slugify(providedSlug) : slugify(name);

    if (!slug) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }

    // Check for collision and add suffix if needed
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      // Append random suffix
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${slug}-${suffix}`;
    }

    // Create org + owner membership in a transaction
    const org = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          name: name.trim(),
          slug,
          ownerId: userId,
        },
      });

      await tx.orgMember.create({
        data: {
          orgId: newOrg.id,
          userId,
          role: 'OWNER',
        },
      });

      return newOrg;
    });

    return NextResponse.json(org, { status: 201 });
  } catch (err) {
    console.error('POST /api/organizations error:', err);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
