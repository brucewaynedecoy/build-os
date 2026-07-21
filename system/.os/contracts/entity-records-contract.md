# Entity Records Contract

## Purpose

Authority for structured entity records under `.os/data/*.jsonl`. Entity records provide stable IDs and machine-readable fields for requirements, capabilities, personas, tests, results, runs, findings, extractions, and playbook references.

Contracts own record shape and vocabulary. Routers stay thin: they route humans and agents to this contract instead of restating schema details.

Narrative remains canonical in `system/docs/`. Narrative documents reference entity IDs when they need structured traceability, but `.os/data/*.jsonl` is canonical for structured fields.

Authority note: `capability` = descriptive, `requirement` = normative, and `finding` = empirical.

## Required Path

- Canonical structured records: `.os/data/*.jsonl`
- Repository location in this checkout: `system/.os/data/*.jsonl`.
- Canonical file set:
  - `requirements.jsonl` -> `requirement`
  - `capabilities.jsonl` -> `capability`
  - `personas.jsonl` -> `persona`
  - `test-cases.jsonl` -> `test-case`
  - `results.jsonl` -> `result`
  - `runs.jsonl` -> `run`
  - `findings.jsonl` -> `finding`
  - `extractions.jsonl` -> `extraction`
- Each file must be NDJSON/JSONL only: one complete JSON object per line.
- Files must not be JSON arrays, YAML, Markdown tables, generated indexes, or runtime output logs.
- Generated indexes are not canonical records.

## Common Envelope

Every entity record must contain these fields:

| Field | Values / form | Notes |
| --- | --- | --- |
| `id` | `<PREFIX>-NNN` | Stable ID using a registered prefix. |
| `type` | registered type slug | Must match the record kind. |
| `title` | string | Human-readable label. |
| `status` | status vocabulary value | See Status Vocabulary. |
| `summary` | string | Concise structured summary; narrative detail belongs in `system/docs/`. |
| `source_anchor` | `path#anchor` | Required source evidence anchor for the structured row. |
| `doc_anchor` | `system/docs/<path>.md#<anchor>` or null/omitted for `draft` | Required once the row is no longer `draft`. |
| `source_refs` | list of strings | `path#anchor` or entity IDs that support the record. |
| `related` | list of entity IDs | Cross-links to other entity records. |
| `created_at` | ISO 8601 date or datetime or null | Populate when known. |
| `updated_at` | ISO 8601 date or datetime or null | Populate when the record changes. |

Optional shared fields:

| Field | Values / form | Notes |
| --- | --- | --- |
| `systems` | list of configured `systems[].id` values | Use configured IDs from `config/instance.yaml`. |
| `environments` | list of configured `environments[].id` values | Explicit list; do not use sentinel values. |
| `owners` | list of configured `owners[].id` values | Empty only when ownership is not applicable. |
| `tags` | list of lowercase slugs | Classification only; do not encode status. |

Conditionally required shared field:

| Field | Values / form | Notes |
| --- | --- | --- |
| `redirect` | redirect object | Required on every newly written or changed `superseded` row. Forbidden on `draft`, `active`, and `archived` rows. See Redirect Object and the [entity consolidation contract](entity-consolidation-contract.md). |

Unknown and type-specific fields are part of the canonical row.
A reader or writer that changes a common-envelope field must preserve every field it does not own byte-for-byte where practical and value-for-value in all cases.

## ID Prefix Registry

| Prefix | Type | Meaning |
| --- | --- | --- |
| `REQ` | `requirement` | Normative requirement. |
| `CAP` | `capability` | Descriptive capability. |
| `PER` | `persona` | User, actor, or stakeholder profile. |
| `TC` | `test-case` | Test case or verification scenario. |
| `RES` | `result` | Test, validation, or evaluation result. |
| `RUN` | `run` | Execution run or harness invocation. |
| `FIND` | `finding` | Empirical observation or conclusion. |
| `EXT` | `extraction` | Extracted source fact or normalized input. |
| `PB` | `playbook` | Playbook record or playbook reference. |

