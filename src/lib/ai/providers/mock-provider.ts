// =============================================================================
// AI Team Studio — Mock LLM Provider
// =============================================================================
// Development-mode provider that produces realistic, agent-specific responses
// without requiring any API keys. Every one of the 23 agents has its own voice,
// response templates, and reasoning style so the platform feels real during
// development, demos, and integration testing.
// =============================================================================

import type {
  LLMProvider,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamChunk,
  ProviderConfig,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pause for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Random integer in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Estimate token count (~4 chars per token). */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Simple keyword check — returns true if any keyword appears in the text. */
function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Per-Agent Response Generators
// ---------------------------------------------------------------------------

interface AgentTemplate {
  thinking: string;
  response: string;
}

type AgentGenerator = (userMessage: string) => AgentTemplate;

// ---- ORC — Orchestrator ----
const orcGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['status', 'progress', 'update'])) {
    return {
      thinking:
        'The user wants a status update. I need to check the current workflow state, identify which agents are active, and summarize outstanding work items.',
      response:
        'Here is the current workflow status:\n\n' +
        '- **BA** has completed the requirements analysis and handed off to SA.\n' +
        '- **SA** is finalizing the architecture document — estimated completion in 15 minutes.\n' +
        '- **UX** has two wireframe iterations ready for review.\n' +
        '- **QA** is waiting on the implementation milestone before generating test plans.\n\n' +
        'No blockers have been raised. I will notify you when SA completes the architecture handoff.',
    };
  }
  if (hasKeyword(msg, ['assign', 'delegate', 'route', 'send'])) {
    return {
      thinking:
        'The user wants to delegate a task. I need to determine the best-fit agent based on the task description and current workload.',
      response:
        'I have routed the task to the appropriate agent based on the description and current workload.\n\n' +
        '**Assigned to:** SD (Senior Developer)\n' +
        '**Priority:** High\n' +
        '**Estimated start:** Immediately\n\n' +
        'I will monitor progress and escalate if no update is received within the next cycle.',
    };
  }
  if (hasKeyword(msg, ['plan', 'workflow', 'pipeline'])) {
    return {
      thinking:
        'The user is asking about workflow planning. I should outline the execution pipeline and agent sequence.',
      response:
        'Based on the project scope, I recommend the following execution pipeline:\n\n' +
        '1. **BA** gathers and validates requirements (1-2 cycles)\n' +
        '2. **SA** produces the architecture proposal (1 cycle)\n' +
        '3. **UX** delivers wireframes in parallel with SA (1 cycle)\n' +
        '4. **TL** reviews architecture and approves tech stack\n' +
        '5. **SD + JD** begin implementation (2-4 cycles)\n' +
        '6. **QA + AT** run validation in parallel with development\n' +
        '7. **DO** prepares deployment pipeline\n\n' +
        'I will coordinate handoffs and surface any blockers in real time.',
    };
  }
  return {
    thinking:
      'General orchestration request. I will provide a high-level coordination response and ask if the user wants me to engage specific agents.',
    response:
      'Understood. I have logged the request and will coordinate the relevant agents.\n\n' +
      'Based on the context, I am engaging **BA** for initial analysis and **TL** for technical feasibility. ' +
      'I will provide a consolidated update once both agents have responded.\n\n' +
      'Would you like me to prioritize any particular aspect of this request?',
  };
};

// ---- BA — Business Analyst ----
const baGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['requirements', 'spec', 'user stories', 'brd'])) {
    return {
      thinking:
        'Requirements specification request. I will produce a structured business requirements document.',
      response:
        'I have drafted the business requirements document based on our discussions:\n\n' +
        '[ARTIFACT:requirements.md]' +
        '# Business Requirements Document\n\n' +
        '## 1. Project Overview\n' +
        'This document captures the functional and non-functional requirements gathered from stakeholder discussions.\n\n' +
        '## 2. Functional Requirements\n\n' +
        '### FR-1: User Registration\n' +
        '- Users can create accounts using email and password\n' +
        '- Email verification required before first login\n' +
        '- Password must meet complexity requirements (8+ chars, mixed case, number)\n\n' +
        '### FR-2: User Authentication\n' +
        '- Login with email and password\n' +
        '- "Remember me" option extends session to 30 days\n' +
        '- Forgot password flow with email reset link\n' +
        '- Account lockout after 5 failed attempts (15-minute cooldown)\n\n' +
        '### FR-3: Dashboard\n' +
        '- Overview of all active projects\n' +
        '- Quick-access recent items\n' +
        '- Notification center with unread count\n' +
        '- Real-time status updates for running AI tasks\n\n' +
        '### FR-4: Project Management\n' +
        '- Create, edit, and archive projects\n' +
        '- Invite team members with role-based permissions\n' +
        '- Project-level settings and preferences\n\n' +
        '## 3. Non-Functional Requirements\n\n' +
        '### NFR-1: Performance\n' +
        '- Page load time under 2 seconds (p95)\n' +
        '- API response time under 500ms (p95)\n' +
        '- Support 100 concurrent users\n\n' +
        '### NFR-2: Security\n' +
        '- All data encrypted at rest (AES-256)\n' +
        '- TLS 1.3 for all connections\n' +
        '- OWASP Top 10 compliance\n\n' +
        '### NFR-3: Availability\n' +
        '- 99.9% uptime SLA\n' +
        '- Automated failover for database\n' +
        '- Zero-downtime deployments\n\n' +
        '## 4. Acceptance Criteria\n' +
        '- All functional requirements pass automated testing\n' +
        '- Performance benchmarks met under load testing\n' +
        '- Security audit completed with no critical findings\n' +
        '[/ARTIFACT]\n\n' +
        'The document is ready for stakeholder review. Shall I schedule a walkthrough session?',
    };
  }
  if (hasKeyword(msg, ['requirement', 'feature', 'user story', 'scope'])) {
    return {
      thinking:
        'The user is discussing requirements. I need to break this down into structured questions to fill gaps in the specification before we can proceed.',
      response:
        'Thank you for the initial description. To build a complete requirements specification, I need to clarify several points:\n\n' +
        '1. **Target Users** — Who are the primary and secondary user personas?\n' +
        '2. **Success Criteria** — What measurable outcomes define "done" for this feature?\n' +
        '3. **Data Dependencies** — Does this feature require data from external systems or APIs?\n' +
        '4. **Edge Cases** — Are there known constraints (rate limits, concurrent users, offline support)?\n' +
        '5. **Priority** — Where does this sit relative to the current backlog?\n\n' +
        'Once I have answers, I will draft a formal requirements document and route it to SA for architecture review.',
    };
  }
  if (hasKeyword(msg, ['stakeholder', 'business', 'value', 'roi'])) {
    return {
      thinking:
        'Business-value question. I should frame this in terms of stakeholder impact and measurable outcomes.',
      response:
        'From a business-value perspective, I recommend framing this initiative around three pillars:\n\n' +
        '- **Revenue Impact**: Estimated increase in conversion based on similar features in the market.\n' +
        '- **Operational Efficiency**: Reduction in manual steps for the operations team.\n' +
        '- **User Satisfaction**: Expected improvement in NPS based on user feedback themes.\n\n' +
        'Shall I draft a one-page business case with these metrics for stakeholder review?',
    };
  }
  if (hasKeyword(msg, ['priority', 'backlog', 'rank'])) {
    return {
      thinking:
        'The user wants help prioritizing. I will apply a weighted scoring model and present recommendations.',
      response:
        'I have evaluated the backlog items using a weighted scoring model (Impact x Confidence / Effort):\n\n' +
        '| # | Item | Score |\n|---|------|-------|\n| 1 | Authentication overhaul | 8.4 |\n| 2 | Dashboard redesign | 7.1 |\n| 3 | Notification system | 6.8 |\n| 4 | Export functionality | 5.2 |\n\n' +
        'I recommend tackling items 1 and 2 in the next sprint. Would you like me to elaborate on the scoring?',
    };
  }
  return {
    thinking:
      'General analysis request. I will ask structured clarifying questions to ensure we capture the full picture.',
    response:
      'I want to make sure I fully understand the request before proceeding. A few clarifying questions:\n\n' +
      '- What problem does this solve for the end user?\n' +
      '- Are there existing solutions or workarounds in place today?\n' +
      '- What is the expected timeline for delivery?\n\n' +
      'I will compile the answers into a structured brief and share it with the team.',
  };
};

// ---- SA — Solution Architect ----
const saGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['architecture', 'design', 'schema', 'structure'])) {
    return {
      thinking:
        'Architecture/design request. I will produce a structured system architecture document covering all layers.',
      response:
        'I have designed the system architecture. Here is the full specification:\n\n' +
        '[ARTIFACT:architecture.yaml]' +
        '# System Architecture — High-Level Design\n' +
        'system:\n' +
        '  name: Application Platform\n' +
        '  version: "1.0"\n\n' +
        'layers:\n' +
        '  presentation:\n' +
        '    technology: "Next.js 16 / React 19"\n' +
        '    pattern: "Server Components + Client Islands"\n' +
        '    responsibilities:\n' +
        '      - SSR for initial page loads\n' +
        '      - Client-side interactivity for forms and dashboards\n' +
        '      - Real-time updates via SSE\n\n' +
        '  application:\n' +
        '    technology: "Node.js / TypeScript"\n' +
        '    pattern: "Service Layer + Repository Pattern"\n' +
        '    responsibilities:\n' +
        '      - Business logic orchestration\n' +
        '      - Input validation and transformation\n' +
        '      - Authentication and authorization\n\n' +
        '  data:\n' +
        '    technology: "PostgreSQL 16 / Prisma ORM"\n' +
        '    pattern: "Repository with Unit of Work"\n' +
        '    responsibilities:\n' +
        '      - Data persistence and retrieval\n' +
        '      - Transaction management\n' +
        '      - Migration versioning\n\n' +
        '  infrastructure:\n' +
        '    technology: "Docker / Cloud Provider"\n' +
        '    pattern: "Container Orchestration"\n' +
        '    components:\n' +
        '      - Load balancer (nginx)\n' +
        '      - Application containers (auto-scaling)\n' +
        '      - Database cluster (primary + replica)\n' +
        '      - Redis cache layer\n' +
        '      - Object storage (S3-compatible)\n\n' +
        'communication:\n' +
        '  internal: "Direct function calls within layers"\n' +
        '  external: "REST API with OpenAPI spec"\n' +
        '  async: "Server-Sent Events for real-time updates"\n\n' +
        'security:\n' +
        '  authentication: "JWT with refresh token rotation"\n' +
        '  authorization: "Role-based access control (RBAC)"\n' +
        '  encryption: "AES-256-GCM for secrets at rest"\n' +
        '  transport: "TLS 1.3 minimum"\n' +
        '[/ARTIFACT]\n\n' +
        'This architecture supports horizontal scaling at each layer independently. Shall I drill into any specific layer?',
    };
  }
  if (hasKeyword(msg, ['architecture', 'design', 'system', 'diagram'])) {
    return {
      thinking:
        'Architecture question. I need to propose a high-level component breakdown, discuss communication patterns, and highlight tradeoffs.',
      response:
        'Here is my proposed architecture:\n\n' +
        '```\n' +
        '┌────────────┐     ┌────────────┐     ┌────────────┐\n' +
        '│   Client   │────>│  API GW    │────>│  Services  │\n' +
        '│  (React)   │<────│ (Next.js)  │<────│  (Workers) │\n' +
        '└────────────┘     └────────────┘     └─────┬──────┘\n' +
        '                                            │\n' +
        '                                     ┌──────┴──────┐\n' +
        '                                     │  Supabase   │\n' +
        '                                     │  (Postgres) │\n' +
        '                                     └─────────────┘\n' +
        '```\n\n' +
        '**Key decisions:**\n' +
        '- Edge-first API layer for low latency\n' +
        '- Event-driven workers for async processing\n' +
        '- Row-level security in Supabase for multi-tenant isolation\n\n' +
        '**Tradeoffs:**\n' +
        '- Worker-based approach adds operational complexity but improves scalability.\n' +
        '- Supabase ties us to Postgres, but the built-in auth and real-time features offset that.\n\n' +
        'Shall I produce a detailed component specification?',
    };
  }
  if (hasKeyword(msg, ['database', 'schema', 'data model', 'table'])) {
    return {
      thinking:
        'Data modeling question. I should propose a normalized schema with key relationships and indexing strategy.',
      response:
        'For this feature set, I recommend the following core schema:\n\n' +
        '```sql\n' +
        'CREATE TABLE workspaces (\n' +
        '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n' +
        '  name TEXT NOT NULL,\n' +
        '  owner_id UUID REFERENCES auth.users(id),\n' +
        '  created_at TIMESTAMPTZ DEFAULT now()\n' +
        ');\n\n' +
        'CREATE TABLE projects (\n' +
        '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n' +
        '  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,\n' +
        '  name TEXT NOT NULL,\n' +
        '  status TEXT DEFAULT \'active\'\n' +
        ');\n' +
        '```\n\n' +
        '**Indexing strategy:** Composite index on `(workspace_id, status)` for filtered listing queries.\n\n' +
        '**Partitioning:** Not needed at current scale but we should plan for it on the messages table beyond 10M rows.',
    };
  }
  if (hasKeyword(msg, ['scale', 'performance', 'load', 'traffic'])) {
    return {
      thinking:
        'Scalability concern. I need to address horizontal scaling, caching, and bottleneck analysis.',
      response:
        'To handle the projected load, I recommend a three-tier scaling strategy:\n\n' +
        '1. **Edge Caching** — Static assets and frequently-read API responses cached at the CDN layer.\n' +
        '2. **Horizontal Workers** — Stateless worker processes that auto-scale based on queue depth.\n' +
        '3. **Read Replicas** — Supabase read replicas for query-heavy dashboards.\n\n' +
        'Bottleneck analysis suggests the LLM API calls will be the primary latency contributor. ' +
        'I recommend implementing request coalescing and response caching for repeated queries.',
    };
  }
  if (hasKeyword(msg, ['tradeoff', 'decision', 'compare', 'option'])) {
    return {
      thinking:
        'The user wants a comparison of architectural options. I should present a structured tradeoff analysis.',
      response:
        'Here is a tradeoff analysis of the two primary options:\n\n' +
        '| Criteria | Option A (Monolith) | Option B (Microservices) |\n' +
        '|----------|--------------------|--------------------------|\n' +
        '| Development speed | Faster initially | Slower to set up |\n' +
        '| Scalability | Limited | Independent scaling |\n' +
        '| Operational cost | Lower | Higher |\n' +
        '| Team autonomy | Coupled | Independent |\n\n' +
        '**Recommendation:** Given the current team size (< 8 engineers), Option A with modular boundaries gives us speed now and a clear migration path later.',
    };
  }
  return {
    thinking:
      'General architecture inquiry. I will outline the current system context and ask what area needs deeper analysis.',
    response:
      'From an architecture perspective, the current system follows a modular monolith pattern with clear domain boundaries.\n\n' +
      'The main components are:\n' +
      '- **Presentation Layer** — Next.js with server components\n' +
      '- **Domain Logic** — Service modules per bounded context\n' +
      '- **Data Layer** — Supabase with RLS policies\n' +
      '- **Integration Layer** — Provider adapters for external APIs\n\n' +
      'Which area would you like me to drill into?',
  };
};

