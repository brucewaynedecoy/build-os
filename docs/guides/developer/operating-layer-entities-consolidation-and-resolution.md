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
  - buildos/entities
related:
  - "./operating-layer-contracts-maintenance.md"
  - "./buildos-toolkit-cli-development.md"
  - "../user/entities-consolidation-curate-and-resolve-records.md"
  - "../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md"
  - "../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md"
  - "../../prd/18-revise-unified-buildos-cli-and-distribution.md"
  - "../../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md"
  - "../../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md"
  - "../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md"
  - "../../../system/.os/contracts/entity-records-contract.md"
  - "../../../system/.os/contracts/entity-consolidation-contract.md"
  - "../../../system/.os/contracts/persona-identity-contract.md"
  - "../../../system/.os/contracts/extraction-contract.md"
---

# Entity Consolidation and Canonical Resolution Maintenance

## Overview

Use this guide when maintaining or preparing Build OS support for duplicate or replaced entity records. The accepted contract keeps every losing record, marks it `superseded`, and gives it one reviewed redirect to an immediate successor. A shared resolver follows that chain to one active canonical record.

W1 R4 P2 implements the first source-built `buildos` executable, whole-graph resolver and validator, deterministic entity-resolution index, and reviewed consolidation writer. Maintainers can now build and test the entity domain against fixtures or a recoverable copied root. P2 is not a packaged release and does not authorize changing a live adopter root, installed binary, or historical reference.

The canonical planned surface is `buildos entities`,
implemented as the W1 R4 seed of `toolkits/buildos/`.
No public `buildos-entities` executable will be created.
W1 R4 is source-build-only:
the existing `buildos-intake`,
`buildos-discovery`,
and `buildos-design` binaries stay separate until W1 R5 migration and package distribution.
W2 project installation and upgrade commands are later work inside the same `buildos` executable.

## Project Orientation

Keep these three locations separate:

| Location | What it contains | Safe use before implementation |
| --- | --- | --- |
| Source checkout | Build OS source, contracts, plans, and toolkit code | Read, build, and test without overwriting another installation. |
| Installed program files | Binaries and wrappers currently used by the environment | Inventory only; do not replace or reroute during data rehearsal. |
| Adopter-owned data root | The team's real `system/.os/data/`, indexes, assets, and workspace | Read-only audit only; rehearse future writes against a recoverable copy. |

Never copy the source checkout's entire `system/` tree over an installed or adopter-owned root. A source scaffold is not an upgrade package and may replace local configuration, data, evidence, or operating state.

The authority boundaries are:

- Canonical entity rows remain in `system/.os/data/*.jsonl`.
- A losing row retains its stable ID, evidence, anchors, and type-specific fields.
- `status: superseded` plus one `redirect` expresses an immediate successor.
- `related` remains an ordinary relationship and never changes canonical identity.
- `.os/indexes/entity-resolution.json` is the contracted installed-root derived projection; `system/.os/indexes/entity-resolution.json` is its source-scaffold counterpart. It is rebuildable and never replaces the canonical JSONL rows.
- `references.json` remains an intake-source index and must not carry entity redirects.
- `toolkits/buildos/pkg/entities` is the temporary shared resolver boundary during W1 R4. P4 will wire existing Go consumers through explicit local dependencies; those consumers must not invoke the CLI as a subprocess.

## Current Source-Build Workflow

1. Identify the source checkout, installed program files, adopter-owned data root, a recoverable copied root, and a separate staging directory. Stop if any two are ambiguous.
2. From `toolkits/buildos/`, run `go test ./...`, then build `./cmd/buildos` to the staging directory. Invoke that binary by its explicit path; do not rely on `PATH`.
3. Record `git rev-parse HEAD`, the binary checksum, and `<staged-buildos> version`. Uninjected source builds report `dev` and `unknown`.
4. Run `entities validate` in `compat` mode against the copy. Compatibility warnings identify legacy `superseded` rows without redirects and exclude them from automatic resolution.
5. Confirm every loser in the version 1 manifest belongs to the same canonical JSONL dataset, then run it through `entities consolidate` without `--apply`. Split a cross-dataset review into separately approved manifests. Inspect every planned change and diagnostic.
6. Apply only to the copy with `--apply`, then require strict validation and a current index with `rebuild-index --check`.
7. If the index is missing or stale, run the exact `rebuild-index ... --apply` recovery command from the diagnostic, then repeat the check.
8. Prove snapshot restoration before asking for separate binary-routing and live-data-migration approvals.

