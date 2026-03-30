# Full Test Log — Pet Care Booking Platform
**Test Date:** 2026-03-30
**Tester:** Claude (automated via Chrome Extension)
**LLM Provider:** Ollama → gpt-oss:120b-cloud (switched from Mistral devstral-latest due to 429 rate limits)
**App URL:** http://localhost:14001 (Docker)

---

## Timeline

| Time  | Action | Agent | Notes |
|-------|--------|-------|-------|
| 14:00 | Login as user@demo.com | — | Auto-login via NextAuth dev mode |
| 14:00 | Open project wizard | — | 4-step wizard loaded correctly |
| 14:00 | Step 1: Name + Description | — | "Pet Care Booking Platform" + full description |
| 14:00 | Step 2: Target Audience | — | Pet owners + small business providers |
| 14:01 | Step 3: Priorities | — | High quality, Beautiful design, Security |
| 14:01 | Step 4: Review + Color | — | Teal selected, clicked "Start Project" |
| 14:01 | Project created | System | Auto-navigated to chat, BA auto-kickoff queued |
| 14:01 | BA kickoff failed | BA | Mistral 429 rate limit — 3 retries all failed |
| 14:03 | Switched LLM to Ollama | Admin | gpt-oss:120b-cloud via admin_settings DB update |
| 14:05 | First BA message sent | User | "Let's start from the beginning..." |
| 14:05 | BA responds — Q1: Core features | BA | Options A-H with clickable chips |
| 14:06 | User answers: All features A-G | User | Typed natural response |
| 14:07 | BA responds — Q2: User roles | BA | Pet owners, Providers, Admin, Guests |
| 14:07 | User answers: All 4 roles | User | Typed natural response |
| 14:08 | BA responds — Q3: Visual style | BA | A/B/C options, clicked bubble "Something else" |
| 14:08 | BA responds — Q4: Device support | BA | Clicked "All of above — fully responsive" ✅ |
| 14:09 | BA responds — Q5: Authentication | BA | Selected Email+Social+Guest via bubbles ✅ |
| 14:11 | BA responds — Q6: Homepage headline | BA | Typed "Your Pet Deserves the Best Care" |
| 14:12 | BA responds — Q7: CTA button | BA | Clicked "Find a Provider" bubble |
| 14:14 | BA responds — Q8: Core features (REPEAT) | BA | **BUG: Repeated Q1** — selected all via bubbles |
| 14:14 | BA responds — Q9: Visual style (REPEAT) | BA | **BUG: Repeated Q3** — clicked A |
| 14:14 | BA responds — Q10: Device support (REPEAT) | BA | **BUG: Repeated Q4** — clicked responsive |
| 14:15 | BA responds — Q11: Auth methods (REPEAT) | BA | **BUG: Repeated Q5** — user asked for BRD |
| 14:16 | BA generates BRD | BA | Tool calls: update_document × 2 |
| 14:18 | BRD displayed in chat | BA | 15,362 chars, 14 sections |
| 14:19 | BRD approved | User | Clicked "Looks great — approved!" |
| 14:19 | BA hands off to SA | BA → SA | Automatic delegation |
| 14:20 | SA reports create_decision tool bug | SA | Loop detector flagged repeated tool calls |
| 14:20 | User approves SA workaround | User | "Proceed without decision-recording tool" |
| 14:20 | SA starts autonomous pipeline | SA | create_document, remember, create_card, consult_agent |
| 14:21 | SDD created | SA | 4,223 chars — **BUG: Much shorter than BRD** |
| 14:22 | PM auto-triggered by pipeline | PM | Created 27 task cards (EPICs, FEATUREs, TASKs) |
| 14:25 | Pipeline still running | SA/PM | Multiple agent delegations in background |

---

## Bugs Found During Test

| ID | Severity | Description | Agent |
|----|----------|-------------|-------|
| BUG-T01 | HIGH | Mistral 429 rate limits — app retries 3x then fails silently, no user-facing error message | System |
| BUG-T02 | MEDIUM | BA asks repeated questions (device support, auth, core features, visual style all repeated) | BA |
| BUG-T03 | MEDIUM | SA tries to create_card (PM's responsibility, not SA's) — role boundary violation | SA |
| BUG-T04 | LOW | SA's create_decision tool flagged by loop detector — false positive on first use | SA |
| BUG-T05 | LOW | Duplicate EPICs created: "EPIC: Authentication" and "Epic: Authentication" (case difference) | PM |
| BUG-T06 | HIGH | llm_usage_userId_fkey foreign key constraint violation — user tracking broken for pipeline calls | System |
| BUG-T07 | MEDIUM | SDD is only 4,223 chars vs BRD's 15,362 — significantly less detailed | SA |
| BUG-T08 | LOW | Bubble click sent wrong text — "Something else" instead of "Warm and friendly" for design style | UI |
| BUG-T09 | LOW | ColumnNotFound error in worker for LLMUsage model (schema mismatch in Docker bundle) | System |

---

## Test Environment
- macOS Darwin 24.6.0
- Docker Desktop: ats-app, ats-worker, ats-postgres (14000), ats-redis (14003)
- App: Next.js 16.1.6 on port 14001
- Initial LLM: Mistral devstral-latest (rate limited)
- Final LLM: Ollama gpt-oss:120b-cloud (120B params, cloud-hosted)
- Browser: Chrome with Claude in Chrome extension
