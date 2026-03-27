import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/kpi
 * Returns computed KPI metrics for a project:
 *  - card counts by state
 *  - agent activity stats
 *  - LLM cost data
 *  - decision stats
 *  - SDLC stage performance
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const [
      cardsByState,
      totalCards,
      agents,
      decisions,
      llmUsage,
      sdlcStages,
    ] = await Promise.all([
      prisma.card.groupBy({
        by: ['state'],
        where: { projectId },
        _count: { state: true },
      }),
      prisma.card.count({ where: { projectId } }),
      prisma.agent.findMany({
        where: { projectId },
        select: { id: true, name: true, shortName: true, avatar: true, status: true, currentTask: true },
      }),
      prisma.decision.findMany({
        where: { projectId },
        select: { id: true, status: true, createdAt: true, approvedAt: true },
      }),
      prisma.lLMUsage.findMany({
        where: { projectId },
        select: { provider: true, tokensUsed: true, actualCost: true, createdAt: true },
      }),
      prisma.sDLCStage.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
        select: { name: true, status: true, gatePassed: true },
      }),
    ]);

    // Card metrics
    const stateMap = cardsByState.reduce((acc, g) => {
      acc[g.state] = g._count.state;
      return acc;
    }, {} as Record<string, number>);

    const delivery = {
      total: totalCards,
      planned: stateMap['PLANNED'] ?? 0,
      in_progress: stateMap['IN_PROGRESS'] ?? 0,
      under_review: stateMap['UNDER_REVIEW'] ?? 0,
      testing: stateMap['TESTING'] ?? 0,
      blocked: stateMap['BLOCKED'] ?? 0,
      done: stateMap['DONE'] ?? 0,
      released: stateMap['RELEASED'] ?? 0,
    };

    // Agent metrics
    const workingAgents = agents.filter(a => a.status === 'WORKING');
    const agentStats = agents.map(a => ({
      name: a.name,
      shortName: a.shortName,
      avatar: a.avatar,
      status: a.status.toLowerCase(),
      currentTask: a.currentTask,
    }));

    // Decision metrics
    const approvedDecisions = decisions.filter(d => ['APPROVED', 'IMPLEMENTED', 'VERIFIED'].includes(d.status));
    const pendingDecisions = decisions.filter(d => ['DRAFTED', 'OPTIONS_COLLECTED', 'RECOMMENDED', 'AWAITING_APPROVAL'].includes(d.status));
    const decisionStats = {
      total: decisions.length,
      approved: approvedDecisions.length,
      pending: pendingDecisions.length,
      approval_rate: decisions.length > 0 ? Math.round((approvedDecisions.length / decisions.length) * 100) : 0,
    };

    // LLM cost metrics
    const totalCost = llmUsage.reduce((sum, u) => sum + u.actualCost, 0);
    const totalTokens = llmUsage.reduce((sum, u) => sum + u.tokensUsed, 0);
    const costByProvider = llmUsage.reduce((acc, u) => {
      const provider = u.provider.toLowerCase();
      acc[provider] = (acc[provider] || 0) + u.actualCost;
      return acc;
    }, {} as Record<string, number>);
    const tokensByProvider = llmUsage.reduce((acc, u) => {
      const provider = u.provider.toLowerCase();
      acc[provider] = (acc[provider] || 0) + u.tokensUsed;
      return acc;
    }, {} as Record<string, number>);

    // SDLC stages
    const completedGates = sdlcStages.filter(s => s.gatePassed).length;
    const stages = sdlcStages.map(s => ({
      name: s.name,
      status: s.status.toLowerCase(),
      gate_passed: s.gatePassed,
    }));

    return NextResponse.json({
      delivery,
      agents: {
        total: agents.length,
        working: workingAgents.length,
        list: agentStats,
      },
      decisions: decisionStats,
      llm: {
        total_cost: totalCost,
        total_tokens: totalTokens,
        by_provider: costByProvider,
        tokens_by_provider: tokensByProvider,
      },
      sdlc: {
        stages,
        gates_passed: completedGates,
        total_stages: sdlcStages.length,
      },
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/kpi error:', error);
    return NextResponse.json({ error: 'Failed to fetch KPI data' }, { status: 500 });
  }
}
