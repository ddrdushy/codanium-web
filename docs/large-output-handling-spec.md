# Large Output Handling & Artifact Generation Architecture

> Saved from design spec. Governs how BRD, SDD, and other large artifacts are generated reliably.

## Golden Rule

> Chat is for communication. Artifacts are for content.

## Section-Based Generation

Documents must be generated section-by-section, not in a single LLM call:

1. Generate outline (structure only)
2. For each section: call LLM, validate, save immediately via update_document(mode='append')
3. Compile sections into final document
4. Review and approve

## Token Budget Policy

| Type | Limit |
|------|-------|
| Chat Response | 300-800 tokens |
| Section Generation | 800-1500 tokens |
| Large Lists | Chunked |
| Final Summary | < 700 tokens |

## BRD Sections
01_overview, 02_objectives, 03_stakeholders, 04_functional_requirements,
05_non_functional_requirements, 06_constraints, 07_assumptions, 08_success_criteria

## SDD Sections
01_system_overview, 02_architecture, 03_components, 04_data_flow,
05_apis, 06_tech_stack, 07_security, 08_scalability, 09_error_handling, 10_assumptions

## Failure Handling
- Retry only failed section (max 2 retries)
- Never regenerate full document
- Resume from last completed section on restart

## Chat Rules
- Status updates and progress summaries OK
- Full BRD/SDD in chat NEVER OK
- Example: "BRD generation completed. 8/8 sections saved."

## Components
- DGE (Document Generation Engine) — breaks docs into sections, generates per-section
- ART (Artifact Controller) — ownership, locking, versioning
- CMP (Document Compiler) — merges sections into final
- OUT (Output Guard) — prevents oversize outputs, auto-switches to chunk mode
