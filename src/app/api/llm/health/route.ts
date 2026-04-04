import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt, isEncrypted } from '@/lib/ai/encryption';
import { llmGateway } from '@/lib/ai';
import type { ProviderConfig } from '@/lib/ai';

export const dynamic = 'force-dynamic';

/**
 * GET /api/llm/health
 * Check whether the current LLM provider is configured and reachable.
 * Now performs actual connectivity tests (not just key-existence checks)
 * and reports the full platform fallback chain status.
 *
 * Returns: {
 *   configured: boolean,
 *   provider: string,
 *   model: string,
 *   reachable: boolean,
 *   error?: string,
 *   fallbackChain?: Array<{ provider, model, priority, reachable, error? }>
 * }
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

    // ── Check platform fallback chain ──
    const fallbackChain = await checkFallbackChain();

    if (!provider || provider === 'mock') {
      // No admin default — check if fallback chain has anything
      const hasWorkingFallback = fallbackChain.some(f => f.reachable);
      return NextResponse.json({
        configured: hasWorkingFallback,
        provider: provider || 'none',
        model: model || '',
        reachable: hasWorkingFallback,
        error: hasWorkingFallback
          ? undefined
          : 'No LLM provider configured. Please ask your administrator to set up a provider in Admin Settings.',
        fallbackChain,
      });
    }

    // ── Validate the admin default provider with a real connectivity test ──
    const config: ProviderConfig = {
      provider,
      apiKey: apiKey || undefined,
      baseUrl: baseUrl || undefined,
      defaultModel: model,
    };

    const adapter = llmGateway.getProvider(provider);
    if (!adapter) {
      return NextResponse.json({
        configured: false,
        provider,
        model,
        reachable: false,
        error: `Unknown provider "${provider}". Supported: openai, anthropic, ollama, mistral, nvidia, groq, together, custom.`,
        fallbackChain,
      });
    }

    // Check if API key is required but missing (skip for ollama/custom)
    if (!apiKey && provider !== 'ollama' && provider !== 'custom') {
      return NextResponse.json({
        configured: false,
        provider,
        model,
        reachable: false,
        error: `${provider} API key is not set. Please add your API key in Admin Settings.`,
        fallbackChain,
      });
    }

    // Actual connectivity test
    let reachable = false;
    let error: string | undefined;
    try {
      reachable = await adapter.validateConnection(config);
      if (!reachable) {
        error = `${provider} connection test failed. Check your API key, base URL, and ensure the service is running.`;
      }
    } catch (err) {
      error = `${provider} connection test error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }

    return NextResponse.json({
      configured: true,
      provider,
      model,
      reachable,
      error,
      fallbackChain,
    });
  } catch (error) {
    console.error('GET /api/llm/health error:', error);
    return NextResponse.json(
      {
        configured: false,
        provider: 'unknown',
        model: '',
        reachable: false,
        error: 'Failed to check LLM configuration. Please try again.',
      },
      { status: 500 }
    );
  }
}

// ── Fallback Chain Health ──────────────────────────────────────────────────

interface FallbackStatus {
  provider: string;
  model: string;
  priority: number;
  reachable: boolean;
  error?: string;
}

async function checkFallbackChain(): Promise<FallbackStatus[]> {
  try {
    const platformConfigs = await prisma.lLMProviderConfig.findMany({
      where: { scope: 'PLATFORM', isActive: true },
      orderBy: { priority: 'asc' },
    });

    if (platformConfigs.length === 0) return [];

    // Test each provider in parallel with a timeout
    const results = await Promise.all(
      platformConfigs.map(async (cfg): Promise<FallbackStatus> => {
        const adapter = llmGateway.getProvider(cfg.provider);
        if (!adapter) {
          return {
            provider: cfg.provider,
            model: cfg.defaultModel,
            priority: cfg.priority,
            reachable: false,
            error: `Unknown provider "${cfg.provider}"`,
          };
        }

        // Decrypt API key
        let apiKey: string | undefined;
        if (cfg.apiKeyEncrypted) {
          try {
            apiKey = isEncrypted(cfg.apiKeyEncrypted)
              ? decrypt(cfg.apiKeyEncrypted)
              : cfg.apiKeyEncrypted;
          } catch {
            return {
              provider: cfg.provider,
              model: cfg.defaultModel,
              priority: cfg.priority,
              reachable: false,
              error: 'Failed to decrypt API key',
            };
          }
        }

        const config: ProviderConfig = {
          provider: cfg.provider,
          apiKey,
          baseUrl: cfg.baseUrl ?? undefined,
          defaultModel: cfg.defaultModel,
        };

        try {
          const reachable = await adapter.validateConnection(config);
          return {
            provider: cfg.provider,
            model: cfg.defaultModel,
            priority: cfg.priority,
            reachable,
            error: reachable ? undefined : 'Connection test returned false',
          };
        } catch (err) {
          return {
            provider: cfg.provider,
            model: cfg.defaultModel,
            priority: cfg.priority,
            reachable: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      }),
    );

    return results;
  } catch (err) {
    console.error('[Health] Failed to check fallback chain:', err);
    return [];
  }
}