// ---- UX — UI/UX Designer ----
const uxGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['wireframe', 'component', 'layout', 'design', 'ui'])) {
    return {
      thinking:
        'UI component/wireframe request. I will produce a component specification with layout, styling, and interaction states.',
      response:
        'I have designed the component specification. Here is the full spec:\n\n' +
        '[ARTIFACT:LoginForm.tsx]' +
        '// UI Component Specification — Login Form\n' +
        '// This spec defines the component structure and styling requirements\n\n' +
        'interface LoginFormProps {\n' +
        '  onSubmit: (email: string, password: string) => Promise<void>;\n' +
        '  onForgotPassword: () => void;\n' +
        '  onSignUp: () => void;\n' +
        '  isLoading?: boolean;\n' +
        '  error?: string;\n' +
        '}\n\n' +
        '/**\n' +
        ' * Login Form Component Specification\n' +
        ' * \n' +
        ' * Layout:\n' +
        ' * ┌──────────────────────────────────┐\n' +
        ' * │         [App Logo]               │\n' +
        ' * │      "Welcome Back"              │\n' +
        ' * │  "Sign in to your account"       │\n' +
        ' * │                                  │\n' +
        ' * │  ┌────────────────────────────┐  │\n' +
        ' * │  │ Email                      │  │\n' +
        ' * │  └────────────────────────────┘  │\n' +
        ' * │  ┌────────────────────────────┐  │\n' +
        ' * │  │ Password          [eye]    │  │\n' +
        ' * │  └────────────────────────────┘  │\n' +
        ' * │                                  │\n' +
        ' * │  [Remember me]  [Forgot pass?]   │\n' +
        ' * │                                  │\n' +
        ' * │  ┌────────────────────────────┐  │\n' +
        ' * │  │      Sign In               │  │\n' +
        ' * │  └────────────────────────────┘  │\n' +
        ' * │                                  │\n' +
        ' * │  ───── or continue with ──────   │\n' +
        ' * │                                  │\n' +
        ' * │  [Google]  [GitHub]  [Apple]     │\n' +
        ' * │                                  │\n' +
        ' * │  Don\'t have an account? Sign up  │\n' +
        ' * └──────────────────────────────────┘\n' +
        ' * \n' +
        ' * Styling:\n' +
        ' * - Dark background (#0a0a0a)\n' +
        ' * - Card: bg-zinc-900, rounded-2xl, border-zinc-800\n' +
        ' * - Inputs: bg-zinc-800/50, focus:ring-amber-500\n' +
        ' * - Button: bg-amber-500, hover:bg-amber-400, text-black\n' +
        ' * - Social buttons: bg-zinc-800, hover:bg-zinc-700\n' +
        ' * \n' +
        ' * States:\n' +
        ' * - Loading: Button shows spinner, inputs disabled\n' +
        ' * - Error: Red banner above form with error message\n' +
        ' * - Success: Redirect to /projects\n' +
        ' */\n\n' +
        'export default function LoginForm({\n' +
        '  onSubmit,\n' +
        '  onForgotPassword,\n' +
        '  onSignUp,\n' +
        '  isLoading = false,\n' +
        '  error,\n' +
        '}: LoginFormProps) {\n' +
        '  // Implementation uses:\n' +
        '  // - React Hook Form for validation\n' +
        '  // - Framer Motion for entrance animation\n' +
        '  // - Tailwind CSS for styling\n' +
        '  // - Lucide icons for eye toggle and social icons\n' +
        '  return null; // Placeholder for implementation\n' +
        '}\n' +
        '[/ARTIFACT]\n\n' +
        'The spec includes layout, styling tokens, and all interaction states. Ready for SD to implement.',
    };
  }
  if (hasKeyword(msg, ['wireframe', 'layout', 'mockup', 'screen'])) {
    return {
      thinking:
        'The user wants visual design guidance. I should describe the layout structure, spacing, and component hierarchy.',
      response:
        'Here is the proposed layout for this screen:\n\n' +
        '```\n' +
        '┌─────────────────────────────────────────┐\n' +
        '│  Header — Logo / Nav / User Avatar      │\n' +
        '├───────────┬─────────────────────────────┤\n' +
        '│           │                             │\n' +
        '│  Sidebar  │   Main Content Area         │\n' +
        '│  (240px)  │   - Card grid (3 cols)      │\n' +
        '│           │   - Pagination at bottom    │\n' +
        '│           │                             │\n' +
        '├───────────┴─────────────────────────────┤\n' +
        '│  Footer — Status bar                    │\n' +
        '└─────────────────────────────────────────┘\n' +
        '```\n\n' +
        '**Design tokens:** 8px grid, 16px base padding, `Inter` font family, `zinc-900` surface on dark mode.\n\n' +
        'The sidebar collapses to an icon rail at breakpoints below 768px.',
    };
  }
  if (hasKeyword(msg, ['flow', 'journey', 'navigation', 'path'])) {
    return {
      thinking:
        'User flow question. I should map the step-by-step journey and highlight decision points.',
      response:
        'The user flow for this feature follows these steps:\n\n' +
        '1. **Entry Point** — User clicks "New Project" from the dashboard.\n' +
        '2. **Configuration** — Multi-step form: Name > Template > Team.\n' +
        '3. **Confirmation** — Summary card with "Create" CTA.\n' +
        '4. **Success State** — Redirect to the new project workspace with onboarding tooltip.\n\n' +
        '**Error path:** Validation errors appear inline. Network failures show a toast with retry.\n\n' +
        'The entire flow should complete in under 30 seconds for a returning user.',
    };
  }
  if (hasKeyword(msg, ['color', 'theme', 'dark', 'light', 'palette'])) {
    return {
      thinking:
        'Design system color question. I should reference the existing palette and suggest accessible combinations.',
      response:
        'The color system follows a semantic token approach:\n\n' +
        '| Token | Light | Dark |\n' +
        '|-------|-------|------|\n' +
        '| `surface` | `#FFFFFF` | `#18181B` |\n' +
        '| `surface-raised` | `#F4F4F5` | `#27272A` |\n' +
        '| `primary` | `#6366F1` | `#818CF8` |\n' +
        '| `destructive` | `#EF4444` | `#F87171` |\n' +
        '| `text-primary` | `#18181B` | `#FAFAFA` |\n\n' +
        'All combinations meet WCAG AA contrast requirements. The primary accent shifts slightly in dark mode to maintain a 4.5:1 ratio against the dark surface.',
    };
  }
  return {
    thinking:
      'General UX question. I will provide design principles and ask for specifics.',
    response:
      'From a UX perspective, I recommend keeping the interaction pattern consistent with the existing design system:\n\n' +
      '- **Progressive disclosure** — Show essential info first, details on demand.\n' +
      '- **Immediate feedback** — Every user action gets a visual response within 100ms.\n' +
      '- **Forgiving design** — Undo support for destructive actions.\n\n' +
      'Could you share which specific screen or component you would like me to focus on?',
  };
};

