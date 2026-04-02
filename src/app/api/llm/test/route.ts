import { NextRequest, NextResponse } from 'next/server';
import { llmGateway } from '@/lib/ai';
import type { ProviderConfig } from '@/lib/ai';

export const dynamic = 'force-dynamic';

/**
 * POST /api/llm/test
 * Test a provider configuration by validating the connection and listing models.
 * Body: { provider, apiKey?, baseUrl?, defaultModel }
 * Returns: { success: boolean, message: string, models?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.provider || typeof body.provider !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Provider is required' },
        { status: 400 }
      );
    }

    // defaultModel is optional — when omitted, we still validate connection + list models

    const validProviders = ['openai', 'anthropic', 'ollama', 'mistral', 'nvidia', 'groq', 'together', 'openrouter', 'deepseek', 'byteplus', 'custom'];
    if (!validProviders.includes(body.provider)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Build the config object for testing
    const config: ProviderConfig = {
      provider: body.provider,
      apiKey: body.apiKey ?? undefined,
      baseUrl: body.baseUrl?.trim() || undefined,
      organizationId: body.organizationId?.trim() || undefined,
      defaultModel: body.defaultModel?.trim() || '',
    };

    // Get the provider adapter from the gateway
    const provider = llmGateway.getProvider(body.provider);

    if (!provider) {
      return NextResponse.json({
        success: false,
        message: `Provider "${body.provider}" is not registered. Available providers will be added as their adapters are implemented.`,
      });
    }

    // Validate connection
    const startTime = Date.now();
    let isValid: boolean;

    try {
      isValid = await provider.validateConnection(config);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.error(
        `[LLM Test] Connection validation failed for "${body.provider}" after ${elapsed}ms:`,
        err
      );
      return NextResponse.json({
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        latencyMs: elapsed,
      });
    }

    if (!isValid) {
      return NextResponse.json({
        success: false,
        message: 'Connection validation failed. Please check your API key, base URL, and provider settings.',
        latencyMs: Date.now() - startTime,
      });
    }

    // If valid, also list available models
    let models: string[] = [];

    try {
      models = await provider.listModels(config);
    } catch (err) {
      // Model listing is non-critical; connection is still valid
      console.warn(
        `[LLM Test] Model listing failed for "${body.provider}":`,
        err
      );
    }

    const latencyMs = Date.now() - startTime;

    // ── Model Capability Assessment ────────────────────────────────────
    // Evaluate how well the selected model will perform for Codanium's
    // agent tasks: code generation, tool calling, structured output, reasoning.
    const modelName = (body.defaultModel || '').toLowerCase();
    const assessment = assessModelCapabilities(body.provider, modelName);

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${provider.name}. ${models.length} model(s) available.`,
      models,
      latencyMs,
      assessment,
    });
  } catch (error) {
    console.error('POST /api/llm/test error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred while testing the configuration',
      },
      { status: 500 }
    );
  }
}

// ─── Model Capability Assessment ──────────────────────────────────────────────

interface ModelAssessment {
  overall: 'excellent' | 'good' | 'fair' | 'poor';
  overallMessage: string;
  capabilities: {
    name: string;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
    description: string;
  }[];
  recommendation?: string;
}

function assessModelCapabilities(provider: string, model: string): ModelAssessment {
  // ── Excellent tier: flagship models with strong coding + tool calling ──
  const excellentModels = [
    'gpt-4o', 'gpt-4-turbo', 'gpt-4',
    'claude-opus', 'claude-sonnet-4', 'claude-sonnet-3.5',
    'qwen3-coder', 'qwen-coder',
    'deepseek-coder-v2', 'deepseek-v3',
    'codestral',
  ];

  // ── Good tier: capable but not top-tier ──
  const goodModels = [
    'gpt-4o-mini', 'gpt-3.5-turbo',
    'claude-haiku', 'claude-sonnet-3',
    'llama3.1:70b', 'llama3:70b', 'llama3.3',
    'qwen2.5:72b', 'qwen2.5:32b', 'qwen3',
    'deepseek-r1', 'deepseek-coder',
    'gemma2:27b', 'mixtral:8x22b',
    'command-r-plus',
  ];

  // ── Fair tier: usable but may struggle with complex tool calling ──
  const fairModels = [
    'llama3.1:8b', 'llama3:8b',
    'qwen2.5:7b', 'qwen2.5:14b',
    'gemma2:9b', 'mixtral:8x7b',
    'phi-3', 'phi-4',
    'mistral', 'mistral-nemo',
    'command-r',
  ];

  // Check which tier the model falls into
  const matchesTier = (tier: string[]) =>
    tier.some(t => model.includes(t));

  // Cloud models via Ollama (e.g., ":cloud" suffix) get a boost
  const isCloud = model.includes(':cloud') || model.includes('cloud');

  let tier: 'excellent' | 'good' | 'fair' | 'poor';

  if (provider === 'openai' && matchesTier(excellentModels)) {
    tier = 'excellent';
  } else if (provider === 'anthropic' && (model.includes('opus') || model.includes('sonnet-4') || model.includes('sonnet-3.5'))) {
    tier = 'excellent';
  } else if (matchesTier(excellentModels)) {
    tier = isCloud ? 'excellent' : 'good';
  } else if (matchesTier(goodModels)) {
    tier = isCloud ? 'good' : 'good';
  } else if (matchesTier(fairModels)) {
    tier = 'fair';
  } else if (['openai', 'anthropic', 'mistral', 'nvidia', 'groq', 'together'].includes(provider)) {
    // Unknown but from a major provider — likely decent
    tier = 'good';
  } else {
    // Small local models (1-3B params) or unknown
    const smallIndicators = ['1b', '1.5b', '2b', '3b', '135m', 'tiny', 'small', 'mini', 'nano'];
    if (smallIndicators.some(s => model.includes(s))) {
      tier = 'poor';
    } else {
      tier = 'fair';
    }
  }

  // Build capability ratings based on tier
  const capabilities = buildCapabilities(tier, provider, model);

  const overallMessages: Record<string, string> = {
    excellent: 'This model is an excellent fit for Codanium. It can handle code generation, tool calling, and complex reasoning tasks reliably.',
    good: 'This model is a good fit. It should handle most tasks well, though complex multi-step code generation may occasionally need retries.',
    fair: 'This model can work but may struggle with complex code generation and tool calling. Expect some inconsistencies in agent output quality.',
    poor: 'This model is too small for Codanium. Agents need strong reasoning, code generation, and tool calling capabilities. We recommend upgrading to a larger model.',
  };

  const recommendations: Record<string, string | undefined> = {
    excellent: undefined,
    good: 'For best results, consider GPT-4o, Claude Sonnet 4, or Qwen3 Coder (70B+).',
    fair: 'Upgrade recommended: GPT-4o, Claude Sonnet 4, or a 70B+ parameter model will produce significantly better code and follow tool calling instructions more reliably.',
    poor: 'Strongly recommended: Switch to GPT-4o, Claude Sonnet 4, Qwen3 Coder, or at minimum a 30B+ parameter model. Small models cannot reliably follow agent instructions.',
  };

  return {
    overall: tier,
    overallMessage: overallMessages[tier],
    capabilities,
    recommendation: recommendations[tier],
  };
}

function buildCapabilities(
  tier: 'excellent' | 'good' | 'fair' | 'poor',
  provider: string,
  model: string,
) {
  const r = (t: 'excellent' | 'good' | 'fair' | 'poor') => t;

  // Code generation capability
  const isCoder = model.includes('coder') || model.includes('codestral') || model.includes('deepseek');
  const codeRating = isCoder && tier !== 'poor' ? r('excellent')
    : tier === 'excellent' ? r('excellent')
    : tier === 'good' ? r('good')
    : tier === 'fair' ? r('fair')
    : r('poor');

  // Tool calling (structured function calling)
  const toolRating = (['openai', 'anthropic', 'mistral', 'groq'].includes(provider)) ? r('excellent')
    : tier === 'excellent' ? r('good')
    : tier === 'good' ? r('good')
    : tier === 'fair' ? r('fair')
    : r('poor');

  // Reasoning (multi-step planning, architecture)
  const isReasoner = model.includes('o1') || model.includes('o3') || model.includes('r1') || model.includes('think');
  const reasonRating = isReasoner ? r('excellent')
    : tier === 'excellent' ? r('excellent')
    : tier === 'good' ? r('good')
    : tier === 'fair' ? r('fair')
    : r('poor');

  // Following instructions (long system prompts, agent personas)
  const instructRating = tier === 'excellent' ? r('excellent')
    : tier === 'good' ? r('good')
    : tier === 'fair' ? r('fair')
    : r('poor');

  return [
    {
      name: 'Code Generation',
      rating: codeRating,
      description: codeRating === 'excellent' ? 'Writes production-quality code reliably'
        : codeRating === 'good' ? 'Writes good code, occasional issues'
        : codeRating === 'fair' ? 'Basic code, may need manual fixes'
        : 'Cannot reliably generate working code',
    },
    {
      name: 'Tool Calling',
      rating: toolRating,
      description: toolRating === 'excellent' ? 'Reliably calls tools with correct parameters'
        : toolRating === 'good' ? 'Usually calls tools correctly'
        : toolRating === 'fair' ? 'Sometimes fails to call tools properly'
        : 'Unreliable tool calling — agents may not function',
    },
    {
      name: 'Reasoning',
      rating: reasonRating,
      description: reasonRating === 'excellent' ? 'Strong multi-step reasoning and planning'
        : reasonRating === 'good' ? 'Good reasoning for most tasks'
        : reasonRating === 'fair' ? 'Basic reasoning, struggles with complex planning'
        : 'Limited reasoning — not suitable for architecture or planning',
    },
    {
      name: 'Instruction Following',
      rating: instructRating,
      description: instructRating === 'excellent' ? 'Follows complex agent personas and rules precisely'
        : instructRating === 'good' ? 'Follows instructions well with minor drift'
        : instructRating === 'fair' ? 'May ignore parts of system prompts'
        : 'Cannot follow complex multi-section instructions',
    },
  ];
}
