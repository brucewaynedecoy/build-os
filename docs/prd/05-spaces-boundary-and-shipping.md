# 05 Spaces, Boundary & Shipping

## Purpose

This subsystem defines the three-space separation, the make-docs plug-in boundary that protects it, and what it means to ship `system/`.

## Scope

Covered here: the build/system/target-docs distinction, the boundary rules and their guardrail, co-owned-router augmentation, and the shipping/gitignore model. Routing mechanics are covered in `06`; the make-docs `docs/` pipelines themselves are external.

Code anchors:

- `docs/`, `system/`, `system/docs/`

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

## Contracts and Data

The boundary is encoded as an `active` guardrail playbook (Scope/Rules/Rationale). Shipping is governed by a planned runtime-only `system/.gitignore` (ignores `node_modules`, `.playwright`, `test-results`; leaves `.os/data/` and `workspace/datasets/` tracked). `system/assets/` (ours) must never be confused with `system/docs/assets/` (make-docs).

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `.make-docs/manifest.json`

## Integrations

Depends on the make-docs CLI (installs/maintains the four trees and appends to the co-owned top routers). Surfaces the boundary guardrail through the `.os/`, `playbooks/`, and `administrative/` routers.

Code anchors:

- `system/.os/AGENTS.md`

## Rebuild Notes

A rebuild must preserve append-only treatment of the top routers and must never invent new directories or doc types under any `docs/` tree. The two `assets/` namespaces are distinct and easy to conflate.

Code anchors:

- `system/AGENTS.md`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md`
