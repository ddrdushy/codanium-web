import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-keys';

type AuthResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse };

/**
 * Require an authenticated session for an API route.
 * Usage:
 *   const { session, error } = await requireAuth();
 *   if (error) return error;
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/**
 * Require an authenticated session with ADMIN role.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if ((session.user as any).role !== 'admin') {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { session, error: null };
}

/**
 * Authenticate via API key (Authorization: Bearer ats_sk_...).
 * Returns a synthetic session object matching requireAuth() return type.
 */
export async function requireApiKey(): Promise<AuthResult> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Missing API key' }, { status: 401 }),
    };
  }

  const result = await validateApiKey(token);
  if (!result) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 }),
    };
  }

  // Load user to build synthetic session
  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { id: true, name: true, email: true, role: true, plan: true },
  });

  if (!user) {
    return {
      session: null,
      error: NextResponse.json({ error: 'User not found' }, { status: 401 }),
    };
  }

  // Build synthetic session matching NextAuth session shape
  const syntheticSession: Session = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.toLowerCase(),
      plan: user.plan,
    } as any,
    expires: new Date(Date.now() + 86400000).toISOString(), // 24h from now
  };

  return { session: syntheticSession, error: null };
}

/**
 * Try session auth first, fall back to API key auth.
 * Use this for routes that should work with both browser sessions and API keys.
 */
export async function requireAuthOrApiKey(): Promise<AuthResult> {
  // Try session auth first
  const session = await auth();
  if (session?.user) {
    return { session, error: null };
  }

  // Fall back to API key
  return requireApiKey();
}
