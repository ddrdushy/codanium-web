# Agentic IDE — Phase 3 Execution Specification (TL-Driven Delivery)

> Saved from design spec. Governs post BRD & SDD approval execution flow.

---

## Pipeline

```
Scaffolding → Scaffold Validation → UX Design → UI Design → UI Approval → Dev → Integration → QA → Completion
```

## Entry Conditions

```
BRD.status == APPROVED AND SDD.status == APPROVED
```

## PM → TL Handover

PM creates Epic card "Product Execution" assigned to TL. TL owns execution from this point.

## Execution Steps

### Step 1 — Scaffolding (DO)
- Repo structure, backend/frontend skeleton, env configs, deps, CI/CD
- Output: Runnable base project

### Step 2 — Scaffold Validation (TL + PE)
- Project builds, runs locally, no dependency conflicts
- FAIL: Return to DO | PASS: Card → Done

### Step 3 — UX Design (UX)
- Branding, colors, typography, component system, design tokens
- Output: UI_KIT.md

### Step 4 — UI Design (UID)
- Page layouts, component mapping, interaction states
- Structured data (NOT images), includes loading/error/empty states
- Output: WIREFRAME.json

### Step 5 — UI Approval (TL + User)
- TL reviews internally → sends to user
- REJECT: Feedback → UID updates | APPROVE: UI locked

### Step 6 — Development (TL + JD/SD)
- TL creates task cards: Frontend, Backend, Integration
- JD: Standard features | SD: Complex logic, critical components

### Step 7 — Integration
- Connect frontend to backend, validate APIs, ensure data flow

### Step 8 — QA Validation
- Functional testing, edge cases, regression
- DoD: E2E works, no defects, stable integration
- FAIL: Return to Dev | PASS: Card → Done

### Step 9 — Final Completion (TL)
- All features completed, QA passed, no open defects, system stable

## Card Hierarchy

```
EXEC-001 (Epic)
 ├── SCAF (Scaffolding)
 ├── UX (Design System)
 ├── UI (Wireframes)
 ├── DEV-FE (Frontend)
 ├── DEV-BE (Backend)
 ├── INT (Integration)
 └── QA (Testing)
```

## Governance Gates

1. No dev before UI approval
2. No UI before SDD approval
3. TL owns execution — PM cannot interfere
4. All changes must create decisions
5. Artifact ownership: UI Kit → UX, Wireframes → UID, Code → JD/SD
