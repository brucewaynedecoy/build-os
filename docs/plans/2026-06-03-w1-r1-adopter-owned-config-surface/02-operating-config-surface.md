# Phase Detail: Operating Config Surface

## P2 - Config Contract, Template, and Routing

- Goal: add the adopter-owned configuration surface under the current operational namespace without renaming `system/` or `system/.os/`.
- Deliverables: `system/.os/config/instance.yaml`, `system/.os/contracts/config-contract.md`, `system/.os/templates/instance-config.yaml`, and router updates that make the config discoverable.
- Status: planned.

## Source Inputs

- [Adopter-Owned Config Surface](../../designs/2026-06-03-adopter-owned-config-surface.md)
- `system/.os/AGENTS.md`
- `system/.os/contracts/AGENTS.md`
- `system/.os/templates/AGENTS.md`
- `system/.os/contracts/playbook-contract.md`

## Workstreams

| Workstream | Owner | Output | Notes |
| --- | --- | --- | --- |
| Config contract | Worker B | `system/.os/contracts/config-contract.md` | Define `version`, `instance`, `systems`, `environments`, `owners`, `defaults`, ID rules, and cross-reference rules. |
| Starter template | Worker B | `system/.os/templates/instance-config.yaml` | Use neutral example IDs only; no adopter-, vendor-, or engagement-specific examples. |
| Canonical config | Worker B | `system/.os/config/instance.yaml` | Seed from the template so a fresh Build OS instance validates immediately. |
| Router updates | Worker B | `system/.os/AGENTS.md`, `system/.os/contracts/AGENTS.md`, `system/.os/templates/AGENTS.md` | Add config routing without restating contract details. |

## Dependencies

- P1 must define the effective PRD language for config-backed vocabulary.
- The config contract must land before scoped field migration so validators and frontmatter changes have an authority to cite.
- The starter template and canonical config should be kept neutral and should not use historical first-engagement values.

## Acceptance Checks

- `system/.os/config/instance.yaml` exists and is described as adopter-owned.
- `system/.os/contracts/config-contract.md` states required fields, ID rules, and cross-reference rules.
- `system/.os/templates/instance-config.yaml` can be copied into `system/.os/config/instance.yaml`.
- Routers route operators to config, contract, and template locations without duplicating the full schema.
- The config surface remains compatible with a future namespace rename.

## Execution Notes

Keep this phase focused on the config surface itself. Playbook/data migration and validation behavior belong in P3 so the contract and canonical config exist before callers depend on them.
