---
title: "W1 R7 P9 Final Check Fixes for Stages 1 and 2"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9-fix3"
summary: "Fixed the findings of the third independent review of the P9 skill-script commands: no kept package file is written over, a pending publication over a changed data file is placed by row ID or stopped for review, the workbook refuses a stale maturity, a requirement ID repeated in one capability is refused, the bulk config index matches validate's, an unreadable config stops every decision, the recovery message reads the review, and a folder link out of the project is writable with the switch."
---

# W1 R7 P9 Final Check Fixes for Stages 1 and 2

## Changes

Final fix pass for P9 Stages 1 and 2 after review round 3 of `dd20021`, on the branch `rewrite/ts-cli-p9-fix3`. `fitgap packages` now knows every package name it writes before any change and stops (exit 4, nothing changed) when a file it did not write is at one of them, so a kept file is never written over. A pending publication whose data file changed since it started is placed by the row IDs the intent gave: rows all there finish, rows all absent apply once, and anything else stops before any write with exit 10 and steps that never publish a row twice; withdrawal by hand is offered only when every data file is as it was before. The workbook stops when a capability's maturity changed after the merge, and every command that loads a model refuses a requirement ID used twice in one capability (IDs stay scoped to their capability). `extract bulk` builds the same config index as `buildos validate`, an unreadable config stops a withdrawing `decide` too, and the message after an incomplete undo describes the review as it is on disk. With `--allow-outside-root`, a destination whose project folder is a link to an outside folder is written as if the outside path had been named. Nothing was pushed, merged, published, staged, tagged, or released.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-final-check-for-stages-1-and-2).

| Area | Summary |
| --- | --- |
| Package collision (P9-F-01) | `cmdPackages` computes the generated names first; a kept file at one of them stops the run with each file, its reason, and what to do (SD-20) |
| Publication resume (P9-F-02) | `publicationFileState` places each file by hash, then by row ID (appended rows by equality, updated rows by the staged base hash); a conflict is `PublicationConflict`, exit 10, `needs_operator_review`, nothing written (SD-22) |
| Workbook (P9-F-03) | `modelMismatch` compares each row's `baseline_maturity` with the model by capability ID, the one model field the score uses (SD-18) |
| Model loading (P9-F-04) | `loadSystem` refuses a requirement ID repeated within one capability, in either model (SD-21) |
| Config index (P9-F-05, -06) | The bulk index uses validate's findings budget; `ConfigUnreadable` is never taken for a row finding, and `decide` reads the config before any decision |
| Recovery message (P9-F-07) | `reviewAfterFailure` reads the review on disk: pending, complete, put back, or uncertain with `extract bulk check` |
| Folder link out (P9-F-08) | `ProjectFiles.portPath` routes an authorized write whose folder resolves outside the root to the volume port; reads stay contained |
| Tests | `test/skill-script-review-3.test.ts` (22 tests; 18 fail on `dd20021`, 4 are controls); one round 1 test now uses a real earlier package |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

None this session (the evidence report and the phase file change in the closing documentation commit).

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The package collision stop, the folder-link write rule, the resume by row ID, and the config index and reader. |
| [toolkits/buildos/test/golden/skills/divergences.json](../../../toolkits/buildos/test/golden/skills/divergences.json) | SD-05, SD-16, SD-18, and SD-20 updated; SD-21 and SD-22 new, each with an owner recommendation. |

### User

None this session.
