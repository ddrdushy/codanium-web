# System Architecture

Codanium uses a modern, containerized architecture designed for high performance, real-time LLM streaming, and reliable background task execution.

## Core Infrastructure

The platform is split into 4 core Docker containers:

1. **`ats-app` (Next.js Application)**
   - **Framework**: Next.js 15 (App Router, Turbopack, React 19)
   - **Role**: Handles all HTTP requests, UI rendering, Server Actions, and Server-Sent Events (SSE) for streaming LLM responses to the client.
   - **Port**: 14001

2. **`ats-worker` (BullMQ Background Worker)**
   - **Framework**: Node.js worker process
   - **Role**: Executes long-running tasks asynchronously. This includes orchestrating complex AI workflows, sending emails, processing webhook retries, and interacting with GitHub (Octokit).

3. **`ats-postgres` (PostgreSQL Database)**
   - **Version**: PostgreSQL 17
   - **Role**: Primary data store managed via Prisma ORM. Stores users, projects, agents, chat history, and generated code artifacts.
   - **Port**: 14000

4. **`ats-redis` (Redis Cache & Message Queue)**
   - **Version**: Redis 7
   - **Role**: Powers the BullMQ job queue for the worker. Also used for caching LLM responses and rate-limiting.
   - **Port**: 14003

## The AI Orchestration Engine

When a user submits a prompt, the system doesn't just hit the OpenAI API. It goes through a sophisticated pipeline:

1. **Intent Router**: Analyzes the user's message using NLP keywords and context to route it to the correct AI Agent (e.g., if asking for a database schema, it routes to the SA agent).
2. **Context Builder**: Pulls relevant project history, database schemas, and current SDLC stage data and injects it into the LLM prompt.
3. **LLM Gateway**: Connects to the user's configured LLM provider (OpenAI, Anthropic, or Ollama) using secure, AES-256 encrypted API keys.
4. **Action Parser**: The agent's response is streamed back to the user via SSE, but it is also parsed on the server for structured commands like `[ACTION: CREATE_FILE]` or `[DELEGATE: JD]`.

## Security & Encryption

- **At-Rest Encryption**: API keys for external services are encrypted in the database using AES-256-GCM.
- **Webhooks**: Outbound webhooks are secured with HMAC-SHA256 signatures so receivers can verify the payload originated from Codanium.
