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
| `.os/scripts/` | Deterministic system processes |
| Routers | Thin `AGENTS.md` dispatchers (`CLAUDE.md` is a one-line pointer) |

Code anchors:

- `system/.os/contracts/playbook-contract.md`
- `system/.os/AGENTS.md`
- `system/.os/templates/guardrail-playbook.md`

## Contracts and Data

`AGENTS.md` is canonical; the sibling `CLAUDE.md` only points to it. Routers never restate rules — authority lives in `.os/contracts/`. Contracts encode forward-routing, so playbook → run-record → finding → design propels itself. The `.os/` router is the operating entry point, reachable from the co-owned `system/AGENTS.md` pointer.

Code anchors:

- `system/.os/contracts/AGENTS.md`
- `system/playbooks/AGENTS.md`

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
