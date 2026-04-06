# Bug Report — Codanium

**Project:** BA Test - Craft Store
**Report Date:** 2026-03-30
**Tester:** Claude Code (Playwright automation)

---

## Bug Summary

| # | ID | Title | Severity | Component | Status | Found |
|---|-----|-------|----------|-----------|--------|-------|
| 1 | BUG-001 | Base prompt text-marker vs tool-call contradiction | HIGH | `prompt-base.ts` | FIXED | 2026-03-30 |
| 2 | BUG-002 | Router conversation continuity blocks agent handoff | HIGH | `router.ts` | FIXED | 2026-03-30 |
| 3 | BUG-003 | PM creates only EPIC cards, no granular tasks | MEDIUM | PM agent prompt | FIXED (via BUG-002) | 2026-03-30 |
| 4 | BUG-004 | LLM response timeouts >90s cause missed rounds | LOW | Gateway/provider | OPEN | 2026-03-30 |
| 5 | BUG-005 | SA first response includes "don't have capability" text | LOW | SA prompt | OPEN | 2026-03-30 |
| 6 | BUG-006 | Duplicate security task cards created (same title, diff IDs) | LOW | SEC/tool-executor | FIXED | 2026-03-30 |
| 7 | BUG-007 | Router has no intent patterns for 14 of 23 agents | HIGH | router.ts, types.ts | FIXED | 2026-03-30 |
| 8 | BUG-008 | BA/SA re-activated after project entered building phase | MEDIUM | router.ts | FIXED | 2026-03-30 |
| 9 | BUG-009 | JD unreachable — "need" in message matches cost_query before new_requirement | LOW | router.ts | FIXED (via BUG-012) | 2026-03-30 |
| 10 | BUG-010 | SM unreachable — "API keys" matches architecture intent | LOW | router.ts | FIXED (via BUG-012) | 2026-03-30 |
| 11 | BUG-011 | PRE unreachable — "rounds"/"test" in prompt message matches testing intent | LOW | router.ts | FIXED (via BUG-012) | 2026-03-30 |
| 12 | BUG-012 | Intent pattern ordering — broad patterns (cost_query, testing) match before specific ones | MEDIUM | router.ts | FIXED | 2026-03-30 |

---

## BUG-001: Base Prompt Text-Marker vs Tool-Call Contradiction

**Severity:** HIGH
**Status:** FIXED
**Component:** `src/lib/ai/agents/prompt-base.ts`
**Found during:** PM agent test

### Description
The `AGENT_BASE_PROMPT` instructed agents to use text-based action markers (`[CREATE_CARD]`, `[DELEGATE:XX]`) for side effects. However, individual agent prompts (PM, SA) instructed agents to use structured tool calls and explicitly said "NEVER write tool calls as text." This contradiction caused agents to:
- Refuse to create cards claiming "I don't have the capability"
- Output text markers that weren't executed as tool calls
- Get confused between two conflicting instruction sets

### Steps to Reproduce
1. Send message to PM: "Create task cards from the BRD"
2. PM responds: "I don't have the capability to create task cards"
3. No cards created in database

### Root Cause
Line 23 of `prompt-base.ts`:
```
Use action markers for side effects: [CREATE_CARD], [CREATE_DOCUMENT], [DELEGATE:XX], [REMEMBER], etc.
```
Contradicts PM's own prompt:
```
Use the structured tool calling mechanism provided by the system.
IMPORTANT: Do NOT output [CREATE_CARD]{...} or similar text markers.
```

### Fix Applied
Updated `prompt-base.ts` to instruct agents to use structured tool calls:
```
Use the provided tools for all side effects: create_card, update_card, create_document, ...
Do NOT write text-based action markers like [CREATE_CARD]{...} — use the structured tool-calling mechanism.
```

### Files Changed
- `src/lib/ai/agents/prompt-base.ts` (lines 22-26)

---

## BUG-002: Router Conversation Continuity Blocks Agent Handoff

**Severity:** HIGH
**Status:** OPEN
**Component:** `src/lib/ai/orchestration/router.ts`
**Found during:** PM agent test

### Description
The message router has a priority system:
1. **Conversation continuity** — if last agent asked a question, reply to same agent
2. Explicit topic switch
3. Keyword intent classification
4. Default (BA)

