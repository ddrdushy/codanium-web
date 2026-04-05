// =============================================================================
// Codanium — Task-Aware LLM Router
// =============================================================================
// Enterprise Spec §10.1 — Routes LLM calls to appropriate models based on
// task type, token budget, and quality requirements.
//
// Task types:
//   - chat:     Short responses, status updates → fast/cheap model
//   - document: BRD/SDD section generation → high-quality model
//   - code:     Code generation/editing → code-specialized model
//   - review:   Code review, architecture review → high-quality model
//   - summary:  Summaries, progress reports → fast model
//
// This module provides model preference hints. The LLM Gateway still handles
// the actual provider resolution and fallback chain.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskType = 'chat' | 'document' | 'code' | 'review' | 'summary';

export interface TaskClassification {
  type: TaskType;
  quality: 'high' | 'medium' | 'low';
  maxTokens: number;
  /** Preferred model families in order of preference */
  preferredModels: string[];
}

// ---------------------------------------------------------------------------
// Task Classification Rules
// ---------------------------------------------------------------------------

const TASK_PROFILES: Record<TaskType, TaskClassification> = {
  chat: {
    type: 'chat',
    quality: 'low',
    maxTokens: 800,
    preferredModels: ['groq', 'mistral', 'gpt-4o-mini', 'claude-3-haiku'],
  },
  document: {
    type: 'document',
    quality: 'high',
    maxTokens: 1500,
    preferredModels: ['claude-3-5-sonnet', 'gpt-4o', 'claude-3-opus', 'gpt-4-turbo'],
  },
  code: {
    type: 'code',
    quality: 'medium',
    maxTokens: 2000,
    preferredModels: ['codestral', 'deepseek-coder', 'gpt-4o', 'claude-3-5-sonnet'],
  },
  review: {
    type: 'review',
    quality: 'high',
    maxTokens: 1500,
    preferredModels: ['claude-3-5-sonnet', 'gpt-4o', 'claude-3-opus'],
  },
  summary: {
    type: 'summary',
    quality: 'low',
    maxTokens: 700,
    preferredModels: ['groq', 'mistral', 'gpt-4o-mini', 'claude-3-haiku'],
  },
};

// Agent → default task type mapping
const AGENT_TASK_TYPE: Record<string, TaskType> = {
  PM: 'chat',
  BA: 'document',
  SA: 'document',
  UX: 'document',
  UID: 'document',
  TL: 'review',
  JD: 'code',
  SD: 'code',
  QA: 'review',
  SEC: 'review',
  DO: 'code',
  PE: 'review',
  IE: 'code',
  AT: 'code',
  PF: 'review',
  LLM: 'summary',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a task based on agent and optional explicit type.
 */
export function classifyTask(agentShortName: string, explicitType?: TaskType): TaskClassification {
  const type = explicitType || AGENT_TASK_TYPE[agentShortName.toUpperCase()] || 'chat';
  return TASK_PROFILES[type];
}

/**
 * Get the recommended max tokens for a given task type.
 */
export function getTaskTokenBudget(taskType: TaskType): number {
  return TASK_PROFILES[taskType]?.maxTokens || 1500;
}

/**
 * Get preferred model hints for the LLM gateway.
 * Returns model family prefixes that the gateway can use to prefer
 * certain providers in its resolution chain.
 */
export function getPreferredModels(taskType: TaskType): string[] {
  return TASK_PROFILES[taskType]?.preferredModels || [];
}

/**
 * Detect task type from tool signals (post-execution classification).
 * Used to classify completed work for billing and analytics.
 */
export function classifyFromSignals(signals: string[]): TaskType {
  const signalStr = signals.join(' ').toLowerCase();

  if (signalStr.includes('create_document') || signalStr.includes('update_document')) {
    return 'document';
  }
  if (signalStr.includes('write_file') || signalStr.includes('edit_file') || signalStr.includes('git_commit')) {
    return 'code';
  }
  if (signalStr.includes('validate_code') || signalStr.includes('review_changes') || signalStr.includes('run_tests')) {
    return 'review';
  }
  if (signalStr.includes('task_progress') || signalStr.includes('remember')) {
    return 'summary';
  }
  return 'chat';
}
