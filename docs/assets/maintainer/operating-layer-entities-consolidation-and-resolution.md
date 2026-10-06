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
  - "operating-layer-contracts-maintenance.md"
  - "buildos-toolkit-cli-development.md"
  - "../user/entities-consolidation-curate-and-resolve-records.md"
  - "../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md"
  - "../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md"
  - "../../prd/18-revise-unified-buildos-cli-and-distribution.md"
  - "../../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md"
  - "../../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md"
  - "../../../.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md"
  - "../../../.make-docs/archive/history/2026-07-21-w1-r4-p3-reviewed-persona-consolidation-and-copied-root-rehearsal.md"
  - "../../../system/.os/contracts/entity-records-contract.md"
  - "../../../system/.os/contracts/entity-consolidation-contract.md"
  - "../../../system/.os/contracts/persona-identity-contract.md"
  - "../../../system/.os/contracts/extraction-contract.md"
persona: maintainer
---

# Entity Consolidation and Canonical Resolution Maintenance

## Overview

Use this guide when maintaining or preparing Build OS support for duplicate or replaced entity records. The accepted contract keeps every losing record, marks it `superseded`, and gives it one reviewed redirect to an immediate successor. A shared resolver follows that chain to one current canonical record. Most current terminals use `active`; qualified findings and run lifecycle states retain their type-specific contracts.

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

| Location | What it contains | Current W1 R4 use |
| --- | --- | --- |
| Source checkout | Build OS source, contracts, plans, and toolkit code | Read, build, and test without overwriting another installation. |
| Installed program files | Binaries and wrappers currently used by the environment | Inventory only; do not replace or reroute during data rehearsal. |
| Adopter-owned data root | The team's real `system/.os/data/`, indexes, assets, and workspace | Keep live data read-only; rehearse reviewed writes against a recoverable copy. |

Never copy the source checkout's entire `system/` tree over an installed or adopter-owned root. A source scaffold is not an upgrade package and may replace local configuration, data, evidence, or operating state.

The authority boundaries are:

- Canonical entity rows remain in `system/.os/data/*.jsonl`.
- A losing row retains its stable ID, evidence, anchors, and type-specific fields.
- `status: superseded` plus one `redirect` expresses an immediate successor.
- `related` remains an ordinary relationship and never changes canonical identity.
- `.os/indexes/entity-resolution.json` is the contracted installed-root derived projection; `system/.os/indexes/entity-resolution.json` is its source-scaffold counterpart. It is rebuildable and never replaces the canonical JSONL rows.
- `references.json` remains an intake-source index and must not carry entity redirects.
- `toolkits/buildos/pkg/entities` is the temporary shared resolver boundary during W1 R4. P4 wires the existing discovery and design modules through explicit local dependencies; those consumers must not invoke the CLI as a subprocess.

## Delivery Horizon

| Horizon | Maintainer posture | Not yet authorized or available |
| --- | --- | --- |
| W1 R4 current | Build `toolkits/buildos/cmd/buildos` from source and invoke `buildos entities` by explicit staged path. Existing discovery and design modules import the temporary shared entity package directly. | No package-manager install, installed-binary replacement, compatibility aliases, or live-data migration. |
| W1 R5 future | Migrate intake, discovery, and design into the unified module, prove command parity, ship temporary legacy-name aliases, and package `buildos 0.1.0` through signed archives and Homebrew. | Do not describe these package or alias workflows as current until their release gates pass. |
| W2 future | Add manifest-backed `setup`, `update`, backup, project removal, and machine uninstall commands to the same executable. | Do not use the W1 R4 source checkout as an installer or hand-roll in-place scaffold synchronization. |

Unsigned source builds remain development-only. W1 R5 release acceptance requires checksums, SBOMs, provenance, platform archives, Homebrew checksum verification, and install, upgrade, rollback, and uninstall smoke evidence before package-manager guidance becomes current.

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

## Executed P3 Reference Rehearsal

P3 executed the workflow against a disposable copy of the sanitized persona pilot at `toolkits/buildos/testdata/persona-pilot/root/`. The actual adopter-owned root was unavailable. That absence was treated as a safe stop: the rehearsal did not guess a live root, copy the source scaffold over an installation, or claim that production data was tested.

