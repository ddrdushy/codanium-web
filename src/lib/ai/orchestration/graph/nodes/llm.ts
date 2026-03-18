// =============================================================================
// AI Team Studio — LLM Node
// =============================================================================
// Wraps the LLM Gateway's stream() method as a LangGraph node.
// Uses LangGraph's StreamWriter to emit SSE events in real-time:
//   - agent_start: signals which agent is responding
//   - thinking: reasoning tokens
//   - chunk: content tokens
//   - usage: final token counts
//
// Passes tools (filtered by agent authority) to the LLM provider.
// Collects tool calls from the stream and sets them in state for
// the executeTools node to process.
//
// When tool results are present (from a previous tool execution loop),
// appends them to the message history so the LLM can see the results.
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { getAgentDefinition } from '@/lib/ai/agents/registry';
import { llmGateway } from '@/lib/ai/gateway';
import { agentStateManager } from '../../state-manager';
import { getToolsForAgent } from '@/lib/ai/tools/tool-filter';
import type { LLMMessage, LLMToolCall, LLMToolDefinition } from '@/lib/ai/providers/types';
import type { ToolResult } from '@/lib/ai/tools/tool-definitions';
import { checkForLoops } from '../../loop-detector';

// ---------------------------------------------------------------------------
// Model Downgrade Map
// ---------------------------------------------------------------------------
// When the primary model fails, try a cheaper/faster alternative.

const MODEL_DOWNGRADE_MAP: Record<string, string> = {
  'claude-3-opus': 'claude-3-sonnet',
  'claude-3-5-sonnet': 'claude-3-haiku',
  'claude-3-sonnet': 'claude-3-haiku',
  'gpt-4': 'gpt-4o-mini',
  'gpt-4o': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4o-mini',
  // Ollama models — no downgrade available, just retry
};

/** Maximum LLM call attempts (1 initial + 1 same-model retry + 1 downgraded). */
const MAX_LLM_ATTEMPTS = 3;

/**
 * LLM node.
 * Streams the LLM response, passes tools, and collects tool calls.
 * Emits SSE events via StreamWriter.
 */