Priority #1 (conversation continuity) **overrides** intent classification for phase-transition messages. When SA asks "Would you like to proceed? A) Yes B) No", the next user message always goes back to SA — even if the user says "create task cards" which should route to PM.

### Steps to Reproduce
1. Complete SA flow (SDD generated, SA asks approval question)
2. User sends: "The SDD is approved. Create task cards for the marketplace."
3. **Expected:** Router sends to PM (card_management intent)
4. **Actual:** Router sends to SA (conversation continuity rule)

### Impact
- PM agent was **never invoked** during testing (0 PM LLM calls)
- UX agent was **never invoked** during testing (0 UX LLM calls) — **confirmed same bug**
- SA handled card creation instead (created 4 EPICs)
- SA is not optimized for card management — produced only high-level EPICs instead of granular tasks
- Design tasks handled by non-specialist agents (SA/BA/CA instead of UX)

### Root Cause
`router.ts` line ~170-176: The `isApprovalOrAdvancement()` function detects phase-transition intent but conversation continuity check happens BEFORE it in the priority chain. The router needs to check for phase transitions FIRST and override continuity when detected.

### Fix Applied (2026-03-30)

Three changes in `src/lib/ai/orchestration/router.ts`:

1. **`isExplicitTopicSwitch()`** — card_management intent (`create task/card/sprint`) now checked BEFORE generic approval pattern. Also added UX design pattern matching.

2. **`resolveApprovalAgent()`** — NEW method: smart phase-aware routing for approval intent:
   - No BRD → BA (gather requirements)
   - BRD exists, no SDD → SA (architecture)
   - SDD exists, no cards → PM (task creation)
   - Cards exist → TL (implementation)

3. **`resolveRoute()`** — approval intent now calls `resolveApprovalAgent()` instead of static `ROUTING_TABLE['approval'] → BA`.

**Result:** Re-test created 9 FEATURE cards (up from 0 PM calls before). All 37 FRs covered.

### Files Changed
- `src/lib/ai/orchestration/router.ts` (isExplicitTopicSwitch, resolveApprovalAgent, resolveRoute)

---

## BUG-003: PM Creates Only EPIC Cards, No Granular Tasks

**Severity:** MEDIUM
**Status:** OPEN
**Component:** PM agent prompt in `src/lib/ai/agents/definitions/sdlc.ts`
**Found during:** PM agent test (SA handled instead)

### Description
When asked to create task cards from the BRD, only 4 high-level EPIC cards were created (one per module). No granular task cards with:
- Individual FR-ID references
- Acceptance criteria
- Sprint assignments
- Agent assignments (JD, SD, QA, etc.)

### Expected Behavior
PM should create ~20-30 granular task cards, e.g.:
- "Implement user registration API (FR-001)" → assigned to SD
- "Design registration form UI (FR-001)" → assigned to UX/JD
- "Write registration tests (FR-001)" → assigned to QA

### Cards Created (Actual)
| Title | Type | Priority |
|-------|------|----------|
| EPIC: Authentication Module | EPIC | HIGH |
| EPIC: User Profiles Module | EPIC | HIGH |
| EPIC: Product Listings Module | EPIC | HIGH |
| EPIC: Search and Filtering Module | EPIC | HIGH |

### Root Cause
SA (which handled the task) created EPICs rather than granular cards. PM's prompt has instructions for granular card creation, but PM was never invoked (see BUG-002). Additionally, the SA may not have enough context about the `create_card` tool's fields to populate acceptance criteria and sprint info.

### Suggested Fix
1. Fix BUG-002 first (routing) so PM actually handles card creation
2. Enhance PM prompt to explicitly output multiple `create_card` calls with:
   - FR-ID in title
   - Acceptance criteria in description
   - Sprint label
   - Assigned agent shortName

---

## BUG-004: LLM Response Timeouts >90s

**Severity:** LOW
**Status:** OPEN
**Component:** LLM Gateway / Mistral provider
**Found during:** SA and PM tests

### Description
Multiple LLM calls took longer than 90 seconds to respond, causing the Playwright test to report "No response within timeout." The responses were likely still processing but the test moved on.

