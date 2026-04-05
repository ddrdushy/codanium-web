import { NextRequest, NextResponse } from 'next/server';
import { LLMGateway } from '@/lib/ai/gateway';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/llm/execute
 * Execute a standalone LLM call through the gateway.
 * Uses the full resolution chain: User BYOK -> Agent -> Project -> Platform fallback.
 *
 * Body: {
 *   messages: Array<{ role: string, content: string }>,
 *   agentShortName?: string,   // For agent-level model override
 *   maxTokens?: number,        // Default: 1500
 *   temperature?: number,      // Default: 0.7
 *   taskType?: string,         // "chat" | "document" | "code" | "review" | "summary"
 * }
 *
 * Returns: { content: string, model: string, provider: string, tokens: { prompt, completion } }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate message format
    for (const msg of body.messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: 'Each message must have "role" and "content" fields' },
          { status: 400 }
        );
      }
    }

    const gateway = new LLMGateway();
    const maxTokens = Math.min(body.maxTokens || 1500, 4000); // Cap at 4000
    const temperature = Math.min(Math.max(body.temperature || 0.7, 0), 1);

    // Resolve the LLM configuration through the gateway's priority chain
    // Gateway uses agentId for agent-level model overrides
    const result = await gateway.complete({
      projectId,
      agentId: body.agentShortName, // Gateway resolves agent-level config by ID
      messages: body.messages,
      maxTokens,
      temperature,
    });

    return NextResponse.json({
      content: result.content,
      model: result.model,
      provider: result.provider,
      tokens: result.tokensUsed,
      latencyMs: result.latencyMs,
      taskType: body.taskType || 'chat',
    });
  } catch (error: any) {
    console.error('POST /api/projects/[id]/llm/execute error:', error);
    return NextResponse.json(
      { error: error.message || 'LLM execution failed' },
      { status: 500 }
    );
  }
}
