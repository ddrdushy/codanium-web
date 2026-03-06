import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { getAllAgentDefinitions, getAgentDefinition } from '@/lib/ai/agents/registry';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ── Agent avatar map (matches project-seed.ts) ──────────────────────────────
const AGENT_AVATARS: Record<string, string> = {
  ORC: '\u{1F3AF}', STC: '\u26A1',     DEC: '\u2696\uFE0F', AUD: '\u{1F6E1}\uFE0F', SEC: '\u{1F512}',
  BA:  '\u{1F4CB}', SA:  '\u{1F3D7}\uFE0F', UX:  '\u{1F3A8}',  PM:  '\u{1F4CA}',  TL:  '\u{1F451}',
  JD:  '\u{1F4BB}', SD:  '\u{1F50D}', QA:  '\u{1F9EA}',  AT:  '\u{1F916}',  PF:  '\u26A1',
  PE:  '\u{1F527}', DO:  '\u{1F680}', IE:  '\u{1F50C}',  SM:  '\u{1F511}',  SR:  '\u{1F4E1}',
  LLM: '\u{1F9E0}', PRE: '\u270D\uFE0F',  CA:  '\u{1F4B0}',
};

// ── Group display names ──────────────────────────────────────────────────────
const GROUP_LABELS: Record<string, string> = {
  GOVERNANCE: 'Governance',
  SDLC: 'SDLC',
  ENGINEERING: 'Engineering',
  PLATFORM: 'Platform & Infrastructure',
  AI_COST: 'AI & Cost Management',
};

/**
 * GET /api/admin/agents
 * Returns all agent definitions with their admin-level settings.
 * Merges static definitions with any saved admin overrides from AdminSetting.
 */
export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const definitions = getAllAgentDefinitions();

    // Load admin overrides from settings
    const settingsRecord = await prisma.adminSetting.findUnique({
      where: { key: 'agents.config' },
    });

    const overrides: Record<string, AgentOverride> = settingsRecord?.value
      ? JSON.parse(settingsRecord.value)
      : {};

    // Get usage stats per agent (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const usageStats = await prisma.lLMUsage.groupBy({
      by: ['agentName'],
      _sum: { tokensUsed: true, cost: true },
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    const usageMap = new Map(
      usageStats.map((u) => [
        u.agentName,
        {
          totalTokens: u._sum.tokensUsed ?? 0,
          totalCost: u._sum.cost ?? 0,
          callCount: u._count.id,
        },
      ]),
    );

    // Get active instance count per agent
    const activeInstances = await prisma.agent.groupBy({
      by: ['shortName'],
      _count: { id: true },
      where: { status: 'WORKING' },
    });
    const activeMap = new Map(activeInstances.map((a) => [a.shortName, a._count.id]));

    // Total instances per agent
    const totalInstances = await prisma.agent.groupBy({
      by: ['shortName'],
      _count: { id: true },
    });
    const totalMap = new Map(totalInstances.map((a) => [a.shortName, a._count.id]));

    // Build response
    const agents = definitions.map((def) => {
      const override = overrides[def.shortName] ?? {};
      const usage = usageMap.get(def.shortName);

      return {
        shortName: def.shortName,
        name: def.name,
        group: def.group,
        groupLabel: GROUP_LABELS[def.group] ?? def.group,
        avatar: AGENT_AVATARS[def.shortName] ?? '\u{1F916}',
        temperature: override.temperature ?? def.temperature,
        defaultTemperature: def.temperature,
        enabled: override.enabled !== false, // enabled by default
        capabilities: def.capabilities,
        contextSources: def.contextSources,
        outputTypes: def.outputTypes,
        authority: def.authority,
        systemPromptPreview: def.systemPrompt.slice(0, 200) + (def.systemPrompt.length > 200 ? '...' : ''),
        systemPromptLength: def.systemPrompt.length,
        // Stats
        activeInstances: activeMap.get(def.shortName) ?? 0,
        totalInstances: totalMap.get(def.shortName) ?? 0,
        usage30d: usage ?? { totalTokens: 0, totalCost: 0, callCount: 0 },
      };
    });

    // Group summary
    const groups = Object.entries(GROUP_LABELS).map(([key, label]) => ({
      key,
      label,
      agentCount: agents.filter((a) => a.group === key).length,
      enabledCount: agents.filter((a) => a.group === key && a.enabled).length,
    }));

    return NextResponse.json({
      agents,
      groups,
      totalAgents: agents.length,
      enabledAgents: agents.filter((a) => a.enabled).length,
    });
  } catch (err) {
    console.error('GET /api/admin/agents error:', err);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/agents
 * Update agent configuration overrides.
 * Body: { shortName: string, enabled?: boolean, temperature?: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { shortName, enabled, temperature } = body;

    if (!shortName || typeof shortName !== 'string') {
      return NextResponse.json({ error: 'Agent shortName is required' }, { status: 400 });
    }

    // Validate agent exists
    try {
      getAgentDefinition(shortName);
    } catch {
      return NextResponse.json({ error: `Unknown agent: ${shortName}` }, { status: 404 });
    }

    // Validate temperature
    if (temperature !== undefined) {
      const temp = Number(temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        return NextResponse.json({ error: 'Temperature must be between 0 and 2' }, { status: 400 });
      }
    }

    // Load current overrides
    const settingsRecord = await prisma.adminSetting.findUnique({
      where: { key: 'agents.config' },
    });

    const overrides: Record<string, AgentOverride> = settingsRecord?.value
      ? JSON.parse(settingsRecord.value)
      : {};

    // Update the specific agent override
    if (!overrides[shortName]) {
      overrides[shortName] = {};
    }
    if (enabled !== undefined) overrides[shortName].enabled = enabled;
    if (temperature !== undefined) overrides[shortName].temperature = Number(temperature);

    const userId = (session.user as any)?.id;
    const serialized = JSON.stringify(overrides);

    // Save
    await prisma.adminSetting.upsert({
      where: { key: 'agents.config' },
      create: { key: 'agents.config', value: serialized, updatedBy: userId ?? '' },
      update: { value: serialized, updatedBy: userId ?? '' },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'AGENT_CONFIG_UPDATED',
        target: shortName,
        details: JSON.stringify({ enabled, temperature }),
        userId: userId ?? '',
      },
    });

    return NextResponse.json({ success: true, overrides: overrides[shortName] });
  } catch (err) {
    console.error('PUT /api/admin/agents error:', err);
    return NextResponse.json({ error: 'Failed to update agent config' }, { status: 500 });
  }
}

// ── Type ─────────────────────────────────────────────────────────────────────

interface AgentOverride {
  enabled?: boolean;
  temperature?: number;
}
