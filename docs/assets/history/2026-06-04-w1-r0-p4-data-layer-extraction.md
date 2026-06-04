---
date: "2026-06-04"
coordinate: "W1 R0 P4"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Implemented the Build OS data layer, extraction validation, and playbook index for W1 R0 P4."
---

# W1 R0 P4 Data Layer and Extraction

## Changes

Implemented the first structured data layer under `system/.os/data/`, reconciled the extraction contracts to use `draft` as the pending state, added entity JSONL validation, and extended `buildos-intake` with a rebuildable playbook catalog.

| Area | Summary |
| --- | --- |
| Data contracts | Updated entity and extraction contracts for canonical JSONL files, `source_anchor`, promoted `doc_anchor`, load-plan minting, and dataset references. |
| Data store | Added empty canonical JSONL files for requirements, capabilities, personas, test cases, results, runs, findings, and extractions. |
| Validation | Extended `validate_config.py` to check entity JSONL format, ID prefixes, status values, scoped config IDs, anchors, extraction provenance, and negative self-test cases. |
| Indexing | Added `buildos-intake index playbooks` and generated `system/.os/indexes/playbooks.json` from current playbook frontmatter. |
| Reconciliation | Updated PRD and work backlog wording from candidate staging to draft staging. |

Manual-test coverage decision: worthwhile. The work adds an administrator-facing CLI path and a generated catalog whose real-current contents benefit from human inspection beyond unit assertions. The acceptance scenario is to run `buildos-intake index playbooks` against the checkout, confirm the command reports the expected playbook count, inspect `system/.os/indexes/playbooks.json` for deterministic versioned entries that match the current playbooks, and then run `validate_config.py` to confirm the repository data layer still passes hygiene checks. Manual-test result: passed as expected, with no follow-up changes required.

Developer-guide coverage decision: existing guides own the durable maintainer knowledge, so no new guide was created.

| Capability | Outcome | Rationale |
| --- | --- | --- |
| Structured `.os/data` entity and extraction validation | `update-existing` | Expanded the operating-layer contracts maintenance guide because it owns contracts, `.os/data`, source-of-truth boundaries, and validation safety rules. |
| `buildos-intake index playbooks` and generated `playbooks.json` | `update-existing` | Expanded the toolkit CLI development guide because it owns deterministic toolkit command behavior, generated indexes, and validation workflow. |
| End-user guidance | `none` | The P4 work is maintainer/admin infrastructure and does not add a shipped product workflow for end users. |

User-guide coverage decision: `none`. The completed P4 work creates internal structured data stores, repository validation, and an administrator-maintained playbook index; it does not create or change a shipped user-facing task, setup path, product workflow, configuration choice, or troubleshooting path that belongs in `docs/guides/user/`. No user guide exists or was created for this pass.

PRD coverage decision: `prd-change-doc` and `baseline-change-note`. The P4 implementation changed an established lifecycle requirement from `candidate` staging to `draft` entity and extraction rows, so the active PRD namespace needed a numbered revision doc and backlinks. The risk register remained unchanged because no new or resolved gap, open question, confirmed drift item, or rebuild risk was found.

| Capability or finding | Outcome | Rationale |
| --- | --- | --- |
| Entity and extraction pending lifecycle | `prd-change-doc` | Added PRD 15 as the next active revision so `draft` is the effective pending lifecycle state and `candidate` is excluded from `.os/data` entity status vocabulary. |
| Existing PRD references to extraction candidates | `baseline-change-note` | Updated PRD 02, PRD 04, and PRD 08 with current wording and backlinks to PRD 15. |
| PRD index lineage | `index-only` | Updated PRD 00 so status, kind, related docs, focus, and lineage include PRD 15. |
| Risk register | `none` | No distinct new or closed gap, drift item, open question, decision, or rebuild risk was discovered during this pass. |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md](../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md) | Reconciled P4 task wording to `draft` staging. |
| [../../prd/00-index.md](../../prd/00-index.md) | Added PRD 15 to the active PRD map and related-doc lineage. |
| [../../prd/02-architecture-overview.md](../../prd/02-architecture-overview.md) | Reconciled Flow A to draft entity and extraction rows and linked PRD 15. |
| [../../prd/04-glossary.md](../../prd/04-glossary.md) | Replaced the candidate entity status term with the draft lifecycle term and linked PRD 15. |
| [../../prd/08-data-and-extraction.md](../../prd/08-data-and-extraction.md) | Reconciled the source PRD to `draft` rows pending promotion and linked PRD 15. |
| [../../prd/15-revise-extraction-draft-lifecycle.md](../../prd/15-revise-extraction-draft-lifecycle.md) | Records the active PRD revision that makes `draft` the pending lifecycle state for entity and extraction rows. |

### Developer

| Path | Description |
| --- | --- |
| [../../../system/.os/contracts/entity-records-contract.md](../../../system/.os/contracts/entity-records-contract.md) | Defines canonical entity JSONL files, shared envelope anchors, lifecycle, and validation expectations. |
| [../../../system/.os/contracts/extraction-contract.md](../../../system/.os/contracts/extraction-contract.md) | Defines extraction load-plan rows, minted IDs, dataset references, and provenance fields. |
| [../../guides/developer/operating-layer-contracts-maintenance.md](../../guides/developer/operating-layer-contracts-maintenance.md) | Added maintainer guidance for canonical `.os/data` files, entity row anchors, validation, generated index boundaries, and P4 links. |
| [../../guides/developer/buildos-toolkit-cli-development.md](../../guides/developer/buildos-toolkit-cli-development.md) | Added maintainer guidance for `buildos-intake index playbooks`, playbook catalog generation, validation, and troubleshooting. |
| [../../../toolkits/buildos-intake/README.md](../../../toolkits/buildos-intake/README.md) | Updated the local toolkit command surface and contract references for playbook indexing. |
| `system/.os/scripts/validate_config.py` | Validates config, scoped frontmatter, and entity JSONL hygiene. |
| `toolkits/buildos-intake/cmd/buildos-intake/main.go` | Adds the `index playbooks` command. |
| `toolkits/buildos-intake/internal/intake/index.go` | Builds `references.json` and the new derived `playbooks.json` catalog. |

### User

None this session.
