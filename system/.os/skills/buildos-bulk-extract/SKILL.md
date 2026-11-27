---
name: buildos-bulk-extract
description: Review many BuildOS source assets in small sets, stage source-backed rows, and separately review and publish approved rows. Use for next sources, named REF sources, or coordinated parallel extraction.
---

# BuildOS Bulk Extraction

Capture supported claims within the source's actual scope. A requirement states what must happen. A capability states what a system or process can do. A finding states what the evidence shows. Review all three types. Do not exclude a type or domain unless the user requests that limit.

Use one original `source` in `.os/indexes/references.json` as one work unit. That index exists after intake has rebuilt it (`buildos-intake-convert`); with no index or no converted source, there is no work. Review every converted `REF` record for that source, including every workbook sheet. The first `REF` ID names one source review at `extractions/REF-*.json`. A set is only a list of work units; it needs no batch file or number. Existing root reviews remain in place and do not return as new work.

There are two separate agent tasks. An ordinary extraction request starts **Stage 1: extract** only. A different task does **Stage 2: review and publish**. Stage 1 must stop after staging. Stage 2 must follow the review and approval order below. BuildOS contracts still govern converted assets and system rows.

## Work units and helper

Treat a requested count as the total set. Check source size and format before dividing work. When working alone, finish one source at a time. Agents may review different sources in parallel. A coordinator assigns disjoint sources and keeps the total count. The helper is the `buildos extract bulk` command. Run it through the project wrapper `.os/scripts/buildos` from the project root (`.os\scripts\buildos.cmd` on Windows, with the same arguments; Command Prompt needs double quotes, not single quotes, around a name with a space). It needs Node.js 24 or newer and nothing else, and it never runs Git.

Use the harness assigned by the user. Do not choose or switch harnesses. Delegate Stage 1 with a short task message: "Use the current buildos-bulk-extract skill for Stage 1 on [sources]. Follow its Stage 1 write limits. Stop after staging." Do not add source, row-type, or domain exclusions unless the user requests them.

```text
.os/scripts/buildos extract bulk --root . status
.os/scripts/buildos extract bulk --root . next --stage extract --count 5
.os/scripts/buildos extract bulk --root . next --stage review --count 5
.os/scripts/buildos extract bulk --root . show REF-001
.os/scripts/buildos extract bulk --root . start REF-001
.os/scripts/buildos extract bulk --root . template requirement
.os/scripts/buildos extract bulk --root . stage-update REF-001 REQ-001 --key corrected-need
.os/scripts/buildos extract bulk --root . check REF-001
.os/scripts/buildos extract bulk --root . stage REF-001
.os/scripts/buildos extract bulk --root . stage REF-001 --author 'Author name'
.os/scripts/buildos extract bulk --root . replace-row REF-001 corrected-need < ROW-JSON-ON-STANDARD-INPUT
.os/scripts/buildos extract bulk --root . decide REF-001 --reviewer 'Reviewer name' < DECISIONS-JSON-ON-STANDARD-INPUT
.os/scripts/buildos extract bulk --root . publish REF-001
```

The two standard-input commands accept JSON sent directly by the agent through its shell input. Do not create a file for that input. `replace-row` accepts one complete BuildOS row without `_stage`. `decide` accepts a JSON list such as `[ {"key":"need-a","review_state":"approved"}, {"key":"need-b","review_state":"held","review_note":"Source does not support the claim."} ]`. The helper keeps `_stage` metadata when it replaces a row. It is the only writer of shared staged JSONL files.

## Stage 1: extract

1. Run `show` and `start`. Read the original and every converted file. For a workbook, account for every sheet. Check row, column, and nonempty cell placement where relevant. Check filters, hidden rows, and pivot selections in the original when they affect a claim or total. State whether a total covers all stored rows or only visible rows. Use original evidence to answer a gap in the conversion.
2. Repair clear conversion loss only in the affected converted asset. Add no interpretation. Check the rest of its section or sheet. Update conversion provenance and the matching reference index entry. Read back the saved asset header and index entry. Check their converter, timestamp, source path, and source hash. Use those saved values in the repair note. Keep conversion time separate from review time. Preserve the original and its source hash. Record uncertain loss in `unresolved` and continue with other sources.
3. Read `.os/data/` to find duplicates, conflicts, and corrections. Compare meaning and source evidence. Check the activity, scope, and current or future state before proposing reuse. Before treating a revised snapshot as replacement evidence, compare dates, entry IDs, values, and record states. Print every changed field name and its change count before limiting examples. Check date fields separately. Match each material change to a candidate, a saved claim, or a stated reason to leave it out. A list of the most frequent value changes does not prove complete coverage. Retain distinct supported facts. Matching entries with different IDs remain an open question unless evidence proves duplication.
4. Use `template` for a new row without a global ID. Use `stage-update` for a correction to a saved row. Keep its ID and other fields. Each draft has a unique `key`, `type`, `action` (`minted`, `referenced`, or `updated`), `review_state: pending`, and typed `row`. Reuse needs `target_id`. Keep the row's `status` separate from its review state.
5. Add claims as each section is read. Follow diagram flows. Check stated needs, abilities, limits, targets, and protected feeds or processes. Separate a future target from a current estimate. Keep a supported claim separate from its open questions. Put questions in `unresolved`, never in ID or reference fields. Do not infer a system or environment link from instance configuration alone.
6. For numbers, check units, currency, period, included rows, and filters. If a money field has no stated currency, record that question in `unresolved`. Do not copy a currency from another source without evidence. Compare such amounts only as numbers until evidence proves a common currency. State the currency limit beside each financial comparison. Keep supported hour comparisons and the open currency question. Use each date field by name. A due date does not prove a return date. Check changes in each date field separately.
7. Use dated evidence at its stated scope. For example, a July staffing export can show a view of weekly planned hours and cost. That supports a capability describing what that view displays. The export alone does not prove current availability, automation, integration, or accepted actuals. State those limits. A capability can have `supports: []` when no saved requirement is supported. A work-note label such as "review requirements" does not by itself state a requirement.
8. Match each meaningful item to a candidate, a saved row, or a specific reason to leave it out. Cite a clear converted `assets/...#anchor` for the full claim. For CSV, `#row-N` means the Nth CSV record in the whole converted file, including frontmatter. A quoted line break does not create another record. Count records with a CSV reader, not physical text lines. Open each citation. Inspect images for visual claims.
9. Mark each converted `REF` as `reviewed`, `no-new-rows` with a reason, or `blocked` with a reason. Use `reviewed` only when a candidate cites that file. Fill `reviewed_by`, `reviewed_at`, and `source_check` with checks actually done. Before staging, read each complete candidate against the sources. Check its title, summary, claim text, and implications together. Each field that states an affected claim must carry that claim's evidence limits. A limit in another field or in `unresolved` is not enough. Keep supported facts and valid open questions. Run `check`, then `stage REF-ID`. On the first call, the author defaults to the named Stage 1 reviewer. An explicit `--author NAME` can name the actual author.

