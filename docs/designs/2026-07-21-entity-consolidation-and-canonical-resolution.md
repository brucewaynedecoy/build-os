# Entity Consolidation and Canonical Resolution

## Purpose

Define a generic, non-destructive way to consolidate duplicate or superseded Build OS entity records,
preserve the provenance and stable ID of every losing record,
and resolve historical or future references to the surviving canonical record.

This decision is intended to cover personas first and then all entity types governed by the
[entity records contract](../../system/.os/contracts/entity-records-contract.md).
It also defines a safe adoption path for environments that already have Build OS installed
but can only obtain the enhancement by cloning this repository and building from source.

## Context

The [Build OS architecture](./2026-06-03-build-os-architecture.md) establishes stable,
per-type entity IDs and layered canonicity:
structured entity fields are authoritative in `system/.os/data/*.jsonl`,
while narrative remains authoritative in `system/docs/`.
Generated files under `system/.os/indexes/` support lookup and navigation but are not source-of-truth records.

The current entity contract includes `draft`, `active`, `superseded`, and `archived` lifecycle states.
`superseded` says that a record was replaced,
but the contract does not require the record to identify its replacement.
The shared `related` field is an undirected cross-link;
it cannot express canonical ownership,
drive deterministic resolution,
or distinguish a duplicate from an ordinary relationship.

This omission is visible in deployed environments with large extracted entity sets.
For example, multiple source assets may produce many persona records that describe the same actor.
Teams can choose a small set of winning personas,
but deleting losing personas destroys provenance,
and merely marking them `superseded` does not redirect later references or prevent extraction from recreating them.
The same problem can occur with requirements, capabilities, test cases, findings,
and other entity types.

The deployment constraint is material.
Some adopters have an installed Build OS system and populated adopter-owned data root,
but no clean in-place upgrade mechanism.
They can clone the repository and build new toolkits from source while the old installation remains present.
The [toolkit CLI deployment standard](./2026-06-04-buildos-toolkit-cli-deployment-standard.md)
places durable deterministic logic in independently buildable Go toolkits,
with `system/.os/scripts/` reserved for wrappers and compatibility routing.
This enhancement must follow that standard without allowing a source checkout,
a newly built binary,
or a copied `system/` scaffold to overwrite an installed data root implicitly.

