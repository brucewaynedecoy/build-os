# Build OS PRD Index

## Purpose

This PRD set is the descriptive source-of-truth for **Build OS** — a general-purpose, filesystem-based, agent-operable system for discovery, testing, requirements capture, design, and backlogging against any target system, platform, or application. The set is the current product authority. It keeps reusable Build OS requirements neutral while deployed instances provide their own configured vocabulary.

## Reading Order

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture-overview.md](./02-architecture-overview.md)
3. [03-open-questions-and-risk-register.md](./03-open-questions-and-risk-register.md)
4. [04-glossary.md](./04-glossary.md)
5. Subsystem docs `05`–`12` in number order.
6. [13-adopter-owned-config-surface.md](./13-adopter-owned-config-surface.md) for config and [17-entity-identity-and-canonical-resolution.md](./17-entity-identity-and-canonical-resolution.md) for entities.
7. [20-buildos-cli-and-distribution.md](./20-buildos-cli-and-distribution.md) for the `buildos` command, package, initialization, Make Docs companion setup, supply chain, release, and packaged skills.

Numbers `14`, `15`, `16`, `18`, and `19` are retired. Their last text is in `.make-docs/archive/prds/2026-11-23/`.

## Document Map

| Document | Kind | Status | Related Docs | Focus |
| --- | --- | --- | --- | --- |
| `00-index.md` | `core` | `active` | `—` | Explain the PRD set and how to read it |
| `01-product-overview.md` | `core` | `active` | `13`, `17`, `20` | Purpose, users, capabilities, boundaries, limitations |
| `02-architecture-overview.md` | `core` | `active` | `08`, `13`, `17`, `20` | Topology, modules, runtime boundaries, data flow, config, toolkit source |
| `03-open-questions-and-risk-register.md` | `core` | `active` | `02`, `13`, `17`, `20` | Drift, open questions, rebuild risks, and Phase 1 decision gates |
| `04-glossary.md` | `core` | `active` | `08`, `17` | Canonical terms |
| `05-spaces-boundary-and-shipping.md` | `baseline` | `active` | `06`, `11`, `20` | Three spaces, Make Docs boundary, shipping model |
| `06-operating-layer-and-routing.md` | `baseline` | `active` | `05`, `08`, `13`, `20` | `.os/` brain, contracts authority, agent routing, script wrappers |
| `07-intake-and-conversion.md` | `baseline` | `active` | `02`, `08`, `20` | Pillar 1: deterministic converters + provenance |
| `08-data-and-extraction.md` | `baseline` | `active` | `02`, `06`, `07`, `13`, `17`, `20` | `.os/data` entities, extraction ETL, layered canonicity |
| `09-playbooks.md` | `baseline` | `active` | `02`, `06`, `08`, `13`, `17` | Instruments, contract, gates, guardrails |
| `10-discovery-runs-and-qualification.md` | `baseline` | `active` | `02`, `08`, `09`, `13`, `20` | Runs, finding qualification (verify-to-promote) |
| `11-flow-c-integration.md` | `baseline` | `active` | `02`, `10`, `13`, `20` | Qualified-finding export and external Make Docs hand-off |
| `12-stage-automation.md` | `baseline` | `active` | `02`, `07`–`11`, `13`, `20` | Hooks + slash-command stage-movers |
| `13-adopter-owned-config-surface.md` | `subsystem` | `active` | `02`, `03`, `06`, `08`–`12`, `20` | Adopter-owned config for systems, environments, owners, and validation |
| `17-entity-identity-and-canonical-resolution.md` | `subsystem` | `active` | `01`–`04`, `08`, `09`, `20` | Entity identity, non-destructive consolidation, terminal canonical resolution, the derived index, and the `buildos entities` contract |
| `20-buildos-cli-and-distribution.md` | `subsystem` | `active` | `02`, `05`, `06`, `07`, `11`, `13`, `17` | The `buildos` command, package, initialization, companion setup, supply chain, release, and packaged skills |