The source-build inventory recorded:

| Evidence | Recorded value |
| --- | --- |
| Source revision | `ce5aafb62bcd233a4671ca0d6eb4fe39ea38dca5` |
| Staged version | `dev` |
| Staged source revision | `ce5aafb62bcd233a4671ca0d6eb4fe39ea38dca5` |
| Staged binary SHA-256 | `f28a1b83ba20065a39035f38fec045b04863212ee5173e4a019a1d8a04596946` |
| Unified command on `PATH` | Absent, as expected for W1 R4 |
| Legacy commands | `buildos-intake`, `buildos-discovery`, and `buildos-design` remained separate; each `help` exited `0` |
| Approved manifest SHA-256 | `db5642e06bb950fb56e3c917305ab5540b75734cad161efb62640860aeca55f2` |
| Replay manifest SHA-256 | `848530b32e2752d5653e21ffc579c879375858fa45a8b27645099f9ca23e6fd8` |
| Conflict manifest SHA-256 | `1fba32730be92a18248b5b4146b617efd926b42b8712697f4a661184e87acaa5` |
| Baseline fixture, snapshot, and working-copy tree SHA-256 | `a24550f9329324372b4533d2d8a0b8086198b423fd45ede0d06523686a65c326` |
| Baseline personas SHA-256 | `7c81bb787b1e415be241c73b747009df1f645da5e1bc493c47c072750e1cd521` |
| Baseline index SHA-256 | `941c43d958ae76c8aa3b5b6775883675dc230f8776c806ee4a9afcb49c5061e9` |
| Applied copied-root tree SHA-256 | `f8a716a5b54c205cc35375b0123328c986832c71b28038cfba26aeffd67543dc` |
| Applied personas SHA-256 | `f61575c1a8751c8df4b7bb3cae4bbf1e0d7f37eb98dc50072d09718f0d8699c3` |
| Applied index SHA-256 | `afe1935e3ed50c416498f912bd09150a3f8fe625a8f6c1007d3749d3198853cd` |

The focused rehearsal, full Go suite, and race-enabled suite passed. The integration test copies the fixture root into a temporary directory and proves compatibility validation, a non-mutating dry run, approved apply, strict validation, representative one-hop and multi-hop resolution, preservation of evidence and unknown fields, deterministic rebuilding, identical replay, fail-closed conflicting remap, injected canonical-write failure, and byte-identical snapshot restoration.

For a real adopter rehearsal, repeat the same sequence only after an operator supplies the authoritative installed root and a recoverable copy. Record new source, binary, manifest, snapshot, and output checksums; the fixture values above are comparison evidence, not values to reuse for live data.

## Redirect and Resolver Contract

A losing record governed by the P1 contract retains its original content and uses a reviewed redirect containing `target_id`, `kind`, `decided_at`, `decided_by`, `reason`, and `evidence_refs`. The allowed kinds are `duplicate`, `consolidated`, and `replaced`. This is an authoritative data contract, not permission to write redirect-bearing rows with pre-P2 tooling.

The whole graph must satisfy all of these rules:

- The source and target exist, differ, and have the same entity type.
- Only a `superseded` row has a redirect; `draft`, `active`, and `archived` rows do not.
- Each chain is acyclic and ends at a type-valid current record. The generic terminal is `active`; findings may terminate at `qualified`; runs may terminate at `running`, `closed`, or `aborted`.
- A losing row points to its immediate successor, so a later winner replacement forms a valid multi-hop chain.
- Reverse membership is derived from the graph and is not hand-maintained on the winner.
- Repeating an identical mapping is idempotent; remapping a loser to a different winner is a reviewed conflict.

A resolver result must preserve the requested historical ID while also reporting the terminal canonical ID, complete chain, and whether resolution occurred. Readers expose both identities. New references and intentional edits store the terminal canonical ID. Existing historical references do not require a bulk rewrite.

## Persona Identity and Extraction Outcomes

P4 implements deterministic identity reuse for personas only through the shared `toolkits/buildos/pkg/entities` package. A persona may have one reviewer-approved `identity` object using the `persona-v1` scheme and a sorted list of explicitly approved `aliases`. Matching trims and collapses ASCII whitespace and lowercases ASCII letters. It does not perform Unicode normalization, punctuation removal, stemming, synonym expansion, token reordering, or fuzzy comparison.

