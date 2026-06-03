# Phase 02: Spaces, Boundary & Shipping

## Purpose

This phase makes the build/system/target-docs boundary impossible to cross by accident and defines what shipping `./system/` means.

## Overview

Harden the make-docs plug-in boundary with active guardrails, augment the co-owned top routers, and add the shipped runtime-only ignore rules — leaving user data tracked, since data-ignoring is the adopter's choice.

## Source PRD Docs

- [05 Spaces, Boundary & Shipping](../../prd/05-spaces-boundary-and-shipping.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - Boundary guardrails

### Tasks

- [x] t1: Author and activate `PB-001` (respect the make-docs plug-in boundary).
- [x] t2: Augment the co-owned `system/AGENTS.md` (+ `CLAUDE.md`) with the `.os/` operating-layer pointer, append-only.
- [ ] t3: Add an `env`/`for` tagging guardrail (or convention doc) so artifacts consistently carry `env` (`vanilla`/`deere`/`both`) and `for` (`microsoft`/`deere`/`both`).

### Acceptance criteria

- No artifact or task modifies a make-docs-managed tree; crossings use the target tree's router.
- Active guardrails are surfaced from the relevant directory routers (guardrails-as-routing).

### Dependencies

- Phase 01 (playbook contract + operating routers).

## Stage 2 - Shipping

### Tasks

- [ ] t4: Author `system/.gitignore` scoped to runtime ephemera only (`node_modules`, `.playwright`, `test-results`), with a comment that tracking or ignoring data is the adopter's choice.
- [ ] t5: Add `.gitkeep` placeholders for user-owned dirs (`workspace/datasets/`) so the shipped `system/` tree is complete on first adoption.

### Acceptance criteria

- `system/.gitignore` ignores only runtime ephemera; `.os/data/` and `workspace/datasets/` remain tracked by default.
- The shipped `system/` tree is self-contained: an adopter can start fresh from it.

### Dependencies

- Phase 01.
