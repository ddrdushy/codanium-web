// =============================================================================
// AI Team Studio — Message Router
// =============================================================================
// Classifies the user's message intent using keyword pattern matching and
// maps it to the most appropriate first-responder agent shortName.
//
// This is a fast, zero-cost classifier that runs locally. When accuracy
// requirements grow, it can be replaced with or augmented by an LLM-based
// intent classifier without changing the interface.
// =============================================================================

import { UserIntent } from './types';

// ---------------------------------------------------------------------------
// Intent Patterns
// ---------------------------------------------------------------------------

/**
 * Each entry maps a UserIntent to an array of regex patterns.
 * Patterns are tested against the lowercased message.
 * Order matters: first match wins.
 */
const INTENT_PATTERNS: Array<{ intent: UserIntent; patterns: RegExp[] }> = [
  {
    intent: 'approval',
    patterns: [
      /\b(approve|reject|yes|no|go ahead|looks good|accept|decline|agreed|confirmed|lgtm|ship it)\b/,
    ],
  },
  {
    intent: 'bug_report',
    patterns: [
      /\b(bug|error|fix|broken|wrong|issue|crash|failing|exception|doesn'?t work|not working)\b/,
    ],
  },
  {
    intent: 'cost_query',
    patterns: [
      /\b(cost|budget|spending|token|expensive|price|money|billing|usage|how much)\b/,
    ],
  },
  {
    intent: 'deployment',
    patterns: [
      /\b(deploy|release|ship|launch|production|go live|rollback|staging|publish)\b/,
    ],
  },
  {
    intent: 'testing',
    patterns: [
      /\b(test|quality|qa|verify|check|validation|coverage|regression|e2e|unit test)\b/,
    ],
  },
  {
    intent: 'ui_feedback',
    patterns: [
      /\b(design|look|layout|color|ui|ux|screen|mockup|wireframe|font|spacing|responsive)\b/,
    ],
  },
  {
    intent: 'architecture',
    patterns: [
      /\b(architecture|database|api|structure|tech stack|framework|schema|microservice|scalab|infra)\b/,
    ],
  },
  {
    intent: 'status_query',
    patterns: [
      /\b(status|progress|how('s| is)|what'?s happening|update|where are we|overview|summary|report)\b/,
    ],
  },
  {
    intent: 'new_requirement',
    patterns: [
      /\b(idea|build|create|want|need|should have|feature|add|make|implement|develop|can you|i('d| would) like)\b/,
    ],
  },
];

// ---------------------------------------------------------------------------
// Agent Routing Table
// ---------------------------------------------------------------------------

/**
 * Maps each classified intent to the agent shortName best suited to handle it.
 */
const ROUTING_TABLE: Record<UserIntent, string> = {
  new_requirement: 'BA',   // Business Analyst — requirements gathering
  approval:        'DEC',  // Decision Coordinator — handles approvals
  status_query:    'ORC',  // Orchestrator — project-wide awareness
  bug_report:      'QA',   // QA Engineer — bug triage and tracking
  ui_feedback:     'UX',   // UX Designer — design feedback
  cost_query:      'CA',   // Cost Analyst — budget / token usage
  deployment:      'DO',   // DevOps — deployment pipeline
  testing:         'QA',   // QA Engineer — test strategy
  architecture:    'SA',   // Solutions Architect — technical decisions
  general:         'BA',   // Business Analyst — default conversational agent
};

// ---------------------------------------------------------------------------
// MessageRouter
// ---------------------------------------------------------------------------

export class MessageRouter {
  /**
   * Analyze the user's message and return the shortName of the agent
   * best suited to respond.
   *
   * @param message   Raw user message text.
   * @param projectId Project scope (reserved for future context-aware routing).
   * @returns Agent shortName (e.g. "BA", "SA", "QA").
   */
  async route(message: string, projectId: string): Promise<string> {
    // projectId reserved for future use (e.g. project-phase-aware routing)
    void projectId;

    const intent = this.classifyIntent(message);
    return this.resolveAgent(intent);
  }

  /**
   * Classify the user's message into a UserIntent category.
   * Uses keyword pattern matching against the lowercased input.
   */
  classifyIntent(message: string): UserIntent {
    const lower = message.toLowerCase();

    for (const { intent, patterns } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(lower)) {
          return intent;
        }
      }
    }

    return 'general';
  }

  /**
   * Map a classified intent to the appropriate agent shortName.
   */
  private resolveAgent(intent: UserIntent): string {
    return ROUTING_TABLE[intent];
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const messageRouter = new MessageRouter();
