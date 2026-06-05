# 11 Flow C Integration

## Purpose

This subsystem is the user-gated hand-off from a qualified finding into the planning/engineering leg, crossing into the make-docs target docs without modifying them.

## Scope

Covered here: the qualified-finding → design promotion and how it obeys the make-docs design router. The downstream plan → PRD → work pipeline is make-docs' own; this subsystem only provides the on-ramp.

Code anchors:

- `toolkits/buildos-design/`
- `system/workspace/findings/`
- `system/docs/designs/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| `buildos-design` promotion | Take a qualified finding into a design under `system/docs/designs/` |
| Promotion hand-off | Pass finding id, qualification anchor, and configured scope metadata into the design |
| Finding traceability | Record accepted design links back on the qualified finding and findings index |
| Forward-routing | The finding contract's "Next Step" points at the make-docs design router and downstream planning route |

Code anchors:

- `system/.os/contracts/` (finding contract)
- `toolkits/buildos-design/`

## Contracts and Data

Promotion is user-gated: a qualified finding is not auto-promoted. The hand-off reads the make-docs design workflow, contract, and template, then writes only through that router, passing the finding id, origin run, raw finding anchor, qualification anchor, and configured `systems`, `environments`, and `owners` lists. Nothing under `system/docs/**` is written outside the make-docs router (`PB-001`).

The P7 deterministic hand-off is:

```sh
system/.os/scripts/buildos-design promote finding --finding-id <FIND-NNN> --route baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root <path>] [--dry-run]
```

The `baseline-plan` route prepares a design for a fresh baseline planning flow. The `change-plan` route prepares a design for additive planning against the active PRD namespace. Both routes preserve the qualified finding as the evidence record and let the design own solution framing, tradeoffs, and downstream planning context.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `system/.os/scripts/buildos-design`
- `toolkits/buildos-design/cmd/buildos-design/main.go`
- `toolkits/buildos-design/internal/design/promotion.go`

### Change Notes

- Superseded by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): Flow C handoffs no longer pass `env`/`for` tags as effective scoped metadata. They pass config-backed `systems`, `environments`, and `owners` lists along with the finding ID and qualification anchor.
- Revised by [16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md): deterministic qualified-finding design promotion belongs in `buildos-design`; stage-mover orchestration remains separate from the qualified-finding design hand-off.

## Integrations

Consumes qualified findings (`10`); enters the make-docs pipeline in `system/docs/` (designs → plans → prd → work). The hand-off may be invoked directly by an operator or by later stage-mover automation (`12`), but the P7 contract does not require Flow D automation to exist.

Code anchors:

- `system/docs/designs/AGENTS.md`
- `system/docs/assets/references/design-workflow.md`
- `system/docs/assets/references/design-contract.md`

## Rebuild Notes

Never bypass the make-docs router to write a design directly. Keep promotion a deliberate, user-gated act, carry the qualification anchor so the design traces back to reproducible evidence, and keep stage automation separate until PRD 12 work introduces it.

Code anchors:

- `system/docs/designs/`
- `system/.os/contracts/finding-contract.md`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/07-flow-c-integration.md`
- `docs/prd/13-adopter-owned-config-surface.md`
- `docs/prd/16-revise-toolkit-ownership-boundaries.md`
