# Project Structure

The Codanium repository is a monorepo organized to cleanly separate the Next.js frontend, backend API routes, AI orchestration logic, and background queue workers.

## Root Directory

```text
ai-team-studio/
├── src/                # Main application code (Next.js App Router)
├── prisma/             # Database schema and seed scripts
├── scripts/            # Utility scripts (e.g., switch-llm.sh)
├── docs/               # Technical specs and Wiki files
├── e2e/                # Playwright end-to-end tests
├── public/             # Static assets (images, icons)
├── docker-compose.yml  # Infrastructure definition
├── package.json        # Dependencies and build scripts
└── README.md           # Entry point
```

## `src/` Directory Deep Dive

The `src` folder follows the Next.js 15 App Router convention.

### `src/app/`
Contains all the routing logic.
* **`(marketing)/`**: The unauthenticated landing pages, login, and signup routes.
* **`(platform)/`**: The authenticated core dashboard (Projects, Kanban Board, Chat, Settings).
* **`api/`**: The backend REST/SSE endpoints.
  * `projects/[id]/chat/route.ts`: The SSE streaming endpoint for AI communication.
  * `internal/`: Secure endpoints called by the BullMQ worker.
  * `auth/`: NextAuth.js endpoints.

### `src/components/`
Reusable React UI components.
* **`ui/`**: Radix UI primitives (Buttons, Dialogs, Inputs) styled with Tailwind CSS.
* **`board/`**: The drag-and-drop Kanban interface.
* **`preview/`**: The Sandpack/WebContainer component for live-previewing generated code.

### `src/lib/`
The core business logic and AI engine.
* **`ai/`**: 
  * `agents/`: System prompts and definitions for all 23 personas.
  * `orchestration/`: The Intent Router, Context Builder, and Action Parser.
  * `providers/`: Adapters for OpenAI, Anthropic, Ollama, and Mock.
* **`queue/`**: BullMQ definitions and worker processing logic.
* **`git/`**: Octokit wrapper for committing code to GitHub.
* **`email/`**: SendGrid integration.
