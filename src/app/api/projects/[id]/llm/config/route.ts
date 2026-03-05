import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mask API key to show only last 4 characters. */
function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

/** Resolve the current user ID from the session, falling back to demo. */
async function resolveUserId(): Promise<string> {
  try {
    const session = await auth();
    return (session?.user as any)?.id ?? 'demo-user-id';
  } catch {
    return 'demo-user-id';
  }
}

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/llm/config
// ---------------------------------------------------------------------------

/**
 * List all LLM provider configurations scoped to this project.
 * Returns configs with API keys masked (last 4 chars only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const configs = await prisma.lLMProviderConfig.findMany({
      where: {
        projectId,
        scope: { in: ['PROJECT', 'AGENT'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const masked = configs.map((config) => ({
      id: config.id,
      provider: config.provider,
      displayName: config.displayName,
      apiKey: maskApiKey(config.apiKeyEncrypted),
      baseUrl: config.baseUrl,
      organizationId: config.organizationId,
      defaultModel: config.defaultModel,
      isActive: config.isActive,
      scope: config.scope,
      agentShortName: config.agentShortName,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));

    return NextResponse.json(masked);
  } catch (error) {
    console.error('GET /api/projects/[id]/llm/config error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project LLM configurations' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/llm/config
// ---------------------------------------------------------------------------

/**
 * Create a project-level or agent-level LLM provider configuration.
 * Body: { provider, displayName?, apiKey?, baseUrl?, organizationId?, defaultModel, agentShortName? }
 *
 * If agentShortName is provided, scope is set to AGENT.
 * Otherwise, scope is set to PROJECT.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!body.provider || typeof body.provider !== 'string') {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    if (!body.defaultModel || typeof body.defaultModel !== 'string') {
      return NextResponse.json(
        { error: 'Default model is required' },
        { status: 400 }
      );
    }

    const validProviders = ['openai', 'anthropic', 'ollama', 'custom'];
    if (!validProviders.includes(body.provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // If agentShortName is provided, verify the agent exists in this project
    const agentShortName = body.agentShortName?.trim() || null;
    if (agentShortName) {
      const agent = await prisma.agent.findFirst({
        where: { projectId, shortName: agentShortName },
        select: { id: true },
      });

      if (!agent) {
        return NextResponse.json(
          { error: `Agent "${agentShortName}" not found in this project` },
          { status: 404 }
        );
      }
    }

    const scope = agentShortName ? 'AGENT' : 'PROJECT';
    const userId = await resolveUserId();

    const config = await prisma.lLMProviderConfig.create({
      data: {
        provider: body.provider,
        displayName: body.displayName?.trim() || `${body.provider} (${scope === 'AGENT' ? agentShortName : 'Project'})`,
        // Store API key as-is for now; encryption will be added in Phase 7
        apiKeyEncrypted: body.apiKey ?? null,
        baseUrl: body.baseUrl?.trim() || null,
        organizationId: body.organizationId?.trim() || null,
        defaultModel: body.defaultModel.trim(),
        scope,
        projectId,
        userId,
        agentShortName,
      },
    });

    return NextResponse.json(
      {
        id: config.id,
        provider: config.provider,
        displayName: config.displayName,
        apiKey: maskApiKey(config.apiKeyEncrypted),
        baseUrl: config.baseUrl,
        organizationId: config.organizationId,
        defaultModel: config.defaultModel,
        isActive: config.isActive,
        scope: config.scope,
        agentShortName: config.agentShortName,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/projects/[id]/llm/config error:', error);
    return NextResponse.json(
      { error: 'Failed to create project LLM configuration' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]/llm/config?id=xxx
// ---------------------------------------------------------------------------

/**
 * Delete a project-level or agent-level LLM provider configuration by ID.
 * Query param: ?id=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required as a query parameter (?id=xxx)' },
        { status: 400 }
      );
    }

    // Verify the config belongs to this project
    const existing = await prisma.lLMProviderConfig.findFirst({
      where: {
        id: configId,
        projectId,
        scope: { in: ['PROJECT', 'AGENT'] },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Configuration not found in this project' },
        { status: 404 }
      );
    }

    await prisma.lLMProviderConfig.delete({
      where: { id: configId },
    });

    return NextResponse.json({ success: true, deletedId: configId });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/llm/config error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project LLM configuration' },
      { status: 500 }
    );
  }
}
