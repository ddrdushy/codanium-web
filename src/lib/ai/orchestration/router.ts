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
import { DEV_AGENTS } from './agent-loop';
import { isVSCodeConnected } from '@/lib/vscode-bridge';

/** Sentinel returned when a dev agent is requested but VS Code is not connected. */
export const VSCODE_REQUIRED_SENTINEL = '__VSCODE_REQUIRED__';

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
    intent: 'approval',
    patterns: [
      /\b(brd\s+(is\s+)?approv|approv.{0,10}brd|proceed\s+to\s+(solution|architecture|design phase)|move\s+to\s+(next|architecture|solution)|advance\s+(the\s+)?phase|phase\s+(complet|done|approv))\b/i,
    ],
  },
  {
    intent: 'architecture',
    patterns: [
      /\b(architecture|database|api|structure|tech stack|framework|schema|microservice|scalab|infra|solution design|system design|sdd|hld)\b/,
    ],
  },
  {
    intent: 'ui_feedback',
    patterns: [
      /\b(look and feel|layout|color|ui\b|ux\b|screen|mockup|wireframe|font|spacing|responsive|visual design)\b/,
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
  approval:        'BA',   // Business Analyst — handles phase transitions and doc approvals
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
 * Matches multiple formats agents might use:
 *   "- **A)** text"    (BA format — dash + bold)
 *   "- A) text"        (plain dash)
 *   "• **B)** text"    (bullet + bold)
 *   "**A)** text"      (bold only, no dash — SA sometimes uses this)
 *   "A) text"          (plain option at start of line)
 */
const HAS_OPTIONS_REGEX = /^[-*•]?\s*\*{0,2}[A-F]\)\*{0,2}\s+/m;

/**
 * Regex that detects if a message contains a question mark on any line.
 * Uses multiline mode so "?" at end of any line matches, not just the last line.
 */
const HAS_QUESTION_REGEX = /\?\s*$/m;

/**
 * Check if a message looks like it's asking the user a question.
 * Detects: option markers (A/B/C), question marks, or common question patterns.
 */
function messageAsksQuestion(content: string): boolean {
  if (HAS_OPTIONS_REGEX.test(content)) return true;
  if (HAS_QUESTION_REGEX.test(content)) return true;
  // Catch messages that ask "select all that apply", "choose one", "which do you prefer" etc.
  if (/\b(select|choose|pick|which|prefer)\b/i.test(content) && /\b(option|apply|one|following)\b/i.test(content)) return true;
  return false;
}

/**
 * Check if the user's reply looks like it's answering a question
 * (short message, or matches an option text pattern).
 * Long messages with explicit intent keywords should use keyword routing.
 */
/**
 * Detect if the user's message indicates pipeline advancement — approval,
 * "proceed", "next phase", "create tasks/cards", "start building".
 * These should override conversation continuity so the pipeline can advance.
 */
function isPipelineAdvancement(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(proceed|approv|next phase|next step|move forward|go ahead|create.*card|create.*task|generate.*task|generate.*card|start (build|develop|implement|cod)|begin (develop|build|implement)|kick off|let'?s (build|go|start|move))\b/i.test(lower);
}

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
    const agent = await this.resolveRoute(message, projectId);

    // ── VS Code Gate ─────────────────────────────────────────────────
    // Development agents require VS Code. If VS Code isn't connected,
    // return a sentinel so the caller can prompt the user.
    if (DEV_AGENTS.has(agent)) {
      const vsConnected = await isVSCodeConnected(projectId);
      if (!vsConnected) {
        console.log(
          `[MessageRouter] ⏸ VS Code not connected — blocking dev agent ${agent}`,
        );
        return VSCODE_REQUIRED_SENTINEL;
      }
    }

    return agent;
  }

  /**
   * Internal routing logic — resolves the target agent WITHOUT gating.
   */
  private async resolveRoute(message: string, projectId: string): Promise<string> {
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
      }
      // Guard: If the user's reply indicates pipeline advancement (approval,
      // proceed, next phase, create tasks/cards), override continuity and
      // let keyword routing pick the correct pipeline agent.
      else if (isPipelineAdvancement(message)) {
        console.log(
          `[MessageRouter] Continuity OVERRIDDEN → user wants to advance pipeline, falling through to keyword routing`,
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
    let agent = this.resolveAgent(intent);

    // ── Priority 3.5: Smart code_generation routing ──────────────────
    // If user wants to build but no cards exist yet, route to PM first
    // so it can create the task backlog before TL tries to assign work.
    if (intent === 'code_generation') {
      try {
        const cardCount = await prisma.card.count({
          where: { projectId },
        });
        if (cardCount === 0) {
          console.log(
            `[MessageRouter] code_generation intent but 0 cards → routing to PM to create backlog`,
          );
          return 'PM';
        }
      } catch (e) {
        console.warn('[MessageRouter] Card count check failed:', e);
      }
    }

    // ── Priority 4: Smarter fallback for 'general' intent ────────────
    // After BRD exists, short/generic messages should NOT default to BA.
    // Route to the last active agent or ORC instead.
    if (intent === 'general') {
      const lastAgent = lastContext?.agentShortName;
      if (lastAgent && lastAgent !== 'BA') {
        // Continue with whatever agent was last active, even if it didn't
        // explicitly ask a question (e.g., SA's message ended without '?')
        console.log(
          `[MessageRouter] General intent → continuing with last active agent ${lastAgent}` +
          ` (message: "${message.substring(0, 60)}...")`,
        );
        return lastAgent;
      }
      // If last agent was BA, check if we should redirect away
      if (lastAgent === 'BA') {
        const shouldRedirect = await this.shouldRedirectFromBA(projectId);
        if (shouldRedirect) {
          console.log(
            `[MessageRouter] General intent → BA no longer active, redirecting to ORC`,
          );
          return 'ORC';
        }
      }
    }

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
   * the project has advanced past the Requirement Gathering phase.
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

      // Check if Requirement Gathering phase is completed OR if task cards exist
      const reqGatheringStage = await prisma.sDLCStage.findFirst({
        where: { projectId, name: { in: ['Requirement Gathering', 'Business Analysis'] } },
        select: { status: true },
      });

      // If Requirement Gathering is completed, definitely redirect
      // (also handles legacy 'Business Analysis' stage name)
      if (reqGatheringStage?.status === 'COMPLETED') return true;

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
