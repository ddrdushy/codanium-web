// =============================================================================
// AI Team Studio — Context Pruner
// =============================================================================
// Manages LLM context window by summarizing old conversation history.
// Inspired by Cloudflare VibeSDK's conversation compactification:
//   - Monitors message count and estimated token usage
//   - When thresholds are exceeded, older messages are summarized by a lightweight LLM
//   - Recent messages are preserved intact for immediate context
//   - Fallback: if summarization fails, simply drop oldest messages
//
// Thresholds (configurable):
//   - MESSAGE_THRESHOLD: 15 messages triggers summarization
//   - TOKEN_THRESHOLD: 80,000 estimated tokens triggers summarization
//   - PRESERVE_RECENT: 5 most recent messages always kept intact
// =============================================================================

import type { LLMMessage } from '@/lib/ai/providers/types';

/** Number of messages that triggers summarization */
const MESSAGE_THRESHOLD = 15;

/** Estimated token count that triggers summarization (chars / 4) */
const TOKEN_THRESHOLD = 80_000;

/** Number of recent messages to always preserve (never summarized) */
const PRESERVE_RECENT = 5;

/**
 * Estimate token count for a messages array (rough: chars / 4).
 */
function estimateTokens(messages: LLMMessage[]): number {
  return Math.ceil(
    messages.reduce((sum, m) => sum + m.content.length, 0) / 4,
  );
}

/**
 * Check if the messages array needs pruning.
 */
export function needsPruning(messages: LLMMessage[]): boolean {
  if (messages.length > MESSAGE_THRESHOLD) return true;
  if (estimateTokens(messages) > TOKEN_THRESHOLD) return true;
  return false;
}

/**
 * Prune conversation history by summarizing older messages.
 *
 * Strategy:
 *   1. Keep the last PRESERVE_RECENT messages intact
 *   2. Take the older messages and generate a dense summary
 *   3. Replace older messages with a single system message containing the summary
 *   4. Fallback: if summarization fails, just keep the recent messages
 *
 * @param messages - Full conversation history (chronological order)
 * @param projectId - For logging
 * @returns Pruned messages array
 */
export async function pruneConversationHistory(
  messages: LLMMessage[],
  projectId: string,
): Promise<{ pruned: LLMMessage[]; dropped: number; summarized: boolean }> {
  if (!needsPruning(messages)) {
    return { pruned: messages, dropped: 0, summarized: false };
  }

  const totalCount = messages.length;
  const preserveCount = Math.min(PRESERVE_RECENT, totalCount);

  // Split: old messages to summarize, recent messages to keep
  const oldMessages = messages.slice(0, totalCount - preserveCount);
  const recentMessages = messages.slice(totalCount - preserveCount);

  if (oldMessages.length === 0) {
    return { pruned: messages, dropped: 0, summarized: false };
  }

  console.log(
    `[ContextPruner] Pruning ${oldMessages.length} old messages (keeping ${recentMessages.length} recent) for project ${projectId}`,
  );

  // Try to generate a summary of the old messages
  try {
    const summary = generateDeterministicSummary(oldMessages);

    const summaryMessage: LLMMessage = {
      role: 'system',
      content: `[CONVERSATION SUMMARY — ${oldMessages.length} earlier messages condensed]\n${summary}`,
    };

    console.log(
      `[ContextPruner] Summarized ${oldMessages.length} messages into ${summary.length} chars`,
    );

    return {
      pruned: [summaryMessage, ...recentMessages],
      dropped: oldMessages.length,
      summarized: true,
    };
  } catch (err) {
    // Fallback: just drop old messages and keep recent
    console.warn(
      `[ContextPruner] Summarization failed, falling back to truncation:`,
      err,
    );

    return {
      pruned: recentMessages,
      dropped: oldMessages.length,
      summarized: false,
    };
  }
}

/**
 * Generate a deterministic summary of conversation messages.
 * Extracts key decisions, user preferences, and agent actions
 * without requiring an LLM call (fast, reliable, no cost).
 *
 * For LLM-powered summarization, this could be replaced with a call
 * to a lightweight model (e.g., GPT-4o-mini or Claude Haiku).
 */
function generateDeterministicSummary(messages: LLMMessage[]): string {
  const userInputs: string[] = [];
  const agentActions: string[] = [];
  const decisions: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Capture user's key answers (truncate long ones)
      const content = msg.content.length > 200
        ? msg.content.substring(0, 200) + '...'
        : msg.content;
      userInputs.push(`- User: ${content}`);
    } else if (msg.role === 'assistant') {
      // Extract agent identity and key actions
      const agentMatch = msg.content.match(/^\[(\w+)\]\s*/);
      const agent = agentMatch ? agentMatch[1] : 'Agent';

      // Look for key decision patterns
      if (/approved|created|generated|completed|selected|chose/i.test(msg.content)) {
        const firstSentence = msg.content
          .replace(/^\[\w+\]\s*/, '')
          .split(/[.!?\n]/)[0]
          .trim();
        if (firstSentence.length > 10) {
          agentActions.push(`- ${agent}: ${firstSentence.substring(0, 150)}`);
        }
      }

      // Look for questions asked (to track what's been covered)
      if (/\?\s*$|\*\*[A-F]\)\*\*/m.test(msg.content)) {
        const questionMatch = msg.content.match(/(?:^|\n)([^*\n]*\?)\s*$/m);
        if (questionMatch) {
          decisions.push(`- Asked: ${questionMatch[1].substring(0, 100)}`);
        }
      }
    } else if (msg.role === 'system' && msg.content.length > 50) {
      // System messages (project setup, etc.)
      const truncated = msg.content.substring(0, 150);
      agentActions.push(`- System: ${truncated}`);
    }
  }

  const sections: string[] = [];

  if (userInputs.length > 0) {
    // Keep last 8 user inputs max
    const recent = userInputs.slice(-8);
    sections.push('User inputs:\n' + recent.join('\n'));
  }

  if (agentActions.length > 0) {
    // Keep last 6 agent actions
    const recent = agentActions.slice(-6);
    sections.push('Agent actions:\n' + recent.join('\n'));
  }

  if (decisions.length > 0) {
    // Keep last 5 questions asked
    const recent = decisions.slice(-5);
    sections.push('Questions covered:\n' + recent.join('\n'));
  }

  return sections.join('\n\n') || 'Earlier conversation covered initial project setup and requirements gathering.';
}