`MatchPersonaExact` checks an exact persona ID, then an approved alias, then a `persona-v1` key. A match may succeed automatically only when every matching historical row resolves to the same active terminal persona. Collisions, ambiguity, inactive terminals, malformed stored identity or alias fields, fuzzy similarity, and semantic similarity remain fail-closed review outcomes and never mutate a row. Other entity types require their own versioned identity contracts before automated identity matching is allowed.

New outcome-aware extraction rows use `outcome_contract: extraction-outcomes-v1` and include three disjoint lists:

| Outcome | Meaning |
| --- | --- |
| `minted` | The extraction created a new canonical entity row. |
| `referenced` | The extraction reused an existing canonical entity without changing it. |
| `updated` | The extraction deliberately changed an existing canonical entity. |

Each outcome stores the terminal canonical ID as it existed at extraction time. Historical extraction rows that predate this contract retain their former `minted`-or-updated meaning; validators and migrations do not guess or rewrite them.

`ValidateExtractionOutcomes` validates entity-graph IDs and cannot validate a `PB-NNN` playbook ID because playbooks are registered outside the eight canonical entity datasets. Call `ValidateExtractionOutcomesWithPlaybooks` when an extraction may report playbook outcomes; it combines the entity resolver with the authoritative playbook resolver. Never claim that the graph-only validator covers playbooks. Both validators require present, disjoint lists and terminal canonical IDs; they validate proposed rows but do not write extraction records or migrate live data.

## P4 Consumer and Producer Inventory

Use this inventory before adding or changing a governed-ID surface. The classification tells maintainers whether a value is provenance, runtime identity, a new governed reference, derived output, or a review-only proposal.

| Surface | Classification | Requested and historical behavior | Canonical or derived behavior | Failure behavior |
| --- | --- | --- | --- | --- |
| `buildos entities resolve` and `validate` | Current read and derived diagnostics | Preserve the requested ID in resolver output. | Report the canonical ID and complete chain from authoritative JSONL. | Reject invalid graphs, missing IDs, or invalid type-specific terminals. |
| `buildos-discovery run discovery` | Historical playbook read, current target read, and new run write | Leave authored playbook targets unchanged and retain requested targets plus their chains. | Execute against terminal canonical targets and store those IDs in the new run. | Resolve all governed targets before writing; any failure leaves no run artifacts. |
| `buildos-discovery qualify finding` | Current run read and new finding write | Retain `requested_run_id` and the operator's raw-finding anchor. | Use the canonical run for runtime metadata and new `run_id`, `origin_run`, `basis_refs`, and `related` references. | Resolve and validate before writing; failure leaves no finding artifacts. |
| `buildos-design promote finding` | Current finding read, new design write, and intentional canonical-finding update | Report the requested finding and chain; leave the losing row unchanged. | Require a terminal `qualified` finding, create the design from it, and write its back-reference only to the canonical finding. | Resolver, validation, design-write, or canonical-row update failure leaves no partial promotion. |
| `MatchPersonaExact` | Review proposal and current persona read | Accept only exact IDs, approved aliases, or `persona-v1` keys; preserve the candidate evidence. | Return one active terminal persona only when the match is unique. | Ambiguous, colliding, inactive, malformed, fuzzy, semantic, or unsupported input stays non-mutating and review-only. |
| `ValidateExtractionOutcomes` | New-write preflight | Validate `minted`, `referenced`, and `updated` without rewriting historical extraction rows. | Require disjoint terminal canonical entity IDs. | Fail on missing lists, overlaps, unknown IDs, non-terminal IDs, and playbook IDs. |
| `ValidateExtractionOutcomesWithPlaybooks` | New-write preflight with authoritative playbook resolution | Apply the same outcome contract when `PB-NNN` values are present. | Resolve entity IDs through the graph and playbook IDs through the playbook resolver. | Fail closed when either authority rejects an ID; perform no write. |
| `.os/indexes/entity-resolution.json` | Derived output | Never treat it as authored evidence or edit it by hand. | Rebuild it deterministically from canonical JSONL. | A stale or missing index does not override canonical JSONL. |
| Existing JSONL, playbook, run, and finding references | Historical read | Retain the authored losing ID for audit; do not bulk rewrite. | Resolve the ID before runtime use and expose the canonical identity and chain. | Invalid resolution stops the consuming operation before new writes. |

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

