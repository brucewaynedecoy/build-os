# Phase 07: Flow C Integration

## Purpose

This phase delivers the user-gated hand-off from a qualified finding into the planning/engineering leg, crossing into the make-docs target docs without modifying them.

## Overview

Implement the promotion path from a qualified finding to a design under `system/docs/designs/` that obeys the make-docs design router, and wire the finding contract's forward-routing to that hand-off.

## Source PRD Docs

- [11 Flow C Integration](../../prd/11-flow-c-integration.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - Promotion hand-off

### Tasks

- [ ] t1: Implement the qualified-finding → `system/docs/designs/` promotion that reads the make-docs design workflow, contract, and template, then writes only through that router.
- [ ] t2: Pass the required inputs into the hand-off (finding id, qualification test anchor, `env`/`for` tags).
- [ ] t3: Wire the finding contract's `Intended Follow-On` ("Next Step") to point at the make-docs design router.

### Acceptance criteria

- Promotion creates a design via the make-docs router only; nothing under `system/docs/**` is written or modified outside that router (`PB-001`).
- Promotion is user-gated; a qualified finding is not auto-promoted.

### Dependencies

- Phase 06 (qualified findings exist).
