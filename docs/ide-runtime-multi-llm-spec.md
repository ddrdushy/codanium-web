# IDE Runtime & Multi-LLM Orchestration Architecture

> Saved from design spec. Governs IDE execution model and LLM fault tolerance.

## Core Principles

1. **IDE-Centric Execution** — After design phases, all execution happens inside Tauri v2 IDE
2. **Multi-LLM First-Class** — LLMs are unreliable resources; routing + fallback is mandatory
3. **Zero Single Point of Failure** — No agent operation fails due to rate limits, token overflow, or model downtime
4. **Deterministic Recovery** — Every LLM call is retryable, replaceable, resume-safe

## IDE Execution Gate

```
IF BRD == APPROVED AND SDD == APPROVED → IDE_HANDOVER_EVENT
IF IDE != OPEN → Execution phase cannot start (heartbeat check)
```

## IDE Boot Sequence

1. Load board state
2. Load BRD (locked) + SDD (locked)
3. Initialize workspace
4. Resume pending execution card
5. Activate TL control

## LLM Resolution Priority

```
BYOM (if enabled) → User BYOK → Agent override → Project override → Platform fallback chain
```

## LLM Retry Strategy

| Attempt | Action |
|---------|--------|
| 1 | Primary LLM |
| 2 | Retry Primary |
| 3 | Fallback LLM |
| 4 | BYOM |
| All fail | Mark task BLOCKED, notify system |

## Token Budget Per Task

| Task | Limit |
|------|-------|
| Chat response | 500 tokens |
| Section generation | 1500 tokens |
| Code block | 2000 tokens |

## LLM Routing (Task Classification)

| Task | Preferred Model |
|------|-----------------|
| BRD/SDD writing | High-quality (Claude, GPT-4o) |
| Code generation | Fast + capable (Codestral, DeepSeek) |
| Small responses | Lightweight (Groq, Mistral) |

## Architecture Layers

1. IDE Layer (Tauri v2) — execution engine
2. Agent Layer (BA, SA, TL, etc.) — domain logic
3. LLM Router Layer — model selection, fallback, retry
4. Artifact Layer — incremental saves, locking, versioning
5. Decision & State Layer — FSM, gates, audit trail