### Frequency
- SA test: 4 out of 9 rounds timed out
- PM test: 3 out of 5 rounds timed out

### Impact
- Test automation misses responses (but LLM still processes them)
- In production, users would see long spinner/loading states
- Token costs are still incurred for timed-out responses

### Root Cause
- Mistral `devstral-latest` model has variable latency
- Large context windows (~20-25K tokens) increase processing time
- No server-side timeout/cancellation mechanism

### Suggested Fix
- Add configurable LLM timeout in gateway (default 120s)
- Implement streaming progress indicator in chat UI
- Consider context window optimization (trim old messages)

---

## BUG-005: SA First Response Includes "Don't Have Capability" Text

**Severity:** LOW
**Status:** OPEN
**Component:** SA agent prompt / response handling
**Found during:** PM re-test

### Description
When transitioning from SA to card creation, SA's first response included contradictory text:
```
"I appreciate your confirmation! However, I must inform you that I currently
don't have the necessary tools or capabilities to create task cards..."
```
Followed immediately by actually creating cards. The LLM generates a refusal text first (from the old cached prompt context), then proceeds to execute the tools anyway.

### Impact
- Confusing UX — user sees "can't do it" then sees it done
- Undermines trust in the AI team

### Root Cause
The LLM's first token generation reflects uncertainty from the prompt contradiction (BUG-001, now fixed). The model hedges with a refusal, then the tool executor processes the tool calls anyway. With BUG-001 fixed, this should be reduced in future runs.

### Suggested Fix
- BUG-001 fix should resolve this
- Add post-processing filter to strip contradictory "can't do" messages when tool calls succeed

---

## Environment

| Component | Version/Detail |
|-----------|---------------|
| App | Codanium (Docker, port 14001) |
| Framework | Next.js 16 |
| Database | PostgreSQL (Docker, port 14000) |
| LLM Provider | Mistral API |
| LLM Model | devstral-latest |
| Testing Tool | Playwright (Chromium) |


---

---

## BUG-006: Duplicate Security Task Cards

**Severity:** LOW
**Status:** OPEN
**Component:** SEC agent / `tool-executor.ts`
**Found during:** Pipeline monitoring

### Description
SEC agent created duplicate task cards with identical titles but different IDs. For example:
- "SEC: Implement Proper Error Handling for OAuth" appears twice
- "SEC: Add Security Headers to API Responses" appears twice
- "SEC: Add Audit Logging for Sensitive Operations" appears twice

27 total cards in DB but only 22 unique titles.

### Root Cause
No deduplication check in `create_card` tool executor. When SEC runs multiple times (retries or re-delegations), it creates cards without checking if a card with the same title already exists.

### Suggested Fix
Add title deduplication in `handleCreateCard()`:
```typescript
const existing = await prisma.card.findFirst({
  where: { projectId, title: cardData.title }
});
if (existing) return existing; // skip duplicate
```

---

## BUG-007: Router Has No Intent Patterns for 14 of 23 Agents

**Severity:** HIGH
**Status:** FIXED
**Component:** `src/lib/ai/orchestration/router.ts`, `src/lib/ai/orchestration/types.ts`
**Found during:** Agent persona testing (round 2)

### Description
The message router's `INTENT_PATTERNS` and `ROUTING_TABLE` only cover 9 agents (BA, SA, PM, UX, TL, QA, CA, DO, ORC). The remaining 14 agents (JD, AT, PF, DEC, STC, AUD, PE, IE, SM, SR, LLM, PRE, SD, SEC) have **no intent classification patterns** and are unreachable via natural user messages. They can only be invoked via:
- Explicit `agentShortName` in the API request body
- Agent-to-agent delegation chains (e.g., TL delegates to SD/JD)

This means user messages like "help me decide on the payment gateway" get misclassified as `new_requirement` (matching "need"/"can you") and route to BA instead of DEC.

### Steps to Reproduce
1. Send message: "I need help deciding on the payment system. Should we go with Stripe, PayPal, or Square?"
2. **Expected:** Router classifies as `decision` intent → routes to DEC
3. **Actual:** Router classifies as `new_requirement` (matches "need") → routes to BA
4. BA creates a decision record via tool call, then delegates to SA — neither is the right agent

