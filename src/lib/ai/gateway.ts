// =============================================================================
// AI Team Studio — LLM Gateway
// =============================================================================
// Central singleton that routes every LLM request to the correct provider.
// Handles BYOM (Bring Your Own Model) config resolution, provider dispatch,
// latency measurement, and usage logging.
//
// Resolution priority (BYOM — each user brings their own model):
//   1. Agent-level DB config (per-agent override)
//   2. Project-level DB config
//   3. User-level DB config  ← main BYOM path (Platform Settings drawer)
//   4. Admin settings (DB global default)
//   5. Mock fallback (demo mode)
// =============================================================================

import {
  LLMProvider,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  ProviderConfig,
} from './providers/types';
import { MockProvider } from './providers/mock-provider';
import { OpenAIAdapter } from './providers/openai-adapter';
import { AnthropicAdapter } from './providers/anthropic-adapter';
import { OllamaAdapter } from './providers/ollama-adapter';
import { decrypt, isEncrypted } from './encryption';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

export class LLMGateway {
  private providers: Map<string, LLMProvider>;
  private mockProvider: MockProvider;
  private mockConfig: ProviderConfig;

  constructor() {
    this.providers = new Map();
    this.mockProvider = new MockProvider();
    this.providers.set('mock', this.mockProvider);
    this.providers.set('openai', new OpenAIAdapter());
    this.providers.set('anthropic', new AnthropicAdapter());
    this.providers.set('ollama', new OllamaAdapter());
    this.mockConfig = { provider: 'mock', defaultModel: 'mock-v1' };
  }