## Current Authority Map

Each topic has one current owner.

| Topic | Current owner |
| --- | --- |
| Runtime and package | [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md) |
| Command and output contract | [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md) |
| Legacy command names | [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md) |
| Project initialization and adoption | [20 BuildOS CLI and Distribution: Project Initialization and Adoption](./20-buildos-cli-and-distribution.md#project-initialization-and-adoption) |
| Installed project paths | [05 Spaces, Boundary, and Shipping: Installed Project Paths](./05-spaces-boundary-and-shipping.md#installed-project-paths) |
| Make Docs companion setup | [20 BuildOS CLI and Distribution: Make Docs Companion Setup](./20-buildos-cli-and-distribution.md#make-docs-companion-setup) |
| Make Docs product boundary | [05 Spaces, Boundary, and Shipping: Integrations](./05-spaces-boundary-and-shipping.md#integrations) |
| Design hand-off to Make Docs | [11 Flow C Integration: Contracts and Data](./11-flow-c-integration.md#contracts-and-data) |
| Wrappers and skills routing | [06 Operating Layer and Routing](./06-operating-layer-and-routing.md) |
| Conversion | [07 Intake and Conversion](./07-intake-and-conversion.md) |
| Data lifecycle | [08 Data Layer & Extraction](./08-data-and-extraction.md) |
| Config validation | [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md) |
| Domain ownership | [02 Architecture Overview](./02-architecture-overview.md#module-map) |
| Entities | [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md) |
| Architecture | [02 Architecture Overview](./02-architecture-overview.md) |

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
- `docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md`
- `docs/designs/2026-11-23-prd-set-authority-cleanup.md`
- `docs/plans/2026-06-03-w1-r0-build-os-baseline/`
- `docs/plans/2026-06-03-w1-r1-adopter-owned-config-surface/`
- `docs/plans/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/`
- `docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/`
- `docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/`
- `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/`
- `docs/plans/2026-11-23-w1-r8-prd-set-authority-cleanup/`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/`
- `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/`
- `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/`
- `toolkits/`
- `system/.os/`, `system/playbooks/`

## Audience Paths

### New developer

Read `01` → `02` → `06` (operating layer) → the subsystem doc for the area you'll work in, then the matching backlog phase under `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/`.

For entity consolidation or canonical-reference work, continue through `08` → [02 Module Map](./02-architecture-overview.md#module-map) → [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md) → [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md) and the W1 R4 plan.

For CLI, package, initialization, or distribution work, start with [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md), then read `06` → `05` → [02 Module Map](./02-architecture-overview.md#module-map) and the W1 R7 plan.

Use the [Current Authority Map](#current-authority-map) to find the current owner of a topic.

### Product or technical lead

Read `01` → `05` (spaces, boundary, shipping) → `03` (open questions and risks) → `02`.

For CLI, distribution, or release decisions, read `20` first, then R-003, R-009, R-010, R-012, and Q-013 in `03`.

For deployed-instance entity cleanup or migration decisions, read [PRD 17 §Adoption and live-root migration safety](./17-entity-identity-and-canonical-resolution.md#adoption-and-live-root-migration-safety), [PRD 20 §Compatibility](./20-buildos-cli-and-distribution.md#compatibility), and register item [R-004](./03-open-questions-and-risk-register.md#r-004-existing-toolkit-and-deployed-project-migration-compatibility).

### AI coding assistant

Read `06` (operating layer & routing) first to learn the `.os/` brain and the make-docs boundary (`system/playbooks/administrative/respect-make-docs-plugin-boundary.md`), then `02`, then the subsystem doc for the task.

For any `buildos` command, package, initialization, or release task, read `20` first. It owns the command and output contract and the core and adapter rules.

For entity records, read `08`, the ownership rules in [02 Module Map](./02-architecture-overview.md#module-map), the consolidation contract in `17`, and the command contract in `20` before changing data or tools.

Use the [Current Authority Map](#current-authority-map) to find the owner of a topic.
