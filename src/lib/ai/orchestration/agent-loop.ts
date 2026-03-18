// =============================================================================
// AI Team Studio — Agent Loop
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

import { runInputGuardrails } from './graph/guardrails';
import { messageRouter } from './router';
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
import type {
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '@/lib/ai/providers/types';
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

const MAX_TOOL_LOOPS = 7;
const MAX_LLM_ATTEMPTS = 3;
// Max 2 auto-chains per request to prevent browser crashes from too many
// simultaneous SSE streams. After 2 handoffs, the next agent starts on
// the user's next message (or the frontend can auto-trigger it).
const MAX_PIPELINE_DEPTH = 2;
const MAX_CONSULTATION_DEPTH = 3;
const TOOL_ERROR_CIRCUIT_BREAKER = 3;

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

const PIPELINE_RULES: PipelineRule[] = [
  { from: 'BA', signals: ['approve_document(BRD)'], next: 'SA', context: 'Design the technical architecture based on the approved requirements. Read the BRD document in your context \u2014 it contains the full requirements. Produce a System Design Document (SDD).' },
  { from: 'SA', signals: ['approve_document(SDD)'], next: 'UX', context: 'Create wireframes and design system based on the BRD and SDD. Focus on user experience and interface design.' },
  { from: 'UX', signals: ['approve_document(DESIGN_SYSTEM)', 'task_progress()'], next: 'PM', context: 'Break down the project into task cards on the work board. Read the BRD, SDD, and design documents. Create task cards for each feature.' },
  { from: 'PM', signals: ['create_card()'], next: 'DO', context: 'Scaffold the project structure based on the SDD tech stack. Generate boilerplate files, package.json, config files.' },
  { from: 'DO', signals: ['write_file()', 'git_commit()', 'trigger_deploy()'], next: 'TL', context: 'Project scaffold is ready. Review the task cards and assign the first highest-priority task to a developer (JD or SD).' },
  { from: 'TL', signals: ['update_card(IN_PROGRESS)', 'update_card(PLANNED)'], next: 'JD', context: 'Implement the assigned task. Read the relevant files, write code, run tests, and commit when complete.' },
  { from: 'JD', signals: ['update_card(DONE)', 'update_card(REVIEW)', 'git_commit()'], next: 'QA', context: 'Review and test the implementation that was just completed. Run tests, validate code quality, and check for bugs.' },
  { from: 'SD', signals: ['update_card(DONE)', 'update_card(REVIEW)', 'git_commit()'], next: 'QA', context: 'Review the senior developer implementation. Run quality checks and verify it meets standards.' },
  { from: 'QA', signals: ['validate_code()', 'review_changes()', 'run_tests()', 'update_card(DONE)'], next: 'SEC', context: 'Security review the tested implementation. Check for vulnerabilities and security best practices.' },
  { from: 'SEC', signals: ['validate_code()', 'validate_architecture()', 'review_changes()', 'update_card(DONE)'], next: 'PM', context: 'Provide a progress summary. Check if there are more PLANNED cards \u2014 if so, route to TL for the next task.' },
  { from: 'PM', signals: ['update_card()', 'task_progress()'], next: 'TL', context: 'Check for remaining PLANNED cards. If any exist, assign the next highest-priority task to JD or SD.' },
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
  BA: 'Business Analysis',
  SA: 'Architecture',
  UX: 'UI/UX Design',
  PM: 'Planning',
  DO: 'Development',
  TL: 'Development',
  JD: 'Development',
  SD: 'Development',
  QA: 'Testing',
  SEC: 'Code Review',
};

async function autoAdvanceSDLC(projectId: string, agentShortName: string): Promise<void> {
  const stageToAdvance = AGENT_STAGE_MAP[agentShortName];
  if (!stageToAdvance) return;

  try {
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
  BA: { next: 'SA', context: 'Design the technical architecture based on the approved requirements. Read the BRD document in your context — it contains the full requirements. Produce a System Design Document (SDD).', requiresApproval: 'BRD' },
  SA: { next: 'UX', context: 'Create wireframes and design system based on the BRD and SDD. Focus on user experience and interface design.', requiresApproval: 'SDD' },
  UX: { next: 'PM', context: 'Break down the project into task cards on the work board. Read the BRD, SDD, and design documents. Create task cards for each feature.' },
  PM: { next: 'DO', context: 'Scaffold the project structure based on the SDD tech stack. Generate boilerplate files, package.json, config files.' },
  DO: { next: 'TL', context: 'Project scaffold is ready. Review the task cards and assign the first highest-priority task to a developer (JD or SD).' },
  TL: { next: 'JD', context: 'Implement the assigned task. Read the relevant files, write code, run tests, and commit when complete.' },
  JD: { next: 'QA', context: 'Review and test the implementation that was just completed. Run tests, validate code quality, and check for bugs.' },
  SD: { next: 'QA', context: 'Review the senior developer implementation. Run quality checks and verify it meets standards.' },
  QA: { next: 'SEC', context: 'Security review the tested implementation. Check for vulnerabilities and security best practices.' },
  SEC: { next: 'PM', context: 'Provide a progress summary. Check if there are more PLANNED cards — if so, route to TL for the next task.' },
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
  for (const toolName of TEXT_TOOL_NAMES) {
    const upper = toolName.toUpperCase();
    const re1 = new RegExp(`\\[\\s*${upper}\\s*\\]\\s*\\{([\\s\\S]*?)\\}`, 'gi');
    const re2 = new RegExp(`\\[\\s*${upper}\\s+\\{([\\s\\S]*?)\\}\\s*\\]`, 'gi');
    for (const re of [re1, re2]) {
      let m;
      while ((m = re.exec(content)) !== null) {
        try {
          const args = JSON.parse('{' + m[1] + '}');
          toolCalls.push({
            id: `text-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: toolName,
            arguments: args,
          });
        } catch { /* skip malformed JSON */ }
      }
    }
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

    const agentDef = getAgentDefinition(currentAgent);

    // ── 3. Build Context ─────────────────────────────────────────────────
    const context = await contextBuilder.build(agentDef, input.projectId, {
      isDelegation: input.isPipeline,
    });

    // For pipeline calls, prefix the message so agents know they're in autonomous mode
    const userContent = input.isPipeline
      ? `[PIPELINE] ${sanitizedMessage}\n\nYou are in PIPELINE MODE. Work autonomously — do NOT ask the user questions. Read the project documents in your context and produce your deliverables.`
      : sanitizedMessage;

    const messages: LLMMessage[] = [
      { role: 'system', content: context.systemMessage },
      ...context.recentHistory,
      // Inject context correction AFTER history — overrides any bad patterns in previous messages
      { role: 'system', content: buildContextCorrection(currentAgent) },
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

    // Loop detection state
    const loopState: LoopState = {
      recentToolCalls: [],
      recentResponses: [],
    };

    for (let iteration = 0; iteration < MAX_TOOL_LOOPS; iteration++) {
      // ── Loop detection ───────────────────────────────────────────────
      const loopWarning = checkLoops(loopState);
      if (loopWarning) {
        console.warn(`[AgentLoop] Loop detected (${loopWarning.type})`);
        messages.push({ role: 'system', content: loopWarning.message });
      }

      // ── Stream LLM (with retry + model downgrade) ────────────────────
      let iterContent = '';
      let iterThinking = '';
      let collectedToolCalls: LLMToolCall[] = [];
      let llmSuccess = false;

      for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt++) {
        iterContent = '';
        iterThinking = '';
        collectedToolCalls = [];

        try {
          const llmStart = Date.now();
          for await (const chunk of llmGateway.stream({
            messages,
            model: modelOverride,
            temperature: agentDef.temperature,
            agentId: currentAgent,
            projectId: input.projectId,
            metadata: { userId: input.userId },
            tools: toolDefs.length > 0 ? toolDefs : undefined,
            toolChoice: toolDefs.length > 0 ? 'auto' : undefined,
          })) {
            if (chunk.thinking) {
              iterThinking += chunk.thinking;
              yield { type: 'thinking', data: { content: chunk.thinking } };
            }
            if (chunk.content) {
              iterContent += chunk.content;
              yield { type: 'chunk', data: { content: chunk.content } };
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

          if (iterContent || collectedToolCalls.length > 0) {
            llmSuccess = true;
            break;
          }
          throw new Error('LLM returned empty response');
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[AgentLoop] LLM attempt ${attempt + 1}/${MAX_LLM_ATTEMPTS} failed: ${errMsg}`);

          if (attempt === 1 && !modelOverride) {
            const fallback = findFallbackModel(modelOverride || 'unknown');
            if (fallback) {
              modelOverride = fallback;
              yield { type: 'info', data: { message: `Model downgraded to ${fallback} due to error` } };
            }
          }
        }
      }

      if (!llmSuccess) {
        yield { type: 'error', data: { message: 'LLM failed after all retry attempts.' } };
        break;
      }

      fullContent += iterContent;
      fullThinking += iterThinking;

      // ── Fallback: extract text-based tool calls ──────────────────────
      if (collectedToolCalls.length === 0 && iterContent) {
        const textCalls = extractTextToolCalls(iterContent);
        if (textCalls.length > 0) {
          collectedToolCalls = textCalls;
          console.log(`[AgentLoop] Fallback: extracted ${textCalls.length} text tool call(s)`);
        }
      }

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
            const [result] = await executeToolCalls([tc], {
              projectId: input.projectId,
              agentShortName: currentAgent,
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

      // Parse, persist, and emit done
      const parsed = parseAgentResponse(fullContent);

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

      break; // Exit agent loop — we have a text response
    }

    // ── 5. Pipeline Routing ──────────────────────────────────────────────
    if (pipelineDepth < MAX_PIPELINE_DEPTH) {
      let nextAgent: string | null = null;
      let nextContext: string | null = null;

      // 5a. Try signal-based routing first
      if (completedSignals.length > 0) {
        const matchedRule = matchPipelineRule(currentAgent, completedSignals);
        if (matchedRule) {
          nextAgent = matchedRule.next;
          nextContext = matchedRule.context;
        }
      }

      // 5b. Fallback: if no signal match but agent was pipeline-invoked, use default next agent
      if (!nextAgent && input.isPipeline) {
        const fallback = DEFAULT_NEXT_AGENT[currentAgent];
        if (fallback) {
          // Check approval gate if required (e.g., BA->SA only if BRD is APPROVED)
          let gateOpen = true;
          if (fallback.requiresApproval) {
            gateOpen = await isDocumentApproved(input.projectId, fallback.requiresApproval);
            if (!gateOpen) {
              console.log(`[AgentLoop] Fallback blocked: ${fallback.requiresApproval} not yet APPROVED`);
            }
          }
          if (gateOpen) {
            nextAgent = fallback.next;
            nextContext = fallback.context;
            console.log(`[AgentLoop] Fallback routing: ${currentAgent} -> ${nextAgent} (no signal match, pipeline mode)`);
          }
        }
      }

      if (nextAgent && nextContext) {
        // Auto-advance SDLC stages before delegating
        await autoAdvanceSDLC(input.projectId, currentAgent);

        console.log(`[AgentLoop] Pipeline: ${currentAgent} -> ${nextAgent} (depth ${pipelineDepth + 1})`);

        // Emit VS Code prompt when development phase starts
        if (nextAgent === 'TL' || nextAgent === 'DO') {
          yield {
            type: 'info',
            data: {
              title: 'Development Starting',
              message: 'Install the AI Team Studio VS Code extension to see generated code in real-time.',
              action: 'Open VS Code',
              actionUrl: 'vscode:extension/ai-team-studio.ai-team-studio',
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

        // Recurse into the next agent
        yield* agentLoop({
          projectId: input.projectId,
          userId: input.userId,
          userMessage: nextContext,
          targetAgentShortName: nextAgent,
          isPipeline: true,
          pipelineDepth: pipelineDepth + 1,
        });
      }
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
