# Round 2 Full Test Report — FitTrack Pro
**Date:** 2026-03-30
**Project:** FitTrack Pro (cmncuap7t000301p2kpbzvc8j)
**LLM:** Ollama gpt-oss:120b-cloud (120B params, cloud-hosted)

---

## Executive Summary
- **174 LLM calls**, **~2M tokens** consumed
- **8 agents tested**: BA, SA, PM, TL, SD, JD, QA, SEC
- **26 code artifacts** generated (real files: Prisma schema, APIs, React components)
- **30 cards** created (19 PLANNED, 11 IN_PROGRESS, 0 DONE)
- **1 document** persisted (BRD staging)
- **9 original bugs fixed**, **6 new findings** discovered

---

## LLM Usage Report

| Agent | Calls | Input Tokens | Output Tokens | Total Tokens | % of Total |
|-------|-------|-------------|---------------|-------------|------------|
| JD (Junior Dev) | 41 | 426,857 | 18,608 | 445,465 | **22.3%** |
| PM (Product Mgr) | 29 | 399,234 | 6,164 | 405,398 | **20.3%** |
| SEC (Security) | 33 | 356,110 | 10,800 | 366,910 | **18.4%** |
| BA (Business Analyst) | 21 | 327,334 | 5,030 | 332,364 | **16.6%** |
| SD (Senior Dev) | 25 | 186,635 | 14,316 | 200,951 | **10.1%** |
| TL (Tech Lead) | 11 | 112,845 | 6,488 | 119,333 | **6.0%** |
| QA (QA Engineer) | 12 | 98,128 | 4,713 | 102,841 | **5.1%** |
| SA (Solution Arch) | 2 | 17,972 | 8,193 | 26,165 | **1.3%** |
| **Total** | **174** | **1,925,115** | **74,312** | **1,999,427** | **100%** |

### Token Efficiency
- **Input/Output ratio**: 26:1 (96.3% input, 3.7% output)
- **Avg tokens per call**: 11,491
- **Cost projection (if commercial)**: ~$5.00 on gpt-4o, ~$0.30 on gpt-4o-mini

---

## Agents Tested — Performance

### BA (Business Analyst) — 8.5/10
- 8 unique questions, **0 repeats** (BUG-T02 FIXED)
- Topics covered: features, roles, design, devices, auth, content, integrations, hero text
- BRD generated and approved

### SA (Solution Architect) — 7/10
- SDD generated: ~6,000 words with 9 sections, ADRs, API endpoints, traceability matrix
- **0 cards created** by SA (BUG-T03 FIXED)
- SDD not persisted to DB document record (only in chat stream)

### PM (Product Manager) — 6/10
- Created 21+ cards with EPIC/FEATURE/TASK hierarchy
- **Semantic duplicates**: "Social Feed" + "Social Feed (Lite)", "Workout Logging" + "Workout Management"
- **Premature IN_PROGRESS**: 11 cards moved to IN_PROGRESS without dev work starting
- PM should auto-trigger from SA pipeline but didn't

### TL (Tech Lead) — 7/10
- Successfully delegated to SD and JD
- Showed task details and acceptance criteria
- Pipeline step 2/15 coordination working

### SD (Senior Dev) — 7/10
- 25 calls, 201K tokens
- Wrote: schema.prisma, auth.ts, nextauth config, API routes, calorie service
- 10 code artifacts generated

### JD (Junior Dev) — 7/10
- 41 calls, 445K tokens (heaviest agent!)
- Wrote: DTOs, services, API routes, React components (WorkoutForm, WorkoutList)
- 12 code artifacts generated
- **No project scaffolding** — jumped straight to feature code

### QA (QA Engineer) — 7/10
- Reviewed generated code files
- Created `docs/test-strategy.md` (3,549 chars)
- Found and logged security issues as bug cards

### SEC (Security & Compliance) — 7/10
- 33 calls, 367K tokens
- Generated Security Review Summary
- Found: missing security headers, no rate limiting on login
- Created bug task cards for findings

---

## Generated Artifacts (26 files)

