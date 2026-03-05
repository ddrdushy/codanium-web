# AI Team Studio

**Your AI Software Delivery Team** — Describe what you need, and 23 AI agents build, test, and launch it.

AI Team Studio is a full-service AI platform that builds and delivers software from your ideas. Users describe what they want built — even as a rough idea — and our AI team handles the entire lifecycle: requirements analysis, architecture, design, coding, testing, and deployment.

## Who Is This For?

- Non-technical founders with a product idea
- Business stakeholders who need software built
- Anyone who wants software delivered without hiring a development team

## How It Works

1. **Describe Your Idea** — Tell us what you want built. It can be rough or detailed.
2. **Your AI Team Gets to Work** — 23 specialists clarify requirements, design the solution, and start building.
3. **Review & Approve** — Key decisions are presented with clear recommendations. You approve what matters.
4. **Receive Your Product** — Tested, reviewed, and deployed with quality checks at every step.

## Tech Stack

- **Framework**: Next.js 16 (Turbopack, React 19, App Router)
- **Database**: PostgreSQL via Docker, Prisma 7.x ORM
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS 4, custom dark theme (amber accent)
- **State**: Zustand, framer-motion transitions
- **UI**: Radix primitives, Recharts, cmdk command palette

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL (port 14000)
docker compose up -d

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
    (marketing)/     # Landing page, auth
    (platform)/      # 12 authenticated pages (all wired to real DB)
    api/             # REST routes (projects, cards, agents, decisions, git, wireframes, admin)
  components/
    marketing/       # Landing page sections
    layout/          # Sidebar, topbar
    board/           # Kanban board
    command-palette/ # Cmd+K search
    modals/          # Create project, etc.
    ui/              # Radix primitives
  lib/
    api.ts           # Client-side fetch helpers
    prisma.ts        # DB client
prisma/
  schema.prisma      # 20+ models with enums
  seed.ts            # Full seed data
```

## Platform Pages

| Page | Description |
|------|-------------|
| Overview | Project dashboard with delivery progress, stats, active team |
| Work Board | Kanban board with task cards across 7 states |
| Delivery Progress | 10-stage pipeline from requirements to launch |
| My Decisions | Approval workflow for key technical choices |
| AI Team | 23 specialists across 5 groups |
| Chat | Real-time conversation with AI team members |
| Documents | Requirements, design specs, decision records |
| Designs | Wireframes with grid/list views |
| Code & Releases | Branches, pull requests, version history |
| Reports | Progress metrics, AI team performance, cost breakdown |
| Settings | Project config, AI model providers, team permissions |

## Key Commands

```bash
npm run dev          # Dev server (Turbopack, port 3000)
npm run build        # Production build
npx prisma db push   # Sync schema to DB
npx prisma db seed   # Seed database
npx prisma generate  # Regenerate Prisma client
```
