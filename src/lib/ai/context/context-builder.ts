// =============================================================================
// Codanium — Context Builder
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
import { AGENT_BASE_PROMPT } from '@/lib/ai/agents/prompt-base';
import * as sources from './context-sources';
import { pruneConversationHistory, needsPruning } from './context-pruner';
import { ContextScope } from './context-sources';
import {
  getValidTransitions,
  getDoDRequirements,
  CardState as LifecycleCardState,
  CardType as LifecycleCardType,
} from '@/lib/ai/orchestration/card-lifecycle';
import { DEFAULT_CONSTITUTION } from '@/lib/ai/constitution/default-constitution';

// ─── Public Interface ────────────────────────────────────────────────────────

export interface AgentContext {
  systemMessage: string;
  recentHistory: LLMMessage[];
}

export interface ContextBuildOptions {
  maxHistoryMessages?: number;
  scope?: ContextScope;
  isDelegation?: boolean; // Skip chat_history for delegated calls (context from delegator)
  agentShortName?: string; // Current agent — controls document content injection depth
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

type ContextFormatter = (data: unknown, agentShortName?: string) => string;

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

// ─── Token Budget ────────────────────────────────────────────────────────────

/** Soft token budget for the system message (excluding chat history messages). */
const SYSTEM_TOKEN_BUDGET = 24000;

/**
 * Priority ranking for context sources.
 * When the system message exceeds the budget, lowest-priority sources are
 * dropped first. Higher number = higher priority (kept longer).
 */
const SOURCE_PRIORITY: Record<ContextSource, number> = {
  project_info:   10, // always keep
  cards:           9, // core context (card-centric philosophy)
  documents:       8, // phase awareness
  project_memory:  7, // accumulated knowledge
  sdlc_stages:     5, // phase awareness
  decisions:       4, // important but often empty
  artifacts:       8, // critical for devs to see existing files
  chat_history:    6, // handled separately as recentHistory
  agents_status:   2, // least critical
  wireframes:      2, // least critical
  llm_usage:       1, // drop first
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
    const maxHistory = options?.maxHistoryMessages ?? agentDef.maxHistory ?? 10;
    const scope = options?.scope;
    const agentShortName = options?.agentShortName ?? agentDef.shortName;

    // Determine which sources to fetch
    // For delegated calls, skip chat_history — delegator passes context in the message
    const neededSources = options?.isDelegation
      ? agentDef.contextSources.filter(s => s !== 'chat_history')
      : agentDef.contextSources;

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
    // Track source → formatted text for budget trimming
    const sectionMap = new Map<ContextSource, string>();
    for (const source of neededSources) {
      if (source === 'chat_history') continue;
      const data = contextData.get(source);
      if (data == null) continue;
      const formatted = FORMATTER_MAP[source](data, agentShortName);
      if (formatted) {
        sectionMap.set(source, formatted);
      }
    }

    // Add scope instruction when module-scoped
    const scopeBlock = scope?.module
      ? `\n\nSCOPE: You are working on module "${scope.module}". Focus your response on this module's tasks and code. Do not discuss unrelated project areas.`
      : scope?.cardId
        ? `\n\nSCOPE: You are working on a specific task. Focus your response on this task only.`
        : '';

    // Build pipeline state summary — tells the agent where we are in the workflow
    const pipelineState = this.buildPipelineState(agentDef.shortName, contextData);

    // Fetch project constitution (governance rules all agents must follow)
    const constitutionBlock = await this.buildConstitutionBlock(projectId);

    // Fixed parts (always included)
    // Base prompt (shared rules) + constitution + agent-specific prompt + scope + pipeline state
    const fixedPart = AGENT_BASE_PROMPT + constitutionBlock + agentDef.systemPrompt + scopeBlock + pipelineState;
    const fixedTokens = Math.ceil(fixedPart.length / 4);

    // Budget trimming: drop lowest-priority sources if over budget
    const remainingBudget = SYSTEM_TOKEN_BUDGET - fixedTokens;
    const sortedSections = Array.from(sectionMap.entries())
      .sort((a, b) => (SOURCE_PRIORITY[b[0]] ?? 0) - (SOURCE_PRIORITY[a[0]] ?? 0));

    const contextSections: string[] = [];
    let usedTokens = 0;
    for (const [source, text] of sortedSections) {
      const sectionTokens = Math.ceil(text.length / 4);
      if (usedTokens + sectionTokens > remainingBudget && contextSections.length > 0) {
        console.log(`[ContextBuilder] Budget trim: dropped ${source} (~${sectionTokens} tokens)`);
        continue;
      }
      contextSections.push(text);
      usedTokens += sectionTokens;
    }

    // Compose system message
    const contextBlock = contextSections.length > 0
      ? `\n\n--- PROJECT CONTEXT ---\n${contextSections.join('\n\n')}\n--- END CONTEXT ---`
      : '';

    const systemMessage = fixedPart + contextBlock;

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
    const hasConstitution = docs?.some(d => d.type === 'CONSTITUTION') ?? false;

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

    // Build the state summary (compact to save tokens)
    lines.push('\n\nPIPELINE STATE:');
    lines.push(`You are: ${currentAgentShortName}`);

    // Agent participation
    if (agentsThatSpoke.size > 0) {
      const agentList = Array.from(agentsThatSpoke).join(', ');
      lines.push(`Agents who have already spoken in this conversation: ${agentList}`);
    }

    // Pipeline completion status
    const completionLines: string[] = [];
    if (hasConstitution) completionLines.push('  ✅ CONSTITUTION — project governance rules established');
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

    // Authority info removed — agents already have this in their system prompt
    // and the authority guard enforces it at runtime regardless

    return lines.join('\n');
  }

