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

    const validProviders = ['openai', 'anthropic', 'ollama', 'custom'];
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

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${provider.name}. ${models.length} model(s) available.`,
      models,
      latencyMs,
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
