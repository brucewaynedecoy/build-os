# Phase 03: Migration and Validation

## Purpose

Migrate scoped artifact vocabulary to config-backed fields and make config/frontmatter validation part of the first implementation, not a later hardening pass.

## Overview

This phase updates the playbook contract and scoped artifacts to use `systems`, `environments`, and `owners`; then it adds `system/.os/scripts/validate_config.py` with frontmatter hygiene checks that can be reused by future index builders.

## Source PRD Docs

- Planned: `docs/prd/13-adopter-owned-config-surface.md`
- `docs/prd/08-data-and-extraction.md`
- `docs/prd/09-playbooks.md`
- `docs/prd/10-discovery-runs-and-qualification.md`
- `docs/prd/11-flow-c-integration.md`
- `docs/prd/12-stage-automation.md`
- Source plan: [03-migration-and-validation.md](../../plans/2026-06-03-w1-r1-adopter-owned-config-surface/03-migration-and-validation.md)

## Stage 1 - Scoped Field Migration

### Tasks

- [x] t1: Update `system/.os/contracts/playbook-contract.md` to replace the fixed `env`/`for` row with `systems`, `environments`, and `owners` list fields.
- [x] t2: Migrate scoped frontmatter in `system/playbooks/**/*.md` to configured `systems`, `environments`, and `owners` IDs.
- [x] t3: Update data contract drafts or placeholders so entity rows, run records, findings, generated indexes, and handoff metadata use the same configured field names.
- [x] t4: Update any work or PRD references that still prescribe fixed scoped vocabulary after the effective PRD change lands.
- [x] t5: Preserve explicit migration notes where legacy terms need to be mentioned for transition context.

### Acceptance criteria

- Playbook contract field names match the config design and PRD change doc.
- Scoped playbook frontmatter uses configured IDs from `system/.os/config/instance.yaml`.
- Active scoped docs and contracts no longer prescribe fixed first-engagement vocabulary.
- Remaining legacy mentions are clearly historical, transitional, or planned cleanup notes.

### Dependencies

- Phase 02 config contract and canonical config.
- Phase 01 PRD change doc and baseline annotations.

## Stage 2 - Config Validator

### Tasks

- [x] t6: Implement `system/.os/scripts/validate_config.py`.
- [x] t7: Validate config shape against `system/.os/contracts/config-contract.md`.
- [x] t8: Check unique IDs, slug format, `environments[].systems` references, and `defaults.*` references.
- [x] t9: Add script output that reports precise file paths and field paths for validation failures.
- [x] t10: Add focused tests or built-in test fixtures for duplicate IDs, invalid slugs, missing references, and invalid defaults.

### Acceptance criteria

- `python3 system/.os/scripts/validate_config.py` succeeds against the shipped starter config.
- Invalid config cases fail with actionable diagnostics.
- The validator does not depend on adopter-specific values.

### Dependencies

- Stage 1 may proceed in parallel for contract migration, but validator success depends on the canonical config from Phase 02.

## Stage 3 - Frontmatter Hygiene

### Tasks

- [x] t11: Add frontmatter parsing for playbooks and other scoped Markdown artifacts.
- [x] t12: Verify `systems`, `environments`, and `owners` are lists of configured IDs.
- [x] t13: Reject legacy scoped fields `env` and `for` once migration is active.
- [x] t14: Structure the hygiene check so future index builders can call it independently from broad repository validation.
- [x] t15: Add validation notes or help text documenting how to run config validation and frontmatter hygiene.

### Acceptance criteria

- Frontmatter hygiene accepts configured scoped list fields.
- Frontmatter hygiene fails unconfigured IDs and legacy scoped fields.
- The hygiene check can be reused by future scripts without duplicating parsing rules.
- Validation notes point to the config contract instead of restating the full schema.

### Dependencies

- Stage 2 validator structure.
- Migrated scoped frontmatter from Stage 1.

## Stage 4 - Final Validation

### Tasks

- [x] t16: Run `python3 system/.os/scripts/validate_config.py` and capture pass/fail status in the phase closeout.
- [x] t17: Run docs path hygiene after PRD, work, and contract updates.
- [x] t18: Scan active docs/contracts for remaining fixed scoped vocabulary and classify any remaining matches.
- [x] t19: Refresh `jdocmunch` after docs updates and `jcodemunch` after script or contract-adjacent code updates if available.
- [x] t20: Record any unresolved migration debt in the PRD risk register or phase closeout instead of leaving it implicit.

### Acceptance criteria

- Config validation and frontmatter hygiene pass.
- Docs path hygiene passes.
- Remaining fixed-vocabulary matches are intentionally retained or have follow-up records.
- The final closeout names validation commands and any residual debt.

### Dependencies

- Stages 1-3.
- Completed PRD and contract updates from prior phases.

## Closeout Notes

- `python3 system/.os/scripts/validate_config.py` passes against `system/.os/config/instance.yaml`, `system/playbooks/**/*.md`, and `system/.os/templates/*playbook*.md`.
- Remaining fixed-vocabulary mentions are retained only in PRD/work change-note or migration contexts that explain the superseded `env`/`for` vocabulary; active operational contracts and scoped frontmatter use `systems`, `environments`, and `owners`.
- No unresolved migration debt was added to the PRD risk register.
