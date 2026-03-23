// =============================================================================
// AI Team Studio — Loop Detector
// =============================================================================
// Detects three types of loops in the orchestration graph:
//
//   1. Tool Call Loops: Same tool called with identical arguments repeatedly
//   2. Text Repetition: Agent producing near-identical responses
//   3. Question Re-ask: Agent asking the same question multiple times
//
// Inspired by Cloudflare VibeSDK's loop detection approach — track recent
// actions in a sliding window and inject corrective system messages when
// repetitive patterns are detected.
//
// Usage: call `checkForLoops(state)` before each LLM invocation. If a warning
// is returned, append it as a system message so the LLM can self-correct.
// =============================================================================

import type { GraphStateType } from './graph/state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoopWarning {
  type: 'tool_loop' | 'text_repeat' | 'question_reask';
  message: string;
}

export interface TrackedToolCall {
  name: string;
  args: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sliding window duration for tool call tracking (2 minutes). */
const TOOL_WINDOW_MS = 2 * 60 * 1000;

/** Maximum number of recent tool calls to keep in the window. */
const TOOL_WINDOW_MAX_CALLS = 10;

/** Minimum number of identical tool calls to trigger a warning. */
const TOOL_REPEAT_THRESHOLD = 2;

/** Number of recent responses to track for text repetition detection. */
const RESPONSE_HISTORY_SIZE = 5;

/** Similarity threshold (0–1) above which responses are considered repetitive. */
const TEXT_SIMILARITY_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// Normalization Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize text for comparison: lowercase, strip excess whitespace,
 * remove common option markers (bullets, numbers, dashes).
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s]*[-*•]\s*/gm, '')
    .replace(/^[\s]*\d+[.)]\s*/gm, '')
    .replace(/["""''`]/g, '')
    .trim();
}

/**
 * Compute similarity between two normalized strings using a simple
 * bigram overlap coefficient (Dice coefficient).
 *
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }

  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) {
    bigramsB.add(b.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) {
      intersection++;
    }
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Extract questions from text — lines or sentences ending with `?`.
 */
function extractQuestions(text: string): string[] {
  const questions: string[] = [];

  // Split into sentences/lines and find ones ending with ?
  const segments = text.split(/[.\n]/).map(s => s.trim()).filter(Boolean);
  for (const segment of segments) {
    if (segment.endsWith('?')) {
      questions.push(normalizeText(segment));
    }
  }

  // Also catch questions that span a full line
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.endsWith('?')) {
      const normalized = normalizeText(line);
      if (!questions.includes(normalized)) {
        questions.push(normalized);
      }
    }
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Loop Detection
// ---------------------------------------------------------------------------

/**
 * Check for tool call loops.
 *
 * Examines the recent tool call history (sliding window of last 2 minutes
 * or last 10 calls) and detects if the same tool with the same arguments
 * has been called 2+ times.
 */
function checkToolLoop(recentToolCalls: TrackedToolCall[]): LoopWarning | null {
  if (!recentToolCalls || recentToolCalls.length < TOOL_REPEAT_THRESHOLD) {
    return null;
  }

  const now = Date.now();

  // Filter to sliding window: last 2 minutes AND last 10 calls
  const windowCalls = recentToolCalls
    .filter(tc => now - tc.timestamp < TOOL_WINDOW_MS)
    .slice(-TOOL_WINDOW_MAX_CALLS);

  if (windowCalls.length < TOOL_REPEAT_THRESHOLD) {
    return null;
  }

  // Count occurrences of each (name, args) pair — exact match
  const callCounts = new Map<string, number>();
  for (const tc of windowCalls) {
    const key = `${tc.name}::${tc.args}`;
    callCounts.set(key, (callCounts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of callCounts) {
    if (count >= TOOL_REPEAT_THRESHOLD) {
      const toolName = key.split('::')[0];
      console.warn(
        `[LoopDetector] Tool loop detected: "${toolName}" called ${count} times with identical args`,
      );
      return {
        type: 'tool_loop',
        message:
          'STOP: You are calling the same tool repeatedly with identical arguments. ' +
          'This means the operation is failing or not achieving the desired result. ' +
          'Do NOT retry. Instead, inform the user what happened and what they can do.',
      };
    }
  }

  // Count occurrences of the same tool name (regardless of args) — catches
  // loops where the agent slightly varies arguments each iteration
  const nameOnlyCounts = new Map<string, number>();
  for (const tc of windowCalls) {
    nameOnlyCounts.set(tc.name, (nameOnlyCounts.get(tc.name) ?? 0) + 1);
  }

  // Tools that are legitimately called many times (creating cards, writing files)
  const HIGH_VOLUME_TOOLS = new Set([
    'create_card', 'write_file', 'edit_file', 'git_commit', 'run_command',
    'read_file', 'list_directory', 'glob', 'grep',
  ]);

  for (const [toolName, count] of nameOnlyCounts) {
    // Higher threshold for high-volume tools (8+ vs 3+ for others)
    const threshold = HIGH_VOLUME_TOOLS.has(toolName) ? 8 : 3;
    if (count >= threshold) {
      // Check similarity between args of these calls
      const argsForTool = windowCalls
        .filter(tc => tc.name === toolName)
        .map(tc => normalizeText(tc.args));

      let similarPairs = 0;
      let totalPairs = 0;
      for (let i = 0; i < argsForTool.length; i++) {
        for (let j = i + 1; j < argsForTool.length; j++) {
          totalPairs++;
          if (computeSimilarity(argsForTool[i], argsForTool[j]) > 0.6) {
            similarPairs++;
          }
        }
      }

      if (totalPairs > 0 && similarPairs / totalPairs >= 0.5) {
        console.warn(
          `[LoopDetector] Fuzzy tool loop detected: "${toolName}" called ${count} times with similar args`,
        );
        return {
          type: 'tool_loop',
          message:
            'STOP: You are calling the same tool repeatedly with similar arguments. ' +
            'This means the operation is not working as expected. ' +
            'Do NOT retry. Summarize the problem for the user and stop.',
        };
      }
    }
  }

  return null;
}

/**
 * Check for text repetition in recent responses.
 *
 * Compares the most recent response against previous responses using
 * normalized bigram similarity. If any pair exceeds the 80% threshold,
 * a warning is returned.
 */
function checkTextRepetition(recentResponses: string[]): LoopWarning | null {
  if (!recentResponses || recentResponses.length < 2) {
    return null;
  }

  const responses = recentResponses.slice(-RESPONSE_HISTORY_SIZE);
  const latestNormalized = normalizeText(responses[responses.length - 1]);

  // Skip very short responses (greetings, acknowledgements)
  if (latestNormalized.length < 50) {
    return null;
  }

  for (let i = 0; i < responses.length - 1; i++) {
    const prevNormalized = normalizeText(responses[i]);
    if (prevNormalized.length < 50) continue;

    const similarity = computeSimilarity(latestNormalized, prevNormalized);
    if (similarity > TEXT_SIMILARITY_THRESHOLD) {
      console.warn(
        `[LoopDetector] Text repetition detected: response ${responses.length - 1} is ${(similarity * 100).toFixed(1)}% similar to response ${i}`,
      );
      return {
        type: 'text_repeat',
        message:
          'WARNING: Your response is very similar to a previous message. ' +
          'The user has likely already answered this. Check chat history and ask a NEW question or proceed to the next step.',
      };
    }
  }

  return null;
}

/**
 * Check for repeated questions across recent responses.
 *
 * Extracts questions (sentences ending with ?) from all recent responses
 * and detects if the same normalized question appears more than once.
 * This directly addresses the "BA asking repeated questions" bug.
 */
function checkQuestionReask(recentResponses: string[]): LoopWarning | null {
  if (!recentResponses || recentResponses.length < 2) {
    return null;
  }

  const responses = recentResponses.slice(-RESPONSE_HISTORY_SIZE);
  const seenQuestions = new Map<string, number>();

  for (const response of responses) {
    const questions = extractQuestions(response);
    for (const q of questions) {
      // Skip very short questions like "ok?" or "yes?"
      if (q.length < 10) continue;
      const count = (seenQuestions.get(q) ?? 0) + 1;
      seenQuestions.set(q, count);

      if (count >= 2) {
        console.warn(
          `[LoopDetector] Question re-ask detected: "${q.slice(0, 80)}..." asked ${count} times`,
        );
        return {
          type: 'question_reask',
          message:
            'WARNING: You are asking a question that has already been asked before. ' +
            'Check the conversation history — the user may have already answered this. ' +
            'Ask a NEW question or proceed to the next step.',
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check the graph state for any detected loops.
 *
 * Runs all three detectors in priority order:
 *   1. Tool call loops (highest priority — can cause infinite tool execution)
 *   2. Question re-asks (directly causes bad UX)
 *   3. Text repetition (general staleness detection)
 *
 * Returns the first detected warning, or null if no loops found.
 */
export function checkForLoops(state: GraphStateType): LoopWarning | null {
  // 1. Check tool call loops
  const toolWarning = checkToolLoop(state.recentToolCalls ?? []);
  if (toolWarning) return toolWarning;

  // 2. Check question re-asks
  const questionWarning = checkQuestionReask(state.recentResponses ?? []);
  if (questionWarning) return questionWarning;

  // 3. Check text repetition
  const textWarning = checkTextRepetition(state.recentResponses ?? []);
  if (textWarning) return textWarning;

  return null;
}
