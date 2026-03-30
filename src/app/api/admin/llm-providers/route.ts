import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/ai/encryption';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/llm-providers
 * Returns all platform-level provider configs, ordered by priority.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const configs = await prisma.lLMProviderConfig.findMany({
      where: { scope: 'PLATFORM' },
      orderBy: { priority: 'asc' },
    });

    return NextResponse.json(
      configs.map((c) => ({
        id: c.id,
        provider: c.provider,
        displayName: c.displayName,
        baseUrl: c.baseUrl ?? '',
        defaultModel: c.defaultModel,
        priority: c.priority,
        isActive: c.isActive,
        createdAt: c.createdAt,
      }))
    );
  } catch (err) {
    console.error('GET /api/admin/llm-providers error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch platform providers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/llm-providers
 * Creates a new platform provider config.
 * Body: { provider, displayName, apiKey, baseUrl?, defaultModel, priority, isActive? }
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { provider, displayName, apiKey, baseUrl, defaultModel, priority, isActive } = body;

    if (!provider || !defaultModel) {
      return NextResponse.json(
        { error: 'provider and defaultModel are required' },
        { status: 400 }
      );
    }

    const encryptedKey = apiKey ? encrypt(apiKey) : null;

    const config = await prisma.lLMProviderConfig.create({
      data: {
        scope: 'PLATFORM',
        provider,
        displayName: displayName || provider,
        apiKeyEncrypted: encryptedKey,
        baseUrl: baseUrl || null,
        defaultModel,
        priority: typeof priority === 'number' ? priority : 0,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({
      id: config.id,
      provider: config.provider,
      displayName: config.displayName,
      baseUrl: config.baseUrl ?? '',
      defaultModel: config.defaultModel,
      priority: config.priority,
      isActive: config.isActive,
      createdAt: config.createdAt,
    });
  } catch (err) {
    console.error('POST /api/admin/llm-providers error:', err);
    return NextResponse.json(
      { error: 'Failed to create platform provider' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/llm-providers?id=<configId>
 * Removes a platform provider config by ID.
 */
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.lLMProviderConfig.findFirst({
      where: { id, scope: 'PLATFORM' },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Platform provider config not found' },
        { status: 404 }
      );
    }

    await prisma.lLMProviderConfig.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('DELETE /api/admin/llm-providers error:', err);
    return NextResponse.json(
      { error: 'Failed to delete platform provider' },
      { status: 500 }
    );
  }
}
