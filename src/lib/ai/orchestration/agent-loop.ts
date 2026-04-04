// =============================================================================
// Codanium — Agent Loop
// =============================================================================
// Custom async-generator orchestration loop that replaces LangGraph.
// Implements the full pipeline: guardrails -> routing -> context -> LLM streaming
// -> tool calling loop -> response parsing -> persistence -> pipeline routing.
//
// Topology (same as the old graph, minus the LangGraph dependency):
//
//   agentLoop(input)
//     |
//     v
//   [Input Guardrails] --blocked--> yield error, return
//     |
//     v
//   [Route Message] --> resolve target agent
//     |
//     v
//   [Build Context] --budget exceeded--> yield error, return
//     |
//     v
//   [Agent Loop] (max 7 iterations)
//     |  a. Loop detection
//     |  b. Stream LLM (with retry + model downgrade)
//     |  c. Yield chunks/thinking
//     |  d. If tool calls:
//     |       - Execute tools
//     |       - Yield tool_call / tool_result events
//     |       - Append to messages, continue loop
//     |  e. If text response:
//     |       - Parse, persist, yield done
//     |       - Break
//     |
//     v
//   [Pipeline Router] --> check signals, recurse if next agent
//     |
//     v
//   return
// =============================================================================

import { runInputGuardrails, runOutputGuardrails } from './guardrails';
import { messageRouter, VSCODE_REQUIRED_SENTINEL } from './router';
import { contextBuilder } from '@/lib/ai/context/context-builder';
import { getAgentDefinition } from '@/lib/ai/agents/registry';
import { llmGateway } from '@/lib/ai/gateway';
import { getToolsForAgent } from '@/lib/ai/tools/tool-filter';
import { executeToolCalls } from '@/lib/ai/tools/tool-executor';
import { parseAgentResponse } from '@/lib/ai/agents/response-parser';
import { saveAgentMessage, persistArtifact } from './engine';
import { agentStateManager } from './state-manager';
import { eventBus } from './event-bus';
import { createTraceCollector, type TraceCollector } from './telemetry';
import { prisma } from '@/lib/prisma';
import { isVSCodeConnected } from '@/lib/vscode-bridge';
import type {
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
  LLMProvider,
  ProviderConfig,
} from '@/lib/ai/providers/types';
import type { BillingType } from '@/generated/prisma/enums';
import type { ToolResult } from '@/lib/ai/tools/tool-definitions';
import type { TrackedToolCall, LoopWarning } from './loop-detector';

// Re-export the loop detection helpers directly (avoid GraphStateType dependency)
import {
  checkForLoops as _checkForLoopsGraphState,
} from './loop-detector';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export interface AgentLoopInput {
  projectId: string;
  userId: string;
  userMessage: string;
  targetAgentShortName?: string;
  isPipeline?: boolean;
  pipelineDepth?: number;
  consultationDepth?: number;
}

