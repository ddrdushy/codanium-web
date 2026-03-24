import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt, isEncrypted } from '@/lib/ai/encryption';

export const dynamic = 'force-dynamic';

/**
 * GET /api/llm/health
 * Check whether the current LLM provider is configured and reachable.
 * Returns: { configured: boolean, provider: string, model: string, error?: string }
 */
export async function GET() {
  try {
    // ── Resolve active config (mirrors gateway.ts resolution: admin settings) ──
    const adminSettings = await prisma.adminSetting.findMany({
      where: { key: { in: ['llm.defaultProvider', 'llm.defaultModel', 'llm.baseUrl', 'llm.apiKey'] } },
    });
    const adminMap: Record<string, string> = {};
    for (const s of adminSettings) {
      let val = String(s.value);
      if (val.startsWith('"') && val.endsWith('"')) {
        try { val = JSON.parse(val); } catch { /* keep as-is */ }
      }
      adminMap[s.key] = val;
    }

    const provider = adminMap['llm.defaultProvider'];
    const model = adminMap['llm.defaultModel'] || '';
    const baseUrl = adminMap['llm.baseUrl'] || '';
    let apiKey = adminMap['llm.apiKey'] || '';

    // Decrypt if needed
    if (apiKey && isEncrypted(apiKey)) {
      try {
        apiKey = decrypt(apiKey);
      } catch {
        apiKey = '';
      }
    }

    // Admin-only config — no user-level BYOM
    const effectiveProvider = provider;
    const effectiveModel = model;
    const effectiveBaseUrl = baseUrl;
    const effectiveApiKey = apiKey;

    if (!effectiveProvider || effectiveProvider === 'mock') {
      return NextResponse.json({
        configured: false,
        provider: effectiveProvider || 'none',
        model: effectiveModel || '',
        error: 'No LLM provider configured. Please ask your administrator to set up a provider in Admin Settings.',
      });
    }

    // ── Provider-specific checks ──

    if (effectiveProvider === 'ollama') {
      let ollamaUrl = effectiveBaseUrl || 'http://host.docker.internal:11434';
      // Translate localhost/127.0.0.1 to Docker host gateway when inside Docker
      ollamaUrl = ollamaUrl
        .replace('://localhost:', '://host.docker.internal:')
        .replace('://127.0.0.1:', '://host.docker.internal:');
      try {
        const res = await fetch(`${ollamaUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          return NextResponse.json({
            configured: false,
            provider: effectiveProvider,
            model: effectiveModel,
            error: `Ollama returned HTTP ${res.status} at ${ollamaUrl}. Make sure Ollama is running.`,
          });
        }
        return NextResponse.json({
          configured: true,
          provider: effectiveProvider,
          model: effectiveModel,
        });
      } catch (err) {
        return NextResponse.json({
          configured: false,
          provider: effectiveProvider,
          model: effectiveModel,
          error: `Ollama is not reachable at ${ollamaUrl}. Make sure Ollama is running and accessible.`,
        });
      }
    }

    if (effectiveProvider === 'openai') {
      if (!effectiveApiKey) {
        return NextResponse.json({
          configured: false,
          provider: effectiveProvider,
          model: effectiveModel,
          error: 'OpenAI API key is not set. Please add your API key in Settings.',
        });
      }
      return NextResponse.json({
        configured: true,
        provider: effectiveProvider,
        model: effectiveModel,
      });
    }

    if (effectiveProvider === 'anthropic') {
      if (!effectiveApiKey) {
        return NextResponse.json({
          configured: false,
          provider: effectiveProvider,
          model: effectiveModel,
          error: 'Anthropic API key is not set. Please add your API key in Settings.',
        });
      }
      return NextResponse.json({
        configured: true,
        provider: effectiveProvider,
        model: effectiveModel,
      });
    }

    // OpenAI-compatible providers (Mistral, NVIDIA, Groq, Together, custom)
    // These use the same format as OpenAI — just need an API key and base URL
    const openaiCompatible = ['mistral', 'nvidia', 'groq', 'together', 'custom'];
    if (openaiCompatible.includes(effectiveProvider)) {
      if (!effectiveApiKey && effectiveProvider !== 'custom') {
        return NextResponse.json({
          configured: false,
          provider: effectiveProvider,
          model: effectiveModel,
          error: `${effectiveProvider} API key is not set. Please add your API key in Admin Settings.`,
        });
      }
      return NextResponse.json({
        configured: true,
        provider: effectiveProvider,
        model: effectiveModel,
      });
    }

    // Unknown provider — treat as not configured
    return NextResponse.json({
      configured: false,
      provider: effectiveProvider,
      model: effectiveModel,
      error: `Unknown provider "${effectiveProvider}". Supported: openai, anthropic, ollama, mistral, nvidia, groq, together, custom.`,
    });
  } catch (error) {
    console.error('GET /api/llm/health error:', error);
    return NextResponse.json(
      {
        configured: false,
        provider: 'unknown',
        model: '',
        error: 'Failed to check LLM configuration. Please try again.',
      },
      { status: 500 }
    );
  }
}
