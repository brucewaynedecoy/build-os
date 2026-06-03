# 01 Product Overview

## Purpose

Build OS is a filesystem-based, agent-operable "operating system" a team adopts to run discovery, testing, requirements capture, design, and backlogging against a target system, platform, or application. It exists to turn unstructured source material and hands-on exploration into verified, reproducible knowledge and engineering-ready artifacts, while staying git-native and reviewable. Its first application is the Hitachi × John Deere engagement around Microsoft's Dynamics Rental on Dynamics 365 Finance & Operations.

## Users

Build OS serves two operator classes working together: human practitioners (discovery analysts, testers, solution designers) and agents (including computer-use agents that drive a target application). Both navigate the same filesystem via per-directory routers.

Code anchors:

- `system/AGENTS.md`
- `system/.os/AGENTS.md`

## Key Capabilities

- Deterministic intake: convert unstructured sources (`docx`, `xlsx`, `pdf`, `html`) into clean text/CSV twins with provenance, without structuring.
- Extraction (ETL): turn converted content into typed entity records, playbooks, or docs.
- Playbooks: typed Markdown instruments that guide humans and agents, with a review-to-activate lifecycle.
- Discovery & qualification: run playbooks, record immutable runs, and qualify findings with deterministic, repeatable tests.
- Planning/engineering hand-off: promote qualified findings into the make-docs design → plan → PRD → work pipeline.

Code anchors:

- `system/playbooks/`
- `system/.os/contracts/playbook-contract.md`
- `system/workspace/`

## System Boundaries

Build OS owns everything under `system/` *except* the make-docs-managed `system/docs/` and `system/.make-docs/` trees, which it uses through their own routers but never modifies. It depends on the make-docs plug-in (installed/maintained by a separate CLI) for all `docs/` documentation pipelines, and on an external agent harness for computer-use execution.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `.make-docs/manifest.json`

## Current Limitations

Build OS is greenfield: only the first slice (operating-layer routers, the playbook contract, and the boundary guardrail) is built. Intake, the data layer, discovery/qualification, Flow C, and stage automation are designed but not yet implemented. The first engagement's `env` values (`vanilla`/`deere`) are concrete rather than generalized for arbitrary adopters.

Code anchors:

- `docs/work/2026-06-03-w1-r0-build-os-baseline/00-index.md`

## Source Anchors

- `README.md`
- `docs/designs/2026-06-03-build-os-architecture.md`
- `system/.os/`, `system/playbooks/`
