# Run Record Contract

## Purpose

Authority for run records produced by active procedure playbooks and discovery work. A run record
captures what was attempted, the immutable evidence gathered, the raw findings observed during the
run, and the structured index fields needed to find the run later.

Routers may point to this contract, but they do not redefine run shape or lifecycle.

## Required Path

- Run directory: `system/workspace/runs/<RUN-NNN>/`
- Run summary record: `system/workspace/runs/<RUN-NNN>/run.md`
- Evidence directory: `system/workspace/runs/<RUN-NNN>/evidence/`
- Raw findings record: `system/workspace/runs/<RUN-NNN>/raw-findings.md`
- Runs index: `.os/data/runs.jsonl` in the active operating layer. In this repository layout, that
  is `system/.os/data/runs.jsonl`.

`<RUN-NNN>` uses the `RUN` per-type prefix and a zero-padded sequence.

## Required Shape

Each run directory contains immutable artifacts for a single execution or investigation.

| Artifact | Required | Notes |
| --- | --- | --- |
| `run.md` | yes | Human-readable summary of the run, scope, operator, timestamps, commands/procedure followed, outcome, and follow-on links. |
| `evidence/` | yes | Raw evidence files captured during the run, such as screenshots, logs, command output, transcripts, exported data, or notes. Evidence is immutable once the run closes. |
| `raw-findings.md` | yes | Raw observations from the run. Raw findings are unqualified and remain anchored to this run until promoted through the finding contract. |

`run.md` must identify:

| Field | Values / form | Notes |
| --- | --- | --- |
| `id` | `RUN-NNN` | Matches the run directory. |
| `title` | string | Concise run label. |
| `status` | `running` \| `closed` \| `aborted` | `closed` and `aborted` records are immutable. |
| `outcome` | `positive` \| `negative` \| `inconclusive` | Required when the run closes. |
| `playbook_id` | `PB-NNN` \| null | Required when the run came from a playbook. |
| `systems` | list of configured `systems[].id` values | Use configured IDs from the config contract. |
| `environments` | list of configured `environments[].id` values | Use configured IDs from the config contract. |
| `owners` | list of configured `owners[].id` values | Empty when ownership is not applicable. |
| `started_at` | ISO 8601 timestamp | Run start. |
| `ended_at` | ISO 8601 timestamp \| null | Required when status is `closed` or `aborted`. |
| `evidence` | list of relative paths | Paths under this run directory, normally inside `evidence/`. |
| `raw_findings` | list of local anchors | Anchors in `raw-findings.md`; no `FIND` ID until qualified. |
| `qualified_findings` | list of `FIND-NNN` IDs | Filled only after qualification promotes a raw finding. |
| `related` | list of links / ids | Requirements, capabilities, test cases, results, designs, or other runs. |

## Runs Index Fields

`.os/data/runs.jsonl` is the structured run index. Each line represents one run and must include:

| Field | Values / form | Notes |
| --- | --- | --- |
| `id` | `RUN-NNN` | Unique run ID. |
| `path` | relative path | `system/workspace/runs/<RUN-NNN>/`. |
| `title` | string | Mirrors `run.md`. |
| `status` | `running` \| `closed` \| `aborted` | Mirrors `run.md`. |
| `outcome` | `positive` \| `negative` \| `inconclusive` | Required for closed or aborted runs. |
| `playbook_id` | `PB-NNN` \| null | Source playbook, if any. |
| `systems` | list of configured `systems[].id` values | Mirrors run scope. |
| `environments` | list of configured `environments[].id` values | Mirrors run scope. |
| `owners` | list of configured `owners[].id` values | Mirrors run scope. |
| `started_at` | ISO 8601 timestamp | Mirrors `run.md`. |
| `ended_at` | ISO 8601 timestamp \| null | Mirrors `run.md`. |
| `evidence_count` | integer | Count of evidence artifacts recorded for the run. |
| `raw_finding_count` | integer | Count of raw finding anchors in `raw-findings.md`. |
| `qualified_findings` | list of `FIND-NNN` IDs | Qualified findings promoted from this run. |
| `related` | list of links / ids | Cross-reference surface for discovery. |

The index is for discovery and routing. The run directory remains the authority for run evidence and
raw observations.

## Lifecycle

`running -> closed` or `running -> aborted`.

During `running`, the run may accumulate evidence and raw findings. On `closed` or `aborted`, the
run sets `outcome` to `positive`, `negative`, or `inconclusive`, records `ended_at`, and freezes the
run artifacts.

Do not rewrite closed run evidence to improve a later narrative. Add a new run, promote a finding,
or link a follow-on artifact instead.

## Intended Follow-On (Next Step)

Raw findings observed during a run remain in `raw-findings.md` until a deterministic repeatable
confirmation test qualifies them. Qualified findings move to `system/workspace/findings/<FIND-NNN>/`
under the finding contract.

Qualified findings may then hand off to `system/docs/designs/` through the make-docs design router.

## Link Rules

- Use relative Markdown links.
- Link from `run.md` to evidence artifacts and raw finding anchors in the same run directory.
- Link from raw finding anchors to qualified `FIND-NNN` records only after qualification.
- Reference make-docs material read-only; never modify make-docs-managed files from this contract.
