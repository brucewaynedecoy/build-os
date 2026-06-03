# 02 Architecture Overview

## Purpose

Explain how Build OS is shaped end to end: three spaces, three pillars, three chained flows, and two promotion gates, all over a plain-text substrate.

## Topology

Build OS is not a running service; it is a structured filesystem operated by humans and agents. Three spaces keep concerns separate: the build layer (`docs/`, how we build the system), the system itself (`system/`), and the system's target docs (`system/docs/`, outputs about the target). Both `docs/` trees are make-docs plug-ins.

Code anchors:

- `docs/`, `system/`, `system/docs/`

## Module Map

| Area | Owns |
| --- | --- |
| `system/.os/` | The operating brain: `contracts/` (authority), `templates/` (shapes), `indexes/` (derived), `data/` (entities, NDJSON), `scripts/` (deterministic processes) |
| `system/assets/` | Raw sources and their converted twins |
| `system/playbooks/` | Typed instruments by category |
| `system/workspace/` | `datasets/` (user data), `runs/`, `findings/`, `scripts/` |
| `system/docs/` | make-docs target-doc pipeline (designs → plans → prd → work) |

Code anchors:

- `system/.os/AGENTS.md`
- `system/playbooks/AGENTS.md`

## Runtime Boundaries

The hard boundary is the make-docs plug-in: the four trees (`docs/`, `system/docs/`, `.make-docs/`, `system/.make-docs/`) are externally managed and never modified directly; the top routers are co-owned (augment-only). Within `system/`, `convert` is deterministic (tools) while `extract` is smart (human/agent). Computer-use execution runs against the external target application.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`

## Data Flow

Three chained flows: **A — Intake** (`convert → extract → candidates`); **B — Discovery** (`active playbook → run → raw finding → qualify → qualified finding`); **C — Planning/Engineering** (`qualified finding → design → plan → prd → work`). Two gates govern promotion: review-to-activate (instruments) and verify-to-promote (findings, where qualification = a deterministic repeatable test).

Code anchors:

- `system/workspace/runs/`, `system/workspace/findings/`
- `system/docs/designs/`

## Configuration Surfaces

Routers (`AGENTS.md` canonical, `CLAUDE.md` pointer) configure navigation; contracts under `system/.os/contracts/` configure artifact shape; `system/.gitignore` controls what ships; `env`/`for` frontmatter tags scope artifacts.

Code anchors:

- `system/.os/contracts/`
- `system/AGENTS.md`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `system/.os/`, `system/workspace/`