Cleanup can begin before the implementation is available,
but only as a read-only inventory and decision exercise.
The reusable
[pre-upgrade entity consolidation audit prompt](../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
should identify likely winners and losers,
capture evidence and ambiguity,
and produce a proposed mapping for review.
It must not delete records,
add uncontracted redirect fields,
rewrite references,
or mutate the installed root.
Contract-bearing data changes should wait until the resolver,
validator,
and deterministic writer are available from the source build.

## Architecture Change Note (2026-07-21)

The accepted [Unified BuildOS CLI and Distribution design](./2026-07-21-unified-buildos-cli-and-distribution.md)
supersedes this design's earlier proposal for a separately distributed `buildos-entities` executable.
W1 R4 now seeds the future single Go module at `toolkits/buildos/`
and exposes the canonical command family as `buildos entities`.
No public `buildos-entities` binary is introduced.

This changes the command and module boundary only;
the redirect,
resolver,
consolidation-manifest,
index,
compatibility and strict validation,
persona identity,
extraction outcome,
explicit-root,
dry-run,
atomic-write,
and copied-root safety contracts in this design remain effective.
Until W1 R5 consolidates the existing domains,
`buildos-intake`,
`buildos-discovery`,
and `buildos-design` remain separately built and installed executables.
W1 R4 exposes the resolver temporarily through `toolkits/buildos/pkg/entities`,
so existing discovery and design modules can import one graph implementation through explicit local module dependencies rather than subprocess calls.
W1 R5 will migrate those consumers into `toolkits/buildos/internal/`,
remove the local replacements,
and add compatibility aliases for the old executable names.

## Decision

### 1. Add a generic redirect to the common entity envelope

A losing entity remains in its original canonical JSONL dataset with its stable ID,
source evidence,
narrative anchor,
and type-specific content intact.
It changes to `status: superseded` and gains a required `redirect` object:

```json
{
  "id": "PER-027",
  "type": "persona",
  "title": "Enterprise Platform Administrator",
  "status": "superseded",
  "summary": "Persona extracted from REF-042.",
  "redirect": {
    "target_id": "PER-003",
    "kind": "duplicate",
    "decided_at": "2026-07-21T15:30:00Z",
    "decided_by": "product-research",
    "reason": "Consolidated into the approved administrator persona.",
    "evidence_refs": [
      "REF-042",
      "system/docs/research/personas.md#review"
    ]
  }
}
```

The `redirect` fields have these meanings:

| Field | Requirement | Meaning |
| --- | --- | --- |
| `target_id` | required | Stable ID of the immediate successor. |
| `kind` | required | `duplicate`, `consolidated`, or `replaced`. |
| `decided_at` | required | ISO 8601 UTC datetime for the reviewed decision. |
| `decided_by` | required | Configured owner, team, agent, or human identifier responsible for the decision. |
| `reason` | required | Concise explanation of why the source record no longer remains canonical. |
| `evidence_refs` | required, may be empty only when no evidence exists | Entity IDs or path-and-anchor references supporting the decision. |

`duplicate` means the records represent the same identity or concept.
`consolidated` means overlapping records were intentionally combined into one broader canonical record.
`replaced` means the source record is obsolete and has an intentional successor,
even though it was not a duplicate.

The contract enforces these invariants:

- A newly written `superseded` record must contain exactly one `redirect` object.
- A `draft`, `active`, or `archived` record must not contain `redirect`.
- `redirect.target_id` must exist and must not equal the source record ID.
- The source and target must have the same entity type.
  A future cross-type relationship remains a `related` edge,
  not a redirect.
- A redirect graph must be acyclic.
- A redirect may point to a record that is later superseded,
  but following the complete chain must terminate at an `active` record.
- An archived record means retained without a current successor;
  it must not be used as a synonym for superseded.
- The canonical record does not contain a hand-maintained list of losing IDs.
  Reverse membership is derived from redirects.
- Consolidation does not erase the losing record's type-specific fields or provenance.
- Repeating the same already-applied consolidation is idempotent.
  Attempting to redirect the same loser to a different target is a conflict that requires an explicit reviewed change.

The existing `related` field remains available for non-canonical relationships.
It does not participate in resolution.

### 2. Resolve references to a terminal canonical ID

Build OS will define one deterministic resolver shared by validation,
toolkits,
and entity-producing workflows.
Given an entity ID,
the resolver follows zero or more redirects until it reaches the terminal active record.
It returns both the requested identity and the canonical identity so callers do not lose provenance:

```json
{
  "requested_id": "PER-041",
  "canonical_id": "PER-003",
  "chain": ["PER-041", "PER-027", "PER-003"],
  "resolved": true
}
```

Read behavior and write behavior are intentionally different:

- Reads may retain and display the originally recorded ID,
  but they must also expose the resolved canonical ID and redirect chain.
- New entity references and intentional updates must store the terminal canonical ID.
- Existing historical references do not need to be rewritten in bulk.
  They resolve transparently when read or validated.
- A missing target,
  cycle,
  type mismatch,
  or non-active terminal is an error.
  The resolver fails closed and never guesses a winner.
- Consumers that cannot yet resolve redirects may continue to read the additive JSONL shape,
  but they must not treat superseded records as active winners.

This preserves the historical statement that an asset or run originally referenced `PER-041`
while ensuring current workflows operate on `PER-003`.

### 3. Generate a dedicated entity-resolution index

Add `system/.os/indexes/entity-resolution.json` as a generated,
rebuildable projection of canonical entity records.
The initial index shape is:

```json
{
  "version": 1,
  "canonical_by_id": {
    "PER-027": "PER-003",
    "PER-041": "PER-003"
  },
  "members_by_canonical": {
    "PER-003": ["PER-027", "PER-041"]
  }
}
```

The generator reads all governed `system/.os/data/*.jsonl` entity datasets,
validates the complete redirect graph,
resolves every chain,
and emits keys and member lists in stable lexical order.
Identical canonical inputs must produce byte-identical index output.
The JSONL records remain authoritative;
the index may always be deleted and rebuilt.

`references.json` remains the intake and converted-source lookup index.
It will not be overloaded with entity redirect behavior.

### 4. Seed deterministic operations in the unified Go CLI

Create the initial unified Go module at `toolkits/buildos/`,
producing one `buildos` executable.
W1 R4 initially supplies the root CLI,
shared root and output behavior,
layout resolution,
and the entity domain.
The durable public implementation surface is `buildos entities`;
there is no public `buildos-entities` executable.

Until W1 R5 moves the existing intake,
discovery,
and design domains into the unified module,
the entity resolver is exposed temporarily as `toolkits/buildos/pkg/entities`.
Existing Go modules import that package through explicit local module dependencies.
They must not shell out to the CLI or duplicate redirect traversal.

The initial command surface is:

```shell
buildos entities consolidate \
  --root /path/to/system-root \
  --mode compat \
  --manifest /path/to/reviewed-mappings.json \
  [--apply] \
  [--json]

buildos entities resolve \
  --root /path/to/system-root \
  --mode compat \
  --id PER-027 \
  [--json]

buildos entities validate \
  --root /path/to/system-root \
  --mode compat \
  [--json]

buildos entities rebuild-index \
  --root /path/to/system-root \
  --mode strict \
  [--check|--apply] \
  [--json]
```

Mutation commands produce a dry-run plan by default and require an explicit `--apply` flag to write.
Before applying,
the toolkit loads and validates the entire entity graph in memory.
It writes the affected canonical JSONL file through a same-filesystem temporary file and atomic replacement,
preserves existing file permissions,
and then rebuilds the derived index.
If index generation fails after the canonical write,
the command reports the exact recovery command;
it does not attempt to fabricate or retain a partially generated index as authoritative data.

The seed also provides `buildos help` and `buildos version`.
Source builds default to version `dev` and source revision `unknown` unless build flags inject them.
Every result reports the executable version,
the source revision,
the resolved root,
the operating mode,
and whether any write occurred;
human-readable output is the default and `--json` selects the shared automation envelope.
Mutation requires an explicit root path;
it does not infer the installed root from the source checkout or current working directory.
Wrappers under `system/.os/scripts/` may route to the binary after the command surface stabilizes,
but no new Python implementation is introduced.

### 5. Extend validation without making legacy data unrecoverable

Validation has two migration modes:

- Compatibility mode accepts legacy `superseded` records that lack `redirect`,
  reports each as a structured warning,
  and excludes it from automatic resolution.
- Strict mode rejects every `superseded` record without a valid redirect
  and rejects all other graph invariant violations.

All newly created or changed superseded records must satisfy strict rules,
even while an adopter root is being assessed in compatibility mode.
There is no automatic inference of redirect targets for legacy records.
An operator must approve each mapping or an explicitly reviewed batch.

Validation must report actionable diagnostics for:

- a missing target;
- a self-redirect;
- a cross-type target;
- a redirect cycle,
  including the complete cycle;
- a chain that terminates at a draft,
  archived,
  or missing record;
- an illegal redirect on a non-superseded record;
- a non-idempotent remap conflict;
- duplicate IDs across datasets;
- a stale or non-reproducible entity-resolution index;
- ambiguous aliases or identity keys proposed for automatic extraction matching.

Strict validation is the release and post-migration gate.
Compatibility mode is a temporary assessment aid,
not an alternate long-term contract.

### 6. Separate deterministic matching from review candidates

Redirect resolution handles known entity IDs.
Extraction also encounters names or descriptions without an ID,
so entity-producing workflows use a tiered matching policy:

1. An exact entity ID resolves automatically to its terminal canonical ID.
2. An exact,
   type-scoped match against an explicitly approved alias or a previously consolidated member identity resolves automatically
   only when the normalized value identifies one canonical record uniquely.
3. An exact,
   type-specific identity-key match may resolve automatically when that entity type defines a deterministic key contract.
4. Fuzzy,
   semantic,
   or otherwise probabilistic similarity produces a candidate with evidence and confidence for human review.
   It never creates a redirect or mutates a canonical record automatically.
5. Any collision or ambiguity falls back to the review queue.

Normalization rules must be explicit,
versioned,
type-scoped,
and testable.
The generic resolver does not pretend that every entity type has the same identity semantics.
Persona matching is the first adapter and proving ground.
Requirement,
capability,
finding,
test-case,
result,
run,
and extraction matching must each be enabled only after their identity rules are designed and validated.

Extraction records continue to preserve what was observed from the source.
When extraction reuses a canonical entity,
its `minted` or related output metadata should distinguish an updated or referenced canonical ID from a newly created ID.

### 7. Adopt through side-by-side source-build verification

An adopter with an existing installation follows a staged,
explicit-root process:

1. Inventory the installed binary paths,
   version information,
   wrappers,
   and actual adopter data root.
2. Clone the repository into a separate source directory and build `buildos` there.
   Do not place the new binary over an installed binary yet.
3. Create a recoverable snapshot or working copy of the adopter-owned data root,
   including canonical JSONL files and current indexes.
4. Invoke the source-built binary by its explicit path against the copied root in compatibility and dry-run modes.
5. Review warnings,
   proposed persona mappings,
   redirect chains,
   and the generated index diff.
6. Apply approved mappings only to the copied root,
   then run strict validation,
   deterministic index rebuild checks,
   and representative read/write workflow tests.
7. Record the source revision,
   binary checksum,
   root snapshot identity,
   validation results,
   and rollback location.
8. Replace or reroute installed binaries only through a separate operator-approved deployment step.
9. Mutate the installed data root only through a separate operator-approved migration step using the already verified binary and mapping set.

Binary deployment and data migration are two distinct approvals.
Neither step implies the other.
The source checkout's `system/` scaffold must never be copied wholesale over the adopter's installed root.
The toolkit refuses mutation when the root cannot be resolved unambiguously,
when the snapshot or preflight requirement is unsatisfied,
or when validation finds graph errors.

The initial contract change is additive,
and read-only compatibility mode makes it possible to inspect older roots.
This does not claim that an arbitrary old Build OS binary understands redirects.
Until cutover is complete,
old tooling remains read-only with respect to consolidated records,
and the source-built resolver is the authority for any workflow that consumes them.

### 8. Roll out by capability stage

The implementation proceeds in these stages:

1. **Pre-implementation audit:** use the reusable prompt to inventory persona duplicates and prepare reviewed mapping proposals without editing canonical data.
2. **Contract and engine:** extend the entity contract;
   implement the resolver,
   graph validator,
   deterministic index,
   and dry-run/apply `buildos entities` operations inside the unified CLI seed.
3. **Persona pilot:** apply a small reviewed persona mapping set in fixtures and a copied adopter root;
   validate resolution through existing references and new extraction inputs.
4. **Read/write integration:** make entity consumers expose original and canonical IDs,
   and make entity producers write terminal canonical IDs.
5. **Type expansion:** add reviewed identity rules and consolidation coverage for other entity types one type at a time.
6. **Candidate review:** add exact alias and identity-key support,
   followed by a human review queue for fuzzy or semantic candidates.
7. **Deployment closeout:** document side-by-side source-build adoption,
   rollback,
   strict validation,
   and installed-root migration procedures.

### 9. Acceptance criteria and validation strategy

Planning and implementation are complete only when all of the following are true:

- The entity contract defines `redirect`,
  its allowed kinds,
  lifecycle rules,
  and graph invariants for every governed entity type.
- A losing record can remain intact and resolve through one or more redirects to one active canonical record.
- The resolver returns requested ID,
  canonical ID,
  and full chain without rewriting historical source records.
- Self-redirects,
  cycles,
  missing targets,
  type mismatches,
  illegal statuses,
  and inactive terminal records fail with actionable diagnostics.
- Compatibility validation reports legacy superseded records without guessing targets;
  strict validation rejects them.
- Consolidation is dry-run by default,
  explicit to apply,
  atomic for the canonical JSONL file,
  and idempotent for the same mapping.
- The derived index is rebuilt solely from canonical JSONL,
  contains both forward and reverse lookup projections,
  uses stable ordering,
  and is byte-identical across repeated builds from unchanged input.
- New ID-based references are canonicalized on write,
  while legacy references continue to resolve on read.
- Exact matching is automatic only for unique,
  approved,
  type-scoped identities;
  fuzzy or semantic matches remain review-only.
- Persona fixtures cover one-hop redirects,
  multi-hop redirects,
  a later winner replacement,
  ambiguous aliases,
  repeated extraction,
  and provenance preservation.
- Generic fixtures cover every current entity type and prove that cross-type redirects are rejected.
- Integration tests run the source-built binary against a copied legacy root in compatibility mode,
  apply an approved persona mapping,
  rebuild the index,
  pass strict validation,
  and demonstrate rollback from the untouched snapshot.
- Side-by-side tests prove that the new binary can be invoked explicitly without changing the installed binary,
  wrapper resolution,
  or installed data root.
- Failure-injection tests cover interrupted writes,
  invalid JSONL,
  unwritable roots,
  stale indexes,
  and a successful canonical write followed by a failed index rebuild.
- Documentation clearly separates source checkout,
  installed program files,
  and adopter-owned data,
  and it never instructs operators to copy the source `system/` tree over live data.

## Alternatives Considered

### Delete losing records

Rejected because deletion removes provenance,
breaks historical references,
and makes it impossible to explain how extracted records were consolidated.

### Rewrite every historical reference to the winner

Rejected as the primary strategy because bulk rewriting is risky,
produces large noisy diffs,
and erases the originally observed identity.
Targeted rewrites may be offered later as an explicit maintenance operation,
but resolution does not require them.

### Use the existing `related` field as the successor link

Rejected because `related` is undirected and semantically broad.
It cannot provide one canonical target or enforce acyclic resolution.

### Store all aliases only on the winner

Rejected as the sole model because it loses the independent source record,
its stable ID,
and its evidence.
Approved aliases may complement redirects for extraction matching,
but they do not replace losing records.

### Put redirects in a separate hand-maintained mapping file or database

Rejected because it would create a second canonical store and conflict with the plain-text,
JSONL-first architecture.
The resolution index is acceptable only because it is generated from entity records.

### Automatically merge high-similarity records

Rejected because similar personas,
requirements,
or capabilities may encode meaningful distinctions.
Probabilistic matching can prioritize review but cannot make the lifecycle decision.

### Edit deployed data before the feature exists

Rejected for contract-bearing mutations.
A read-only audit is useful now,
but adding ad hoc fields or manually rewriting references would create data that neither the old installation nor a validated new resolver can safely govern.

### Replace the installed Build OS directly with a source build

Rejected because binary provenance,
wrapper behavior,
and the installed data root may be ambiguous.
Side-by-side verification provides an observable rollback point and keeps binary deployment separate from data migration.

## Consequences

Build OS gains a durable consolidation primitive that preserves historical truth while making current identity deterministic.
Teams can curate a small canonical persona set without deleting extracted evidence,
and the same graph model can later serve other entity types.
Generated reverse membership makes it possible to answer which records were consolidated into a winner without duplicating mutable state on the winner.

Consumers must become redirect-aware.
During rollout,
old and new tooling can coexist only if old tooling does not write consolidated datasets.
Compatibility validation reduces migration risk but introduces a temporary two-mode contract that must be removed from normal operations once a root passes strict validation.

The resolver and validator require whole-graph checks rather than isolated row validation.
The new index adds a rebuild step whenever redirect-bearing records change.
Type-specific extraction matching also creates follow-on design and test work;
the generic redirect graph does not solve semantic identity by itself.

Source-built adoption remains an operator-managed procedure until Build OS has a clean upgrade mechanism.
The explicit-root,
dry-run,
snapshot,
and two-approval boundaries add friction,
but they prevent a source checkout or ambiguous binary from mutating live adopter data silently.

W1 R4 also establishes a small shared CLI and layout foundation earlier than the entity feature alone would require.
That additional boundary prevents a short-lived public binary from becoming a compatibility obligation,
but it leaves intake,
discovery,
and design as separately installed binaries until W1 R5 migration and package distribution are complete.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](../assets/prompts/designs-to-plan-change.prompt.md)
- Why: This design adds entity lifecycle,
  deterministic toolkit,
  extraction,
  validation,
  index,
  and deployment-migration behavior to the active Build OS baseline and PRD namespace.
- Coordinate Handoff: unresolved; planner must resolve before writing.