### Impact
- 14 agents are invisible to users — only reachable via internal delegation
- User intent is misclassified for decision, audit, performance, integration, secrets, monitoring, and optimization requests
- Wrong agents handle specialized tasks (BA handles decisions, QA handles test automation instead of AT, etc.)

### Root Cause
The `UserIntent` type in `types.ts` only defines 12 intents. The `ROUTING_TABLE` in `router.ts` only maps to 9 unique agents. No intent patterns exist for: `decision`, `audit`, `state_validation`, `performance`, `integration`, `secrets`, `monitoring`, `llm_optimization`, `prompt_optimization`.

### Fix Applied
1. **`types.ts`**: Added 9 new intent types to `UserIntent`: `decision`, `audit`, `state_validation`, `performance`, `integration`, `secrets`, `monitoring`, `llm_optimization`, `prompt_optimization`
2. **`router.ts`**: Added 9 new `INTENT_PATTERNS` entries with regex patterns for each new intent
3. **`router.ts`**: Added 9 new entries in `ROUTING_TABLE`: DEC, AUD, STC, PF, IE, SM, SR, LLM, PRE
4. **`router.ts`**: Added 9 new explicit topic switch patterns in `isExplicitTopicSwitch()`

### Agents Now Routable

| Intent | Agent | Example Trigger |
|--------|-------|----------------|
| `decision` | DEC | "help me decide", "compare pros and cons", "Stripe vs PayPal" |
| `audit` | AUD | "audit the phase", "quality gate check", "everything complete?" |
| `state_validation` | STC | "check card states", "task stuck", "board correct?" |
| `performance` | PF | "performance targets", "bottleneck", "page speed" |
| `integration` | IE | "integrate Stripe", "third-party API", "webhook setup" |
| `secrets` | SM | "manage secrets", "API key security", "credential rotation" |
| `monitoring` | SR | "set up monitoring", "alerting", "site goes down" |
| `llm_optimization` | LLM | "AI cost optimization", "cheaper model", "reduce token spend" |
| `prompt_optimization` | PRE | "optimize prompts", "fewer rounds", "prompt efficiency" |

### Still Only Delegation-Routable

| Agent | Reason | Delegated From |
|-------|--------|---------------|
| JD (Junior Dev) | Tasks assigned by TL based on complexity | TL |
| SD (Senior Dev) | Tasks assigned by TL based on complexity | TL |
| AT (Automation Test) | Could add `test_automation` intent, but currently QA handles testing | QA/TL |
| SEC (Security) | Triggered by TL during code review pipeline | TL |
| PE (Platform Engineer) | Overlaps with DO for infra; could add separate intent | — |

### Files Changed
- `src/lib/ai/orchestration/types.ts` (UserIntent — added 9 intents)
- `src/lib/ai/orchestration/router.ts` (INTENT_PATTERNS, ROUTING_TABLE, isExplicitTopicSwitch)

---

## BUG-008: BA/SA Re-activated After Project Entered Building Phase

**Severity:** MEDIUM
**Status:** OPEN
**Component:** `src/lib/ai/orchestration/router.ts`
**Found during:** Agent persona testing (round 2)

### Description
When the project is in the building phase (BRD done, SDD done, 22 cards exist, code being generated), sending a decision-related message causes BA to respond and auto-delegate to SA. BA should not be the default handler at this stage.

The `shouldRedirectFromBA()` method checks for BRD existence and Requirement Gathering phase completion, but the redirect only happens for **conversation continuity** and **general intent** routing. When keyword routing classifies a message as `new_requirement`, it goes directly to BA without checking `shouldRedirectFromBA()`.

### Steps to Reproduce
1. Project has BRD, SDD, 22 cards, active development
2. Send: "I need help deciding on the payment system"
3. Router classifies as `new_requirement` (matches "need")
4. BA responds, creates a decision, then delegates to SA
5. SA starts answering architecture questions about payments

### Root Cause
The `new_requirement` intent pattern is too broad — `/\b(need|want|can you|create)\b/` matches almost any user message. When combined with the lack of `decision` intent (BUG-007), decision requests are misrouted to BA.

