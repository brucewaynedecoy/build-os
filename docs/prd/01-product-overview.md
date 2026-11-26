# 01 Product Overview

## Purpose

Build OS is a filesystem-based, agent-operable "operating system" a team adopts to run discovery, testing, requirements capture, design, and backlogging against a target system, platform, or application. It exists to turn unstructured source material and hands-on exploration into verified, reproducible knowledge and engineering-ready artifacts, while staying git-native and reviewable. Its first validation scenario is a representative enterprise application discovery effort with multiple configured environments.

## Users

Build OS serves two operator classes working together: human practitioners (discovery analysts, testers, solution designers) and agents (including computer-use agents that drive a target application). Both navigate the same filesystem via per-directory routers.

Most adopters are non-technical product owners and project managers. They use BuildOS through chat apps with folder access, such as Claude Cowork, GitHub Copilot Desktop, and ChatGPT desktop in Work mode. The agent in the chat app runs the `buildos` commands for them. These adopters must not need to build code, manage binaries on `PATH`, install Python, or know which wrapper runs. Technical adopters can run the same commands from a terminal. Enterprise security and engineering reviewers approve BuildOS for use and rely on its supply-chain record, which [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#supply-chain) owns.

Code anchors:

- `system/AGENTS.md`
- `system/.os/AGENTS.md`

## Key Capabilities

- Deterministic intake: convert unstructured sources (`docx`, `xlsx`, `pdf`, `html`) into clean text/CSV twins with provenance, without structuring.
- Extraction (ETL): turn converted content into typed entity records, playbooks, or docs.
- Entity identity: consolidate duplicate or superseded entity records without erasing them, resolve old and new references to one current canonical record, and reuse reviewed persona identities. [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md) owns the entity contract.
- Playbooks: typed Markdown instruments that guide humans and agents, with a review-to-activate lifecycle.
- Discovery & qualification: run playbooks, record immutable runs, and qualify findings with deterministic, repeatable tests.
- Planning/engineering hand-off: promote qualified findings into the make-docs design → plan → PRD → work pipeline.
- One `buildos` command: every deterministic operation runs through one CLI from the npm package `build-os`. An agent can run it with `npx` and no install step. `buildos init` sets up or adopts a project and offers optional Make Docs companion setup. [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md) owns the command, package, and setup contract.

Code anchors:

- `system/playbooks/`
- `system/.os/contracts/playbook-contract.md`
- `system/workspace/`

### Change Notes

- Superseded for runtime and delivery by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md): the product ships as one Node.js and TypeScript `buildos` CLI in one npm package, with no MCP server in the current product. See `## Requirement History`.

## System Boundaries

Build OS owns everything under `system/`. The `system/` package carries no Make Docs content. In an initialized project, Make Docs owns the `docs/` and `.make-docs/` trees when the user chooses to set it up; Build OS uses them through their own routers but never modifies them. It depends on the make-docs plug-in (installed/maintained by a separate CLI, and set up only through that CLI) for all `docs/` documentation pipelines, and on an external agent harness for computer-use execution.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `.make-docs/manifest.json`

## Current Limitations

BuildOS needs Node.js 24 or newer, the same floor as Make Docs. It needs no other runtime: no Go toolchain, no native binary on `PATH`, and no Python. When Node is missing or too old, the adopter sees one plain message that names what to install, as [06 Operating Layer & Routing](./06-operating-layer-and-routing.md#contracts-and-data) requires.

The current product has no MCP server. The core and CLI split in [02 Architecture Overview](./02-architecture-overview.md#runtime-boundaries) reserves a later MCP adapter over the same core.

Build OS is greenfield: only the first slice (operating-layer routers, the playbook contract, and the boundary guardrail) is built. Intake, the data layer, discovery/qualification, Flow C, and stage automation are designed but not yet implemented. The adopter-owned config surface now generalizes scoped vocabulary; downstream data, discovery, and handoff surfaces still need implementation to use it end to end.

Code anchors:

- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/00-index.md`

## Requirement History

### 2026-11-23 — W1 R7

- Affected requirement or section: `## Users`, `## Current Limitations`
- Previous contract: Users were described only as human practitioners and agents, not as chat-app adopters. No runtime prerequisite was stated. The planned program included an MCP server in one Go distribution.
- Replacement contract: Most adopters are non-technical product owners and project managers who work through chat apps with folder access, where the agent runs the commands. Node.js 24 or newer is the only prerequisite. The current product has no MCP server.
- Rationale: The current adopter base cannot build Go code or manage binaries, and Make Docs users already have Node 24.
- Source: [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)

## Source Anchors

- `README.md`
- `docs/designs/2026-06-03-build-os-architecture.md`
- `system/.os/`, `system/playbooks/`
