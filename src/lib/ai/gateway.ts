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
    // Real provider adapters (OpenAI, Anthropic, Ollama) will be registered
    // here once their adapter classes are implemented.
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
   *
   * Once the LLMProviderConfig table is added to the schema, this method
   * will query the DB for real provider configs. Until then it returns mock.
   */
  async resolve(
    projectId?: string,
    agentId?: string,
  ): Promise<{ provider: LLMProvider; config: ProviderConfig; isMock: boolean }> {
    // TODO: Query LLMProviderConfig from DB when the schema is updated.
    //
    // Planned implementation:
    //   1. If agentId -> look up agent-scoped config
    //   2. Else if projectId -> look up project-scoped config
    //   3. Else -> look up user/workspace default
    //   4. Fallback -> mock
    //
    // For now, suppress unused-var warnings:
    void projectId;
    void agentId;

    return { provider: this.mockProvider, config: this.mockConfig, isMock: true };
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
    const { provider, config, isMock } = await this.resolve(
      options.projectId,
      options.agentId,
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
    const { provider, config } = await this.resolve(
      options.projectId,
      options.agentId,
    );

    yield* provider.stream(options, config);
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
