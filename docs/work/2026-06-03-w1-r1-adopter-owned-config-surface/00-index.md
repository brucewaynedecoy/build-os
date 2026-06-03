# Adopter-Owned Config Surface Work Backlog

> In v2, work backlogs are directories. This is the `00-index.md` entry-point file. Phase detail lives in sibling `0N-<phase>.md` files. See `docs/assets/references/wave-model.md` for W/R semantics.

## Purpose

Implement the W1 R1 adopter-owned config surface change derived from [the W1 R1 plan](../../plans/2026-06-03-w1-r1-adopter-owned-config-surface/00-overview.md) and [the source design](../../designs/2026-06-03-adopter-owned-config-surface.md). This backlog is a delta backlog against the W1 R0 baseline; it does not replace the baseline backlog.

## Phase Map

| Phase | File | Focus |
| --- | --- | --- |
| P1 | [01-prd-and-contract-alignment.md](./01-prd-and-contract-alignment.md) | Add the active PRD change doc, index entry, and baseline annotations. |
| P2 | [02-operating-config-surface.md](./02-operating-config-surface.md) | Add config contract, canonical config, starter template, and router entries. |
| P3 | [03-migration-and-validation.md](./03-migration-and-validation.md) | Migrate scoped fields and implement `validate_config.py` plus frontmatter hygiene. |

## Usage Notes

- Execute phases in order: P1 defines the effective requirement, P2 creates the config authority, and P3 migrates callers plus validation.
- Keep this backlog scoped to W1 R1. Do not renumber or edit W1 R0 task IDs when implementing this delta.
- Planned PRD path `docs/prd/13-adopter-owned-config-surface.md` is not linked here because it is created during P1.
- Validation is part of implementation, not a deferred hardening step.
