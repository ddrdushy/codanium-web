import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import type { UserRole, UserStatus, UserPlan } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * List all users with pagination, search, and role filter.
 * Query params: ?page=1&limit=20&search=john&role=ADMIN
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const search = searchParams.get('search')?.trim();
    const role = searchParams.get('role');

    const where: Record<string, unknown> = {};

    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by role
    if (role) {
      where.role = role as UserRole;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          plan: true,
          avatarColor: true,
          lastLogin: true,
          createdAt: true,
          _count: {
            select: {
              ownedProjects: true,
              projectMembers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const result = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      plan: user.plan,
      avatarColor: user.avatarColor,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      ownedProjectCount: user._count.ownedProjects,
      membershipCount: user._count.projectMembers,
    }));

    return NextResponse.json({
      users: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

const VALID_ACTIONS = ['suspend', 'unsuspend', 'changeRole', 'changePlan', 'resetPassword'] as const;
type AdminAction = (typeof VALID_ACTIONS)[number];

const VALID_ROLES: UserRole[] = ['ADMIN', 'USER'];
const VALID_PLANS: UserPlan[] = ['STARTER', 'PRO', 'ENTERPRISE'];

/**
 * PATCH /api/admin/users
 * Perform admin actions on a user: suspend, unsuspend, changeRole, changePlan, resetPassword.
 * Body: { userId: string, action: string, value?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { userId, action, value } = body as {
      userId?: string;
      action?: string;
      value?: string;
    };

    // Validate required fields
    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and action' },
        { status: 400 }
      );
    }

    // Validate action
    if (!VALID_ACTIONS.includes(action as AdminAction)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check user exists
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const adminId = (session!.user as any).id;
    const ipAddress = request.headers.get('x-forwarded-for') ?? 'unknown';

    let updateData: Record<string, unknown> = {};
    let auditDetails = '';

    switch (action as AdminAction) {
      case 'suspend':
        updateData = { status: 'SUSPENDED' as UserStatus };
        auditDetails = `Suspended user ${targetUser.email}`;
        break;

      case 'unsuspend':
        updateData = { status: 'ACTIVE' as UserStatus };
        auditDetails = `Unsuspended user ${targetUser.email}`;
        break;

      case 'changeRole': {
        if (!value || !VALID_ROLES.includes(value as UserRole)) {
          return NextResponse.json(
            { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
            { status: 400 }
          );
        }
        updateData = { role: value as UserRole };
        auditDetails = `Changed role of ${targetUser.email} from ${targetUser.role} to ${value}`;
        break;
      }

      case 'changePlan': {
        if (!value || !VALID_PLANS.includes(value as UserPlan)) {
          return NextResponse.json(
            { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
            { status: 400 }
          );
        }
        updateData = { plan: value as UserPlan };
        auditDetails = `Changed plan of ${targetUser.email} from ${targetUser.plan} to ${value}`;
        break;
      }

      case 'resetPassword':
        // No user update needed — just create audit log for now
        auditDetails = `Password reset requested for ${targetUser.email}`;
        break;
    }

    // Update user if there are fields to change
    let updatedUser = targetUser;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: `admin.${action}`,
        target: `user:${userId}`,
        details: auditDetails,
        ipAddress,
        userId: adminId,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        plan: updatedUser.plan,
      },
    });
  } catch (error) {
    console.error('PATCH /api/admin/users error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
