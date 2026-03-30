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
// ─── ORDERING: Most specific patterns first, broadest last ───────────────
// First-match-wins, so specific multi-word phrases must appear before
// broad single-keyword patterns (BUG-012 fix).
const INTENT_PATTERNS: Array<{ intent: UserIntent; patterns: RegExp[] }> = [
  // ── Tier 1: Highly specific — multi-word phrases, low false-positive ────
  {
    intent: 'approval',
    patterns: [
      /\b(brd\s+(is\s+)?approv|approv.{0,10}brd|proceed\s+to\s+(solution|architecture|design phase)|move\s+to\s+(next|architecture|solution)|advance\s+(the\s+)?phase|phase\s+(complet|done|approv))\b/i,
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
    intent: 'card_management',
    patterns: [
      /\b(create.{0,10}card|add.{0,10}task|new.{0,10}task|backlog|create.{0,10}ticket|add.{0,10}card)\b/,
    ],
  },
  {
    intent: 'state_validation',
    patterns: [
      /\b(card.{0,10}state|state.{0,10}(transition|valid|correct|issue)|task.{0,10}(stuck|block|invalid)|board.{0,10}(check|valid|correct)|pipeline.{0,10}(stuck|block|issue)|workflow.{0,10}(valid|correct|issue))\b/,
    ],
  },

  // ── Tier 2: Specific domain intents — unique keywords per domain ────────
  {
    intent: 'prompt_optimization',
    patterns: [
      /\b(prompt.{0,10}(optimi|improv|efficien|rewrit|engin)|system.{0,10}prompt|agent.{0,10}prompt|fewer.{0,10}round|prompt.{0,10}(token|length|size))\b/,
    ],
  },
  {
    intent: 'llm_optimization',
    patterns: [
      /\b(ai.{0,10}(cost|usage|optimi|efficien)|model.{0,10}(routing|selection|cost|cheaper)|token.{0,10}(budget|optimi|reduc)|llm.{0,10}(routing|cost|optimi)|cheaper.{0,10}model)\b/,
    ],
  },
  {
    intent: 'secrets',
    patterns: [
      /\b(secret|credential|api.?key.{0,10}(manage|stor|rotat|secur|leak)|vault|key.{0,10}(management|rotation|storage)|env.{0,10}(var|secret)|\.env\b|securely.{0,10}(store|manage))\b/,
    ],
  },
  {
    intent: 'integration',
    patterns: [
      /\b(integrat|third.?party|external.{0,10}(api|service)|webhook|connect.{0,10}(stripe|sendgrid|twilio|s3|aws|google|oauth|api)|api.{0,10}(integration|connect))\b/,
    ],
  },
  {
    intent: 'monitoring',
    patterns: [
      /\b(monitor|observ|alert.{0,10}(rule|setup|plan)|uptime|incident|slo\b|sli\b|sla\b|grafana|datadog|pager|on.?call|health.?check|site.?reliab)\b/,
    ],
  },
  {
    intent: 'decision',
    patterns: [
      /\b(decide|decision|compare.{0,10}(option|pros|cons)|pros.{0,10}cons|trade.?off|which.{0,10}(should|better|best)|choose between|recommend.{0,10}(between|which)|vs\b|versus)\b/,
    ],
  },
  {
    intent: 'audit',
    patterns: [
      /\b(audit|quality gate|phase gate|gate check|review.{0,10}(phase|stage|complet)|everything.{0,10}(solid|complete|ready)|nothing.{0,10}miss|check.{0,10}(quality|completeness|readiness))\b/,
    ],
  },
  {
    intent: 'performance',
    patterns: [
      /\b(performance|bottleneck|load time|page speed|core web vital|lighthouse|latency|benchmark|caching strategy|performance budget)\b/,
    ],
  },
  {
    intent: 'bug_report',
    patterns: [
      /\b(bug|error|fix|broken|wrong|issue|crash|failing|exception|doesn'?t work|not working)\b/,
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

  // ── Tier 3: Broad intents — tightened patterns to reduce false matches ──
  {
    intent: 'cost_query',
    patterns: [
      /\b(cost|budget|spending|expensive|price|money|billing|how much)\b/,
      // "token" alone is too broad — require context
      /\btoken.{0,10}(usage|cost|spend|bill)/,
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
      // Tightened: require multi-word phrases, not bare "test" or "check"
      /\b(test suite|test plan|test case|run.{0,3}test|write.{0,3}test|unit test|integration test|e2e test|qa\b|quality assurance|test coverage|regression|automated test)\b/,
    ],
  },
  {
    intent: 'architecture',
    patterns: [
      // Tightened: "api" alone is too broad — require "api design/endpoint/route"
      /\b(architecture|database|tech stack|framework|schema|microservice|scalab|solution design|system design|sdd|hld)\b/,
      /\bapi.{0,10}(design|endpoint|route|structure|gateway)\b/,
    ],
  },

  // ── Tier 4: Broadest — catch-all for generic user messages ──────────────
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
  new_requirement:    'BA',   // Business Analyst — requirements gathering
  approval:           'BA',   // Business Analyst — handles phase transitions and doc approvals
  status_query:       'ORC',  // Orchestrator — project-wide awareness
  bug_report:         'QA',   // QA Engineer — bug triage and tracking
  ui_feedback:        'UX',   // UX Designer — design feedback
  cost_query:         'CA',   // Cost Analyst — budget / token usage
  deployment:         'DO',   // DevOps — deployment pipeline
  testing:            'QA',   // QA Engineer — test strategy
  architecture:       'SA',   // Solutions Architect — technical decisions
  code_generation:    'TL',   // Tech Lead — coordinates development execution
  card_management:    'PM',   // Project Manager — card/task creation and backlog management
  decision:           'DEC',  // Decision Controller — structured decision records
  audit:              'AUD',  // Audit Gatekeeper — quality gate validation
  state_validation:   'STC',  // State Controller — card state consistency
  performance:        'PF',   // Performance Engineer — bottleneck analysis, budgets
  integration:        'IE',   // Integration Engineer — third-party API design
  secrets:            'SM',   // Secrets Manager — credential management architecture
  monitoring:         'SR',   // Site Reliability Engineer — observability, alerts
  llm_optimization:   'LLM',  // LLM Gateway Manager — model routing, cost optimization
  prompt_optimization: 'PRE', // Prompt Engineer — system prompt analysis/improvement
  general:            'BA',   // Business Analyst — default conversational agent
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

  // HIGHEST PRIORITY: Card/task creation — route to PM immediately
  // Must be checked BEFORE approval to catch "approved, create task cards"
  if (/\b(create.{0,10}(card|task|ticket|backlog|sprint)|break.{0,10}(down|into).{0,10}(task|card|sprint)|generate.{0,10}(task|card))\b/i.test(lower)) return 'card_management';

  // Architecture / SDD creation — route to SA
  if (/\b(create.{0,10}(sdd|architecture|system design)|design.{0,10}(database|schema|api)|proceed.{0,10}(architecture|solution|technical))\b/i.test(lower)) return 'architecture';

  // UI/UX design — route to UX
  if (/\b(design.{0,10}(ui|ux|wireframe|mockup|layout|page|screen|interface)|show me the design|wireframe|mockup|ui review|look and feel|color.{0,5}(palette|scheme))\b/i.test(lower)) return 'ui_feedback';

  // Approval with context — route based on what's being approved
  if (/\b(approv|proceed|move forward|advance|next phase|next step|go ahead)\b/i.test(lower)) return 'approval';

  if (/\b(show me the budget|how much (have|did) (we|i) spend|check cost|token usage)\b/.test(lower)) return 'cost_query';
  if (/\b(deploy now|push to production|go live now|release it|scaffold)\b/.test(lower)) return 'deployment';
  if (/\b(run (the )?tests|check quality|qa report)\b/.test(lower)) return 'testing';
  if (/\b(project status|where are we|give me an update|progress report)\b/.test(lower)) return 'status_query';
  if (/\b(i have a new idea|new feature request|i want to add|let me describe|i('d| would) like to build)\b/.test(lower)) return 'new_requirement';
  if (/\b(start (building|coding|developing)|begin (development|coding)|let'?s build|write (the )?code|kick off (development|the build)|ready to (build|code)|open vscode|open vs code)\b/.test(lower)) return 'code_generation';
  if (/\b(next task|continue building|build more|next one|keep building|build the next|continue coding|next card)\b/.test(lower)) return 'code_generation';

  // Decision, audit, performance, integration, secrets, monitoring, LLM/prompt optimization
  if (/\b(help me decide|compare.{0,10}(options|pros|cons)|decision.{0,10}(record|matrix)|trade.?off analysis|which.{0,10}(should|better))\b/.test(lower)) return 'decision';
  if (/\b(audit.{0,10}(phase|gate|quality|what)|quality gate|check.{0,10}(everything|completeness|readiness))\b/.test(lower)) return 'audit';
  if (/\b(card.{0,10}state|check.{0,10}(board|task).{0,10}(state|correct)|task.{0,10}stuck)\b/.test(lower)) return 'state_validation';
  if (/\b(performance.{0,10}(target|budget|analys)|bottleneck|page.{0,10}speed|core web vital|lighthouse)\b/.test(lower)) return 'performance';
  if (/\b(integrat.{0,10}(service|stripe|sendgrid|api)|third.?party.{0,10}(service|api)|webhook.{0,10}(setup|design))\b/.test(lower)) return 'integration';
  if (/\b(manage.{0,10}secret|secret.{0,10}(management|plan|stor)|api.?key.{0,10}(secur|manage|stor|rotat))\b/.test(lower)) return 'secrets';
  if (/\b(set up.{0,10}monitor|observab.{0,10}(plan|setup)|alert.{0,10}(rule|setup|plan)|site goes down|incident.{0,10}(response|plan))\b/.test(lower)) return 'monitoring';
  if (/\b(ai.{0,10}(cost|usage).{0,10}(optim|reduc)|model.{0,10}(cost|routing)|reduce.{0,10}(cost|token|spend)|cheaper.{0,10}model)\b/.test(lower)) return 'llm_optimization';
  if (/\b(prompt.{0,10}(optim|improv|efficien)|agent.{0,10}prompt|fewer.{0,10}round)\b/.test(lower)) return 'prompt_optimization';

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
      // Smart approval: route to the correct next agent based on project phase
      if (explicitSwitch === 'approval') {
        const approvalAgent = await this.resolveApprovalAgent(projectId);
        console.log(
          `[MessageRouter] Smart approval → phase-aware routing → agent: ${approvalAgent}`,
        );
        return approvalAgent;
      }
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

    // ── Priority 3.1: BA redirect guard for keyword routing ──────────
    // If keyword routing points to BA but the project is past requirements
    // (BRD exists, cards exist), redirect to ORC instead. (BUG-008 fix)
    if (agent === 'BA' && intent !== 'approval') {
      const shouldRedirect = await this.shouldRedirectFromBA(projectId);
      if (shouldRedirect) {
        console.log(
          `[MessageRouter] BA keyword route OVERRIDDEN → BRD exists, intent "${intent}" redirected to ORC`,
        );
        return 'ORC';
      }
    }

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
   * For 'approval' intent, dynamically routes based on project phase.
   */
  private resolveAgent(intent: UserIntent, projectId?: string): string {
    return ROUTING_TABLE[intent];
  }

  /**
   * Smart approval routing — determines which agent should handle
   * a phase transition based on which documents already exist.
   * BA→SA (after BRD) → PM (after SDD) → TL (after cards)
   */
  private async resolveApprovalAgent(projectId: string): Promise<string> {
    try {
      const [brd, sdd, cardCount] = await Promise.all([
        prisma.document.findFirst({ where: { projectId, type: 'BRD' }, select: { id: true } }),
        prisma.document.findFirst({ where: { projectId, type: 'SDD' }, select: { id: true } }),
        prisma.card.count({ where: { projectId } }),
      ]);

      // No BRD yet → BA still needs to gather requirements
      if (!brd) return 'BA';
      // BRD exists but no SDD → route to SA for architecture
      if (!sdd) return 'SA';
      // SDD exists but no cards → route to PM for task creation
      if (cardCount === 0) return 'PM';
      // Cards exist → route to TL for implementation planning
      return 'TL';
    } catch {
      return 'BA';
    }
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
