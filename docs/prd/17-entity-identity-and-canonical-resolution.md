# 17 Entity Identity and Canonical Resolution

## Purpose

This subsystem owns entity identity. It defines a generic, non-destructive way to consolidate duplicate or superseded Build OS entity records. It keeps the history and provenance of every losing record. It resolves historical and future references to one current canonical record.

Personas are the first proving ground. The redirect graph and the resolver apply to every entity type that the entity-records contract governs. Type-specific identity matching expands only after each type has reviewed, deterministic rules.

## Scope

In scope:

- the entity lifecycle and redirect graph, terminal canonical resolution, strict and compatibility validation, the reviewed consolidation manifest, atomic canonical writes, and the derived entity-resolution index;
- the `buildos entities` command contract;
- the matching and review policy for entity-producing workflows;
- adoption and live-root migration safety for redirect-bearing data.

The entities domain owns entity-graph operations. Extraction helpers are a separate ownership decision and are not part of this domain.

The first release supports reviewed persona consolidation, with copied-root rehearsal before a broader entity-type rollout. Requirements, capabilities, findings, test cases, results, runs, and extractions are enabled one type at a time, after their identity rules are designed and validated.

Out of scope:

- automatic fuzzy or semantic redirects;
- destructive bulk rewrites of existing references;
- type-specific matching for a type before its reviewed rules exist;
- mutation of a live adopter root without a separate approval.

