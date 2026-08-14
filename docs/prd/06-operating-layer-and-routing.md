# 06 Operating Layer & Routing

## Purpose

This subsystem is the `.os/` brain and the agent-routing model that make Build OS navigable and self-propelling.

## Scope

Covered here: `.os/` structure (contracts, templates, indexes, data, scripts), the routing conventions, and contracts-as-authority with forward-routing. The data shapes themselves are detailed in `08`; the boundary is in `05`.

Code anchors:

- `system/.os/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| `.os/contracts/` | Authority for each artifact type; each contract carries an `Intended Follow-On` ("Next Step") |
| `.os/templates/` | Copy-this starting shapes |
| `.os/indexes/` | Derived catalogs (`playbooks.json`, `references.json`) |
| `.os/scripts/` | Thin wrappers, command routers, compatibility shims, and command documentation for deterministic system processes |
| Routers | Thin `AGENTS.md` dispatchers (`CLAUDE.md` is a one-line pointer) |

Code anchors:

- `system/.os/contracts/playbook-contract.md`
- `system/.os/AGENTS.md`
- `system/.os/templates/guardrail-playbook.md`

### Change Notes

- Enhanced by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): `.os/` also owns `config/` as the adopter-controlled operational configuration surface. `system/.os/config/instance.yaml`, `system/.os/contracts/config-contract.md`, `system/.os/templates/instance-config.yaml`, and `system/.os/scripts/validate_config.py` are part of the operating-layer authority for scoped values.
- Revised by [14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md): `.os/scripts/` is no longer the default source home for new durable deterministic logic. New packaged first-party tooling should live under `toolkits/` and expose `buildos-*` binaries that scripts call or document.
- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): current directories, routers, wrappers, and commands remain compatibility and migration evidence, but they do not define the complete operation contract. The approved core capability inventory and its same-change CLI/MCP projections define supported behavior, including which indexes are derived and rebuildable.

## Contracts and Data

`AGENTS.md` is canonical; the sibling `CLAUDE.md` only points to it. Routers never restate rules — authority lives in `.os/contracts/`. Contracts encode forward-routing, so playbook → run-record → finding → design propels itself. The `.os/` router is the operating entry point, reachable from the co-owned `system/AGENTS.md` pointer.

Code anchors:

- `system/.os/contracts/AGENTS.md`
- `system/playbooks/AGENTS.md`

### Change Notes

- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): written contracts remain evidence, but only approved core operations may interpret authority or perform Build OS state transitions. Router forward-links cannot bypass plan, authorization, verification, receipt, locking, or recovery requirements.

## Integrations

Every operational subtree (`assets/`, `playbooks/`, `workspace/`, `.os/data/`) reads its contract here before writing. Crossings into `docs/` defer to the make-docs routers per `05`.

Code anchors:

- `system/playbooks/administrative/AGENTS.md`

## Rebuild Notes

Preserve the `AGENTS.md`-canonical / `CLAUDE.md`-pointer rule and thin routers; do not let routers accrete authority that belongs in contracts. The contract set must exist before later phases can "read before write."

Code anchors:

- `system/.os/contracts/`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md`
- `docs/prd/14-revise-deterministic-toolkit-deployment.md`
