# Codanium — Your Vibe, Multiplied

## Product Vision

Codanium is a **full-service AI software delivery platform**. Users describe what they want built — even as a vague idea — and our AI agents handle the entire development lifecycle: requirements analysis, architecture, design, coding, testing, and deployment.

**The user is the stakeholder/client, not a developer.** They may have no technical background. The platform acts as their Business Analyst first (guiding them to clarify what they need), then orchestrates a team of 20+ specialized AI agents that autonomously do all the work.

### Core Principle
> "Tell us what you need. Our AI team will build and deliver it."

### Branding
- **Product Name**: Codanium
- **Tagline**: "Your Vibe, Multiplied"
- **Domain**: https://codanium.com
- **Desktop App**: Codanium Desktop (Tauri v2)
- **GitHub Repos**:
  - Web: https://github.com/AiSenseiMY/Ai-Team_studio
  - Desktop: https://github.com/AiSenseiMY/Codanium

## Tech Stack
- **Framework**: Next.js 16 (Turbopack, React 19, App Router)
- **Database**: PostgreSQL via Docker (port 14000), Prisma 7.x ORM
- **Auth**: NextAuth.js (credentials + OAuth)
- **Styling**: Tailwind CSS 4, custom dark theme (amber accent)
- **State**: Zustand stores
- **Components**: Radix UI primitives, Recharts, cmdk command palette, @dnd-kit
- **AI Backend**: Multi-provider LLM with fallback chain (NVIDIA, Ollama, Mistral, Groq, OpenRouter, BytePlus)
- **Encryption**: AES-256-GCM for API keys at rest
- **Desktop**: Tauri v2 (Rust + React 19) — cross-platform Mac/Win/Linux
- **Deployment**: Hetzner VPS (46.62.165.151), Docker Compose, Nginx, Let's Encrypt SSL
- **CI/CD**: GitHub Actions — auto deploy on push to main

## Architecture
- `src/app/(marketing)/` — Landing page with Codanium branding + desktop download section
- `src/app/(auth)/` — Login/signup pages
- `src/app/(platform)/` — Authenticated app (12 pages, all wired to real DB)
- `src/app/(admin)/` — Admin console (dashboard, users, agents, billing, analytics, settings, guardrails)
- `src/app/api/` — REST routes (projects, cards, agents, decisions, git, wireframes, admin, llm, desktop)
- `src/lib/ai/` — AI orchestration engine (providers, agents, context, orchestration)
- `prisma/schema.prisma` — 24+ models with enums
- `nginx.conf` — Nginx reverse proxy (HTTP, with SSL config in nginx-ssl.conf)
- `docker-compose.yml` — PostgreSQL + Redis + Next.js + BullMQ Worker + Nginx + Certbot

## Key Commands
```bash
npm run dev          # Start dev server (Turbopack, port 3000)
npm run build        # Production build
npx prisma db push   # Sync schema to DB
npx prisma db seed   # Seed database
npx prisma generate  # Regenerate Prisma client
```

## Production Deployment
```bash
# Auto-deploys via GitHub Actions on push to main
# Manual: ssh root@46.62.165.151
cd /opt/codanium
docker compose build --no-cache
docker compose up -d
docker compose exec -T app npx prisma migrate deploy
docker compose restart app nginx
```

## Database
- Docker PostgreSQL on port 14000, database: `ai_team_studio`
- Prisma client output: `src/generated/prisma`
- Production: PostgreSQL inside Docker Compose network (`db:5432`)
- Admin credentials (seed): `admin@demo.com` / `admin123`

## LLM Configuration
- **Multi-provider fallback**: Configure multiple LLM providers with priority order in Admin Settings
- **Supported providers**: OpenAI, Anthropic, Ollama, NVIDIA, Mistral, Groq, Together, OpenRouter, DeepSeek, BytePlus
- **Resolution priority**: User BYOK → Agent override → Project override → Platform fallback chain → Admin default
- **Platform fallback chain** (current production):
  | Priority | Provider | Model |
  |----------|----------|-------|
  | 0 | NVIDIA | codestral-22b-instruct |
  | 1 | Ollama | qwen3-coder-next:cloud |
  | 2 | Mistral | mistral-vibe-cli |
  | 3 | Groq | kimi-k2-instruct |
  | 4 | OpenRouter | nemotron-3-super (free) |
  | 5 | BytePlus | deepseek-r1-distill |
- **API keys**: AES-256-GCM encrypted at rest in `apiKeyEncrypted` column

## SDLC Pipeline — PM Gatekeeper

```
PROJECT CREATED → PM activated (gatekeeper)
  → PM creates card → BA → BRD → PM validates (loop if gaps)
  → PM creates card → SA → SDD → PM validates (loop if gaps)
  → PM creates card → DO → Scaffolding → build verified
  → PM → TL → UX → UI Kit → TL → UID → UI Interfaces → user approves
  → PM confirms 4 gates (BRD+SDD+Scaffold+UI) → TL assigns dev cards
  → ONE card at a time: JD/SD codes → tsc validates → QA+SEC+DO+PE sign off → DONE
  → TL picks next card → repeat → PM validates all DONE → deploy
```