IDs are flat per type. Prefixes must not encode system, environment, owner, status, directory, or phase.

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `draft` | Proposed and not yet accepted. |
| `active` | Accepted for current use. |
| `superseded` | Replaced by another record. |
| `archived` | Retained for history; not current. |

Status is lifecycle state only. Do not use status values to express pass/fail, severity, priority, or confidence.

Lifecycle and successor rules:

- `draft` is pending and has no canonical successor, so it must not contain `redirect`.
- `active` is a possible terminal canonical record and must not contain `redirect`.
- `superseded` has an intentional successor.
  Every newly written or changed superseded row must contain exactly one valid `redirect` object.
- `archived` is retained without a current successor and must not contain `redirect`.
  Do not use `archived` as a synonym for `superseded`.
- Compatibility mode may read a legacy superseded row without `redirect` only under the warning rules in the [entity consolidation contract](entity-consolidation-contract.md).
  It never guesses that row's successor.

## Redirect Object

`redirect` records a reviewed, directed decision from a losing record to its immediate successor.
It is canonical data on the losing record.
It is not an inferred alias, a `related` edge, or a generated reverse-membership list.

The object contains exactly these fields:

| Field | Values / form | Meaning |
| --- | --- | --- |
| `target_id` | registered entity ID | Stable ID of the immediate successor. |
| `kind` | `duplicate`, `consolidated`, or `replaced` | Reviewed relationship kind. |
| `decided_at` | ISO 8601 UTC datetime | Time of the reviewed decision. |
| `decided_by` | non-empty owner, team, agent, or human identifier | Party responsible for the decision. |
| `reason` | non-empty string | Concise explanation of why the source is no longer canonical. |
| `evidence_refs` | list of entity IDs or `path#anchor` strings | Supporting evidence. The list may be empty only when no evidence exists. |

The allowed kinds mean:

- `duplicate`: source and target represent the same identity or concept.
- `consolidated`: overlapping records were intentionally combined into a broader canonical record.
- `replaced`: the source is obsolete and has an intentional successor without being a duplicate.

Every redirect graph must satisfy all of these invariants:

- source and target IDs exist and differ;
- source and target have the same registered entity type;
- every edge begins at a `superseded` record;
- no `draft`, `active`, or `archived` record carries a redirect;
- every chain is acyclic and terminates at exactly one `active` record;
- an intermediate target may later become superseded, provided its full chain still terminates at one active record;
- losing records retain their stable IDs, anchors, evidence, and all type-specific or unknown fields;
- reverse membership is derived from redirects and is never hand-maintained on the winner;
- `related` remains a non-canonical relationship and never participates in resolution.

Applying the same source-to-immediate-target mapping again is an idempotent no-op and preserves the existing redirect decision metadata.
Attempting to map an already redirected source to a different immediate target is a remap conflict.
It must fail closed and requires a separate, explicit reviewed change; consolidation must never overwrite the earlier decision implicitly.

## Per-Type Records

`requirement` records are normative: they define expected system behavior or constraints.

Required fields:

- `id`: `REQ-NNN`
- `type`: `requirement`
- `statement`: normative requirement text
- `rationale`: why the requirement exists
- `acceptance_refs`: list of `TC`, `RES`, `FIND`, or `system/docs/` references

`capability` records are descriptive: they describe what a system or process can do without creating new normative obligations.

Required fields:

- `id`: `CAP-NNN`
- `type`: `capability`
- `description`: capability description
- `supports`: list of related `REQ` IDs or narrative references
- `limits`: list of known limitations or empty list

`persona` records describe actors or stakeholder profiles used by requirements, tests, and narrative docs.

Required fields:

- `id`: `PER-NNN`
- `type`: `persona`
- `description`: persona description
- `goals`: list of goals
- `needs`: list of needs or constraints

