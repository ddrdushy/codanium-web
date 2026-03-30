# Bug Report — Pet Care Booking Platform Test
**Date:** 2026-03-30
**Test Method:** Manual via Chrome Extension (human-like interaction)
**LLM:** Ollama gpt-oss:120b-cloud

---

## Bug Summary

| Total | Critical | High | Medium | Low |
|-------|----------|------|--------|-----|
| 9 | 0 | 2 | 4 | 3 |

---

## Bugs

### BUG-T01: Mistral 429 Rate Limit — Silent Failure
- **Severity:** HIGH
- **Agent:** System (LLM Gateway)
- **Description:** Mistral API returns 429 (rate limit). App retries 3x then fails silently. No error message shown to user in chat — the chat just appears stuck.
- **Expected:** Show user-facing error: "Our AI service is temporarily busy. Please try again in a moment."
- **Actual:** Chat shows nothing. User left waiting indefinitely. BA shows "Processing" forever.
- **Reproduction:** Send message when Mistral rate limit is active.
- **Fix suggestion:** Add error event to SSE stream on all 3 retries exhausted. Show toast notification.

### BUG-T02: BA Repeats Previously Answered Questions
- **Severity:** MEDIUM
- **Agent:** BA (Business Analyst)
- **Description:** BA asked 4 questions that were already answered:
  1. Device support (responsive design) — asked twice
  2. Authentication methods — asked twice
  3. Core features — asked twice
  4. Visual style preferences — asked twice
- **Expected:** BA tracks answered topics and never re-asks. The loop detector should catch question-reask pattern.
- **Actual:** BA's context grows but it doesn't maintain a "questions asked" checklist, leading to repeats.
- **Impact:** Wastes ~60K+ tokens, frustrates user, extends session unnecessarily.
- **Fix suggestion:** Add answered-topics tracking in BA system prompt or project memory. Existing loop detector `question-reask` mode should catch this but may not be sensitive enough.

### BUG-T03: SA Creates Task Cards (PM's Responsibility)
- **Severity:** MEDIUM
- **Agent:** SA (Solution Architect)
- **Description:** SA agent used `create_card` tool to create EPICs and task cards. Card creation is PM's responsibility per agent authority definitions.
- **Expected:** SA creates SDD document only. Delegates card creation to PM via tool or handoff.
- **Actual:** SA directly calls `create_card` multiple times, bypassing PM.
- **Impact:** Role boundary violation. PM agent's value is bypassed. Cards may lack PM-level prioritization.
- **Fix suggestion:** Remove `create_card` from SA's allowed tools in tool-filter.ts. SA should only use `consult_agent` to ask PM to create cards.

### BUG-T04: SA create_decision Tool — False Positive Loop Detection
- **Severity:** LOW
- **Agent:** SA (Solution Architect)
- **Description:** SA's first attempt to use `create_decision` tool was flagged by the loop detector as "repeated calls." This was the first call — false positive.
- **Expected:** First tool call should never trigger loop detection.
- **Actual:** Loop detector flagged it, SA reported it to user and asked for workaround.
- **Impact:** Architectural decisions not properly recorded. SA had to work around it.
- **Fix suggestion:** Investigate loop detector's tool-loop threshold. Ensure first call is never flagged. May be counting calls from previous pipeline context.

### BUG-T05: Duplicate EPIC Cards — Case Sensitivity
- **Severity:** LOW
- **Agent:** PM (Product Manager)
- **Description:** Two "Authentication" EPICs created:
  - "EPIC: Authentication" (uppercase E)
  - "Epic: Authentication" (lowercase e)
- **Expected:** Deduplication or title normalization before card creation.
- **Actual:** Both created as separate cards.
- **Fix suggestion:** Add title normalization in create_card tool or add a check for existing cards with similar titles.

### BUG-T06: llm_usage_userId_fkey Foreign Key Violation
- **Severity:** HIGH
- **Agent:** System (LLM Gateway)
- **Description:** When pipeline runs autonomously (SA delegating to PM), `logUsage()` tries to insert LLMUsage with `userId: "system"` which doesn't exist in the users table.
- **Error:** `P2003: Foreign key constraint violated on the constraint: llm_usage_userId_fkey`
- **Expected:** Pipeline calls should use null userId or a system user record.
- **Actual:** Crashes with FK violation, potentially losing usage tracking data.
- **Fix suggestion:** Set `userId: null` for pipeline/system calls, or create a system user record.

### BUG-T07: SDD Document Is Significantly Shorter Than BRD
- **Severity:** MEDIUM
- **Agent:** SA (Solution Architect)
- **Description:** SDD is only 4,223 characters vs BRD's 15,362 (27% the size). An SDD should be at least as detailed as the BRD it's based on.
- **Expected:** SDD should contain: tech stack justification, database schema, API endpoints, security architecture, deployment architecture, integration details — typically 10,000+ chars.
- **Actual:** SDD appears to be a summary rather than a complete system design.
- **Fix suggestion:** SA's system prompt should enforce minimum SDD sections and detail level. May need multiple LLM calls to build SDD progressively (like BA does with BRD).

### BUG-T08: Option Bubble Click Sent Wrong Text
- **Severity:** LOW
- **Agent:** UI (Chat Component)
- **Description:** When clicking option B "Warm and friendly" for design style, the sent message was "Something else — I'll describe my design idea" instead.
- **Expected:** Clicking B should send "Warm and friendly (soft colors, playful illustrations)"
- **Actual:** Sent text from option D/E instead.
- **Note:** May be a click target issue (bubble hitbox) rather than logic bug.
- **Fix suggestion:** Verify bubble click handlers map to correct option text. Test with different viewport sizes.

### BUG-T09: Worker Schema Mismatch — ColumnNotFound
- **Severity:** MEDIUM
- **Agent:** System (Worker)
- **Description:** BullMQ worker (ats-worker) throws `ColumnNotFound` error when trying to insert LLMUsage records. The bundled worker.mjs has a stale Prisma schema.
- **Error:** `P2022: ColumnNotFound at LLMUsage`
- **Expected:** Worker's schema should match the database.
- **Actual:** Worker was built with older schema missing columns.
- **Fix suggestion:** Rebuild worker Docker image after schema changes: `docker-compose build worker`

---

## Previously Known Bugs (from prior test round)
- BUG-004: LLM timeouts >90s — **Still present** (observed with Mistral before switching)
- BUG-005: "Can't do" text before tool execution — **Not observed** in this test
- BUG-006: Duplicate security task cards — **Not tested** (SEC agent not triggered)