The exact command sequence appears in the [user guide](../user/entities-consolidation-curate-and-resolve-records.md#current-source-build-workflow). `validate_config.py` remains limited to config, frontmatter, and basic row hygiene; it does not replace graph validation or certify a redirect migration.

## Redirect and Resolver Contract

A losing record governed by the P1 contract retains its original content and uses a reviewed redirect containing `target_id`, `kind`, `decided_at`, `decided_by`, `reason`, and `evidence_refs`. The allowed kinds are `duplicate`, `consolidated`, and `replaced`. This is an authoritative data contract, not permission to write redirect-bearing rows with pre-P2 tooling.

The whole graph must satisfy all of these rules:

- The source and target exist, differ, and have the same entity type.
- Only a `superseded` row has a redirect; `draft`, `active`, and `archived` rows do not.
- Each chain is acyclic and ends at one active record.
- A losing row points to its immediate successor, so a later winner replacement forms a valid multi-hop chain.
- Reverse membership is derived from the graph and is not hand-maintained on the winner.
- Repeating an identical mapping is idempotent; remapping a loser to a different winner is a reviewed conflict.

A resolver result must preserve the requested historical ID while also reporting the terminal canonical ID, complete chain, and whether resolution occurred. Readers expose both identities. New references and intentional edits store the terminal canonical ID. Existing historical references do not require a bulk rewrite.

## Persona Identity and Extraction Outcomes

P1 defines deterministic identity reuse for personas only. A persona may have one reviewer-approved `identity` object using the `persona-v1` scheme and a sorted list of explicitly approved `aliases`. Matching trims and collapses ASCII whitespace and lowercases ASCII letters. It does not perform Unicode normalization, punctuation removal, stemming, synonym expansion, token reordering, or fuzzy comparison.

An exact alias or `persona-v1` key may match automatically only when every matching historical row resolves to the same active terminal persona. Collisions, ambiguity, inactive terminals, fuzzy similarity, and semantic similarity remain review-only and never mutate a row. Other entity types require their own versioned identity contracts before automated identity matching is allowed.

New outcome-aware extraction rows use `outcome_contract: extraction-outcomes-v1` and include three disjoint lists:

| Outcome | Meaning |
| --- | --- |
| `minted` | The extraction created a new canonical entity row. |
| `referenced` | The extraction reused an existing canonical entity without changing it. |
| `updated` | The extraction deliberately changed an existing canonical entity. |

Each outcome stores the terminal canonical ID as it existed at extraction time. Historical extraction rows that predate this contract retain their former `minted`-or-updated meaning; validators and migrations do not guess or rewrite them.

## Validation and Recovery Expectations

Before any mutation, the implementation loads and validates the complete entity graph. Missing targets, self-redirects, cross-type targets, cycles, inactive terminal records, duplicate IDs, invalid statuses, remap conflicts, and stale indexes stop the relevant operation with a useful diagnostic.

Compatibility mode is only a temporary assessment aid for legacy `superseded` rows without redirects. It warns and excludes those rows from automatic resolution. Strict mode is the release and post-migration gate and rejects them.

Mutation is dry-run by default, requires an explicit adopter root and explicit apply approval, and accepts only one canonical JSONL dataset per version 1 manifest. It writes through a same-filesystem temporary file, atomically replaces that one affected JSONL file, preserves permissions and unknown row fields, and rebuilds the derived index. If the canonical write succeeds but index rebuilding fails, the canonical rows remain authoritative, the command exits `6`, and its diagnostic provides the deterministic index-rebuild command.

The implemented W1 R4 P2 command families are:

```text
buildos help
buildos version
buildos entities resolve --root <copied-root> --mode compat|strict --id <entity-id> [--json]
buildos entities validate --root <copied-root> --mode compat|strict [--json]
buildos entities consolidate --root <copied-root> --mode compat|strict --manifest <reviewed-manifest> [--apply] [--json]
buildos entities rebuild-index --root <copied-root> --mode compat|strict [--check|--apply] [--json]
```

Human-readable output is the default. `--json` emits the shared envelope with `ok`, dotted `command`, `version`, `source_revision`, resolved `root`, `mode`, string `write_status`, `result`, and `diagnostics`. Exit codes are `0` success, `2` usage, `3` input/root load, `4` validation or remap conflict, `5` canonical-write failure, and `6` canonical data applied but index rebuild failed.

## Source-Build Rehearsal Boundary

When the implementation exists, maintainers must first build `buildos` into a staging directory from a separate source checkout and invoke that exact binary path against a copied adopter root. Record the reported version, source revision, binary checksum, copied-root or snapshot identity, proposal-manifest checksum, validation results, index diff, and rollback location.

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
- [Unified BuildOS CLI and Distribution PRD](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
- [W1 R4 Change Plan](../../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md)
- [Entity Consolidation and Canonical Resolution Design](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [Entity Consolidation Work Backlog](../../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md)
- [Pre-Upgrade Audit Prompt](../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
- [Curate and Resolve Duplicate Entity Records](../user/entities-consolidation-curate-and-resolve-records.md)
- [Maintaining Operating Layer Contracts](./operating-layer-contracts-maintenance.md)
- [Build OS Toolkit CLI Development](./buildos-toolkit-cli-development.md)
- [Entity Records Contract](../../../system/.os/contracts/entity-records-contract.md)
- [Entity Consolidation Contract](../../../system/.os/contracts/entity-consolidation-contract.md)
- [Persona Identity Contract](../../../system/.os/contracts/persona-identity-contract.md)
- [Extraction Contract](../../../system/.os/contracts/extraction-contract.md)

## Future Coverage

- Blocked by: W1 R4 P3 copied-root persona pilot. Update when: the approved persona fixture set and rollback rehearsal pass. Guide change: replace the contract-shaped rehearsal outline with an executed maintainer runbook and sanitized evidence examples.
- Blocked by: W1 R4 P4 consumer and producer integration. Update when: redirect-aware reads and terminal-canonical writes pass integration tests. Guide change: list each integration point, its original-ID behavior, its canonical-ID behavior, and its failure mode.
- Blocked by: W1 R5 distribution. Update when: the unified command migration, legacy aliases, archives, checksums, SBOMs, signing, and Homebrew workflows pass. Guide change: add package installation and compatibility-alias maintenance, and remove source-build-only caveats where verified.
- Blocked by: W2 lifecycle implementation. Update when: manifest-backed project setup, update, backup, removal, and machine uninstall behavior passes. Guide change: replace manual synchronization guidance with the verified in-place lifecycle procedure.
