# 05 Spaces, Boundary & Shipping

## Purpose

This subsystem defines the three-space separation, the make-docs plug-in boundary that protects it, and what it means to ship `system/`.

## Scope

Covered here: the build/system/target-docs distinction, the boundary rules and their guardrail, co-owned-router augmentation, and the shipping/gitignore model. Routing mechanics are covered in `06`; the make-docs `docs/` pipelines themselves are external.

Code anchors:

- `docs/`, `system/`, `system/docs/`

### Change Notes

- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): the three-space separation remains useful evidence, but product scope now distinguishes the installed Build OS program, project-local Build OS state, separately gated UI/server surfaces, and the external Make Docs companion lifecycle.

## Component and Capability Map

| Component | Capability |
| --- | --- |
| Three spaces | Keep "building the system" (`docs/`), "the system" (`system/`), and "outputs about the target" (`system/docs/`) un-confused |
| Boundary guardrail (`PB-001`) | Forbid edits to the four make-docs trees; require crossings via their routers |
| Co-owned router augmentation | Add the `.os/` pointer to `system/AGENTS.md` append-only |
| Shipping model | `system/` is the shippable unit; adopters own their data and gitignore choices |

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `system/AGENTS.md`

### Change Notes

- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): `system/` remains project-local Build OS state, but it is not by itself the complete product distribution. The installed Build OS distribution contains the Go headless core, CLI, and MCP server; Make Docs remains a separately installed external companion invoked only through its verified public lifecycle operations.

## Contracts and Data

The boundary is encoded as an `active` guardrail playbook (Scope/Rules/Rationale). Shipping is governed by a planned runtime-only `system/.gitignore` (ignores `node_modules`, `.playwright`, `test-results`; leaves `.os/data/` and `workspace/datasets/` tracked). `system/assets/` (ours) must never be confused with `system/docs/assets/` (make-docs).

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `.make-docs/manifest.json`

### Change Notes

- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): Build OS owns its project-local files and receipts but does not own Make Docs state. Make Docs markers, registration, setup, reconfiguration, and removal remain externally authoritative and may be observed or invoked only through the verified public contract.

## Integrations

Depends on the make-docs CLI (installs/maintains the four trees and appends to the co-owned top routers). Surfaces the boundary guardrail through the `.os/`, `playbooks/`, and `administrative/` routers.

Code anchors:

- `system/.os/AGENTS.md`

### Change Notes

- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): the standard project profile explicitly acknowledges the Make Docs companion operation, invokes Make Docs' public setup, verifies published markers or registration, and records a Build OS integration receipt. Exact commands and markers remain gated by Q-010 and R-001.

## Rebuild Notes

A rebuild must preserve append-only treatment of the top routers and must never invent new directories or doc types under any `docs/` tree. The two `assets/` namespaces are distinct and easy to conflate.

Code anchors:

- `system/AGENTS.md`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md`
