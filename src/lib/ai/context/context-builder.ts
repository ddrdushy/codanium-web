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

    // Build pipeline state summary — tells the agent where we are in the workflow
    const pipelineState = this.buildPipelineState(agentDef.shortName, contextData);

    const systemMessage = agentDef.systemPrompt + scopeBlock + pipelineState + contextBlock;

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
   * Build a pipeline state summary that tells the agent exactly where we are.
   * This prevents agents from repeating work or asking questions that were
   * already answered by earlier agents in the delegation chain.
   */
  private buildPipelineState(
    currentAgentShortName: string,
    contextData: Map<ContextSource, unknown>,
  ): string {
    const lines: string[] = [];

    // Check which agents have already spoken
    const chatHistory = contextData.get('chat_history') as Array<{
      role: string;
      content: string;
      agent?: { shortName: string; name: string } | null;
    }> | undefined;

    const agentsThatSpoke = new Set<string>();
    if (chatHistory) {
      for (const msg of chatHistory) {
        if (msg.role === 'AGENT' && msg.agent?.shortName) {
          agentsThatSpoke.add(msg.agent.shortName);
        }
      }
    }

    // Check what documents exist
    const docs = contextData.get('documents') as Array<{
      title: string;
      type: string;
    }> | undefined;

    const hasBRD = docs?.some(d => d.type === 'BRD' || d.title.toLowerCase().includes('business requirements')) ?? false;
    const hasSDD = docs?.some(d => d.type === 'SDD' || d.title.toLowerCase().includes('system design') || d.title.toLowerCase().includes('sdd')) ?? false;

    // Check cards
    const cards = contextData.get('cards') as Array<{
      title: string;
      type: string;
    }> | undefined;
    const cardCount = cards?.length ?? 0;
    const epicCount = cards?.filter(c => c.type === 'EPIC').length ?? 0;
    const featureCount = cards?.filter(c => c.type === 'FEATURE').length ?? 0;
    const taskCount = cards?.filter(c => c.type === 'TASK').length ?? 0;

    // Check memories
    const memories = contextData.get('project_memory') as Array<{
      category: string;
      content: string;
    }> | undefined;
    const memoryCount = memories?.length ?? 0;

    // Build the state summary
    lines.push('\n\n═══════════════════════════════════════════════════════════');
    lines.push('PIPELINE STATE — WHERE WE ARE RIGHT NOW');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(`You are: ${currentAgentShortName}`);

    // Agent participation
    if (agentsThatSpoke.size > 0) {
      const agentList = Array.from(agentsThatSpoke).join(', ');
      lines.push(`Agents who have already spoken in this conversation: ${agentList}`);
    }

    // Pipeline completion status
    const completionLines: string[] = [];
    if (agentsThatSpoke.has('BA')) completionLines.push('  ✅ BA (Business Analyst) — requirements gathered');
    if (hasBRD) completionLines.push('  ✅ BRD (Business Requirements Document) — created');
    if (agentsThatSpoke.has('SA')) completionLines.push('  ✅ SA (Solution Architect) — architecture designed');
    if (hasSDD) completionLines.push('  ✅ SDD (System Design Document) — created');
    if (cardCount > 0) completionLines.push(`  ✅ Cards created — ${cardCount} total (${epicCount} epics, ${featureCount} features, ${taskCount} tasks)`);
    if (agentsThatSpoke.has('PM')) completionLines.push('  ✅ PM (Product Manager) — backlog organized');
    if (agentsThatSpoke.has('TL')) completionLines.push('  ✅ TL (Tech Lead) — execution planned');
    if (agentsThatSpoke.has('PE')) completionLines.push('  ✅ PE (Platform Engineer) — infrastructure designed');
    if (agentsThatSpoke.has('JD')) completionLines.push('  ✅ JD (Junior Developer) — writing code');
    if (agentsThatSpoke.has('SD')) completionLines.push('  ✅ SD (Senior Developer) — writing code');

    if (completionLines.length > 0) {
      lines.push('Completed steps:');
      lines.push(...completionLines);
    }

    // Check for code artifacts
    const codeArtifacts = contextData.get('artifacts') as Array<{
      name: string;
      type: string;
      ownerAgent: string;
    }> | undefined;
    const codeArtifactCount = codeArtifacts?.length ?? 0;

    if (codeArtifactCount > 0) {
      lines.push(`Code artifacts: ${codeArtifactCount} files generated`);
    }

    // Count card states
    const cardsWithState = contextData.get('cards') as Array<{
      title: string;
      type: string;
      state: string;
    }> | undefined;
    const inProgressCards = cardsWithState?.filter(c => c.state === 'IN_PROGRESS').length ?? 0;
    const doneCards = cardsWithState?.filter(c => c.state === 'DONE' || c.state === 'COMPLETED').length ?? 0;
    const plannedCards = cardsWithState?.filter(c => c.state === 'PLANNED' || c.state === 'OPEN').length ?? 0;

    if (doneCards > 0 || inProgressCards > 0) {
      lines.push(`Card progress: ${doneCards} done, ${inProgressCards} in progress, ${plannedCards} planned`);
    }

    // Memory state
    if (memoryCount > 0) {
      lines.push(`Project memory: ${memoryCount} facts saved`);
    }

    // Determine pipeline phase
    const isInExecution = agentsThatSpoke.has('JD') || agentsThatSpoke.has('SD') || inProgressCards > 0 || doneCards > 0;

    if (isInExecution) {
      lines.push('🔨 CURRENT PHASE: CODE EXECUTION — Developers are writing code');
    } else if (agentsThatSpoke.has('TL')) {
      lines.push('📋 CURRENT PHASE: EXECUTION PLANNING — Tech Lead has planned');
    } else if (agentsThatSpoke.has('PM')) {
      lines.push('📋 CURRENT PHASE: BACKLOG MANAGEMENT — PM has organized');
    } else if (hasSDD && cardCount > 0) {
      lines.push('📐 CURRENT PHASE: ARCHITECTURE COMPLETE — Ready for PM/TL');
    } else if (hasBRD) {
      lines.push('📝 CURRENT PHASE: REQUIREMENTS COMPLETE — Ready for SA');
    } else {
      lines.push('💡 CURRENT PHASE: DISCOVERY — BA is gathering requirements');
    }

    // Critical instruction for this agent
    if (hasBRD && currentAgentShortName === 'BA') {
      lines.push('⚠️ The BRD already exists. DO NOT re-gather requirements. If the user has a follow-up, address it directly.');
    }
    if (hasSDD && currentAgentShortName === 'SA') {
      lines.push('⚠️ The SDD already exists. DO NOT create another SDD or re-ask tech stack questions. If the user has a follow-up, address it directly.');
    }
    if (cardCount > 0 && currentAgentShortName === 'SA') {
      lines.push(`⚠️ ${cardCount} cards already exist on the board. DO NOT create duplicate cards.`);
    }
    if (currentAgentShortName === 'TL' && isInExecution) {
      lines.push('⚠️ Development is already in progress. Pick the NEXT planned task from the board and assign it to JD or SD.');
    }
    if ((currentAgentShortName === 'JD' || currentAgentShortName === 'SD') && codeArtifactCount > 0) {
      lines.push(`⚠️ ${codeArtifactCount} code files already exist. Review them in the artifacts context to avoid duplicating work.`);
    }

    lines.push('═══════════════════════════════════════════════════════════');

    return lines.join('\n');
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

  // Gate requirements for each stage (what's needed to advance past it)
  const gateReqs: Record<string, string> = {
    'Business Analysis': 'Gate: BRD must be APPROVED by user before advancing',
    'Architecture': 'Gate: SDD must be APPROVED by user before advancing',
    'UI/UX Design': 'Gate: Wireframes must be APPROVED by user before advancing',
    'Planning': 'Gate: Task cards must exist on the board before advancing',
  };

  const lines = stages.map((s) => {
    let line = `  ${s.order}. ${s.name} — ${s.status}`;
    if (s.gatePassed) line += ' [GATE PASSED ✅]';
    const req = gateReqs[s.name];
    if (req && !s.gatePassed && s.status !== 'COMPLETED') {
      line += `\n     ${req}`;
    }
    return line;
  });
  return ['SDLC PIPELINE:', ...lines].join('\n');
}

function formatCards(data: unknown): string {
  const cards = data as Array<{
    id: string;
    title: string;
    type: string;
    state: string;
    priority: string;
    description?: string | null;
    module?: string | null;
    ownerAgent?: { shortName: string; name: string } | null;
  }>;
  if (cards.length === 0) return '';
  const lines = cards.map((c) => {
    const agent = c.ownerAgent ? ` (${c.ownerAgent.shortName})` : '';
    const mod = c.module ? ` [${c.module}]` : '';
    const desc = c.description ? `\n    Description: ${c.description.substring(0, 200)}` : '';
    return `  [${c.type}] id="${c.id}" ${c.title} — ${c.state} ${c.priority}${agent}${mod}${desc}`;
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
  const statusIcon: Record<string, string> = {
    DRAFT: '📝 DRAFT',
    REVIEW: '👀 REVIEW',
    APPROVED: '✅ APPROVED',
    PUBLISHED: '📢 PUBLISHED',
  };
  const lines = docs.map(
    (d) => `  ${d.title} (${d.type}) — ${statusIcon[d.status] ?? d.status} [${d.wordCount} words, owner: ${d.owner}]`,
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