// ---- PM — Product Manager ----
const pmGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['roadmap', 'timeline', 'milestone', 'quarter'])) {
    return {
      thinking:
        'Roadmap question. I should present a phased plan with clear milestones and dependencies.',
      response:
        'Here is the proposed product roadmap:\n\n' +
        '**Q1 — Foundation**\n' +
        '- Core platform infrastructure\n' +
        '- Authentication and workspace management\n' +
        '- Mock provider for development\n\n' +
        '**Q2 — Collaboration**\n' +
        '- Multi-agent conversation UI\n' +
        '- Real-time collaboration features\n' +
        '- BYOM provider integration\n\n' +
        '**Q3 — Scale**\n' +
        '- Enterprise SSO\n' +
        '- Usage analytics and billing\n' +
        '- Performance optimization\n\n' +
        'Each milestone has a two-week buffer for iteration based on user feedback.',
    };
  }
  if (hasKeyword(msg, ['priority', 'scope', 'cut', 'mvp'])) {
    return {
      thinking:
        'Scoping question. I need to differentiate must-haves from nice-to-haves and recommend an MVP boundary.',
      response:
        'For the MVP, I recommend scoping to the following:\n\n' +
        '**Must Have (P0):**\n' +
        '- Agent conversation interface\n' +
        '- Project creation and management\n' +
        '- Mock provider responses\n\n' +
        '**Should Have (P1):**\n' +
        '- Real LLM provider integration\n' +
        '- Agent configuration panel\n\n' +
        '**Nice to Have (P2):**\n' +
        '- Custom agent creation\n' +
        '- Analytics dashboard\n\n' +
        'This scoping lets us ship in 4 weeks and gather real user feedback before investing in P1 and P2.',
    };
  }
  if (hasKeyword(msg, ['metric', 'kpi', 'measure', 'success'])) {
    return {
      thinking:
        'Success metrics request. I should define quantifiable KPIs tied to business outcomes.',
      response:
        'I recommend tracking these KPIs post-launch:\n\n' +
        '1. **Activation Rate** — % of sign-ups who complete their first agent conversation (target: 60%)\n' +
        '2. **Weekly Active Projects** — Number of projects with activity in the last 7 days\n' +
        '3. **Agent Utilization** — Average number of distinct agents used per session\n' +
        '4. **Time to Value** — Minutes from sign-up to first meaningful output (target: < 5 min)\n' +
        '5. **Retention** — Week-over-week return rate (target: 40% at week 4)\n\n' +
        'I will set up a tracking dashboard once we finalize the analytics integration.',
    };
  }
  return {
    thinking:
      'General product question. I will frame my response around user value and strategic alignment.',
    response:
      'From a product perspective, this aligns well with our current strategic goals.\n\n' +
      'Key considerations:\n' +
      '- **User Value** — Does this directly reduce friction in the user workflow?\n' +
      '- **Strategic Fit** — Does it strengthen our differentiation against competitors?\n' +
      '- **Effort/Impact** — Is the engineering investment justified by the expected outcome?\n\n' +
      'I would like to schedule a brief alignment check with the team before we commit resources. Shall I draft the agenda?',
  };
};

// ---- TL — Tech Lead ----
const tlGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['review', 'approach', 'implementation', 'code'])) {
    return {
      thinking:
        'Technical review request. I need to evaluate the approach for correctness, maintainability, and alignment with our standards.',
      response:
        'I have reviewed the proposed approach. Here are my observations:\n\n' +
        '**Strengths:**\n' +
        '- Clean separation of concerns between the provider layer and the UI.\n' +
        '- Good use of TypeScript interfaces for compile-time safety.\n' +
        '- Streaming implementation follows the AsyncIterable pattern correctly.\n\n' +
        '**Suggestions:**\n' +
        '- Add explicit error boundaries around the LLM call path — a failed API call should not crash the conversation UI.\n' +
        '- Consider adding a retry wrapper with exponential backoff for transient failures.\n' +
        '- The token estimation logic should be extracted into a shared utility.\n\n' +
        'Overall, this is solid work. Approved to proceed with the suggestions incorporated.',
    };
  }
  if (hasKeyword(msg, ['stack', 'technology', 'framework', 'library'])) {
    return {
      thinking:
        'Tech stack question. I should justify choices based on team skills, ecosystem maturity, and project requirements.',
      response:
        'Our recommended tech stack:\n\n' +
        '- **Framework:** Next.js 14 (App Router) — SSR, RSC, built-in API routes\n' +
        '- **Styling:** Tailwind CSS + Radix UI primitives — accessible, composable\n' +
        '- **State:** Zustand for client state, React Query for server state\n' +
        '- **Database:** Supabase (Postgres + Auth + Realtime)\n' +
        '- **Testing:** Vitest + Playwright\n' +
        '- **CI/CD:** GitHub Actions\n\n' +
        'This stack balances developer experience with production readiness. The team has existing expertise in all of these.',
    };
  }
  if (hasKeyword(msg, ['decision', 'adr', 'record'])) {
    return {
      thinking:
        'Architecture Decision Record request. I should format a proper ADR with context, decision, and consequences.',
      response:
        '## ADR-007: Mock Provider as Default Development Backend\n\n' +
        '**Status:** Accepted\n\n' +
        '**Context:** Developers need to build and test the agent conversation UI without requiring live LLM API keys, which are expensive and rate-limited.\n\n' +
        '**Decision:** Implement a `MockProvider` that returns realistic, agent-specific responses with simulated latency and token counts.\n\n' +
        '**Consequences:**\n' +
        '- (+) Zero-cost development and testing\n' +
        '- (+) Deterministic responses for integration tests\n' +
        '- (-) Mock responses may diverge from real LLM behavior over time\n' +
        '- (Mitigation) Periodic validation against live providers in staging',
    };
  }
  return {
    thinking:
      'General technical question. I will provide a concise technical opinion and offer to go deeper.',
    response:
      'From a technical standpoint, this is feasible and aligns with our current architecture.\n\n' +
      'I recommend we:\n' +
      '1. Create a spike branch to validate the integration path (1-2 days).\n' +
      '2. Review the spike as a team before committing to the full implementation.\n' +
      '3. Document any architectural decisions as ADRs.\n\n' +
      'Want me to assign the spike and set up the review?',
  };
};

// ---- JD — Junior Developer ----
const jdGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['implement', 'build', 'code', 'create', 'write'])) {
    return {
      thinking:
        'Implementation task. I will write clean, well-commented code and flag any areas where I need guidance.',
      response:
        'I have implemented the feature. Here is what I built:\n\n' +
        '[ARTIFACT:handler.ts]' +
        '// Handler for processing user requests\n' +
        '// Each function handles a specific operation type\n\n' +
        'interface RequestPayload {\n' +
        '  action: string;\n' +
        '  data: Record<string, unknown>;\n' +
        '}\n\n' +
        'interface ResponsePayload {\n' +
        '  success: boolean;\n' +
        '  message: string;\n' +
        '  data?: unknown;\n' +
        '}\n\n' +
        '// Main handler function — processes incoming requests\n' +
        'export async function handleRequest(payload: RequestPayload): Promise<ResponsePayload> {\n' +
        '  // Validate the incoming payload\n' +
        '  if (!payload.action) {\n' +
        '    return { success: false, message: \'Action is required\' };\n' +
        '  }\n\n' +
        '  try {\n' +
        '    // Route to the appropriate handler based on action type\n' +
        '    switch (payload.action) {\n' +
        '      case \'create\':\n' +
        '        return await handleCreate(payload.data);\n' +
        '      case \'update\':\n' +
        '        return await handleUpdate(payload.data);\n' +
        '      case \'delete\':\n' +
        '        return await handleDelete(payload.data);\n' +
        '      default:\n' +
        '        return { success: false, message: `Unknown action: ${payload.action}` };\n' +
        '    }\n' +
        '  } catch (error) {\n' +
        '    // Always catch errors to prevent unhandled rejections\n' +
        '    console.error(\'Handler error:\', error);\n' +
        '    return { success: false, message: \'Internal server error\' };\n' +
        '  }\n' +
        '}\n\n' +
        '// Handle create operations\n' +
        'async function handleCreate(data: Record<string, unknown>): Promise<ResponsePayload> {\n' +
        '  // TODO: Implement create logic\n' +
        '  return { success: true, message: \'Created successfully\', data };\n' +
        '}\n\n' +
        '// Handle update operations\n' +
        'async function handleUpdate(data: Record<string, unknown>): Promise<ResponsePayload> {\n' +
        '  // TODO: Implement update logic\n' +
        '  return { success: true, message: \'Updated successfully\', data };\n' +
        '}\n\n' +
        '// Handle delete operations\n' +
        'async function handleDelete(data: Record<string, unknown>): Promise<ResponsePayload> {\n' +
        '  // TODO: Implement delete logic\n' +
        '  return { success: true, message: \'Deleted successfully\' };\n' +
        '}\n' +
        '[/ARTIFACT]\n\n' +
        'I added comments throughout the code to make it easy to follow. The TODO markers show where the actual business logic needs to go. Could someone review this before I continue?',
    };
  }
  if (hasKeyword(msg, ['error', 'bug', 'fix', 'issue'])) {
    return {
      thinking:
        'Bug report. I should describe what I found, what I tried, and where I am stuck.',
      response:
        'I investigated the issue and here is what I found:\n\n' +
        '**Root cause:** The state was being updated after the component unmounted, causing a React warning and a stale closure over the callback.\n\n' +
        '**What I tried:**\n' +
        '1. Added a cleanup function in the `useEffect` to cancel the pending operation.\n' +
        '2. Wrapped the state setter in an `isMounted` check.\n\n' +
        'Option 1 is cleaner. I have pushed the fix to the branch. Could someone from the team review it before I merge?',
    };
  }
  if (hasKeyword(msg, ['test', 'spec', 'coverage'])) {
    return {
      thinking:
        'Testing task. I should report what tests I have written and what coverage looks like.',
      response:
        'I have added tests for the component:\n\n' +
        '```\n' +
        'PASS  src/components/AgentCard.test.tsx\n' +
        '  AgentCard\n' +
        '    renders agent name and role           (12ms)\n' +
        '    shows online indicator when active     (8ms)\n' +
        '    calls onSelect when clicked            (5ms)\n' +
        '    displays fallback avatar               (6ms)\n' +
        '```\n\n' +
        'Coverage for this component is at 94%. The untested path is the drag-and-drop handler, which I am still figuring out how to simulate in Vitest.',
    };
  }
  return {
    thinking:
      'General dev task. I will confirm understanding and share my plan.',
    response:
      'Got it. I will work on this now. My plan:\n\n' +
      '1. Read through the existing code to understand the patterns.\n' +
      '2. Implement the changes following the established conventions.\n' +
      '3. Write tests for the new functionality.\n' +
      '4. Push to a feature branch and request a review.\n\n' +
      'I will reach out if I hit any blockers. Estimated completion: end of this cycle.',
  };
};

