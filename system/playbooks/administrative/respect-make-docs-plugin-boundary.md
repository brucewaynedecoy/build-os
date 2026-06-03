---
id: PB-001
title: Respect the make-docs plug-in boundary
category: administrative
execution_mode: n/a
state_nature: guardrail
status: active
audience: both
harness: [none]
env: both
for: both
targets: []
produces: []
version: 1.0.0
related:
  - ../../../docs/designs/2026-06-03-build-os-architecture.md
---

## Scope

Applies to **every human and agent** operating anywhere in this repository, across all flows
(intake, discovery, planning). Always in force.

## Rules

**MUST NOT**

- Modify any file under `docs/`, `system/docs/`, `.make-docs/`, or `system/.make-docs/`.
- Create new directories or document types under any `docs/` tree (e.g. a `findings/` folder).
- Modify anything under `docs/assets/` (references, templates, prompts, archive, history) —
  unless the explicit task is to augment make-docs itself, via its source repository.

**MUST**

- Use the make-docs trees only via their own `AGENTS.md` routers, contracts, and templates.
- When a flow needs a `docs/` artifact (e.g. promoting a qualified finding to a design), cross
  into the target `docs/` tree and **obey its router**, providing the required inputs
  (finding id, qualification anchor).
- Treat the co-owned top routers (`./AGENTS.md`, `./system/AGENTS.md` and their `CLAUDE.md`
  siblings) as **augment-only**: add to them; never overwrite make-docs routing. Change make-docs
  routing behavior only through the make-docs **source repository + CLI**.
- Keep `system/assets/` (ours) distinct from `system/docs/assets/` (make-docs).

## Rationale

The four trees are make-docs **plug-ins**, installed and maintained by the make-docs CLI from a
separate source of truth. Direct edits are overwritten or break routing on the next CLI run.
Routing changes belong in the make-docs source; content belongs in the sanctioned output targets,
reached through their own workflows. Honoring this boundary keeps the plug-in upgradeable and the
two documentation spaces (build-layer `docs/` vs. target `system/docs/`) from blurring.
