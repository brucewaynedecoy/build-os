# Adopter-Owned Config Surface Change Plan

> In v2, plans are directories. This is the `00-overview.md` entry point; phase detail lives in [`01-prd-and-contract-alignment.md`](01-prd-and-contract-alignment.md), [`02-operating-config-surface.md`](02-operating-config-surface.md), and [`03-migration-and-validation.md`](03-migration-and-validation.md).

**Date:** 2026-06-03

**Repository:** Build OS (`./`)

**Purpose:** Produce a reviewable change plan for implementing the adopter-owned config surface described in [2026-06-03-adopter-owned-config-surface.md](../../designs/2026-06-03-adopter-owned-config-surface.md), replacing fixed scoped vocabulary with configured `systems`, `environments`, and `owners`.

## Objective

Revise the W1 R0 baseline so Build OS contracts, playbooks, data rows, and validators no longer embed adopter-specific vocabulary. The implementation should add the config contract, starter config template, canonical instance config path, `system/.os/scripts/validate_config.py`, and the frontmatter hygiene check in the same scope.

## Coordinate Decision

- Coordinate: `W1 R1`
- Basis: The source design explicitly hands off from the W1 R0 baseline and says this is a revision to the baseline architecture and backlog rather than a new wave.
- Existing plan context: [W1 R0 baseline plan](../2026-06-03-w1-r0-build-os-baseline/00-overview.md) is the only existing plan directory.
- Directory: `docs/plans/2026-06-03-w1-r1-adopter-owned-config-surface/`
- Follow-on work directory: `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/`

## Change Classification

- Type: additive configuration surface plus contract revision.
- Active-set handling: evolve the active PRD namespace in place. Do not archive or renumber existing PRD docs.
- Scope: add a new PRD change doc for adopter-owned config, annotate impacted baseline docs, and generate a delta work backlog that slots the work into the existing operating-layer, data, playbook, and validation phases.
- Non-goal: directory namespace renaming. The source design defers renaming `system/.os/` and root `system/`; this plan keeps the current paths.

## Change Inputs

- Source design: [2026-06-03-adopter-owned-config-surface.md](../../designs/2026-06-03-adopter-owned-config-surface.md)
- Baseline design: [2026-06-03-build-os-architecture.md](../../designs/2026-06-03-build-os-architecture.md)
- Baseline plan: [2026-06-03-w1-r0-build-os-baseline](../2026-06-03-w1-r0-build-os-baseline/00-overview.md)
- Open-question closure: [03-open-questions-and-risk-register.md](../../prd/03-open-questions-and-risk-register.md)
- Primary implementation anchors: `system/.os/contracts/playbook-contract.md`, `system/.os/contracts/`, `system/.os/templates/`, `system/.os/scripts/`

## Baseline Context

The current baseline treats scoped vocabulary as fixed field values. `docs/prd/02-architecture-overview.md` names configuration surfaces but still describes `env`/`for` frontmatter tags as the scoping mechanism. `docs/prd/09-playbooks.md` and `system/.os/contracts/playbook-contract.md` carry the same legacy field names, while `docs/prd/08-data-and-extraction.md` has not yet incorporated configured vocabulary into entity rows. Q-002 is now closed with a decision to use adopter-owned config.

## Output Contract

This plan follows [planning-workflow.md](../../assets/references/planning-workflow.md), [output-contract.md](../../assets/references/output-contract.md), and [wave-model.md](../../assets/references/wave-model.md).

Execution of this plan should produce:

| Artifact | Path | Purpose |
| --- | --- | --- |
| PRD change doc | `docs/prd/13-adopter-owned-config-surface.md` | Capture the effective requirements for config-backed `systems`, `environments`, and `owners`. |
| PRD index update | `docs/prd/00-index.md` | Add the change doc and lineage to the active PRD map. |
| Baseline annotations | `docs/prd/02-architecture-overview.md`, `docs/prd/06-operating-layer-and-routing.md`, `docs/prd/08-data-and-extraction.md`, `docs/prd/09-playbooks.md`, `docs/prd/10-discovery-runs-and-qualification.md`, `docs/prd/11-flow-c-integration.md`, `docs/prd/12-stage-automation.md` | Record the effective config-backed vocabulary where baseline text currently assumes fixed tags. |
| Delta work backlog | `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/` | Prescriptive implementation tasks for config, contract, migration, and validation work. |

## Change Doc Strategy

