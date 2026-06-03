# 09 Playbooks

## Purpose

This subsystem (Pillar 2) is the typed Markdown instruments that guide humans and agents, with the review-to-activate lifecycle.

## Scope

Covered here: the playbook contract, the three classification axes, the lifecycle, templates, category routers, and guardrails. Running playbooks is in `10`.

Code anchors:

- `system/playbooks/`
- `system/.os/contracts/playbook-contract.md`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| Category directories | `administrative`, `build`, `discovery`, `testing` |
| Procedure playbooks | Stateful/standing instruments that run and produce artifacts |
| Guardrail playbooks | Non-executing constraints (Scope/Rules/Rationale) |
| Templates | Procedure and guardrail starting shapes |

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `system/.os/templates/guardrail-playbook.md`

## Contracts and Data

A playbook carries three orthogonal axes in frontmatter — `category` (directory), `execution_mode` (`explicit-steps`/`guided-objective`/`inferred-actions`/`n/a`), and `state_nature` (`stateful`/`standing`/`guardrail`) — plus `status`, `audience`, `harness`, `env`/`for`, `targets`, `produces`. IDs are flat (`PB-NNN`); category is a property, not in the ID. Lifecycle is `draft → reviewed → active → archived`; only `active` playbooks run or are enforced (the review-to-activate gate).

Code anchors:

- `system/.os/contracts/playbook-contract.md`

### Change Notes

- Superseded by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): playbook scoped frontmatter no longer uses `env`/`for` or sentinel values such as `both` as effective contract vocabulary. Playbooks use `systems`, `environments`, and `owners` as config-backed lists of configured IDs.

## Integrations

`targets` reference entity IDs from `08`; active playbooks are run in `10`; guardrails are surfaced through routers (`06`); `playbooks.json` indexes them.

Code anchors:

- `system/.os/indexes/playbooks.json`

## Rebuild Notes

Keep the three axes orthogonal and the guardrail body distinct from procedure bodies. Only `active` instruments should be runnable; never encode category in the ID.

Code anchors:

- `system/playbooks/AGENTS.md`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md`