// ---- SD — Senior Developer ----
const sdGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['implement', 'build', 'code', 'create', 'write'])) {
    return {
      thinking: 'Implementation request. I will design a clean solution following best practices and produce the code.',
      response:
        'I have implemented the requested functionality. Here is the code:\n\n' +
        'Key design decisions:\n' +
        '- Used the adapter pattern for provider abstraction\n' +
        '- Added comprehensive error handling with typed errors\n' +
        '- Included JSDoc comments for public API methods\n\n' +
        '[ARTIFACT:service.ts]' +
        'import { prisma } from \'@/lib/prisma\';\n\n' +
        'export interface ServiceConfig {\n' +
        '  retryAttempts: number;\n' +
        '  timeoutMs: number;\n' +
        '}\n\n' +
        'export class AppService {\n' +
        '  private config: ServiceConfig;\n\n' +
        '  constructor(config: Partial<ServiceConfig> = {}) {\n' +
        '    this.config = {\n' +
        '      retryAttempts: config.retryAttempts ?? 3,\n' +
        '      timeoutMs: config.timeoutMs ?? 5000,\n' +
        '    };\n' +
        '  }\n\n' +
        '  async execute<T>(operation: () => Promise<T>): Promise<T> {\n' +
        '    let lastError: Error | undefined;\n' +
        '    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {\n' +
        '      try {\n' +
        '        return await operation();\n' +
        '      } catch (err) {\n' +
        '        lastError = err instanceof Error ? err : new Error(String(err));\n' +
        '        if (attempt < this.config.retryAttempts - 1) {\n' +
        '          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));\n' +
        '        }\n' +
        '      }\n' +
        '    }\n' +
        '    throw lastError ?? new Error(\'All retry attempts failed\');\n' +
        '  }\n' +
        '}\n' +
        '[/ARTIFACT]\n\n' +
        'The service is ready for integration. Shall I also create the corresponding tests?',
    };
  }
  if (hasKeyword(msg, ['review', 'pr', 'pull request', 'code review'])) {
    return {
      thinking:
        'Code review request. I need to evaluate code quality, patterns, error handling, and provide actionable feedback.',
      response:
        'I have reviewed the changes. Overall quality is good. A few items to address:\n\n' +
        '**Must fix:**\n' +
        '- Line 47: The `catch` block swallows the error silently. At minimum, log it. Preferably, surface it to the user via a toast.\n' +
        '- Line 112: This `any` cast defeats the purpose of TypeScript. Let us define a proper type.\n\n' +
        '**Suggestions:**\n' +
        '- Consider extracting the retry logic into a `withRetry()` utility — we use the same pattern in three other files.\n' +
        '- The component is approaching 200 lines. It might be time to split the form section into its own component.\n\n' +
        '**Positive notes:**\n' +
        '- Good use of the `useCallback` for the debounced handler.\n' +
        '- Test coverage is thorough.\n\n' +
        'Address the must-fix items and this is good to merge.',
    };
  }
  if (hasKeyword(msg, ['refactor', 'clean', 'improve', 'optimize'])) {
    return {
      thinking:
        'Refactoring task. I need to identify improvement areas and propose concrete changes with rationale.',
      response:
        'I see several refactoring opportunities:\n\n' +
        '1. **Extract shared hooks** — `useAgentConnection` and `useStreamResponse` are duplicated across three components. Moving them to `src/hooks/` will reduce duplication by ~120 lines.\n\n' +
        '2. **Consolidate API calls** — The provider integration has three separate fetch wrappers. A single `apiClient` with interceptors would standardize error handling and auth header injection.\n\n' +
        '3. **Type narrowing** — Several union types use string literals that could be narrowed with discriminated unions, improving IDE autocompletion.\n\n' +
        'I estimate this refactoring at 1.5 days. None of the changes alter external behavior, so existing tests serve as our safety net.',
    };
  }
  if (hasKeyword(msg, ['pattern', 'best practice', 'convention'])) {
    return {
      thinking:
        'Best practices question. I should share concrete patterns with code examples.',
      response:
        'Here are the patterns I recommend for this codebase:\n\n' +
        '**Error handling:** Use a `Result<T, E>` type instead of try/catch for expected failures:\n```typescript\ntype Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };\n```\n\n' +
        '**Component structure:** Follow the "barrel" pattern — each feature folder exports a single public API via `index.ts`.\n\n' +
        '**Async state:** Use React Query for all server state. Local UI state stays in Zustand. Never mix the two.\n\n' +
        'These conventions keep the codebase consistent as the team scales.',
    };
  }
  return {
    thinking:
      'General senior dev task. I will provide technical guidance and a recommended approach.',
    response:
      'Let me share my recommended approach for this:\n\n' +
      '- Start with the interface definition — agree on the contract before writing implementation.\n' +
      '- Use the adapter pattern so the implementation can be swapped without changing consumers.\n' +
      '- Write the tests first (or at least the test signatures) to clarify expected behavior.\n\n' +
      'I am available for pair programming if you want to work through the tricky parts together.',
  };
};

// ---- QA — QA Engineer ----
const qaGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['test', 'spec', 'write test', 'coverage'])) {
    return {
      thinking:
        'Test writing request. I will produce comprehensive test cases with proper setup, assertions, and edge case coverage.',
      response:
        'I have written the test suite. Here are the tests:\n\n' +
        '[ARTIFACT:auth.test.ts]' +
        'import { describe, it, expect, beforeEach, vi } from \'vitest\';\n\n' +
        'describe(\'AuthService\', () => {\n' +
        '  let authService: AuthService;\n\n' +
        '  beforeEach(() => {\n' +
        '    authService = new AuthService({ jwtSecret: \'test-secret\' });\n' +
        '    vi.clearAllMocks();\n' +
        '  });\n\n' +
        '  describe(\'login\', () => {\n' +
        '    it(\'should return a valid token for correct credentials\', async () => {\n' +
        '      const result = await authService.login(\'user@test.com\', \'password123\');\n' +
        '      expect(result.success).toBe(true);\n' +
        '      expect(result.token).toBeDefined();\n' +
        '      expect(typeof result.token).toBe(\'string\');\n' +
        '    });\n\n' +
        '    it(\'should reject invalid credentials\', async () => {\n' +
        '      const result = await authService.login(\'user@test.com\', \'wrong\');\n' +
        '      expect(result.success).toBe(false);\n' +
        '      expect(result.error).toBe(\'Invalid credentials\');\n' +
        '    });\n\n' +
        '    it(\'should rate limit after 5 failed attempts\', async () => {\n' +
        '      for (let i = 0; i < 5; i++) {\n' +
        '        await authService.login(\'user@test.com\', \'wrong\');\n' +
        '      }\n' +
        '      const result = await authService.login(\'user@test.com\', \'password123\');\n' +
        '      expect(result.success).toBe(false);\n' +
        '      expect(result.error).toContain(\'rate limit\');\n' +
        '    });\n' +
        '  });\n\n' +
        '  describe(\'validateToken\', () => {\n' +
        '    it(\'should validate a valid token\', async () => {\n' +
        '      const { token } = await authService.login(\'user@test.com\', \'password123\');\n' +
        '      const valid = await authService.validateToken(token!);\n' +
        '      expect(valid).toBe(true);\n' +
        '    });\n\n' +
        '    it(\'should reject an expired token\', async () => {\n' +
        '      const expiredToken = \'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired\';\n' +
        '      const valid = await authService.validateToken(expiredToken);\n' +
        '      expect(valid).toBe(false);\n' +
        '    });\n' +
        '  });\n' +
        '});\n' +
        '[/ARTIFACT]\n\n' +
        'The tests cover the happy path, error cases, and rate limiting. Want me to add more edge cases or integration tests?',
    };
  }
  if (hasKeyword(msg, ['test plan', 'strategy', 'coverage'])) {
    return {
      thinking:
        'Test planning request. I need to outline test categories, coverage targets, and execution approach.',
      response:
        'Here is the test plan for this feature:\n\n' +
        '**Unit Tests (Target: 90% coverage)**\n' +
        '- Provider interface validation\n' +
        '- Token estimation accuracy\n' +
        '- Response template selection logic\n\n' +
        '**Integration Tests**\n' +
        '- End-to-end conversation flow with mock provider\n' +
        '- Provider switching during active conversation\n' +
        '- Error recovery on provider failure\n\n' +
        '**Regression Suite**\n' +
        '- Existing agent interactions remain unaffected\n' +
        '- Streaming responses render correctly in all supported browsers\n\n' +
        'Estimated test authoring time: 3 days. I will begin once the implementation reaches feature-complete.',
    };
  }
  if (hasKeyword(msg, ['bug', 'defect', 'issue', 'broken'])) {
    return {
      thinking:
        'Bug investigation. I need to provide a structured bug report with reproduction steps.',
      response:
        '## Bug Report: BUG-2847\n\n' +
        '**Severity:** Medium\n' +
        '**Component:** Agent Conversation Panel\n\n' +
        '**Steps to Reproduce:**\n' +
        '1. Open a project with the mock provider enabled.\n' +
        '2. Start a conversation with the BA agent.\n' +
        '3. Send a message, then immediately switch to the SA agent.\n' +
        '4. Observe that the BA response appears under the SA heading.\n\n' +
        '**Expected:** Each agent\'s response appears under its own section.\n' +
        '**Actual:** Response is attributed to the wrong agent.\n\n' +
        '**Root Cause Hypothesis:** The agent context is not reset when the active agent changes mid-stream.\n\n' +
        'Assigning to SD for investigation.',
    };
  }
  if (hasKeyword(msg, ['quality', 'check', 'validate', 'verify'])) {
    return {
      thinking:
        'Quality validation request. I should run through the quality checklist and report findings.',
      response:
        'Quality check results:\n\n' +
        '- [x] All unit tests passing (147/147)\n' +
        '- [x] No TypeScript errors (`tsc --noEmit` clean)\n' +
        '- [x] No ESLint warnings in changed files\n' +
        '- [x] Bundle size within budget (+2.1kB, limit is +10kB)\n' +
        '- [x] Accessibility audit passed (no new violations)\n' +
        '- [ ] Performance benchmark pending (waiting on staging deploy)\n\n' +
        'Recommendation: Approved for staging deployment. Performance benchmark to follow.',
    };
  }
  return {
    thinking:
      'General QA question. I will outline my testing approach and ask for specifics.',
    response:
      'I will approach this with a risk-based testing strategy:\n\n' +
      '1. Identify the highest-risk paths (data integrity, authentication, payment).\n' +
      '2. Write automated tests for those paths first.\n' +
      '3. Manual exploratory testing for edge cases and UX flows.\n\n' +
      'Could you clarify which areas you consider highest risk for this feature?',
  };
};

// ---- AT — Automation Test Engineer ----
const atGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['automate', 'e2e', 'playwright', 'integration'])) {
    return {
      thinking:
        'E2E test automation request. I will write Playwright tests covering the critical user flows.',
      response:
        'I have written the end-to-end tests using Playwright. Here is the test file:\n\n' +
        '[ARTIFACT:login.e2e.ts]' +
        'import { test, expect } from \'@playwright/test\';\n\n' +
        'test.describe(\'Login Flow\', () => {\n' +
        '  test.beforeEach(async ({ page }) => {\n' +
        '    await page.goto(\'/login\');\n' +
        '  });\n\n' +
        '  test(\'should display login form\', async ({ page }) => {\n' +
        '    await expect(page.getByRole(\'heading\', { name: \'Sign In\' })).toBeVisible();\n' +
        '    await expect(page.getByLabel(\'Email\')).toBeVisible();\n' +
        '    await expect(page.getByLabel(\'Password\')).toBeVisible();\n' +
        '    await expect(page.getByRole(\'button\', { name: \'Sign In\' })).toBeVisible();\n' +
        '  });\n\n' +
        '  test(\'should login with valid credentials\', async ({ page }) => {\n' +
        '    await page.getByLabel(\'Email\').fill(\'user@demo.com\');\n' +
        '    await page.getByLabel(\'Password\').fill(\'password123\');\n' +
        '    await page.getByRole(\'button\', { name: \'Sign In\' }).click();\n' +
        '    await expect(page).toHaveURL(\'/projects\');\n' +
        '    await expect(page.getByText(\'Welcome back\')).toBeVisible();\n' +
        '  });\n\n' +
        '  test(\'should show error for invalid credentials\', async ({ page }) => {\n' +
        '    await page.getByLabel(\'Email\').fill(\'user@demo.com\');\n' +
        '    await page.getByLabel(\'Password\').fill(\'wrongpassword\');\n' +
        '    await page.getByRole(\'button\', { name: \'Sign In\' }).click();\n' +
        '    await expect(page.getByText(\'Invalid email or password\')).toBeVisible();\n' +
        '  });\n\n' +
        '  test(\'should navigate to signup page\', async ({ page }) => {\n' +
        '    await page.getByRole(\'link\', { name: \'Create an account\' }).click();\n' +
        '    await expect(page).toHaveURL(\'/signup\');\n' +
        '  });\n' +
        '});\n' +
        '[/ARTIFACT]\n\n' +
        'The tests follow the Page Object pattern and use Playwright best practices (role-based selectors, no arbitrary waits). Shall I add more flows?',
    };
  }
  if (hasKeyword(msg, ['automate', 'script', 'playwright', 'cypress', 'e2e'])) {
    return {
      thinking:
        'Test automation request. I should recommend the framework, describe the test structure, and provide a sample.',
      response:
        'I recommend using Playwright for end-to-end test automation. Here is the proposed structure:\n\n' +
        '```\n' +
        'tests/\n' +
        '  e2e/\n' +
        '    auth.spec.ts          — Login, logout, session expiry\n' +
        '    conversation.spec.ts  — Agent messaging flow\n' +
        '    project.spec.ts       — CRUD operations on projects\n' +
        '    provider.spec.ts      — Provider switching and config\n' +
        '```\n\n' +
        'Each spec follows the Page Object Model pattern for maintainability. I will also configure parallel execution across Chromium, Firefox, and WebKit.\n\n' +
        'Estimated setup time: 2 days for the framework, then 1 day per spec file.',
    };
  }
  if (hasKeyword(msg, ['ci', 'pipeline', 'continuous', 'github actions'])) {
    return {
      thinking:
        'CI integration question. I need to describe how automated tests fit into the pipeline.',
      response:
        'Here is the CI test integration plan:\n\n' +
        '**On Pull Request:**\n' +
        '- Unit tests (Vitest) — ~30s\n' +
        '- Lint + type check — ~15s\n' +
        '- E2E smoke suite (3 critical paths) — ~2 min\n\n' +
        '**On Merge to Main:**\n' +
        '- Full E2E suite across 3 browsers — ~8 min\n' +
        '- Visual regression tests — ~3 min\n' +
        '- Performance benchmarks — ~2 min\n\n' +
        'All results post to the PR as a status check. Failures block merge.',
    };
  }
  if (hasKeyword(msg, ['flaky', 'reliability', 'stable'])) {
    return {
      thinking:
        'Test reliability concern. I need to address common flakiness causes and mitigation strategies.',
      response:
        'To address test flakiness, I have implemented these strategies:\n\n' +
        '1. **Explicit waits** — Replace `sleep()` with `waitForSelector()` and `waitForResponse()`. No arbitrary timeouts.\n' +
        '2. **Test isolation** — Each test creates its own data fixtures and tears them down after. No shared state.\n' +
        '3. **Retry policy** — Flaky tests are automatically retried once in CI. If they fail twice, they are flagged for investigation.\n' +
        '4. **Network mocking** — External API calls are intercepted with `page.route()` so tests are not affected by third-party downtime.\n\n' +
        'Current flake rate: 0.3% (target: < 1%).',
    };
  }
  return {
    thinking:
      'General automation question. I will outline the current automation coverage and next steps.',
    response:
      'Current test automation status:\n\n' +
      '- **Unit test coverage:** 87% (target: 90%)\n' +
      '- **E2E test coverage:** 12 critical paths automated\n' +
      '- **Visual regression:** Enabled for 5 key pages\n\n' +
      'Next priorities:\n' +
      '1. Automate the new agent conversation flow.\n' +
      '2. Add API contract tests for the provider layer.\n\n' +
      'Which area would you like me to focus on first?',
  };
};

