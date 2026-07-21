# 17 Enhance Entity Consolidation and Canonical Resolution

## Purpose

Define a generic, non-destructive way to consolidate duplicate or superseded Build OS entity records,
preserve the history and provenance of every losing record,
and resolve historical and future references to one current canonical record.

Personas are the first proving ground.
The redirect graph and resolver apply to every entity type governed by the entity-records contract,
while type-specific identity matching expands only after each type has reviewed deterministic rules.

## Change Type

- Type: `enhancement`
- Execution mode: active-set evolution
- Effective change: extend the existing `superseded` lifecycle state,
  layered-canonicity model,
  entity-producing workflows,
  playbook targets,
  and deterministic toolkit boundary with canonical-resolution behavior.

## Capability Addition or Enhancement

### Non-destructive consolidation

A losing entity remains an authoritative historical row in its original `system/.os/data/*.jsonl` dataset.
Its stable ID,
source evidence,
narrative anchors,
and type-specific content remain intact.
The row changes to `status: superseded` and carries exactly one reviewed `redirect` to its immediate successor.

The canonical winner does not maintain a hand-edited list of losing IDs.
Reverse membership is derived from the redirect graph.
The existing `related` field remains a non-canonical relationship and never participates in resolution.

### Terminal canonical resolution

One deterministic resolver is shared by validators,
toolkits,
and entity-consuming or entity-producing workflows.
Given an entity ID,
it follows zero or more redirects and returns the requested ID,
the terminal canonical ID,
the complete resolution chain,
and whether resolution occurred.

Reads preserve and may display the originally recorded ID while exposing the canonical ID and chain.
New references and intentional updates store the terminal canonical ID.
Existing historical references do not require a destructive bulk rewrite.
Missing targets,
self-redirects,
cross-type targets,
cycles,
and chains that do not terminate at one current record fail closed with actionable diagnostics.

### Deterministic toolkit and index

The unified Go module `toolkits/buildos/` owns the public CLI and exposes the entity domain as `buildos entities`.
During W1 R4,
the module's temporary `pkg/entities` package owns shared entity-graph validation,
resolution,
consolidation,
and the entity-resolution index so existing discovery and design modules can import one implementation without subprocess calls.
The module produces one `buildos` binary with these initial entity commands:

```text
buildos entities consolidate
buildos entities resolve
buildos entities validate
buildos entities rebuild-index
```

Mutation is dry-run by default and requires explicit `--apply` authorization.
Every mutating invocation requires an explicit adopter root,
loads and validates the complete entity graph before writing,
requires every version 1 manifest source to belong to one canonical JSONL dataset,
uses same-filesystem temporary output and atomic replacement for that one affected JSONL file,
preserves file permissions,
and rebuilds the derived index after the canonical write.
The command reports its executable version and source revision,
resolved root,
operating mode,
and whether a write occurred.

`system/.os/scripts/` may provide thin routing or compatibility wrappers after the command surface stabilizes.
No new durable Python implementation is permitted.
No public `buildos-entities` binary is introduced.

### Compatibility-to-strict migration

Compatibility mode accepts a legacy `superseded` row without a redirect only as a structured warning.
It excludes that row from automatic resolution and never guesses a successor.
All newly created or changed superseded rows satisfy strict rules,
even while an adopter root is assessed in compatibility mode.

Strict mode rejects legacy superseded rows without valid redirects,
all graph invariant violations,
duplicate IDs across governed datasets,
non-idempotent remap conflicts,
and stale or non-reproducible resolution indexes.
Strict validation is the release and post-migration gate.
Compatibility mode is a temporary,
read-oriented assessment aid rather than a second long-term contract.

### Matching and review policy

Entity-producing workflows apply matching in this order:

1. Resolve an exact entity ID automatically to its terminal canonical ID.
2. Resolve an exact,
   type-scoped approved alias or consolidated-member identity only when it identifies one canonical record uniquely.
3. Resolve an exact type-specific identity key only after that entity type defines a versioned,
   deterministic,
   tested key contract.
4. Route fuzzy,
   semantic,
   ambiguous,
   or otherwise probabilistic matches to human review with evidence and confidence.
   They never create redirects or mutate canonical records automatically.

