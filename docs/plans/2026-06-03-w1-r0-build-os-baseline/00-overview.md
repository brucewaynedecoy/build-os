# Build OS — Baseline Build Plan

> In v2, plans are directories. This is the `00-overview.md` entry point; capability and
> derived-output detail live in [`01-capability-build.md`](01-capability-build.md) and
> [`02-derived-outputs.md`](02-derived-outputs.md).

**Date:** 2026-06-03

**Repository:** Build OS (`./`)

**Purpose:** Provide a reviewable, prospective plan for building **Build OS** in `./system/` — the features/capabilities to implement, in dependency order — and for deriving the implementation work backlog (and, iteratively, the PRD source-of-truth) from it. Originating design: [`2026-06-03-build-os-architecture.md`](../../designs/2026-06-03-build-os-architecture.md).

## Objective

Decompose the approved Build OS architecture into implementable capability areas and a phased work backlog that an execution step can pick up. This is a greenfield build: `./system/` is largely unscaffolded apart from the first validated slice. The plan is complete when the capability set and dependency phasing are settled, the work-backlog placement and worker split are fixed, and every capability traces back to a decision in the design.

## Coordinate Decision

- Coordinate: `W1 R0`
- Classification: `new-wave`
- Evidence: the design's `## Intended Follow-On` declares `baseline-plan` with no `Coordinate Handoff`; `docs/plans/`, `docs/prd/`, and `docs/work/` hold no prior active Build OS rollout, so this defaults to `w1-r0`.

## Design Inputs

| Input | Format | Location | Confidence |
| ----- | ------ | -------- | ---------- |
| Build OS architecture (design of record) | Markdown | `docs/designs/2026-06-03-build-os-architecture.md` | authoritative |
| Playbook contract (built) | Markdown | `system/.os/contracts/playbook-contract.md` | authoritative |
| First slice — `PB-001` guardrail + operating routers + templates | Markdown | `system/.os/**`, `system/playbooks/**` | authoritative (validated) |

Open questions surfaced by the inputs — to promote into `docs/prd/03-open-questions-and-risk-register.md` when the PRD pass runs: promotion **enforcement** (documented convention vs. tooling/machinery).

## Existing Codebase Context

- Codebase status: greenfield <!-- system/ largely unscaffolded; build-layer make-docs installed; one validated slice exists -->
- Integration constraints: respect the make-docs plug-in boundary (`PB-001`); `AGENTS.md`-canonical / `CLAUDE.md`-pointer routers; plain-text data (NDJSON/CSV, Markdown) before heavier stores; configured scope metadata.
- Discovery pass required: light — workers read the design + the first-slice contracts before writing.
- Discovery scope if required: `system/.os/contracts/`, `system/playbooks/`, the design doc.

## Output Contract

- Plan directory: `docs/plans/2026-06-03-w1-r0-build-os-baseline/`
  - entry point: `00-overview.md`
  - phase files: `01-capability-build.md`, `02-derived-outputs.md`, `03-intake-conversion.md`
- **Active derived output — work backlog:** `docs/work/2026-06-03-w1-r0-build-os-baseline/`
- **Deferred derived output — PRD source-of-truth:** `docs/prd/` (fixed core `00–04` + adaptive per-capability docs); derivable from this plan, authored on a later PRD pass, and coordinated through [`02-derived-outputs.md`](02-derived-outputs.md).

## Existing PRD Handling

- Active `docs/prd/` status: empty (routers only)
- Archive step required before execution: no
- Planned archive target if approved: n/a
- Active root entries to archive: none

## Coordinator Policy

- Highest intended delegation tier: parallel agents → subagents → single-agent fallback (per harness)
- Coordinator role: `coordination only`
- Coordinator write scope: `none` when delegation is available
- Coordinator responsibilities: preflight, approvals, routing, worker spawning, progress tracking, blocker handling, final status reporting.

## Scope & Phasing

- Phasing strategy: incremental (mvp-then-iterate)
- Phase boundaries driven by: technical dependency

Capability areas and their dependency phases are detailed in [`01-capability-build.md`](01-capability-build.md). Summary:

| Phase | Capability area | Key deliverables | Depends on |
| ----- | --------------- | ---------------- | ---------- |
| P1 | Operating layer & contracts | remaining `.os/contracts/*`, scaffolded routers/dirs | — (extends built slice) |
| P2 | Spaces, boundary & shipping | boundary guardrails, `system/.gitignore`, router augmentation | P1 |
| P3 | Intake / conversion | `buildos-intake` Go CLI, thin wrappers, provenance, `references.json` | P1, W1 R2 prerequisite |
| P4 | Data layer & extraction | entity JSONL, candidate staging, load-plans, `playbooks.json` | P1, P3 |
| P5 | Playbooks | templates, category routers, seed playbooks | P1, P4 |
| P6 | Discovery, runs & qualification | `workspace/runs`+`findings`, Playwright qualification, computer-use | P4, P5 |
| P7 | Flow C integration | qualified-finding → `system/docs/designs/` hand-off | P6 |
| P8 | Stage automation | hooks + slash-commands for stage-movers | P3–P7 |

Cross-cutting throughout: `env`/`for` tagging; validation.

## Proposed Catalog

The capability areas above are the unit of decomposition. Each maps to one work-backlog phase now, and to one adaptive PRD doc (`05`+) when the PRD pass runs, alongside the fixed PRD core (`00-index`, `01-product-overview`, `02-architecture-overview`, `03-open-questions-and-risk-register`, `04-glossary`). The tree stays flat — one doc per capability area is readable at this scale.

## Worker Ownership

Full split in [`02-derived-outputs.md`](02-derived-outputs.md). Summary:

| Worker | Scope | Write Scope | Dependencies | Deliverables |
| ------ | ----- | ----------- | ------------ | ------------ |
| Scoping | read design + first slice; derive task list | none | — | phase/task outline |
| Backlog authors (per phase) | one work phase file each | that phase file | scoping | `0N-<phase>.md` |
| Assembly | backlog index + cross-links | `00-index.md` | backlog authors | coherent index |
| Validation | coverage + link integrity | none | all | validation report |

The coordinator owns no document-writing task when delegation is available.

## MCP Strategy

- Preferred servers available: jcodemunch (code), jdocmunch (docs) — confirm in-session per `system/docs/assets/references/harness-capability-matrix.md`.
- Fallback plan if unavailable: direct `Read`/`Grep` within the operational subtrees.

## Acceptance Criteria Guidance

- Criteria style: checklist
- Each backlog task carries acceptance criteria traceable to a specific design decision.
- Non-functional concerns to address per capability: agent-operability, the determinism boundary (convert vs. extract), git-native reviewability, plug-in-boundary discipline, and router navigability.

## Validation

Execution of this plan is validated when:

- every capability area in `01-capability-build.md` is covered by at least one backlog phase;
- every backlog task traces back to a design decision — no orphans, no unreachable items;
- the open question (promotion enforcement) is recorded and does not silently block the backlog;
- cross-references between the plan, the design, and the backlog resolve;
- no planned task violates the make-docs plug-in boundary (`PB-001`).

A final review pass over the backlog closes the plan.