export interface SSEEvent {
  type: string;
  data: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TOOL_LOOPS = 25;
const MAX_LLM_ATTEMPTS = 5;
// Full pipeline: PM → BA → PM → SA → PM → DO → PM → TL → UX → TL → UID → TL → PM → TL → dev tasks → QA → SEC → DO → PE → TL loop
// Needs depth for: planning phases (6+ hops) + UI phase + multiple dev task cycles
const MAX_PIPELINE_DEPTH = 15;
const MAX_CONSULTATION_DEPTH = 3;
const TOOL_ERROR_CIRCUIT_BREAKER = 3;

// ---------------------------------------------------------------------------
// Development Agent Gate — VS Code Required
// ---------------------------------------------------------------------------

/**
 * Agents that execute code generation, file writing, deployment, or infrastructure.
 * These MUST run from VS Code, not from the web browser.
 *
 * Web-only agents (NOT gated): BA, SA, PM, UX, UID, DEC, ORC, CA, AUD, PRE, LLM, STC
 */
export const DEV_AGENTS = new Set([
  'TL', 'JD', 'SD',              // Engineering — code generation & review
  'QA', 'AT', 'PF',              // Testing & Performance
  'DO', 'PE', 'IE', 'SM', 'SR', 'SEC',  // Platform, DevOps & Security
  'UX',                           // UX — when generating code artifacts (not design docs)
]);

// ---------------------------------------------------------------------------
// Model Downgrade Map
// ---------------------------------------------------------------------------

const MODEL_DOWNGRADE_MAP: Record<string, string> = {
  'claude-3-opus': 'claude-3-sonnet',
  'claude-3-5-sonnet': 'claude-3-haiku',
  'claude-3-sonnet': 'claude-3-haiku',
  'gpt-4': 'gpt-4o-mini',
  'gpt-4o': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4o-mini',
};

function findFallbackModel(currentModel: string): string | undefined {
  if (MODEL_DOWNGRADE_MAP[currentModel]) return MODEL_DOWNGRADE_MAP[currentModel];
  for (const [key, fallback] of Object.entries(MODEL_DOWNGRADE_MAP)) {
    if (currentModel.startsWith(key) || currentModel.includes(key)) return fallback;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Pipeline Rules (extracted from pipeline-router node)
// ---------------------------------------------------------------------------

interface PipelineRule {
  from: string;
  signals: string[];
  next: string;
  context: string;
}

/**
 * Context corrections injected AFTER chat history to override bad patterns.
 * This fixes the "poisoned context" problem where old messages teach the LLM
 * wrong behaviors (e.g., TL asking for developer IDs because it did so before).
 */
function buildContextCorrection(agent: string): string {
  const corrections: Record<string, string> = {
    TL: `IMPORTANT CORRECTION: In previous messages you may have asked the user for developer IDs or system IDs. This was a mistake. You MUST NOT ask for any IDs. To assign tasks:
- Use assigneeId="JD" for Junior Developer
- Use assigneeId="SD" for Senior Developer
The system resolves these automatically. NEVER ask the user for IDs again. Just use "JD" or "SD".`,
    PM: `IMPORTANT CORRECTION: You do NOT need user IDs or agent IDs to create or update cards. Use assignee="JD" or assignee="SD" (short names). The system resolves them automatically. NEVER ask the user for system IDs.`,
    BA: `IMPORTANT CORRECTION: If you have already asked 10+ questions in the chat history above, do NOT ask more. Proceed to generate the BRD immediately. If the user says "I'm done", "that's enough", or similar — generate the BRD now.`,
    SA: `IMPORTANT CORRECTION: If the user already answered technical questions (hosting, framework, database) in the chat history above, do NOT re-ask them. Read the answers from history and proceed with the SDD.`,
    UX: `IMPORTANT CORRECTION: If wireframes were already discussed or the BRD/SDD exist, generate wireframes immediately in .pen JSON format. Do NOT ask the user which screens to create — read the BRD and create wireframes for ALL screens mentioned there.`,
  };
  return corrections[agent] || '';
}

// Pipeline: PM → BA → PM → SA → PM → DO → PM → TL → UX → TL → UID → TL → PM → TL → (JD/SD) → QA → SEC → DO/PE → TL (loop)
// PM is the gatekeeper — every phase routes back through PM for validation.
const PIPELINE_RULES: PipelineRule[] = [
  // ── PHASE 1: REQUIREMENTS ──────────────────────────────────────────
  // BA approves BRD → routes to PM for validation
  { from: 'BA', signals: ['approve_document(BRD)'], next: 'PM', context: 'The BRD is complete and APPROVED. Validate it — check for completeness, acceptance criteria coverage, and content inventory. If gaps exist, add a card comment explaining what is missing and send back to BA. If the BRD is satisfactory, mark the Requirements phase card as COMPLETE, then create a "Solution Design" card assigned to SA and route to SA for architecture.' },
  // BA updates/creates BRD but doesn't approve → still routes to PM to check
  { from: 'BA', signals: ['update_document(BRD)', 'create_document(BRD)'], next: 'PM', context: 'BA has updated the BRD. Check BRD quality — if it has all required sections (Executive Summary, Functional Requirements with FR-IDs, User Personas, User Flows, NFRs, Content Inventory), approve it and create SA card. Otherwise send feedback to BA.' },

  // ── PM ROUTING — PM routes to the NEXT phase agent ─────────────────
  // PM creates a card for SA → routes to SA
  { from: 'PM', signals: ['create_card'], next: 'SA', context: 'Read the BRD document carefully. Design the technical architecture and produce the System Design Document (SDD). Include: tech stack with rationale, database schema, API endpoints, component architecture, security, and deployment strategy. Reference BRD requirement IDs (FR-XXX) for traceability.' },
  // PM approves BRD → routes to SA
  { from: 'PM', signals: ['approve_document(BRD)'], next: 'SA', context: 'The BRD has been approved by PM. Now design the system architecture. Read the BRD and produce the SDD with tech stack, database schema, API design, and security architecture.' },

  // ── PHASE 2: ARCHITECTURE ──────────────────────────────────────────
  // SA approves SDD → routes to PM
  { from: 'SA', signals: ['approve_document(SDD)'], next: 'PM', context: 'The SDD is complete. Validate it — check that all BRD requirements (FR-XXX) are mapped to architecture components. If gaps exist, add a card comment and send back to SA. If satisfactory, mark the Architecture phase card as COMPLETE and create the Scaffolding phase card for DO.' },
  // SA creates/updates SDD → routes to PM for validation
  { from: 'SA', signals: ['update_document(SDD)', 'create_document(SDD)'], next: 'PM', context: 'SA has produced the SDD. Validate it — check all FR-XXX mapped, database schema present, API design complete. If satisfactory, approve it and create DO card. Otherwise send feedback to SA.' },

  // ── PHASE 3: SCAFFOLDING ───────────────────────────────────────────
  { from: 'DO', signals: ['write_file()', 'git_commit()', 'trigger_deploy()', 'run_build()'], next: 'PM', context: 'The project scaffold is ready. Verify the build compiles. Mark the Scaffolding phase card as COMPLETE. Hand control to TL for the UI/UX phase.' },

  // ── PHASE 4: UI/UX DESIGN ─────────────────────────────────────────
  { from: 'UX', signals: ['create_document(DESIGN_SYSTEM)', 'approve_document(DESIGN_SYSTEM)', 'create_document()'], next: 'TL', context: 'The UI Kit / Design System is complete. Review the design system document. If satisfactory, mark the UI Kit card as DONE. Then create a "UI Interfaces" card and assign it to UID (UI Designer) to build page layouts and wireframes based on the design system.' },
  { from: 'UID', signals: ['create_document(WIREFRAME)', 'create_document()', 'update_document()'], next: 'TL', context: 'UI interfaces and wireframes are complete. Review the wireframe documents. Get user approval via ask_user. If approved, mark the UI Interfaces card as DONE and report to PM that the UI phase is complete.' },
  { from: 'TL', signals: ['update_card(IN_PROGRESS)', 'update_card(PLANNED)'], next: 'DYNAMIC', context: 'Implement the assigned task. Read the card description carefully — it contains the exact content and acceptance criteria. Write production code, not placeholders. Run tests and commit when complete.' },

  // ── PHASE 5: DEVELOPMENT (after all 4 gates pass) ──────────────────
  { from: 'JD', signals: ['update_card(DONE)', 'update_card(REVIEW)', 'git_commit()'], next: 'QA', context: 'Review and test the implementation. Run tests, validate code quality, check for bugs. If tests pass, sign off and route to SEC.' },
  { from: 'SD', signals: ['update_card(DONE)', 'update_card(REVIEW)', 'git_commit()'], next: 'QA', context: 'Review the senior developer implementation. Run quality checks. If tests pass, sign off and route to SEC.' },
  { from: 'QA', signals: ['validate_code()', 'review_changes()', 'run_tests()', 'update_card()'], next: 'SEC', context: 'Security review the tested implementation. Check for vulnerabilities and security best practices. If approved, sign off and route to DO for deployment review.' },
  { from: 'SEC', signals: ['validate_code()', 'validate_architecture()', 'review_changes()', 'update_card()'], next: 'DO', context: 'Review deployment readiness. Check build compiles, dependencies are valid. Sign off and route to PE for final platform review.' },
  { from: 'DO', signals: ['update_card()', 'task_progress()'], next: 'PE', context: 'Final platform review. Verify infrastructure compatibility. Sign off. After all 4 sign-offs (QA, SEC, DO, PE), route back to TL for the next card.' },
  { from: 'PE', signals: ['update_card()', 'task_progress()'], next: 'TL', context: 'All 4 sign-offs received (QA, SEC, DO, PE). Mark the current card as DONE. Pick the next PLANNED card. If no more PLANNED cards, report to PM that development is complete.' },
];

function matchPipelineRule(
  currentAgent: string,
  signals: string[],
): PipelineRule | null {
  for (const rule of PIPELINE_RULES) {
    if (rule.from !== currentAgent) continue;
    const matches = rule.signals.some(sig =>
      signals.some(s => s.startsWith(sig.replace('()', ''))),
    );
    if (matches) return rule;
  }
  return null;
}

// ---------------------------------------------------------------------------
// SDLC Stage Auto-Advance (ported from pipeline-router.ts)
// ---------------------------------------------------------------------------

const AGENT_STAGE_MAP: Record<string, string> = {
  PM: 'Idea & Planning',
  BA: 'Requirement Gathering',
  SA: 'Solution Design',
  UX: 'UX/UI Design',
  TL: 'Development',
  JD: 'Development',
  SD: 'Development',
  DO: 'Development',
  QA: 'Testing',
  AT: 'Testing',
  PF: 'Testing',
  SEC: 'Testing',
  PE: 'Deployment',
  SR: 'Deployment',
  // Maintenance — all agents can contribute
  CM: 'Maintenance & Improvement',
};

async function shouldAdvanceStage(projectId: string, currentStage: string): Promise<boolean> {
  const cards = await prisma.card.groupBy({
    by: ['state'],
    where: { projectId },
    _count: true,
  });
  const total = cards.reduce((sum, c) => sum + c._count, 0);
  const done = cards.find(c => c.state === 'DONE')?._count ?? 0;
  const pct = total > 0 ? done / total : 0;

  switch (currentStage) {
    case 'Idea & Planning':
    case 'Requirement Gathering':
    case 'Solution Design':
    case 'UX/UI Design':
      return true; // These advance on pipeline completion (documents created)
    case 'Development':
      return pct >= 0.8; // 80% cards done
    case 'Testing':
      return pct >= 0.95; // 95% cards done
    case 'Deployment':
      return pct >= 1.0; // All cards done
    default:
      return false;
  }
}

async function autoAdvanceSDLC(projectId: string, agentShortName: string): Promise<void> {
  const stageToAdvance = AGENT_STAGE_MAP[agentShortName];
  if (!stageToAdvance) return;

  try {
    // Check card-completion gate before advancing
    const canAdvance = await shouldAdvanceStage(projectId, stageToAdvance);
    if (!canAdvance) {
      console.log(`[AgentLoop] SDLC stage "${stageToAdvance}" not ready to advance (card completion threshold not met)`);
      return;
    }

    const stages = await prisma.sDLCStage.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    const targetStage = stages.find(s => s.name === stageToAdvance);
    const activeStage = stages.find(s => s.status === 'ACTIVE');

    if (targetStage && activeStage && targetStage.order >= activeStage.order && targetStage.status !== 'COMPLETED') {
      // Complete all stages before target
      for (const s of stages) {
        if (s.order < targetStage.order && s.status !== 'COMPLETED') {
          await prisma.sDLCStage.update({
            where: { id: s.id },
            data: { status: 'COMPLETED', gatePassed: true },
          });
        }
      }
      // Activate target stage
      if (targetStage.status !== 'ACTIVE') {
        await prisma.sDLCStage.update({
          where: { id: targetStage.id },
          data: { status: 'ACTIVE' },
        });
      }
      await prisma.project.update({
        where: { id: projectId },
        data: { currentStage: targetStage.name },
      });
      console.log(`[AgentLoop] Auto-advanced SDLC stage to: ${stageToAdvance}`);
    }
  } catch (e) {
    console.warn(`[AgentLoop] SDLC auto-advance failed:`, e);
  }
}

// ---------------------------------------------------------------------------
// Default Next Agent Map (fallback when no tool signals match)
// ---------------------------------------------------------------------------

const DEFAULT_NEXT_AGENT: Record<string, { next: string; context: string; requiresApproval?: string }> = {
  // ── PHASE 1: REQUIREMENTS ──────────────────────────────────────────
  // PM is FIRST agent on project start. PM routes to BA for requirements.
  PM: { next: 'BA', context: 'Start requirements gathering. Your FIRST question must ask the user about their technical background (Non-technical / Vibe Coder / Developer / Team Lead) and save it with remember(key="user_profile"). Then ask discovery questions ONE AT A TIME with clickable options, saving each Q&A pair with remember(key="qa_N"). After enough answers, generate the full BRD.' },

  // BA completes BRD → always routes back to PM for validation.
  // NO approval gate here — BA is the AUTHOR, PM is the VALIDATOR.
  BA: { next: 'PM', context: 'BA has finished working. Check the BRD status: if BRD is APPROVED, create a "Solution Design" card for SA and route to SA. If BRD is still DRAFT, validate it — if complete, approve it and create SA card. If gaps exist, send comments back to BA.' },

  // ── PHASE 2: ARCHITECTURE ──────────────────────────────────────────
  // SA completes SDD → always routes back to PM for validation.
  // NO approval gate here — SA is the AUTHOR, PM is the VALIDATOR.
  SA: { next: 'PM', context: 'SA has finished working. Check the SDD status: if SDD is APPROVED, create a "Scaffolding" card for DO and route to DO. If SDD is still DRAFT, validate it — if complete, approve it and create DO card. If gaps exist, send comments back to SA.' },

  // ── PHASE 3: SCAFFOLDING ───────────────────────────────────────────
  DO: { next: 'PM', context: 'Scaffold complete. Verify build compiles. Mark Scaffolding phase COMPLETE. Hand to TL for UI/UX phase.' },

  // ── PHASE 4: UI/UX ────────────────────────────────────────────────
  TL: { next: 'JD', context: 'Implement the assigned task. Read the card description. Write production code. Run npx tsc --noEmit for zero compile errors. When done, request sign-off from QA, SEC, DO, and PE.' },
  UX: { next: 'TL', context: 'UI Kit complete. Review the design system. If satisfactory, mark UI Kit card DONE. Create UI Interfaces card for UID.' },
  UID: { next: 'TL', context: 'UI interfaces complete. Review wireframes. Get user approval. Mark UI Interfaces card DONE. Report to PM that UI phase is complete.' },

  // ── PHASE 5: DEVELOPMENT ──────────────────────────────────────────
  JD: { next: 'QA', context: 'Review and test the implementation. Validate code quality, check for bugs. Sign off if tests pass.' },
  SD: { next: 'QA', context: 'Review the senior implementation. Run quality checks. Sign off if standards met.' },
  QA: { next: 'SEC', context: 'Security review. Check for vulnerabilities. Sign off and route to DO.' },
  SEC: { next: 'DO', context: 'Review deployment readiness. Check build compiles. Sign off and route to PE.' },
  PE: { next: 'TL', context: 'All 4 sign-offs received. Mark card DONE. Pick next PLANNED card or report to PM that dev is complete.' },
};

/**
 * Check if a document of the given type is APPROVED for this project.
 */
async function isDocumentApproved(projectId: string, docType: string): Promise<boolean> {
  try {
    const doc = await prisma.document.findFirst({
      where: { projectId, type: docType as any, status: 'APPROVED' },
    });
    return !!doc;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Inline Loop Detection (decoupled from GraphStateType)
// ---------------------------------------------------------------------------

interface LoopState {
  recentToolCalls: TrackedToolCall[];
  recentResponses: string[];
}

function checkLoops(loopState: LoopState): LoopWarning | null {
  // Build a minimal object matching the fields checkForLoops reads
  return _checkForLoopsGraphState({
    recentToolCalls: loopState.recentToolCalls,
    recentResponses: loopState.recentResponses,
  } as any);
}

// ---------------------------------------------------------------------------
// Model-Agnostic Content Sanitization
// ---------------------------------------------------------------------------

/**
 * Strip raw tool call markup from ALL LLM providers before showing to user.
 * Handles XML, Anthropic, ChatML/Qwen, agent tags, and action markers.
 */
function sanitizeContent(text: string): string {
  return text
    // XML tool calls: <tool_call>...</tool_call>
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    // Anthropic-style: <function=name>...</function> or self-closing <function=name>
    .replace(/<function=[^>]*>[\s\S]*?<\/function>/gi, '')
    .replace(/<function=[^>]*\/?>/gi, '')
    // Parameter blocks: <parameter=name>...</parameter>
    .replace(/<parameter=[^>]*>[\s\S]*?<\/parameter>/gi, '')
    // ChatML/Qwen: <|tool_call|>...<|end|>
    .replace(/<\|tool_call\|>[\s\S]*?<\|end\|>/gi, '')
    // Bracketless tool calls: UPDATE_DOCUMENT{"type":"BRD",...} or create_document{"type":"SDD",...}
    // Handles both UPPER and lower case tool names with JSON object {...}
    .replace(/(?:UPDATE_DOCUMENT|CREATE_DOCUMENT|APPROVE_DOCUMENT|CREATE_CARD|UPDATE_CARD|CREATE_DECISION|REMEMBER|TASK_PROGRESS|RUN_CODE|TRIGGER_DEPLOY|CREATE_PIPELINE|CREATE_BRANCH|CREATE_PR|CREATE_RELEASE|update_document|create_document|approve_document|create_card|update_card|create_decision|remember|task_progress|run_code|trigger_deploy|create_pipeline|create_branch|create_pr|create_release)\s*\{[\s\S]*?\}/g, '')
    // Tool calls with JSON array syntax: [create_document]["type","SDD","content","..."]
    .replace(/\[?\s*(?:UPDATE_DOCUMENT|CREATE_DOCUMENT|APPROVE_DOCUMENT|CREATE_CARD|UPDATE_CARD|CREATE_DECISION|REMEMBER|TASK_PROGRESS|RUN_CODE|TRIGGER_DEPLOY|CREATE_PIPELINE|CREATE_BRANCH|CREATE_PR|CREATE_RELEASE|update_document|create_document|approve_document|create_card|update_card|create_decision|remember|task_progress|run_code|trigger_deploy|create_pipeline|create_branch|create_pr|create_release)\s*\]?\s*\[[\s\S]*?\]/g, '')
    // Bracketed tool calls: [UPDATE_DOCUMENT]{...} or [REMEMBER {...}]
    .replace(/\[\s*(?:UPDATE_DOCUMENT|CREATE_DOCUMENT|APPROVE_DOCUMENT|CREATE_CARD|UPDATE_CARD|CREATE_DECISION|REMEMBER|TASK_PROGRESS|RUN_CODE|TRIGGER_DEPLOY|CREATE_PIPELINE|CREATE_BRANCH|CREATE_PR|CREATE_RELEASE|update_document|create_document|approve_document|create_card|update_card|create_decision|remember|task_progress|run_code|trigger_deploy|create_pipeline|create_branch|create_pr|create_release)\s*(?:\{[\s\S]*?\}\s*\]|\]\s*\{[\s\S]*?\})\s*/g, '')
    // Agent tags at start of lines: [BA], [SA], [TL], [ORC], etc.
    .replace(/^\s*\[\s*(?:BA|SA|DEC|ORC|QA|UX|TL|FE|BE|DB|SE|PE|DO|IE|SM|CA|AUD|PM|DA|ML|DOC|TE|COM|SEC|STC|JD|SD|AT|PF|SR|LLM|PRE|UI)\s*\]\s*/gm, '')
    // [ACTION:...] markers
    .replace(/\[ACTION:[^\]]*\]/gi, '')
    // Clean up excess whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Text-based Tool Call Extraction (fallback for non-native tool_use)
// ---------------------------------------------------------------------------

const TEXT_TOOL_NAMES = [
  'update_document', 'create_document', 'approve_document',
  'create_card', 'update_card', 'create_decision',
  'remember', 'task_progress', 'run_code',
  'trigger_deploy', 'create_pipeline',
  'create_branch', 'create_pr', 'create_release',
  'web_search', 'web_fetch',
  'read_file', 'write_file', 'edit_file',
  'list_directory', 'glob', 'grep',
  'git_commit', 'git_branch', 'git_diff',
  'run_command', 'run_tests', 'run_build',
];

function extractTextToolCalls(content: string): LLMToolCall[] {
  const toolCalls: LLMToolCall[] = [];
  const seen = new Set<string>(); // Dedup by tool+args hash

  for (const toolName of TEXT_TOOL_NAMES) {
    const upper = toolName.toUpperCase();

    // Pattern 1: [CREATE_CARD] { json } — tool name in brackets, JSON after
    const re1 = new RegExp(`\\[\\s*${upper}\\s*\\]\\s*\\{([\\s\\S]*?)\\}`, 'gi');
    // Pattern 2: [CREATE_CARD { json }] — everything inside brackets
    const re2 = new RegExp(`\\[\\s*${upper}\\s+\\{([\\s\\S]*?)\\}\\s*\\]`, 'gi');
    // Pattern 3: XML parameters
    const re3 = new RegExp(`\\[\\s*${upper}\\s*\\]\\s*(<parameter[\\s\\S]*</parameter>)`, 'gi');

    // Pattern 4: ```json block after tool name — models often wrap JSON in code fences
    const re4 = new RegExp(`\\[\\s*${upper}\\s*\\]\\s*\`\`\`(?:json)?\\s*\\{([\\s\\S]*?)\\}\\s*\`\`\``, 'gi');

    // Pattern 5: Inline function-call style: remember({"key": "value"}) or remember({key: "value"})
    const re5 = new RegExp(`(?:^|\\n|\\s)${toolName}\\s*\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`, 'gi');

    // Pattern 6: Inline function-call with named params: remember(key="user_profile", value="...")
    const re6 = new RegExp(`(?:^|\\n|\\s)${toolName}\\s*\\(([^)]+)\\)`, 'gi');

    // Process XML pattern
    let m3;
    while ((m3 = re3.exec(content)) !== null) {
      try {
        const xmlBlock = m3[1];
        const args: Record<string, string> = {};
        const paramRegex = /<parameter(?:=|\s+name=")([^">]+)"?\s*>([\s\S]*?)<\/parameter>/gi;
        let pm;
        while ((pm = paramRegex.exec(xmlBlock)) !== null) {
          args[pm[1].trim()] = pm[2].trim();
        }
        if (Object.keys(args).length > 0) {
          const hash = `${toolName}:${JSON.stringify(args)}`;
          if (!seen.has(hash)) {
            seen.add(hash);
            toolCalls.push({
              id: `text-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: toolName,
              arguments: args,
            });
            console.log(`[AgentLoop] Extracted XML tool call: ${toolName}(${Object.keys(args).join(', ')})`);
          }
        }
      } catch { /* skip malformed XML */ }
    }

    // Process JSON patterns (re1, re2, re4)
    for (const re of [re1, re2, re4]) {
      let m;
      while ((m = re.exec(content)) !== null) {
        try {
          const args = JSON.parse('{' + m[1] + '}');
          const hash = `${toolName}:${JSON.stringify(args)}`;
          if (!seen.has(hash)) {
            seen.add(hash);
            toolCalls.push({
              id: `text-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: toolName,
              arguments: args,
            });
            console.log(`[AgentLoop] Extracted JSON tool call: ${toolName}(${Object.keys(args).join(', ')})`);
          }
        } catch { /* skip malformed JSON */ }
      }
    }

    // Process inline function-call style with JSON: remember({"category": "..."})
    {
      let m5;
      while ((m5 = re5.exec(content)) !== null) {
        try {
          const args = JSON.parse('{' + m5[1] + '}');
          const hash = `${toolName}:${JSON.stringify(args)}`;
          if (!seen.has(hash)) {
            seen.add(hash);
            toolCalls.push({
              id: `text-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: toolName,
              arguments: args,
            });
            console.log(`[AgentLoop] Extracted inline tool call: ${toolName}(${Object.keys(args).join(', ')})`);
          }
        } catch { /* skip malformed JSON */ }
      }
    }

    // Process inline named-param style: remember(key="user_profile", value="developer")
    {
      let m6;
      while ((m6 = re6.exec(content)) !== null) {
        try {
          const paramStr = m6[1];
          // Skip if it looks like JSON (already handled above)
          if (paramStr.trim().startsWith('{')) continue;
          const args: Record<string, string> = {};
          // Match key="value" or key='value' pairs
          const kvRegex = /(\w+)\s*=\s*["']([^"']*?)["']/g;
          let kv;
          while ((kv = kvRegex.exec(paramStr)) !== null) {
            args[kv[1]] = kv[2];
          }
          if (Object.keys(args).length > 0) {
            const hash = `${toolName}:${JSON.stringify(args)}`;
            if (!seen.has(hash)) {
              seen.add(hash);
              toolCalls.push({
                id: `text-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: toolName,
                arguments: args,
              });
              console.log(`[AgentLoop] Extracted named-param tool call: ${toolName}(${Object.keys(args).join(', ')})`);
            }
          }
        } catch { /* skip malformed params */ }
      }
    }
  }

  if (toolCalls.length > 0) {
    console.log(`[AgentLoop] Text extraction found ${toolCalls.length} tool call(s): ${toolCalls.map(tc => tc.name).join(', ')}`);
  }

  return toolCalls;
}

// ---------------------------------------------------------------------------
// agentLoop — Main Orchestration Generator
// ---------------------------------------------------------------------------

export async function* agentLoop(input: AgentLoopInput): AsyncGenerator<SSEEvent> {
  const startTime = Date.now();
  const collector = createTraceCollector();
  collector.setRunContext(input.projectId, input.userId, input.userMessage);

  const pipelineDepth = input.pipelineDepth ?? 0;
  let currentAgent = '';
  let completedSignals: string[] = [];

  try {
    // ── 1. Input Guardrails ──────────────────────────────────────────────
    const guardrailResult = await runInputGuardrails(input.userMessage, input.userId);

    if (guardrailResult.flags.length > 0) {
      console.log(`[AgentLoop] Guardrail flags: ${guardrailResult.flags.join(', ')}`);
    }

    if (guardrailResult.blocked) {
      console.warn(`[AgentLoop] BLOCKED: ${guardrailResult.reason}`);
      yield {
        type: 'error',
        data: {
          message: guardrailResult.reason ?? 'Message blocked by safety guardrails.',
          guardrail: true,
        },
      };
      return;
    }

    const sanitizedMessage = guardrailResult.sanitizedMessage;

    // ── 2. Route Message ─────────────────────────────────────────────────
    if (input.targetAgentShortName) {
      currentAgent = input.targetAgentShortName;
    } else {
      currentAgent = await messageRouter.route(sanitizedMessage, input.projectId);
    }

    console.log(`[AgentLoop] Routed to: ${currentAgent} (depth: ${pipelineDepth})`);

    // ── VS Code Gate ─────────────────────────────────────────────────────
    // Development agents require VS Code. This catches two cases:
    // (a) Router already detected VS Code is missing and returned the sentinel
    // (b) Agent was explicitly targeted (bypassed router) but VS Code is down
    let vsCodeBlocked = currentAgent === VSCODE_REQUIRED_SENTINEL;

    if (!vsCodeBlocked && DEV_AGENTS.has(currentAgent)) {
      const connected = await isVSCodeConnected(input.projectId);
      if (!connected) vsCodeBlocked = true;
    }

    if (vsCodeBlocked) {
      const agentLabel = currentAgent === VSCODE_REQUIRED_SENTINEL
        ? 'Development' : currentAgent;

      console.log(`[AgentLoop] ⏸ VS Code not connected. Gating ${agentLabel} — emitting vscode_required.`);
      yield {
        type: 'vscode_required',
        data: {
          agent: agentLabel,
          message: `Development requires VS Code. Please open VS Code with the Codanium extension connected to this project, then try again.`,
          deepLink: `vscode://codanium/resume?projectId=${input.projectId}`,
        },
      };
      if (currentAgent !== VSCODE_REQUIRED_SENTINEL) {
        await agentStateManager.setIdle(input.projectId, currentAgent);
      }
      return; // Halt — do not run the agent
    }

    const agentDef = getAgentDefinition(currentAgent);

    // ── 3. Build Context ─────────────────────────────────────────────────
    const context = await contextBuilder.build(agentDef, input.projectId, {
      isDelegation: input.isPipeline,
    });

    // For pipeline calls, prefix the message so agents know they're in autonomous mode
    let pipelinePrefix = `[PIPELINE] ${sanitizedMessage}\n\nYou are in PIPELINE MODE. Work autonomously — do NOT ask the user questions. Read the project documents in your context and produce your deliverables.`;

    // BA is INTERACTIVE — it must ask the user questions, NOT work autonomously
    if (input.isPipeline && currentAgent === 'BA') {
      try {
        const existingBrd = await prisma.document.findFirst({
          where: { projectId: input.projectId, type: 'BRD' },
        });
        if (existingBrd) {
          pipelinePrefix = `[PIPELINE] ${sanitizedMessage}\n\nA BRD already exists (status: ${existingBrd.status}). If the user approved it, call approve_document(type='BRD') and hand off to SA. Otherwise ask what changes they want.`;
        } else {
          // BA REPLACES the autonomous prefix — BA is user-facing and must ask questions
          pipelinePrefix = `[PIPELINE] ${sanitizedMessage}\n\nYou are the Business Analyst starting Phase 1 — Requirements Gathering.\n\nIMPORTANT: You are NOT in autonomous mode. You MUST interact with the user.\n\nYour VERY FIRST message must:\n1. Introduce yourself as the Business Analyst\n2. Ask the user about their technical background:\n   "Before we dive in, how would you describe your technical background?"\n   A) Non-technical — I have the idea, you handle the tech\n   B) Vibe Coder — I know some basics but need guidance\n   C) Developer — I'm technical and want architecture control\n   D) Team Lead — Managing a dev team, need specs for handoff\n3. Save their answer with remember(key="user_profile")\n4. Then ask discovery questions ONE AT A TIME with clickable [A/B/C/D] options\n5. Save each Q&A with remember(key="qa_N")\n6. After enough answers (8-12 questions), generate the full BRD with update_document\n\nDo NOT generate a BRD yet. Do NOT work autonomously. WAIT for user answers.`;
        }
      } catch {
        pipelinePrefix = `[PIPELINE] ${sanitizedMessage}\n\nYou are the Business Analyst. Ask the user about their technical background first, then ask discovery questions ONE AT A TIME. Do NOT generate the BRD until you have enough answers.`;
      }
    }

    const userContent = input.isPipeline
      ? pipelinePrefix
      : sanitizedMessage;

    // Consolidate all system content into ONE system message at the start
    // (NVIDIA and some providers reject multiple system messages)
    const correction = buildContextCorrection(currentAgent);

    // Add explicit tool call format instructions for models that don't support native function calling.
    // This tells the model to output tool calls as structured text that extractTextToolCalls() can parse.
    const toolCallFormatGuide = `

═══════════════════════════════════════════════════════════
HOW TO CALL TOOLS — MANDATORY FORMAT
═══════════════════════════════════════════════════════════

When you need to call a tool, you MUST output it in this EXACT format (one per line):

[TOOL_NAME] {"param1": "value1", "param2": "value2"}

Examples:
[REMEMBER] {"key": "user_profile", "value": "Developer — technical, wants architecture control"}
[REMEMBER] {"key": "qa_1", "value": "Q: First action on app open? | A: Dashboard view showing current spending vs budget"}
[UPDATE_DOCUMENT] {"type": "BRD", "title": "Business Requirements Document", "content": "# Business Requirements Document\\n\\n## 1. Executive Summary\\n..."}
[CREATE_DECISION] {"title": "BRD Approval: Project Name", "description": "Review the BRD", "options": [{"label": "Approve", "pros": "Ready to proceed"}, {"label": "Request Changes", "pros": "Refine further"}]}
[UPDATE_CARD] {"cardId": "xxx", "state": "DONE"}

RULES:
- You MUST use this [TOOL_NAME] {json} format — never just describe what you would do
- Tool name must be UPPERCASE with underscores (e.g., REMEMBER, UPDATE_DOCUMENT, CREATE_DECISION)
- The JSON must be valid and on the same line or immediately after the tool name
- You can call multiple tools in one response — put each on its own line
- ALWAYS include tool calls when instructed to save, remember, update, or create
- After calling a tool, you may add conversational text before or after the tool call line
`;

    let fullSystemMessage = correction
      ? `${context.systemMessage}\n\n${correction}`
      : context.systemMessage;

    // Append tool format guide for agents that use tools
    const TOOL_USING_AGENTS = ['BA', 'PM', 'SA', 'TL', 'JD', 'SD', 'QA', 'DO', 'UX'];
    if (TOOL_USING_AGENTS.includes(currentAgent)) {
      fullSystemMessage += toolCallFormatGuide;
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: fullSystemMessage },
      ...context.recentHistory,
      { role: 'user', content: userContent },
    ];

    // ── Signal agent start ───────────────────────────────────────────────
    yield {
      type: 'agent_start',
      data: { agentShortName: currentAgent, agentName: agentDef.name },
    };

    await agentStateManager.setWorking(
      input.projectId,
      currentAgent,
      `Processing: ${sanitizedMessage.slice(0, 80)}`,
    );

    // ── 4. Agent Loop (tool calling) ─────────────────────────────────────
    const agentTools = getToolsForAgent(currentAgent);
    const toolDefs: LLMToolDefinition[] = agentTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    let fullContent = '';
    let fullThinking = '';
    let tokensUsed: { prompt: number; completion: number; total: number } | null = null;
    let toolLoopCount = 0;
    let consecutiveToolErrors = 0;
    let modelOverride: string | undefined;
    // Full fallback provider config — when set, passed to llmGateway.stream()
    // so the retry uses the correct API key, base URL, and provider adapter.
    let fallbackConfig: { provider: LLMProvider; config: ProviderConfig; billingType: BillingType } | undefined;

    // Loop detection state
    const loopState: LoopState = {
      recentToolCalls: [],
      recentResponses: [],
    };

    let consecutiveLoopWarnings = 0;

    for (let iteration = 0; iteration < MAX_TOOL_LOOPS; iteration++) {
      // ── Loop detection ───────────────────────────────────────────────
      const loopWarning = checkLoops(loopState);
      if (loopWarning) {
        consecutiveLoopWarnings++;
        console.warn(`[AgentLoop] Loop detected (${loopWarning.type}), warning #${consecutiveLoopWarnings}`);

        // Hard stop: if we've warned 4+ times and the agent keeps looping, break
        if (consecutiveLoopWarnings >= 4) {
          console.error(`[AgentLoop] ⛔ Hard stop: ${consecutiveLoopWarnings} consecutive loop warnings for ${currentAgent}. Aborting.`);

          // Create a Decision record so the user can decide what to do next
          try {
            const member = await prisma.projectMember.findFirst({
              where: { projectId: input.projectId },
              select: { userId: true },
            });
            const ownerId = member?.userId || 'usr-001';
            const decision = await prisma.decision.create({
              data: {
                projectId: input.projectId,
                trigger: `${currentAgent} blocked — repeated loop detected`,
                context: `Agent ${currentAgent} was stopped after ${consecutiveLoopWarnings} consecutive loop warnings. The agent was unable to make progress and kept repeating the same actions.`,
                status: 'DRAFTED',
                recommendation: 'Retry with different instructions or skip this step.',
                ownerId,
              },
            });
            // Create options for the decision
            await prisma.decisionOption.createMany({
              data: [
                { decisionId: decision.id, name: 'Retry', description: 'Retry the operation with adjusted instructions' },
                { decisionId: decision.id, name: 'Skip', description: 'Skip this step and continue to the next phase' },
                { decisionId: decision.id, name: 'Manual Intervention', description: 'Handle this step manually outside the platform' },
              ],
            });
            console.log(`[AgentLoop] Created Decision record: ${decision.id}`);
          } catch (e) {
            console.warn('[AgentLoop] Failed to create Decision record for loop hard stop:', e);
          }

          yield {
            type: 'chunk',
            data: {
              content: '\n\nI encountered a repeated issue and stopped to avoid going in circles. ' +
                'Check **My Decisions** for next steps.',
            },
          };
          break;
        }

        messages.push({ role: 'system', content: loopWarning.message });
      } else {
        consecutiveLoopWarnings = 0;
      }

      // ── Stream LLM (with retry + model downgrade) ────────────────────
      let iterContent = '';
      let iterThinking = '';
      let collectedToolCalls: LLMToolCall[] = [];
      let llmSuccess = false;

      let lastLLMError = '';
      let lastResolvedProvider = '';

      for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt++) {
        iterContent = '';
        iterThinking = '';
        collectedToolCalls = [];

        try {
          // Track which provider we're about to use (for fallback resolution)
          if (!fallbackConfig) {
            try {
              const resolved = await llmGateway.resolve(input.projectId, currentAgent, input.userId);
              lastResolvedProvider = resolved.config.provider;
            } catch { /* resolve will be called again inside stream() */ }
          } else {
            lastResolvedProvider = fallbackConfig.config.provider;
          }
          const llmStart = Date.now();
          // Document-generating agents need higher token limits
          // BA creates BRD (~3000+ words), SA creates SDD (~3000+ words)
          const DOCUMENT_AGENTS = ['BA', 'SA', 'UX', 'TL'];
          const maxTokens = DOCUMENT_AGENTS.includes(currentAgent) ? 16384 : 4096;

          for await (const chunk of llmGateway.stream({
            messages,
            model: modelOverride,
            temperature: agentDef.temperature,
            maxTokens,
            agentId: currentAgent,
            projectId: input.projectId,
            metadata: { userId: input.userId },
            tools: toolDefs.length > 0 ? toolDefs : undefined,
            toolChoice: toolDefs.length > 0 ? 'auto' : undefined,
          }, fallbackConfig)) {
            if (chunk.thinking) {
              iterThinking += chunk.thinking;
              yield { type: 'thinking', data: { content: chunk.thinking } };
            }
            if (chunk.content) {
              iterContent += chunk.content;
              yield { type: 'chunk', data: { content: chunk.content } };

              // ── Repetition loop detector ────────────────────────────
              // If the LLM starts repeating the same token/phrase (e.g. "[TL] [TL] [TL]...")
              // abort early to avoid wasting tokens and showing garbage to the user.
              if (iterContent.length > 400) {
                const tail = iterContent.slice(-400);
                // Check for generic repeating patterns (but ignore table/diagram separators)
                const repMatch = tail.match(/(.{5,15})\1{9,}/);
                // Exclude table/diagram patterns from repetition detection
                const isTableOrDiagram = repMatch && /^[-|+= ┌─┐└┘├┤┬┴┼\s]+$/.test(repMatch[1]);
                // Check for LLM attention collapse spamming agent tags like "[TL] [TL] [TL]"
                const tagSpamMatch = tail.match(/(\[\s*[A-Z]{2,3}\s*\]\s*){8,}/);
                
                if ((repMatch && !isTableOrDiagram) || tagSpamMatch) {
                  console.warn(`[AgentLoop] ⚠️ Repetition loop detected for ${currentAgent}. Aborting.`);
                  // Truncate to content before the repetition started
                  let repStart = -1;
                  if (repMatch) repStart = iterContent.lastIndexOf(repMatch[0]);
                  else if (tagSpamMatch) repStart = iterContent.lastIndexOf(tagSpamMatch[0]);

                  if (repStart > 50) {
                    iterContent = iterContent.slice(0, repStart).trim() + '\n\n*[Response truncated — repetition detected]*';
                  } else {
                    iterContent = `I encountered an issue processing this request. Let me try a different approach.\n\n*[Response reset — repetition loop detected]*`;
                  }
                  yield { type: 'chunk', data: { content: '\n\n*[Response truncated — repetition detected]*' } };
                  break; // Exit the streaming loop
                }
              }
            }
            if (chunk.toolCalls && chunk.toolCalls.length > 0) {
              for (const tc of chunk.toolCalls) {
                if (!collectedToolCalls.some(e => e.id === tc.id)) {
                  collectedToolCalls.push(tc);
                }
              }
            }
            if (chunk.done && chunk.tokensUsed) {
              tokensUsed = chunk.tokensUsed;
              yield { type: 'usage', data: { tokensUsed: chunk.tokensUsed } };

              collector.recordLLMCall({
                model: modelOverride ?? 'default',
                agent: currentAgent,
                tokensPrompt: chunk.tokensUsed.prompt,
                tokensCompletion: chunk.tokensUsed.completion,
                tokensTotal: chunk.tokensUsed.total,
                latencyMs: Date.now() - llmStart,
                hasToolCalls: collectedToolCalls.length > 0,
                toolCallCount: collectedToolCalls.length,
                costEstimate: 0,
              });
            }
          }

          // Detect truncation — if a document agent's response ends abruptly
          if (iterContent && DOCUMENT_AGENTS.includes(currentAgent)) {
            const hasOpenTags = (iterContent.match(/\[ARTIFACT/g) || []).length > (iterContent.match(/\[\/ARTIFACT\]/g) || []).length;
            const endsAbruptly = iterContent.length > 2000 && !iterContent.trimEnd().endsWith(']') && !iterContent.trimEnd().endsWith('.') && !iterContent.trimEnd().endsWith('\n');
            if (hasOpenTags || endsAbruptly) {
              console.warn(`[AgentLoop] ${currentAgent} response may be truncated (${iterContent.length} chars, openTags=${hasOpenTags}, abrupt=${endsAbruptly})`);
              // Add continuation prompt and retry
              messages.push({ role: 'assistant', content: iterContent });
              messages.push({ role: 'user', content: 'Your previous response was truncated. Please continue from where you left off and complete the document. Do NOT restart from the beginning.' });
              iterContent = ''; // Reset so the retry appends
              throw new Error('Response truncated — retrying with continuation');
            }
          }

          if (iterContent || collectedToolCalls.length > 0) {
            llmSuccess = true;
            break;
          }
          // Empty response — add nudge message so the next retry has extra guidance
          messages.push({ role: 'user', content: 'Please provide your analysis. Do not return an empty response.' });
          console.warn(`[AgentLoop] Empty response from ${currentAgent}, nudging with retry prompt`);
          throw new Error('LLM returned empty response');
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          lastLLMError = errMsg;
          console.error(`[AgentLoop] LLM attempt ${attempt + 1}/${MAX_LLM_ATTEMPTS} failed: ${errMsg}`);

          if (attempt === 1 && !modelOverride) {
            const fallback = findFallbackModel(modelOverride || 'unknown');
            if (fallback) {
              modelOverride = fallback;
              yield { type: 'info', data: { message: `Model downgraded to ${fallback} due to error` } };
            }
          }

          // Try next provider in the fallback chain on retryable errors
          const lowerErr = errMsg.toLowerCase();
          const isRetryable = errMsg.includes('429') || errMsg.includes('500') || errMsg.includes('503')
            || errMsg.includes('413') || errMsg.includes('404') || errMsg.includes('401') || errMsg.includes('403')
            || lowerErr.includes('rate limit') || lowerErr.includes('timeout') || lowerErr.includes('too large')
            || lowerErr.includes('fetch failed') || lowerErr.includes('econnrefused')
            || lowerErr.includes('econnreset') || lowerErr.includes('socket hang up')
            || lowerErr.includes('network') || lowerErr.includes('unavailable')
            || lowerErr.includes('unknown api error');
          if (isRetryable && attempt < MAX_LLM_ATTEMPTS - 1) {
            try {
              const failedProviderName = fallbackConfig?.config.provider || lastResolvedProvider || 'unknown';
              const nextProvider = await llmGateway.resolveFallback(failedProviderName);
              if (nextProvider) {
                // Store the FULL provider config (API key, base URL, adapter)
                // so the next retry uses the correct provider, not just a model name
                fallbackConfig = nextProvider;
                modelOverride = nextProvider.config.defaultModel;
                yield { type: 'info', data: { message: `Switching to fallback provider: ${nextProvider.config.provider}` } };
              }
            } catch { /* continue with current provider */ }
          }
        }
      }

      if (!llmSuccess) {
        const isRateLimit = lastLLMError.includes('429') || lastLLMError.toLowerCase().includes('rate limit');
        const userMessage = isRateLimit
          ? 'Our AI service is temporarily busy (rate limit reached). Please wait a moment and try again.'
          : `AI service unavailable after ${MAX_LLM_ATTEMPTS} attempts. Error: ${lastLLMError.slice(0, 200)}`;
        yield { type: 'error', data: { message: userMessage } };
        break;
      }

      fullThinking += iterThinking;

      // ── Fallback: extract text-based tool calls ──────────────────────
      if (collectedToolCalls.length === 0 && iterContent) {
        const textCalls = extractTextToolCalls(iterContent);
        if (textCalls.length > 0) {
          collectedToolCalls = textCalls;
          console.log(`[AgentLoop] Fallback: extracted ${textCalls.length} text tool call(s)`);
        }
      }

      // Sanitize iterContent AFTER text tool extraction (so extraction still works)
      iterContent = sanitizeContent(iterContent);
      fullContent += iterContent;

      // ── Handle tool calls ────────────────────────────────────────────
      if (collectedToolCalls.length > 0) {
        toolLoopCount++;

        // Yield tool_call events
        for (const tc of collectedToolCalls) {
          yield { type: 'tool_call', data: { name: tc.name, arguments: tc.arguments } };
        }

        // Execute tools
        const toolCalls = collectedToolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        }));

        const results: ToolResult[] = [];
        for (const tc of toolCalls) {
          try {
            // Resolve agent DB ID for ownership tracking
            const agentRecord = await prisma.agent.findFirst({
              where: { projectId: input.projectId, shortName: currentAgent },
              select: { id: true },
            });
            const [result] = await executeToolCalls([tc], {
              projectId: input.projectId,
              agentShortName: currentAgent,
              agentId: agentRecord?.id,
              userId: input.userId,
            });
            results.push(result);
          } catch (err: any) {
            results.push({
              toolCallId: tc.id,
              name: tc.name,
              success: false,
              result: null,
              error: `Tool execution failed: ${err.message}`,
            });
          }
        }

        // Yield tool_result events
        for (const result of results) {
          yield {
            type: 'tool_result',
            data: {
              name: result.name,
              success: result.success,
              result: result.success
                ? (typeof result.result === 'string'
                    ? result.result.slice(0, 500)
                    : JSON.stringify(result.result).slice(0, 500))
                : result.error,
            },
          };

          collector.recordToolCall({
            toolName: result.name,
            agent: currentAgent,
            success: result.success,
            durationMs: 0,
            error: result.success ? undefined : (result.error ?? 'Unknown error'),
          });
        }

        // Check if any tool result is an ask_user request — pause pipeline
        const askUserResult = results.find(
          r => r.success && r.result && typeof r.result === 'object' && r.result.__askUser,
        );
        if (askUserResult) {
          const askData = askUserResult.result;
          yield {
            type: 'question_for_user',
            data: {
              question: askData.question,
              context: askData.context,
              options: askData.options,
              fromAgent: askData.agentShortName,
            },
          };
          // Save the question as an agent message so user sees it in chat
          await saveAgentMessage(
            input.projectId,
            currentAgent,
            `**I need your help with something:**\n\n${askData.question}${askData.options ? '\n\n' + askData.options.map((o: string, i: number) => `**${String.fromCharCode(65 + i)})** ${o}`).join('\n') : ''}`,
          );
          await agentStateManager.setIdle(input.projectId, currentAgent);
          yield { type: 'done', data: { messageId: '', agentShortName: currentAgent, paused: true } };
          return; // Stop the pipeline — user needs to respond
        }

