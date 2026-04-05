# Agentic IDE — BA & SA Phase Orchestration Specification

> Saved from design spec. This document governs the orchestration logic for Phase 1 (BA) and Phase 2 (SA).

---

## 1. Purpose

Defines the detailed orchestration logic, control flow, state transitions, validation rules, and responsibilities for:

- **Phase 1 — Business Analysis (BA)**
- **Phase 2 — Solution Architecture (SA)**

Production-grade specification for: agent behavior, state machine, card lifecycle, decision tracking, approval gates.

---

## 2. Core Principles

- **State-Driven Execution** — Chat does NOT drive flow. State + Cards + Decisions drive execution.
- **Persona Ownership** — Each agent owns only its artifact. No cross-editing.
- **Controlled Progression** — Each phase must pass internal (PM) and external (User) validation.
- **Iterative Looping** — Every phase supports: Draft > Review > Rework > Approval.

---

## 3. Card Model

### Card States

```
Planned > In Progress > Under Review > Awaiting Sign-off > Done
                                    |
                                 Blocked
```

### Card Fields

```json
{
  "card_id": "BA-001",
  "type": "Feature",
  "title": "Create BRD",
  "assigned_to": "BA",
  "state": "Planned",
  "linked_artifacts": ["BRD.md"],
  "dependencies": [],
  "decisions": [],
  "version": 1,
  "created_by": "PM",
  "approved_by": null
}
```

---

## 4. Phase 1 — BA Loop (BRD Creation)

### Trigger
- Project created > PM initiates BA phase

### Flow

1. **PM Initializes BA** — Create card BA-001 "Create BRD", assign to BA, move Planned > In Progress
2. **BA Requirement Gathering** — Interact with user, ask structured questions, capture goals/requirements/constraints
3. **BA Submits BRD** — Save artifact BRD_v1.md, move card In Progress > Under Review
4. **PM Review Loop** — Validate completeness, clarity, testability, business alignment
   - **REJECTED**: PM sends feedback, BA updates BRD > BRD_v2.md, card Under Review > In Progress
   - **ACCEPTED**: Move to user approval, card Under Review > Awaiting Sign-off
5. **User Sign-off** — User approves or rejects
   - **USER REJECTS**: Decision created, BA rework loop triggered
   - **USER APPROVES**: BRD marked FINAL + LOCKED
6. **BA Completion** — Card Awaiting Sign-off > Done, BA role ends

### BRD Structure (Mandatory)

```md
# Business Requirements Document (BRD)
## 1. Overview
## 2. Business Objectives
## 3. Stakeholders
## 4. Functional Requirements
## 5. Non-Functional Requirements
## 6. Assumptions
## 7. Constraints
## 8. Success Criteria
```

---

## 5. Phase 2 — SA Loop (SDD Creation)

### Gate Enforcement (CRITICAL)

```
IF BRD != Approved > SA cannot start
```

### Flow

1. **PM Initializes SA** — Create card SA-001 "Create SDD", link dependency BRD_vFinal, assign to SA
2. **SA Design Phase** — Analyze BRD, design system architecture
3. **SA Submits SDD** — Save artifact SDD_v1.md, card In Progress > Under Review
4. **PM Review Loop** — Validate BRD alignment, feasibility, completeness, security
   - **REJECTED**: SA updates > SDD_v2, card Under Review > In Progress
   - **APPROVED**: Card Under Review > Done, SDD marked FINAL + LOCKED
5. **SA Completion** — SDD locked, phase ends

### SDD Structure (Mandatory)

```md
# Solution Design Document (SDD)
## 1. System Overview
## 2. Architecture Diagram
## 3. Components
## 4. Data Flow
## 5. APIs & Integrations
## 6. Tech Stack
## 7. Security Considerations
## 8. Scalability Plan
## 9. Error Handling Strategy
## 10. Assumptions
```

---

## 6. Artifact Governance Rules

| Rule | Description |
|------|-------------|
| Ownership | Only BA edits BRD, SA edits SDD |
| Locking | Approved artifacts cannot be edited |
| Versioning | Updates create new version |
| Traceability | All changes linked to decisions |

---

## 7. State Transition Matrix

| Current | Action | Next |
|---------|--------|------|
| Planned | Assigned | In Progress |
| In Progress | Submit | Under Review |
| Under Review | Reject | In Progress |
| Under Review | Accept | Awaiting Sign-off |
| Awaiting Sign-off | User Approves | Done |
| Awaiting Sign-off | User Rejects | In Progress |

---

## 8. Control Agents

- **ORC** — Routes tasks to BA/SA/PM, detects next action from state
- **STC** — Enforces valid state transitions and gate rules
- **DEC** — Creates decision records, links to cards, maintains audit log

---

## 9. Strict Constraints

- PM cannot edit BRD/SDD
- SA cannot start without BRD approval
- Cards cannot skip states
- No artifact without card
- No change without decision

---

## 10. Resume Logic

1. Load board state
2. Identify cards not in Done
3. Resume from last state
4. Continue loop
