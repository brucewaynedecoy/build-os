# Phase 02: Operating Config Surface

## Purpose

Add the adopter-owned configuration surface under the current operational namespace without renaming `system/` or `system/.os/`.

## Overview

This phase creates the config contract, starter template, canonical config file, and router entries needed before playbooks or data records can depend on configured `systems`, `environments`, and `owners`.

## Source PRD Docs

- Planned: `docs/prd/13-adopter-owned-config-surface.md`
- `docs/prd/02-architecture-overview.md`
- `docs/prd/06-operating-layer-and-routing.md`
- `docs/prd/09-playbooks.md`
- Source plan: [02-operating-config-surface.md](../../plans/2026-06-03-w1-r1-adopter-owned-config-surface/02-operating-config-surface.md)

## Stage 1 - Config Contract and Template

### Tasks

- [x] t1: Create `system/.os/contracts/config-contract.md` defining `version`, `instance`, `systems`, `environments`, `owners`, and `defaults`.
- [x] t2: Specify ID rules in the config contract: stable slug IDs, uniqueness within each collection, and no adopter-specific values in reusable contracts or templates.
- [x] t3: Specify cross-reference rules in the config contract for `environments[].systems` and `defaults.*`.
- [x] t4: Create `system/.os/templates/instance-config.yaml` with neutral example IDs and labels.
- [x] t5: Ensure the starter template can be copied directly into `system/.os/config/instance.yaml`.

### Acceptance criteria

- The config contract is authoritative enough for validators and artifact contracts to cite.
- The template contains no historical adopter, vendor, product, or engagement values.
- The template includes neutral `systems`, `environments`, `owners`, and `defaults` examples.

### Dependencies

- Phase 01 effective PRD language.
- Existing `.os/contracts/` and `.os/templates/` router conventions.

## Stage 2 - Canonical Config and Routers

### Tasks

- [x] t6: Create `system/.os/config/instance.yaml` from the neutral starter template.
- [x] t7: Add or update a router for `system/.os/config/` that describes the directory as adopter-owned configuration.
- [x] t8: Update `system/.os/AGENTS.md` to route config work to `config/`, `contracts/config-contract.md`, and `templates/instance-config.yaml`.
- [x] t9: Update `system/.os/contracts/AGENTS.md` to list `config-contract.md`.
- [x] t10: Update `system/.os/templates/AGENTS.md` to list `instance-config.yaml`.
- [x] t11: Add matching `CLAUDE.md` pointers only where the local router convention requires them.

### Acceptance criteria

- `system/.os/config/instance.yaml` exists and is discoverable from `.os` routing.
- Routers route operators to config, contract, and template locations without restating full schema details.
- The config surface remains path-contained and can move later if a namespace rename is approved.

### Dependencies

- Stage 1 config contract and template.
- Existing `AGENTS.md` canonical / `CLAUDE.md` pointer convention.
