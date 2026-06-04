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
- `minted`: list of minted or updated entity IDs
- `extracted_by`: tool, script, agent, or human identifier
- `extracted_at`: ISO 8601 UTC datetime

Optional fields:

- `dataset_refs`: list of dataset references produced or associated by the extraction

## Intended Follow-On (Next Step)

- Routers that need entity records should point here and to the relevant `.os/data/*.jsonl` files; they should not duplicate field tables or status vocabulary.
- Validators check envelopes, ID prefixes, status values, configured scope IDs, required `source_anchor` values, and `doc_anchor` presence for non-`draft` rows.
- Future generated indexes may derive from `.os/data/*.jsonl`, but generated indexes are not canonical records.

## Link Rules

- Use relative Markdown links in contracts and routers.
- Reference entity IDs in narrative docs when structured traceability is needed.
- Reference `system/docs/` for narrative authority and `.os/data/*.jsonl` for structured fields.
- Reference make-docs material read-only; never modify it from this contract.
