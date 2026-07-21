---
title: "Entity Consolidation and Canonical Resolution Maintenance"
path: "operating-layer/entities"
status: draft
version: "2026-07-21"
order: 140
tags:
  - entities
  - consolidation
  - canonical-resolution
  - migration
applies-to:
  - system/.os/data
  - system/.os/indexes
  - buildos-entities
related:
  - "./operating-layer-contracts-maintenance.md"
  - "./buildos-toolkit-cli-development.md"
  - "../user/entities-consolidation-curate-and-resolve-records.md"
  - "../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md"
  - "../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md"
  - "../../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md"
  - "../../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md"
  - "../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md"
  - "../../../system/.os/contracts/entity-records-contract.md"
  - "../../../system/.os/contracts/extraction-contract.md"
---

# Entity Consolidation and Canonical Resolution Maintenance

## Overview

Use this guide when maintaining or preparing Build OS support for duplicate or replaced entity records. The accepted contract keeps every losing record, marks it `superseded`, and gives it one reviewed redirect to an immediate successor. A shared resolver follows that chain to one active canonical record.

This capability is planned but not implemented in the current checkout. Today, maintainers may inventory records and prepare review proposals only. Do not add redirect fields, change lifecycle states, rewrite references, or delete records until the compatible resolver, validator, writer, and index builder exist and have passed copied-root testing.

## Project Orientation

Keep these three locations separate:

| Location | What it contains | Safe use before implementation |
| --- | --- | --- |
| Source checkout | Build OS source, contracts, plans, and future toolkit code | Read, build, and test without overwriting another installation. |
| Installed program files | Binaries and wrappers currently used by the environment | Inventory only; do not replace or reroute during data rehearsal. |
| Adopter-owned data root | The team's real `system/.os/data/`, indexes, assets, and workspace | Read-only audit only; rehearse future writes against a recoverable copy. |

Never copy the source checkout's entire `system/` tree over an installed or adopter-owned root. A source scaffold is not an upgrade package and may replace local configuration, data, evidence, or operating state.

The authority boundaries are:

- Canonical entity rows remain in `system/.os/data/*.jsonl`.
- A losing row retains its stable ID, evidence, anchors, and type-specific fields.
- `status: superseded` plus one `redirect` expresses an immediate successor.
- `related` remains an ordinary relationship and never changes canonical identity.
- `system/.os/indexes/entity-resolution.json` is a planned derived projection. It is rebuildable and never replaces the canonical JSONL rows.
- `references.json` remains an intake-source index and must not carry entity redirects.

## Current Safe Workflow

1. Identify the source checkout, installed program files, adopter-owned data root, and a separate review-output directory. Stop if any two are ambiguous.
2. Create a recoverable snapshot or copy of the adopter-owned root before preparing for later migration.
3. Run the [pre-upgrade entity consolidation audit prompt](../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md) with a local coding agent in read-only mode.
4. Review inventories, duplicate groups, proposed winners, proposed losers, evidence, confidence, ambiguity, checksums, and the proposed migration manifest.
5. Keep uncertain groups unresolved. Similar wording or a high confidence score is not permission to consolidate.
6. Store review output outside canonical JSONL directories and do not feed it to old tooling as though redirects already exist.

Current validation does not understand redirect-bearing rows. A successful run of `validate_config.py` therefore does not authorize adding the planned redirect shape to live data.

## Redirect and Resolver Contract

A future losing record will retain its original content and use a reviewed redirect containing `target_id`, `kind`, `decided_at`, `decided_by`, `reason`, and `evidence_refs`. The allowed kinds are `duplicate`, `consolidated`, and `replaced`.

The whole graph must satisfy all of these rules:

- The source and target exist, differ, and have the same entity type.
- Only a `superseded` row has a redirect; `draft`, `active`, and `archived` rows do not.
- Each chain is acyclic and ends at one active record.
- A losing row points to its immediate successor, so a later winner replacement forms a valid multi-hop chain.
- Reverse membership is derived from the graph and is not hand-maintained on the winner.
- Repeating an identical mapping is idempotent; remapping a loser to a different winner is a reviewed conflict.

