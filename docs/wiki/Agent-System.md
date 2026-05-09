# The AI Agent System

Codanium features a simulated software engineering organization comprised of **23 specialized AI agents**. These agents are divided into 5 distinct groups, each mimicking a specific department in a real tech company.

## 1. Governance Group

Responsible for platform routing, decision making, and quality control.

* **ORC (Orchestrator)**: The core router. Evaluates user input and delegates tasks to the appropriate department or agent.
* **STC (State Controller)**: Manages the SDLC state machine. Ensures prerequisites are met before advancing to the next phase (e.g., blocking code generation until the architecture is approved).
* **DEC (Decision Maker)**: Presents high-level technical and product decisions to the user for approval.
* **AUD (Auditor)**: Reviews overall project health and SDLC compliance.
* **SEC (Security Specialist)**: Audits requirements and code for security vulnerabilities.

## 2. SDLC Group

The product and design team.

* **BA (Business Analyst)**: The first point of contact. Gathers requirements, asks clarifying questions, and generates the Business Requirements Document (BRD).
* **SA (Software Architect)**: Takes the BRD and designs the technical architecture, database schemas, and API contracts.
* **UX (UX Designer)**: Creates wireframes and UI/UX design specifications.
* **PM (Project Manager)**: Breaks down the architecture into actionable Kanban board cards.
* **TL (Tech Lead)**: Reviews the PM's cards and assigns them to the engineering team.

## 3. Engineering Group

The builders.

* **JD (Junior Developer)**: Writes boilerplate, simple components, and basic CRUD logic.
* **SD (Senior Developer)**: Handles complex logic, state management, and reviews the JD's code.
* **QA (Quality Assurance)**: Writes unit, integration, and E2E tests for the generated code.
* **AT (Automation Tester)**: Configures CI/CD testing pipelines.
* **PF (Performance Engineer)**: Optimizes code for speed, memory usage, and rendering performance.

## 4. Platform Group

Infrastructure and DevOps.

* **PE (Platform Engineer)**: Configures the hosting environment (Docker, Vercel, AWS).
* **DO (DevOps Engineer)**: Sets up deployment pipelines and release management.
* **IE (Integration Engineer)**: Handles third-party API integrations and webhooks.
* **SM (Secrets Manager)**: Scans for leaked credentials and manages environment variable structures.
* **SR (Site Reliability)**: Configures monitoring, logging, and alerts.

## 5. AI & Cost Group

* **LLM (Model Specialist)**: Routes prompts to the cheapest/fastest provider depending on task complexity.
* **PRE (Prompt Engineer)**: Optimizes the prompts sent by other agents to reduce token usage and improve accuracy.
* **CA (Cost Analyst)**: Monitors token consumption and calculates project runway.

## Agent Collaboration

Agents do not just talk to the user; they talk to each other. For example, if the **SD (Senior Developer)** encounters an ambiguous API requirement, it can output a `[DELEGATE: SA]` token. The orchestration engine intercepts this token and automatically forwards the SD's question to the **Software Architect** agent for clarification before proceeding.
