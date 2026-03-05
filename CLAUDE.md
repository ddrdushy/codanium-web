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
- **Components**: Radix UI primitives, Recharts, cmdk command palette

## Architecture
- `src/app/(marketing)/` — Landing page, auth
- `src/app/(platform)/` — Authenticated app (12 pages, all wired to real DB)
- `src/app/api/` — REST routes (projects, cards, agents, decisions, git, wireframes, admin)
- `prisma/schema.prisma` — 20+ models with enums
- `prisma/seed.ts` — Full seed data for all models
- `src/lib/api.ts` — Client-side fetch helpers
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

## Current Status (12/12 pages wired to real data)
All platform pages read from PostgreSQL — zero mock-only pages remain.

### Alignment Gaps (Vision vs Implementation)

The infrastructure is strong. The **framing and UX language** need adjustment to match the client-facing delivery platform vision:

| Area | Current State | What It Should Be |
|------|--------------|-------------------|
| **Landing hero** | "Ship 10x Faster with AI Agent Teams" | "Describe Your Idea. We'll Build It." |
| **Landing subtitle** | "23 agents work alongside your team" | "Our AI team handles everything — from requirements to deployment" |
| **Navigation labels** | Board, Agents, Engineering, Git | Progress, Deliverables, My Decisions, (hide technical pages) |
| **Dashboard metrics** | Total Cards, Active Agents, Blocked Items | % Complete, Days to Delivery, Decisions Needed, Cost vs Budget |
| **Board page** | Developer kanban with Agile terminology | Client milestone view (or hide behind "Technical Details") |
| **Git/Engineering** | Exposed to all users | Should be internal/hidden — clients don't need to see Git |
| **Agent page** | Shows agent roster as "team members" | Agents should be invisible workers — show results, not roles |
| **Settings** | LLM providers, agent authority configs | Simple: budget slider, approval preferences, notification settings |
| **Project creation** | Name + description only | Guided requirements flow: "What do you want built?" multi-step |
| **Onboarding** | Standard signup form | Guided journey: describe idea -> confirm requirements -> see plan -> approve |
| **All technical language** | BRD, SDD, SDLC, DoD, gate passing | Requirements, Design, Building, Testing, Launching |
| **Decision framing** | Technical decisions (OAuth, DB, framework) | "Here's what we recommend and why — approve or tell us what you'd prefer" |

### What's Well-Aligned
- **Pipeline/SDLC progress view** — Excellent for showing clients delivery progress
- **Decision system** — Core to the vision (client approves, agents execute)
- **Chat with agents** — Direct communication channel between client and AI team
- **23-agent architecture** — Right roles, just need to be presented as invisible workers
- **Notification system** — Good for keeping clients informed of progress
