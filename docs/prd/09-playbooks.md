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

A playbook carries three orthogonal axes in frontmatter — `category` (directory), `execution_mode` (`explicit-steps`/`guided-objective`/`inferred-actions`/`n/a`), and `state_nature` (`stateful`/`standing`/`guardrail`) — plus `status`, `audience`, `harness`, `systems`, `environments`, `owners`, `targets`, `produces`. IDs are flat (`PB-NNN`); category is a property, not in the ID. Lifecycle is `draft → reviewed → active → archived`; only `active` playbooks run or are enforced (the review-to-activate gate).

The scoped fields `systems`, `environments`, and `owners` are lists of configured IDs, as [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md#scoped-vocabulary) defines. Playbooks never use the legacy scoped fields `env` or `for`, and no scoped field holds a sentinel value such as `both`. `audience` is not a scoped field, so `audience: both` stays valid.

A playbook target that names a losing entity ID stays as authored and auditable. When the playbook is used, the target resolves to its terminal canonical ID through the shared resolver in [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md#contracts-and-data).

Code anchors:

- `system/.os/contracts/playbook-contract.md`

## Integrations

`targets` reference entity IDs from `08`; active playbooks are run in `10`; guardrails are surfaced through routers (`06`); `playbooks.json` indexes them.

Code anchors:

- `system/.os/indexes/playbooks.json`

## Rebuild Notes

Keep the three axes orthogonal and the guardrail body distinct from procedure bodies. Only `active` instruments should be runnable; never encode category in the ID. Playbook validation and catalog rebuilds reject a target whose redirect chain is unresolved or invalid, and they keep the authored playbook text unchanged.

Code anchors:

- `system/playbooks/AGENTS.md`

## Requirement History

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Contracts and Data`, scoped frontmatter
- Previous contract: Playbook frontmatter scoped a playbook with the `env`/`for` fields, which could hold sentinel values such as `both`.
- Replacement contract: Playbook frontmatter scopes a playbook with the `systems`, `environments`, and `owners` lists of configured IDs. The legacy scoped fields `env` and `for` are not allowed, and no scoped field holds a sentinel value such as `both`. `audience` is not a scoped field, so `audience: both` stays valid.
- Rationale: The section body still stated the old fields after the config surface replaced them.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md`
