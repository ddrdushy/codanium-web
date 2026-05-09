# Multi-LLM Support

Codanium supports a "Bring Your Own Model" (BYOM) architecture. The platform does not force you into using a single provider. Instead, the Orchestration Engine's Gateway abstracts the complexities of different APIs and allows the system to route prompts to the best model for the task.

## Supported Providers

1. **OpenAI** (e.g., `gpt-4o`, `gpt-4-turbo`)
2. **Anthropic** (e.g., `claude-3-5-sonnet`, `claude-3-opus`)
3. **Ollama** (e.g., `llama3`, `qwen2.5`)
4. **NVIDIA** (e.g., `qwen/qwen3.5-122b-a10b`)
5. **Mock Provider** (Used for local testing and CI/CD without burning API credits).

## How Routing Works

The `LLM (Model Specialist)` agent acts as an internal load balancer. 

1. **Simple Tasks**: If the PM agent needs to generate a short title for a Kanban card, the Model Specialist routes this to a fast, cheap model (like `gpt-3.5-turbo` or a local Ollama model) to save costs.
2. **Complex Tasks**: If the SA (Software Architect) agent needs to design a normalized PostgreSQL database schema, the task is routed to a frontier model like `gpt-4o` or `claude-3.5-sonnet`.

## Switching Providers

You can switch providers instantly without restarting the application by executing the switch script:

```bash
./scripts/switch-llm.sh nvidia
./scripts/switch-llm.sh ollama
./scripts/switch-llm.sh status
```

This script directly updates the PostgreSQL `admin_settings` table, which the LLM Gateway reads from in real-time.