  /**
   * Fetch the project constitution and format it as a high-priority prompt block.
   * If a CONSTITUTION document exists for the project, use its content.
   * Otherwise, inject the default constitution template.
   */
  private async buildConstitutionBlock(projectId: string): Promise<string> {
    try {
      const constitutionDoc = await sources.fetchConstitution(projectId);
      const content = constitutionDoc?.content?.trim()
        ? constitutionDoc.content
        : DEFAULT_CONSTITUTION;

      return `
═══════════════════════════════════════════════════════════
PROJECT CONSTITUTION (mandatory rules — you MUST follow these):
═══════════════════════════════════════════════════════════

${content}

═══════════════════════════════════════════════════════════
END PROJECT CONSTITUTION
═══════════════════════════════════════════════════════════

`;
    } catch (error) {
      // If fetching fails, still inject the default constitution
      console.warn('[ContextBuilder] Failed to fetch constitution, using default:', error);
      return `
═══════════════════════════════════════════════════════════
PROJECT CONSTITUTION (mandatory rules — you MUST follow these):
═══════════════════════════════════════════════════════════

${DEFAULT_CONSTITUTION}

═══════════════════════════════════════════════════════════
END PROJECT CONSTITUTION
═══════════════════════════════════════════════════════════

`;
    }
  }