## Maintainer Test and Release Checks

Run the unified entity-domain gates from its module:

```sh
cd toolkits/buildos
go test ./...
go test -race ./...
go vet ./...
go build ./...
go test ./internal/cli -run TestPersonaCopiedRootRehearsal -count=1
```

The focused rehearsal must prove compatibility assessment, non-writing preview, reviewed apply, strict validation, multi-hop resolution, losing-row provenance and unknown-field preservation, deterministic index rebuilding, byte-stable replay, conflicting-remap refusal, injected pre-commit write failure, and byte-identical rollback.

When the temporary shared resolver API or governed-reference behavior changes, also run the consumer module gates:

```sh
cd toolkits/buildos-discovery
go test ./...
go test -race ./...
go vet ./...

cd ../buildos-design
go test ./...
go test -race ./...
go vet ./...
```

Use the failure suites as contract evidence, not merely coverage. They must show that invalid JSONL, cycles, missing and cross-type targets, inactive terminals, remap conflicts, stale or malformed indexes, and pre-commit I/O failures fail without changing canonical bytes. They must separately show that a post-commit index failure reports `write_status: canonical_applied_index_failed`, exits `6`, preserves the canonical write, and supplies one exact recovery command.

Before closeout, also run the repository config/frontmatter validator, path-hygiene checks, documentation link check, and `git diff --check`. The Python validator complements the graph engine; it does not replace `buildos entities validate`.

## Source-Build Rehearsal Boundary

Maintainers must first build `buildos` into a staging directory from a separate source checkout and invoke that exact binary path against a copied adopter root. Record the reported version, source revision, binary checksum, copied-root or snapshot identity, proposal-manifest checksum, validation results, index diff, and rollback location.

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

If the command exits `3`, correct the explicit root, mode, input, or manifest and rerun without `--apply`. If it exits `4`, treat the graph or remap as invalid and make no write. If it exits `5`, verify the copied root remains byte-identical before retrying. If it exits `6`, retain the canonical write, run the exact reported `rebuild-index --apply` command, then repeat strict validation and `rebuild-index --check`.

If the actual adopter-owned root is unavailable, stop after the sanitized fixture rehearsal. A source checkout's `system/` directory is not proof of the installed root.

If any recorded checksum changes unexpectedly, stop before apply. Rebuild the staged binary or repeat proposal review, then record the new evidence deliberately.

## Related Resources

- [Entity Consolidation and Canonical Resolution PRD](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [Unified BuildOS CLI and Distribution PRD](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
- [W1 R4 Change Plan](../../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md)
- [Entity Consolidation and Canonical Resolution Design](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [Entity Consolidation Work Backlog](../../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md)
- [Pre-Upgrade Audit Prompt](../../../.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
- [Curate and Resolve Duplicate Entity Records](../user/entities-consolidation-curate-and-resolve-records.md)
- [Maintaining Operating Layer Contracts](operating-layer-contracts-maintenance.md)
- [Build OS Toolkit CLI Development](buildos-toolkit-cli-development.md)
- [Entity Records Contract](../../../system/.os/contracts/entity-records-contract.md)
- [Entity Consolidation Contract](../../../system/.os/contracts/entity-consolidation-contract.md)
- [Persona Identity Contract](../../../system/.os/contracts/persona-identity-contract.md)
- [Extraction Contract](../../../system/.os/contracts/extraction-contract.md)

## Future Coverage

- Blocked by: W1 R5 distribution. Update when: the unified command migration, legacy aliases, archives, checksums, SBOMs, signing, and Homebrew workflows pass. Guide change: add package installation and compatibility-alias maintenance, and remove source-build-only caveats where verified.
- Blocked by: W2 lifecycle implementation. Update when: manifest-backed project setup, update, backup, removal, and machine uninstall behavior passes. Guide change: replace manual synchronization guidance with the verified in-place lifecycle procedure.