// ---- PF — Performance Engineer ----
const pfGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['benchmark', 'metric', 'measure', 'latency'])) {
    return {
      thinking:
        'Performance measurement request. I need to present current metrics and identify bottlenecks.',
      response:
        'Here are the latest performance benchmarks:\n\n' +
        '| Metric | Current | Target | Status |\n' +
        '|--------|---------|--------|--------|\n' +
        '| First Contentful Paint | 1.2s | < 1.5s | Pass |\n' +
        '| Largest Contentful Paint | 2.4s | < 2.5s | Pass |\n' +
        '| Time to Interactive | 3.1s | < 3.0s | **Needs work** |\n' +
        '| Cumulative Layout Shift | 0.02 | < 0.1 | Pass |\n' +
        '| API p95 latency | 340ms | < 500ms | Pass |\n\n' +
        'The TTI regression is caused by a synchronous hydration of the agent panel. I recommend lazy-loading it behind a dynamic import.',
    };
  }
  if (hasKeyword(msg, ['optimize', 'slow', 'fast', 'speed'])) {
    return {
      thinking:
        'Optimization request. I should identify the top bottlenecks and propose targeted fixes.',
      response:
        'I have profiled the application and identified three optimization opportunities:\n\n' +
        '1. **Bundle splitting** — The main chunk is 285kB. Splitting the provider adapters into separate chunks saves ~60kB on initial load.\n' +
        '2. **Image optimization** — Agent avatars are served as unoptimized PNGs. Converting to WebP with `next/image` saves ~40% in transfer size.\n' +
        '3. **Memoization** — The agent list component re-renders on every message. Adding `React.memo` with a shallow comparison cuts render time by 70%.\n\n' +
        'Combined impact: estimated 400ms improvement in Time to Interactive.',
    };
  }
  if (hasKeyword(msg, ['load test', 'stress', 'concurrent', 'capacity'])) {
    return {
      thinking:
        'Load testing question. I should present the testing approach and capacity planning data.',
      response:
        'Load test results (k6, 5-minute sustained run):\n\n' +
        '| Concurrent Users | Avg Response Time | p99 Response Time | Error Rate |\n' +
        '|-----------------|-------------------|-------------------|------------|\n' +
        '| 50 | 120ms | 280ms | 0% |\n' +
        '| 200 | 190ms | 450ms | 0.1% |\n' +
        '| 500 | 340ms | 890ms | 0.8% |\n' +
        '| 1000 | 680ms | 2100ms | 3.2% |\n\n' +
        'The system handles 500 concurrent users comfortably. Beyond that, the database connection pool becomes the bottleneck. I recommend connection pooling via PgBouncer for production.',
    };
  }
  return {
    thinking:
      'General performance question. I will provide a performance overview and ask what to focus on.',
    response:
      'From a performance standpoint, the application is in good shape for the current scale.\n\n' +
      'Key areas I am monitoring:\n' +
      '- **Client-side:** Core Web Vitals, bundle size, render performance\n' +
      '- **Server-side:** API latency, database query time, LLM response time\n' +
      '- **Infrastructure:** Memory usage, CPU utilization, connection pool saturation\n\n' +
      'Would you like me to run a targeted benchmark on a specific area?',
  };
};

// ---- PE — Platform Engineer ----
const peGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['infrastructure', 'terraform', 'k8s', 'kubernetes', 'cloud'])) {
    return {
      thinking:
        'Infrastructure-as-code request. I will produce a Terraform configuration for the cloud platform.',
      response:
        'I have created the Terraform configuration for the infrastructure. Here is the main module:\n\n' +
        '[ARTIFACT:main.tf]' +
        'terraform {\n' +
        '  required_version = ">= 1.5"\n' +
        '  required_providers {\n' +
        '    aws = {\n' +
        '      source  = "hashicorp/aws"\n' +
        '      version = "~> 5.0"\n' +
        '    }\n' +
        '  }\n' +
        '}\n\n' +
        'provider "aws" {\n' +
        '  region = var.aws_region\n' +
        '}\n\n' +
        'variable "aws_region" {\n' +
        '  default = "us-east-1"\n' +
        '}\n\n' +
        'variable "app_name" {\n' +
        '  default = "ai-team-studio"\n' +
        '}\n\n' +
        'variable "environment" {\n' +
        '  default = "production"\n' +
        '}\n\n' +
        '# VPC\n' +
        'resource "aws_vpc" "main" {\n' +
        '  cidr_block           = "10.0.0.0/16"\n' +
        '  enable_dns_hostnames = true\n' +
        '  tags = { Name = "${var.app_name}-vpc" }\n' +
        '}\n\n' +
        '# Subnets\n' +
        'resource "aws_subnet" "public" {\n' +
        '  count                   = 2\n' +
        '  vpc_id                  = aws_vpc.main.id\n' +
        '  cidr_block              = "10.0.${count.index + 1}.0/24"\n' +
        '  availability_zone       = data.aws_availability_zones.available.names[count.index]\n' +
        '  map_public_ip_on_launch = true\n' +
        '  tags = { Name = "${var.app_name}-public-${count.index + 1}" }\n' +
        '}\n\n' +
        'data "aws_availability_zones" "available" {\n' +
        '  state = "available"\n' +
        '}\n\n' +
        '# ECS Cluster\n' +
        'resource "aws_ecs_cluster" "main" {\n' +
        '  name = "${var.app_name}-cluster"\n' +
        '}\n\n' +
        '# RDS PostgreSQL\n' +
        'resource "aws_db_instance" "postgres" {\n' +
        '  identifier           = "${var.app_name}-db"\n' +
        '  engine               = "postgres"\n' +
        '  engine_version       = "16"\n' +
        '  instance_class       = "db.t3.medium"\n' +
        '  allocated_storage    = 20\n' +
        '  db_name              = "ai_team_studio"\n' +
        '  username             = "admin"\n' +
        '  skip_final_snapshot  = true\n' +
        '  tags = { Name = "${var.app_name}-db" }\n' +
        '}\n\n' +
        'output "cluster_name" {\n' +
        '  value = aws_ecs_cluster.main.name\n' +
        '}\n\n' +
        'output "db_endpoint" {\n' +
        '  value = aws_db_instance.postgres.endpoint\n' +
        '}\n' +
        '[/ARTIFACT]\n\n' +
        'The configuration provisions VPC, subnets, ECS cluster, and RDS PostgreSQL. Run `terraform plan` to preview the changes.',
    };
  }
  if (hasKeyword(msg, ['infrastructure', 'infra', 'cloud', 'deploy'])) {
    return {
      thinking:
        'Infrastructure planning request. I need to outline the platform topology and resource requirements.',
      response:
        'Here is the proposed infrastructure topology:\n\n' +
        '**Compute:**\n' +
        '- Vercel for the Next.js application (serverless, edge-optimized)\n' +
        '- Cloudflare Workers for latency-sensitive API proxying\n\n' +
        '**Data:**\n' +
        '- Supabase (managed Postgres, auth, realtime)\n' +
        '- Upstash Redis for rate limiting and session cache\n\n' +
        '**Observability:**\n' +
        '- Axiom for structured logging\n' +
        '- Sentry for error tracking\n\n' +
        '**Estimated monthly cost at current scale:** $120-180/month.\n' +
        'This architecture scales to 10K MAU without changes.',
    };
  }
  if (hasKeyword(msg, ['terraform', 'iac', 'provision'])) {
    return {
      thinking:
        'Infrastructure-as-code question. I should describe the IaC strategy and module structure.',
      response:
        'I recommend managing infrastructure with Terraform, organized into these modules:\n\n' +
        '```\n' +
        'infra/\n' +
        '  modules/\n' +
        '    networking/    — VPC, subnets, security groups\n' +
        '    database/      — Supabase project configuration\n' +
        '    compute/       — Vercel project, domains, env vars\n' +
        '    monitoring/    — Alerts, dashboards, log pipelines\n' +
        '  environments/\n' +
        '    dev.tfvars\n' +
        '    staging.tfvars\n' +
        '    production.tfvars\n' +
        '```\n\n' +
        'State is stored in a remote backend (S3 + DynamoDB for locking). All changes go through a PR-based review workflow.',
    };
  }
  return {
    thinking:
      'General platform question. I will provide context on the current setup and ask what needs attention.',
    response:
      'The platform is currently running on a serverless-first architecture with Vercel and Supabase.\n\n' +
      'Current status:\n' +
      '- All environments (dev, staging, prod) are provisioned and healthy.\n' +
      '- Auto-scaling is configured for compute workloads.\n' +
      '- Backup policy: daily snapshots with 7-day retention.\n\n' +
      'What platform-level changes or improvements are you looking for?',
  };
};