  /**
   * Convert raw chat history data into LLMMessage format.
   * If chat_history wasn't in the agent's contextSources, returns empty array.
   */
  private async buildRecentHistory(
    rawHistory: unknown,
    maxMessages: number,
    projectId: string,
  ): Promise<LLMMessage[]> {
    if (maxMessages === 0 || !rawHistory) return [];

    const messages = rawHistory as Array<{
      role: string;
      content: string;
      agent?: { shortName: string; name: string } | null;
    }>;

    // Raw data comes newest-first, reverse for chronological order then take last N
    const chronological = [...messages].reverse().slice(-maxMessages);

    // Convert to LLMMessage format
    const llmMessages = chronological.map((msg): LLMMessage => {
      if (msg.role === 'USER') {
        return { role: 'user', content: msg.content };
      }
      if (msg.role === 'SYSTEM') {
        // Convert chat history system messages to user messages to avoid
        // breaking APIs that require system messages only at the beginning
        return { role: 'user', content: `[System] ${msg.content}` };
      }
      // AGENT messages become assistant messages, prefixed with agent identity
      const prefix = msg.agent ? `[${msg.agent.shortName}] ` : '';
      return { role: 'assistant', content: `${prefix}${msg.content}` };
    });

    // ── Context pruning: summarize old messages if history is large ──
    if (needsPruning(llmMessages)) {
      const { pruned, dropped, summarized } = await pruneConversationHistory(
        llmMessages,
        projectId,
      );
      if (dropped > 0) {
        console.log(
          `[ContextBuilder] Pruned ${dropped} messages (summarized: ${summarized}) for project ${projectId}`,
        );
      }
      return pruned;
    }

    return llmMessages;
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
    'Idea & Planning': 'Gate: Vision/BRD document must exist before advancing',
    'Requirement Gathering': 'Gate: BRD must be APPROVED by user before advancing',
    'Solution Design': 'Gate: SDD/HLD must be APPROVED by user before advancing',
    'UX/UI Design': 'Gate: Wireframes must be APPROVED by user before advancing',
    'Development': 'Gate: Task cards must exist on the board before advancing',
    'Testing': 'Gate: Code artifacts must exist before advancing',
    'Deployment': 'Gate: All tests must pass before deploying',
    'Maintenance & Improvement': 'Gate: System must be deployed before maintenance',
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

/**
 * Returns the next natural forward state in the card lifecycle.
 * Used to show DoD requirements for the most likely next transition.
 */
function getNextNaturalState(current: LifecycleCardState): LifecycleCardState | null {
  const progression: Record<string, LifecycleCardState> = {
    PLANNED: 'IN_PROGRESS',
    IN_PROGRESS: 'UNDER_REVIEW',
    UNDER_REVIEW: 'DONE',
    TESTING: 'DONE',
    DONE: 'RELEASED',
  };
  return progression[current] ?? null;
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
    children?: Array<{ id: string; state: string }> | null;
  }>;
  if (cards.length === 0) return '';
  const lines = cards.map((c) => {
    const agent = c.ownerAgent ? ` (${c.ownerAgent.shortName})` : '';
    const mod = c.module ? ` [${c.module}]` : '';
    // Compact description — 100 chars max
    const desc = c.description ? ` — ${c.description.substring(0, 100)}${c.description.length > 100 ? '…' : ''}` : '';

    // Only show DoD hints for IN_PROGRESS cards (actionable)
    let dodStr = '';
    if (c.state === 'IN_PROGRESS') {
      const nextState = getNextNaturalState(c.state as LifecycleCardState);
      const dodReqs = nextState ? getDoDRequirements(c.type as LifecycleCardType, nextState) : [];
      dodStr = dodReqs.length > 0 ? `\n    ✓ DoD: ${dodReqs.join('; ')}` : '';
    }

    // Show children progress only for parent cards with incomplete children
    let childStr = '';
    if (c.children && c.children.length > 0) {
      const done = c.children.filter(ch => ch.state === 'DONE' || ch.state === 'RELEASED').length;
      if (done < c.children.length) {
        childStr = ` [${done}/${c.children.length} done]`;
      }
    }

    return `  [${c.type}] id="${c.id}" ${c.title} — ${c.state} ${c.priority}${agent}${mod}${childStr}${desc}${dodStr}`;
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
    // Compact: only show options for PENDING decisions (actionable)
    if (d.approvedOption) {
      return `  ${d.trigger} — ${d.status} ✅ ${d.approvedOption}`;
    }
    const optionsSummary = d.options.length > 0
      ? ` | Options: ${d.options.map((o) => o.name).join(', ')}`
      : '';
    return `  ${d.trigger} — ${d.status} [${d.riskRating}]${optionsSummary}`;
  });
  return [`DECISIONS (${decisions.length}):`, ...lines].join('\n');
}

/**
 * Generate a compact summary of a key document (BRD/SDD) for agents that don't
 * need the full content. Keeps token usage under 500 tokens per document.
 */
function summarizeDocument(d: { title: string; type: string; status: string; wordCount: number; content: string }): string {
  const content = d.content;
  const cl = content.toLowerCase();

  // Extract vision/summary (first meaningful paragraph, max 200 chars)
  const visionMatch = content.match(/(?:vision|executive summary|project vision)[:\s]*\n([\s\S]{10,300}?)(?:\n#|\n\*\*|\n---)/i);
  const vision = visionMatch ? visionMatch[1].replace(/\n/g, ' ').trim().substring(0, 200) : '';

  // Count FR-IDs
  const frIds = [...new Set(content.match(/FR-\d{3}/g) || [])];
  const nfrIds = [...new Set(content.match(/NFR-\d{3}/g) || [])];

  // Extract module/section headers
  const sectionHeaders = content.match(/^#{2,3}\s+\d*\.?\d*\s*(.+)/gm) || [];
  const modules = sectionHeaders.slice(0, 12).map(h => h.replace(/^#{2,3}\s+\d*\.?\d*\s*/, '').trim());

  // Count MoSCoW priorities
  const mustCount = (content.match(/\|\s*MUST\s*\|/gi) || []).length;
  const shouldCount = (content.match(/\|\s*SHOULD\s*\|/gi) || []).length;

  // Extract persona names
  const personaMatches = content.match(/persona\s*\d*:\s*\*{0,2}([^*\n]+)\*{0,2}/gi) || [];
  const personas = personaMatches.map(p => p.replace(/persona\s*\d*:\s*\*{0,2}/i, '').replace(/\*{0,2}$/, '').trim()).slice(0, 4);

  const lines = [
    `--- ${d.type} SUMMARY: ${d.title} ---`,
    `Status: ${d.status} | Words: ${d.wordCount}`,
  ];
  if (vision) lines.push(`Vision: ${vision}...`);
  if (frIds.length > 0) lines.push(`Functional Requirements: ${frIds.length} (${frIds[0]} to ${frIds[frIds.length - 1]})`);
  if (nfrIds.length > 0) lines.push(`Non-Functional Requirements: ${nfrIds.length}`);
  if (modules.length > 0) lines.push(`Sections: ${modules.join(', ')}`);
  if (personas.length > 0) lines.push(`Personas: ${personas.join(', ')}`);
  if (mustCount > 0 || shouldCount > 0) lines.push(`Priority: ${mustCount} must-have, ${shouldCount} should-have`);
  lines.push(`Full document available in project Documents tab.`);
  lines.push(`--- END ${d.type} SUMMARY ---`);

  return lines.join('\n');
}

function formatDocuments(data: unknown, agentShortName?: string): string {
  const docs = data as Array<{
    title: string;
    type: string;
    status: string;
    wordCount: number;
    owner: string;
    content?: string;
  }>;
  if (docs.length === 0) return '';
  const statusIcon: Record<string, string> = {
    DRAFT: '📝 DRAFT',
    REVIEW: '👀 REVIEW',
    APPROVED: '✅ APPROVED',
    PUBLISHED: '📢 PUBLISHED',
  };
  const lines: string[] = [];
  const docContents: string[] = [];

  // Key document types
  const KEY_DOC_TYPES = new Set(['BRD', 'SDD', 'DESIGN_SYSTEM', 'CONSTITUTION']);

  // Agents that AUTHOR a document need full content to read/edit it.
  // All other agents get a compact summary to save tokens.
  const agent = (agentShortName || '').toUpperCase();

  for (const d of docs) {
    lines.push(`  ${d.title} (${d.type}) — ${statusIcon[d.status] ?? d.status}`);

    if (!d.content || d.content.length === 0) continue;

    if (KEY_DOC_TYPES.has(d.type) && !d.title.startsWith('Staging:')) {
      // Determine if this agent needs full content:
      //   BA authoring BRD → full BRD
      //   SA authoring SDD → full SDD + full BRD (needs BRD for traceability)
      const needsFullContent =
        (agent === 'BA' && d.type === 'BRD') ||
        (agent === 'SA' && (d.type === 'BRD' || d.type === 'SDD'));

      if (needsFullContent) {
        const truncated = d.content.length > 60000
          ? d.content.substring(0, 60000) + '\n... (truncated — see full document in project)'
          : d.content;
        docContents.push(`\n--- ${d.type} CONTENT: ${d.title} ---\n${truncated}\n--- END ${d.type} ---`);
      } else {
        // Compact summary for PM, TL, QA, UX, DO, CA, and all other agents
        docContents.push('\n' + summarizeDocument({ ...d, content: d.content }));
      }
    }
    // Include staging docs for BA to compile into final BRD
    else if (d.title.startsWith('Staging:') && d.status === 'DRAFT') {
      const truncated = d.content.length > 12000
        ? d.content.substring(0, 12000) + '\n... (truncated)'
        : d.content;
      docContents.push(`\n--- STAGING ${d.type} CONTENT ---\n${truncated}\n--- END STAGING ---`);
    }
  }

  const result = [`DOCUMENTS (${docs.length}):`, ...lines];
  if (docContents.length > 0) {
    result.push(...docContents);
  }
  return result.join('\n');
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
  // Only show active (non-idle) agents to save tokens
  const active = agents.filter(a => a.status !== 'IDLE');
  if (active.length === 0) return 'TEAM: All agents available';
  const lines = active.map((a) => {
    const task = a.currentTask ? ` — ${a.currentTask}` : '';
    return `  ${a.shortName}: ${a.status}${task}`;
  });
  return [`TEAM (${active.length} active):`, ...lines].join('\n');
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

  // Compact: single line summary instead of per-provider breakdown
  return `LLM USAGE: ${totalTokens.toLocaleString()} tokens, $${totalCost.toFixed(4)} (${records.length} calls)`;
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

  const lines = ['EXISTING PROJECT FILES:'];
  lines.push('These files already exist in the project. Reference them, import from them, and build upon them.');
  lines.push('');

  for (const a of artifacts) {
    lines.push(`\u{1F4C4} ${a.name} (${a.type}, v${a.version}, by ${a.ownerAgent})`);
    if (a.content) {
      // Show first 300 chars of content so agents can see imports/exports
      const preview = a.content.slice(0, 300);
      lines.push(`    ${preview}${a.content.length > 300 ? '...' : ''}`);
    }
  }

  return lines.join('\n');
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
