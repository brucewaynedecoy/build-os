---
date: "2026-06-04"
repo: "build-os"
branch: "main"
status: "complete"
coordinate: "W1 R0 P1"
summary: "Completed operating-layer contracts and routers."
---

# W1 R0 P1 Operating Layer Contracts

## Changes

Completed the remaining P1 authority contracts and router scaffold for Build OS. The work added
contracts for entity records, run records, findings, converted sources, and extraction load plans;
added `.os/data` and `.os/indexes` routers with one-line `CLAUDE.md` pointers; updated the root and
contracts routers; and marked the P1 backlog tasks complete.

Manual-test coverage decision: no manual end-user test is warranted. This session changed
contracts, routers, and work-backlog status only; there is no user-observable runtime behavior to
exercise, and a hand-run scenario would not add meaningful coverage beyond reviewing the documents
and running the existing config/frontmatter validation.

Developer-guide coverage decision: outcome `developer` for operating-layer contract and router
maintenance; outcome `none` for user guides. The P1 work created durable maintainer-facing
source-of-truth boundaries, safe-change rules, and validation expectations, so
[../../guides/developer/operating-layer-contracts-maintenance.md](../../guides/developer/operating-layer-contracts-maintenance.md)
was added as a draft developer guide. No user guide was needed because no shipped user workflow
changed.

User-guide coverage decision: outcome `none`. The completed work did not create or change a
user-facing task, concept, workflow, expected result, configuration choice, troubleshooting path,
or adoption path. No user guide was created or updated; the relevant durable knowledge remains in
the developer guide because it is maintainer-facing contract and router maintenance.

PRD coverage decision: outcome `none`. The completed work implemented existing active PRD
requirements rather than changing the requirement surface: PRD 06 already requires `.os` contracts,
thin routers, and contracts-as-authority; PRD 07 already covers converted-source provenance; PRD 08
already covers `.os/data` JSONL entity and extraction contracts; and PRD 10 already covers immutable
run records and finding qualification. No product requirements, requirement statuses,
implementation assumptions, source anchors, confirmed drift items, open questions, or rebuild risks
changed, so no PRD change doc, baseline change note, index-only update, link-only update, or
risk-register update was warranted.

Validation performed:

- `python3 system/.os/scripts/validate_config.py --self-test`
- `python3 system/.os/scripts/validate_config.py`
- `python3 .make-docs/scripts/check_path_hygiene.py --self-test`
- `python3 .make-docs/scripts/check_path_hygiene.py --repo-root . --format text`
- `git diff --check`
- Refreshed jdocmunch and jcodemunch indexes.
- Confirmed repo-wide link checking remains at the existing 32 baseline failures, with no broken
  links in the new guide or updated history record.
- Confirmed the new guide is `status: draft`, no guide is marked `status: published`, and no
  unresolved placeholder tokens remain in the guide or history update.
- Confirmed no `docs/prd/` files changed during PRD reconciliation; no new PRD number was needed,
  no active PRD docs were renumbered, the PRD index remains current, and the risk register required
  no duplicate or status changes.
- Confirmed `.os/data` and `.os/indexes` contain only router files, not runtime JSONL data or
  generated catalogs.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [../../work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md](../../work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md) | Marked P1 contract and router tasks complete. |
| [../../../system/.os/AGENTS.md](../../../system/.os/AGENTS.md) | Added routing to `.os/data` and `.os/indexes` while preserving contract authority. |
| [../../../system/.os/contracts/AGENTS.md](../../../system/.os/contracts/AGENTS.md) | Linked the completed contract set. |
| [../../../system/.os/contracts/entity-records-contract.md](../../../system/.os/contracts/entity-records-contract.md) | Added canonical structured entity record contract. |
| [../../../system/.os/contracts/run-record-contract.md](../../../system/.os/contracts/run-record-contract.md) | Added run artifact and runs-index contract. |
| [../../../system/.os/contracts/finding-contract.md](../../../system/.os/contracts/finding-contract.md) | Added finding lifecycle and qualification contract. |
| [../../../system/.os/contracts/converted-source-contract.md](../../../system/.os/contracts/converted-source-contract.md) | Added converted-source provenance contract. |
| [../../../system/.os/contracts/extraction-contract.md](../../../system/.os/contracts/extraction-contract.md) | Added extraction load-plan contract. |
| [../../../system/.os/data/AGENTS.md](../../../system/.os/data/AGENTS.md) | Added system data router. |
| [../../../system/.os/data/CLAUDE.md](../../../system/.os/data/CLAUDE.md) | Added one-line pointer to the data router. |
| [../../../system/.os/indexes/AGENTS.md](../../../system/.os/indexes/AGENTS.md) | Added derived indexes router. |
| [../../../system/.os/indexes/CLAUDE.md](../../../system/.os/indexes/CLAUDE.md) | Added one-line pointer to the indexes router. |
| [2026-06-04-w1-r0-p1-operating-layer-contracts.md](2026-06-04-w1-r0-p1-operating-layer-contracts.md) | Recorded implementation closeout, manual-test coverage decision, developer-guide coverage decision, user-guide coverage decision, and PRD coverage decision. |

### Developer

| Path | Description |
| --- | --- |
| [../../guides/developer/operating-layer-contracts-maintenance.md](../../guides/developer/operating-layer-contracts-maintenance.md) | Added draft maintainer workflow for changing operating-layer contracts and routers safely. |

### User

None this session.
