# Entity Consolidation Contract

## Purpose

Authority for non-destructive entity consolidation, terminal canonical resolution, reviewed mapping manifests, validation modes, and the disposable entity-resolution index.
The [entity records contract](entity-records-contract.md) remains authoritative for canonical row shape, lifecycle state, and redirect fields.

## Governed Inputs and Authority

- Canonical inputs are the eight entity JSONL datasets listed under Required Path in the [entity records contract](entity-records-contract.md): requirements, capabilities, personas, test cases, results, runs, findings, and extractions.
- All governed IDs share one graph namespace and must be unique across the complete loaded dataset set.
- `PB` identifiers may be referenced by entity records, but playbook Markdown remains governed by the [playbook contract](playbook-contract.md); no canonical playbook JSONL dataset participates in entity resolution version 1.
- `.os/indexes/entity-resolution.json` is a generated cache, never an authoritative input to consolidation.
- `.os/indexes/references.json` remains intake-owned and never contains entity redirects.
- Resolution and mutation operate on an explicit Build OS root. They do not infer a source checkout or installed root from the current directory.

## Terminal Resolution

For a requested entity ID, the resolver loads the complete graph and follows zero or more `redirect.target_id` edges until it reaches an active record.
A successful result has exactly this stable shape:

```json
{
  "requested_id": "PER-041",
  "canonical_id": "PER-003",
  "chain": ["PER-041", "PER-027", "PER-003"],
  "resolved": true
}
```

Field semantics:

| Field | Contract |
| --- | --- |
| `requested_id` | The exact ID supplied by the caller. |
| `canonical_id` | The terminal active ID. |
| `chain` | Ordered IDs from requested through every immediate successor to the terminal active ID, inclusive. |
| `resolved` | `true` when at least one redirect was followed; otherwise `false`. |

Zero-hop resolution of an active record returns the requested ID as the canonical ID, a one-element chain, and `resolved: false`.
Multi-hop resolution returns every visited ID exactly once and `resolved: true`.
A missing requested ID or invalid chain produces a diagnostic rather than a partial successful result.

Readers may preserve the requested or historically recorded ID for provenance, but must expose the canonical ID and complete chain when they act on it.
New references and intentional updates store the terminal canonical ID.
Historical references do not require a bulk rewrite.

## Reviewed Consolidation Manifest

A consolidation manifest is UTF-8 JSON with this version 1 shape:

```json
{
  "version": 1,
  "mappings": [
    {
      "source_id": "PER-041",
      "target_id": "PER-003",
      "kind": "duplicate",
      "decided_at": "2026-07-21T15:30:00Z",
      "decided_by": "product-research",
      "reason": "The reviewed records represent the same administrator persona.",
      "evidence_refs": [
        "system/docs/research/personas.md#review"
      ]
    }
  ]
}
```

Manifest rules:

- `version` is the integer `1`.
- `mappings` is a non-empty list sorted lexically by `source_id` in canonical examples and generated plans.
- Each mapping contains exactly the fields shown above.
  Redirect field values follow the redirect-object rules in the entity records contract.
- `source_id` occurs at most once in one manifest.
- Source and target are immediate graph neighbors, not merely the current terminal pair.
- The manifest is root-independent and must not contain a source checkout path, installed root, or implicit target root.
- A manifest is reviewed input, not authority by itself.
  Authority changes only when a validated apply operation updates the source row atomically.
- Before any write, the complete current graph plus every proposed mapping is validated as one prospective graph.
- Replaying a mapping whose source already redirects to the same immediate target is a no-op; the existing redirect metadata is retained.
- A different immediate target is `redirect_remap_conflict`, even when both targets currently resolve to the same terminal ID.
  The consolidation operation must not overwrite it implicitly.
- A manifest must not create, delete, or rewrite winners, historical references, unrelated rows, or losing-record fields other than `status`, `redirect`, and `updated_at`.
- Mutation is dry-run by default and requires explicit apply authorization outside the manifest.

## Derived Resolution Index

The generated path is `.os/indexes/entity-resolution.json` under the resolved Build OS root.
Version 1 has exactly this shape:

```json
{
  "version": 1,
  "canonical_by_id": {
    "PER-027": "PER-003",
    "PER-041": "PER-003"
  },
  "members_by_canonical": {
    "PER-003": [
      "PER-027",
      "PER-041"
    ]
  }
}
```

Index rules:

- `canonical_by_id` contains every non-terminal governed ID and maps it directly to its terminal active ID.
  Zero-hop active IDs are omitted.
- `members_by_canonical` contains every active terminal with at least one redirected member.
  Member lists contain non-terminal IDs only; they exclude the canonical ID.
- Object keys and member lists use ascending lexical byte order.
- Canonical serialization is UTF-8 JSON, two-space indentation, no trailing spaces, and one final newline.
- A rebuild reads only canonical JSONL, validates the complete graph, and does not use the prior index as an input.
- Two builds from byte-identical canonical inputs must be byte-identical.
- The index may be deleted and rebuilt at any time.
  Canonical JSONL remains authoritative when the index is absent, stale, malformed, or non-reproducible.

## Validation Modes

Both modes validate JSONL shape, global ID uniqueness, redirect field shape, status legality, target existence, non-self edges, same-type edges, acyclic chains, and active terminals.
Neither mode guesses successors or accepts a known-bad graph.

Compatibility mode has one graph exception: a legacy `superseded` row without `redirect` produces `legacy_missing_redirect` as a warning.
That row is excluded from automatic resolution.
Any newly written or changed superseded row must satisfy strict rules even while the root is assessed in compatibility mode.
A missing, stale, malformed, or non-canonically serialized index is a compatibility warning because canonical JSONL remains readable and rebuildable.

Strict mode treats every superseded row without a valid redirect as an error.
It also treats a missing, stale, malformed, or non-reproducible index as an error.
Strict mode is the release and post-migration gate.

## Actionable Diagnostics

Every diagnostic includes a stable code, severity, message, source dataset and line when known, the affected entity ID, relevant target or chain values, and one exact corrective action or recovery command.
Validation fails closed on errors and must not emit a partial successful resolution or index.

Required diagnostic codes:

| Code | Condition | Required action context |
| --- | --- | --- |
| `legacy_missing_redirect` | Superseded row has no redirect. | Identify the row and require a reviewed successor; warning only in compatibility mode. |
| `redirect_missing_target` | Target ID is absent. | Name the missing target and source. |
| `redirect_self` | Source targets itself. | Name the source and require a different same-type target. |
| `redirect_cross_type` | Source and target types differ. | Show both types and direct the operator to use `related` for non-canonical cross-type links. |
| `redirect_cycle` | Redirect traversal repeats an ID. | Include the complete closed cycle. |
| `redirect_inactive_terminal` | A chain terminates at `draft`, `archived`, or otherwise non-active record. | Include the chain and terminal status. |
| `redirect_illegal_status` | A non-superseded row carries redirect, or a changed superseded row lacks one. | Name the illegal status/redirect combination. |
| `duplicate_id` | One ID occurs more than once anywhere in governed inputs. | Report every dataset and line containing the ID. |
| `redirect_remap_conflict` | An applied source already targets a different immediate successor. | Show existing and requested targets and require separate review. |
| `index_stale` | Index content differs from a canonical rebuild or is missing after redirects exist. | Provide the exact rebuild-check or rebuild-apply command. |
| `index_non_reproducible` | Semantically equivalent index output is not in canonical byte order/format, or repeated builds differ. | Identify the ordering or serialization mismatch and provide the rebuild command. |

Malformed redirect objects or manifests use an input-contract diagnostic that names the invalid field and expected form before graph validation proceeds.

## Fixtures

The compact fixture corpus in [examples/entity-resolution/](examples/entity-resolution/) is normative test input for these semantics.
Valid rows deliberately retain type-specific and unknown extension fields.
Invalid cases isolate missing targets, self redirects, cross-type redirects, cycles, inactive terminals, illegal redirect statuses, duplicate IDs, remap conflicts, legacy missing redirects, and stale or non-reproducible indexes.

## Link Rules

- Use relative Markdown links in contracts and examples.
- Reference `.os/data/*.jsonl` for canonical structured authority and `.os/indexes/entity-resolution.json` only as a derived cache.
- Do not place entity redirects in `references.json`.