        // Track completed signals for pipeline routing
        const newSignals = results
          .filter(r => r.success)
          .map(r => {
            const args = toolCalls.find(tc => tc.id === r.toolCallId)?.arguments;
            if (args?.type) return `${r.name}(${args.type})`;
            if (args?.state) return `${r.name}(${args.state})`;
            return `${r.name}()`;
          });
        completedSignals.push(...newSignals);

        // Track for loop detection
        const now = Date.now();
        const newTracked: TrackedToolCall[] = toolCalls.map(tc => ({
          name: tc.name,
          args: JSON.stringify(tc.arguments ?? {}),
          timestamp: now,
        }));
        const twoMinutesAgo = now - 2 * 60 * 1000;
        loopState.recentToolCalls = [...loopState.recentToolCalls, ...newTracked]
          .filter(tc => tc.timestamp > twoMinutesAgo)
          .slice(-10);

        // Circuit breaker
        const anySucceeded = results.some(r => r.success);
        consecutiveToolErrors = anySucceeded ? 0 : consecutiveToolErrors + 1;
        if (consecutiveToolErrors >= TOOL_ERROR_CIRCUIT_BREAKER) {
          console.warn(`[AgentLoop] Circuit breaker: ${consecutiveToolErrors} consecutive tool failures`);
          break;
        }

