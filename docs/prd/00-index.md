# Build OS PRD Index

## Purpose

This PRD set is the descriptive source-of-truth for **Build OS** — a general-purpose, filesystem-based, agent-operable system for discovery, testing, requirements capture, design, and backlogging against any target system, platform, or application. The set is derived from the baseline build plan and architecture design, then evolved through active change docs that keep reusable Build OS requirements neutral while deployed instances provide their own configured vocabulary.

## Reading Order

1. [01-product-overview.md](./01-product-overview.md)
2. [02-architecture-overview.md](./02-architecture-overview.md)
3. [03-open-questions-and-risk-register.md](./03-open-questions-and-risk-register.md)
4. [04-glossary.md](./04-glossary.md)
5. Subsystem docs `05`–`12` in number order.
6. Active change docs in number order, starting with [13-adopter-owned-config-surface.md](./13-adopter-owned-config-surface.md).

## Document Map

| Document | Kind | Status | Related Docs | Focus |
| --- | --- | --- | --- | --- |
| `00-index.md` | `core` | `active` | `—` | Explain the PRD set and how to read it |
| `01-product-overview.md` | `core` | `active` | `—` | Purpose, users, capabilities, boundaries, limitations |
| `02-architecture-overview.md` | `core` | `active` | `13` | Topology, modules, runtime boundaries, data flow, config |
| `03-open-questions-and-risk-register.md` | `core` | `active` | `13` | Drift, open questions, rebuild risks |
| `04-glossary.md` | `core` | `active` | `—` | Canonical terms |
| `05-spaces-boundary-and-shipping.md` | `baseline` | `active` | `06`, `11` | Three spaces, make-docs boundary, shipping model |
| `06-operating-layer-and-routing.md` | `baseline` | `active` | `05`, `08`, `13` | `.os/` brain, contracts authority, agent routing |
| `07-intake-and-conversion.md` | `baseline` | `active` | `08` | Pillar 1: deterministic converters + provenance |
| `08-data-and-extraction.md` | `baseline` | `active` | `06`, `07`, `13` | `.os/data` entities, extraction ETL, layered canonicity |
| `09-playbooks.md` | `baseline` | `active` | `06`, `08`, `13` | Instruments, contract, gates, guardrails |
| `10-discovery-runs-and-qualification.md` | `baseline` | `active` | `09`, `08`, `13` | Runs, finding qualification (verify-to-promote) |
| `11-flow-c-integration.md` | `baseline` | `active` | `10`, `13` | Qualified-finding → design hand-off |
| `12-stage-automation.md` | `baseline` | `active` | `07`–`11`, `13` | Hooks + slash-command stage-movers |
| `13-adopter-owned-config-surface.md` | `addition` | `active` | `02`, `03`, `06`, `08`–`12` | Adopter-owned config for systems, environments, owners, and validation |

## Source Anchors

- `README.md`
- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/designs/2026-06-03-adopter-owned-config-surface.md`
- `docs/plans/2026-06-03-w1-r0-build-os-baseline/`
- `docs/plans/2026-06-03-w1-r1-adopter-owned-config-surface/`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/`
- `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/`
- `system/.os/`, `system/playbooks/`

## Audience Paths

### New developer

Read `01` → `02` → `06` (operating layer) → the subsystem doc for the area you'll work in, then the matching backlog phase under `docs/work/2026-06-03-w1-r0-build-os-baseline/`.

### Product or technical lead

Read `01` → `05` (spaces, boundary, shipping) → `03` (open questions and risks) → `02`.

### AI coding assistant

Read `06` (operating layer & routing) first to learn the `.os/` brain and the make-docs boundary (`system/playbooks/administrative/respect-make-docs-plugin-boundary.md`), then `02`, then the subsystem doc for the task.