`stage` writes typed rows under `extractions/staging/`. It leaves candidate keys and types in the root review. The staged row then becomes the one editable copy. Use `replace-row` for a later change. The `_stage` block keeps the source link, action, review state, author, target ID, and original-row hash where needed. New candidates added after a source is staged require `stage REF-ID --author NAME`. A retry retains the saved author.

Stage 1 may write its root source reviews, typed staged rows through the helper, faithful repairs to assigned converted assets, and matching reference index entries. It never writes `.os/data/`. Workers own different source files. Pass worker instructions in task messages, not in a new file.

## Stage 2: review and publish

1. A different task reviews the named Stage 1 work without editing it. Read its transcript and project changes. Check source coverage, row types, every reuse choice, citations, repairs, paths, and write limits. Check meaningful claims against originals. Check each complete candidate for agreement between fields. Check evidence limits wherever the affected claim appears. Check currency limits beside financial comparisons and the coverage of every material changed field. Compare repair notes with the saved asset headers and index entries. Check `no-new-rows` reasons and source sections for missed facts. Helper checks prove file form, not factual coverage.
2. Report the review before any fixes or publication. Keep Stage 1 findings separate from reviewer findings. Count rows by source, type, and action. Explain missed facts, splits, merges, duplicates, conflicts, and changed reuse choices. For each fix, show the claim or asset, source evidence, proposed change, and open question. State which rows can proceed and which need a hold.
3. Obtain user approval of fixes and authorization to publish. If no fixes are needed, report that result and still wait for publication authority. Use approval already given for the same scope. Do not repeat that request. A review request alone does not authorize edits or publication.
4. After approval, use `replace-row` for claim fixes. Repair converted assets and matching index entries only as approved. To add a missed claim, add a pending draft candidate to its root review and run `stage REF-ID --author 'Reviewer name'`. Keep the original Stage 1 `reviewed_by` unchanged. Do not invent a claim, remove a valid question, or weaken a claim to clear a hold.
5. Call `decide REF-ID --reviewer NAME` with decisions on standard input. This reviewer must differ from the Stage 1 reviewer. Mark each claim `approved` or `held`. Give a held claim a clear `review_note`. A source with no candidates still needs `decide` with an empty list. Each decision stores the claim's reviewer and UTC date. Reset an approved claim's decision before replacing it. A replacement returns it to pending and clears its decision fields, while retaining its author.
6. Run `check`, then `publish REF-ID` only for authorized work. The helper publishes approved, unpublished rows. Pending and held rows stay staged. Check final changes against the sources. Confirm that only approved rows were published. Report repairs, publication, held work, and what remains unverified. Name who found each issue.

Publication assigns new IDs and strips `_stage`. It records `minted`, `referenced`, and `updated` in one extraction record per publication. `extracted_by` lists distinct authors in candidate order, joined with `; `. Each final `applied` entry keeps its author, reviewer, and review date. The original Stage 1 reviewer stays separate from the publication reviewer.

The helper checks an update against the original-row hash and removes published rows from staging. A changed saved row stops that update for another review. An interrupted publication can be retried without duplicate rows or changed names. Old reviews and publication intents remain valid without new author fields. Do not backfill them. Only one publication runs at a time.

## Files and report

1. Do not create agent-written scripts, worker briefs, decision files, result files, or other sidecars, including in a scratchpad. Print file inventories and other command output in the transcript. Do not redirect that output to a file. Deleting a disallowed file later does not make its creation valid. The helper may use short-lived files for safe writes. It removes them after success or a handled failure.
2. Keep Git staging and commits outside this skill unless the user requests them. Do not edit `AGENTS.md`, `CLAUDE.md`, BuildOS contracts, or Make Docs files as part of extraction.
3. Record the initial changed paths. At the end, compare them with `GIT_OPTIONAL_LOCKS=0 git status --porcelain --untracked-files=all`. If the project has no Git metadata, print its file inventory at the start and end for comparison. Stop and report any new path outside the allowed set. Do not run a broad document index refresh to open one review file.
4. Report sources and converted files covered, staged or published rows by action, repairs, open gaps, and next sources. For a conflict, name the evidence or person that could settle it.
5. A passing helper check proves structure, not factual coverage. Do not call a staged row published or a held claim complete.
