import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/agent-llm-config
 * List all agent-level LLM overrides (scope = 'AGENT').
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const configs = await prisma.lLMProviderConfig.findMany({
    where: { scope: 'AGENT' },
    orderBy: { agentShortName: 'asc' },
  });

  return NextResponse.json(
    configs.map((c) => ({
      id: c.id,
      agentShortName: c.agentShortName,
      provider: c.provider,
      model: c.defaultModel,
      baseUrl: c.baseUrl ?? '',
    }))
  );
}

/**
 * POST /api/admin/agent-llm-config
 * Upsert an agent-level LLM override.
 * Body: { agentShortName, provider, model, baseUrl? }
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { agentShortName, provider, model, baseUrl } = body;

  if (!agentShortName || !provider || !model) {
    return NextResponse.json(
      { error: 'agentShortName, provider, and model are required' },
      { status: 400 }
    );
  }

  const existing = await prisma.lLMProviderConfig.findFirst({
    where: { scope: 'AGENT', agentShortName },
  });

  if (existing) {
    await prisma.lLMProviderConfig.update({
      where: { id: existing.id },
      data: {
        provider,
        defaultModel: model,
        baseUrl: baseUrl || null,
      },
    });
  } else {
    await prisma.lLMProviderConfig.create({
      data: {
        scope: 'AGENT',
        agentShortName,
        provider,
        defaultModel: model,
        baseUrl: baseUrl || null,
      },
    });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/agent-llm-config?agentShortName=BA
 * Remove an agent-level LLM override.
 */
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const agentShortName = searchParams.get('agentShortName');

  if (!agentShortName) {
    return NextResponse.json(
      { error: 'agentShortName query parameter is required' },
      { status: 400 }
    );
  }

  const existing = await prisma.lLMProviderConfig.findFirst({
    where: { scope: 'AGENT', agentShortName },
  });

  if (existing) {
    await prisma.lLMProviderConfig.delete({ where: { id: existing.id } });
  }

  return NextResponse.json({ success: true });
}
