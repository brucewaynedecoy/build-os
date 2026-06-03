# 11 Flow C Integration

## Purpose

This subsystem is the user-gated hand-off from a qualified finding into the planning/engineering leg, crossing into the make-docs target docs without modifying them.

## Scope

Covered here: the qualified-finding → design promotion and how it obeys the make-docs design router. The downstream plan → PRD → work pipeline is make-docs' own; this subsystem only provides the on-ramp.

Code anchors:

- `system/workspace/findings/`
- `system/docs/designs/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| Promotion hand-off | Take a qualified finding into a design under `system/docs/designs/` |
| Forward-routing | The finding contract's "Next Step" points at the make-docs design router |

Code anchors:

- `system/.os/contracts/` (finding contract)

## Contracts and Data

Promotion is user-gated: a qualified finding is not auto-promoted. The hand-off reads the make-docs design workflow, contract, and template, then writes only through that router, passing the finding id, qualification anchor, and `env`/`for` tags. Nothing under `system/docs/**` is written outside the make-docs router (`PB-001`).

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`

### Change Notes

- Superseded by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): Flow C handoffs no longer pass `env`/`for` tags as effective scoped metadata. They pass config-backed `systems`, `environments`, and `owners` lists along with the finding ID and qualification anchor.

## Integrations

Consumes qualified findings (`10`); enters the make-docs pipeline in `system/docs/` (designs → plans → prd → work). Triggered by a stage-mover (`12`).

Code anchors:

- `system/docs/designs/AGENTS.md`

## Rebuild Notes

Never bypass the make-docs router to write a design directly. Keep promotion a deliberate, user-gated act, and carry the qualification anchor so the design traces back to reproducible evidence.

Code anchors:

- `system/docs/designs/`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/07-flow-c-integration.md`
