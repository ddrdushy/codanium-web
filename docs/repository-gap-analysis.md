# Codanium Repository Gap Analysis

> Comprehensive audit of implementation vs. enterprise specification.
> Generated 2026-04-05. Used to track remediation progress.

## Gap Status Tracker

| # | Gap | Priority | Status |
|---|-----|----------|--------|
| 1.1 | File-based memory (board.json/events.jsonl) | LOW | WONTFIX — DB is superior for production |
| 1.2 | Decision ledger as append-only log | MEDIUM | TODO — add event logging for decisions |
| 1.3 | Event persistence | HIGH | TODO — implement event emission |
| 2.1 | Awaiting Sign-off card state | MEDIUM | TODO — add to card lifecycle |
| 2.2 | Scattered gating logic | HIGH | TODO — consolidate into STC module |
| 2.3 | IDE handover + UID separate phase | HIGH | TODO — add UID_WORKING phase |
| 3.1 | No dedicated DGE module | HIGH | PARTIAL — doc-compiler.ts created |
| 3.2 | No section status tracking | HIGH | TODO — add DocumentSection model |
| 3.3 | Output guard lacks persistence | MEDIUM | TODO — log guard events |
| 4.1 | Multi-level LLM gateway | N/A | DONE |
| 4.2 | BYOM vs BYOK | LOW | TODO — user BYOM wizard |
| 4.3 | Task-aware model routing | HIGH | TODO — add task-type routing |
| 5.1 | Artifact ownership enforcement | N/A | DONE — persona-document map added |
| 5.2 | Version naming + diffing | MEDIUM | TODO — add BRD_v1 naming |
| 5.3 | Wireframe governance | MEDIUM | TODO — separate UID approval |
| 6.1 | QA/SEC gating phases | HIGH | TODO — add phases to FSM |
| 6.2 | Resume & recovery | HIGH | TODO — section-level persistence |
| 6.3 | User BYOM UI | LOW | TODO |
