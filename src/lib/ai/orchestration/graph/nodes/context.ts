// =============================================================================
// AI Team Studio — Context Node
// =============================================================================
// Builds the LLM context for the routed agent. Wraps the existing
// ContextBuilder and adds token budget checking.
//
// Token budget tiers:
//   - Starter:    500,000 tokens/month
//   - Pro:      5,000,000 tokens/month
//   - Enterprise: 50,000,000 tokens/month
//   - Default:  5,000,000 tokens/month (when no explicit tier set)
//
// If budget is exceeded, emits a budget-exceeded SSE event and sets
// tokenBudgetRemaining to 0 for the conditional edge to route to END.
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { getAgentDefinition } from '@/lib/ai/agents/registry';
import { contextBuilder } from '@/lib/ai/context/context-builder';
import { LLMMessage } from '@/lib/ai/providers/types';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Token Budget Tiers
// ---------------------------------------------------------------------------

const BUDGET_TIERS: Record<string, number> = {
  starter: 500_000,
  pro: 5_000_000,
  enterprise: 50_000_000,
};

const DEFAULT_BUDGET = 5_000_000; // Pro tier by default

/**
 * Get the monthly token budget for a project.
 * Checks project metadata for a tier setting, defaults to pro.
 */
async function getTokenBudget(projectId: string): Promise<number> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });

    // Use project status as a rough proxy for tier
    // In production, this would come from a subscription/billing table
    const tier = (project?.status ?? 'active').toLowerCase();
    return BUDGET_TIERS[tier] ?? DEFAULT_BUDGET;
  } catch {
    return DEFAULT_BUDGET;
  }
}

/**
 * Get total tokens used by this project in the current month.
 */
async function getMonthlyTokenUsage(projectId: string): Promise<number> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await prisma.lLMUsage.aggregate({
      where: {
        projectId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { tokensUsed: true },
    });

    return result._sum.tokensUsed ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Context node.
 * Builds LLM context for the routed agent and checks token budget.
 */
export async function contextNode(
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> {
  const agentDef = getAgentDefinition(state.routedAgent);

  // Build context using existing ContextBuilder
  const context = await contextBuilder.build(agentDef, state.projectId);

  // Compose the full LLM messages array
  const llmMessages: LLMMessage[] = [
    { role: 'system', content: context.systemMessage },
    ...context.recentHistory,
    { role: 'user', content: state.userMessage },
  ];

  // Check token budget
  const [budget, used] = await Promise.all([
    getTokenBudget(state.projectId),
    getMonthlyTokenUsage(state.projectId),
  ]);

  const remaining = budget - used;

  if (remaining <= 0) {
    // Budget exceeded — emit SSE event
    const writer = (config as any).writer;
    if (writer) {
      writer({
        type: 'error',
        data: {
          message: `Token budget exceeded. Used ${used.toLocaleString()} of ${budget.toLocaleString()} tokens this month.`,
          budgetExceeded: true,
        },
      });
    }

    console.warn(
      `[ContextNode] Token budget exceeded for project ${state.projectId}: ${used}/${budget}`,
    );
  }

  return {
    systemMessage: context.systemMessage,
    recentHistory: context.recentHistory,
    llmMessages,
    tokenBudgetRemaining: remaining,
  };
}