export async function llmNode(
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> {
  const writer = (config as any).writer;
  const agentDef = getAgentDefinition(state.routedAgent);
  const toolLoopCount = state.toolLoopCount ?? 0;

  // ── Signal agent start (only on first call, not tool loops) ─────────
  if (toolLoopCount === 0 && writer) {
    writer({
      type: 'agent_start',
      data: { agentShortName: state.routedAgent, agentName: agentDef.name },
    });
  }

  // Set agent to WORKING
  await agentStateManager.setWorking(
    state.projectId,
    state.routedAgent,
    `Processing: ${state.userMessage.slice(0, 80)}`,
  );

  // ── Build messages with tool results if present ─────────────────────
  let messages: LLMMessage[] = [...state.llmMessages];

  // If we have tool results from a previous loop, append them
  const toolResults = state.toolResults ?? [];

  if (toolResults.length > 0 && toolLoopCount > 0) {
    // Add the assistant message that made the tool calls (with content so far)
    const assistantToolCalls: LLMToolCall[] = toolResults.map(r => ({
      id: r.toolCallId,
      name: r.name,
      arguments: {},
    }));

    messages.push({
      role: 'assistant',
      content: state.rawContent || '',
      toolCalls: assistantToolCalls,
    });

    // Add tool result messages
    for (const result of toolResults) {
      messages.push({
        role: 'tool',
        content: result.success
          ? (typeof result.result === 'string' ? result.result : JSON.stringify(result.result))
          : `Error: ${result.error}`,
        toolCallId: result.toolCallId,
      });
    }
  }

  // ── Loop detection: inject warning if loops detected ────────────────
  const loopWarning = checkForLoops(state);
  if (loopWarning) {
    console.warn(
      `[LLMNode] Loop detected (${loopWarning.type}): injecting corrective system message`,
    );
    messages.push({
      role: 'system',
      content: loopWarning.message,
    });
  }

  // ── Get tools for this agent ────────────────────────────────────────
  const agentTools = getToolsForAgent(state.routedAgent);
  const toolDefs: LLMToolDefinition[] = agentTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  // ── Stream LLM response (with retry + model downgrade) ──────────────
  let fullContent = '';
  let fullThinking = '';
  let tokensUsed: { prompt: number; completion: number; total: number } | null = null;
  let collectedToolCalls: LLMToolCall[] = [];
  let llmRetryCount = state.llmRetryCount ?? 0;
  let modelDowngraded = state.modelDowngraded ?? false;
  let modelDowngradedTo = state.modelDowngradedTo;
  let modelOverride: string | undefined = modelDowngraded ? modelDowngradedTo : undefined;

  for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt++) {
    // Reset accumulators for each attempt
    fullContent = '';
    fullThinking = '';
    tokensUsed = null;
    collectedToolCalls = [];

    try {
      for await (const chunk of llmGateway.stream({
        messages,
        model: modelOverride,
        temperature: agentDef.temperature,
        agentId: state.routedAgent,
        projectId: state.projectId,
        metadata: { userId: state.userId },
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        toolChoice: toolDefs.length > 0 ? 'auto' : undefined,
      })) {
        if (chunk.thinking) {
          fullThinking += chunk.thinking;
          if (writer) {
            writer({ type: 'thinking', data: { content: chunk.thinking } });
          }
        }

        if (chunk.content) {
          fullContent += chunk.content;
          if (writer) {
            writer({ type: 'chunk', data: { content: chunk.content } });
          }
        }

        // Accumulate tool calls from ANY chunk (not just final)
        // Some adapters emit tool calls on intermediate chunks
        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          for (const tc of chunk.toolCalls) {
            // Deduplicate by tool call ID
            if (!collectedToolCalls.some(existing => existing.id === tc.id)) {
              collectedToolCalls.push(tc);
            }
          }
        }

        if (chunk.done) {
          if (chunk.tokensUsed) {
            tokensUsed = chunk.tokensUsed;
            if (writer) {
              writer({ type: 'usage', data: { tokensUsed: chunk.tokensUsed } });
            }
          }
          if (collectedToolCalls.length > 0) {
            console.log(
              `[LLMNode] Native tool calls collected: ${collectedToolCalls.map(tc => tc.name).join(', ')}`,
            );
          }
        }
      }

      // If we got content or tool calls, the call succeeded — break out
      if (fullContent || collectedToolCalls.length > 0) {
        break;
      }

      // Empty response — treat as a soft failure, fall through to retry logic
      console.warn(`[LLMNode] Attempt ${attempt + 1}: LLM returned empty response`);
      throw new Error('LLM returned empty response');
    } catch (llmError: any) {
      llmRetryCount++;
      const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);
      console.error(`[LLMNode] Attempt ${attempt + 1}/${MAX_LLM_ATTEMPTS} failed: ${errorMsg}`);

      if (attempt === 0) {
        // First failure — retry with the same model
        console.log('[LLMNode] Retrying with the same model...');
      } else if (attempt === 1 && !modelDowngraded) {
        // Second failure — try to downgrade the model
        // Resolve the current model name (modelOverride or the provider default)
        const currentModel = modelOverride || 'unknown';
        // Find a matching downgrade by checking partial model name matches
        const fallbackModel = findFallbackModel(currentModel);

        if (fallbackModel) {
          modelOverride = fallbackModel;
          modelDowngraded = true;
          modelDowngradedTo = fallbackModel;
          console.log(`[LLMNode] Downgrading model to ${fallbackModel}`);
          if (writer) {
            writer({
              type: 'info',
              data: { message: `Model downgraded to ${fallbackModel} due to error` },
            });
          }
        } else {
          // No downgrade available — give up
          console.warn(`[LLMNode] No fallback model available for "${currentModel}", giving up`);
          break;
        }
      } else {
        // Third failure (or already downgraded) — give up
        console.error('[LLMNode] All LLM attempts exhausted, returning empty content');
        break;
      }
    }
  }

  // ── Fallback: extract text-based tool calls if native tool_use was empty ──
  // Some models output tool calls as text (e.g., [UPDATE_DOCUMENT]{...}) instead
  // of using the native tool_use API. Parse them as a fallback.
  if (collectedToolCalls.length === 0 && fullContent) {
    const textToolCalls = extractTextToolCalls(fullContent);
    if (textToolCalls.length > 0) {
      collectedToolCalls = textToolCalls;
      console.log(
        `[LLMNode] Fallback: extracted ${textToolCalls.length} tool call(s) from text: ${textToolCalls.map(tc => tc.name).join(', ')}`,
      );
    }
  }

  // Preserve text from previous tool loop iterations.
  const previousContent = state.rawContent ?? '';
  const combinedContent = previousContent && fullContent
    ? `${previousContent}\n${fullContent}`
    : fullContent || previousContent;

  // ── Final response generation ──────────────────────────────────────
  // Many models (Ollama, OpenAI) return ONLY tool calls with empty text content.
  // After tool loops complete (no more tool calls OR limit reached), if we still
  // have no text, make ONE final LLM call WITHOUT tools to get the user-facing response.
  const isAfterToolLoop = (state.toolLoopCount ?? 0) > 0;
  const hasNoContent = !combinedContent.trim();
  const hasNoMoreToolCalls = collectedToolCalls.length === 0;

  if (isAfterToolLoop && hasNoContent && hasNoMoreToolCalls) {
    console.log('[LLMNode] No text after tool loops — making final call WITHOUT tools for user response');
    let finalContent = '';
    try {
      for await (const chunk of llmGateway.stream({
        messages,
        model: modelOverride,
        temperature: agentDef.temperature,
        agentId: state.routedAgent,
        projectId: state.projectId,
        metadata: { userId: state.userId },
        // NO tools — force text-only response
      })) {
        if (chunk.content) {
          finalContent += chunk.content;
          if (writer) {
            writer({ type: 'chunk', data: { content: chunk.content } });
          }
        }
      }
    } catch (e) {
      console.error('[LLMNode] Final text-only call failed:', e);
    }
    if (finalContent.trim()) {
      console.log(`[LLMNode] Final response generated: ${finalContent.length} chars`);
      return {
        rawContent: finalContent,
        rawThinking: fullThinking ? (state.rawThinking ?? '') + fullThinking : (state.rawThinking ?? ''),
        tokensUsed,
        toolCalls: [],
        llmRetryCount,
        modelDowngraded,
        modelDowngradedTo,
      };
    }
  }

  return {
    rawContent: combinedContent,
    rawThinking: fullThinking ? (state.rawThinking ?? '') + fullThinking : (state.rawThinking ?? ''),
    tokensUsed,
    toolCalls: collectedToolCalls,
    llmRetryCount,
    modelDowngraded,
    modelDowngradedTo,
  };
}