A resolver result must preserve the requested historical ID while also reporting the terminal canonical ID, complete chain, and whether resolution occurred. Readers expose both identities. New references and intentional edits store the terminal canonical ID. Existing historical references do not require a bulk rewrite.

## Validation and Recovery Expectations

Before any future mutation, the implementation must load and validate the complete entity graph. Missing targets, self-redirects, cross-type targets, cycles, inactive terminal records, duplicate IDs, invalid statuses, remap conflicts, and stale indexes must stop the write with a useful diagnostic.

Compatibility mode is only a temporary assessment aid for legacy `superseded` rows without redirects. It warns and excludes those rows from automatic resolution. Strict mode is the release and post-migration gate and rejects them.

Future mutation must be dry-run by default, require an explicit adopter root and explicit apply approval, write through a same-filesystem temporary file, replace the affected JSONL atomically, preserve permissions, and rebuild the derived index. If the canonical write succeeds but index rebuilding fails, recovery must preserve the canonical rows and provide a deterministic index-rebuild command.

## Source-Build Rehearsal Boundary

When the implementation exists, maintainers must first build it in a separate source checkout and invoke that exact binary path against a copied adopter root. Record the source revision, binary checksum, copied-root or snapshot identity, proposal-manifest checksum, validation results, index diff, and rollback location.

Treat these as separate approvals:

1. Permission to reroute or replace installed binaries and wrappers.
2. Permission to apply a reviewed mapping to live adopter-owned data.

Passing copied-root tests grants neither approval automatically. Old tooling should remain read-only for redirect-bearing data until cutover is complete.

## Troubleshooting

If an audit proposes a winner without evidence, leave the group unresolved. Never infer a redirect from naming similarity alone.

If two roots might be the live data root, stop. Ask the operator to identify the real adopter-owned root before continuing.

If a copied-root test changes installed files or the live root, stop and restore from the untouched snapshot before diagnosing the path error.

If the planned index differs between identical rebuilds, treat the builder as non-deterministic and block release. Do not hand-edit the index.

If a graph error is found after a canonical write, preserve the written JSONL and follow the tool's recovery output. Do not improvise a bulk rewrite or delete losing records.

## Related Resources

- [Entity Consolidation and Canonical Resolution PRD](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [W1 R4 Change Plan](../../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md)
- [Entity Consolidation and Canonical Resolution Design](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [Entity Consolidation Work Backlog](../../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md)
- [Pre-Upgrade Audit Prompt](../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
- [Curate and Resolve Duplicate Entity Records](../user/entities-consolidation-curate-and-resolve-records.md)
- [Maintaining Operating Layer Contracts](./operating-layer-contracts-maintenance.md)
- [Build OS Toolkit CLI Development](./buildos-toolkit-cli-development.md)
- [Entity Records Contract](../../../system/.os/contracts/entity-records-contract.md)
- [Extraction Contract](../../../system/.os/contracts/extraction-contract.md)

## Future Coverage

- Blocked by: W1 R4 P2 implementation of `toolkits/buildos-entities/` and stable diagnostics. Update when: the resolver, compatibility and strict validators, consolidation writer, and deterministic index builder pass their fixtures. Guide change: add verified build commands, exact command syntax, exit behavior, example output, and failure-recovery commands.
- Blocked by: W1 R4 P3 copied-root persona pilot. Update when: the approved persona fixture set and rollback rehearsal pass. Guide change: replace the contract-shaped rehearsal outline with an executed maintainer runbook and sanitized evidence examples.
- Blocked by: W1 R4 P4 consumer and producer integration. Update when: redirect-aware reads and terminal-canonical writes pass integration tests. Guide change: list each integration point, its original-ID behavior, its canonical-ID behavior, and its failure mode.
