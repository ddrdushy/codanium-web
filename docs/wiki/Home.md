Welcome to the **Codanium (Ai-Team Studio)** Wiki!

Codanium is a full-service AI platform that builds and delivers software from your ideas. By simply describing what you want built, our orchestration engine spins up a team of 23 specialized AI agents to handle the entire Software Development Life Cycle (SDLC) — from requirements analysis to architecture, coding, testing, and deployment.

## Quick Links

- [[Architecture Overview|Architecture]]
- [[The AI Agent System|Agent-System]]
- [[Local Development Setup|Local-Development]]
- [Source Code](https://github.com/AiSenseiMY/Ai-Team_studio)

## What Makes Codanium Different?

Unlike standard code-generation tools that output a single file or snippet, Codanium simulates a real engineering organization. 

1. **Auto-Seeding**: A project automatically provisions 23 specialized agents.
2. **SDLC Pipelines**: We enforce a strict 10-stage delivery pipeline. The Business Analyst (BA) Agent gathers requirements before the Software Architect (SA) Agent makes technology choices, ensuring high-quality, structured output.
3. **Multi-LLM Support**: Bring Your Own Model (BYOM). You can seamlessly route tasks between OpenAI, Anthropic, Ollama, or a Mock provider for local testing.
4. **Asynchronous Execution**: Long-running LLM generation and orchestration are handled via Redis and BullMQ so the UI remains highly responsive.

## Getting Started

If you want to contribute or run the platform locally, head over to the [[Local Development Setup|Local-Development]] page for a step-by-step guide.