## Codanium Desktop (Tauri v2) — v0.3.1
- **Repo**: https://github.com/AiSenseiMY/Codanium
- **Stack**: Tauri v2 (Rust) + React 19 + TypeScript + Tailwind CSS
- **Version**: 0.3.1 (package.json, tauri.conf.json, Cargo.toml all synced)
- **Features**:
  - Login with email/password (API key auth via `ats_sk_` tokens)
  - Project selector with workspace directory picker
  - Workspace file sync (polling 5s, client-side `deriveFilePath`)
  - Pipeline status bar (live phase + progress percentage)
  - Agent activity panel (grouped by team, live from server)
  - Chat panel with SSE streaming + phase banners
  - Board panel with auto-refresh (10s)
  - File explorer + Code viewer (Monaco)
  - Integrated terminal (xterm.js)
  - IDE heartbeat (15s POST to `/api/projects/{id}/vscode-ping`, Redis TTL 30s)
  - Auth persistence across app restarts (Zustand persist)
  - Environment toggle (Production / Development)
- **HTTP**: All API calls use `@tauri-apps/plugin-http` fetch (bypasses CORS)
- **Stores**: connection-store, chat-store, board-store, project-store, pipeline-store
- **Releases**: GitHub Releases with Mac (.dmg ARM64/x64), Windows (.msi/.exe), Linux (.deb/.AppImage/.rpm)
- **CI**: Build & Release workflow triggered on v* tags
- **Config**: `src-tauri/tauri.conf.json`, permissions + HTTP URL scope in `capabilities/default.json`
- **IDE-Gated Agents**: JD, SD, QA, DO, PE, IE require IDE heartbeat active
- **Mac Gatekeeper**: Users need to run `xattr -cr /Applications/Codanium.app` after install

## BA & SA Orchestration
- **Spec**: `docs/ba-sa-orchestration-spec.md`
- **Pipeline FSM**: PM_GREETING → BA_WORKING → BA_NEEDS_APPROVAL → SA_WORKING → SA_NEEDS_APPROVAL → DO_WORKING → DO_NEEDS_APPROVAL → DEV_WORKING → COMPLETE
- **Artifact Governance**: BRD/SDD auto-locked on approval (`locked: true`), version incremented on updates
- **Gate Enforcement**: SA cannot start without BRD approval, DO cannot start without SDD approval
- **Decision Tracking**: Every approval creates a Decision record for user sign-off

## Current Status

### Completed ✅

| Area | Status | Details |
|------|--------|---------|
| **Landing Page** | ✅ Live | Codanium branding, hero section, download section, pricing, footer |
| **SSL/HTTPS** | ✅ Live | Let's Encrypt via Certbot, auto-renewal |
| **CI/CD Pipeline** | ✅ Working | GitHub Actions → SSH deploy → Docker build → Prisma migrate → Nginx restart |
| **Desktop App v0.1.0** | ✅ Released | Mac/Win/Linux installers on GitHub Releases |
| **Database Seeded** | ✅ Done | 20 users, 15 projects, 30 LLM usage records, 12 transactions, admin settings |
| **LLM Fallback Chain** | ✅ Configured | 6 providers with encrypted API keys in production DB |
| **Admin Console** | ✅ Functional | Dashboard, users, agents, billing, analytics, settings, guardrails |
| **Desktop Login API** | ✅ Created | `/api/desktop/login` endpoint for Codanium Desktop auth |
| **Framer-motion SSR Fix** | ✅ Done | CSS override forces opacity:1 on all motion elements in production |
| **Auth Flow** | ✅ Fixed | Login page no longer redirects to /projects with stale cookies |

### Known Issues / In Progress 🔧

| Issue | Status | Details |
|-------|--------|---------|
| **Admin settings save** | Fixed (deploy pending) | Model field now text input, save shows errors, blocks without auth |
| **Demo Data badge** | Needs login | Shows when API calls fail (401). Login as admin@demo.com to see real data |
| **Full rebrand** | Partial | Marketing + admin settings rebranded. 99 internal files still say "AI Team Studio" |
| **SA hardcoded Node.js** | Open | SA always suggests Node.js stack — should detect project type (Issue #23) |
| **Desktop Monaco editor** | Planned | Port Monaco editor + xterm.js terminal to Codanium Desktop |
| **Semantic card dedup** | Open | Cards can be duplicated |
| **SDD persistence** | Open | SDD content may not persist fully |
| **BRD full content** | Open | BRD may truncate |
| **UX in pipeline** | Open | UX designer flow needs verification |

### Infrastructure

| Component | Details |
|-----------|---------|
| **Server** | Hetzner CPX22 (4 vCPU, 8GB RAM, 80GB SSD) |
| **IP** | 46.62.165.151 |
| **Domain** | codanium.com (DNS A record → 46.62.165.151) |
| **SSL** | Let's Encrypt (auto-renewing via Certbot container) |
| **Docker Services** | nginx, app, worker, db (PostgreSQL 17), redis, certbot |
| **Ports** | 80 (HTTP→HTTPS redirect), 443 (HTTPS), 14000 (Postgres), 14001 (Next.js direct), 14003 (Redis) |
