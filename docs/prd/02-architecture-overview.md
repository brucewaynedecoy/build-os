# 02 Architecture Overview

## Purpose

Explain how Build OS is shaped end to end: three spaces, three pillars, three chained flows, and two promotion gates, all over a plain-text substrate.

## Topology

Build OS is not a running service; it is a structured filesystem operated by humans and agents. Three spaces keep concerns separate: the build layer (`docs/` in the BuildOS checkout, how we build the system), the system itself (`system/`, which `buildos init` places at the project root), and the system's target docs (the initialized project's `docs/` tree, outputs about the target). Both `docs/` trees are make-docs plug-ins. BuildOS ships no target-docs content; Make Docs creates the project `docs/` tree when the user chooses companion setup, as [05 Spaces, Boundary & Shipping](./05-spaces-boundary-and-shipping.md#integrations) states.

Deterministic operations run through one command-line program, `buildos`. It ships as the npm package `build-os` and runs on Node.js 24 or newer. No server or MCP process runs.

Code anchors:

- `docs/`, `system/`

### Change Notes

- Superseded for runtime and delivery by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#runtime-and-package): the installed product is one Node.js and TypeScript CLI in one npm package, with no MCP server in the current product. See `## Requirement History`.

## Module Map

| Area | Owns |
| --- | --- |
| `system/.os/` | The operating brain: `contracts/` (authority), `templates/` (shapes), `indexes/` (derived), `data/` (entities, NDJSON), `scripts/` (wrappers that reach the `buildos` CLI), `skills/` (packaged skills and their router) |
| `system/assets/` | Raw sources and their converted twins |
| `system/playbooks/` | Typed instruments by category |
| `system/workspace/` | `datasets/` (user data), `runs/`, `findings/`, `scripts/` |
| Project `docs/` | make-docs target-doc pipeline (designs → plans → prd → work). Make Docs creates it in an initialized project when the user chooses companion setup; the `system/` package does not carry it |
| `toolkits/buildos/` | The one TypeScript package for the `buildos` CLI, published as `build-os`. A transport-neutral core holds domain logic and returns typed results and errors; it never writes to stdout or exits the process. A thin CLI adapter parses arguments, calls the core, and formats output. Domains are packages inside this one package |

### Domain ownership

BuildOS deterministic tooling is one package at `toolkits/buildos/` with one `buildos` CLI. Each domain is a separate part of that package. Each domain has its own scope contract, its README and `AGENTS.md`, and is exposed as `buildos <domain>`. The package boundary does not merge domain boundaries. A domain must not gain an unrelated command because it already exists. Cross-domain calls use in-package interfaces and never subprocesses.

Before adding or moving durable deterministic logic, identify the owning domain and read its scope contract. When no domain owns the capability, plan a new domain inside `toolkits/buildos/`. Keep `system/.os/scripts/` thin: wrappers, routers, compatibility shims, and command documentation only. Do not add durable logic to an unmanaged script unless a PRD or design authorizes that temporary state. The maintainer guide [Build OS Toolkit CLI Development](../assets/maintainer/buildos-toolkit-cli-development.md) gives the step-by-step procedure.

| Domain | Command | Owns | Owning PRD |
| --- | --- | --- | --- |
| `entities` | `buildos entities` | Entity-graph validation, resolution, consolidation, and the entity-resolution index | [17](./17-entity-identity-and-canonical-resolution.md) |
| `intake` | `buildos intake` | Source intake, conversion, converted twins, and the `references.json` and `playbooks.json` catalog rebuilds | [07](./07-intake-and-conversion.md) |
| `discovery` | `buildos discovery` | Discovery-run recording, run artifacts, raw-finding anchoring, finding qualification, negative assertions, and run and finding validation | [10](./10-discovery-runs-and-qualification.md) |
| `design` | `buildos design` | The qualified-finding to design hand-off through `buildos design promote`, route selection, and finding design-link updates | [11](./11-flow-c-integration.md) |
| `init` | `buildos init` | Project initialization and adoption | [20](./20-buildos-cli-and-distribution.md#project-initialization-and-adoption) |
| `validate` | `buildos validate` | Adopter config checks and entity record hygiene checks | [13](./13-adopter-owned-config-surface.md#contracts-and-data) (checks); [20](./20-buildos-cli-and-distribution.md#command-surface) (command) |
| `version` | `buildos version` | The package version and source revision | [20](./20-buildos-cli-and-distribution.md#output-and-exit-contract) |
| `help` | `buildos help` | Help for the CLI or a domain | [20](./20-buildos-cli-and-distribution.md#command-surface) |
| `extract` | `buildos extract bulk`, from `0.2.0` | Bulk extraction | [08](./08-data-and-extraction.md) (extraction); [20](./20-buildos-cli-and-distribution.md#command-surface) (command) |
| `fitgap` | `buildos fitgap`, from `0.2.0` | Fit-gap analysis, with `.xlsx` output | [20](./20-buildos-cli-and-distribution.md#command-surface) |
| `export` | `buildos export azure-boards`, from `0.2.0` | Azure Boards CSV export | [20](./20-buildos-cli-and-distribution.md#command-surface) |

No domain yet owns three areas. The first is playbook behavior beyond the intake catalog rebuild: active-only runnable-playbook resolution and playbook contract validation. The second is extraction load-plan and data helpers beyond `buildos extract bulk`. The third is stage-mover orchestration. Each needs an ownership decision before durable commands are added for it.

Code anchors:

- `system/.os/AGENTS.md`
- `system/playbooks/AGENTS.md`
- `toolkits/AGENTS.md`
- `toolkits/buildos/AGENTS.md`

### Change Notes

- Superseded for source layout by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#command-surface): `toolkits/buildos/` holds one TypeScript package with a core and a thin CLI adapter, and the separate toolkit modules are not part of the current product. See `## Requirement History`.

## Runtime Boundaries

The hard boundary is the make-docs plug-in: its trees (`docs/` and `.make-docs/`, in the BuildOS checkout and in an initialized project where Make Docs is set up) are externally managed and never modified directly; the top routers are co-owned (augment-only). The `system/` package carries no Make Docs content. Within `system/`, `convert` is deterministic (the `buildos` CLI reached through script wrappers) while `extract` is smart (human/agent). Computer-use execution runs against the external target application.

The `buildos` CLI runs on Node.js 24 or newer. It is strict TypeScript compiled with `tsc` and shipped as ESM. The source checkout, the installed npm package, and adopter-owned data are distinct runtime boundaries. The current product has no MCP server. The seam between the core and the CLI adapter reserves a later MCP adapter, which would call the same core. [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#runtime-and-package) owns the runtime and package contract.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`

### Change Notes

- Superseded for runtime by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#runtime-and-package): the core keeps sole ownership of domain semantics, the CLI is the only adapter in the current product, and the runtime is Node.js 24 or newer. See `## Requirement History`.

## Data Flow

Three chained flows: **A — Intake** (`convert → extract → draft entity and extraction rows`); **B — Discovery** (`active playbook → run → raw finding → qualify → qualified finding`); **C — Planning/Engineering** (`qualified finding → design → plan → prd → work`). Two gates govern promotion: review-to-activate (instruments) and verify-to-promote (findings, where qualification = a deterministic repeatable test).

Code anchors:

- `system/workspace/runs/`, `system/workspace/findings/`

## Configuration Surfaces

Routers (`AGENTS.md` canonical, `CLAUDE.md` pointer) configure navigation; contracts under `system/.os/contracts/` configure artifact shape; `system/.gitignore` controls what ships. Scoped artifacts use the `systems`, `environments`, and `owners` list fields. Their values are configured IDs, resolved through `system/.os/config/instance.yaml`, as [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md#contracts-and-data) defines.

Code anchors:

- `system/.os/contracts/`
- `system/AGENTS.md`

### Change Notes

- Superseded for toolkit packaging by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#legacy-command-names): durable deterministic tooling is sourced in `toolkits/buildos/` and ships as the one `buildos` CLI; the `buildos-*` names survive only as legacy command names.

## Requirement History

### 2026-11-23 — W1 R7

- Affected requirement or section: `## Runtime Boundaries`, `## Module Map`
- Previous contract: Deterministic tooling was built as Go toolkits with separate `buildos-*` binaries, and `toolkits/buildos/` was planned as one Go module holding a cohesive Go core, CLI, and MCP program.
- Replacement contract: `toolkits/buildos/` is one TypeScript package on Node.js 24 or newer, with a transport-neutral core and a thin CLI adapter. The MCP adapter is deferred; the core and CLI seam reserves it.
- Rationale: Adopter reach through chat apps, alignment with the Make Docs stack, and npm delivery outweigh the measured native-runtime advantages.
- Source: [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)

### 2026-11-23 — W1 R7

- Affected requirement or section: `## Effective Requirement` (domain ownership container)
- Previous contract: Domain ownership was enforced inside one cohesive Go program, built from one Go module at `toolkits/buildos/`.
- Replacement contract: Domain ownership is enforced inside one TypeScript package at `toolkits/buildos/`, exposed as `buildos <domain>`. All ownership rules stay the same.
- Rationale: The runtime changed from Go to Node.js with TypeScript. The ownership rules do not depend on the language.
- Source: [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Module Map`, domain ownership
- Previous contract: Each deterministic toolkit had its own directory `toolkits/buildos-<slug>/` with its own `README.md` and `AGENTS.md`. The domain ownership table lived in a separate record. It listed `buildos-config` as planned, and it had no entities row and no `init`, `validate`, or `0.2.0` commands.
- Replacement contract: One package holds every domain, each with its own scope contract. One domain table in `## Module Map` matches the command surface in PRD 20.
- Rationale: The ownership rule belongs with the architecture.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Configuration Surfaces`
- Previous contract: `env`/`for` frontmatter tags scoped artifacts.
- Replacement contract: Scoped artifacts use the `systems`, `environments`, and `owners` list fields of configured IDs, resolved through `instance.yaml`.
- Rationale: The section body still stated the old rule.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `system/.os/`, `system/workspace/`
- `toolkits/`