// ---- DO — DevOps Engineer ----
const doGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['deploy', 'docker', 'pipeline', 'ci', 'cd'])) {
    return {
      thinking:
        'Deployment/containerization request. I will produce a production-ready Dockerfile with multi-stage builds.',
      response:
        'I have created the production Dockerfile with multi-stage builds for optimal image size:\n\n' +
        '[ARTIFACT:Dockerfile]' +
        'FROM node:20-alpine AS base\n' +
        'WORKDIR /app\n\n' +
        '# Install dependencies\n' +
        'FROM base AS deps\n' +
        'COPY package.json package-lock.json ./\n' +
        'RUN npm ci --only=production\n\n' +
        '# Build application\n' +
        'FROM base AS builder\n' +
        'COPY package.json package-lock.json ./\n' +
        'RUN npm ci\n' +
        'COPY . .\n' +
        'RUN npx prisma generate\n' +
        'RUN npm run build\n\n' +
        '# Production image\n' +
        'FROM base AS runner\n' +
        'ENV NODE_ENV=production\n' +
        'RUN addgroup --system --gid 1001 nodejs\n' +
        'RUN adduser --system --uid 1001 nextjs\n\n' +
        'COPY --from=deps /app/node_modules ./node_modules\n' +
        'COPY --from=builder /app/.next/standalone ./\n' +
        'COPY --from=builder /app/.next/static ./.next/static\n' +
        'COPY --from=builder /app/public ./public\n\n' +
        'USER nextjs\n' +
        'EXPOSE 3000\n' +
        'ENV PORT=3000\n' +
        'CMD ["node", "server.js"]\n' +
        '[/ARTIFACT]\n\n' +
        'The image uses multi-stage builds to keep the final size under 100MB. Ready to integrate into the CI pipeline.',
    };
  }
  if (hasKeyword(msg, ['ci/cd', 'pipeline', 'deploy', 'github actions'])) {
    return {
      thinking:
        'CI/CD question. I should describe the pipeline stages, triggers, and deployment strategy.',
      response:
        'Here is the CI/CD pipeline configuration:\n\n' +
        '**Trigger:** Push to `main` or PR creation\n\n' +
        '**Stages:**\n' +
        '1. **Lint & Type Check** — ESLint + `tsc --noEmit` (~20s)\n' +
        '2. **Unit Tests** — Vitest with coverage report (~45s)\n' +
        '3. **Build** — Next.js production build (~90s)\n' +
        '4. **E2E Tests** — Playwright smoke suite (~120s)\n' +
        '5. **Deploy** — Vercel preview (PR) or production (main)\n\n' +
        '**Deployment strategy:** Atomic deployments with instant rollback via Vercel.\n\n' +
        'The full pipeline runs in ~5 minutes. Failed checks block merge.',
    };
  }
  if (hasKeyword(msg, ['docker', 'container', 'image'])) {
    return {
      thinking:
        'Containerization question. I should provide the Dockerfile strategy and image optimization approach.',
      response:
        'For the containerized deployment option:\n\n' +
        '**Multi-stage Dockerfile:**\n' +
        '- Stage 1: Install dependencies (`node:20-alpine`)\n' +
        '- Stage 2: Build the application\n' +
        '- Stage 3: Production image (distroless, ~80MB final size)\n\n' +
        '**Image optimization:**\n' +
        '- `.dockerignore` excludes tests, docs, and dev configs\n' +
        '- Layer caching for `node_modules` (only rebuilds on `package-lock.json` change)\n' +
        '- Health check endpoint at `/api/health`\n\n' +
        'Build time: ~2 minutes. Image size: ~80MB.',
    };
  }
  if (hasKeyword(msg, ['monitor', 'alert', 'log', 'observability'])) {
    return {
      thinking:
        'Monitoring and observability question. I need to describe the logging, alerting, and dashboard setup.',
      response:
        'Observability stack:\n\n' +
        '**Logging:** Structured JSON logs via Axiom. Key fields: `requestId`, `userId`, `agentId`, `latencyMs`.\n\n' +
        '**Alerting:**\n' +
        '- Error rate > 1% over 5 min: Slack notification\n' +
        '- p95 latency > 2s: PagerDuty alert\n' +
        '- Database connection pool > 80%: Slack + auto-scale trigger\n\n' +
        '**Dashboards:**\n' +
        '- System health overview (uptime, error rate, latency)\n' +
        '- Per-agent usage and response times\n' +
        '- Cost tracking by provider\n\n' +
        'All dashboards are accessible at `/ops/dashboard` (internal only).',
    };
  }
  return {
    thinking:
      'General DevOps question. I will summarize the current operational status.',
    response:
      'Current DevOps status:\n\n' +
      '- **CI/CD:** Green across all branches. Last deployment: 2 hours ago.\n' +
      '- **Uptime:** 99.97% over the last 30 days.\n' +
      '- **Pending:** Scheduled maintenance window for database migration on Saturday.\n\n' +
      'Is there a specific operational concern you would like me to address?',
  };
};

// ---- IE — Integration Engineer ----
const ieGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['api', 'integrate', 'third-party', 'webhook'])) {
    return {
      thinking:
        'API integration request. I need to outline the integration pattern, authentication, and error handling.',
      response:
        'Here is the integration plan:\n\n' +
        '**Authentication:** OAuth 2.0 with refresh token rotation. Tokens stored encrypted in the workspace vault.\n\n' +
        '**Request pattern:**\n' +
        '```typescript\n' +
        'const response = await apiClient.request({\n' +
        '  provider: \'external-service\',\n' +
        '  endpoint: \'/v2/data\',\n' +
        '  method: \'POST\',\n' +
        '  retry: { maxAttempts: 3, backoffMs: 1000 },\n' +
        '});\n' +
        '```\n\n' +
        '**Error handling:**\n' +
        '- 401: Auto-refresh token and retry once\n' +
        '- 429: Respect `Retry-After` header\n' +
        '- 5xx: Exponential backoff with jitter\n\n' +
        '**Webhook support:** Incoming webhooks validated via HMAC signature verification.',
    };
  }
  if (hasKeyword(msg, ['sync', 'data', 'transform', 'map'])) {
    return {
      thinking:
        'Data synchronization question. I should describe the mapping and transformation strategy.',
      response:
        'For data synchronization between systems:\n\n' +
        '**Sync strategy:** Event-driven with a reconciliation job every 6 hours as a safety net.\n\n' +
        '**Data mapping:**\n' +
        '- External `user.name` maps to internal `profile.displayName`\n' +
        '- External `project.status` maps via a configurable enum lookup table\n' +
        '- Unmapped fields are stored in a `metadata` JSONB column for future use\n\n' +
        '**Conflict resolution:** Last-write-wins with full audit trail. Users can view and revert sync changes from the activity log.',
    };
  }
  return {
    thinking:
      'General integration question. I will outline the integration architecture and ask for specifics.',
    response:
      'The integration layer follows an adapter pattern:\n\n' +
      '- Each external service has a dedicated adapter implementing a common interface.\n' +
      '- All adapters share a centralized HTTP client with retry, timeout, and circuit-breaker logic.\n' +
      '- Credentials are managed through the Secrets Manager agent.\n\n' +
      'Which service are you looking to integrate?',
  };
};

// ---- SM — Secrets Manager ----
const smGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['key', 'secret', 'credential', 'api key'])) {
    return {
      thinking:
        'Secret management request. I need to describe the storage, rotation, and access control strategy.',
      response:
        'Secret management overview:\n\n' +
        '**Storage:** All secrets are encrypted at rest using AES-256-GCM. Encryption keys are derived per-workspace using HKDF.\n\n' +
        '**Access control:**\n' +
        '- Secrets are scoped to workspaces. Only workspace admins can create or rotate them.\n' +
        '- Runtime access is granted via short-lived tokens (5-minute TTL).\n' +
        '- All access is logged with the requesting agent ID and timestamp.\n\n' +
        '**Rotation policy:**\n' +
        '- API keys: Manual rotation with a 90-day reminder.\n' +
        '- OAuth tokens: Automatic rotation via refresh token flow.\n\n' +
        'The vault currently holds 3 active secrets for this workspace.',
    };
  }
  if (hasKeyword(msg, ['vault', 'encrypt', 'store', 'protect'])) {
    return {
      thinking:
        'Vault operations question. I should explain the encryption architecture and operational procedures.',
      response:
        'Vault architecture:\n\n' +
        '**Encryption layers:**\n' +
        '1. Application-level encryption (AES-256-GCM) before data reaches the database.\n' +
        '2. Database-level encryption at rest (Supabase managed).\n' +
        '3. TLS 1.3 for all data in transit.\n\n' +
        '**Key hierarchy:**\n' +
        '- Master key (derived from workspace creation secret)\n' +
        '- Data encryption keys (one per secret, rotated independently)\n\n' +
        '**Operational procedures:**\n' +
        '- Secrets are never logged or included in error reports.\n' +
        '- Environment variables are injected at runtime, never baked into builds.\n' +
        '- Emergency revocation invalidates all derived tokens within 30 seconds.',
    };
  }
  return {
    thinking:
      'General secrets question. I will report on the current vault status.',
    response:
      'Secrets Manager status:\n\n' +
      '- **Active secrets:** 3 (2 API keys, 1 OAuth token)\n' +
      '- **Last rotation:** 12 days ago\n' +
      '- **Pending alerts:** None\n' +
      '- **Access log:** 47 reads in the last 24 hours (all authorized)\n\n' +
      'All secrets are within their rotation policy windows. No action required.',
  };
};

// ---- SR — Site Reliability Engineer ----
const srGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['incident', 'outage', 'down', 'alert'])) {
    return {
      thinking:
        'Incident response request. I need to assess severity, identify impact, and recommend immediate actions.',
      response:
        'Incident assessment:\n\n' +
        '**Severity:** SEV-3 (degraded performance, no data loss)\n' +
        '**Impact:** API response times elevated to 2x normal. Affects ~15% of active users.\n' +
        '**Root cause (preliminary):** Database connection pool saturation due to a long-running query from the analytics service.\n\n' +
        '**Immediate actions:**\n' +
        '1. Kill the offending query (done).\n' +
        '2. Increase connection pool limit from 20 to 40.\n' +
        '3. Add a query timeout of 30s to prevent recurrence.\n\n' +
        '**Status:** Recovering. Metrics returning to baseline. Full post-mortem to follow within 24 hours.',
    };
  }
  if (hasKeyword(msg, ['sla', 'slo', 'reliability', 'uptime'])) {
    return {
      thinking:
        'Reliability metrics question. I should present SLO definitions and current compliance.',
      response:
        'Service Level Objectives:\n\n' +
        '| SLO | Target | Current (30d) | Status |\n' +
        '|-----|--------|---------------|--------|\n' +
        '| Availability | 99.9% | 99.97% | Compliant |\n' +
        '| API p95 latency | < 500ms | 340ms | Compliant |\n' +
        '| Error rate | < 0.5% | 0.12% | Compliant |\n' +
        '| Data durability | 99.999% | 99.999% | Compliant |\n\n' +
        'Error budget remaining this month: 38 minutes of allowed downtime (full budget: 43 minutes).\n\n' +
        'No SLO breaches in the current reporting period.',
    };
  }
  if (hasKeyword(msg, ['runbook', 'procedure', 'playbook'])) {
    return {
      thinking:
        'Runbook request. I should outline the standard operating procedures for common scenarios.',
      response:
        'Available runbooks:\n\n' +
        '1. **Database failover** — Steps to promote a read replica and redirect traffic. Estimated recovery: 5 minutes.\n' +
        '2. **Deployment rollback** — Revert to previous Vercel deployment. One-click, instant.\n' +
        '3. **Provider outage** — Automatic failover to mock provider when LLM API errors exceed 10% over 2 minutes.\n' +
        '4. **Secret compromise** — Emergency rotation procedure: revoke, regenerate, deploy. Target: < 15 minutes.\n\n' +
        'All runbooks are version-controlled and reviewed quarterly.',
    };
  }
  return {
    thinking:
      'General SRE question. I will provide a system health summary.',
    response:
      'System health summary:\n\n' +
      '- **Uptime (30d):** 99.97%\n' +
      '- **Active incidents:** 0\n' +
      '- **Error budget remaining:** 38 minutes\n' +
      '- **Last deployment:** 2 hours ago (healthy)\n' +
      '- **Monitoring:** All checks green\n\n' +
      'The system is operating within all defined SLOs. No action required.',
  };
};

