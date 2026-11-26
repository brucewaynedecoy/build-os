# 03 Validation and Review

## Purpose

Define the checks that close each W1 R8 phase and the plan, and the review that runs before every phase commit.

## Checks

Run every check from the repository root. Record each result in the backlog `evidence.md`.

1. **Validator.** `make-docs run prd authority validate --target-root . --json` exits `0` with `status: passed` and zero diagnostics. Count by code with `jq -r '.diagnostics | group_by(.code) | map("\(.[0].code) \(length)") | .[]'`. Expected counts per phase are in [Validator Counts By Phase](#validator-counts-by-phase).
2. **Requirement trace.** Every row in [04 Requirement Inventory](./04-requirement-inventory.md) has a `Final owner` cell. The cell names a PRD and section that exists, or says `none` with a reason. The reviewer opens the named section for every gap row (13-20, 14-06, 16-05, 18-12), every row of medium or low confidence, and at least 20 other rows across all seven tables, and confirms the requirement is stated there with the same meaning.
3. **Full link check.** A relative-link and anchor check over every `.md` file in the repository, including `.make-docs/archive/` and excluding `.git/` and `node_modules/`, finds no broken link to a PRD, a moved backlog file, or the moved audit prompt. Anchors use GitHub heading slugs. If the owner chose option B in [02](./02-archive-links-and-index.md#owner-decision-before-the-archive-moves), links whose source file is an archived copy are excluded and counted.
4. **Path hygiene.** `make-docs project path-hygiene validate` reports zero failing findings.
5. **No renumbering.** `git diff --name-status -M` for the cleanup shows no PRD number change. The only rename inside `docs/prd/` is 17. Numbers 14, 15, 16, 18, and 19 leave the active set only through the archive moves.
6. **Template conformance.** PRDs 13 and 17 have the subsystem sections in order: `## Purpose`, `## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, `## Rebuild Notes`, `## Requirement History`, `## Source Anchors`. Neither has a document-level `coordinate`, a `### Change Notes` section, or a retired heading.
7. **No pointer notes.** In `docs/prd/01-*.md` through `docs/prd/12-*.md`, no `### Change Notes` bullet links or names a file `13-*` to `19-*`, and no `### Change Notes` section is empty. A mention of PRD 13 or 17 by its product name is allowed in a body or a `## Requirement History` entry. `grep -nE '1[4-9]-(revise|enhance)' docs/prd/*.md` finds nothing outside `## Requirement History` and `## Source Anchors`, and those name only archived paths.
8. **No superseded banner.** No file in `docs/prd/` starts with a superseded banner or says "superseded by" about a whole PRD.
9. **W1 R7 links.** Every file in `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/` and `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/` names PRD 17 by its new filename and its new section names, names 02 `## Module Map` where it named PRD 16, and has no removed PRD 13 anchor. `grep -rnE '1[4-9]-(revise|enhance)' docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite` finds nothing.
10. **Requirement history.** Each entry listed in [01](./01-prd-authority-maintenance.md#requirement-history-entries) exists with date, coordinate, affected section, previous contract, replacement contract, rationale, and a resolving source link, after the current sections and before `## Source Anchors`.
11. **Register shape.** The register keeps `## Confirmed Drift`, `## Open Questions`, `## Rebuild Risks`, and `## Source Anchors`, and no item number changed. Each new or changed item has `Status`, `Decision`, `Follow-Up`, `Issue` or `Question`, `Why it matters`, `Recommendation`, and `To close`. `D-005` has a `Resolution`.
12. **Human Experience promises.** Each promise in the [plan overview](./00-overview.md#human-experience-propagation) has its evidence recorded in the backlog `evidence.md`.

## Validator Counts By Phase

Baseline at commit `59e3a36`: 93 findings.

| After phase | `PRD-AUTH-001` | `PRD-AUTH-002` | `PRD-AUTH-003` | `PRD-AUTH-004` | `PRD-AUTH-005` | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 6 | 6 | 7 | 23 | 51 | 93 |
| P1 (13 and 17 restructured) | 6 | 6 | 7 | 15 | 51 | 85 |
| P2 (notes folded) | 6 | 6 | 7 | 15 | 51 | 85 |
| P3 (register, trace) | 6 | 6 | 7 | 15 | 51 | 85 |
| P4 (rename, archive, links, index) | 0 | 0 | 0 | 0 | 0 | 0 |
| P5 (final) | 0 | 0 | 0 | 0 | 0 | 0 |

A count above the expected value is a finding to fix before the phase commit. A count below it is recorded and explained.

## Stop Rules

- P3 stops if any inventory row has no `Final owner`, or names an owner section whose text does not state the requirement. Nothing is renamed or archived until it passes. A row with no clear owner goes to the owner as a decision, as design decision 8 expects.
- P4 stops at its entry gate until the owner has chosen how links inside archived copies are handled.
- Any phase stops if a check shows a current requirement was weakened or changed in meaning. The fix lands in the same phase.

## Review

Before each phase commit, an independent reviewer agent reviews the phase diff against [the plan](./00-overview.md), [the design](../../designs/2026-11-23-prd-set-authority-cleanup.md), and [the inventory](./04-requirement-inventory.md). The reviewer:

- re-runs the checks that apply to the phase;
- reads every changed PRD section in full, not only the diff lines;
- confirms that no editorial language (rename, archive, fold, cleanup, validator code, inventory row ID) entered a PRD body;
- records a pass or a list of findings in the backlog `evidence.md`.

The implementer fixes each finding, and the reviewer checks the fix. The phase is committed only after a pass. After P5, the orchestrator prepares a short owner summary: what changed in each PRD, the register items, the validator before-and-after counts, the owner decision taken in P4, and anything left open.
