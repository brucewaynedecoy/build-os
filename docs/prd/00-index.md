# Build OS PRD Index

## Purpose

This PRD set is the descriptive source-of-truth for **Build OS** — a general-purpose, filesystem-based, agent-operable system for discovery, testing, requirements capture, design, and backlogging against any target system, platform, or application. The set is derived from the baseline build plan and architecture design, then evolved through active change docs that keep reusable Build OS requirements neutral while deployed instances provide their own configured vocabulary.

## Reading Order

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture-overview.md](./02-architecture-overview.md)
3. [03-open-questions-and-risk-register.md](./03-open-questions-and-risk-register.md)
4. [04-glossary.md](./04-glossary.md)
5. Subsystem docs `05`–`12` in number order.
6. Change docs in active-namespace number order, starting with [13-adopter-owned-config-surface.md](./13-adopter-owned-config-surface.md) through draft [19-revise-build-os-headless-core-cli-and-mcp-program.md](./19-revise-build-os-headless-core-cli-and-mcp-program.md); PRD 19 is non-authoritative until approval and commit.

## Document Map

| Document | Kind | Status | Related Docs | Focus |
| --- | --- | --- | --- | --- |
| `00-index.md` | `core` | `active` | `—` | Explain the PRD set and how to read it |
| `01-product-overview.md` | `core` | `active` | `13`, `14`, `17`, `19` | Purpose, users, capabilities, boundaries, limitations |
| `02-architecture-overview.md` | `core` | `active` | `13`, `14`, `15`, `17`, `19` | Topology, modules, runtime boundaries, data flow, config, toolkit source |
| `03-open-questions-and-risk-register.md` | `core` | `active` | `13`, `14`, `16`–`19` | Drift, open questions, rebuild risks, and Phase 1 decision gates |
| `04-glossary.md` | `core` | `active` | `15`, `17` | Canonical terms |
| `05-spaces-boundary-and-shipping.md` | `baseline` | `active` | `06`, `11`, `19` | Three spaces, Make Docs boundary, shipping model |
| `06-operating-layer-and-routing.md` | `baseline` | `active` | `05`, `08`, `13`, `14`, `19` | `.os/` brain, contracts authority, agent routing, script wrappers |
| `07-intake-and-conversion.md` | `baseline` | `active` | `08`, `14`, `16`, `19` | Pillar 1: deterministic converters + provenance |
| `08-data-and-extraction.md` | `baseline` | `active` | `06`, `07`, `13`, `15`–`17`, `19` | `.os/data` entities, extraction ETL, layered canonicity |
| `09-playbooks.md` | `baseline` | `active` | `06`, `08`, `13`, `16`, `17`, `19` | Instruments, contract, gates, guardrails |
| `10-discovery-runs-and-qualification.md` | `baseline` | `active` | `08`, `09`, `13`, `16`, `19` | Runs, finding qualification (verify-to-promote) |
| `11-flow-c-integration.md` | `baseline` | `active` | `10`, `13`, `16`, `19` | Qualified-finding export and external Make Docs hand-off |
| `12-stage-automation.md` | `baseline` | `active` | `07`–`11`, `13`, `14`, `16`, `19` | Hooks + slash-command stage-movers |
| `13-adopter-owned-config-surface.md` | `addition` | `active` | `02`, `03`, `06`, `08`–`12`, `19` | Adopter-owned config for systems, environments, owners, and validation |
| `14-revise-deterministic-toolkit-deployment.md` | `revision` | `active` | `02`, `03`, `06`, `07`, `12`, `16`–`19` | Packaged deterministic tooling history; target topology is revised by PRD 19 |
| `15-revise-extraction-draft-lifecycle.md` | `revision` | `active` | `02`, `04`, `08`, `17`, `19` | `draft` as the pending lifecycle state for entity and extraction rows |
| `16-revise-toolkit-ownership-boundaries.md` | `revision` | `active` | `07`–`14`, `17`–`19` | Domain ownership retained inside the cohesive core/CLI/MCP program |
| `17-enhance-entity-consolidation-and-canonical-resolution.md` | `enhancement` | `active` | `01`–`04`, `08`, `09`, `14`–`16`, `18`, `19` | Non-destructive entity consolidation, canonical resolution, deterministic index, `buildos entities`, and staged source-build migration |
| `18-revise-unified-buildos-cli-and-distribution.md` | `revision` | `active` | `03`, `14`, `16`, `17`, `19` | CLI consolidation evidence retained; CLI-first internals and inventory revised by PRD 19 |
| `19-revise-build-os-headless-core-cli-and-mcp-program.md` | `revision` | `draft` | `01`–`03`, `05`–`18` | Phase 1 capability contract for one Go headless core, CLI, and MCP distribution; non-authoritative until approval and commit |

## Source Anchors

- `README.md`
- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/designs/2026-06-03-adopter-owned-config-surface.md`
- `docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md`
- `docs/designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md`
- `docs/designs/2026-07-21-entity-consolidation-and-canonical-resolution.md`
- `docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md`
- `docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md` (approved drafting input; uncommitted)
- `docs/designs/2026-08-14-build-os-runtime-selection-proof.md` (approved drafting input; uncommitted)
- `docs/plans/2026-06-03-w1-r0-build-os-baseline/`
- `docs/plans/2026-06-03-w1-r1-adopter-owned-config-surface/`
- `docs/plans/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/`
- `docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/`
- `docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/`
- `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/`
- `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/`
- `toolkits/`
- `system/.os/`, `system/playbooks/`

## Audience Paths

### New developer

Read `01` → `02` → `06` (operating layer) → the subsystem doc for the area you'll work in, then the matching backlog phase under `docs/work/2026-06-03-w1-r0-build-os-baseline/`.

For entity consolidation or canonical-reference work, continue through `08` → `16` → [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md) → [18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md) and the W1 R4 plan.

For CLI consolidation or distribution work, continue through `14` → `16` → [18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md) and the W1 R5 plan.

Then review draft [19 Revise Build OS Headless Core, CLI, and MCP Program](./19-revise-build-os-headless-core-cli-and-mcp-program.md) for the proposed effective capability map and explicit approval gates; do not implement from PRD 19 until its design inputs, PRD package, coordinate, and repository-authority state are approved.

### Product or technical lead

Read `01` → `05` (spaces, boundary, shipping) → `03` (open questions and risks) → `02`.

For deployed-instance entity cleanup or migration decisions, also read `17`, `18`, draft `19`, R-003, R-004, and the Phase 1 decision items in `03`.

### AI coding assistant

Read `06` (operating layer & routing) first to learn the `.os/` brain and the make-docs boundary (`system/playbooks/administrative/respect-make-docs-plugin-boundary.md`), then `02`, then the subsystem doc for the task.

For entity records, read `08`, the ownership rules in `16`, the consolidation contract in `17`, and the committed unified-CLI contract in `18` before changing data or tools.

Review draft `19` for the proposed core/CLI/MCP boundary and stop before product implementation unless its stated approval, commit or merge, and separate implementation-authorization gates have passed.