// ---- STC — State Controller ----
const stcGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['state', 'workflow', 'transition', 'status'])) {
    return {
      thinking:
        'State management request. I need to validate the current workflow state and describe valid transitions.',
      response:
        'Current workflow state: **In Development**\n\n' +
        'Valid transitions from this state:\n' +
        '- `In Development` --> `Code Review` (requires: all tasks complete, tests passing)\n' +
        '- `In Development` --> `Blocked` (requires: blocker description)\n' +
        '- `In Development` --> `Cancelled` (requires: PM approval)\n\n' +
        'State validation rules:\n' +
        '- Cannot skip from `In Development` directly to `Deployed`.\n' +
        '- The `Code Review` transition requires at least one reviewer assigned.\n' +
        '- All state changes are logged in the audit trail.\n\n' +
        'The current state has been active for 2 days, which is within normal bounds.',
    };
  }
  if (hasKeyword(msg, ['validate', 'check', 'enforce', 'rule'])) {
    return {
      thinking:
        'Validation request. I need to check the current state against all enforcement rules.',
      response:
        'State validation results:\n\n' +
        '- [x] All required fields populated\n' +
        '- [x] Assignee is a valid team member\n' +
        '- [x] Parent workflow is in a compatible state\n' +
        '- [ ] **Warning:** No due date set — recommended for items in active development.\n' +
        '- [x] No circular dependencies detected\n\n' +
        'Overall status: Valid with 1 non-blocking warning.\n\n' +
        'The workflow may proceed. I recommend setting a due date for tracking purposes.',
    };
  }
  return {
    thinking:
      'General state controller query. I will report the current state and available actions.',
    response:
      'State Controller report:\n\n' +
      '- **Active workflows:** 4\n' +
      '- **Pending transitions:** 1 (awaiting code review approval)\n' +
      '- **Blocked items:** 0\n' +
      '- **State violations detected:** 0\n\n' +
      'All workflows are progressing normally. No enforcement actions required.',
  };
};

// ---- DEC — Decision Controller ----
const decGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['decision', 'approve', 'approval', 'sign-off'])) {
    return {
      thinking:
        'Decision management request. I need to log the decision, identify required approvers, and track status.',
      response:
        'Decision record created:\n\n' +
        '**Decision ID:** DEC-0042\n' +
        '**Title:** Adopt MockProvider as default development backend\n' +
        '**Status:** Pending approval\n\n' +
        '**Required approvers:**\n' +
        '- TL (Tech Lead) — pending\n' +
        '- SA (Solution Architect) — pending\n\n' +
        '**Decision criteria:**\n' +
        '1. Does it reduce development friction? (Yes)\n' +
        '2. Is it reversible? (Yes — providers are swappable)\n' +
        '3. Does it introduce security risks? (No — mock data only)\n\n' +
        'I have notified the approvers. Estimated resolution: within 1 business day.',
    };
  }
  if (hasKeyword(msg, ['vote', 'consensus', 'agree', 'disagree'])) {
    return {
      thinking:
        'Consensus tracking question. I should present the current vote tally and any outstanding concerns.',
      response:
        'Consensus status for DEC-0042:\n\n' +
        '| Approver | Vote | Comment |\n' +
        '|----------|------|---------|\n' +
        '| TL | Approve | "Solid approach, proceed." |\n' +
        '| SA | Approve with conditions | "Add provider fallback logic." |\n' +
        '| PM | Approve | No comment |\n\n' +
        '**Result:** Approved with conditions.\n\n' +
        '**Action item:** SA\'s condition (provider fallback logic) has been logged as a follow-up task and assigned to SD.\n\n' +
        'The decision is now final and recorded in the decision log.',
    };
  }
  return {
    thinking:
      'General decision management query. I will summarize active decisions.',
    response:
      'Decision Controller summary:\n\n' +
      '- **Open decisions:** 2\n' +
      '- **Awaiting approval:** 1 (DEC-0043: API rate limiting strategy)\n' +
      '- **Recently resolved:** DEC-0042 (approved with conditions)\n' +
      '- **Overdue:** 0\n\n' +
      'All decisions are tracked with full audit trails. Would you like to create a new decision record?',
  };
};

// ---- AUD — Audit Gatekeeper ----
const audGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['audit', 'compliance', 'review', 'check'])) {
    return {
      thinking:
        'Audit request. I need to run the quality checklist and report compliance status.',
      response:
        'Audit report for the current sprint:\n\n' +
        '**Code Quality:**\n' +
        '- [x] All PRs have at least one reviewer\n' +
        '- [x] No direct pushes to `main` branch\n' +
        '- [x] Test coverage above 85% threshold\n' +
        '- [x] No known security vulnerabilities in dependencies\n\n' +
        '**Process Compliance:**\n' +
        '- [x] All features have associated requirements documents\n' +
        '- [x] Architecture decisions recorded as ADRs\n' +
        '- [ ] **Finding:** 2 tasks missing estimated completion dates\n\n' +
        '**Data Handling:**\n' +
        '- [x] PII is encrypted at rest and in transit\n' +
        '- [x] Access logs retained for 90 days\n\n' +
        'Overall compliance score: **94%** (target: 90%). One non-critical finding to address.',
    };
  }
  if (hasKeyword(msg, ['log', 'trail', 'history', 'record'])) {
    return {
      thinking:
        'Audit trail request. I should present recent audit log entries and access patterns.',
      response:
        'Recent audit trail entries:\n\n' +
        '| Timestamp | Actor | Action | Resource |\n' +
        '|-----------|-------|--------|----------|\n' +
        '| 14:32 | SD | Code merged | PR #247 |\n' +
        '| 14:15 | TL | Decision approved | DEC-0042 |\n' +
        '| 13:58 | BA | Requirement updated | REQ-089 |\n' +
        '| 13:41 | QA | Test suite executed | Suite #12 |\n' +
        '| 13:20 | SM | Secret accessed | vault/api-key-1 |\n\n' +
        'All entries are immutable and cryptographically signed. Export available in CSV or JSON format.',
    };
  }
  return {
    thinking:
      'General audit question. I will provide a compliance summary.',
    response:
      'Audit Gatekeeper status:\n\n' +
      '- **Last full audit:** 3 days ago\n' +
      '- **Compliance score:** 94%\n' +
      '- **Open findings:** 1 (non-critical)\n' +
      '- **Audit trail entries (24h):** 127\n\n' +
      'No critical compliance issues. The next scheduled audit is in 4 days.',
  };
};

// ---- SEC — Security & Compliance ----
const secGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['vulnerability', 'scan', 'cve', 'security'])) {
    return {
      thinking:
        'Security scanning request. I need to report on dependency vulnerabilities and code security findings.',
      response:
        'Security scan results:\n\n' +
        '**Dependency audit (`npm audit`):**\n' +
        '- Critical: 0\n' +
        '- High: 0\n' +
        '- Moderate: 1 (indirect dependency, no exploit path in our usage)\n' +
        '- Low: 3\n\n' +
        '**Static analysis (CodeQL):**\n' +
        '- SQL injection: 0 findings\n' +
        '- XSS: 0 findings\n' +
        '- Insecure randomness: 0 findings\n' +
        '- Hardcoded secrets: 0 findings\n\n' +
        '**OWASP Top 10 coverage:** All categories addressed in the current architecture.\n\n' +
        'Recommendation: Update the moderate dependency in the next maintenance window. No urgent action required.',
    };
  }
  if (hasKeyword(msg, ['permission', 'access', 'rbac', 'role'])) {
    return {
      thinking:
        'Access control question. I should describe the RBAC model and current permission structure.',
      response:
        'Role-Based Access Control (RBAC) model:\n\n' +
        '| Role | Permissions |\n' +
        '|------|------------|\n' +
        '| Owner | Full access, billing, delete workspace |\n' +
        '| Admin | Manage members, configure providers, manage projects |\n' +
        '| Member | Create projects, use agents, view reports |\n' +
        '| Viewer | Read-only access to projects and conversations |\n\n' +
        '**Row-Level Security:** Enforced at the database level via Supabase RLS policies. Users can only access data within their workspace.\n\n' +
        '**API security:** All endpoints validate JWT tokens and check workspace membership before processing requests.',
    };
  }
  if (hasKeyword(msg, ['encrypt', 'tls', 'certificate', 'ssl'])) {
    return {
      thinking:
        'Encryption and transport security question. I should report on the current TLS configuration and certificate status.',
      response:
        'Transport security status:\n\n' +
        '- **TLS version:** 1.3 (1.2 allowed for legacy clients)\n' +
        '- **Certificate:** Valid, auto-renewed via Let\'s Encrypt. Expiry: 67 days.\n' +
        '- **HSTS:** Enabled with `max-age=31536000; includeSubDomains`.\n' +
        '- **Certificate Transparency:** Enabled.\n\n' +
        '**Data encryption:**\n' +
        '- At rest: AES-256-GCM (application layer) + storage-level encryption\n' +
        '- In transit: TLS 1.3 for all connections\n' +
        '- Secrets: Additional application-level encryption with per-workspace keys\n\n' +
        'No certificate or encryption issues detected.',
    };
  }
  return {
    thinking:
      'General security question. I will provide an overall security posture summary.',
    response:
      'Security posture summary:\n\n' +
      '- **Vulnerability scan:** Clean (0 critical/high)\n' +
      '- **Dependency audit:** 1 moderate (no exploit path)\n' +
      '- **Access control:** RBAC + RLS enforced\n' +
      '- **Encryption:** At rest and in transit\n' +
      '- **Last penetration test:** N/A (scheduled for next quarter)\n\n' +
      'Overall security posture: Good. No immediate action required.',
  };
};

// ---- LLM — LLM Gateway Manager ----
const llmGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['route', 'model', 'provider', 'gateway'])) {
    return {
      thinking:
        'Model routing question. I need to describe the routing strategy and fallback behavior.',
      response:
        'LLM Gateway routing configuration:\n\n' +
        '**Primary routing strategy:** Cost-optimized with quality constraints.\n\n' +
        '| Task Type | Primary Model | Fallback | Max Latency |\n' +
        '|-----------|--------------|----------|-------------|\n' +
        '| Complex reasoning | Claude Opus | GPT-4o | 30s |\n' +
        '| Code generation | Claude Sonnet | GPT-4o-mini | 15s |\n' +
        '| Simple Q&A | Claude Haiku | GPT-4o-mini | 5s |\n' +
        '| Summarization | GPT-4o-mini | Claude Haiku | 10s |\n\n' +
        '**Fallback behavior:** If the primary model returns an error or exceeds the latency threshold, the request is automatically retried with the fallback model.\n\n' +
        'Current provider health: All providers operational.',
    };
  }
  if (hasKeyword(msg, ['token', 'usage', 'cost', 'limit'])) {
    return {
      thinking:
        'Token usage and cost question. I should present usage metrics and budget status.',
      response:
        'Token usage report (last 7 days):\n\n' +
        '| Provider | Input Tokens | Output Tokens | Cost |\n' +
        '|----------|-------------|---------------|------|\n' +
        '| Anthropic | 245K | 89K | $12.40 |\n' +
        '| OpenAI | 128K | 52K | $8.20 |\n' +
        '| Mock | 890K | 340K | $0.00 |\n\n' +
        '**Budget status:** $20.60 / $100.00 monthly budget (20.6% utilized)\n\n' +
        '**Rate limiting:** No limits hit. Current usage is well within all provider quotas.\n\n' +
        'Projected monthly spend at current rate: $82.40.',
    };
  }
  if (hasKeyword(msg, ['performance', 'latency', 'speed'])) {
    return {
      thinking:
        'Gateway performance question. I should present latency metrics across providers.',
      response:
        'Gateway performance metrics (last 24h):\n\n' +
        '| Metric | Anthropic | OpenAI | Mock |\n' +
        '|--------|-----------|--------|------|\n' +
        '| Avg latency | 1.2s | 0.9s | 0.8s |\n' +
        '| p95 latency | 3.4s | 2.8s | 1.1s |\n' +
        '| Error rate | 0.1% | 0.2% | 0% |\n' +
        '| Throughput | 42 req/min | 28 req/min | 120 req/min |\n\n' +
        'All providers are within SLO targets. The mock provider is used for development traffic and does not count toward production metrics.',
    };
  }
  return {
    thinking:
      'General gateway question. I will provide a gateway status overview.',
    response:
      'LLM Gateway status:\n\n' +
      '- **Active providers:** 3 (Anthropic, OpenAI, Mock)\n' +
      '- **Default model:** mock-v1 (development mode)\n' +
      '- **Requests today:** 342\n' +
      '- **Error rate:** 0.08%\n' +
      '- **Budget utilization:** 20.6%\n\n' +
      'The gateway is operating normally. All routing rules and fallback policies are active.',
  };
};

