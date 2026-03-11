// =============================================================================
// AI Team Studio — Context Builder
// =============================================================================
// Assembles the full LLM context for an agent invocation:
//   1. Parallel-fetches all ContextSources the agent needs
//   2. Composes a system message with the agent's prompt + structured project data
//   3. Converts recent chat history into LLMMessage format
//
// When a ContextScope is provided, fetchers narrow to module-level data,
// reducing token usage by ~50-60%.
// =============================================================================

import { AgentDefinition, ContextSource } from '@/lib/ai/agents/types';
import { LLMMessage } from '@/lib/ai/providers/types';
import * as sources from './context-sources';
import { ContextScope } from './context-sources';

// ─── Public Interface ────────────────────────────────────────────────────────

export interface AgentContext {
  systemMessage: string;
  recentHistory: LLMMessage[];
}

export interface ContextBuildOptions {
  maxHistoryMessages?: number;
  scope?: ContextScope;
}

// ─── Fetcher Registry ────────────────────────────────────────────────────────

type ContextFetcher = (projectId: string, scope?: ContextScope) => Promise<unknown>;

const FETCHER_MAP: Record<ContextSource, ContextFetcher> = {
  project_info:    sources.fetchProjectInfo,
  sdlc_stages:     sources.fetchSDLCStages,
  cards:           sources.fetchCards,
  decisions:       sources.fetchDecisions,
  documents:       sources.fetchDocuments,
  chat_history:    sources.fetchChatHistory as ContextFetcher,
  agents_status:   sources.fetchAgentsStatus,
  llm_usage:       sources.fetchLLMUsage,
  wireframes:      sources.fetchWireframes,
  artifacts:       sources.fetchArtifacts,
  project_memory:  sources.fetchProjectMemory,
};

// ─── Formatter Registry ──────────────────────────────────────────────────────

type ContextFormatter = (data: unknown) => string;

const FORMATTER_MAP: Record<ContextSource, ContextFormatter> = {
  project_info:    formatProjectInfo,
  sdlc_stages:     formatSDLCStages,
  cards:           formatCards,
  decisions:       formatDecisions,
  documents:       formatDocuments,
  chat_history:    () => '', // chat_history is handled separately as recentHistory
  agents_status:   formatAgentsStatus,
  llm_usage:       formatLLMUsage,
  wireframes:      formatWireframes,
  artifacts:       formatArtifacts,
  project_memory:  formatProjectMemory,
};

// ─── ContextBuilder ──────────────────────────────────────────────────────────

export class ContextBuilder {
  /**
   * Build the full agent context: system message + recent conversation history.
   */
  async build(
    agentDef: AgentDefinition,
    projectId: string,
    options?: ContextBuildOptions,
  ): Promise<AgentContext> {
    const maxHistory = options?.maxHistoryMessages ?? 20;
    const scope = options?.scope;

    // Determine which sources to fetch
    const neededSources = agentDef.contextSources;

    // Parallel-fetch all required context sources, passing scope
    const fetchEntries = neededSources.map(
      (source) => {
        if (source === 'chat_history') {
          return [source, sources.fetchChatHistory(projectId, maxHistory + 10, scope)] as const;
        }
        return [source, FETCHER_MAP[source](projectId, scope)] as const;
      },
    );

    const results = await Promise.allSettled(
      fetchEntries.map(([, promise]) => promise),
    );

    // Collect results, skipping any that failed
    const contextData = new Map<ContextSource, unknown>();
    results.forEach((result, i) => {
      const source = fetchEntries[i][0];
      if (result.status === 'fulfilled' && result.value != null) {
        contextData.set(source, result.value);
      } else if (result.status === 'rejected') {
        console.warn(
          `[ContextBuilder] Failed to fetch ${source} for project ${projectId}:`,
          result.reason,
        );
      }
    });

    // Build the formatted context block (excluding chat_history, which goes into recentHistory)
    const contextSections: string[] = [];
    for (const source of neededSources) {
      if (source === 'chat_history') continue;
      const data = contextData.get(source);
      if (data == null) continue;
      const formatted = FORMATTER_MAP[source](data);
      if (formatted) {
        contextSections.push(formatted);
      }
    }

    // Compose system message
    const contextBlock = contextSections.length > 0
      ? `\n\n--- PROJECT CONTEXT ---\n${contextSections.join('\n\n')}\n--- END CONTEXT ---`
      : '';

    // Add scope instruction when module-scoped
    const scopeBlock = scope?.module
      ? `\n\nSCOPE: You are working on module "${scope.module}". Focus your response on this module's tasks and code. Do not discuss unrelated project areas.`
      : scope?.cardId
        ? `\n\nSCOPE: You are working on a specific task. Focus your response on this task only.`
        : '';

    const systemMessage = agentDef.systemPrompt + scopeBlock + contextBlock;

    // Log estimated token count for observability
    const estimatedTokens = Math.ceil(systemMessage.length / 4);
    console.log(
      `[ContextBuilder] ${scope ? 'SCOPED' : 'PROJECT-WIDE'} context: ~${estimatedTokens} tokens` +
      (scope?.module ? ` (module=${scope.module})` : scope?.cardId ? ` (card=${scope.cardId})` : ''),
    );

    // Build recent history as LLMMessage[]
    const recentHistory = await this.buildRecentHistory(
      contextData.get('chat_history'),
      neededSources.includes('chat_history') ? maxHistory : 0,
      projectId,
    );

    return { systemMessage, recentHistory };
  }

