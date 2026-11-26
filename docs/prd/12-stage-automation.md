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

Stage-movers call the owning `buildos` domain commands for deterministic work. They act as routers. They add no durable logic to unmanaged scripts and no unrelated command to an existing domain. [02 Architecture Overview](./02-architecture-overview.md#domain-ownership) owns the domain ownership rule.

Code anchors:

- `system/.os/contracts/` (finding contract forward-routing)

## Contracts and Data

Stage-movers are hooks and slash-commands, not prompt files (make-docs is deprecating prompts). Each respects its gate (review-to-activate, verify-to-promote) and never writes into a make-docs tree outside its router. They build on the forward-routing ("Next Step") declared in the contracts.

Stage-movers that move config-backed scoped metadata run or respect `buildos validate` ([PRD 13](./13-adopter-owned-config-surface.md)). They fail on legacy scoped fields or unconfigured `systems`, `environments`, and `owners` IDs.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`

### Change Notes

- 2026-11-23 (W1 R7): config checks now run through `buildos validate`, as stated in this section. `system/.os/scripts/validate_config.py` is no longer the validator.

## Integrations

Connects `07`→`08`, `10`→`10` (qualification), and `10`→`11`. Depends on those stages existing first; this subsystem is implemented last.

Code anchors:

- `docs/prd/11-flow-c-integration.md`

## Rebuild Notes

Implement stage-movers as harness hooks/slash-commands, not prompts. Resolve the promotion-enforcement question (Q-001) before hardening them, since it decides how much each mover validates versus trusts.

Code anchors:

- `docs/prd/03-open-questions-and-risk-register.md`

## Requirement History

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Component and Capability Map`, `## Contracts and Data`
- Previous contract: Stage-movers called packaged `buildos-*` toolkits where applicable. They ran or respected `system/.os/scripts/validate_config.py` and failed on legacy scoped fields or unconfigured IDs only after the config migration landed. Durable config checks were to route through a planned `buildos-config` toolkit.
- Replacement contract: Stage-movers call the owning `buildos` domain commands and keep no durable logic in scripts. They run or respect `buildos validate` and fail on legacy scoped fields or unconfigured IDs with no condition.
- Rationale: The tooling is one `buildos` CLI, `buildos validate` owns config checks, and the scoped-field migration is complete.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/08-stage-automation.md`
- `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md`