Create `docs/prd/13-adopter-owned-config-surface.md` from `docs/assets/templates/prd-change-addition.md`. Treat it as an addition because it introduces a new configuration surface and validator, while the required baseline annotations should capture the revision from fixed `env`/`for` vocabulary to configured `systems`, `environments`, and `owners`.

The change doc should include:

- `system/.os/config/instance.yaml` as canonical adopter-owned config.
- `system/.os/contracts/config-contract.md` as the authority for config shape.
- `system/.os/templates/instance-config.yaml` as the neutral starter template.
- `system/.os/scripts/validate_config.py` as a required first-pass validator.
- frontmatter hygiene for Markdown artifacts that reference configured values.
- explicit replacement of `env` with `environments` and `for` with `owners`.

## Baseline Annotation Plan

Annotate baseline docs instead of silently rewriting them:

| Baseline doc | Annotation focus |
| --- | --- |
| `docs/prd/02-architecture-overview.md` | Add `system/.os/config/` and `validate_config.py` to configuration surfaces; replace fixed tag framing. |
| `docs/prd/06-operating-layer-and-routing.md` | Add config as an operational authority alongside contracts, templates, indexes, data, and scripts. |
| `docs/prd/08-data-and-extraction.md` | Require structured rows to use configured `systems`, `environments`, and `owners` where scoping applies. |
| `docs/prd/09-playbooks.md` | Replace `env`/`for` with config-backed `systems`, `environments`, and `owners` in playbook frontmatter. |
| `docs/prd/10-discovery-runs-and-qualification.md` | Carry configured scoping values through run records and findings. |
| `docs/prd/11-flow-c-integration.md` | Pass configured scoping metadata into the qualified-finding to design handoff. |
| `docs/prd/12-stage-automation.md` | Include config validation and frontmatter hygiene in stage automation hardening. |

## Worker Ownership

| Worker | Scope | Write Scope | Dependencies | Deliverables |
| ------ | ----- | ----------- | ------------ | ------------ |
| Worker A | PRD change and baseline annotations | `docs/prd/13-adopter-owned-config-surface.md`, targeted `docs/prd/*.md` annotations, `docs/prd/00-index.md` | Source design and W1 R0 PRDs | Active-set PRD evolution with backlinks and no renumbering. |
| Worker B | Operating config surface | `system/.os/config/`, `system/.os/contracts/config-contract.md`, `system/.os/templates/instance-config.yaml`, router updates | Worker A effective requirements | Config contract, neutral starter template, canonical config path. |
| Worker C | Scoped field migration | `system/.os/contracts/playbook-contract.md`, playbook frontmatter, data contract drafts, generated index expectations | Worker B config vocabulary contract | `systems`, `environments`, and `owners` usage across scoped artifacts. |
| Worker D | Validation and hygiene | `system/.os/scripts/validate_config.py`, validation docs or script tests, delta backlog validation notes | Workers B and C | Config validation, frontmatter hygiene checks, migration error behavior. |

## MCP Strategy

- Use `jdocmunch` for PRD, design, plan, and work docs discovery.
- Use `jcodemunch` only if implementation reaches code or script symbol discovery.
- If indexes are stale, reindex before falling back to direct reads.
- Use direct file reads only for local validation, final diff review, or when the MCP index cannot represent the needed filesystem state.

## Validation

Execution should validate both documents and implementation:

- Run docs path hygiene after PRD and work updates.
- Confirm `docs/prd/00-index.md` includes `13-adopter-owned-config-surface.md`.
- Confirm impacted baseline docs include `### Change Notes` backlinks to the new change doc.
- Confirm no active PRD files are renumbered.
- Run `python3 system/.os/scripts/validate_config.py` once implemented.
- Confirm the frontmatter hygiene check fails legacy `env` and `for` fields after migration and accepts configured `systems`, `environments`, and `owners`.
- Re-scan active docs and contracts for remaining fixed scoped vocabulary after migration.

## Phase Map

| Phase | Detail | Purpose |
| --- | --- | --- |
| P1 | [PRD and Contract Alignment](01-prd-and-contract-alignment.md) | Evolve the active PRD namespace and baseline annotations. |
| P2 | [Operating Config Surface](02-operating-config-surface.md) | Add config contract, canonical config, starter template, and operational routing. |
| P3 | [Migration and Validation](03-migration-and-validation.md) | Migrate scoped fields and implement `validate_config.py` plus frontmatter hygiene. |

## Handoff To Execution

This is a plan only; execution still needs approval. The downstream work should generate a W1 R1 delta backlog before implementation, keep worker write scopes disjoint, and treat validation as mandatory rather than optional hardening.