### Suggested Fix
1. BUG-007 fix (add `decision` intent) resolves the classification issue
2. Additionally: check `shouldRedirectFromBA()` for ALL intents routed to BA, not just conversation continuity
3. Move `new_requirement` patterns to the END of the pattern list (lowest priority)

### Files Changed
- `src/lib/ai/orchestration/router.ts` (pattern ordering — `new_requirement` moved last)

---

## BUG-009: JD Agent Unreachable via Natural User Messages

**Severity:** LOW
**Status:** OPEN
**Component:** `src/lib/ai/orchestration/router.ts`
**Found during:** Agent persona testing (round 2, test 05)

### Description
Message "I need a simple product card component built for the store..." was routed to CA (Cost Analyst) instead of JD (Junior Developer). The word "need" matched the `cost_query` pattern before any code-related intent could match.

### Root Cause
JD has no dedicated intent — code tasks are meant to flow through TL who delegates to JD/SD based on complexity. However, the broad `cost_query` pattern `/\b(need)\b/` (actually from `new_requirement`) captures the message first. The `cost_query` pattern matched "how much" or similar.

### Suggested Fix
JD should remain delegation-only (via TL). Alternatively, add a `simple_coding` intent that routes directly to JD for explicitly simple tasks.

---

## BUG-010: SM Agent Unreachable — "API keys" Matches Architecture Intent

**Severity:** LOW
**Status:** OPEN
**Component:** `src/lib/ai/orchestration/router.ts`
**Found during:** Agent persona testing (round 2, test 11)

### Description
Message about managing API keys for Stripe, SendGrid, Google, AWS was routed to SA (Solution Architect) because "API" matched the `architecture` intent pattern `/\b(api)\b/`. The `secrets` intent pattern exists but `architecture` appears earlier in the pattern list.

### Root Cause
The `architecture` pattern has `/\b(api)\b/` which is too broad — it matches any message mentioning "API" regardless of context. The `secrets` intent patterns are checked later and never reached.

### Suggested Fix
1. Move `secrets` intent BEFORE `architecture` in `INTENT_PATTERNS`
2. Make `architecture` pattern more specific: require "API" in combination with "design/structure/endpoint" not just standalone

---

## BUG-011: PRE Agent Unreachable — "rounds"/"test" Matches Testing Intent

**Severity:** LOW
**Status:** OPEN
**Component:** `src/lib/ai/orchestration/router.ts`
**Found during:** Agent persona testing (round 2, test 14)

### Description
Message about optimizing the BA agent's prompt ("takes 10 rounds of questions") was routed to QA because the `testing` intent matched before `prompt_optimization`. Words like "test" and "rounds" triggered the testing pattern.

### Root Cause
The `testing` intent pattern `/\b(test)\b/` is extremely broad and matches any message containing "test" in any context.

### Suggested Fix
Make `prompt_optimization` check happen BEFORE `testing` in the pattern list, or make `testing` patterns more specific (e.g., require "run tests" or "test suite" not just the word "test").

---

## BUG-012: Intent Pattern Ordering Causes Broad Matches to Swallow Specific Intents

**Severity:** MEDIUM
**Status:** OPEN
**Component:** `src/lib/ai/orchestration/router.ts`
**Found during:** Agent persona testing (round 2)

### Description
The `INTENT_PATTERNS` array uses first-match-wins ordering. Broad patterns like `cost_query` (`/\b(cost|budget|price|money|how much)\b/`), `testing` (`/\b(test)\b/`), and `architecture` (`/\b(api)\b/`) appear early in the list and match messages that should go to more specific agents.

### Impact
4 of 14 test messages were misrouted due to pattern ordering:
- JD test → matched CA (cost_query caught "need")
- SM test → matched SA (architecture caught "API")
- LLM test → matched CA (cost_query caught "cost")
- PRE test → matched QA (testing caught "test")

### Suggested Fix
1. Reorder `INTENT_PATTERNS` from **most specific** to **most broad**
2. New specific intents (decision, audit, secrets, monitoring, performance, integration, prompt_optimization, llm_optimization) should appear BEFORE broad intents (testing, architecture, cost_query, new_requirement)
3. Make broad patterns more specific (require phrase combinations, not single keywords)

---

*Last updated: 2026-03-30*
