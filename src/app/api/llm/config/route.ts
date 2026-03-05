import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mask API key to show only last 4 characters. */
function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

/** Resolve the current user ID from the session, falling back to demo. */
async function resolveUserId(): Promise<string> {
  try {
    const session = await auth();
    return (session?.user as any)?.id ?? 'demo-user-id';
  } catch {
    return 'demo-user-id';
  }
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
    const userId = await resolveUserId();

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
    const userId = await resolveUserId();
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
        // Store API key as-is for now; encryption will be added in Phase 7
        apiKeyEncrypted: body.apiKey ?? null,
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
    const userId = await resolveUserId();
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