Persona identity is the first adapter and pilot.
P1 defines the optional `persona-v1` identity key and reviewer-approved alias list for personas only.
Comparison trims and collapses ASCII whitespace and lowercases ASCII letters;
Unicode normalization,
punctuation removal,
stemming,
synonym expansion,
token reordering,
fuzzy matching,
and semantic matching remain review-only.
Requirements,
capabilities,
findings,
test cases,
results,
runs,
and extractions are enabled one type at a time after their identity rules are designed and validated.
Extraction metadata distinguishes a newly minted ID from an update or reference to an existing canonical ID.
New outcome-aware rows use `extraction-outcomes-v1` with disjoint `minted`,
`referenced`,
and `updated` terminal-at-event ID lists.
Legacy rows retain their earlier minted-or-updated provenance and are not guessed or rewritten.

### Side-by-side source-build adoption

An adopter that already has Build OS installed may build `buildos` from a separate source checkout,
but source build verification,
binary deployment,
and live-data migration are distinct actions.

The operator must:

1. Inventory installed binaries,
   wrappers,
   versions,
   and the actual adopter-owned data root.
2. Clone and build in a separate source directory without replacing installed binaries.
3. Create a recoverable snapshot or working copy of the adopter root.
4. Invoke the source-built binary by explicit path against the copied root in compatibility and dry-run modes.
5. Review warnings,
   proposed mappings,
   redirect chains,
   and index changes.
6. Apply approved mappings only to the copy,
   then run strict validation,
   deterministic index checks,
   and representative read/write tests.
7. Record the source revision,
   binary checksum,
   snapshot identity,
   validation results,
   and rollback location.
8. Obtain a separate operator approval before rerouting or replacing installed binaries.
9. Obtain a separate operator approval before mutating the installed data root with the verified binary and mapping set.

The source checkout's `system/` scaffold must never be copied wholesale over an installed or adopter-owned root.
Old tooling remains read-only for redirect-bearing datasets until cutover is complete.

W1 R4 P3 proves this procedure against the sanitized fixture root at `toolkits/buildos/testdata/persona-pilot/root/`, not against adopter-owned production data. The fixture review package records inventory, proposal-only mappings, explicit reviewer decisions, an unresolved ambiguous group, approved manifests, and checksums under `toolkits/buildos/testdata/persona-pilot/review/`. `toolkits/buildos/internal/cli/persona_rehearsal_test.go` proves compatibility assessment, non-mutating preview, approved apply, strict validation, representative resolution, byte-stable replay, conflict refusal, injected write failure, and exact snapshot restoration. No installed binary or live record was changed, and the rehearsal grants neither binary-routing approval nor live-data-migration approval.

### Acceptance requirements

- One-hop and multi-hop redirects resolve to one current canonical record without erasing the losing rows.
- A later replacement of a current winner preserves correct terminal resolution.
- The same consolidation is idempotent;
  redirecting one loser to a different target is a reviewed conflict.
- A version 1 manifest affects at most one canonical JSONL dataset; cross-dataset reviews are split into separately previewed and approved manifests.
- The resolver and validator produce actionable failures for missing targets,
  self-redirects,
  type mismatches,
  cycles,
  inactive terminals,
  illegal redirect statuses,
  duplicate IDs,
  remap conflicts,
  and stale indexes.
- Persona fixtures cover repeated extraction,
  ambiguous aliases,
  provenance preservation,
  and approved reuse of canonical IDs.
- Generic fixtures cover every current entity type and reject cross-type redirects.
- Repeated index builds from unchanged canonical input are byte-identical.
- Copied-root integration tests prove compatibility assessment,
  approved persona consolidation,
  strict validation,
  canonical read/write behavior,
  side-by-side binary isolation,
  and rollback from the untouched snapshot.
- Failure-injection tests cover invalid JSONL,
  interrupted or unwritable canonical writes,
  stale indexes,
  and a successful canonical write followed by an index rebuild failure.

The P3 copied-root acceptance requirements are satisfied by the sanitized persona pilot and the staged-binary rehearsal evidence. The actual adopter-owned root was unavailable during this phase, so these requirements remain a prerequisite for any later live migration rather than evidence that a live migration occurred.

### Change Notes

