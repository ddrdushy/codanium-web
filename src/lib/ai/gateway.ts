// =============================================================================
// AI Team Studio — LLM Gateway
// =============================================================================
// Central singleton that routes every LLM request to the correct provider.
// Handles provider config resolution, dispatch, latency measurement, and
// usage logging.
//
// Resolution priority (admin-managed):
//   1. Agent-level DB config (admin per-agent override)
//   2. Project-level DB config (admin per-project override)
//   3. Admin settings (platform-wide default) ← main path
//   4. Error (no config — admin must configure LLM provider)
// =============================================================================

import {
  LLMProvider,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  ProviderConfig,
} from './providers/types';
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

  constructor() {
    this.providers = new Map();
    this.providers.set('openai', new OpenAIAdapter());
    this.providers.set('anthropic', new AnthropicAdapter());
    this.providers.set('ollama', new OllamaAdapter());
    // OpenAI-compatible providers (Mistral, NVIDIA, Groq, Together, etc.)
    // They all use the OpenAI adapter with a custom baseUrl
    this.providers.set('mistral', new OpenAIAdapter());
    this.providers.set('nvidia', new OpenAIAdapter());
    this.providers.set('groq', new OpenAIAdapter());
    this.providers.set('together', new OpenAIAdapter());
  }

  // -------------------------------------------------------------------------
  // Provider Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve which provider + config to use for a given request scope.
   *
   * Resolution priority (admin-managed):
   *   1. Agent-level DB config (admin per-agent override)
   *   2. Project-level DB config (admin per-project override)
   *   3. Admin settings (platform-wide default)
   *   4. Error (no config — admin must configure LLM provider)
   */
  async resolve(
    projectId?: string,
    agentId?: string,
    _userId?: string,
  ): Promise<{ provider: LLMProvider; config: ProviderConfig; isMock: boolean }> {
    console.log(`[LLMGateway] resolve() called — project=${projectId}, agent=${agentId}`);

    // ── 1. Agent-level DB config (admin override per agent) ──
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

    // ── 2. Project-level DB config (admin override per project) ──
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

    // ── 3. Admin settings (platform-wide default) ──
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
        // Decrypt admin API key if encrypted
        let apiKey = adminMap['llm.apiKey'] || undefined;
        if (apiKey && isEncrypted(apiKey)) {
          try { apiKey = decrypt(apiKey); } catch { apiKey = undefined; }
        }
        const config: ProviderConfig = {
          provider: adminProvider,
          apiKey,
          baseUrl: adminMap['llm.baseUrl'] || undefined,
          defaultModel: adminMap['llm.defaultModel'] || 'llama3',
        };
        console.log(`[LLMGateway] ✓ Resolved via ADMIN settings: provider=${adminProvider}, model=${config.defaultModel}, baseUrl=${config.baseUrl || '(default)'}`);
        return { provider: this.providers.get(adminProvider)!, config, isMock: false };
      }
    } catch (err) {
      console.warn('[LLMGateway] ✗ Admin settings query failed:', err);
    }

    // ── 4. No config found — admin must configure ──
    const errMsg = 'LLM provider not configured. Please contact your administrator to set up the AI provider in Admin Settings.';
    console.error(`[LLMGateway] ✗ ${errMsg}`);
    throw new Error(errMsg);
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
    const provider = this.providers.get(dbConfig.provider);
    if (!provider) {
      throw new Error(`Unknown LLM provider "${dbConfig.provider}". Supported: openai, anthropic, ollama, mistral, nvidia, groq, together`);
    }

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
    return { provider, config, isMock: false };
  }

  // -------------------------------------------------------------------------
  // Non-Streaming Completion
  // -------------------------------------------------------------------------

  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    const userId = options.metadata?.userId;

    // Pre-flight: monthly budget gate
    if (userId) {
      await this.enforceBudget(userId);
    }

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

    // Pre-flight: monthly budget gate
    if (userId) {
      await this.enforceBudget(userId);
    }

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
      mistral:   { prompt: 0.000001,  completion: 0.000003  },
      nvidia:    { prompt: 0,         completion: 0         }, // Free tier
      groq:      { prompt: 0.0000005, completion: 0.0000015 },
      together:  { prompt: 0.000001,  completion: 0.000003  },
    };

    const rate = rates[response.provider] ?? { prompt: 0, completion: 0 };
    return (
      response.tokensUsed.prompt * rate.prompt +
      response.tokensUsed.completion * rate.completion
    );
  }

  // -------------------------------------------------------------------------
  // Budget Enforcement
  // -------------------------------------------------------------------------

  /**
   * Check if the user's monthly LLM spending exceeds their budget.
   * Throws an error if over budget, preventing the LLM call.
   */
  private async enforceBudget(userId: string): Promise<void> {
    try {
      // Get user's monthly budget (default: $500)
      const prefs = await prisma.userPreferences.findUnique({
        where: { userId },
        select: { monthlyBudget: true },
      });
      const budget = prefs?.monthlyBudget ?? 500;
      if (budget <= 0) return; // 0 = unlimited

      // Sum this month's spending across all user's projects
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const result = await prisma.lLMUsage.aggregate({
        where: {
          project: { ownerId: userId },
          createdAt: { gte: startOfMonth },
        },
        _sum: { cost: true },
      });

      const spent = result._sum.cost ?? 0;
      if (spent >= budget) {
        console.warn(`[LLMGateway] Budget exceeded for user ${userId}: $${spent.toFixed(2)} / $${budget}`);
        throw new Error(
          `Monthly budget exceeded ($${spent.toFixed(2)} of $${budget}). ` +
          `Increase your budget in Settings or wait until next month.`,
        );
      }
    } catch (err) {
      // If it's our budget error, re-throw
      if (err instanceof Error && err.message.includes('Monthly budget exceeded')) throw err;
      // Otherwise swallow — don't block calls if budget check itself fails
      console.warn('[LLMGateway] Budget check failed (non-blocking):', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const llmGateway = new LLMGateway();
