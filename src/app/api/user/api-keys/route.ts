import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';
import { generateApiKey, API_KEY_LIMITS } from '@/lib/api-keys';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/api-keys
 * List the current user's API keys (without hashes).
 */
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = (session.user as any)?.id;

    const keys = await prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get user plan for limit info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const limit = API_KEY_LIMITS[user?.plan ?? 'STARTER'];

    return NextResponse.json({ keys, limit, used: keys.length });
  } catch (err) {
    console.error('GET /api/user/api-keys error:', err);
    return NextResponse.json({ error: 'Failed to load API keys' }, { status: 500 });
  }
}

/**
 * POST /api/user/api-keys
 * Create a new API key.
 *
 * Body: { name, scopes? }
 * Returns: key with raw value (shown only once)
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = (session.user as any)?.id;

    // Check plan limit
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const limit = API_KEY_LIMITS[user?.plan ?? 'STARTER'];
    const existing = await prisma.apiKey.count({
      where: { userId, revokedAt: null },
    });

    if (existing >= limit) {
      return NextResponse.json(
        { error: `API key limit reached (${limit} keys for ${user?.plan ?? 'STARTER'} plan)` },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name, scopes } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate key
    const { raw, hash, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        keyHash: hash,
        keyPrefix: prefix,
        scopes: Array.isArray(scopes) ? scopes : ['read'],
        userId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        createdAt: true,
      },
    });

    // Return with raw key (shown only once)
    return NextResponse.json(
      { ...apiKey, rawKey: raw },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/user/api-keys error:', err);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