- Superseded by [18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md) for the public executable and source-module topology: W1 R4 seeds `toolkits/buildos/` and `buildos entities`; W1 R5 later consolidates the existing domains and packages `buildos 0.1.0`. The entity data, resolver, mutation, index, validation, and migration-safety requirements in this PRD remain effective.
- W1 R4 P2 implements the source-built CLI seed, graph engine, deterministic index, and reviewed mutation surface. Version 1 manifests are explicitly limited to one canonical JSONL dataset so a successful apply performs one atomic canonical-file replacement; multi-dataset reviews require separate manifests and approvals.
- W1 R4 P4 wires `buildos-discovery` and `buildos-design` directly to the temporary `toolkits/buildos/pkg/entities` Go package through explicit local module dependencies. Discovery resolves authored playbook targets, explicit targets, and requested run IDs before runtime use; design resolves the requested finding before promotion. Both preserve requested IDs and full chains for provenance while new governed references use terminal canonical IDs.
- P4 also implements the persona-only exact-match adapter and the `extraction-outcomes-v1` validator as shared package APIs. Exact IDs, unique approved aliases, and unique `persona-v1` keys may resolve automatically; ambiguous, colliding, inactive, fuzzy, semantic, unsupported-type, and malformed inputs remain non-mutating review outcomes.
- P4 does not migrate live data, publish a package, replace installed binaries, or add a general extraction command. Existing discovery and design binaries remain separate until W1 R5.

## Affected Baseline Docs

| Document | Impact |
| --- | --- |
| `00-index.md` | Adds PRD 17 to reading order, related-doc lineage, and audience routes. |
| `01-product-overview.md` | Adds entity consolidation and canonical resolution to product capabilities while preserving the unimplemented-state limitation. |
| `02-architecture-overview.md` | Adds the entity toolkit and index, redirect-aware Flow A behavior, and explicit source-build/runtime boundaries. |
| `03-open-questions-and-risk-register.md` | Updates R-004 with the accepted mitigation and executable closure gates. |
| `04-glossary.md` | Adds canonical identity, redirect, resolution, index, and validation-mode terminology. |
| `08-data-and-extraction.md` | Defines redirect-bearing records, canonicalized references, matching tiers, and index rebuild behavior. |
| `09-playbooks.md` | Requires entity-valued playbook targets to resolve canonically without rewriting historical playbooks. |
| `14-revise-deterministic-toolkit-deployment.md` | Applies the packaged Go execution standard and explicit source-build adoption boundaries to entity operations, as revised by PRD 18. |
| `15-revise-extraction-draft-lifecycle.md` | Distinguishes pending `draft`, successor-bearing `superseded`, and successor-free `archived` lifecycle semantics. |
| `16-revise-toolkit-ownership-boundaries.md` | Assigns entity-graph behavior to the domain-owned `entities` package and `buildos entities` subcommand, as revised by PRD 18. |

PRD 07 is not changed.
Its converted-source intake contract and `references.json` index remain semantically separate from entity resolution.

## Contracts and Data

### Redirect object

| Field | Requirement | Meaning |
| --- | --- | --- |
| `target_id` | required | Stable ID of the immediate successor. |
| `kind` | required | One of `duplicate`, `consolidated`, or `replaced`. |
| `decided_at` | required | ISO 8601 UTC datetime for the reviewed decision. |
| `decided_by` | required | Configured owner, team, agent, or human identifier responsible for the decision. |
| `reason` | required | Concise explanation of why the source record is no longer canonical. |
| `evidence_refs` | required | Entity IDs or path-and-anchor references that support the decision; it may be empty only when no evidence exists. |

`duplicate` means two records represent the same identity or concept.
`consolidated` means overlapping records were intentionally combined into one broader canonical record.
`replaced` means the source is obsolete and has an intentional successor without being a duplicate.

The lifecycle and graph contract requires:

- a newly written `superseded` row to contain exactly one redirect;
- `draft`,
  `active`,
  and `archived` rows not to contain a redirect;
- source and target to exist,
  differ,
  and have the same entity type;
- every chain to be acyclic and terminate at one current record;
- archived to mean retained without a successor;
- losing type-specific fields and provenance to remain intact;
- reverse membership to be derived rather than copied onto the winner;
- `related` edges to remain outside canonical resolution.

