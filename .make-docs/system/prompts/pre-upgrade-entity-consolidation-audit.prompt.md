___
name: Pre-Upgrade Entity Consolidation Audit
description: Instructs a local coding agent to inventory and propose non-destructive entity consolidation before compatible canonical resolution support is deployed.
___

Please perform a read-only entity consolidation audit in an environment where BuildOS is already installed.
The goal is to prepare safe, reviewable duplicate proposals that can later feed compatible migration tooling after canonical entity resolution is implemented and deployed.

Replace or confirm every placeholder before starting:

- Installed BuildOS root: `{{INSTALLED_BUILDOS_ROOT}}`
- BuildOS source clone root, or `NOT_CLONED_YET`: `{{SOURCE_CLONE_ROOT}}`
- Adopter workspace root containing live project data: `{{WORKSPACE_ROOT}}`
- Review output root: `{{REVIEW_OUTPUT_ROOT}}`
- Audit run ID, such as `2026-07-21-personas-01`: `{{RUN_ID}}`
- Entity types in scope, starting with `persona`: `{{ENTITY_TYPES}}`
- User-approved metadata-only edits, normally `NONE`: `{{APPROVED_METADATA_ONLY_CHANGES}}`

Use a review path outside every canonical JSONL data directory.
Prefer a user-selected path such as `{{WORKSPACE_ROOT}}/review/entity-consolidation/{{RUN_ID}}/` when that does not conflict with local instructions.
Do not continue if the installed root, source clone, workspace root, or review output root cannot be distinguished unambiguously.

## Non-Negotiable Safety Rules

- Begin with read-only discovery.
- Treat the installed BuildOS root, the BuildOS source clone, and the adopter workspace as separate locations with separate authority and version state.
- Read all applicable `AGENTS.md`, local agent instructions, manifests, entity contracts, schemas, and validation documentation before interpreting or writing data.
- Never delete, truncate, replace, or silently rewrite a canonical record.
- Never invent a `redirect`, `canonical_id`, `superseded_by`, alias, or similar field that the installed contract does not support.
- Do not change a record to `superseded` until a compatible resolver and validator are deployed and the current contract defines the required successor relationship.
- Do not edit generated indexes as though they were authoritative data.
- Do not normalize IDs or rewrite historical references merely to make the audit look clean.
- Do not infer that two records are duplicates solely from fuzzy or semantic similarity.
- Do not mutate canonical data unless the user explicitly approves the exact changes and the installed contract already supports them.
- Preserve unrelated work and dirty-worktree state.
- Do not reset, clean, stash, revert, overwrite, or publish changes.

The default outcome of this prompt is review artifacts only.
If any safety rule conflicts with local instructions, stop and report the conflict without changing canonical data.

## Phase 1: Establish the Live Authority Surfaces

Perform this phase without modifying canonical data.

1. Resolve the real paths for the installed BuildOS root, source clone, and adopter workspace.
2. Record the installed version or revision when discoverable, the source clone revision when present, and the current workspace revision or non-Git status.
3. Read the applicable instruction files from the workspace root downward to each data and output location.
4. Inspect the installed entity-record contract, schemas, manifests, canonical data declarations, derived-index declarations, and validation entry points.
5. Inspect the source clone separately when it exists.
   Do not assume its contracts match the installed environment.
6. Identify which files are canonical JSONL records, which are derived indexes, and which are prose or other references.
7. Discover the repository-native validation commands from local documentation and manifests rather than guessing commands.
8. Run the existing validators in read-only mode and preserve their exact commands, output, exit status, and timestamp in the review output.
9. Capture a baseline inventory and cryptographic checksums for every in-scope canonical file before considering any approved edit.

Document uncertainties instead of resolving them by assumption.
If the current validation baseline already fails, preserve that evidence and distinguish pre-existing failures from audit findings.

## Phase 2: Build a Record and Reference Inventory

Inventory all records for `{{ENTITY_TYPES}}`, with personas first unless the user specifies another order.
Do not write inferred fields back to the records.

For each record, capture at least:

- canonical file path and line number;
- stable record ID and entity type;
- title or display name;
- current lifecycle status;
- source and provenance references;
- explicit aliases or identity keys that the installed contract actually defines;
- normalized comparison values computed only in the review artifact;
- inbound references from other canonical records;
- references from non-canonical documents or assets when discoverable;
- whether any derived index points to the record;
- validation warnings or malformed-data concerns.

Preserve the original value beside every normalized comparison value.
Do not treat generated indexes as the only source of inbound-reference truth.

Create a reference inventory that distinguishes:

- direct stable-ID references;
- exact approved-alias or exact normalized identity-key references;
- prose mentions with no stable ID;
- ambiguous or fuzzy matches requiring human review;
- references that cannot be resolved safely.

## Phase 3: Propose Persona Duplicate Groups

Build duplicate candidate groups without changing any source record.

Use two separate evidence classes:

1. **Exact identity evidence** includes the same stable external key, an exact contract-defined alias, or an exact normalized identity key supported by strong provenance.
2. **Fuzzy similarity evidence** includes similar names, overlapping descriptions, semantic resemblance, or shared attributes without an exact identity key.

Exact identity evidence may justify a high-confidence proposal, but it still requires human approval.
Fuzzy similarity may create a candidate group only and must never trigger an automatic merge, lifecycle change, or reference rewrite.

For every candidate group, propose one winner and zero or more losers.
Base the proposal on evidence such as provenance quality, completeness, stability of ID, number and quality of inbound references, current lifecycle state, recency, and explicit team decisions.
Do not select a winner merely because it has the lowest ID or appears first.

For each proposed winner and loser, record:

- the evidence supporting common identity;
- evidence against consolidation or meaningful differences;
- the proposed winner and rationale;
- every proposed loser and rationale;
- confidence as `high`, `medium`, or `low`;
- evidence class as `exact_identity`, `fuzzy_similarity`, or `mixed`;
- affected inbound references;
- unresolved questions;
- required human reviewer or decision owner;
- proposed action as `consolidate_after_upgrade`, `keep_distinct`, or `needs_review`.

When the evidence is incomplete, prefer `needs_review`.

## Phase 4: Write Durable Review Artifacts

Write only beneath `{{REVIEW_OUTPUT_ROOT}}` unless the user approves another non-canonical output location.
Do not place audit outputs in the installed BuildOS root, the source clone, or a canonical JSONL data directory merely for convenience.

Produce:

- `README.md` with scope, paths, versions, safety constraints, and how to review the run;
- `baseline-validation.md` with commands, timestamps, exit statuses, and pre-existing failures;
- `entity-inventory.jsonl` with one inventory row per record;
- `reference-inventory.jsonl` with one row per discovered inbound or ambiguous reference;
- `persona-candidate-groups.md` for human review;
- `consolidation-proposals.json` using the machine-readable contract below;
- `upgrade-handoff.md` describing the rebuild-from-source and post-upgrade compatibility gates;
- `checksums.txt` covering the in-scope canonical files as observed before any approved edit.

The proposal manifest is an audit artifact, not a canonical entity contract.
Use this minimum structure:

```json
{
  "schema_version": "buildos-entity-consolidation-proposal/v1",
  "run_id": "{{RUN_ID}}",
  "created_at": "<RFC-3339 timestamp>",
  "environment": {
    "installed_root": "{{INSTALLED_BUILDOS_ROOT}}",
    "installed_version": "<observed version or unknown>",
    "source_clone_root": "{{SOURCE_CLONE_ROOT}}",
    "source_revision": "<observed revision, NOT_CLONED_YET, or unknown>",
    "workspace_root": "{{WORKSPACE_ROOT}}"
  },
  "contract_observed": {
    "path": "<installed contract path>",
    "checksum": "<checksum>",
    "supports_canonical_resolution": false
  },
  "proposals": [
    {
      "proposal_id": "EC-0001",
      "entity_type": "persona",
      "winner_id": "<proposed winner ID>",
      "loser_ids": ["<proposed loser ID>"],
      "evidence_class": "exact_identity",
      "confidence": "high",
      "proposed_action": "consolidate_after_upgrade",
      "evidence": [
        {
          "kind": "<identity_key, alias, provenance, attribute, reference, or similarity>",
          "source": "<project-relative path and line, record ID, or asset reference>",
          "summary": "<concise evidence summary>"
        }
      ],
      "counter_evidence": [],
      "affected_references": [
        {
          "source": "<project-relative path and line or record ID>",
          "reference_kind": "stable_id",
          "observed_value": "<original value>"
        }
      ],
      "open_questions": [],
      "review": {
        "status": "pending",
        "reviewer": null,
        "reviewed_at": null,
        "notes": null
      }
    }
  ]
}
```

Keep proposal IDs stable within the audit run.
Use project-relative locations inside evidence when possible, and document any unavoidable absolute-path exception.
Do not encode an approved migration merely because a proposal has high confidence.

## Phase 5: Mutation Gate

Stop after producing and validating the review artifacts unless the user explicitly approves a precise set of metadata-only edits.

Before any approved metadata-only edit:

1. Confirm that the exact field and value are supported by the installed contract and validator.
2. Re-run and preserve the existing validation baseline.
3. Create a recoverable, timestamped snapshot or backup of every exact file that would change.
4. Record checksums before the edit and the restore procedure.
5. Show the proposed diff and obtain explicit user approval for that diff.

After an approved edit, rerun the same validators, capture new checksums, and report the precise diff.
If validation worsens, stop and restore only with explicit user approval.

Even with approval, do not delete records, set records to `superseded`, add unsupported redirect fields, rewrite historical references, or hand-edit derived indexes before compatible canonical-resolution support is deployed.

## Phase 6: Rebuild-from-Source and Upgrade Handoff

Prepare `upgrade-handoff.md` so a later agent can safely use the source clone while an older BuildOS installation remains present.
Include:

- installed root, installed version, and observed contract checksum;
- source clone root, branch, revision, dirty state, and build instructions discovered from that clone;
- explicit warning not to overlay or confuse source files with installed live data;
- canonical data paths and their pre-audit checksums;
- review artifact location and proposal-manifest checksum;
- unresolved candidate decisions and reviewer status;
- a compatibility gate requiring the rebuilt version to define redirect semantics, canonical resolution, cycle and missing-target validation, and migration behavior before applying proposals;
- a dry-run migration requirement with an exact diff and resolver output for every proposed loser;
- post-upgrade validation and rollback expectations;
- a reminder that rebuilding from source does not itself authorize migration of live data.

Do not perform the rebuild, install, upgrade, or migration unless the user separately requests and authorizes it.

## Final Report

Report:

- the installed, source, workspace, and review-output paths used;
- contracts and instructions consulted;
- canonical files inventoried and record counts by entity type and status;
- reference counts by exact, prose, fuzzy, and unresolved class;
- candidate-group counts by confidence and proposed action;
- baseline validation results and pre-existing failures;
- review artifact paths and checksums;
- whether any canonical file changed;
- any approved metadata-only edits and their before/after validation;
- blockers that must be resolved before rebuild, deployment, or migration.

End with an explicit statement that either canonical data remained unchanged or list every canonical file changed with the approval that authorized it.
