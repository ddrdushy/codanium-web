import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { encrypt, decrypt, isEncrypted } from '@/lib/ai/encryption';
import type { Session } from 'next-auth';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mask API key to show only last 4 characters. Decrypts first if encrypted. */
function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  try {
    const raw = isEncrypted(key) ? decrypt(key) : key;
    if (raw.length <= 4) return '****';
    return '****' + raw.slice(-4);
  } catch {
    // Decryption failed — key may be corrupted or key rotated
    return '****';
  }
}

/** Resolve the current user ID from the session. */
function resolveUserId(session: Session): string {
  const id = (session.user as any)?.id;
  if (!id) throw new Error('User ID not found in session');
  return id;
}

// ---------------------------------------------------------------------------
// GET /api/llm/config
// ---------------------------------------------------------------------------

/**
 * List all user-level LLM provider configurations.
 * Returns configs with API keys masked (last 4 chars only).
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const userId = resolveUserId(session);

    const configs = await prisma.lLMProviderConfig.findMany({
      where: {
        userId,
        scope: 'USER',
      },
      orderBy: { createdAt: 'desc' },
    });

    const masked = configs.map((config) => ({
      id: config.id,
      provider: config.provider,
      displayName: config.displayName,
      apiKey: maskApiKey(config.apiKeyEncrypted),
      baseUrl: config.baseUrl,
      organizationId: config.organizationId,
      defaultModel: config.defaultModel,
      isActive: config.isActive,
      scope: config.scope,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));

    return NextResponse.json(masked);
  } catch (error) {
    console.error('GET /api/llm/config error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LLM configurations' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/llm/config
// ---------------------------------------------------------------------------

/**
 * Create a new user-level LLM provider configuration.
 * Body: { provider, displayName?, apiKey?, baseUrl?, organizationId?, defaultModel, scope? }
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const userId = resolveUserId(session);
    const body = await request.json();

    // Validate required fields
    if (!body.provider || typeof body.provider !== 'string') {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    if (!body.defaultModel || typeof body.defaultModel !== 'string') {
      return NextResponse.json(
        { error: 'Default model is required' },
        { status: 400 }
      );
    }

    const validProviders = ['openai', 'anthropic', 'ollama', 'custom'];
    if (!validProviders.includes(body.provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    const config = await prisma.lLMProviderConfig.create({
      data: {
        provider: body.provider,
        displayName: body.displayName?.trim() || `${body.provider} (User)`,
        apiKeyEncrypted: body.apiKey ? encrypt(body.apiKey) : null,
        baseUrl: body.baseUrl?.trim() || null,
        organizationId: body.organizationId?.trim() || null,
        defaultModel: body.defaultModel.trim(),
        scope: 'USER',
        userId,
      },
    });

    return NextResponse.json(
      {
        id: config.id,
        provider: config.provider,
        displayName: config.displayName,
        apiKey: maskApiKey(config.apiKeyEncrypted),
        baseUrl: config.baseUrl,
        organizationId: config.organizationId,
        defaultModel: config.defaultModel,
        isActive: config.isActive,
        scope: config.scope,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/llm/config error:', error);
    return NextResponse.json(
      { error: 'Failed to create LLM configuration' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/llm/config?id=xxx
// ---------------------------------------------------------------------------

/**
 * Delete a user-level LLM provider configuration by ID.
 * Query param: ?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;
    const userId = resolveUserId(session);
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required as a query parameter (?id=xxx)' },
        { status: 400 }
      );
    }

    // Verify the config belongs to the current user
    const existing = await prisma.lLMProviderConfig.findFirst({
      where: {
        id: configId,
        userId,
        scope: 'USER',
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Configuration not found or does not belong to this user' },
        { status: 404 }
      );
    }

    await prisma.lLMProviderConfig.delete({
      where: { id: configId },
    });

    return NextResponse.json({ success: true, deletedId: configId });
  } catch (error) {
    console.error('DELETE /api/llm/config error:', error);
    return NextResponse.json(
      { error: 'Failed to delete LLM configuration' },
      { status: 500 }
    );
  }
}
