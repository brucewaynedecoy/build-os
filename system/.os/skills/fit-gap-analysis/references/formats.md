# Formats, Verdicts and Scores

Every file is UTF-8 JSON. Relative paths in `frame.json` resolve against the folder that holds `frame.json`.

## frame.json

```json
{
  "title": "Current Circulation System to Candidate Library Platform",
  "mode": "replacement",
  "baseline": {"model": "../../../deliver/CIRC/circ-capability-model.json"},
  "target": {"model": "../../../deliver/LIB/lib-capability-model.json"},
  "prior_fit_gap": "../../../deliver/fit-gap/circ-lib-fit-gap.json",
  "objectives": [
    {"id": "OBJ-01", "name": "Keep circulation desk operations running", "weight": "must",
     "statement": "Staff can register patrons, place holds, check out and check in books with no loss of function.",
     "measure": "No built circulation desk capability is lost", "source": "docs/charter.md, Goals"}
  ],
  "objectives_confirmed_by": "Library Director",
  "scoring": {}
}
```

| Field | Notes |
| --- | --- |
| `mode` | `replacement` (the system in use today against a candidate) or `selection` (a requirements baseline against one candidate; run once per candidate) |
| `baseline`, `target` | `{"model": path}` for a capability-matrix model JSON. For an older run with CSVs only: `{"capabilities_csv", "requirements_csv", "code", "name", "maturity_map"}`. `maturity_map` maps each status to `proven`, `available`, `partial`, `planned` or `deferred`; it is needed only when the CSVs have no `maturity` column. |
| `prior_fit_gap` | Optional. A capability-matrix fit/gap JSON or CSV. Its verdict, evidence and target ids go into each package as `prior`. Its verdicts use capability-matrix words: its `preview_gap` is close to this skill's `unreleased`. |
| `objectives` | `id` is `OBJ-NN`. `weight` is `must`, `should` or `could`. `name` and `statement` are required. `measure` and `source` are expected. Optional `rank` (a number, 1 = most important) breaks priority ties and orders the objective views. |
| `objectives_confirmed_by` | The name of the person who confirmed the objectives and weights. The final `merge` refuses to run while it is empty. |
| `tracks` | Optional delivery plan: `[{"id", "name", "order", "timing", "description"}]`. When present, every scored row needs a `track` and `owners`, and the final `merge` needs a to-do list. |
| `owners` | The parties that own work, for example `["Library Staff", "Platform Vendor", "Volunteer Team"]`. Use the names in `owners[].name` of `.os/config/instance.yaml` when the project config lists the parties. Required with `tracks`. |
| `owner_roles` | Optional `{owner: what they are responsible for}`, shown on the Read Me sheet. |
| `owner_colors` | Optional `{owner: {"fill": "RRGGBB", "font": "RRGGBB"}}` for the Owner column of the To-Dos sheet. An owner it leaves out takes the next color of the neutral palette in `config/owner-colors.json`, in owner order. BuildOS holds no owner name and no owner color. |
| `scoring` | Optional overrides of any value in [Scores](#scores), for example `{"mark_points": {"partly": 40}}`. |

## Scored Rows (`scored/pkg-NN.json`)

A JSON array, one object per baseline capability in the package, in the order given.

```json
{
  "baseline_capability_id": "CFG-05",
  "objective_ids": ["OBJ-02"],
  "confidence": "medium",
  "effort": "medium",
  "marks": [
    {"requirement_id": "CFG-05-R01", "mark": "not_met", "target_capability_ids": [],
     "note": "Searched 'auto-renew', 'renewal rule', 'renew'. LIB-VAL-04 has no toggle."},
    {"requirement_id": "CFG-05-R02", "mark": "configured", "target_capability_ids": ["LIB-VAL-03", "LIB-VAL-04"],
     "note": "Set per collection type through the loan policy profile, not as a library-wide default."}
  ],
  "evidence": "Two to four sentences naming the target capabilities and mechanisms that decide the verdict.",
  "gap_detail": "What is missing, in baseline terms, with requirement ids.",
  "migration_note": "What the organisation would do: configure X, accept a process change, wait for GA, build, descope."
}
```

Rules that `merge` checks:

- Every requirement of the capability has exactly one mark. A capability with no requirements of its own gets one requirement, `<capability_id>-WHOLE`, to mark as a whole.
- `mark` is one of `met`, `configured`, `partly`, `unreleased`, `not_met`, `descoped`.
- `met`, `configured` and `partly` cite at least one target capability id. `not_met` and `descoped` cite none. `unreleased` may cite the roadmap capability that names it.
- Every mark except `met` has a note of at least 15 characters: what is configured, what is missing, where it is named as coming, where you looked, or for `descoped` the decision that removed it.
- `evidence` is at least 80 characters. `migration_note` is not empty. `gap_detail` is not empty unless the verdict is `native` or `descoped`.
- Every id resolves: baseline capability, requirement, target capability, objective.
- When the frame has `tracks`, every row also has `track` (a frame track id) and `owners` (a list of frame owners, the lead first).

Use `descoped` only when the person has decided the organisation does not need that requirement in the target (for example, a layout of the old system they will not rebuild). It is not a softer `not_met`.

Do not write `verdict`, `fit_score` or `priority`. `buildos fitgap` computes them.

## Target-Only Rows (`only.json`)

A JSON array, one object for each target capability that no mark cites (`uncited` lists them).

```json
{"target_capability_id": "LIB-BIL-08", "objective_ids": ["OBJ-02"], "confidence": "high", "effort": "low",
 "evidence": "What the capability does, from the target model, and why no baseline requirement needs it.",
 "opportunity": "What the organisation could gain, and whether it is worth phase one."}
```

Rules that `merge` checks:

- The set of rows equals the uncited set exactly. Under `--draft` with no `--only`, this check is skipped.
- `confidence` and `effort` use the same values as scored rows. `objective_ids` resolve.
- `evidence` is at least 60 characters. `opportunity` is not empty.

## To-Do List (`todos.json`)

Needed for a final build when the frame has `tracks`. A JSON array:

```json
{"id": "TD-01", "track": "P1", "sequence": 1, "owner": "Library Staff", "support": ["Platform Vendor"], "type": "decision",
 "title": "Confirm the target approval flow", "detail": "At least 30 characters saying what to decide and why.",
 "capability_ids": ["CFG-05"], "objective_ids": ["OBJ-02"], "depends_on": []}
```

`id` is `TD-NN` and unique. `owner` and every `support` entry are frame owners; `track` is a frame track; `type` is one of `decision`, `research`, `build`, `configure`, `vendor_question`, `test`, `data`. Capability, objective and `depends_on` ids must resolve. `merge` adds each to-do's track name and order and the highest priority of its capabilities, and lists each row's to-do ids.

## Findings (`findings.json`)

```json
{
  "headline": ["3 to 7 findings, each with a number from the data."],
  "layers": [{"layer_code": "CFG", "text": "2 to 4 sentences."}],
  "opportunities": ["What the target brings."],
  "open_questions": ["A question for the vendor, naming the capability ids."]
}
```

Every baseline layer that has capabilities needs one `layers` entry.

## Verdict Table

The verdict is read off the set of marks on the capability, ignoring `descoped` marks:

| Marks on the capability | Verdict |
| --- | --- |
| Every mark `descoped` | `descoped` |
| All `met` | `native` |
| All `met` or `configured`, at least one `configured` | `configurable` |
| All `unreleased` | `unreleased` |
| Only `not_met` and `unreleased`, at least one `not_met` | `gap` |
| Anything else | `partial` |

## Scores

| Score | Formula | Defaults |
| --- | --- | --- |
| Fit score, 0 to 100 | The average of the mark points over the capability's marks, leaving out `descoped` marks; none when every mark is `descoped` | `met` 100, `configured` 90, `partly` 50, `unreleased` 25, `not_met` 0 |
| Objective factor | The highest factor among the capability's objectives, or `none` when it has no objective | `must` 1.0, `should` 0.6, `could` 0.3, `none` 0.2 |
| Maturity factor | From the baseline capability's maturity | `proven` 1.0, `available` 0.8, `partial` 0.6, `planned` 0.4, `deferred` 0.2 |
| Priority, 0 to 100 | (100 − fit) × objective factor × maturity factor, rounded; 0 for a `descoped` capability. Ties sort by the best objective `rank`. | |

Objective coverage is the average fit score of the capabilities linked to that objective, leaving out `descoped` capabilities.

## Why a Row Is Listed

A row goes on the Decisions sheet when any of these is true:

| Flag | Rule |
| --- | --- |
| `decision` | Baseline maturity `proven` or `available`, effort `high` or `unknown`, and the verdict is not `native` |
| `must_objective_gap` | The capability serves a `must` objective and its fit score is under 50 |
| `live_loss` | The verdict is `gap` and the baseline maturity is `proven` |
| `open_question` | Confidence is `low` |

## Merged JSON (`<a>-<b>-fit-gap-analysis.json`)

| Key | Holds |
| --- | --- |
| `meta` | Title, mode, date, draft flag, who confirmed the objectives, both systems with counts, the scoring values, the tracks, owners and owner roles, and counts of verdicts, marks, flags, target-only rows and to-dos (also by owner) |
| `objectives` | Each objective with its rank, linked capability count, average fit, verdict counts, worst gaps and linked target-only ids |
| `rows` | One per baseline capability: the grader fields (including `track` and `owners`), plus the computed `verdict`, `fit_score`, `priority`, `objective_rank`, track name and order, `todo_ids`, `mark_counts`, `why_listed`, the union of cited target ids with names and statuses, and the sorted marks |
| `target_only` | One per uncited target capability, with its name, layer, status and maturity |
| `todos` | The to-do list in track and sequence order, with track names and the highest priority of the linked capabilities |
| `findings` | The findings file as given |

## Workbook Sheets

| Sheet | Contents |
| --- | --- |
| Read Me | What the workbook answers, the sheet list, how to read it, the scoring method and every vocabulary, including tracks, owners and to-do types when present |
| Summary | Key numbers, headline findings, verdict and mark counts, verdicts by layer (heat map), to-dos by track and owner, objective coverage by rank, top 15 priorities |
| Objectives | One row per objective with rank, coverage, verdict counts and worst gaps |
| Fit-Gap | One row per baseline capability, with track, owners and to-dos when present. Verdict colors, fit color scale and priority bars. The capability id links to its marks. |
| Requirement Marks | One row per baseline requirement with its mark, points, cited target ids and note. The capability id links to its Fit-Gap row. |
| Decisions | The listed rows, by priority, with the flags that listed them |
| Roadmap | (with tracks) Every baseline capability by track order, then priority, with owners and to-dos |
| To-Dos | (with tracks) Every to-do, sorted by owner, track and sequence; filter the Owner column for one party's list |
| Target Only | One row per target-only capability |
| Findings | The findings as one filterable table |
| `<A>` Capabilities | Every baseline capability with its verdict and fit, linked to its Fit-Gap row |
| `<B>` Capabilities | Every target capability with how many baseline rows cite it |
| `<B>` Requirements | Every target requirement, for checking evidence |

Every value in the workbook is static and comes from the merged JSON. To change the workbook, change the inputs and run `merge` and `workbook` again.
