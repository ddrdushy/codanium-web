// =============================================================================
// AI Team Studio — Message Router
// =============================================================================
// Classifies the user's message intent and routes to the appropriate agent.
//
// ROUTING PRIORITY (in order):
//   1. Conversation continuity — if the last agent message asked a question
//      (contains option markers like "- **A)**"), route the reply back to
//      that same agent. This ensures SA's tech questions get answered by SA,
//      not re-routed to BA.
//   2. Explicit topic switch — if the user's message clearly targets a
//      different domain (e.g., "tell me about costs" during SA's questions),
//      override continuity and route to the appropriate specialist.
//   3. Keyword intent classification — fallback regex-based classifier.
//   4. Default — route to BA as the general conversational agent.
// =============================================================================

import { UserIntent } from './types';
import { prisma } from '@/lib/prisma';

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
    intent: 'code_generation',
    patterns: [
      /\b(start (building|coding|developing|implementation)|begin (development|coding|building)|write (the )?code|let'?s build|start the (build|development)|kick off development|ready to (build|code|develop)|generate (the )?code|open vscode|open vs code)\b/,
      /\b(next task|continue building|build more|next one|keep building|build the next|continue coding|next card)\b/,
    ],
  },
  {
    intent: 'new_requirement',
    patterns: [
      /\b(idea|build|create|want|need|should have|feature|add|make|implement|develop|can you|i('d| would) like)\b/,
    ],
  },
  // NOTE: 'approval' intent REMOVED from keyword patterns.
  // Words like "yes", "no", "go ahead" are almost always replies to the
  // current agent's question — not a request for the Decision Coordinator.
  // DEC is now only invoked via explicit delegation from other agents.
];

// ---------------------------------------------------------------------------
// Agent Routing Table
// ---------------------------------------------------------------------------

/**
 * Maps each classified intent to the agent shortName best suited to handle it.
 */
const ROUTING_TABLE: Record<UserIntent, string> = {
  new_requirement: 'BA',   // Business Analyst — requirements gathering
  approval:        'DEC',  // Decision Coordinator — only via delegation now
  status_query:    'ORC',  // Orchestrator — project-wide awareness
  bug_report:      'QA',   // QA Engineer — bug triage and tracking
  ui_feedback:     'UX',   // UX Designer — design feedback
  cost_query:      'CA',   // Cost Analyst — budget / token usage
  deployment:      'DO',   // DevOps — deployment pipeline
  testing:         'QA',   // QA Engineer — test strategy
  architecture:    'SA',   // Solutions Architect — technical decisions
  code_generation: 'TL',   // Tech Lead — coordinates development execution
  general:         'BA',   // Business Analyst — default conversational agent
};

// ---------------------------------------------------------------------------
// Conversation Continuity — "who asked the last question?"
// ---------------------------------------------------------------------------

/**
 * Regex that detects if a message contains clickable option markers.
 * Matches: "- **A)** text", "- A) text", "• **B)** text", etc.
 */
const HAS_OPTIONS_REGEX = /^[-*•]\s+\*{0,2}[A-F]\)\*{0,2}\s+/m;

/**
 * Regex that detects if a message ends with a question (contains "?" near the end).
 */
const HAS_QUESTION_REGEX = /\?\s*$/m;

/**
 * Check if a message looks like it's asking the user a question
 * (contains options or ends with a question mark).
 */
function messageAsksQuestion(content: string): boolean {
  return HAS_OPTIONS_REGEX.test(content) || HAS_QUESTION_REGEX.test(content);
}

/**
 * Check if the user's reply looks like it's answering a question
 * (short message, or matches an option text pattern).
 * Long messages with explicit intent keywords should use keyword routing.
 */
function isLikelyReply(message: string): boolean {
  const trimmed = message.trim();

  // Very short messages (< 100 chars) are almost always replies
  if (trimmed.length < 100) return true;

  // Messages that start with option-like text: "A)", "React/Next.js", etc.
  if (/^[A-F]\)/.test(trimmed)) return true;

  // Messages that are just greetings: "hi", "hello", "hey"
  if (/^(hi|hello|hey|ok|okay|sure|thanks|thank you|yep|yup|nah|nope)\b/i.test(trimmed)) return true;

  return false;
}

/**
 * Detect if the user is explicitly switching topics (overrides continuity).
 * Only triggers for strong, unambiguous intent signals.
 */
