# Codanium — Your Vibe, Multiplied

[![Build & Deploy](https://github.com/AiSenseiMY/Ai-Team_studio/actions/workflows/deploy.yml/badge.svg)](https://github.com/AiSenseiMY/Ai-Team_studio/actions/workflows/deploy.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![LLM](https://img.shields.io/badge/LLM_Providers-10+-8B5CF6)]()
[![Agents](https://img.shields.io/badge/AI_Agents-24-F59E0B)]()
[![BRD Quality](https://img.shields.io/badge/BRD_Quality-18%2F18_Pass-22C55E)]()

**Your AI Software Delivery Team** — Describe what you need, and 24 AI agents build, test, and launch it.

Codanium is a full-service AI platform that builds and delivers software from your ideas. Users describe what they want built — even as a rough idea — and our AI team handles the entire lifecycle: requirements analysis, architecture, design, coding, testing, and deployment.

### Live URLs

| Resource | URL |
|----------|-----|
| **Production App** | [https://codanium.com](https://codanium.com) |
| **Landing Page** | [https://codanium.com](https://codanium.com) |
| **GitHub (Web)** | [https://github.com/AiSenseiMY/Ai-Team_studio](https://github.com/AiSenseiMY/Ai-Team_studio) |
| **GitHub (Desktop)** | [https://github.com/AiSenseiMY/Codanium](https://github.com/AiSenseiMY/Codanium) |
| **Desktop Downloads** | [https://github.com/AiSenseiMY/Codanium/releases](https://github.com/AiSenseiMY/Codanium/releases) |
| **API Health** | [https://codanium.com/api/llm/health](https://codanium.com/api/llm/health) |

## Who Is This For?

- Non-technical founders with a product idea
- Business stakeholders who need software built
- Anyone who wants software delivered without hiring a development team

## How It Works

1. **Describe Your Idea** — Tell us what you want built via a guided wizard. It can be rough or detailed.
2. **Your AI Team Gets to Work** — 23 specialists are auto-seeded. The BA agent immediately starts gathering requirements.
3. **Review & Approve** — Key decisions are presented with clear recommendations. You approve what matters.
4. **Receive Your Product** — Code, docs, and deployments delivered with quality checks at every step.

## Core Flow

```
User Creates Project → BA Agent Auto-Kicks Off → BRD Generated
  → Project Board Cards Created → SA Agent → Architecture
    → UX Agent → Wireframes → Dev (JD + SD) → Code Artifacts
      → QA Agent → Testing → DevOps → Release
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15+ (Turbopack, React 19, App Router) |
| **Database** | PostgreSQL 17 via Docker, Prisma ORM |
| **Queue** | Redis 7 + BullMQ (background jobs, orchestration) |
| **Auth** | NextAuth.js (credentials, sessions) |
| **AI/LLM** | Multi-provider gateway (OpenAI, Anthropic, Ollama, Mock) |
| **Email** | SendGrid (transactional email with React templates) |
| **Payments** | Stripe (subscriptions, billing portal, webhooks) |
| **Git** | Octokit (GitHub integration, branches, PRs, releases) |
| **Styling** | Tailwind CSS 4, custom dark theme (amber accent) |
| **State** | Zustand, framer-motion transitions |
| **UI** | Radix primitives, Recharts, cmdk command palette |

## Architecture

### Docker Containers (4 services)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  ats-app    │  │  ats-worker │  │ ats-postgres │  │  ats-redis  │
│  :14001     │  │  (BullMQ)   │  │    :14000    │  │   :14003    │
│  Next.js    │  │  Background │  │  PostgreSQL  │  │   Redis 7   │
│  App Server │  │  Job Runner │  │     17       │  │  Queue+Cache│
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

### AI Agent Groups (23 Agents)

| Group | Agents | Purpose |
|-------|--------|---------|
| **Governance** | ORC, STC, DEC, AUD, SEC | Routing, state control, decisions, audits, security |
| **SDLC** | BA, SA, UX, PM, TL | Requirements, architecture, design, planning, tech leadership |
| **Engineering** | JD, SD, QA, AT, PF | Development, code review, testing, automation, performance |
| **Platform** | PE, DO, IE, SM, SR | Infrastructure, DevOps, integrations, secrets, reliability |
| **AI & Cost** | LLM, PRE, CA | Model routing, prompt engineering, cost analysis |

### Orchestration Engine

- **Intent Router** — Keyword-based message routing to appropriate agent
- **Context Builder** — Injects project info, SDLC stages, cards, documents into prompts
- **LLM Gateway** — BYOM (Bring Your Own Model) with provider fallback chain
- **Action/Artifact Parser** — Extracts structured outputs (`[ACTION:...]`, `[ARTIFACT:...]`, `[DELEGATE:...]`)
- **SSE Streaming** — Real-time token-by-token chat responses
- **BullMQ Worker** — Background job processing for async agent tasks

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### Quick Start (Docker — Recommended)

```bash
# Clone and start all 4 containers
docker compose up --build -d

# Open the app
open http://localhost:14001
```

### Development Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL + Redis
docker compose up -d db redis

# Push schema and seed database
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Demo Credentials

- **User**: user@demo.com / password123
- **Admin**: admin@demo.com / admin123

## Project Structure

```
src/
  app/
    (marketing)/          # Landing page, auth (login, signup)
    (platform)/           # 12+ authenticated pages (projects, board, chat, etc.)
    (admin)/              # Admin console (users, billing, agents, analytics, etc.)
    api/
      admin/              # Admin API (users, billing, agents, health, settings, audit)
      projects/[id]/      # Project API (cards, chat, agents, decisions, git, pipelines)
      auth/               # Auth API (register, login, forgot/reset password)
      billing/            # Stripe billing (checkout, portal, subscription)
      user/               # User API (profile, API keys)
      webhooks/           # Webhook handlers (GitHub, Stripe)
      internal/           # Internal APIs (task processing)
  components/
    marketing/            # Landing page sections
    layout/               # Sidebar, topbar
    admin/                # Admin sidebar, topbar, layout shell
    board/                # Kanban board
    preview/              # Live preview panel (Sandpack, WebContainer)
    command-palette/      # Cmd+K search
    modals/               # Create project wizard (4-step)
    ui/                   # Radix primitives (button, dialog, badge, etc.)
  lib/
    ai/
      agents/             # 23 agent definitions with system prompts
      orchestration/      # Engine, router, context builder, task queue
      providers/          # LLM adapters (OpenAI, Anthropic, Ollama, Mock)
    queue/                # BullMQ queues + workers (email, git, orchestration, webhooks)
    email/                # SendGrid + React email templates
    git/                  # GitHub client (octokit), sync utilities
    webhooks/             # Webhook dispatch + verification
prisma/
  schema.prisma           # 30+ models with enums
  seed.ts                 # Full seed data (users, projects, agents, cards, etc.)
```

## Platform Pages

| Page | Description |
|------|-------------|
| **Overview** | Project dashboard with delivery progress, stats, active agents |
| **Work Board** | Kanban board with task cards across 7 states |
| **Delivery Progress** | 10-stage SDLC pipeline from requirements to launch |
| **My Decisions** | Approval workflow for key technical choices |
| **AI Team** | 23 specialists across 5 groups with status indicators |
| **Chat** | Real-time SSE streaming chat with AI agents |
| **Documents** | Requirements, design specs, decision records |
| **Designs** | Wireframes with responsive previews (desktop/tablet/mobile) |
| **Code & Artifacts** | Generated code viewer with syntax coloring, download |
| **Git** | Branches, pull requests, releases (GitHub integration) |
| **Pipeline** | CI/CD deployment pipeline with build/test/deploy stages |
| **Settings** | Project config, AI model providers, team management |

## Admin Console

| Page | Description |
|------|-------------|
| **Dashboard** | Platform overview, user growth, project stats |
| **Users** | Customer management (suspend, role changes, plan changes) |
| **AI Agents** | Configure all 23 agents (enable/disable, temperature, usage stats) |
| **Billing** | MRR, revenue, subscription analytics |
| **Analytics** | Platform-wide usage analytics |
| **System Health** | Database, Redis, BullMQ, LLM provider health checks |
| **Guardrails** | AI safety and content filtering rules |
| **Audit Log** | Full audit trail of admin and system actions |
| **Settings** | LLM config, email (SendGrid), Stripe, feature flags, security |

## Key Features

- **Auto Project Seeding** — Creating a project auto-seeds 23 agents + 10 SDLC stages
- **BA Auto-Kickoff** — BA agent automatically starts analyzing the project idea
- **BYOM (Bring Your Own Model)** — Users can configure their own API keys for OpenAI, Anthropic, or Ollama
- **AES-256-GCM Encryption** — All API keys encrypted at rest
- **Mock Provider** — Full mock LLM provider with realistic agent responses for development
- **Background Processing** — BullMQ workers handle async tasks (orchestration, email, git sync, webhooks)
- **Real-time Streaming** — SSE-based token-by-token chat streaming
- **Stripe Billing** — Subscription management, billing portal, webhook processing
- **Email System** — SendGrid with React email templates (welcome, verification, billing, team invites)
- **Git Integration** — GitHub branches, PRs, releases via Octokit
- **Webhook System** — Outgoing webhooks with HMAC-SHA256 verification and retry queue

## Key Commands

```bash
npm run dev          # Dev server (Turbopack, port 3000)
npm run build        # Production build
npx prisma db push   # Sync schema to DB
npx prisma db seed   # Seed database
npx prisma generate  # Regenerate Prisma client

# Docker
docker compose up --build -d    # Build and start all containers
docker compose ps               # Check container status
docker compose logs -f app      # Follow app logs
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://ats:ats_dev_password@localhost:14000/ai_team_studio

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000

# Redis
REDIS_URL=redis://localhost:14003

# LLM Providers (optional — mock provider works without these)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Email (optional)
SENDGRID_API_KEY=SG.xxx

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Encryption
ENCRYPTION_KEY=your-32-byte-hex-key

# Internal
INTERNAL_TASK_SECRET=your-task-secret
```
