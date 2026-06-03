# Phase Detail: PRD and Contract Alignment

## P1 - PRD Change and Baseline Annotation

- Goal: establish the effective requirements for adopter-owned config before editing operational contracts or scripts.
- Deliverables: `docs/prd/13-adopter-owned-config-surface.md`, `docs/prd/00-index.md` update, and targeted `### Change Notes` annotations on impacted baseline PRD docs.
- Status: planned.

## Source Inputs

- [Adopter-Owned Config Surface](../../designs/2026-06-03-adopter-owned-config-surface.md)
- [Build OS Architecture](../../designs/2026-06-03-build-os-architecture.md)
- [Q-002 closure](../../prd/03-open-questions-and-risk-register.md)
- [W1 R0 baseline plan](../2026-06-03-w1-r0-build-os-baseline/00-overview.md)

## Workstreams

| Workstream | Owner | Output | Notes |
| --- | --- | --- | --- |
| Change doc | Worker A | `docs/prd/13-adopter-owned-config-surface.md` | Use `prd-change-addition.md`; describe new config capability plus migration semantics. |
| Index and lineage | Worker A | `docs/prd/00-index.md` | Append the new change doc; keep existing PRD numbers stable. |
| Baseline annotations | Worker A | `docs/prd/02-architecture-overview.md`, `06`, `08`, `09`, `10`, `11`, `12` | Add `### Change Notes` rather than silently rewriting baseline sections. |
| Drift cleanup notes | Worker A | `docs/prd/03-open-questions-and-risk-register.md` if needed | Q-002 is already closed; only update if execution discovers new drift. |

## Dependencies

- The design doc must remain the source of truth for config vocabulary names: `systems`, `environments`, and `owners`.
- The change doc should land before work backlog generation so implementation tasks can cite a PRD source instead of only the design.
- Baseline annotations should avoid broad rewrites; the goal is traceable active-set evolution.

## Acceptance Checks

- New PRD change doc uses the required template headings.
- Baseline annotations link back to the new change doc.
- `docs/prd/00-index.md` shows the new active change doc and related baseline docs.
- No existing PRD docs are renumbered or archived.
- Q-002 remains closed and points to the design and planned config artifacts.

## Execution Notes

This phase is documentation-only but gates the implementation work. Do not start contract or script changes until the effective PRD language is stable enough for Worker B, Worker C, and Worker D to cite.
