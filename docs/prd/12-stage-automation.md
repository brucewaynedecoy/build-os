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

## Contracts and Data

Stage-movers are hooks and slash-commands, not prompt files (make-docs is deprecating prompts). Each respects its gate (review-to-activate, verify-to-promote) and never writes into a make-docs tree outside its router. They build on the forward-routing ("Next Step") declared in the contracts.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`

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
