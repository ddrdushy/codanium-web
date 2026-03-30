// =============================================================================
// AI Team Studio — LLM Gateway
// =============================================================================
// Central singleton that routes every LLM request to the correct provider.
// Handles provider config resolution, dispatch, latency measurement, usage
// logging, and credit billing.
//
// Resolution priority:
//   1. User-level BYOK config  (scope=USER) ← user's own key, no credit charge
//   2. Agent-level DB config   (scope=AGENT, admin override)
//   3. Project-level DB config (scope=PROJECT, admin override)
//   4. Admin settings          (platform-wide default) ← credits charged
//   5. Error — admin must configure LLM provider
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
import { BillingType } from '@/generated/prisma/enums';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolvedConfig {
  provider: LLMProvider;
  config: ProviderConfig;
  isMock: boolean;
  billingType: BillingType;
}

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
    this.providers.set('mistral', new OpenAIAdapter());
    this.providers.set('nvidia', new OpenAIAdapter());
    this.providers.set('groq', new OpenAIAdapter());
    this.providers.set('together', new OpenAIAdapter());
  }

  // -------------------------------------------------------------------------
  // Provider Resolution
  // -------------------------------------------------------------------------

  async resolve(
    projectId?: string,
    agentId?: string,
    userId?: string,
  ): Promise<ResolvedConfig> {
    console.log(`[LLMGateway] resolve() — project=${projectId}, agent=${agentId}, user=${userId}`);

    // ── 1. User-level BYOK config (user's own key) ──
    if (userId) {
      try {
        const userConfig = await prisma.lLMProviderConfig.findFirst({
          where: { userId, scope: 'USER', isActive: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (userConfig) {
          console.log(`[LLMGateway] ✓ BYOK config: provider=${userConfig.provider}, user=${userId}`);
          return { ...this.resolveConfig(userConfig), billingType: 'BYOK' };
        }
      } catch (err) {
        console.warn('[LLMGateway] ✗ User-level BYOK query failed:', err);
      }
    }

    // ── 2. Agent-level DB config (admin override per agent) ──
    if (projectId && agentId) {
      try {
        const agentConfig = await prisma.lLMProviderConfig.findFirst({
          where: { projectId, agentShortName: agentId, scope: 'AGENT', isActive: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (agentConfig) {
          console.log(`[LLMGateway] ✓ AGENT config: provider=${agentConfig.provider}, agent=${agentId}`);
          return { ...this.resolveConfig(agentConfig), billingType: 'PLATFORM' };
        }
      } catch (err) {
        console.warn('[LLMGateway] ✗ Agent-level config query failed:', err);
      }
    }

    // ── 3. Project-level DB config (admin override per project) ──
    if (projectId) {
      try {
        const projectConfig = await prisma.lLMProviderConfig.findFirst({
          where: { projectId, scope: 'PROJECT', isActive: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (projectConfig) {
          console.log(`[LLMGateway] ✓ PROJECT config: provider=${projectConfig.provider}`);
          return { ...this.resolveConfig(projectConfig), billingType: 'PLATFORM' };
        }
      } catch (err) {
        console.warn('[LLMGateway] ✗ Project-level config query failed:', err);
      }
    }

    // ── 4. Admin settings (platform-wide default) ──
    try {
      const adminSettings = await prisma.adminSetting.findMany({
        where: {
          key: { in: ['llm.defaultProvider', 'llm.defaultModel', 'llm.baseUrl', 'llm.apiKey'] },
        },
      });
      const adminMap: Record<string, string> = {};
      for (const s of adminSettings) {
        let val = String(s.value);
        if (val.startsWith('"') && val.endsWith('"')) {
          try { val = JSON.parse(val); } catch { /* keep as-is */ }
        }
        adminMap[s.key] = val;
      }
      const adminProvider = adminMap['llm.defaultProvider'];
      if (adminProvider && adminProvider !== 'mock' && this.providers.has(adminProvider)) {
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
        console.log(`[LLMGateway] ✓ ADMIN settings: provider=${adminProvider}, model=${config.defaultModel}, baseUrl=${config.baseUrl ?? '(provider default)'}`);
        return {
          provider: this.providers.get(adminProvider)!,
          config,
          isMock: false,
          billingType: 'PLATFORM',
        };
      }
    } catch (err) {
      console.warn('[LLMGateway] ✗ Admin settings query failed:', err);
    }

    // ── 5. No config found ──
    const errMsg =
      'LLM provider not configured. Please contact your administrator to set up the AI provider in Admin Settings.';
    console.error(`[LLMGateway] ✗ ${errMsg}`);
    throw new Error(errMsg);
  }

  /**
   * Convert a DB-stored LLMProviderConfig record into { provider, config, isMock }.
   */
  private resolveConfig(dbConfig: {
    provider: string;
    apiKeyEncrypted: string | null;
    baseUrl: string | null;
    organizationId: string | null;
    defaultModel: string;
  }): Omit<ResolvedConfig, 'billingType'> {
    const provider = this.providers.get(dbConfig.provider);
    if (!provider) {
      throw new Error(
        `Unknown LLM provider "${dbConfig.provider}". Supported: openai, anthropic, ollama, mistral, nvidia, groq, together`,
      );
    }

    let apiKey: string | undefined;
    if (dbConfig.apiKeyEncrypted) {
      try {
        apiKey = isEncrypted(dbConfig.apiKeyEncrypted)
          ? decrypt(dbConfig.apiKeyEncrypted)
          : dbConfig.apiKeyEncrypted;
      } catch {
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
    const { provider, config, isMock, billingType } = await this.resolve(
      options.projectId,
      options.agentId,
      userId,
    );

    // Pre-flight credit check (only for PLATFORM path)
    if (userId && billingType === 'PLATFORM') {
      await this.enforceCredits(userId);
    }

    const startTime = Date.now();
    let response: LLMResponse;
    try {
      response = await provider.complete(options, config);
    } catch (err) {
      console.error(`[LLMGateway] Provider "${config.provider}" failed after ${Date.now() - startTime}ms:`, err);
      throw err;
    }
    response.latencyMs = Date.now() - startTime;

    if (!isMock) {
      this.logUsage(options, response, billingType, userId).catch((logErr) => {
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
    const { provider, config, isMock, billingType } = await this.resolve(
      options.projectId,
      options.agentId,
      userId,
    );

    // Pre-flight credit check (only for PLATFORM path)
    if (userId && billingType === 'PLATFORM') {
      await this.enforceCredits(userId);
    }

    let lastTokensUsed: LLMResponse['tokensUsed'] | undefined;
    for await (const chunk of provider.stream(options, config)) {
      if (chunk.done && chunk.tokensUsed) {
        lastTokensUsed = chunk.tokensUsed;
      }
      yield chunk;
    }

    if (!isMock && lastTokensUsed && options.projectId) {
      this.logUsage(
        options,
        {
          content: '',
          tokensUsed: lastTokensUsed,
          model: options.model ?? config.defaultModel,
          provider: config.provider,
          latencyMs: 0,
          finishReason: 'stop',
        },
        billingType,
        userId,
      ).catch((logErr) => {
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
  // Usage Logging + Credit Deduction
  // -------------------------------------------------------------------------

  private async logUsage(
    options: LLMRequestOptions,
    response: LLMResponse,
    billingType: BillingType,
    userId?: string,
  ): Promise<void> {
    if (!options.projectId) return;

    const actualCost = await this.estimateCost(response);
    let markedUpCost: number | null = null;

    // For PLATFORM calls: apply markup and deduct from wallet
    if (billingType === 'PLATFORM' && actualCost > 0) {
      const markupPct = await this.getMarkupPercent();
      markedUpCost = actualCost * (1 + markupPct / 100);
    }

    try {
      const usageRecord = await prisma.lLMUsage.create({
        data: {
          tokensUsed: response.tokensUsed.total,
          promptTokens: response.tokensUsed.prompt,
          completionTokens: response.tokensUsed.completion,
          contextTokens: response.tokensUsed.prompt, // context ≈ prompt (system + history + user msg)
          actualCost,
          markedUpCost,
          billingType,
          provider: response.provider,
          model: response.model,
          agentName: options.agentId ?? 'unknown',
          projectId: options.projectId,
          userId: (userId && userId !== 'system' && userId !== 'unknown') ? userId : null,
        },
      });

      // Deduct credits from wallet for PLATFORM calls
      if (billingType === 'PLATFORM' && userId && markedUpCost && markedUpCost > 0) {
        await this.deductCredits(userId, markedUpCost, usageRecord.id);
      }
    } catch (err) {
      console.error('[LLMGateway] Usage logging failed:', err);
    }
  }

  private async estimateCost(response: LLMResponse): Promise<number> {
    // Per-model rates (USD per token). Model string is matched as a prefix so
    // variants like 'gpt-4o-2024-11-20' still resolve to the right tier.
    // Sources: OpenAI pricing page, Anthropic pricing page (2025-03).
    const modelRates: Array<{ prefix: string; prompt: number; completion: number }> = [
      // ── OpenAI ────────────────────────────────────────────────────────────
      { prefix: 'gpt-4o-mini',        prompt: 0.00000015,  completion: 0.0000006   },
      { prefix: 'gpt-4o',             prompt: 0.0000025,   completion: 0.00001     },
      { prefix: 'gpt-4-turbo',        prompt: 0.00001,     completion: 0.00003     },
      { prefix: 'gpt-4',              prompt: 0.00003,     completion: 0.00006     },
      { prefix: 'gpt-3.5-turbo',      prompt: 0.0000005,   completion: 0.0000015   },
      { prefix: 'o1-mini',            prompt: 0.0000011,   completion: 0.0000044   },
      { prefix: 'o1',                 prompt: 0.000015,    completion: 0.00006     },
      { prefix: 'o3-mini',            prompt: 0.0000011,   completion: 0.0000044   },
      { prefix: 'o3',                 prompt: 0.00001,     completion: 0.00004     },
      // ── Anthropic ─────────────────────────────────────────────────────────
      { prefix: 'claude-opus-4',      prompt: 0.000015,    completion: 0.000075    },
      { prefix: 'claude-3-opus',      prompt: 0.000015,    completion: 0.000075    },
      { prefix: 'claude-sonnet-4',    prompt: 0.000003,    completion: 0.000015    },
      { prefix: 'claude-3-5-sonnet',  prompt: 0.000003,    completion: 0.000015    },
      { prefix: 'claude-3-sonnet',    prompt: 0.000003,    completion: 0.000015    },
      { prefix: 'claude-haiku-4',     prompt: 0.0000008,   completion: 0.000004    },
      { prefix: 'claude-3-5-haiku',   prompt: 0.0000008,   completion: 0.000004    },
      { prefix: 'claude-3-haiku',     prompt: 0.00000025,  completion: 0.00000125  },
      // ── Mistral ───────────────────────────────────────────────────────────
      { prefix: 'mistral-large',      prompt: 0.000002,    completion: 0.000006    },
      { prefix: 'mistral-small',      prompt: 0.0000002,   completion: 0.0000006   },
      { prefix: 'mistral-medium',     prompt: 0.0000027,   completion: 0.0000081   },
      { prefix: 'mixtral',            prompt: 0.0000007,   completion: 0.0000007   },
      // ── Groq ──────────────────────────────────────────────────────────────
      { prefix: 'llama-3.3-70b',      prompt: 0.00000059,  completion: 0.00000079  },
      { prefix: 'llama-3.1-70b',      prompt: 0.00000059,  completion: 0.00000079  },
      { prefix: 'llama-3.1-8b',       prompt: 0.00000005,  completion: 0.00000008  },
      { prefix: 'llama3-70b',         prompt: 0.00000059,  completion: 0.00000079  },
      { prefix: 'llama3-8b',          prompt: 0.00000005,  completion: 0.00000008  },
      // ── Together AI ───────────────────────────────────────────────────────
      { prefix: 'meta-llama/Llama-3-70b',  prompt: 0.0000009, completion: 0.0000009 },
      { prefix: 'meta-llama/Llama-3-8b',   prompt: 0.0000002, completion: 0.0000002 },
      { prefix: 'mistralai/Mixtral-8x7B',  prompt: 0.0000006, completion: 0.0000006 },
    ];

    // For Ollama: fetch admin-configured per-token rates (default 0 = free)
    const ollamaRates = response.provider === 'ollama'
      ? await this.getOllamaRates()
      : { prompt: 0, completion: 0 };

    // Fallback rates if no model-specific match is found
    const providerFallback: Record<string, { prompt: number; completion: number }> = {
      openai:    { prompt: 0.0000025,  completion: 0.00001   },  // gpt-4o default
      anthropic: { prompt: 0.000003,   completion: 0.000015  },  // claude-sonnet default
      ollama:    ollamaRates,
      mistral:   { prompt: 0.000001,   completion: 0.000003  },
      nvidia:    { prompt: 0,          completion: 0         },
      groq:      { prompt: 0.00000059, completion: 0.00000079},
      together:  { prompt: 0.0000009,  completion: 0.0000009 },
    };

    const modelLower = (response.model ?? '').toLowerCase();
    // For Ollama, skip the global modelRates prefix list (those are cloud-provider models)
    // and go straight to the admin-configured ollamaRates.
    const matched = response.provider === 'ollama'
      ? undefined
      : modelRates.find(r => modelLower.startsWith(r.prefix.toLowerCase()));
    const rate = matched ?? providerFallback[response.provider] ?? { prompt: 0, completion: 0 };

    return (
      response.tokensUsed.prompt * rate.prompt +
      response.tokensUsed.completion * rate.completion
    );
  }

  private async getOllamaRates(): Promise<{ prompt: number; completion: number }> {
    try {
      const [promptSetting, completionSetting] = await Promise.all([
        prisma.adminSetting.findUnique({ where: { key: 'llm.ollama.promptRatePer1KTokens' } }),
        prisma.adminSetting.findUnique({ where: { key: 'llm.ollama.completionRatePer1KTokens' } }),
      ]);
      const prompt = parseFloat(String(promptSetting?.value ?? '0').replace(/"/g, '')) / 1000;
      const completion = parseFloat(String(completionSetting?.value ?? '0').replace(/"/g, '')) / 1000;
      return {
        prompt: isNaN(prompt) ? 0 : prompt,
        completion: isNaN(completion) ? 0 : completion,
      };
    } catch {
      return { prompt: 0, completion: 0 };
    }
  }

  private async getMarkupPercent(): Promise<number> {
    try {
      const setting = await prisma.adminSetting.findUnique({
        where: { key: 'billing.markupPercent' },
      });
      if (setting) {
        const val = parseFloat(String(setting.value).replace(/"/g, ''));
        if (!isNaN(val) && val >= 0) return val;
      }
    } catch { /* use default */ }
    return 15; // default 15%
  }

  // -------------------------------------------------------------------------
  // Credit Wallet Operations
  // -------------------------------------------------------------------------

  /**
   * Deduct markedUpCost from the user's credit wallet.
   * Creates a USAGE transaction in the ledger.
   */
  private async deductCredits(
    userId: string,
    amount: number,
    llmUsageId: string,
  ): Promise<void> {
    try {
      const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
      if (!wallet) return; // No wallet — skip (shouldn't happen after onboarding)

      await prisma.$transaction([
        prisma.creditWallet.update({
          where: { userId },
          data: {
            balance: { decrement: amount },
            lifetimeUsed: { increment: amount },
          },
        }),
        prisma.creditTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -amount,
            type: 'USAGE',
            description: `LLM usage`,
            llmUsageId,
          },
        }),
      ]);
    } catch (err) {
      console.error('[LLMGateway] Credit deduction failed:', err);
    }
  }

  /**
   * Pre-flight: hard block if credits <= 0.
   * Emits a warning if < 20% of 30-day average spend remains.
   */
  private async enforceCredits(userId: string): Promise<void> {
    try {
      const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
      if (!wallet) return; // No wallet yet — don't block (first-time user path)

      // Hard block at zero
      if (wallet.balance <= 0) {
        // Check if free credits are expired
        const freeExpired =
          wallet.freeCreditsExpiry && wallet.freeCreditsExpiry < new Date();
        if (freeExpired || wallet.freeCreditsGranted === 0) {
          throw new Error(
            'Insufficient credits. Please top up your balance to continue using AI agents, ' +
            'or configure your own API key in Account Settings.',
          );
        }
      }

      // Soft warn at 80% used (emit to console for now; SSE event wired later)
      if (wallet.lifetimeAdded > 0) {
        const pctUsed = wallet.lifetimeUsed / wallet.lifetimeAdded;
        if (pctUsed >= 0.8) {
          console.warn(
            `[LLMGateway] Credit warning for user ${userId}: ` +
            `${(pctUsed * 100).toFixed(0)}% of credits used ($${wallet.balance.toFixed(2)} remaining)`,
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Insufficient credits')) throw err;
      console.warn('[LLMGateway] Credit check failed (non-blocking):', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const llmGateway = new LLMGateway();