function isExplicitTopicSwitch(message: string): UserIntent | null {
  const lower = message.toLowerCase();

  // Strong signals that the user wants a different agent
  // These are phrased as commands, not answers to questions
  if (/\b(show me the budget|how much (have|did) (we|i) spend|check cost|token usage)\b/.test(lower)) return 'cost_query';
  if (/\b(deploy now|push to production|go live now|release it)\b/.test(lower)) return 'deployment';
  if (/\b(run (the )?tests|check quality|qa report)\b/.test(lower)) return 'testing';
  if (/\b(show me the design|wireframe|mockup|ui review)\b/.test(lower)) return 'ui_feedback';
  if (/\b(project status|where are we|give me an update|progress report)\b/.test(lower)) return 'status_query';
  if (/\b(i have a new idea|new feature request|i want to add|let me describe|i('d| would) like to build)\b/.test(lower)) return 'new_requirement';
  if (/\b(start (building|coding|developing)|begin (development|coding)|let'?s build|write (the )?code|kick off (development|the build)|ready to (build|code)|open vscode|open vs code)\b/.test(lower)) return 'code_generation';
  if (/\b(next task|continue building|build more|next one|keep building|build the next|continue coding|next card)\b/.test(lower)) return 'code_generation';

  return null;
}

/**
 * Look up the last agent message in the project's chat history.
 * Returns the agent shortName and whether the message asked a question.
 */
async function getLastAgentContext(projectId: string): Promise<{
  agentShortName: string | null;
  askedQuestion: boolean;
} | null> {
  try {
    const lastAgentMsg = await prisma.chatMessage.findFirst({
      where: {
        projectId,
        role: 'AGENT',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        content: true,
        agent: {
          select: { shortName: true },
        },
      },
    });

    if (!lastAgentMsg?.agent?.shortName) return null;

    return {
      agentShortName: lastAgentMsg.agent.shortName,
      askedQuestion: messageAsksQuestion(lastAgentMsg.content),
    };
  } catch (err) {
    console.warn('[MessageRouter] Failed to fetch last agent context:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// MessageRouter
// ---------------------------------------------------------------------------

export class MessageRouter {
  /**
   * Analyze the user's message and return the shortName of the agent
   * best suited to respond.
   *
   * ROUTING PRIORITY:
   * 1. Explicit topic switch (user clearly wants a different agent)
   * 2. Conversation continuity (last agent asked a question → reply goes back)
   * 3. Keyword intent classification (fallback)
   * 4. Default → BA
   *
   * @param message   Raw user message text.
   * @param projectId Project scope for conversation-aware routing.
   * @returns Agent shortName (e.g. "BA", "SA", "QA").
   */
  async route(message: string, projectId: string): Promise<string> {
    // ── Priority 1: Explicit topic switch ─────────────────────────────
    const explicitSwitch = isExplicitTopicSwitch(message);
    if (explicitSwitch) {
      const agent = this.resolveAgent(explicitSwitch);
      console.log(
        `[MessageRouter] Explicit topic switch → intent: ${explicitSwitch} → agent: ${agent}`,
      );
      return agent;
    }

    // ── Priority 2: Conversation continuity ───────────────────────────
    // If the last agent asked a question (has options or ends with "?"),
    // route back to that agent UNLESS the agent shouldn't be active anymore.
    const lastContext = await getLastAgentContext(projectId);

    if (lastContext?.agentShortName && lastContext.askedQuestion) {
      // Guard: If BA is continuing but BRD already exists and stage has
      // advanced past Business Analysis, redirect task-related messages to TL.
      // BA should not be asking implementation questions during development.
      if (lastContext.agentShortName === 'BA') {
        const shouldRedirect = await this.shouldRedirectFromBA(projectId);
        if (shouldRedirect) {
          console.log(
            `[MessageRouter] BA continuity OVERRIDDEN → BRD exists, redirecting to TL`,
          );
          return 'TL';
        }
      }

      // Guard: ORC is a coordinator, not a conversational agent. If ORC
      // asked a clarifying question and the user responds with a substantive
      // request (not just a short reply), let keyword routing pick the right
      // specialist agent instead of bouncing back to ORC.
      if (lastContext.agentShortName === 'ORC' && !isLikelyReply(message)) {
        console.log(
          `[MessageRouter] ORC continuity OVERRIDDEN → user has substantive request, falling through to keyword routing`,
        );
        // Fall through to keyword routing below
      } else {
        console.log(
          `[MessageRouter] Conversation continuity → replying to ${lastContext.agentShortName}` +
          ` (last msg asked question, user reply is ${message.length} chars)`,
        );
        return lastContext.agentShortName;
      }
    }

    // ── Priority 3: Keyword intent classification ─────────────────────
    const intent = this.classifyIntent(message);
    const agent = this.resolveAgent(intent);

    console.log(
      `[MessageRouter] Keyword routing → intent: ${intent} → agent: ${agent}` +
      ` (message: "${message.substring(0, 60)}...")`,
    );

    return agent;
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

  /**
   * Check if BA should be bypassed because BRD already exists and
   * the project has advanced past the Business Analysis stage.
   * When development is ongoing, task-related messages should go to TL, not BA.
   */
  private async shouldRedirectFromBA(projectId: string): Promise<boolean> {
    try {
      // Check if BRD document exists (any status)
      const brd = await prisma.document.findFirst({
        where: { projectId, type: 'BRD' },
        select: { id: true },
      });
      if (!brd) return false; // No BRD yet — BA should continue

      // Check if Business Analysis stage is completed OR if task cards exist
      const baStage = await prisma.sDLCStage.findFirst({
        where: { projectId, name: 'Business Analysis' },
        select: { status: true },
      });

      // If BA stage is completed, definitely redirect
      if (baStage?.status === 'COMPLETED') return true;

      // Also redirect if task cards already exist (SA already ran)
      const taskCount = await prisma.card.count({
        where: { projectId, type: 'TASK' },
      });
      if (taskCount > 0) return true;

      return false;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const messageRouter = new MessageRouter();
