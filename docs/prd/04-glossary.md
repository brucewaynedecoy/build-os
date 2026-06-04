# 04 Glossary

## Purpose

Define the canonical vocabulary used across the Build OS PRD set so humans and coding assistants interpret the same terms the same way.

## Terms

| Term | Definition | Notes |
| --- | --- | --- |
| Build OS | The general-purpose, filesystem-based, agent-operable discovery/testing/design system shipped under `system/`. | `README.md` |
| Build layer | `docs/` — how *we* build the system. One of the three spaces. | make-docs tree |
| Target docs | `system/docs/` — outputs *about the configured target system*, for the adopter. | make-docs tree |
| Pillar | One of Convert, Playbooks, Workspace. | `02-architecture-overview.md` |
| Flow A / B / C | Intake / Discovery / Planning-Engineering; the three chained flows. | `02-architecture-overview.md` |
| Convert | Deterministic, tool-first transform of a source into a clean text/CSV twin; no structuring. | `07-intake-and-conversion.md` |
| Extract | User-driven ETL that loads converted content into entities, playbooks, or docs. | `08-data-and-extraction.md` |
| Playbook | A typed Markdown instrument that guides a human or agent. | `09-playbooks.md` |
| State-nature | A playbook axis: `stateful` · `standing` · `guardrail`. | `system/.os/contracts/playbook-contract.md` |
| Guardrail | A non-executing playbook that constrains behavior (Scope/Rules/Rationale). | `system/playbooks/administrative/` |
| Draft | The pending lifecycle state for entity and extraction rows that are extracted or authored but not yet promoted. | `08-data-and-extraction.md`, `15-revise-extraction-draft-lifecycle.md` |
| Review-to-activate | The editorial gate for instruments (`draft → reviewed → active`). | `09-playbooks.md` |
| Verify-to-promote | The evidentiary gate for findings; satisfied by qualification. | `10-discovery-runs-and-qualification.md` |
| Run record | Immutable artifact of one execution in `system/workspace/runs/<id>/`. | `10-…` |
| Raw / Qualified finding | A finding observed in a run / confirmed by a deterministic repeatable test in `system/workspace/findings/<id>/`. | `10-…` |
| Capability / Requirement / Finding | Descriptive (what the product can do) / normative (what the adopter needs) / empirical (what was observed). | `08-data-and-extraction.md` |
| Capability gap / Bug | A requirement with no capability / a capability that misbehaves. | adopter deliverables |
| Layered canonicity | Structured fields canonical in `.os/data/*.jsonl`; narrative canonical in `system/docs/`; overlaps generated. | `08-…` |
| make-docs boundary | The four externally-managed trees that must not be modified directly. | `05-spaces-boundary-and-shipping.md` |

### Change Notes

- Revised by [15 Revise Extraction Draft Lifecycle](./15-revise-extraction-draft-lifecycle.md): `draft` is the effective ungated lifecycle term for entity and extraction rows; `candidate` is not part of the `.os/data` entity lifecycle vocabulary.

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `system/.os/contracts/playbook-contract.md`