        // Append assistant message with tool calls + tool results to messages
        messages.push({
          role: 'assistant',
          content: iterContent || '',
          toolCalls: collectedToolCalls,
        });
        for (const result of results) {
          messages.push({
            role: 'tool',
            content: result.success
              ? (typeof result.result === 'string' ? result.result : JSON.stringify(result.result))
              : `Error: ${result.error}`,
            toolCallId: result.toolCallId,
          });
        }

        // Continue loop for next LLM call with tool results
        continue;
      }

      // ── Text response (no tool calls) — finalize ─────────────────────
      // If after tool loops with no text, make a final call without tools
      if (!fullContent.trim() && toolLoopCount > 0) {
        console.log('[AgentLoop] No text after tool loops — making final call WITHOUT tools');
        try {
          for await (const chunk of llmGateway.stream({
            messages,
            model: modelOverride,
            temperature: agentDef.temperature,
            agentId: currentAgent,
            projectId: input.projectId,
            metadata: { userId: input.userId },
          })) {
            if (chunk.content) {
              fullContent += chunk.content;
              yield { type: 'chunk', data: { content: chunk.content } };
            }
          }
        } catch (e) {
          console.error('[AgentLoop] Final text-only call failed:', e);
        }
      }

      // Sanitize content: strip raw tool call markup from all LLM providers
      fullContent = sanitizeContent(fullContent);

      // Parse, persist, and emit done
      const parsed = parseAgentResponse(fullContent);

      // ── Output Guardrails ──────────────────────────────────────────
      const outputGuardrails = await runOutputGuardrails(parsed, fullContent);
      if (outputGuardrails.flags.length > 0) {
        console.log(`[AgentLoop] Output guardrail flags: ${outputGuardrails.flags.join(', ')}`);
        yield { type: 'info', data: { message: `Output guardrails: ${outputGuardrails.flags.length} flag(s)` } };
      }
      if (outputGuardrails.hasCriticalIssues) {
        console.warn(`[AgentLoop] Output blocked — critical guardrail issues detected`);
        yield { type: 'error', data: { message: 'Response blocked by safety guardrails. Please rephrase your request.', guardrail: true } };
        await agentStateManager.setIdle(input.projectId, currentAgent);
        break;
      }

      // Emit artifact events
      for (const artifact of parsed.artifacts) {
        yield { type: 'artifact', data: { name: artifact.name, type: artifact.type } };
      }

      // Save message to DB
      const savedMessage = await saveAgentMessage(
        input.projectId,
        currentAgent,
        parsed.message,
        fullThinking || undefined,
        parsed.artifacts,
      );

      // Persist artifacts
      for (const artifact of parsed.artifacts) {
        await persistArtifact(
          artifact,
          input.projectId,
          currentAgent,
          savedMessage.id,
        );
      }

      // Reset agent to IDLE
      await agentStateManager.setIdle(input.projectId, currentAgent);

      // Emit done event
      yield {
        type: 'done',
        data: { messageId: savedMessage.id, agentShortName: currentAgent },
      };

      // Emit orchestration event
      await eventBus.emit({
        type: 'orchestration.complete',
        actor: currentAgent,
        projectId: input.projectId,
        payload: {
          messageId: savedMessage.id,
          tokensUsed: tokensUsed?.total ?? 0,
          toolSignals: completedSignals,
        },
      });

      // Track response for loop detection
      loopState.recentResponses = [...loopState.recentResponses, parsed.message].slice(-5);

      // ── 5. Pipeline Routing (BEFORE break) ───────────────────────────
      if (pipelineDepth < MAX_PIPELINE_DEPTH) {
        let nextAgent: string | null = null;
        let nextContext: string | null = null;

        // 5a. Try signal-based routing first (tool signals like approve_document)
        if (completedSignals.length > 0) {
          const matchedRule = matchPipelineRule(currentAgent, completedSignals);
          if (matchedRule) {
            let resolvedNext = matchedRule.next;

            // Dynamic routing for TL: inspect which agent TL assigned the last card to
            if (resolvedNext === 'DYNAMIC' && currentAgent === 'TL') {
              try {
                // Find the most recently updated IN_PROGRESS card with an ownerAgent
                const lastAssigned = await prisma.card.findFirst({
                  where: {
                    projectId: input.projectId,
                    state: 'IN_PROGRESS',
                    ownerAgentId: { not: null },
                  },
                  orderBy: { updatedAt: 'desc' },
                  include: { ownerAgent: { select: { shortName: true } } },
                });
                const targetAgent = lastAssigned?.ownerAgent?.shortName;
                resolvedNext = (targetAgent && ['JD', 'SD', 'UX', 'UID', 'DO'].includes(targetAgent))
                  ? targetAgent : 'JD';
              } catch {
                resolvedNext = 'JD';
              }
              console.log(`[AgentLoop] TL dynamic routing -> ${resolvedNext}`);
            }

            nextAgent = resolvedNext;
            nextContext = matchedRule.context;
            console.log(`[AgentLoop] Signal-based routing: ${currentAgent} -> ${nextAgent}`);
          }
        }

        // 5b. Check parsed delegation markers ([DELEGATE:AGENT]...[/DELEGATE])
        if (!nextAgent && parsed.delegateTo) {
          // Block self-delegation (agent delegating to itself is a no-op)
          if (parsed.delegateTo === currentAgent) {
            console.log(`[AgentLoop] Blocked self-delegation: ${currentAgent} -> ${currentAgent} (no-op)`);
          } else {
            nextAgent = parsed.delegateTo;
            nextContext = parsed.delegateContext || `Continue from ${currentAgent}. Previous output available in chat history.`;
            console.log(`[AgentLoop] Delegation routing: ${currentAgent} -> ${nextAgent} (via [DELEGATE] marker)`);
          }
        }

        // 5c. Fallback: use default next agent map (works even on first call now)
        if (!nextAgent) {
          const fallback = DEFAULT_NEXT_AGENT[currentAgent];
          if (fallback) {
            // Check approval gate if required (e.g., BA->SA only if BRD is APPROVED)
            let gateOpen = true;
            if (fallback.requiresApproval) {
              gateOpen = await isDocumentApproved(input.projectId, fallback.requiresApproval);
              if (!gateOpen) {
                // Gate not open — agent stays in current phase (e.g., BA keeps asking questions)
                // This is normal during requirement gathering before BRD is approved
                console.log(`[AgentLoop] Fallback gate not open: ${fallback.requiresApproval} not yet APPROVED — ${currentAgent} stays in current phase`);
              }
            }
            if (gateOpen) {
              nextAgent = fallback.next;
              nextContext = fallback.context;
              console.log(`[AgentLoop] Fallback routing: ${currentAgent} -> ${nextAgent}`);
            }
          }
        }

        if (nextAgent && nextContext) {
        // Auto-advance SDLC stages before delegating
        await autoAdvanceSDLC(input.projectId, currentAgent);

        // Cards should only move to IN_PROGRESS when TL explicitly assigns them
        // via the assign_card tool — no auto-moving here.

        console.log(`[AgentLoop] Pipeline: ${currentAgent} -> ${nextAgent} (depth ${pipelineDepth + 1})`);

        // Emit VS Code prompt when development phase starts
        if (nextAgent === 'TL' || nextAgent === 'DO') {
          yield {
            type: 'info',
            data: {
              title: 'Development Starting',
              message: 'Install the Codanium VS Code extension to see generated code in real-time.',
              action: 'Open VS Code',
              actionUrl: 'vscode:extension/codanium.codanium',
            },
          };
        }

        yield {
          type: 'delegation',
          data: { fromAgent: currentAgent, toAgent: nextAgent },
        };
        yield {
          type: 'pipeline_progress',
          data: {
            fromAgent: currentAgent,
            toAgent: nextAgent,
            depth: pipelineDepth + 1,
            maxDepth: MAX_PIPELINE_DEPTH,
          },
        };

        // Instead of recursing, yield a pipeline_next event for the client to handle.
        // The client will start the next agent via a new POST request, avoiding
        // recursive generator calls that cause multiple agents streaming simultaneously.
        yield {
          type: 'pipeline_next',
          data: {
            nextAgent: nextAgent,
            context: nextContext,
            depth: pipelineDepth + 1,
          },
        };
        // DO NOT recurse — let the client start the next agent via a new POST
      }
      } // end pipeline routing

      // Check if there are more PLANNED cards to work on — auto-continue
      if (currentAgent === 'QA' || currentAgent === 'SEC') {
        try {
          const remainingCards = await prisma.card.count({
            where: { projectId: input.projectId, state: 'PLANNED' },
          });
          if (remainingCards > 0) {
            console.log(`[AgentLoop] ♻️ Auto-continuing: ${remainingCards} PLANNED cards remaining`);
            yield {
              type: 'info',
              data: {
                title: `${remainingCards} tasks remaining — auto-continuing`,
                message: `Automatically picking up the next planned task.`,
              },
            };
            // Enqueue next cycle via orchestration queue
            try {
              const { addOrchestrationJob } = await import('@/lib/queue/orchestration-queue');
              // Create an OrchestrationRun record for the auto-continue job
              const autoContinueRun = await prisma.orchestrationRun.create({
                data: {
                  projectId: input.projectId,
                  userId: input.userId,
                  status: 'PENDING',
                  userMessage: 'Continue to the next planned task card.',
                  routedTo: 'TL',
                  autoRouted: true,
                  delegations: [],
                },
              });
              await addOrchestrationJob(
                {
                  runId: autoContinueRun.id,
                  projectId: input.projectId,
                  userId: input.userId,
                },
                { priority: 5, delay: 2000 }, // priority 5 = pipeline auto-triggered (medium)
              );
            } catch (err) {
              console.warn('[AgentLoop] Auto-continue queue failed:', err);
            }
          }
        } catch {}
      }

      break; // Exit agent loop — we have a text response
    }

    // ── 6. Finalize Telemetry ────────────────────────────────────────────
    collector.finalize().catch(() => {});
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[AgentLoop] Fatal error: ${errMsg}`);

    // Reset agent to IDLE on error
    if (currentAgent) {
      await agentStateManager.setIdle(input.projectId, currentAgent).catch(() => {});
    }

    yield { type: 'error', data: { message: 'An error occurred processing your request.' } };

    collector.markFailed(errMsg);
    collector.finalize().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// runAgentSilent — For consult_agent tool
// ---------------------------------------------------------------------------

/**
 * Run the agent loop silently, collecting text output instead of yielding SSE events.
 * Used by the `consult_agent` tool for agent-to-agent consultation.
 *
 * @param agentShortName  Target agent to consult.
 * @param question        The question or context to send to the agent.
 * @param projectId       Project scope.
 * @param depth           Current consultation depth (prevents infinite recursion).
 * @returns The agent's text response as a string.
 */
export async function runAgentSilent(
  agentShortName: string,
  question: string,
  projectId: string,
  depth: number,
): Promise<string> {
  if (depth >= MAX_CONSULTATION_DEPTH) {
    return `[Consultation depth limit reached (${MAX_CONSULTATION_DEPTH}). Cannot consult further.]`;
  }

  let collectedText = '';

  try {
    for await (const event of agentLoop({
      projectId,
      userId: 'system',
      userMessage: question,
      targetAgentShortName: agentShortName,
      isPipeline: false,
      consultationDepth: depth + 1,
    })) {
      if (event.type === 'chunk' && event.data.content) {
        collectedText += event.data.content;
      }
      if (event.type === 'error') {
        return `[Error consulting ${agentShortName}: ${event.data.message}]`;
      }
    }
  } catch (err: any) {
    return `[Error consulting ${agentShortName}: ${err.message}]`;
  }

  return collectedText || `[${agentShortName} returned no response.]`;
}