/**
 * Find a fallback/downgrade model for the given model name.
 * Uses partial matching so "claude-3-5-sonnet-20241022" still matches "claude-3-5-sonnet".
 */
function findFallbackModel(currentModel: string): string | undefined {
  // Try exact match first
  if (MODEL_DOWNGRADE_MAP[currentModel]) {
    return MODEL_DOWNGRADE_MAP[currentModel];
  }
  // Try partial match (model names often include version suffixes)
  for (const [key, fallback] of Object.entries(MODEL_DOWNGRADE_MAP)) {
    if (currentModel.startsWith(key) || currentModel.includes(key)) {
      return fallback;
    }
  }
  return undefined;
}

/**
 * Extract tool calls from text content when the model outputs them as text
 * instead of using the native tool_use API.
 * Handles two formats:
 *   [UPDATE_DOCUMENT]{ "type": "BRD", ... }
 *   [REMEMBER {"key":"x","value":"y"}]
 */
function extractTextToolCalls(content: string): LLMToolCall[] {
  const TOOL_NAMES = [
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

  const toolCalls: LLMToolCall[] = [];

  for (const toolName of TOOL_NAMES) {
    const upperName = toolName.toUpperCase();
    // Format 1: [TOOL_NAME]{ json }
    const re1 = new RegExp(`\\[\\s*${upperName}\\s*\\]\\s*\\{([\\s\\S]*?)\\}`, 'gi');
    // Format 2: [TOOL_NAME {json}]
    const re2 = new RegExp(`\\[\\s*${upperName}\\s+\\{([\\s\\S]*?)\\}\\s*\\]`, 'gi');

    for (const re of [re1, re2]) {
      let match;
      while ((match = re.exec(content)) !== null) {
        try {
          const jsonStr = '{' + match[1] + '}';
          const args = JSON.parse(jsonStr);
          toolCalls.push({
            id: `text-tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: toolName,
            arguments: args,
          });
        } catch {
          // Invalid JSON — skip this match
          console.warn(`[LLMNode] Failed to parse text tool call: ${toolName}`);
        }
      }
    }
  }

  return toolCalls;
}