Optional persona `identity` and `aliases` fields are governed by the [persona identity contract](persona-identity-contract.md).
The generic redirect graph does not infer a successor from either field.

`test-case` records define repeatable verification scenarios.

Required fields:

- `id`: `TC-NNN`
- `type`: `test-case`
- `verifies`: list of `REQ` or `CAP` IDs
- `preconditions`: list of required setup conditions
- `steps`: list of test steps
- `expected`: expected signal or outcome

`result` records capture outcomes from test cases, validation, evaluation, or review.

Required fields:

- `id`: `RES-NNN`
- `type`: `result`
- `target_id`: `TC`, `REQ`, `CAP`, `RUN`, or `FIND` ID
- `outcome`: `pass`, `fail`, `blocked`, or `inconclusive`
- `evidence_refs`: list of `RUN`, `FIND`, file, or `system/docs/` references

`run` records describe a discrete execution or harness invocation.

Required fields:

- `id`: `RUN-NNN`
- `type`: `run`
- `playbook_id`: `PB-NNN` or null
- `started_at`: ISO 8601 date or datetime
- `ended_at`: ISO 8601 date or datetime or null
- `inputs`: object
- `outputs`: object or list of references

`finding` records are empirical: they capture observed evidence, analysis, or conclusions from a run, test, review, or source inspection.

Required fields:

- `id`: `FIND-NNN`
- `type`: `finding`
- `observed`: empirical observation
- `basis_refs`: list of `RUN`, `RES`, `EXT`, file, or `system/docs/` references
- `confidence`: `low`, `medium`, or `high`
- `implications`: list of related `REQ`, `CAP`, `TC`, or narrative references

`extraction` records capture normalized facts pulled from source material before promotion into requirements, capabilities, findings, tests, or narrative docs.

Required fields:

- `id`: `EXT-NNN`
- `type`: `extraction`
- `source_anchor`: converted source anchor used for extraction
- `minted`: list of new canonical entity IDs created by this extraction
- `extracted_by`: tool, script, agent, or human identifier
- `extracted_at`: ISO 8601 UTC datetime

Conditionally required outcome fields for new outcome-aware rows:

- `outcome_contract`: `extraction-outcomes-v1`
- `referenced`: list of existing terminal canonical entity IDs reused without changing their canonical rows
- `updated`: list of existing terminal canonical entity IDs deliberately changed by this extraction

When `outcome_contract` is present, `minted`, `referenced`, and `updated` are all required, including empty lists, and an ID occurs in at most one list.
Resolution alone is not an update.
The [extraction contract](extraction-contract.md) owns the complete outcome and ordering rules.

Rows created before `extraction-outcomes-v1` may omit `outcome_contract`, `referenced`, and `updated`.
Their historical `minted` values retain the former "minted or updated" meaning.
Validators and migrations must not infer a more specific legacy outcome or rewrite those rows without reviewed source evidence.

Optional field:

- `dataset_refs`: list of dataset references produced or associated by the extraction

## Intended Follow-On (Next Step)

- Routers that need entity records should point here and to the relevant `.os/data/*.jsonl` files; they should not duplicate field tables or status vocabulary.
- Validators check envelopes, ID prefixes, status values, configured scope IDs, required `source_anchor` values, and `doc_anchor` presence for non-`draft` rows.
- The [entity consolidation contract](entity-consolidation-contract.md) defines terminal resolution, reviewed manifests, compatibility and strict validation, and the generated entity-resolution index.
- Generated indexes may derive from `.os/data/*.jsonl`, but generated indexes are not canonical records.

## Link Rules

- Use relative Markdown links in contracts and routers.
- Reference entity IDs in narrative docs when structured traceability is needed.
- Reference `system/docs/` for narrative authority and `.os/data/*.jsonl` for structured fields.
- Reference make-docs material read-only; never modify it from this contract.
