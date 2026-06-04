# Phase 01: PRD, Guide, and Design Lineage

## Purpose

Capture the durable documentation and requirement changes that make packaged `buildos-*` toolkits the Build OS standard for deterministic logic.

## Scope

This phase owns the PRD revision, affected baseline annotations, enterprise distribution risk entry, developer guide, and make-docs maintainer handoff design.

## Workstreams

| Workstream | Output | Dependency | Notes |
| --- | --- | --- | --- |
| PRD revision | `docs/prd/14-revise-deterministic-toolkit-deployment.md` | Source design | Defines the effective requirement. |
| Baseline annotations | `docs/prd/02-*`, `03-*`, `06-*`, `07-*`, `12-*`, `00-index.md` | PRD revision | Keeps W1 R0 context intact while recording PRD 14 as the active revision. |
| Developer guide | `docs/guides/developer/buildos-toolkit-cli-development.md` | Guide contract | Gives future maintainers a repeatable workflow for new, revised, and converted toolkits. |
| Standard design | `docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md` | Design contract | Records the architectural decision. |
| make-docs handoff | `docs/designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md` | make-docs boundary | Keeps upstream make-docs changes out of this local Build OS phase. |

## Concurrency

The PRD worker and guide/design workers can run in parallel after the coordinator confirms naming and scope. The make-docs handoff design can also run in parallel because it does not edit make-docs-owned assets.

Baseline annotations should wait for the PRD 14 requirement language to stabilize.

## Blockers

- Do not edit `.make-docs/`, `docs/assets/references/`, `docs/assets/templates/`, `system/.make-docs/`, or `system/docs/assets/` as part of this phase.
- Do not implement converter behavior or introduce a Go module in `toolkits/buildos-intake/`.
- Do not port `validate_config.py`; it remains an existing script until a later conversion phase.

## Validation

- Confirm PRD 14 is linked from `docs/prd/00-index.md`.
- Confirm affected baseline PRDs carry change notes rather than silent rewrites.
- Confirm the developer guide uses required guide frontmatter.
- Confirm design records include required design headings.
- Confirm relative links resolve.