  // -------------------------------------------------------------------------
  // Provider Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve which provider + config to use for a given request scope.
   *
   * BYOM resolution (each user configures their own provider):
   *   1. Agent-level DB config (per-agent override)
   *   2. Project-level DB config
   *   3. User-level DB config  ← main BYOM path
   *   4. Admin settings (DB global default)
   *   5. Mock fallback (demo mode — no API key needed)
   */
  async resolve(
    projectId?: string,
    agentId?: string,
    userId?: string,
  ): Promise<{ provider: LLMProvider; config: ProviderConfig; isMock: boolean }> {
    console.log(`[LLMGateway] resolve() called — project=${projectId}, agent=${agentId}, userId=${userId}`);

    // ── 1. Agent-level DB config ──
    if (projectId && agentId) {
      try {
        const agentConfig = await prisma.lLMProviderConfig.findFirst({
          where: { projectId, agentShortName: agentId, scope: 'AGENT', isActive: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (agentConfig) {
          console.log(`[LLMGateway] ✓ Resolved via AGENT config: provider=${agentConfig.provider}, agent=${agentId}`);
          return this.resolveConfig(agentConfig);
        }
      } catch (err) {
        console.warn('[LLMGateway] ✗ Agent-level config query failed:', err);
      }
    }

    // ── 2. Project-level DB config ──
    if (projectId) {
      try {
        const projectConfig = await prisma.lLMProviderConfig.findFirst({
          where: { projectId, scope: 'PROJECT', isActive: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (projectConfig) {
          console.log(`[LLMGateway] ✓ Resolved via PROJECT config: provider=${projectConfig.provider}`);
          return this.resolveConfig(projectConfig);
        }
      } catch (err) {
        console.warn('[LLMGateway] ✗ Project-level config query failed:', err);
      }
    }

    // ── 3. User-level DB config (main BYOM path) ──
    if (userId) {
      try {
        // Most recently updated non-mock config wins
        const userConfig = await prisma.lLMProviderConfig.findFirst({
          where: { userId, scope: 'USER', isActive: true, provider: { not: 'mock' } },
          orderBy: { updatedAt: 'desc' },
        });
        if (userConfig) {
          console.log(`[LLMGateway] ✓ Resolved via USER config: provider=${userConfig.provider}, model=${userConfig.defaultModel}, baseUrl=${userConfig.baseUrl}, userId=${userId}`);
          return this.resolveConfig(userConfig);
        }
        console.log(`[LLMGateway] — No USER config found for userId=${userId}`);
      } catch (err) {
        console.warn('[LLMGateway] ✗ User-level config query failed:', err);
      }
    } else {
      console.warn('[LLMGateway] ⚠ userId is empty/undefined — cannot look up user BYOM config');
    }

    // ── 4. Admin settings (DB global default) ──
    try {
      const adminSettings = await prisma.adminSetting.findMany({
        where: { key: { in: ['llm.defaultProvider', 'llm.defaultModel', 'llm.baseUrl', 'llm.apiKey'] } },
      });
      const adminMap: Record<string, string> = {};
      for (const s of adminSettings) {
        // Strip surrounding quotes from JSON-encoded strings
        let val = String(s.value);
        if (val.startsWith('"') && val.endsWith('"')) {
          try { val = JSON.parse(val); } catch { /* keep as-is */ }
        }
        adminMap[s.key] = val;
      }
      const adminProvider = adminMap['llm.defaultProvider'];
      if (adminProvider && adminProvider !== 'mock' && this.providers.has(adminProvider)) {
        const config: ProviderConfig = {
          provider: adminProvider,
          apiKey: adminMap['llm.apiKey'] || undefined,
          baseUrl: adminMap['llm.baseUrl'] || undefined,
          defaultModel: adminMap['llm.defaultModel'] || 'llama3',
        };
        console.log(`[LLMGateway] ✓ Resolved via ADMIN settings: provider=${adminProvider}, model=${config.defaultModel}, baseUrl=${config.baseUrl || '(default)'}`);
        return { provider: this.providers.get(adminProvider)!, config, isMock: false };
      }
    } catch (err) {
      console.warn('[LLMGateway] ✗ Admin settings query failed:', err);
    }

    // ── 5. Mock fallback (demo mode) ──
    console.log(`[LLMGateway] → Falling back to MOCK (demo mode). No BYOM config found for user=${userId}`);
    return { provider: this.mockProvider, config: this.mockConfig, isMock: true };
  }

  /**
   * Convert a DB-stored LLMProviderConfig record into the gateway's
   * { provider, config, isMock } tuple.
   */
  private resolveConfig(dbConfig: {
    provider: string;
    apiKeyEncrypted: string | null;
    baseUrl: string | null;
    organizationId: string | null;
    defaultModel: string;
  }): { provider: LLMProvider; config: ProviderConfig; isMock: boolean } {
    const provider = this.providers.get(dbConfig.provider) ?? this.mockProvider;

    // Decrypt the API key — supports both encrypted and legacy plaintext values
    let apiKey: string | undefined;
    if (dbConfig.apiKeyEncrypted) {
      try {
        apiKey = isEncrypted(dbConfig.apiKeyEncrypted)
          ? decrypt(dbConfig.apiKeyEncrypted)
          : dbConfig.apiKeyEncrypted; // backwards compat: plaintext from before encryption was wired
      } catch (err) {
        console.error('[LLMGateway] Failed to decrypt API key, skipping:', err);
        apiKey = undefined;
      }
    }

    const config: ProviderConfig = {
      provider: dbConfig.provider,
      apiKey,
      baseUrl: dbConfig.baseUrl ?? undefined,
      organizationId: dbConfig.organizationId ?? undefined,
      defaultModel: dbConfig.defaultModel,
    };
    return { provider, config, isMock: dbConfig.provider === 'mock' };
  }

  // -------------------------------------------------------------------------
  // Non-Streaming Completion
  // -------------------------------------------------------------------------

  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    const userId = options.metadata?.userId;
    const { provider, config, isMock } = await this.resolve(
      options.projectId,
      options.agentId,
      userId,
    );

    const startTime = Date.now();

    let response: LLMResponse;
    try {
      response = await provider.complete(options, config);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.error(
        `[LLMGateway] Provider "${config.provider}" failed after ${elapsed}ms:`,
        err,
      );
      throw err;
    }

    response.latencyMs = Date.now() - startTime;

    if (!isMock) {
      this.logUsage(options, response).catch((logErr) => {
        console.error('[LLMGateway] Failed to log usage:', logErr);
      });
    }

    return response;
  }

  // -------------------------------------------------------------------------
  // Streaming Completion
  // -------------------------------------------------------------------------

  async *stream(options: LLMRequestOptions): AsyncIterable<LLMStreamChunk> {
    const userId = options.metadata?.userId;
    const { provider, config, isMock } = await this.resolve(
      options.projectId,
      options.agentId,
      userId,
    );

    let lastTokensUsed: LLMResponse['tokensUsed'] | undefined;

    for await (const chunk of provider.stream(options, config)) {
      if (chunk.done && chunk.tokensUsed) {
        lastTokensUsed = chunk.tokensUsed;
      }
      yield chunk;
    }

    if (!isMock && lastTokensUsed && options.projectId) {
      this.logUsage(options, {
        content: '',
        tokensUsed: lastTokensUsed,
        model: options.model ?? config.defaultModel,
        provider: config.provider,
        latencyMs: 0,
        finishReason: 'stop',
      }).catch((logErr) => {
        console.error('[LLMGateway] Failed to log stream usage:', logErr);
      });
    }
  }

  // -------------------------------------------------------------------------
  // Provider Registration
  // -------------------------------------------------------------------------

  registerProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
  }

  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  // -------------------------------------------------------------------------
  // Usage Logging
  // -------------------------------------------------------------------------

  private async logUsage(
    options: LLMRequestOptions,
    response: LLMResponse,
  ): Promise<void> {
    if (!options.projectId) return;

    try {
      await prisma.lLMUsage.create({
        data: {
          tokensUsed: response.tokensUsed.total,
          cost: this.estimateCost(response),
          provider: response.provider,
          model: response.model,
          agentName: options.agentId ?? 'unknown',
          projectId: options.projectId,
        },
      });
    } catch (err) {
      console.error('[LLMGateway] Usage logging failed:', err);
    }
  }

  private estimateCost(response: LLMResponse): number {
    const rates: Record<string, { prompt: number; completion: number }> = {
      openai:    { prompt: 0.00003,   completion: 0.00006   },
      anthropic: { prompt: 0.000003,  completion: 0.000015  },
      ollama:    { prompt: 0,         completion: 0         },
      mock:      { prompt: 0,         completion: 0         },
    };

    const rate = rates[response.provider] ?? rates.mock;
    return (
      response.tokensUsed.prompt * rate.prompt +
      response.tokensUsed.completion * rate.completion
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const llmGateway = new LLMGateway();
