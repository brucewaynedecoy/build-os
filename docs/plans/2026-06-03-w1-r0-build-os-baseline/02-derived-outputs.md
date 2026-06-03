# Phase Detail — Derived Outputs

> How the work backlog (active) and the PRD source-of-truth (deferred) are derived from this plan.
> The capability areas are defined in [`01-capability-build.md`](01-capability-build.md).

## Active output — work backlog

- **Placement:** `docs/work/2026-06-03-w1-r0-build-os-baseline/`
  (matching this plan's `w1-r0` coordinate per the wave model).
- **Shape:** a `00-index.md` entry point plus one `0N-<phase>.md` file per capability phase
  (P1–P8 from `01-capability-build.md`), with cross-cutting tagging/validation folded into the
  relevant phases.
- **Tasks:** ordinal `- [ ] t1: …` checkbox items per phase file, numbered across the whole phase
  file (not reset per section), each with acceptance criteria traceable to a specific design decision.
- **Derivation rule:** each capability area's deliverables become tasks; built items from the first
  slice are recorded as already-satisfied so the backlog reflects true remaining work, not a rebuild.
- **No PRD dependency:** the backlog derives directly from this plan and the design; it does not block
  on the PRD pass.

## Worker ownership (execution)

Delegation-ready and disjoint, so an execution harness can parallelize safely.

| Worker | Scope | Write scope | Depends on | Deliverables |
| ------ | ----- | ----------- | ---------- | ------------ |
| Scoping | read the design + the first slice; confirm built-vs-remaining; derive the per-phase task outline | none | — | task outline |
| Backlog author (per phase) | own exactly one `0N-<phase>.md`; write its tasks + acceptance criteria | that phase file | scoping | one phase file |
| Assembly | `00-index.md`, cross-links, phase ordering | `00-index.md` | backlog authors | coherent backlog index |
| Validation | coverage (every capability → ≥1 task), link integrity, no `PB-001` violations | none | all | validation report |

The coordinator stays coordination-only with write scope `none` while delegation is available.

## Deferred output — PRD source-of-truth

The PRD set is the authoritative record of *what we are building*; it is derivable from this plan and
the design, and — per the team's practice — is most often authored or maintained after designs land or
after work completes. It is **not** required to produce the work backlog.

When the PRD pass runs, the anticipated catalog is:

- **Fixed core:** `00-index`, `01-product-overview`, `02-architecture-overview`,
  `03-open-questions-and-risk-register`, `04-glossary`.
- **Adaptive (one per capability area, `05`+):** spaces & boundary · intake/conversion · data layer &
  extraction · playbooks · discovery/runs/qualification · Flow C integration · agent routing & `.os` ·
  stage automation.
- Flat tree; the open question (promotion enforcement) seeds `03-open-questions-and-risk-register.md`.

## Validation

- Every capability area in `01-capability-build.md` maps to at least one backlog phase and task.
- Every backlog task cites the design decision it implements.
- Built-slice items appear as satisfied, not as new work.
- All cross-references (plan ↔ design ↔ backlog) resolve.
- No task instructs a change to a make-docs-managed tree in violation of `PB-001`.
