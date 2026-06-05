# 12 Stage Automation

## Purpose

This subsystem makes the three flows self-propelling using hooks and slash-commands, replacing the deprecated make-docs prompt mechanism.

## Scope

Covered here: the stage-movers between flow stages — intake→extract, run→qualify, qualify→design. The stages themselves live in `07`–`11`; this subsystem only moves between them.

Code anchors:

- `system/.os/scripts/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| intake→extract mover | Open extraction on a converted twin |
| run→qualify mover | Take a run's raw finding into qualification |
| qualify→design mover | Initiate the Flow C hand-off for a qualified finding |

Code anchors:

- `system/.os/contracts/` (finding contract forward-routing)

### Change Notes

- Revised by [14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md): deterministic command runners should call packaged `buildos-*` toolkits where applicable, with script or slash-command surfaces acting as routers rather than unmanaged logic implementations.
- Superseded by [16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md) for toolkit-domain routing: stage-movers should orchestrate or call the owning domain toolkits instead of adding durable logic to unmanaged scripts or expanding unrelated existing toolkits.

## Contracts and Data

Stage-movers are hooks and slash-commands, not prompt files (make-docs is deprecating prompts). Each respects its gate (review-to-activate, verify-to-promote) and never writes into a make-docs tree outside its router. They build on the forward-routing ("Next Step") declared in the contracts.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`

### Change Notes

- Enhanced by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): stage-movers must run or respect `system/.os/scripts/validate_config.py` for config-backed scoped metadata and frontmatter hygiene. Automation should fail on legacy scoped fields or unconfigured `systems`, `environments`, and `owners` IDs after the migration lands.
- Superseded by [16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md) where config or scoped-metadata checks become durable deterministic behavior: those checks should route through `buildos-config` once that toolkit exists, with legacy script use treated as transitional.

## Integrations

Connects `07`→`08`, `10`→`10` (qualification), and `10`→`11`. Depends on those stages existing first; this subsystem is implemented last.

Code anchors:

- `docs/prd/11-flow-c-integration.md`

## Rebuild Notes

Implement stage-movers as harness hooks/slash-commands, not prompts. Resolve the promotion-enforcement question (Q-001) before hardening them, since it decides how much each mover validates versus trusts.

Code anchors:

- `docs/prd/03-open-questions-and-risk-register.md`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/08-stage-automation.md`
- `docs/prd/14-revise-deterministic-toolkit-deployment.md`
