# BuildOS Toolkit CLI Deployment Standard Work Backlog

> In v2, work backlogs are directories. This is the `00-index.md` entry-point file. Phase detail lives in sibling `0N-<phase>.md` files. See `docs/assets/references/wave-model.md` for W/R semantics.

## Purpose

Track the W1 R2 prerequisite work that establishes packaged first-party `buildos-*` toolkits as the Build OS standard for durable deterministic logic before W1 R0 P3 resumes.

## Phase Map

| Phase | File | Focus |
| --- | --- | --- |
| P1 | [01-prd-guide-design-lineage.md](./01-prd-guide-design-lineage.md) | PRD 14, affected baseline notes, developer guide, and design records. |
| P2 | [02-toolkit-scaffold-validation.md](./02-toolkit-scaffold-validation.md) | `toolkits/` scaffold, `buildos-intake` scaffold, README routing, validation, and index refresh. |

## Usage Notes

- This backlog is a closeout/backfill for W1 R2 because the prerequisite implementation landed before the plan/work lineage.
- Keep this backlog scoped to the toolkit deployment standard. Do not add converter behavior here.
- W1 R0 P3 should consume this work by planning `buildos-intake` implementation under `toolkits/buildos-intake/`.
- make-docs-owned assets should change upstream first and be imported back later.