Covered elsewhere: the `draft` staging lifecycle and `.os/data/` layout in [08 Data Layer and Extraction](./08-data-and-extraction.md#contracts-and-data); the `references.json` intake index in [07 Intake and Conversion](./07-intake-and-conversion.md#contracts-and-data); the shared output envelope, exit codes, and root model in [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#output-and-exit-contract).

Code anchors:

- `system/.os/contracts/entity-records-contract.md`
- `system/.os/contracts/entity-consolidation-contract.md`

## Component and Capability Map

The entities domain lives inside the one BuildOS TypeScript package at `toolkits/buildos/`. It is exposed as `buildos entities` ([PRD 20 Command Surface](./20-buildos-cli-and-distribution.md#command-surface)). The domain owns shared entity-graph validation, resolution, consolidation, and the entity-resolution index. The discovery and design domains call this one implementation directly, without subprocess calls.

The domain has four commands:

```text
buildos entities consolidate
buildos entities resolve
buildos entities validate
buildos entities rebuild-index
```

Each command reports the package version, the source revision, the resolved root, the mode, and the write status through the shared envelope in [PRD 20 Output and Exit Contract](./20-buildos-cli-and-distribution.md#output-and-exit-contract). The entity commands are part of the output compatibility promise in [PRD 20 Compatibility](./20-buildos-cli-and-distribution.md#compatibility).

### Entity commands

The invocation contract is:

```text
buildos entities resolve --root <path> --mode compat|strict --id <entity-id> [--json]
buildos entities validate --root <path> --mode compat|strict [--json]
buildos entities consolidate --root <path> --mode compat|strict --manifest <path> [--apply] [--json]
buildos entities rebuild-index --root <path> --mode compat|strict [--check|--apply] [--json]
```

These rules hold:

- Every entity command requires an explicit `--root` and an explicit `--mode` of `compat` or `strict`. No command infers a live installation.
- `resolve` requires `--id`. `consolidate` requires `--manifest`.
- `consolidate` is a dry run by default. It writes only with `--apply`.
- `rebuild-index` checks by default when neither `--check` nor `--apply` is present. `--check` and `--apply` are mutually exclusive.
- Bare `rebuild-index` and `rebuild-index --check` both check the index without writing. They differ only in the reported `write_status`: bare `rebuild-index` reports `planned`, and `--check` reports `not_requested`.
- `--json` gives the stable automation form of the shared envelope.
- Every mutating invocation loads and validates the complete entity graph before it writes.

Code anchors:

- `toolkits/buildos/`

## Contracts and Data

### Lifecycle and redirects

A losing entity stays an authoritative historical row in its original `system/.os/data/*.jsonl` dataset. Its stable ID, source evidence, narrative anchors, and type-specific content stay intact. The row changes to `status: superseded` and carries exactly one reviewed `redirect` to its immediate successor.

`superseded` means the record has one reviewed redirect to a successor. `archived` means the record is retained without a successor. Neither state replaces `draft`, the pending state that [08 Data Layer and Extraction](./08-data-and-extraction.md#contracts-and-data) owns.

The canonical winner does not keep a hand-edited list of losing IDs. Reverse membership is derived from the redirect graph. The `related` field stays a non-canonical relationship and never takes part in resolution.

The lifecycle and graph contract requires:

- a newly written `superseded` row to contain exactly one redirect;
- `draft`, `active`, and `archived` rows not to contain a redirect;
- source and target to exist, differ, and have the same entity type;
- every chain to be acyclic and to end at one current record;
- `archived` to mean retained without a successor;
- losing type-specific fields and provenance to stay intact;
- reverse membership to be derived, not copied onto the winner;
- `related` edges to stay outside canonical resolution.

Terminal lifecycle is type-aware. Most types resolve to `active`. Findings may resolve to `qualified`. Runs may resolve to `running`, `closed`, or `aborted`. `qualified` is not a valid status for unrelated types. Design promotion still requires a `qualified` canonical finding.

### Redirect object

| Field | Requirement | Meaning |
| --- | --- | --- |
| `target_id` | required | Stable ID of the immediate successor. |
| `kind` | required | One of `duplicate`, `consolidated`, or `replaced`. |
| `decided_at` | required | ISO 8601 UTC datetime for the reviewed decision. |
| `decided_by` | required | Configured owner, team, agent, or human identifier responsible for the decision. |
| `reason` | required | Concise explanation of why the source record is no longer canonical. |
| `evidence_refs` | required | Entity IDs or path-and-anchor references that support the decision; it may be empty only when no evidence exists. |

`duplicate` means two records represent the same identity or concept. `consolidated` means overlapping records were intentionally combined into one broader canonical record. `replaced` means the source is obsolete and has an intentional successor without being a duplicate.

### Terminal resolution

One deterministic resolver is shared by validators, domains, and entity-consuming or entity-producing workflows. Given an entity ID, it follows zero or more redirects. It returns the requested ID, the terminal canonical ID, the complete resolution chain, and whether resolution occurred.

Reads keep, and may display, the originally recorded ID while they expose the canonical ID and chain. New references and intentional updates store the terminal canonical ID. Existing historical references do not need a destructive bulk rewrite.

Missing targets, self-redirects, cross-type targets, cycles, and chains that do not end at one current record fail closed with actionable diagnostics.

The stable resolver result contains:

```json
{
  "requested_id": "PER-041",
  "canonical_id": "PER-003",
  "chain": ["PER-041", "PER-027", "PER-003"],
  "resolved": true
}
```

### Strict and compatibility modes

Compatibility mode accepts a legacy `superseded` row without a redirect only as a structured warning. It excludes that row from automatic resolution and never guesses a successor. Every newly created or changed superseded row meets strict rules, even while an adopter root is assessed in compatibility mode.

Strict mode rejects legacy superseded rows without valid redirects, all graph invariant violations, duplicate IDs across governed datasets, non-idempotent remap conflicts, and stale or non-reproducible resolution indexes. Strict validation is the release and post-migration gate. Compatibility mode is a temporary, read-oriented assessment aid, not a second long-term contract.

### Matching and review policy

Entity-producing workflows apply matching in this order:

1. Resolve an exact entity ID automatically to its terminal canonical ID.
2. Resolve an exact, type-scoped approved alias or consolidated-member identity only when it identifies one canonical record uniquely.
3. Resolve an exact type-specific identity key only after that entity type defines a versioned, deterministic, tested key contract.
4. Route fuzzy, semantic, ambiguous, or otherwise probabilistic matches to human review with evidence and confidence. They never create redirects or change canonical records automatically.

Persona identity is the first adapter and pilot. Personas have an optional `persona-v1` identity key and a reviewer-approved alias list. Comparison trims and collapses ASCII whitespace and lowercases ASCII letters. Unicode normalization, punctuation removal, stemming, synonym expansion, token reordering, fuzzy matching, and semantic matching stay review-only.

Extraction metadata tells a newly minted ID apart from an update of, or a reference to, an existing canonical ID. New outcome-aware rows use `extraction-outcomes-v1` with disjoint `minted`, `referenced`, and `updated` ID lists, each terminal at the time of the event. Legacy rows keep their earlier minted-or-updated provenance and are not guessed or rewritten.

### Reviewed consolidation manifest

The manifest is UTF-8 JSON with integer `version: 1` and a non-empty `mappings` list. Each mapping names one `source_id`, its immediate `target_id`, and the redirect decision fields `kind`, `decided_at`, `decided_by`, `reason`, and `evidence_refs`.

Every version 1 mapping source in one manifest must belong to the same canonical JSONL dataset. Cross-dataset reviews are split into separate manifests and apply operations, each previewed and approved on its own.

The manifest is root-independent reviewed input, not canonical authority. Authority changes only after a validated apply operation atomically updates the losing row.

### Atomic writes

Only `consolidate --apply` changes canonical JSONL. It writes to a temporary file on the same filesystem and atomically replaces the one affected JSONL file. It preserves file permissions. It rebuilds the derived index after the canonical write. When the canonical write commits but the index rebuild fails, the command reports the exact recovery command, as [PRD 20 Output and Exit Contract](./20-buildos-cli-and-distribution.md#output-and-exit-contract) defines for exit code `6`.

`rebuild-index --apply` writes only the derived index. It never changes canonical JSONL.

### Derived index

The entity-resolution index is a generated projection of all governed entity JSONL datasets. Its path is `.os/indexes/entity-resolution.json` in an installed root, and `system/.os/indexes/entity-resolution.json` in the source scaffold. It contains stable `canonical_by_id` and `members_by_canonical` maps in lexical order. Canonical JSONL rows stay authoritative. The index may be deleted and rebuilt.

`references.json` is the intake index. It never carries entity redirects. [07 Intake and Conversion](./07-intake-and-conversion.md#contracts-and-data) owns it.

Code anchors:

- `system/.os/contracts/entity-records-contract.md`
- `system/.os/contracts/entity-consolidation-contract.md`
- `system/.os/contracts/persona-identity-contract.md`
- `system/.os/contracts/extraction-contract.md`
- `system/.os/indexes/entity-resolution.json`

## Integrations

- Entity readers, validators, playbook target resolution, extraction, and future entity-producing workflows share the terminal resolver.
- Entity consumers keep original IDs for provenance and expose canonical IDs and chains. Entity producers store canonical IDs for new references and tell reused or updated entities apart from newly minted ones. [08 Data Layer and Extraction](./08-data-and-extraction.md#integrations) states this for the data layer.
- Playbook targets that name a losing ID stay auditable and resolve canonically when used ([09 Playbooks](./09-playbooks.md#contracts-and-data)).
- Discovery stores canonical targets and run links and keeps requested IDs and chains ([10 Discovery, Runs and Qualification](./10-discovery-runs-and-qualification.md#contracts-and-data)).
- Design promotion resolves a requested finding to a terminal `qualified` finding and writes the back-reference only to the canonical finding ([11 Flow C Integration](./11-flow-c-integration.md#contracts-and-data)).
- Extraction-outcome validation requires disjoint `minted`, `referenced`, and `updated` lists whose governed IDs resolve to terminal canonical records. Entity-graph validation does not validate `PB-NNN` values. The playbook-aware API also consults the authoritative playbook resolver. The shared persona matcher stays a proposal boundary, not a live-data writer.
- The [pre-upgrade audit prompt](../assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md) is proposal-only. It prepares review artifacts for a root whose installed BuildOS version does not yet support canonical resolution. It never writes canonical data, sets a record to `superseded`, or adds a redirect.
- The `buildos entities` command surface, output envelope, and exit codes follow [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#command-surface).

Code anchors:

- `toolkits/buildos/`
- `system/.os/contracts/extraction-contract.md`

## Rebuild Notes

### Adoption and live-root migration safety

Package verification, project adoption, and live-data migration are distinct actions. Adoption uses `buildos init` and pins the package version in `.os/manifest.json`. Adoption never changes data ([20 Project Initialization and Adoption](./20-buildos-cli-and-distribution.md#project-initialization-and-adoption)).

Before redirect-bearing live data is migrated, the operator must:

1. Inventory the pinned BuildOS version, the wrappers, and the actual adopter-owned data root.
2. Create a recoverable snapshot or working copy of the adopter root.
3. Run the candidate version, named by an explicit `npx` version, against the copied root in compatibility and dry-run modes.
4. Review warnings, proposed mappings, redirect chains, and index changes.
5. Apply approved mappings only to the copy. Then run strict validation, deterministic index checks, and representative read and write tests.
6. Record the package version, the source revision, the snapshot identity, the validation results, and the rollback location.
7. Get a separate operator approval before mutating the live data root with the verified version and mapping set.

Live-root migration requires snapshot evidence, strict validation, and deterministic index reproduction. The change of the pinned version and the migration of live data are separate cutovers, and each needs its own approval. An earlier BuildOS version stays read-only for redirect-bearing datasets until the cutover is complete. Copied-root acceptance does not authorize a live migration. The live migration gate is tracked as `R-004` in the [open questions and risk register](./03-open-questions-and-risk-register.md).

### Acceptance

- One-hop and multi-hop redirects resolve to one current canonical record without erasing the losing rows.
- A later replacement of a current winner keeps terminal resolution correct.
- The same consolidation is idempotent. Redirecting one loser to a different target is a reviewed conflict.
- A version 1 manifest affects at most one canonical JSONL dataset. Cross-dataset reviews are split into separately previewed and approved manifests.
- The resolver and validator give actionable failures for missing targets, self-redirects, type mismatches, cycles, inactive terminals, illegal redirect statuses, duplicate IDs, remap conflicts, and stale indexes.
- Persona fixtures cover repeated extraction, ambiguous aliases, provenance preservation, and approved reuse of canonical IDs.
- Generic fixtures cover every current entity type and reject cross-type redirects.
- Repeated index builds from unchanged canonical input are byte-identical.
- Copied-root integration tests prove compatibility assessment, approved persona consolidation, strict validation, canonical read and write behavior, isolation of the version under test from the pinned installed version, and rollback from the untouched snapshot.
- Failure-injection tests cover invalid JSONL, interrupted or unwritable canonical writes, stale indexes, and a successful canonical write followed by an index rebuild failure.

Code anchors:

- `toolkits/buildos/`

## Requirement History

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Rebuild Notes`, adoption and migration
- Previous contract: An adopter built `buildos` from a separate source checkout without replacing installed binaries, invoked the source-built binary by explicit path against a copied root, recorded the source revision and binary checksum, and got a separate operator approval to reroute or replace installed binaries before a separate approval to migrate live data. Live-root migration required separately approved binary and data cutovers.
- Replacement contract: Adoption uses `buildos init` and the version pinned in `.os/manifest.json`. An explicit `npx` version runs against a copy. Live-root migration keeps its snapshot, strict validation, index reproduction, and separate approval. The pinned-version change and the data migration are separate cutovers.
- Rationale: No binaries exist after the move to the npm package.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Source Anchors`, acceptance evidence
- Previous contract: The Go rehearsal anchors `toolkits/buildos/internal/cli/persona_rehearsal_test.go` and the shared Go package `toolkits/buildos/pkg/entities` were named as acceptance evidence. The W1 R4 delivery was recorded in this PRD: P2 built the source-built CLI seed, graph engine, deterministic index, and single-dataset reviewed mutation surface; P3 proved the procedure against the sanitized fixture root `toolkits/buildos/testdata/persona-pilot/root/` with a review package under `toolkits/buildos/testdata/persona-pilot/review/`, covering compatibility assessment, non-mutating preview, approved apply, strict validation, representative resolution, byte-stable replay, conflict refusal, injected write failure, and exact snapshot restoration; P4 wired discovery and design to `toolkits/buildos/pkg/entities` by direct import and added the persona exact-match adapter and the `extraction-outcomes-v1` validator; P5 closed the source implementation with operator and maintainer guidance and full validation. No installed binary or live record was changed, and no binary-routing or live-data-migration approval was granted.
- Replacement contract: Source anchors name the package fixtures. The W1 R4 delivery facts are kept here in short form only. The copied-root acceptance stays a prerequisite for a live migration, not evidence that one happened.
- Rationale: The Go code is removed after the TypeScript package reaches parity.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

## Source Anchors

- [Entity consolidation and canonical resolution design](../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [Entity records contract](../../system/.os/contracts/entity-records-contract.md)
- [Entity consolidation contract](../../system/.os/contracts/entity-consolidation-contract.md)
- [Persona identity contract](../../system/.os/contracts/persona-identity-contract.md)
- [Extraction contract](../../system/.os/contracts/extraction-contract.md)
- `toolkits/buildos/testdata/persona-pilot/` (persona pilot fixtures at their location before the TypeScript port)