### Resolver result

The stable resolver result contains:

```json
{
  "requested_id": "PER-041",
  "canonical_id": "PER-003",
  "chain": ["PER-041", "PER-027", "PER-003"],
  "resolved": true
}
```

### Reviewed consolidation manifest

The P1 manifest contract uses UTF-8 JSON with integer `version: 1` and a non-empty `mappings` list.
Each mapping names one `source_id`,
its immediate `target_id`,
and the redirect decision fields `kind`,
`decided_at`,
`decided_by`,
`reason`,
and `evidence_refs`.
Every version 1 mapping source in one manifest must belong to the same canonical JSONL dataset.
Split cross-dataset reviews into separate manifests and apply operations.
The manifest is root-independent reviewed input rather than canonical authority;
authority changes only after a validated apply operation atomically updates the losing row.

### Derived index

`system/.os/indexes/entity-resolution.json` is a generated projection of all governed entity JSONL datasets.
It contains stable `canonical_by_id` and `members_by_canonical` maps in lexical order.
Canonical JSONL rows remain authoritative;
the index may be deleted and rebuilt.
`references.json` remains the converted-source intake index and does not carry entity redirects.

## Integration Impact

- Entity readers,
  validators,
  playbook target resolution,
  extraction,
  and future entity-producing workflows share the terminal resolver.
- Entity consumers preserve original IDs for provenance and expose canonical IDs and chains.
- Entity producers store canonical IDs for new references and distinguish reused or updated entities from newly minted entities.
- Playbooks that historically target a losing ID remain auditable and resolve to the canonical entity when used.
- Discovery stores canonical targets and canonical run links in new records while retaining requested targets, requested run IDs, and complete resolution chains. Its authored playbook rows and historical losing records remain unchanged.
- Design promotion accepts a requested historical finding ID, resolves it to one terminal `qualified` finding, reports requested/canonical/chain data, and writes the design back-reference only to the canonical finding.
- Terminal lifecycle is type-aware: most types resolve to `active`; findings may resolve to `qualified`; runs may resolve to `running`, `closed`, or `aborted`. `qualified` is not a valid status for unrelated types, and design promotion still requires a `qualified` canonical finding.
- Extraction-outcome validation requires disjoint `minted`, `referenced`, and `updated` lists whose governed IDs resolve to terminal canonical records. Entity-graph validation does not validate `PB-NNN` values; the playbook-aware API also consults the authoritative playbook resolver. The shared persona matcher remains a proposal boundary rather than a live-data writer.
- The first release supports reviewed persona consolidation and copied-root rehearsal before broader entity-type rollout.
- The pre-upgrade audit prompt remains proposal-only until the compatible resolver,
  validator,
  writer,
  and index are available.
- Live-root migration requires snapshot evidence,
  strict validation,
  deterministic index reproduction,
  and separately approved binary and data cutovers.

## Required Baseline Annotations

- Add `Enhanced by` notes to the impacted sections of PRDs 01,
  02,
  04,
  08,
  09,
  14,
  15,
  and 16.
- Update PRD 00 with reciprocal related-document links,
  reading order,
  and audience routing.
- Update existing risk item R-004 in PRD 03 in place.
- Do not add a PRD 07 annotation or a `Change Notes` block inside the risk register.

## Source Anchors

- [Entity consolidation and canonical resolution design](../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [W1 R4 entity consolidation and canonical resolution plan](../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md)
- [Entity records contract](../../system/.os/contracts/entity-records-contract.md)
- [Entity consolidation contract](../../system/.os/contracts/entity-consolidation-contract.md)
- [Persona identity contract](../../system/.os/contracts/persona-identity-contract.md)
- [Extraction contract](../../system/.os/contracts/extraction-contract.md)
- [Pre-upgrade entity consolidation audit prompt](../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
- [PRD 08 Data Layer and Extraction](./08-data-and-extraction.md)
- [PRD 14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md)
- [PRD 15 Revise Extraction Draft Lifecycle](./15-revise-extraction-draft-lifecycle.md)
- [PRD 16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md)
- [PRD 18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md)
- `toolkits/buildos/testdata/persona-pilot/`
- `toolkits/buildos/internal/cli/persona_rehearsal_test.go`
