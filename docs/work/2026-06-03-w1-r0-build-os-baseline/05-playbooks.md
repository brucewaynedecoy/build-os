# Phase 05: Playbooks (Pillar 2)

## Purpose

This phase delivers the instruments that guide humans and agents, with the review-to-activate lifecycle.

## Overview

Author procedure-playbook templates per category and execution mode, scaffold the remaining category routers, seed initial playbooks, and wire the `draft → reviewed → active` gate so only active playbooks run or are enforced.

## Source PRD Docs

- [09 Playbooks](../../prd/09-playbooks.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - Templates & routers

### Tasks

- [ ] t1: Author procedure-playbook template(s) in `system/.os/templates/` covering the three execution modes (explicit-steps, guided-objective, inferred-actions) and the stateful/standing variants.
- [x] t2: Author the guardrail-playbook template (`system/.os/templates/guardrail-playbook.md`).
- [ ] t3: Scaffold category routers for `build/`, `discovery/`, and `testing/` (administrative already exists), AGENTS-canonical with `CLAUDE.md` pointers.

### Acceptance criteria

- Templates conform to the playbook contract; procedure bodies vary by execution mode; guardrail bodies use Scope/Rules/Rationale.
- Category is carried as a property and directory, never encoded in the `id` (`PB-NNN`).

### Dependencies

- Phase 01 (playbook contract — delivered).

## Stage 2 - Seed playbooks & activation

### Tasks

- [ ] t4: Author at least one seed playbook per category, set to `status: draft`.
- [ ] t5: Wire the review-to-activate gate so `status` transitions surface through `playbooks.json` and the category routers; only `active` playbooks are listed as runnable.

### Acceptance criteria

- A draft playbook is not runnable until reviewed and activated.
- `targets` link playbooks to entity IDs (REQ/CAP/TC) from `.os/data`.

### Dependencies

- Phase 04 (entity IDs for `targets`).
