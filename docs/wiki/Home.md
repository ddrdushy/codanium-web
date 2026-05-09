# Welcome to the Codanium Wiki!

**Codanium (Ai-Team Studio)** is an advanced, multi-agent AI orchestration platform designed to automate the entire Software Development Life Cycle (SDLC). By acting as a complete "AI Software Delivery Team," Codanium moves beyond simple code generation to provide enterprise-grade requirements gathering, architecture design, coding, testing, and deployment.

---

## 📖 Table of Contents

### 1. Getting Started
* [[Home]] - You are here!
* [[Local Development Setup|Local-Development]] - Step-by-step guide to running Codanium on your local machine.
* [[Project Structure|Project-Structure]] - A deep dive into the repository layout.

### 2. Core Concepts
* [[System Architecture|Architecture]] - Understanding the 4-container Docker stack (Next.js, Postgres, Redis, BullMQ).
* [[The AI Agent System|Agent-System]] - Meet the 23 AI agents across 5 departments.
* [[The Orchestration Engine|Orchestration-Engine]] - How Intent Routing, Context Building, and Action Parsing work.
* [[Multi-LLM Integration|Multi-LLM-Support]] - How to switch between OpenAI, Anthropic, Ollama, and NVIDIA.

### 3. Workflows
* [[The 10-Stage SDLC Pipeline|SDLC-Pipeline]] - From Business Requirements Document (BRD) to production deployment.
* [[Agent Collaboration|Agent-Collaboration]] - How agents delegate tasks and communicate with one another.

---

## 🌟 The Codanium Philosophy

Standard code generation tools (like GitHub Copilot or ChatGPT) require the human to act as the Product Manager, Software Architect, QA Engineer, and DevOps Engineer. They rely heavily on the human to provide perfect context and piece together disparate code snippets.

**Codanium flips this model.**

When you create a project in Codanium:
1. **You act as the Stakeholder/Product Owner.**
2. **The system provisions an organization of 23 specialized AI agents.**
3. **The Business Analyst (BA) agent automatically kicks off the project**, interviewing you to extract requirements.
4. **The workflow progresses automatically.** The BA hands off to the Software Architect (SA), who designs the database and API. The SA hands off to the Project Manager (PM), who creates Kanban cards. The Tech Lead (TL) assigns these cards to Junior/Senior Developers (JD/SD).
5. **Quality is enforced at every step.** State Controllers prevent coding from starting until the architecture is approved.

This multi-agent, role-based approach ensures that the generated software is cohesive, well-architected, and ready for production.
