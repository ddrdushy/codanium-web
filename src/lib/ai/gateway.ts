// =============================================================================
// AI Team Studio — LLM Gateway
// =============================================================================
// Central singleton that routes every LLM request to the correct provider.
// Handles BYOM (Bring Your Own Model) config resolution, provider dispatch,
// latency measurement, and usage logging.
//
// Resolution priority: Agent-level -> Project-level -> User-level -> Mock
// When real provider configs are added to the DB, the resolve() method will
// query them. Until then, all traffic routes through the MockProvider.
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
   * Resolution priority:
   *   1. Agent-level config (if agentId is provided)
   *   2. Project-level config (if projectId is provided)
   *   3. User-level / workspace default
   *   4. Mock fallback (always available)
   */
  async resolve(
    projectId?: string,
    agentId?: string,
    userId?: string,
  ): Promise<{ provider: LLMProvider; config: ProviderConfig; isMock: boolean }> {
    if (projectId) {
      // Try agent-level config first
      if (agentId) {
        try {
          const agentConfig = await prisma.lLMProviderConfig.findFirst({
            where: { projectId, agentShortName: agentId, scope: 'AGENT', isActive: true },
          });
          if (agentConfig) {
            return this.resolveConfig(agentConfig);
          }
        } catch {
          // DB query failed — fall through to next level
        }
      }

      // Try project-level config
      try {
        const projectConfig = await prisma.lLMProviderConfig.findFirst({
          where: { projectId, scope: 'PROJECT', isActive: true },
        });
        if (projectConfig) {
          return this.resolveConfig(projectConfig);
        }
      } catch {
        // DB query failed — fall through to user-level
      }
    }

    // Try user-level / workspace default config
    if (userId) {
      try {
        const userConfig = await prisma.lLMProviderConfig.findFirst({
          where: { userId, scope: 'USER', isActive: true },
        });
        if (userConfig) {
          return this.resolveConfig(userConfig);
        }
      } catch {
        // DB query failed — fall through to mock
      }
    }

    // Try admin-level (global) settings as second-to-last fallback
    try {
      const adminSettings = await prisma.adminSetting.findMany({
        where: { key: { in: ['llm.defaultProvider', 'llm.defaultModel', 'llm.baseUrl'] } },
      });
      const adminMap: Record<string, string> = {};
      for (const s of adminSettings) {
        adminMap[s.key] = String(s.value);
      }
      const adminProvider = adminMap['llm.defaultProvider'];
      if (adminProvider && adminProvider !== 'mock' && this.providers.has(adminProvider)) {
        const config: ProviderConfig = {
          provider: adminProvider,
          baseUrl: adminMap['llm.baseUrl'] || undefined,
          defaultModel: adminMap['llm.defaultModel'] || 'llama3',
        };
        return { provider: this.providers.get(adminProvider)!, config, isMock: false };
      }
    } catch {
      // Admin settings unavailable — fall through to mock
    }

    // Fall back to mock
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

  /**
   * Execute a single-shot LLM completion.
   *
   * Measures latency, logs usage for real (non-mock) providers, and returns
   * the full LLMResponse.
   */
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

    // Log usage asynchronously (fire-and-forget) for real providers only.
    // Mock usage is not logged to keep the DB clean during development.
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

  /**
   * Execute a streaming LLM completion.
   *
   * Yields LLMStreamChunk objects as they arrive from the provider.
   * The final chunk (done === true) includes accumulated token counts.
   */
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

    // Log usage for real providers after stream completes (fire-and-forget)
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

  /**
   * Register a new provider adapter at runtime.
   *
   * @param name     Provider key (e.g. "openai", "anthropic", "ollama")
   * @param provider The LLMProvider implementation
   */
  registerProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Get a registered provider by name. Returns undefined if not found.
   */
  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  // -------------------------------------------------------------------------
  // Usage Logging
  // -------------------------------------------------------------------------

  /**
   * Persist token usage and estimated cost to the LLMUsage table.
   * Only called for non-mock providers.
   */
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
      // Non-critical — log and continue
      console.error('[LLMGateway] Usage logging failed:', err);
    }
  }

  /**
   * Rough cost estimation based on provider-specific per-token rates.
   *
   * These rates are approximate and will be replaced with real pricing data
   * from provider APIs or a pricing configuration table.
   */
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
