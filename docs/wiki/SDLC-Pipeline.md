# The 10-Stage SDLC Pipeline

Codanium strictly enforces a Software Development Life Cycle (SDLC). This ensures that AI agents don't hallucinate code before they understand the requirements. The pipeline is managed by the **STC (State Controller)** agent.

## The Stages

1. **`DISCOVERY`**: The initial stage. The user provides a rough idea. The Orchestrator routes the user to the BA (Business Analyst).
2. **`REQUIREMENTS_GATHERING`**: The BA asks questions. The STC locks all other agents from acting.
3. **`BRD_REVIEW`**: The BA generates the Business Requirements Document (BRD). The user must approve it.
4. **`ARCHITECTURE_DESIGN`**: The SA (Software Architect) reads the BRD and generates the Technical Design Document (TDD).
5. **`UX_DESIGN`**: The UX Designer creates component wireframes and styling tokens.
6. **`PLANNING`**: The PM breaks down the architecture and UX into atomic Kanban cards.
7. **`DEVELOPMENT`**: The TL assigns cards to the JD (Junior Dev) and SD (Senior Dev). The UI's "Code & Artifacts" tab begins populating with actual files.
8. **`TESTING`**: The QA and PF agents write Vitest/Playwright tests and check for performance bottlenecks.
9. **`REVIEW`**: The AUD (Auditor) and SEC (Security) agents perform a final pass over the codebase.
10. **`DEPLOYMENT`**: The DO (DevOps) agent pushes the code to GitHub and triggers the CI/CD pipeline.

## State Transitions

Transitions are managed by the Orchestration Engine. If the user rejects the BRD in stage 3, the state machine rolls back to stage 2, forcing the BA to ask more clarifying questions.
