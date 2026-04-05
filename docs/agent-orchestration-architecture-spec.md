# Codanium — Agent Orchestration Architecture (Enterprise Spec)

---

# 1. Purpose

This document defines the **complete, production-grade orchestration architecture** for Codanium — an **AI-powered, agent-driven SDLC IDE**.

It ensures:

* Deterministic execution (not chat-driven)
* Persona-based delivery
* State + decision-driven workflow
* Reliable LLM usage (multi-model + fallback + BYOM)
* Resume-safe system behavior

---

# 2. Core Principles

---

## 2.1 State > Chat

* Chat is **input only**
* State + decisions drive execution

---

## 2.2 Files Are Memory

System memory is stored in:

* `board.json`
* `decisions.jsonl`
* `events.jsonl`
* Artifacts (BRD, SDD, etc.)

Agents do NOT remember.

---

## 2.3 Persona Authority

Each persona:

* Owns specific artifacts
* Cannot override others
* Must follow approval chain

---

## 2.4 Gated SDLC

```text
BA → SA → UX/UI → Dev → QA → Release
```

No skipping allowed.

---

## 2.5 IDE-Centric Execution

After design phases:
Execution MUST happen inside Tauri IDE

---

# 3. System Architecture

---

## 3.1 High-Level Flow

```text
User / PM / TL
      |
Interaction Layer
      |
Agent Orchestrator
      |
Controllers Layer
      |
Persona Agents
      |
Workspace Controller + Tool Runner
      |
State + Artifacts + Decisions + Events
      |
LLM Gateway (Primary / Fallback / BYOM)
```

---

# 4. Core Components

---

## 4.1 Interaction Layer

Handles:

* Chat input
* Approvals / sign-offs
* UI actions
* IDE events

### Outputs:

* USER_MESSAGE
* APPROVAL
* REJECTION
* IDE_OPENED
* CARD_ACTION

---

## 4.2 Agent Orchestrator

### Responsibilities:

* Determine next valid action
* Select correct persona
* Call controllers before execution
* Maintain workflow integrity

### Rule:

- Never writes artifacts
- Only routes + coordinates

---

# 5. Controllers Layer

---

## 5.1 ORC — Orchestrator Controller

* Classifies intent
* Routes execution
* Resolves phase + active card

---

## 5.2 STC — State Controller

Controls:

* Card transitions
* Phase progression
* Gate enforcement

### Example Rules:

* No SA before BRD approval
* No Dev before UI approval
* No execution before IDE launch

---

## 5.3 DEC — Decision Controller

Tracks:

* All non-trivial changes
* Approvals / rejections

### Structure:

```json
{
  "decision_id": "DEC-001",
  "trigger": "BRD review",
  "options": ["approve", "rework"],
  "approved_option": "rework",
  "owner": "PM"
}
```

---

## 5.4 ART — Artifact Controller

Manages:

* Ownership
* Versioning
* Locking
* Dependencies

### Rules:

* Only owner persona can write
* Approved artifacts are locked
* Changes require new version

---

## 5.5 LLMR — LLM Router

Handles:

* Model selection
* Failover
* Token control

### Priority:

```text
Task Override -> Project -> BYOM -> Primary -> Fallback
```

---

## 5.6 DGE — Document Generator

Prevents LLM failures.

### Responsibilities:

* Split large docs (BRD/SDD)
* Generate in sections
* Save incrementally
* Resume safely

---

## 5.7 CMP — Compiler

* Combines sections
* Creates final documents
* Validates completeness

---

# 6. Persona Agents

---

| Persona | Responsibility    |
| ------- | ----------------- |
| BA      | BRD               |
| SA      | SDD               |
| UX      | UI Kit            |
| UID     | Wireframes        |
| JD      | Implementation    |
| SD      | Complex logic     |
| QA      | Testing           |
| PE      | Platform          |
| DO      | Deployment        |
| TL      | Execution control |

---

# 7. Data Model

---

## 7.1 board.json

```json
{
  "project_id": "PRJ-001",
  "phase": "BA",
  "cards": [],
  "pending_decisions": []
}
```

---

## 7.2 decisions.jsonl

Tracks all approvals/rejections.

---

## 7.3 events.jsonl

Tracks:

* Section saves
* State transitions
* Errors

---

## 7.4 Artifacts

* BRD.md
* SDD.md
* UI_KIT.md
* WIREFRAME.json
* Codebase

---

# 8. State Machine

---

## Card States

```text
Planned -> In Progress -> Under Review -> Testing -> Done -> Released
```

---

## Internal States

* Drafting
* Section Complete
* Awaiting Review
* Awaiting Sign-off
* Blocked

---

# 9. End-to-End Flow

---

## 9.1 BA Phase

* PM creates BA card
* BA generates BRD (section-based)
* PM reviews
* User signs off
* BRD locked

---

## 9.2 SA Phase

* SA creates SDD
* PM reviews
* User approves
* SDD locked

---

## 9.3 IDE Handover

```text
IF BRD + SDD approved
-> Prompt: Open IDE
```

---

## 9.4 Execution Phase (TL)

Steps:

1. Scaffolding
2. Validation
3. UX
4. UI
5. User Approval
6. Development
7. Integration
8. QA
9. Release

---

# 10. LLM Orchestration

---

## 10.1 Task Types

* Chat
* Document generation
* Code generation
* Review
* Summarization

---

## 10.2 Failure Handling

```text
Primary -> Retry -> Fallback -> BYOM -> Fail
```

---

## 10.3 Token Control

```text
IF tokens > limit -> split into sections
```

---

# 11. Governance Rules

---

## Mandatory

* No dev before UI approval
* No UI before SDD
* No SDD before BRD
* No artifact without card
* No change without decision

---

## Restrictions

* No direct LLM calls
* No skipping states
* No editing locked artifacts

---

# 12. APIs

---

## Orchestrator

* POST /orchestrate

---

## Cards

* POST /cards/create
* POST /cards/transition

---

## Decisions

* POST /decisions

---

## Artifacts

* POST /artifacts/section
* POST /artifacts/compile

---

## LLM

* POST /llm/execute

---

# 13. Observability

Track:

* LLM failures
* State transitions
* Decision counts
* Blocked cards
* Resume success rate

---

# 14. Build Roadmap

---

## Phase 1

* Board system
* Decision system
* BA/SA loop

## Phase 2

* Artifact controller
* Section generation

## Phase 3

* IDE integration
* TL execution

## Phase 4

* Multi-LLM routing
* BYOM

## Phase 5

* QA + release pipeline

---

# 15. Final Insight

Codanium is NOT:

- AI chatbot
- Code generator

Codanium IS:

- **AI-driven software delivery system**

---

# Outcome

With this architecture:

* Fully resumable workflows
* No LLM failure risk
* Clear ownership
* Enterprise-grade control
* True agentic execution

---

# End of Specification
