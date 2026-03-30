# LLM Usage Report — Pet Care Booking Platform Test
**Date:** 2026-03-30
**Provider:** Ollama (gpt-oss:120b-cloud)
**Project:** Pet Care Booking Platform (cmncs1nc1000001kodv5qb4jb)

---

## Summary

| Metric | Value |
|--------|-------|
| Total LLM Calls | 37 |
| Total Input Tokens | 587,349 |
| Total Output Tokens | 21,656 |
| Total Context Tokens | 587,349 |
| Total Tokens | 609,005 |
| Total Cost | $0.00 (Ollama — free local/cloud) |
| Input/Output Ratio | 27:1 (96.4% input, 3.6% output) |

---

## Usage by Agent

| Agent | Calls | Input Tokens | Output Tokens | Context Tokens | Total Tokens | % of Total | Cost |
|-------|-------|-------------|---------------|----------------|-------------|------------|------|
| **BA** | 28 | 454,223 | 13,321 | 454,223 | 467,544 | **76.8%** | $0.00 |
| **SA** | 9 | 133,126 | 8,335 | 133,126 | 141,461 | **23.2%** | $0.00 |
| **Total** | **37** | **587,349** | **21,656** | **587,349** | **609,005** | **100%** | **$0.00** |

---

## Token Distribution Analysis

### Input vs Output
- **Input tokens**: 587,349 (96.4%) — system prompts, project context, chat history
- **Output tokens**: 21,656 (3.6%) — agent responses, tool calls, content generation
- **Ratio**: 27:1 input-to-output — context window dominates cost

### Per-Agent Breakdown

#### BA (Business Analyst) — 76.8% of tokens
- **28 calls** over ~15 minutes of interaction
- Average input per call: 16,222 tokens
- Average output per call: 476 tokens
- **Key observation**: BA has highest call count due to multi-question discovery flow
- Each question-answer cycle = 1 LLM call with growing context
- Context grows linearly as conversation history accumulates

#### SA (Solution Architect) — 23.2% of tokens
- **9 calls** during autonomous pipeline mode
- Average input per call: 14,792 tokens
- Average output per call: 926 tokens (higher than BA — generates documents + tool calls)
- **Key observation**: SA output per call is ~2x BA's due to SDD generation and card creation

---

## Cost Projection (If Using Commercial APIs)

| Provider | Model | Est. Input Cost | Est. Output Cost | Est. Total |
|----------|-------|----------------|-----------------|-----------|
| OpenAI | gpt-4o | $1.47 | $0.22 | **$1.69** |
| OpenAI | gpt-4o-mini | $0.09 | $0.01 | **$0.10** |
| Anthropic | claude-sonnet-4 | $1.76 | $0.32 | **$2.09** |
| Anthropic | claude-haiku-4 | $0.47 | $0.09 | **$0.56** |
| Mistral | devstral-latest | $0.12 | $0.04 | **$0.16** |

*Based on standard API pricing as of March 2026*

---

## Efficiency Observations

1. **Context window is 96.4% of token usage** — optimizing system prompts and history pruning would significantly reduce costs
2. **BA has the most calls (28)** but each call's output is small (476 tokens avg) — lots of back-and-forth for discovery
3. **SA is more efficient per-call** — 9 calls producing document + 27 cards via pipeline
4. **The BA repeated 4 questions** — those 4+ extra calls wasted ~60K+ tokens unnecessarily
5. **Pipeline mode (SA→PM)** is efficient — autonomous work with no user interaction needed

---

## Recommendations

1. **Implement conversation summary** to reduce context window growth (biggest cost driver)
2. **Fix BA question repetition bug** — saves ~10-15% of BA's token budget
3. **Consider cheaper models for BA discovery** (simple Q&A doesn't need 120B params)
4. **Use larger models only for document generation** (BRD/SDD require strong reasoning)
