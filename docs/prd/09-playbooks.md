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

### Change Notes

- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): category directories and router procedures remain evidence, while the effective contract is the `PBK-001` inspect/validate/select operation family plus an explicitly classified, rebuildable playbook catalog. CLI and MCP must expose the same operation semantics and lifecycle gates.

## Contracts and Data

A playbook carries three orthogonal axes in frontmatter — `category` (directory), `execution_mode` (`explicit-steps`/`guided-objective`/`inferred-actions`/`n/a`), and `state_nature` (`stateful`/`standing`/`guardrail`) — plus `status`, `audience`, `harness`, `env`/`for`, `targets`, `produces`. IDs are flat (`PB-NNN`); category is a property, not in the ID. Lifecycle is `draft → reviewed → active → archived`; only `active` playbooks run or are enforced (the review-to-activate gate).

Code anchors:

- `system/.os/contracts/playbook-contract.md`

### Change Notes

- Superseded by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): playbook scoped frontmatter no longer uses `env`/`for` or sentinel values such as `both` as effective contract vocabulary. Playbooks use `systems`, `environments`, and `owners` as config-backed lists of configured IDs.
- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): entity-valued playbook targets resolve through the shared canonical entity resolver while historical target IDs remain auditable.
- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): inspect, validate, select, and catalog-rebuild semantics become explicit core operations with shared schemas, receipts, idempotency, and error behavior. Lifecycle vocabulary remains evidence pending full capability-map approval.

## Integrations

`targets` reference entity IDs from `08`; active playbooks are run in `10`; guardrails are surfaced through routers (`06`); `playbooks.json` indexes them.

Code anchors:

- `system/.os/indexes/playbooks.json`

### Change Notes

- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): playbook execution resolves losing target IDs to terminal active entities and writes canonical IDs for new target references.
- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): playbook consumers use the same core resolution and selection semantics through CLI or MCP, while the optional UI and server remain separate consumers and do not gain independent playbook authority.

## Rebuild Notes

Keep the three axes orthogonal and the guardrail body distinct from procedure bodies. Only `active` instruments should be runnable; never encode category in the ID.

Code anchors:

- `system/playbooks/AGENTS.md`

### Change Notes

- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): validation and catalog rebuilds must reject unresolved or invalid redirect chains while preserving historical playbook text.

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md`
