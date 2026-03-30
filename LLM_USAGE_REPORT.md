# LLM Usage Report — Agent Testing

**Project:** BA Test - Craft Store
**Project ID:** `cmnc1g0kz000001qbdtsdg910`
**Report Date:** 2026-03-30
**LLM Provider:** Mistral (via Mistral API)
**Model:** `devstral-latest`

---

## BA Test Project — Summary

| Metric | Value |
|--------|-------|
| Total Tokens | 3,888,457 |
| Total Cost | $4.12 |
| Total LLM Calls | 157 |
| Agents Active | 9 (BA, SA, PM, TL, SD, SEC, QA, CA, ORC) |
| Cards Created | 22 (unique) |
| Documents Generated | 3 (BRD, SDD, Design System) |

---

## Usage by Agent (Sorted by Token Consumption)

| Agent | Full Name | Calls | Total Tokens | Input | Output | Cost | % of Total |
|-------|-----------|-------|-------------|-------|--------|------|------------|
| SD | Senior Developer | 85 | 2,313,465 | 2,268,232 | 45,233 | $2.40 | 59.5% |
| BA | Business Analyst | 23 | 531,113 | 281,181 | 1,871 | $0.55 | 13.7% |
| SA | Solution Architect | 19 | 480,808 | 431,902 | 48,906 | $0.58 | 12.4% |
| TL | Tech Lead | 8 | 169,108 | 167,848 | 1,260 | $0.17 | 4.3% |
| SEC | Security | 6 | 139,702 | 136,899 | 2,803 | $0.15 | 3.6% |
| PM | Product Manager | 5 | 97,974 | 94,676 | 3,298 | $0.10 | 2.5% |
| QA | QA Engineer | 3 | 77,910 | 77,417 | 493 | $0.08 | 2.0% |
| CA | Cost Analyst | 7 | 58,023 | 46,292 | 2,197 | $0.06 | 1.5% |
| ORC | Orchestrator | 1 | 20,354 | 19,988 | 366 | $0.02 | 0.5% |

---

## Token Distribution

### By Agent Role
```
SD  ████████████████████████████████████████████████  59.5%  (code generation)
BA  █████████                                         13.7%  (requirements)
SA  ████████                                          12.4%  (architecture)
TL  ███                                                4.3%  (coordination)
SEC ██                                                 3.6%  (security audit)
PM  █                                                  2.5%  (task management)
QA  █                                                  2.0%  (review)
CA  █                                                  1.5%  (cost analysis)
ORC                                                    0.5%  (orchestration)
```

### Input vs Output Ratio (All Agents)

| Metric | Tokens | % |
|--------|--------|---|
| Total Input (Prompt) | 3,524,435 | 90.6% |
| Total Output (Completion) | 106,427 | 2.7% |
| Untracked (pre-schema) | 257,595 | 6.6% |

**Key Insight:** 90%+ of tokens are input (context window). Output is only ~3%. Context optimization is the #1 cost lever.

---

## Card State Tracking

### Card Movement Flow

```
PLANNED (8) → IN_PROGRESS (10) → UNDER_REVIEW (3) → DONE (1)
```

### Cards by State

| State | Count | Cards |
|-------|-------|-------|
| DONE | 1 | SEC: Implement Rate Limiting on Auth Endpoints |
| UNDER_REVIEW | 3 | SEC: Fix Password Reset Token Validation, Implement User Auth API, SEC: Add Security Headers |
| IN_PROGRESS | 10 | Auth Module EPIC, Admin Dashboard, Shipping, Reviews, Orders, Cart/Checkout, Search, Products, Profiles, OAuth Error Handling |
| PLANNED | 8 | 3 EPICs, 5 security tasks (CSRF, Input Sanitization, Audit Logging, JWT x2) |

### Cards by Type

| Type | Count |
|------|-------|
| FEATURE | 9 |
| TASK | 9 (security) |
| EPIC | 4 |

### Completion Rate
- **Done:** 1/22 (4.5%)
- **In Review + Done:** 4/22 (18.2%)
- **Active (In Progress+):** 14/22 (63.6%)
- **Not Started:** 8/22 (36.4%)

---

## Cost per Card (Estimated)

Total cost $4.12 across 22 unique cards = **~$0.19 per card average**

| Phase | Cost | Cards Affected | Per Card |
|-------|------|----------------|----------|
| Requirements (BA) | $0.55 | All 22 | $0.03 |
| Architecture (SA) | $0.58 | All 22 | $0.03 |
| Task Management (PM) | $0.10 | 9 FEATUREs | $0.01 |
| Coordination (TL) | $0.17 | 10 active | $0.02 |
| Code Generation (SD) | $2.40 | ~10 active | $0.24 |
| Security (SEC) | $0.15 | 9 tasks | $0.02 |
| Review (QA) | $0.08 | 3 reviewed | $0.03 |
| Cost Analysis (CA) | $0.06 | — | — |
| Orchestration (ORC) | $0.02 | — | — |

**SD (code generation) is 59.5% of total cost** — the most expensive phase by far.

---

## Agent Test Log

| Agent | Test Date | Status | Document/Output | Calls | Cost |
|-------|-----------|--------|-----------------|-------|------|
| BA | 2026-03-29 | PASS | BRD (3,238 words, 95% coverage) | 23 | $0.55 |
| SA | 2026-03-30 | PASS | SDD (3,966 words, 100% FR trace) | 19 | $0.58 |
| PM | 2026-03-30 | PASS | 9 FEATURE cards (all 37 FRs) | 5 | $0.10 |
| UX | 2026-03-30 | PARTIAL | Shopping Cart Design (563w) | 0 | $0.00 |
| TL | 2026-03-30 | PASS | Autonomous pipeline (SD/SEC/QA) | 8 | $0.17 |
| SD | 2026-03-30 | AUTO | Code files generated | 85 | $2.40 |
| SEC | 2026-03-30 | AUTO | 9 security tasks + audit | 6 | $0.15 |
| QA | 2026-03-30 | AUTO | Review process | 3 | $0.08 |
| CA | 2026-03-29 | AUTO | Cost estimation | 7 | $0.06 |
| ORC | 2026-03-30 | AUTO | Orchestration | 1 | $0.02 |

---

## Bugs Found

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| 1 | Base prompt text-marker vs tool-call contradiction | HIGH | FIXED |
| 2 | Router conversation continuity blocks PM/UX routing | HIGH | FIXED |
| 3 | Only EPIC cards, no granular tasks | MEDIUM | FIXED (via #2) |
| 4 | LLM timeouts >90s | LOW | OPEN |
| 5 | "Can't do" text before tool execution | LOW | OPEN |
| 6 | Duplicate security task cards | LOW | OPEN |

---

## Token Tracking Schema

**Status:** DEPLOYED (live since 2026-03-30)

Fields in `LLMUsage` model:
- `promptTokens` (Int) — Input tokens sent to LLM
- `completionTokens` (Int) — Output tokens generated by LLM
- `contextTokens` (Int) — Context window tokens

Updated in: `gateway.ts`, `admin/analytics`, `account/usage`

---

*Last updated: 2026-03-30*
