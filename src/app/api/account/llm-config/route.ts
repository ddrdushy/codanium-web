import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { encrypt, isEncrypted } from '@/lib/ai/encryption';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/account/llm-config
// ---------------------------------------------------------------------------
// Returns the current user's BYOK config (without decrypting the key).
// ---------------------------------------------------------------------------

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;
  const userId = (session.user as any).id as string;

  const config = await prisma.lLMProviderConfig.findFirst({
    where: { userId, scope: 'USER', isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    provider: config.provider,
    defaultModel: config.defaultModel,
    baseUrl: config.baseUrl,
    // Never return the raw key — only indicate whether one is stored
    hasApiKey: !!config.apiKeyEncrypted,
    updatedAt: config.updatedAt,
  });
}

// ---------------------------------------------------------------------------
// PUT /api/account/llm-config
// ---------------------------------------------------------------------------
// Upsert the current user's BYOK config.
//
// Body: { provider, apiKey, defaultModel, baseUrl? }
//   - Send apiKey as empty string "" to keep the existing key
//   - Send apiKey as null to clear the key (removes BYOK entirely)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;
  const userId = (session.user as any).id as string;

  const body = await request.json().catch(() => ({}));
  const { provider, apiKey, defaultModel, baseUrl } = body as {
    provider?: string;
    apiKey?: string | null;
    defaultModel?: string;
    baseUrl?: string;
  };

  if (!provider || !defaultModel) {
    return NextResponse.json({ error: 'provider and defaultModel are required' }, { status: 400 });
  }

  const SUPPORTED = ['openai', 'anthropic', 'ollama', 'mistral', 'groq', 'together', 'nvidia'];
  if (!SUPPORTED.includes(provider)) {
    return NextResponse.json({ error: `Unsupported provider. Supported: ${SUPPORTED.join(', ')}` }, { status: 400 });
  }

  // If apiKey is null, user wants to remove BYOK
  if (apiKey === null) {
    await prisma.lLMProviderConfig.updateMany({
      where: { userId, scope: 'USER' },
      data: { isActive: false },
    });
    return NextResponse.json({ configured: false });
  }

  // Look for existing user config
  const existing = await prisma.lLMProviderConfig.findFirst({
    where: { userId, scope: 'USER' },
  });

  // Determine encrypted key value
  let apiKeyEncrypted: string | undefined;
  if (apiKey && apiKey.length > 0) {
    // New key provided — encrypt it
    apiKeyEncrypted = isEncrypted(apiKey) ? apiKey : encrypt(apiKey);
  } else if (existing?.apiKeyEncrypted) {
    // Empty string = keep existing key
    apiKeyEncrypted = existing.apiKeyEncrypted;
  }

  if (!apiKeyEncrypted && provider !== 'ollama') {
    return NextResponse.json({ error: 'API key is required for this provider' }, { status: 400 });
  }

  const configData = {
    provider,
    defaultModel,
    baseUrl: baseUrl || null,
    apiKeyEncrypted: apiKeyEncrypted ?? null,
    isActive: true,
    scope: 'USER' as const,
    userId,
  };

  const config = existing
    ? await prisma.lLMProviderConfig.update({
        where: { id: existing.id },
        data: configData,
      })
    : await prisma.lLMProviderConfig.create({ data: configData });

  return NextResponse.json({
    configured: true,
    provider: config.provider,
    defaultModel: config.defaultModel,
    baseUrl: config.baseUrl,
    hasApiKey: !!config.apiKeyEncrypted,
    updatedAt: config.updatedAt,
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/account/llm-config
// ---------------------------------------------------------------------------
// Remove user's BYOK config (revert to platform model + credits).
// ---------------------------------------------------------------------------

export async function DELETE() {
  const { session, error } = await requireAuth();
  if (error) return error;
  const userId = (session.user as any).id as string;

  await prisma.lLMProviderConfig.updateMany({
    where: { userId, scope: 'USER' },
    data: { isActive: false },
  });

  return NextResponse.json({ configured: false });
}