// ---- PRE — Prompt Engineer ----
const preGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['prompt', 'template', 'instruction', 'system message'])) {
    return {
      thinking:
        'Prompt engineering request. I need to analyze the current prompt and suggest improvements for clarity, specificity, and output quality.',
      response:
        'I have analyzed the current prompt template. Here are my recommendations:\n\n' +
        '**Current issues:**\n' +
        '1. The system message is too long (1,200 tokens). Models perform better with concise instructions under 800 tokens.\n' +
        '2. The output format is not explicitly specified, leading to inconsistent responses.\n' +
        '3. The role description mixes persona and task instructions.\n\n' +
        '**Recommended structure:**\n' +
        '```\n' +
        '[Role] — Who the model is (2-3 sentences)\n' +
        '[Context] — What the model knows (bullet points)\n' +
        '[Task] — What to do with this specific request\n' +
        '[Format] — How to structure the output\n' +
        '[Constraints] — What to avoid\n' +
        '```\n\n' +
        'This structure typically improves response consistency by 30-40% based on my benchmarks.',
    };
  }
  if (hasKeyword(msg, ['optimize', 'improve', 'better', 'quality'])) {
    return {
      thinking:
        'Prompt optimization request. I should provide specific techniques for improving output quality.',
      response:
        'Prompt optimization recommendations:\n\n' +
        '1. **Add few-shot examples** — Include 2-3 examples of ideal responses. This is the single most effective technique for improving output quality.\n\n' +
        '2. **Use chain-of-thought** — Add "Think step by step" for reasoning tasks. This improves accuracy on complex problems by 15-25%.\n\n' +
        '3. **Constrain output format** — Specify JSON schema or markdown structure. Reduces parsing errors to near zero.\n\n' +
        '4. **Temperature tuning** — Use 0.0-0.3 for factual tasks, 0.5-0.7 for creative tasks. The current default of 0.7 is too high for the analysis agents.\n\n' +
        '5. **Negative examples** — Show the model what bad output looks like and instruct it to avoid those patterns.\n\n' +
        'Shall I rewrite the prompt for a specific agent using these techniques?',
    };
  }
  if (hasKeyword(msg, ['test', 'evaluate', 'benchmark', 'compare'])) {
    return {
      thinking:
        'Prompt evaluation request. I should describe the testing methodology and present results.',
      response:
        'Prompt evaluation results (A/B test, 100 samples per variant):\n\n' +
        '| Metric | Prompt v1 | Prompt v2 (optimized) |\n' +
        '|--------|-----------|----------------------|\n' +
        '| Relevance score | 7.2/10 | 8.8/10 |\n' +
        '| Format compliance | 68% | 96% |\n' +
        '| Avg response length | 342 tokens | 218 tokens |\n' +
        '| User satisfaction | 3.4/5 | 4.2/5 |\n\n' +
        'The optimized prompt produces shorter, more relevant, and better-formatted responses. I recommend deploying v2 to all agents.\n\n' +
        'The main improvements came from adding output format constraints and reducing the system message length.',
    };
  }
  return {
    thinking:
      'General prompt engineering question. I will outline the current prompt architecture.',
    response:
      'Prompt engineering status:\n\n' +
      '- **Active prompt templates:** 23 (one per agent)\n' +
      '- **Last optimization pass:** 2 weeks ago\n' +
      '- **Average template length:** 680 tokens\n' +
      '- **Format compliance rate:** 91%\n\n' +
      'I continuously monitor response quality and flag templates that fall below the 85% satisfaction threshold for revision.\n\n' +
      'Which agent\'s prompts would you like me to review?',
  };
};

// ---- CA — Cost Analyst ----
const caGenerator: AgentGenerator = (msg) => {
  if (hasKeyword(msg, ['cost', 'spend', 'budget', 'expense'])) {
    return {
      thinking:
        'Cost analysis request. I need to present current spending, trends, and budget status.',
      response:
        'Cost analysis report:\n\n' +
        '**Current month spending:**\n' +
        '| Category | Spent | Budget | Utilization |\n' +
        '|----------|-------|--------|-------------|\n' +
        '| LLM API calls | $20.60 | $100.00 | 20.6% |\n' +
        '| Infrastructure | $145.00 | $200.00 | 72.5% |\n' +
        '| Third-party APIs | $12.00 | $50.00 | 24.0% |\n' +
        '| **Total** | **$177.60** | **$350.00** | **50.7%** |\n\n' +
        '**Trend:** Spending is 8% lower than last month, primarily due to increased use of the mock provider during development.\n\n' +
        '**Forecast:** Projected end-of-month total: $312.00 (within budget).',
    };
  }
  if (hasKeyword(msg, ['optimize', 'save', 'reduce', 'efficient'])) {
    return {
      thinking:
        'Cost optimization request. I should identify savings opportunities and quantify their impact.',
      response:
        'Cost optimization opportunities:\n\n' +
        '1. **Model downtier for simple tasks** — Route classification and summarization to Haiku/GPT-4o-mini instead of Opus. Estimated savings: $18/month (15% of LLM costs).\n\n' +
        '2. **Response caching** — Cache identical queries for 1 hour. Based on analysis, 23% of queries are duplicates. Estimated savings: $12/month.\n\n' +
        '3. **Prompt compression** — Current prompts average 680 tokens. Reducing to 500 tokens saves ~26% on input costs. Estimated savings: $8/month.\n\n' +
        '4. **Development traffic** — Ensure all dev/test traffic uses the mock provider. Currently, 5% of dev requests hit live APIs. Estimated savings: $4/month.\n\n' +
        '**Total potential savings:** $42/month (12% of current spend).',
    };
  }
  if (hasKeyword(msg, ['forecast', 'project', 'predict', 'estimate'])) {
    return {
      thinking:
        'Cost forecasting request. I need to project future costs based on growth assumptions.',
      response:
        'Cost forecast (next 6 months):\n\n' +
        '| Month | Users | LLM Costs | Infra Costs | Total |\n' +
        '|-------|-------|-----------|-------------|-------|\n' +
        '| Apr | 50 | $120 | $150 | $270 |\n' +
        '| May | 120 | $280 | $180 | $460 |\n' +
        '| Jun | 300 | $650 | $220 | $870 |\n' +
        '| Jul | 500 | $980 | $280 | $1,260 |\n' +
        '| Aug | 800 | $1,400 | $350 | $1,750 |\n' +
        '| Sep | 1,200 | $1,900 | $420 | $2,320 |\n\n' +
        '**Assumptions:** 2.5x monthly user growth, 15 LLM calls per user per day, infrastructure scales at $0.40/user/month.\n\n' +
        '**Break-even analysis:** At $10/user/month pricing, break-even occurs at ~350 active users (estimated: June).',
    };
  }
  return {
    thinking:
      'General cost question. I will provide a high-level financial summary.',
    response:
      'Cost Analyst summary:\n\n' +
      '- **MTD spend:** $177.60 / $350.00 budget (50.7%)\n' +
      '- **Projected end-of-month:** $312.00 (within budget)\n' +
      '- **Cost per active user:** $3.55\n' +
      '- **Most expensive category:** Infrastructure (41% of total)\n\n' +
      'No budget alerts. Spending is tracking in line with projections.',
  };
};

// ---------------------------------------------------------------------------
// Agent Generator Registry
// ---------------------------------------------------------------------------

const agentGenerators: Record<string, AgentGenerator> = {
  ORC: orcGenerator,
  BA: baGenerator,
  SA: saGenerator,
  UX: uxGenerator,
  PM: pmGenerator,
  TL: tlGenerator,
  JD: jdGenerator,
  SD: sdGenerator,
  QA: qaGenerator,
  AT: atGenerator,
  PF: pfGenerator,
  PE: peGenerator,
  DO: doGenerator,
  IE: ieGenerator,
  SM: smGenerator,
  SR: srGenerator,
  STC: stcGenerator,
  DEC: decGenerator,
  AUD: audGenerator,
  SEC: secGenerator,
  LLM: llmGenerator,
  PRE: preGenerator,
  CA: caGenerator,
};

/** Fallback generator used when no agent-specific generator is found. */
const fallbackGenerator: AgentGenerator = (msg) => ({
  thinking:
    'Processing the request. I will analyze the context and provide a relevant response based on my domain expertise.',
  response:
    'I have reviewed the request and here is my analysis:\n\n' +
    'Based on the current project context, I recommend proceeding with the proposed approach. ' +
    'The key considerations are:\n\n' +
    '- Alignment with existing architecture patterns\n' +
    '- Minimal impact on other workstreams\n' +
    '- Clear acceptance criteria for validation\n\n' +
    'Would you like me to elaborate on any of these points?',
});

// ---------------------------------------------------------------------------
// MockProvider Implementation
// ---------------------------------------------------------------------------

export class MockProvider implements LLMProvider {
  readonly name = 'Mock';

  async validateConnection(_config: ProviderConfig): Promise<boolean> {
    // The mock provider is always available — no API key needed.
    await sleep(randInt(100, 300));
    return true;
  }

  async listModels(_config: ProviderConfig): Promise<string[]> {
    await sleep(randInt(50, 150));
    return ['mock-v1', 'mock-v2-fast'];
  }

  async complete(
    options: LLMRequestOptions,
    config: ProviderConfig,
  ): Promise<LLMResponse> {
    const start = Date.now();

    // Determine which agent is calling.
    const agentId = (options.agentId ?? '').toUpperCase();
    const generator = agentGenerators[agentId] ?? fallbackGenerator;

    // Extract the last user message.
    const lastUserMsg =
      [...options.messages].reverse().find((m) => m.role === 'user')?.content ??
      '';

    // Generate the response.
    const { thinking, response } = generator(lastUserMsg);

    // Simulate realistic latency (600–1400ms).
    const latency = randInt(600, 1400);
    await sleep(latency);

    // Compute token estimates.
    const promptText = options.messages.map((m) => m.content).join(' ');
    const promptTokens = estimateTokens(promptText);
    const completionTokens = estimateTokens(response);

    return {
      content: response,
      thinking,
      tokensUsed: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
      model: options.model ?? config.defaultModel ?? 'mock-v1',
      provider: 'Mock',
      latencyMs: Date.now() - start,
      finishReason: 'stop',
    };
  }

  async *stream(
    options: LLMRequestOptions,
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk> {
    // Determine which agent is calling.
    const agentId = (options.agentId ?? '').toUpperCase();
    const generator = agentGenerators[agentId] ?? fallbackGenerator;

    // Extract the last user message.
    const lastUserMsg =
      [...options.messages].reverse().find((m) => m.role === 'user')?.content ??
      '';

    // Generate the full response up-front, then stream it word by word.
    const { thinking, response } = generator(lastUserMsg);

    // Yield thinking as the first chunk.
    yield {
      content: '',
      thinking,
      done: false,
    };

    // Split response into words, preserving whitespace structure.
    const words = response.split(/(\s+)/);
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      accumulated += word;

      // Only yield non-whitespace tokens (but include trailing whitespace in content).
      if (word.trim().length > 0) {
        // Simulate per-word latency (30–80ms).
        await sleep(randInt(30, 80));

        const isLast = i >= words.length - 1 ||
          words.slice(i + 1).every((w) => w.trim().length === 0);

        if (isLast) {
          // Final chunk — include token counts.
          const promptText = options.messages.map((m) => m.content).join(' ');
          const promptTokens = estimateTokens(promptText);
          const completionTokens = estimateTokens(accumulated);

          yield {
            content: word,
            done: true,
            tokensUsed: {
              prompt: promptTokens,
              completion: completionTokens,
              total: promptTokens + completionTokens,
            },
          };
        } else {
          yield {
            content: word,
            done: false,
          };
        }
      }
    }
  }
}