  /**
   * Convert raw chat history data into LLMMessage format.
   * If chat_history wasn't in the agent's contextSources, returns empty array.
   */
  private async buildRecentHistory(
    rawHistory: unknown,
    maxMessages: number,
    _projectId: string,
  ): Promise<LLMMessage[]> {
    if (maxMessages === 0 || !rawHistory) return [];

    const messages = rawHistory as Array<{
      role: string;
      content: string;
      agent?: { shortName: string; name: string } | null;
    }>;

    // Raw data comes newest-first, reverse for chronological order then take last N
    const chronological = [...messages].reverse().slice(-maxMessages);

    return chronological.map((msg): LLMMessage => {
      if (msg.role === 'USER') {
        return { role: 'user', content: msg.content };
      }
      if (msg.role === 'SYSTEM') {
        return { role: 'system', content: msg.content };
      }
      // AGENT messages become assistant messages, prefixed with agent identity
      const prefix = msg.agent ? `[${msg.agent.shortName}] ` : '';
      return { role: 'assistant', content: `${prefix}${msg.content}` };
    });
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const contextBuilder = new ContextBuilder();

// =============================================================================
// Context Formatters
// =============================================================================

function formatProjectInfo(data: unknown): string {
  const p = data as {
    name: string;
    description: string;
    status: string;
    currentStage: string;
    completion: number;
  };
  return [
    'PROJECT:',
    `  Name: ${p.name}`,
    `  Description: ${p.description || '(none)'}`,
    `  Status: ${p.status}`,
    `  Current Stage: ${p.currentStage}`,
    `  Completion: ${p.completion}%`,
  ].join('\n');
}

function formatSDLCStages(data: unknown): string {
  const stages = data as Array<{
    name: string;
    order: number;
    status: string;
    gatePassed: boolean;
  }>;
  if (stages.length === 0) return '';
  const lines = stages.map(
    (s) => `  ${s.order}. ${s.name} — ${s.status}${s.gatePassed ? ' [GATE PASSED]' : ''}`,
  );
  return ['SDLC PIPELINE:', ...lines].join('\n');
}

function formatCards(data: unknown): string {
  const cards = data as Array<{
    title: string;
    type: string;
    state: string;
    priority: string;
    module?: string | null;
    ownerAgent?: { shortName: string; name: string } | null;
  }>;
  if (cards.length === 0) return '';
  const lines = cards.map((c) => {
    const agent = c.ownerAgent ? ` (${c.ownerAgent.shortName})` : '';
    const mod = c.module ? ` [${c.module}]` : '';
    return `  [${c.type}] ${c.title} — ${c.state} ${c.priority}${agent}${mod}`;
  });
  return [`BOARD (${cards.length} cards):`, ...lines].join('\n');
}

function formatDecisions(data: unknown): string {
  const decisions = data as Array<{
    trigger: string;
    status: string;
    riskRating: string;
    recommendation: string;
    approvedOption: string | null;
    options: Array<{
      name: string;
      description: string;
      pros: string[];
      cons: string[];
      risk: string;
      effort: string;
    }>;
  }>;
  if (decisions.length === 0) return '';
  const lines = decisions.map((d) => {
    const optionsSummary = d.options.length > 0
      ? ` | Options: ${d.options.map((o) => o.name).join(', ')}`
      : '';
    const approved = d.approvedOption ? ` | Approved: ${d.approvedOption}` : '';
    return `  ${d.trigger} — ${d.status} [${d.riskRating}]${approved}${optionsSummary}`;
  });
  return [`DECISIONS (${decisions.length}):`, ...lines].join('\n');
}

function formatDocuments(data: unknown): string {
  const docs = data as Array<{
    title: string;
    type: string;
    status: string;
    wordCount: number;
    owner: string;
  }>;
  if (docs.length === 0) return '';
  const lines = docs.map(
    (d) => `  ${d.title} (${d.type}) — ${d.status} [${d.wordCount} words, owner: ${d.owner}]`,
  );
  return [`DOCUMENTS (${docs.length}):`, ...lines].join('\n');
}

function formatAgentsStatus(data: unknown): string {
  const agents = data as Array<{
    shortName: string;
    name: string;
    group: string;
    status: string;
    currentTask: string | null;
  }>;
  if (agents.length === 0) return '';
  const lines = agents.map((a) => {
    const task = a.currentTask ? ` — ${a.currentTask}` : '';
    return `  ${a.shortName} (${a.name}): ${a.status}${task}`;
  });
  return ['TEAM STATUS:', ...lines].join('\n');
}

function formatLLMUsage(data: unknown): string {
  const records = data as Array<{
    tokensUsed: number;
    cost: number;
    provider: string;
    model: string;
    agentName: string;
    createdAt: Date;
  }>;
  if (records.length === 0) return '';

  const totalTokens = records.reduce((sum, r) => sum + r.tokensUsed, 0);
  const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

  const byProvider = new Map<string, { tokens: number; cost: number }>();
  for (const r of records) {
    const key = r.provider;
    const current = byProvider.get(key) ?? { tokens: 0, cost: 0 };
    current.tokens += r.tokensUsed;
    current.cost += r.cost;
    byProvider.set(key, current);
  }

  const providerLines = Array.from(byProvider.entries()).map(
    ([provider, stats]) =>
      `  ${provider}: ${stats.tokens.toLocaleString()} tokens, $${stats.cost.toFixed(4)}`,
  );

  return [
    `LLM USAGE (last ${records.length} calls):`,
    `  Total: ${totalTokens.toLocaleString()} tokens, $${totalCost.toFixed(4)}`,
    ...providerLines,
  ].join('\n');
}

function formatWireframes(data: unknown): string {
  const wireframes = data as Array<{
    title: string;
    screen: string;
    status: string;
    device: string;
    owner: string;
    components: number;
    version: number;
  }>;
  if (wireframes.length === 0) return '';
  const lines = wireframes.map(
    (w) =>
      `  ${w.title} — ${w.screen || '(no screen)'} [${w.device}] ${w.status} v${w.version} (${w.components} components, owner: ${w.owner})`,
  );
  return [`WIREFRAMES (${wireframes.length}):`, ...lines].join('\n');
}

function formatArtifacts(data: unknown): string {
  const artifacts = data as Array<{
    name: string;
    type: string;
    ownerAgent: string;
    version: number;
    content?: string;
  }>;
  if (artifacts.length === 0) return '';

  const lines = artifacts.map((a) => {
    const preview = a.content
      ? `\n    ${a.content.slice(0, 500)}${a.content.length > 500 ? '...' : ''}`
      : '';
    return `  ${a.name} (${a.type}) v${a.version} by ${a.ownerAgent}${preview}`;
  });

  return [`MODULE ARTIFACTS (${artifacts.length}):`, ...lines].join('\n');
}

function formatProjectMemory(data: unknown): string {
  const memories = data as Array<{
    category: string;
    content: string;
    source: string;
  }>;
  if (memories.length === 0) return '';

  const lines = memories.map(
    (m) => `  [${m.category}] ${m.content}`,
  );
  return ['PROJECT MEMORY (key facts about this project):', ...lines].join('\n');
}
