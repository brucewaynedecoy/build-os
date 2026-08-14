# 02 Architecture Overview

## Purpose

Explain how Build OS is shaped end to end: three spaces, three pillars, three chained flows, and two promotion gates, all over a plain-text substrate.

## Topology

Build OS is not a running service; it is a structured filesystem operated by humans and agents. Three spaces keep concerns separate: the build layer (`docs/`, how we build the system), the system itself (`system/`), and the system's target docs (`system/docs/`, outputs about the target). Both `docs/` trees are make-docs plug-ins.

Code anchors:

- `docs/`, `system/`, `system/docs/`

### Change Notes

- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): Build OS remains filesystem-native, while the installed product becomes one cohesive Go program and distribution containing the headless core, CLI, and MCP server. The optional coordinating server and UI remain separately gated surfaces and do not silently replace local project files as authority.

## Module Map

| Area | Owns |
| --- | --- |
| `system/.os/` | The operating brain: `contracts/` (authority), `templates/` (shapes), `indexes/` (derived), `data/` (entities, NDJSON), `scripts/` (deterministic processes) |
| `system/assets/` | Raw sources and their converted twins |
| `system/playbooks/` | Typed instruments by category |
| `system/workspace/` | `datasets/` (user data), `runs/`, `findings/`, `scripts/` |
| `system/docs/` | make-docs target-doc pipeline (designs → plans → prd → work) |
| `toolkits/` | Source and build metadata for packaged first-party deterministic CLI toolkits |

Code anchors:

- `system/.os/AGENTS.md`
- `system/playbooks/AGENTS.md`
- `toolkits/AGENTS.md`

### Change Notes

- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): `system/.os/data/` gains redirect-bearing entity rows, `system/.os/indexes/` gains the derived entity-resolution index, and `toolkits/buildos-entities/` owns deterministic graph operations.
- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): directory areas remain evidence locations, while target module ownership is defined by transport-neutral core domains in the cohesive Go program. CLI and MCP adapters project those domains; derived indexes and external Make Docs state are not promoted to Build OS canonical authority.

## Runtime Boundaries

The hard boundary is the make-docs plug-in: the four trees (`docs/`, `system/docs/`, `.make-docs/`, `system/.make-docs/`) are externally managed and never modified directly; the top routers are co-owned (augment-only). Within `system/`, `convert` is deterministic (packaged tools with script wrappers) while `extract` is smart (human/agent). Computer-use execution runs against the external target application.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`

### Change Notes

- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): source checkout, installed binaries, and adopter-owned data are distinct runtime boundaries; binary deployment and live-data migration require separate approvals and explicit roots.
- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): the headless core alone owns domain semantics and authoritative Build OS writes, while the CLI and MCP adapters expose the same versioned operation surface from the same executable. Make Docs stays outside that program and is reached only through its verified public operations.

## Data Flow

Three chained flows: **A — Intake** (`convert → extract → draft entity and extraction rows`); **B — Discovery** (`active playbook → run → raw finding → qualify → qualified finding`); **C — Planning/Engineering** (`qualified finding → design → plan → prd → work`). Two gates govern promotion: review-to-activate (instruments) and verify-to-promote (findings, where qualification = a deterministic repeatable test).

Code anchors:

- `system/workspace/runs/`, `system/workspace/findings/`
- `system/docs/designs/`

### Change Notes

- Revised by [15 Revise Extraction Draft Lifecycle](./15-revise-extraction-draft-lifecycle.md): Flow A extraction outputs use `draft` entity and extraction rows until promoted; `candidate` remains only a converted-source trust state where that contract applies.
- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): Flow A reads preserve observed IDs while exposing terminal canonical IDs, and new entity references store the terminal canonical ID after deterministic or reviewed matching.
- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): each effective flow step must be an explicit core operation with resolved authority, state transitions, plan/authorization/apply/verify/record behavior, receipts, recovery semantics, and CLI/MCP parity. Flow C becomes a Build OS export or handoff to the external Make Docs product rather than a direct Build OS write into Make Docs-owned state.

## Configuration Surfaces

Routers (`AGENTS.md` canonical, `CLAUDE.md` pointer) configure navigation; contracts under `system/.os/contracts/` configure artifact shape; `system/.gitignore` controls what ships; `env`/`for` frontmatter tags scope artifacts.

Code anchors:

- `system/.os/contracts/`
- `system/AGENTS.md`

### Change Notes

- Superseded by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): fixed scoped frontmatter vocabulary such as `env` and `for` is no longer the effective contract vocabulary. Scoped artifacts use config-backed `systems`, `environments`, and `owners`, with adopter values owned by `system/.os/config/instance.yaml` and shaped by `system/.os/contracts/config-contract.md`.
- Revised by [14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md): durable deterministic execution tooling is sourced under `toolkits/`, built as packaged `buildos-*` CLIs, and reached from operational scripts where wrapper or router compatibility is needed.
- Superseded by [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md): project configuration becomes an authority-aware core operation surface, while machine-global settings, project registry, project identity, relocation, and compatibility policy require explicit Phase 1 decisions. Routers and frontmatter remain inputs to that contract, not its complete definition.

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `system/.os/`, `system/workspace/`
- `toolkits/`
