# The Orchestration Engine

The Orchestration Engine is the core backend framework that makes Codanium function as a cohesive team rather than a simple chatbot. It handles message routing, context assembly, multi-llm connections, and background job processing.

## 1. The Request Lifecycle

When a user sends a message in the UI:

1. **API Ingestion:** The Next.js API `/api/projects/[id]/chat` receives the POST request.
2. **Immediate Acknowledgment:** The API writes the message to PostgreSQL and immediately responds with `202 Accepted`. It does not wait for the LLM to process.
3. **Queue Insertion:** A `PROCESS_CHAT_MESSAGE` job is placed onto the Redis BullMQ queue.
4. **Worker Pickup:** The `ats-worker` container picks up the job. This ensures that even if 50 users send messages at once, the Next.js server will not crash waiting for LLM responses.

## 2. Intent Routing

The worker doesn't immediately send the prompt to an LLM. First, it passes the prompt to the **Intent Router**. 

The Intent Router uses a combination of Keyword Regex Matching and a fast/cheap LLM call (e.g., Llama 3 8B) to determine *who* the user is trying to talk to.
- If the user says "What's the status of the Jira tickets?", it routes to the **PM (Project Manager)**.
- If the user says "I need to change the primary color to red", it routes to the **UX (UX Designer)**.
- If the intent is unclear, it routes to the **ORC (Orchestrator)** for triage.

## 3. Context Builder

LLMs are stateless. To give the agent context, the **Context Builder** queries the PostgreSQL database to construct a mega-prompt.

The injected context includes:
- **Project Metatdata**: The name, description, and current SDLC stage of the project.
- **Agent Persona**: The system prompt defining the specific agent (e.g., the SA agent gets a prompt telling it to act as a senior software architect).
- **Recent Chat History**: The last 10 messages in the thread.
- **Relevant Documents**: If the SA is designing the architecture, the Context Builder injects the BRD created by the BA agent so the SA knows the requirements.
- **Kanban State**: Information about current cards in progress.

## 4. LLM Gateway & SSE Streaming

Once the prompt is built, it is sent to the LLM Gateway. The Gateway dynamically selects the provider (OpenAI, Anthropic, Ollama, Mock) based on user settings and agent complexity requirements.

As the LLM generates the response, the tokens are streamed back via Server-Sent Events (SSE) using a Redis Pub/Sub channel. This allows the user's browser to instantly start rendering the response character by character, rather than waiting 30 seconds for the entire block to generate.

## 5. Action Parser

While the tokens are being streamed to the user, the worker also parses the response looking for system commands. 

If the agent outputs:
```text
I will update the README file now.
[ACTION: UPDATE_FILE path="README.md" content="New documentation..."]
```

The SSE stream will show the text "I will update the README file now." to the user. Meanwhile, the Action Parser intercepts the `[ACTION: UPDATE_FILE...]` tag, hides it from the user, and physically executes a file update in the background sandbox.
