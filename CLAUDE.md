# AI Team Studio

## Product Vision

AI Team Studio is a **full-service AI software delivery platform**. Users describe what they want built — even as a vague idea — and our AI agents handle the entire development lifecycle: requirements analysis, architecture, design, coding, testing, and deployment.

**The user is the stakeholder/client, not a developer.** They may have no technical background. The platform acts as their Business Analyst first (guiding them to clarify what they need), then orchestrates a team of 23 specialized AI agents that autonomously do all the work — from refining requirements to deploying a production system.

### Core Principle
> "Tell us what you need. Our AI team will build and deliver it."

### Target Users
- Non-technical founders with a product idea
- Business stakeholders who need software built
- Anyone who wants software delivered without hiring a development team

### What This Is NOT
- Not a developer productivity tool ("ship faster with AI help")
- Not a project management platform where humans manage work
- Not an IDE or coding assistant

## Tech Stack
- **Framework**: Next.js 16 (Turbopack, React 19, App Router)
- **Database**: PostgreSQL via Docker (port 14000), Prisma 7.x ORM
- **Auth**: NextAuth.js (dev mode auto-login)
- **Styling**: Tailwind CSS 4, custom dark theme (amber accent)
- **State**: Zustand stores, framer-motion transitions
- **Components**: Radix UI primitives, Recharts, cmdk command palette, @dnd-kit
- **AI Backend**: BYOM (Bring Your Own Model) — raw fetch adapters for OpenAI, Anthropic, Ollama
- **Encryption**: AES-256-GCM for API keys at rest

## Architecture
- `src/app/(marketing)/` — Landing page, auth (with guided onboarding)
- `src/app/(platform)/` — Authenticated app (12 pages, all wired to real DB)
- `src/app/api/` — REST routes (projects, cards, agents, decisions, git, wireframes, admin, llm)
- `src/lib/ai/` — AI orchestration engine (providers, agents, context, orchestration)
- `prisma/schema.prisma` — 24+ models with enums (incl. LLMProviderConfig, Event, Artifact, OrchestrationRun)
- `prisma/seed.ts` — Full seed data for all models
- `src/lib/api.ts` — Client-side fetch helpers
- `src/lib/hooks/` — React hooks (useAgentStream for SSE streaming)
- `src/components/` — Shared UI (command palette, modals, sidebar)

## Key Commands
```bash
npm run dev          # Start dev server (Turbopack, port 3000)
npm run build        # Production build
npx prisma db push   # Sync schema to DB
npx prisma db seed   # Seed database
npx prisma generate  # Regenerate Prisma client
```

## Database
- Docker PostgreSQL on port 14000, database: `ai_team_studio`
- Prisma client output: `src/generated/prisma`
- Connection: `DATABASE_URL` in `.env.local`

## Development Patterns
- **Graceful fallback**: `useState(mockData)` + `useEffect(fetch.then(set).catch(noop))` — pages always render, even if API fails
- **DB enum mapping**: Prisma enums (`ACTIVE`, `OPEN`) mapped to frontend strings (`active`, `open`) via lookup objects
- **Parallel fetches**: `Promise.all` for pages needing multiple API calls
- **Seed-first**: Always add Prisma models, seed data, then API routes, then wire pages

## Current Status — Frontend Complete

### Data Layer ✅
All 12 platform pages wired to real PostgreSQL — zero mock-only pages remain.

### UX Copy Rework ✅
All user-facing text reframed from developer-centric to client-centric language across 25+ files (marketing, sidebar, dashboard, all platform pages, modals, auth, command palette).

### Alignment Gaps — All Closed ✅

| Gap | Solution | File(s) |
|-----|----------|---------|
| **Project creation** was name+description only | 4-step guided wizard: Idea → Audience → Priorities → Review | `create-project-modal.tsx` |
| **Onboarding** was standard signup | Post-signup welcome screen with "Describe my first idea" flow | `signup-form.tsx` |
| **Settings** exposed LLM providers & agent configs | Simplified to 4 sections: Project Details, Preferences, Budget & Spending, Notifications | `settings/page.tsx` |
| **Board** was developer-only kanban | Added Milestones view toggle with progress bars and blocked-items banner | `board-view.tsx` |
| **Agents** showed technical capabilities | Added human-readable role descriptions + "What I Do" section per agent | `agents/page.tsx` |
| **Decisions** had small approve buttons | Added "Your AI Team Recommends" banner, prominent Choose Recommended CTA, Ask for more options | `decisions/page.tsx` |

### Backend AI Orchestration Engine ✅

| Component | Description | Files |
|-----------|-------------|-------|
| **BYOM Provider Layer** | Mock, OpenAI, Anthropic, Ollama adapters with raw fetch (no SDK deps) | `src/lib/ai/providers/*.ts` |
| **23 Agent Definitions** | System prompts, capabilities, authority for all 5 groups | `src/lib/ai/agents/definitions/*.ts` |
| **Context Builder** | Injects project state (cards, decisions, SDLC, agents) into agent prompts | `src/lib/ai/context/*.ts` |
| **Orchestration Engine** | Intent routing, agent execution, delegation chains, side effects | `src/lib/ai/orchestration/*.ts` |
| **SSE Streaming** | Token-by-token streaming via `/api/projects/[id]/chat/stream` | `src/app/api/projects/[id]/chat/stream/route.ts` |
| **BYOM Config CRUD** | User-level and project-level LLM provider configuration | `src/app/api/llm/config/route.ts` |
| **Frontend Streaming** | `useAgentStream` hook with real-time token rendering | `src/lib/hooks/use-agent-stream.ts` |
| **Chat Page** | Wired to real orchestration engine (replaces setTimeout mock) | `chat/page.tsx` |
| **Settings BYOM UI** | Provider selection, API key input, test connection | `settings/page.tsx` |
| **API Key Encryption** | AES-256-GCM for API keys at rest | `src/lib/ai/encryption.ts` |

### AI Architecture

```
User Message → Chat API → Orchestration Engine
  ├── MessageRouter (classify intent → pick agent)
  ├── ContextBuilder (fetch project data → system prompt)
  ├── AgentExecutor (call LLM via Gateway)
  └── LLM Gateway (resolve BYOM config → provider adapter)
      ├── MockProvider (default, no API key needed)
      ├── OpenAI/Anthropic/Ollama (raw fetch, user-configured)
      └── Response Parser (extract actions, artifacts, delegations)
```

### What's Next — Production Readiness
The AI orchestration engine is built. Remaining work:

- Real code generation by agents (output real files)
- Real deployment pipeline
- Production authentication (currently demo mode)
- Payment/billing integration (Stripe)
- Agent task queue for parallel multi-agent workflows
- WebSocket for real-time agent status updates on dashboard