| File | Type | Owner | Size |
|------|------|-------|------|
| prisma/schema.prisma | CODE | SD | 2,939 |
| src/lib/prisma.ts | CODE | SD | 465 |
| src/lib/auth.ts | CODE | SD | 1,016 |
| src/pages/api/auth/[...nextauth].ts | CODE | SD | 1,868 |
| src/lib/calorie.ts | CODE | SD | 694 |
| src/pages/api/v1/workouts.ts | CODE | SD | 3,389 |
| src/pages/api/v1/auth/register.ts | CODE | SD | 1,437 |
| src/pages/api/v1/goals.ts | CODE | SD | 2,845 |
| src/pages/api/v1/auth/password-reset-*.ts | CODE | SD | 3,031 |
| package.json | CONFIG | SD | 710 |
| src/types/workout.ts | CODE | JD | 450 |
| src/lib/dto/*.ts | CODE | JD | 625 |
| src/lib/services/workout.service.ts | CODE | JD | 3,885 |
| src/app/api/workouts/*.ts | CODE | JD | 4,929 |
| src/components/Workout*.tsx | CODE | JD | 8,872 |
| src/app/workouts/*.tsx | CODE | JD | 3,129 |
| docs/test-strategy.md | CODE | QA | 3,549 |
| **Total** | | | **~44K chars** |

---

## New Bugs/Findings (Round 2)

| ID | Severity | Description | Agent |
|----|----------|-------------|-------|
| **NEW-01** | **HIGH** | UX agent never triggered in SDLC pipeline — no wireframes/design before coding | Pipeline |
| **NEW-02** | **HIGH** | PM doesn't auto-trigger from SA — requires manual message to create cards | Pipeline |
| **NEW-03** | **MEDIUM** | Cards stuck in IN_PROGRESS (11 cards) — PM/TL set IN_PROGRESS but devs never mark DONE | PM/TL |
| **NEW-04** | **MEDIUM** | Semantic card duplicates: "Social Feed" + "Social Feed (Lite)", "Workout Logging" + "Workout Management" | PM |
| **NEW-05** | **MEDIUM** | No project scaffolding step — JD/SD jump straight to feature code without setting up project structure | SD/JD |
| **NEW-06** | **LOW** | SDD content streamed in chat but not persisted to documents table via create_document tool | SA |
| **NEW-07** | **LOW** | SDD rendering in chat shows raw `\n` escape chars instead of line breaks, tables garbled | UI |
| **NEW-08** | **LOW** | BRD in DB shows "Staging" (830 chars) not the full approved BRD | BA |

---

## Bug Fix Verification (Round 1 Bugs)

| Bug | Round 1 | Round 2 | Status |
|-----|---------|---------|--------|
| T01: Silent LLM failure | No error shown | Code verified — rate limit message added | **FIXED** |
| T02: BA repeats questions | 4 repeats | 0 repeats in 8 questions | **FIXED** |
| T03: SA creates cards | 27 cards by SA | 0 cards by SA | **FIXED** |
| T04: create_decision false positive | Blocked SA | No false positives | **FIXED** |
| T05: Duplicate cards (case) | "EPIC"/"Epic" dupes | 0 case-insensitive dupes | **FIXED** |
| T06: userId FK error | P2003 crash | 0 FK errors in 174 calls | **FIXED** |
| T07: SDD too short | 4,223 chars | ~6,000 words (8,193 output tokens) | **IMPROVED** |
| T08: Bubble wrong text | No label prefix | "A) Email and password" with label | **FIXED** |
| T09: Docker schema mismatch | ColumnNotFound | Rebuilt, no errors | **FIXED** |

---

## Comparison: Round 1 vs Round 2

| Metric | Round 1 | Round 2 | Change |
|--------|---------|---------|--------|
| Agents tested | 3 (BA, SA, PM) | 8 (BA, SA, PM, TL, SD, JD, QA, SEC) | +167% |
| LLM calls | 37 | 174 | +370% |
| Total tokens | 609K | 2.0M | +228% |
| Code artifacts | 0 | 26 | New! |
| Task cards | 27 | 30 | Similar |
| Documents | 2 (BRD+SDD) | 1 (BRD staging) | Regression |
| BA repeat questions | 4 | 0 | **FIXED** |
| SA card violations | 27 | 0 | **FIXED** |
| FK errors | 1 | 0 | **FIXED** |
| New bugs found | 9 | 8 | Pipeline-level |

---

## Recommendations

### Critical (fix before next test)
1. **Add UX agent to pipeline** — BA → SA → **UX** → PM → TL → Dev
2. **Fix SA→PM auto-trigger** — SA should consult_agent PM automatically in pipeline mode
3. **Fix card state management** — Cards should stay PLANNED until dev explicitly starts work

### Medium Priority
4. **Semantic card dedup** — Normalize titles beyond case (strip "Lite", detect similar names)
5. **Add scaffolding step** — TL/SD should create project structure before writing features
6. **Fix SDD persistence** — SA should call create_document tool explicitly

### Low Priority
7. **Fix SDD/BRD rendering** — Escape characters in chat display
8. **Fix BRD staging** — Ensure full approved BRD replaces staging version in DB
