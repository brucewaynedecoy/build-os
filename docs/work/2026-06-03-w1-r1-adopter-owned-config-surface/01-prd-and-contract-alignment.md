# Phase 01: PRD and Contract Alignment

## Purpose

Establish the active PRD requirements for adopter-owned config before operational contracts, templates, scripts, or frontmatter are changed.

## Overview

This phase evolves the active PRD namespace in place. It adds a new PRD change doc, updates the PRD index, and annotates affected baseline docs with `### Change Notes` so the fixed `env`/`for` vocabulary is superseded by configured `systems`, `environments`, and `owners` without silently rewriting historical baseline text.

## Source PRD Docs

- `docs/prd/00-index.md`
- `docs/prd/02-architecture-overview.md`
- `docs/prd/03-open-questions-and-risk-register.md`
- `docs/prd/06-operating-layer-and-routing.md`
- `docs/prd/08-data-and-extraction.md`
- `docs/prd/09-playbooks.md`
- Planned: `docs/prd/13-adopter-owned-config-surface.md`
- Source plan: [01-prd-and-contract-alignment.md](../../plans/2026-06-03-w1-r1-adopter-owned-config-surface/01-prd-and-contract-alignment.md)

## Stage 1 - Change Doc

### Tasks

- [ ] t1: Create `docs/prd/13-adopter-owned-config-surface.md` from `docs/assets/templates/prd-change-addition.md`.
- [ ] t2: Capture the config capability: `system/.os/config/instance.yaml`, `system/.os/contracts/config-contract.md`, `system/.os/templates/instance-config.yaml`, and `system/.os/scripts/validate_config.py`.
- [ ] t3: State the effective scoped field vocabulary: `systems`, `environments`, and `owners`; explicitly supersede `env`, `for`, `envs`, `target_systems`, and sentinel values such as `both` as contract vocabulary.
- [ ] t4: Define validation requirements for config IDs, cross-references, defaults, and frontmatter hygiene.

### Acceptance criteria

- The new PRD change doc uses all required `prd-change-addition.md` headings.
- The change doc cites the source design and relevant operational paths.
- The effective requirement includes validation and frontmatter hygiene in the initial implementation scope.

### Dependencies

- Source design [2026-06-03-adopter-owned-config-surface.md](../../designs/2026-06-03-adopter-owned-config-surface.md).
- Q-002 closure in `docs/prd/03-open-questions-and-risk-register.md`.

## Stage 2 - Index and Baseline Annotations

### Tasks

- [ ] t5: Update `docs/prd/00-index.md` to include `13-adopter-owned-config-surface.md` and its related baseline docs.
- [ ] t6: Add `### Change Notes` to `docs/prd/02-architecture-overview.md` explaining `system/.os/config/` and config-backed scoped fields.
- [ ] t7: Add `### Change Notes` to `docs/prd/06-operating-layer-and-routing.md` describing config as an operational authority alongside contracts, templates, indexes, data, and scripts.
- [ ] t8: Add `### Change Notes` to `docs/prd/08-data-and-extraction.md` requiring scoped structured rows to use configured `systems`, `environments`, and `owners`.
- [ ] t9: Add `### Change Notes` to `docs/prd/09-playbooks.md` replacing `env`/`for` playbook frontmatter with config-backed scoped lists.
- [ ] t10: Add `### Change Notes` to `docs/prd/10-discovery-runs-and-qualification.md`, `docs/prd/11-flow-c-integration.md`, and `docs/prd/12-stage-automation.md` for scoped metadata propagation and validation.
- [ ] t11: Leave Q-002 closed, updating `docs/prd/03-open-questions-and-risk-register.md` only if execution discovers new drift.

### Acceptance criteria

- Each impacted baseline doc links or clearly points to `docs/prd/13-adopter-owned-config-surface.md`.
- Existing PRD files are not renumbered or archived.
- `docs/prd/00-index.md` reflects the new change doc and related baseline docs.
- Q-002 remains closed and consistent with the new PRD change doc.

### Dependencies

- Stage 1 must create the change doc before backlinks are added.
- Use `docs/assets/references/prd-change-management.md` and `docs/assets/references/output-contract.md` for change-note format.
