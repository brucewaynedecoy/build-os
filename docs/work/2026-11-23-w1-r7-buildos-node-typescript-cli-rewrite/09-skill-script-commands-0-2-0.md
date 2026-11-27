---
title: "Phase 9: Skill-Script Commands 0.2.0"
kind: "work"
status: "active"
coordinate: "W1 R7 P9"
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# Phase 9: Skill-Script Commands 0.2.0

## Purpose

Move the logic that skills run as scripts into the CLI, so that after `0.2.0` an adopter needs Node and nothing else. The skills then call `buildos` commands.

## Overview

Three skill scripts become commands: `buildos extract bulk` from `buildos-bulk-extract/scripts/work.py`, `buildos fitgap` from `fit-gap-analysis/scripts/fitgap.py`, and `buildos export azure-boards` from `buildos-export-azure-boards/scripts/azure_boards_csv.mjs`. Each command must match its script on fixtures. Under the owner decision of 2026-11-26 (F-P9-04), a fourth command, `buildos capability-matrix`, replaces the Python tool `cm_build.py` that `capability-matrix/SKILL.md` embedded in its appendix, built by the same method. The release reuses the P8 workflow and needs separate maintainer approval.

## Entry Gate

- P8 exit gate passed.
- Departure from the default order (2026-11-24): the orchestrator started Stages 1 and 2 before the P8 exit gate, because P8 waits on owner actions. The work is implementation only, on its own branch `rewrite/ts-cli-p9` from `38d1e08`, so the `0.1.0` release candidate on `rewrite/ts-cli` does not gain the `0.2.0` commands. Stage 3 (skills, the no-Python check, docs, and the release) waits for the P8 exit gate. See [P9 Skill-Script Commands](./evidence.md#p9-skill-script-commands).
- Departure from the default order (2026-11-26): the `capability-matrix` command (F-P9-04) was built on its own branch `feat/capability-matrix-command`, stacked on pull request 9, before the P8 exit gate, as Stage 3 t9 to t12 were. See [F-P9-04 Capability-Matrix Command](./evidence.md#f-p9-04-capability-matrix-command-2026-11-26).
- Departure from the default order (2026-11-26): the orchestrator started Stage 3 t9 to t12 before the P8 exit gate, on its own branch `rewrite/p9-stage-3`, stacked on pull requests 5 and 6. `build-os@0.1.0` is published; P8 still waits on owner actions (t16, t17, t25, the A71 differences, F-P8-11). t13 (the release) is not started and waits for the P8 exit gate and the maintainer. See [P9 Stage 3: Skills, No-Python Check, and Docs](./evidence.md#p9-stage-3-skills-no-python-check-and-docs-2026-11-26).

## Human Experience Outcome

- Impact and governing promise or preserved boundary: Promise: no user-facing command needs Python, and an adopter needs Node and nothing else after `0.2.0` ([PRD 20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface)). Skill results stay the same ([PRD 20 Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)).
- Intended human outcome: An adopter asks for bulk extraction, a fit-gap workbook, or an Azure Boards export and gets the same result as before on a machine without Python.
- Human-facing surface or indirect effect: The three commands, the `.xlsx` and CSV files they write, and the skills that call them.
- Implementation work: Stages 1 through 3.
- Evidence source or testing type selected under current authority: Parity with the scripts on fixtures; a check that no Python file or call remains in shipped skills; a run on a machine image without Python.
- Executor: Implementing agent; the maintainer approves the `0.2.0` publication.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Script parity tests on three operating systems, a no-Python check, and a run in a CI image without Python. |
| Performance Testing | Active (one `PERF-002` pass) | Changed on 2026-11-27 by the orchestrator decision of that date ([Orchestrator Decisions (2026-11-27)](./evidence.md#orchestrator-decisions-2026-11-27)): the `0.2.0` package grew, so the `PERF-002` version 1 profile expired, and one pass on the published `0.2.0` runs under [`PERF-002` version 2](08-release-0-1-0.md#perf-002-profile). No decision depends on the speed of the four new commands, so `PERF-001` is not rechecked. |
| Guided Progress Review | `not-needed-now` | Parity with existing skill output is proven by fixtures. |
| Unassisted Goal Testing | `not-needed-now` | No accepted authority activates it. |

Human Experience Review is separate. The agent opens one `buildos fitgap` workbook beside the script's workbook and records whether sheets, headings, owner names, and colors read the same. A short experience handoff is optional: ask the agent for a fit-gap workbook on a machine without Python and check that it opens.

## Source PRD Docs

- [PRD 20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface) (`0.2.0` commands, no Python)
- [PRD 20 Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility), [Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain), [Release](../../prd/20-buildos-cli-and-distribution.md#release), and [Packaged Skills](../../prd/20-buildos-cli-and-distribution.md#packaged-skills)
- [PRD 08 Contracts and Data](../../prd/08-data-and-extraction.md#contracts-and-data) (extraction rows that `extract bulk` writes)
- [PRD 06 Contracts and Data](../../prd/06-operating-layer-and-routing.md#contracts-and-data) (skills reach the CLI through wrappers)
- Register: [`R-010`](../../prd/03-open-questions-and-risk-register.md#r-010-supply-chain-exposure-in-enterprise-installs), [`Q-012`](../../prd/03-open-questions-and-risk-register.md#q-012-when-to-build-the-mcp-adapter) (first planning gate after `0.2.0`)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P9](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#phases)
- Design: [Decision 15, No Python for users](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#15-no-python-for-users)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Script goldens

### Tasks

- [x] t1: Build synthetic fixtures for each script under `toolkits/buildos/test/fixtures/skills/`.
- [x] t2: Run `system/.os/skills/buildos-bulk-extract/scripts/work.py`, `system/.os/skills/fit-gap-analysis/scripts/fitgap.py`, and `system/.os/skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs` on each fixture. Record stdout, stderr, exit codes, and written files under `toolkits/buildos/test/golden/skills/`.
- [x] t3: For `.xlsx` output, compare workbook content instead of archive bytes: sheet names and order, cell values, number formats, and the fills and fonts the skill sets. Record this as a parity exception with its reason, since two zip writers do not produce identical bytes.

### Acceptance criteria

- A76: Goldens exist for every fixture of the three scripts, and the `.xlsx` comparison rule is recorded in `parity-exceptions.json` with a reason and an owner decision.
- Status (2026-11-24): goldens exist for all 60 cases (300 command runs); the rule is recorded as proposed parity exception PE-021 in `proposed-exceptions.json`, pending the owner decision, so A76 is not met yet.
- Status (2026-11-25, review round 1): the fit-gap fixture moved from `build/` (hidden by the root `.gitignore`, the cause of CI run 45535678445) to `analysis/`, a guard test refuses ignored fixture and golden files, and a 61st case (`frame-csv-ragged`) was captured; `capture.ts --check` now compares reproducible facts only. A76 still waits for PE-021. See [P9 CI Run 45535678445](./evidence.md#p9-ci-run-45535678445).
- Status (2026-11-25, review round 2): the `fitgap/packages` golden case now pins its stderr for SD-20 (a stale file that is not a package BuildOS wrote is kept and named); no golden changed, and `capture.ts --check` passes. A76 still waits for PE-021. See [P9 Review Round 2](./evidence.md#p9-review-round-2).
- Status (2026-11-25, final check): no golden changed, and `capture.ts --check` passes on `576d9ce`. A76 waits only for the PE-021 owner decision. See [P9 Final Check for Stages 1 and 2](./evidence.md#p9-final-check-for-stages-1-and-2).
- Status (2026-11-25, owner decisions): the owner approved PE-021, and it is in `parity-exceptions.json` with its reason and the owner decision. A76 is met. See [P9 Owner Decisions 2026-11-25](./evidence.md#p9-owner-decisions-2026-11-25).
- Status (2026-11-25, intake JSON review round 1): PE-021 now separates the approved content rule from the SD-19 error-token relaxation, which waits for the owner. A76 stays met for the content rule. See [P9 Intake JSON Review Round 1](./evidence.md#p9-intake-json-review-round-1).

### Dependencies

- P8 complete.

## Stage 2 - Commands

### Tasks

- [x] t4: Port `work.py` to `src/core/extract/bulk.ts` and add `buildos extract bulk` in `src/cli/commands/extract.ts`.
- [x] t5: Port `fitgap.py` to `src/core/fitgap/` and add `buildos fitgap` in `src/cli/commands/fitgap.ts`. Write `.xlsx` with `fflate` and hand-written Office Open XML parts. Read owner names and colors from config, as P7 set up. If `fflate` was not admitted in P4, admit it now under the PRD 20 rules and update `SECURITY.md`.
- [x] t6: Port `azure_boards_csv.mjs` and its adapters to `src/core/export/azure-boards/` and add `buildos export azure-boards` in `src/cli/commands/export.ts`.
- [x] t7: Give all three commands the shared help, envelope, `--root`, `--json`, and exit codes.
- [x] t8: Add parity tests against the Stage 1 goldens on three operating systems.

### Acceptance criteria

- A77: Every script fixture passes parity on three operating systems: byte for byte for stdout, stderr, exit code, and CSV and Markdown files, and by the recorded rule for `.xlsx`.
- A78: The three commands pass the P1 boundary test, and their `--json` output has all envelope fields.
- Status (2026-11-24): A77 passes on macOS (64 parity tests; three-OS CI not run, nothing pushed); A78 passes.
- Status (2026-11-25, review round 1): the 22 findings are fixed on `rewrite/ts-cli-p9-fix1` (`f364ee3`, `3fe6f9c`); A77 passes on macOS (65 parity tests) and in a fresh source archive; CI run 45535678445 had failed only the fit-gap cases (the hidden fixture), so a three-OS run of the fix branch is still needed; A78 passes. Divergences SD-15 to SD-19 are new; those that change a result are flagged for the owner. See [P9 Review Round 1](./evidence.md#p9-review-round-1).
- Status (2026-11-25, review round 2): CI run 45542114946 of `9f5aee9` passed on Ubuntu and macOS and failed one Windows test (a test defect, P9-R2-03). The 13 findings are fixed on `rewrite/ts-cli-p9-fix2` (`7df73a1`); A77 passes on macOS (65 parity tests) and in a fresh source archive; a three-OS run of the fix branch is still needed; A78 passes. SD-20 is new and SD-05, SD-09, SD-13, SD-16, SD-18, and SD-19 changed; those that change a result are flagged for the owner. See [P9 CI Run 45542114946](./evidence.md#p9-ci-run-45542114946) and [P9 Review Round 2](./evidence.md#p9-review-round-2).
- Status (2026-11-25, final check): CI run 45547048956 of `dd20021` passed on Ubuntu, macOS, and Windows (Node 24), with OSV, the Make Docs contract job, and the pack report. The 8 findings of review round 3 are fixed on `rewrite/ts-cli-p9-fix3` (`576d9ce`); A77 passes on macOS (65 parity tests) and in a fresh source archive, and needs a green three-OS run of this commit; A78 passes. SD-21 and SD-22 are new and SD-05, SD-16, SD-18, and SD-20 changed; each that changes a result is flagged for the owner. The review loop is closed under the project stop rule. See [P9 CI Run 45547048956](./evidence.md#p9-ci-run-45547048956) and [P9 Final Check for Stages 1 and 2](./evidence.md#p9-final-check-for-stages-1-and-2).
- Status (2026-11-26, public repository): A77 is met. CI run 45911537818 (push) and run 45911543946 (pull request) of `b49a06d` in this repository passed the three `test` jobs (Ubuntu, macOS, and Windows, Node 24), each with 65 skill-script parity tests passed (35 bulk-extract, 15 fit-gap, 11 Azure Boards, 4 divergence) and none skipped (P9-O2 closed). `b49a06d` holds the code; the later commit that records this changes only docs. t4 to t8 stay done. See [P9 Review Round 1 on the Public Repository](./evidence.md#p9-review-round-1-on-the-public-repository-2026-11-26).
- Status (2026-11-25, owner decisions): the owner accepted SD-04 (`fitgap` and `export azure-boards` read only files inside the project); no code change. By the owner decision on register `D-010`, `buildos intake` now prints the same envelope with `--json` (parity exception PE-022), so every domain command takes `--json`. See [P9 Owner Decisions 2026-11-25](./evidence.md#p9-owner-decisions-2026-11-25).

### Dependencies

- Stage 1 complete.

## Stage 3 - Skills, docs, and release

### Tasks

- [ ] t9: Update each affected `SKILL.md` in `system/.os/skills/` to call the new commands through the `.os/scripts/` wrappers. Delete `work.py`, `fitgap.py`, `azure_boards_csv.mjs`, and the script adapters they replace.
- [ ] t10: Add a CI check that fails when `system/.os/skills/` contains a `.py` file or a `python` call.
- [ ] t11: Run each skill's command in a CI image that has Node 24 and no Python.
- [ ] t12: Update the guide in `guide/content/` and `toolkits/buildos/README.md` for the three commands. Draft `0.2.0` release notes that repeat the `0.3.0` legacy-name notice.
- [ ] t13: Update `SECURITY.md`, add a `toolkits/buildos/release-candidates.json` entry, and run the P8 release workflow. **Needs the maintainer:** publication happens only after a recorded maintainer approval and npm 2FA.

### Acceptance criteria

- A79: The no-Python check passes, and a search of `system/.os/skills/` finds no `.py` file and no `python` call.
- A80: Each command runs successfully in the CI image without Python.
- A81: The `0.2.0` release review lists the same items as the P8 review, and publication happens only after a recorded maintainer approval.
- Status (2026-11-26, Stage 3 t9 to t12 on `rewrite/p9-stage-3`): t9 to t12 are performed, and no Stage 3 task is ticked, because A81 needs the release (t13). t9: the three skills call `buildos extract bulk`, `buildos fitgap`, and `buildos export azure-boards` through `.os/scripts/buildos`, and the five script files are deleted; the Azure Boards skill has the CSV formula-prefix note (F-P9-02). t10: `scripts/check-no-python.ts` runs in CI and passes, with one named exception, `capability-matrix/`, until the command that the owner decided on 2026-11-26 exists (F-P9-04). t11: the CI job `no-python` runs the three commands on Ubuntu, macOS, and Windows with Node 24 and a PATH where the job proves no `python`, `python3`, or `py` is found. t12: the guide and the package README cover the three commands, and `toolkits/buildos/RELEASE_NOTES.md` has a `0.2.0` section marked draft that repeats the `0.3.0` legacy-name notice; the final notes and the version come with t13. A79 is not met as written while the `capability-matrix` exception stands (the check passes; a search still finds its Python calls). A80: first recorded as met by CI run 45916436564 of `980ef40` (the `no-python` job on the three systems); review round 1 of pull request 7 reopened it, because the hosted runners have Python and that job only hides it from `PATH`. The new job `no-python-image` runs the same smoke in the official `node:24-slim` image, pinned by digest, which has no Python at all; in CI run 45921131235 of `bf6db38` it passed, so A80 is met for Linux by that image and for macOS and Windows by the restricted `PATH`. Owner decisions of 2026-11-26: F-P9-04, build the `capability-matrix` command in `0.2.0` (a separate pull request), so A79 stays open until that command exists; F-P8-11 is fixed in `0.2.0` (a separate pull request). A81 is open (t13). See [P9 Stage 3 Review Round 1](./evidence.md#p9-stage-3-review-round-1-2026-11-26). Review round 2 rewrote the t12 upgrade and rollback steps (a backup first, only the three changed skills by name, app copies too) and tested them forward and back; see [P9 Stage 3 Review Round 2](./evidence.md#p9-stage-3-review-round-2-2026-11-26). See [P9 Stage 3: Skills, No-Python Check, and Docs](./evidence.md#p9-stage-3-skills-no-python-check-and-docs-2026-11-26).
- Status (2026-11-26, F-P9-04 on `feat/capability-matrix-command`): `buildos capability-matrix skeleton|assemble|fitgap|validate` replaces the embedded `cm_build.py` (pinned at `085927e`, block SHA-256 `559ccc27…d38a8`); 20 fixture cases (93 steps) pass parity byte for byte, with divergences SD-23 to SD-27 (SD-26 waited for owner question Q1 and is built as option A, decided by the owner on 2026-11-27, option A ("Yes, agreed: Stop with a clear message.", [Owner Decisions of 2026-11-27](evidence.md#owner-decisions-of-2026-11-27-020-release)); review round 1 of pull request 10 added three cases and SD-27, see [Review Round 1 (Pull Request 10)](./evidence.md#review-round-1-pull-request-10); review round 2 added the case `spelled-paths`, see [Review Round 2 (Pull Request 10)](./evidence.md#review-round-2-pull-request-10); review round 3, the last under the stop rule, added the case `dash-values` and its fix pass left F-P9-13 and F-P9-14, see [Review Round 3 and the Final Fix Pass (Pull Request 10, 2026-11-27)](./evidence.md#review-round-3-and-the-final-fix-pass-pull-request-10-2026-11-27)). The skill calls it through `.os/scripts/buildos`, its appendix is gone, and `scripts/check-no-python.ts` has no exception. A79 is met: `node scripts/check-no-python.ts` passes with no exception, `findPython` finds nothing in `system/.os/skills/`, and a search there finds no `.py` file and no Python call (the one line that names Python says "No skill needs Python."). The no-Python smoke runs the fourth command too (A80 needs a green CI run of this branch). t9 to t12 stay unticked: A81 needs t13. The upgrade steps of t12 now refresh four skills. See [F-P9-04 Capability-Matrix Command](./evidence.md#f-p9-04-capability-matrix-command-2026-11-26).
- Status (2026-11-27, t13 first part on `release/0.2.0-version`, stacked on pull requests 10 and 9): the version is `0.2.0` (`package.json`, `package-lock.json`, the docs and guide that name the current version), and `toolkits/buildos/RELEASE_NOTES.md` has the final `0.2.0` notes with the status line "Status: draft" until publication. The open follow-ups are listed with their place before or after the release, and the release runbook for `0.2.0` (steps a to k, each with its commands and who does it) is written: the npm stage approval comes last, after the checks on the release tarball and the recorded publication approval. A staged version cannot be installed before approval, so the pre-approval smoke runs on the release tarball; new follow-up F-P9-15 (a tarball input for the smoke script and workflow) is built in a separate pull request before the release dry run (orchestrator decision of 2026-11-27; the owner may overrule). After review round 1 of pull request 11, step 0 of the runbook holds t13 for the P8 exit gate: P8 closure, or a dated owner exception that names each open item (t25, A71, t17 and A73, t16 and A72, F-P9-01 with the Human Experience Review); each is an open owner decision. The local release dry run passed every gate. Nothing is published, and `release-candidates.json` is unchanged. No checkbox changed: A81 needs the release. See [Version 0.2.0 and the Release Runbook](./evidence.md#version-020-and-the-release-runbook-2026-11-27). F-P9-15 is built in pull request 12 (`feat/smoke-a-tarball`, 2026-11-27): the smoke script and the `buildos-smoke` workflow run on a release tarball (a `buildos-release` run artifact or a published release asset, with the SHA-256 given by the person who starts the run) with the registry blocked; see [F-P9-15 Smoke on a Release Tarball](./evidence.md#f-p9-15-smoke-on-a-release-tarball-2026-11-27). Review round 2 of pull request 12 added the launcher checks and a launch probe (npm bin links forced on) and a complete install comparison; see [Review Round 2 (Pull Request 12)](./evidence.md#review-round-2-pull-request-12-2026-11-27). The final fix pass after review round 3 limited that claim to the entry scripts of the Node.js processes that the probe observed, compares the Windows shims byte for byte, and keeps the probe when npm's `node-options` is set; see [Review Round 3 and the Final Fix Pass (Pull Request 12)](./evidence.md#review-round-3-and-the-final-fix-pass-pull-request-12-2026-11-27).
- Status (2026-11-27, after the publication of `0.2.0`): `build-os@0.2.0` is published on npm (2026-11-27T17:49:05.907Z, release run 46043810434, stage `6b67a1e5-e85b-49d7-a7b5-046bcb7288ca`, SHA-256 `baf54ebf…f20da0`, the reviewed entry of pull request 13). t13's work is done: the `release-candidates.json` entry, `SECURITY.md`, and the P8 release workflow ran. The owner approved the npm stage before h1, the second h2 run, the h4 record, the h5 review, and the step i approval of the runbook, so for `0.2.0` "publication happens only after a recorded maintainer approval" is missed: A81 is not met. The review now lists the same items as the P8 review, retrospectively, and the owner's publication approval is an open question ([Question for the 0.2.0 Publication Approval](./evidence.md#question-for-the-020-publication-approval)). A79 and A80 stay met. No Stage 3 task is ticked, because A81 is not met. See [Publication Record for 0.2.0](./evidence.md#publication-record-for-020-2026-11-27).
- Status (2026-11-27, close-out on `release/0.2.0-closeout`): owner decision of 2026-11-27, "Yes, the public file is the reviewed file.": the retrospective publication review is the publication approval of `build-os@0.2.0`, as an explicit dated exception, as t25 was for `0.1.0`. A81's order stays recorded as missed for `0.2.0`, so A81 is not met and cannot be met for `0.2.0`, and t9 to t13 stay unticked. `PERF-002` version 2 ran on the published `0.2.0` (`pass`). The rollback route on three systems (F-P9-16) is built. See [Close-Out of 0.2.0](./evidence.md#close-out-of-020-2026-11-27). Update 2026-11-27, after rollback smoke run 2 ([46056570552](https://github.com/brucewaynedecoy/build-os/actions/runs/46056570552), head `2bb9c41`): passed on Linux, macOS, and Windows, 71 of 71 steps each; after the guide's rollback the project wrapper runs the pinned `0.1.0` from the public registry, so F-P8-09 is proven on three systems and P8 Stage 4 passes (t15 to t18 ticked in [08 Release 0.1.0](08-release-0-1-0.md)). Qualification: F-P9-17, on Windows a failing command through `.os\scripts\buildos.cmd` or a legacy `.cmd` script on the `npx` route returns exit code `0`; `0.2.0` is proven affected, and the code is lost in the wrapper layer, not in npm ([F-P9-17 After Run 2](./evidence.md#f-p9-17-after-run-2-windows-exit-codes)). t9 to t13 stay unticked (A81). `PERF-002` version 2: `pass`, recorded; no new measurement. What stays open: the package-size decision (owner; recommendation no reduction now); F-P9-17 (owner question: a `0.2.1` patch or `0.3.0`, [Owner Question for F-P9-17](./evidence.md#owner-question-for-f-p9-17)); `Q-012` (owner, its gate is due); and the release process: the owner asked on 2026-11-27 for a follow-up, "I would really prefer for BuildOS to follow the pattern/process we use for Make Docs. This process feels much more convoluted." That is an owner request, not a decision made here. See [Open Items After the Close-Out](./evidence.md#open-items-after-the-close-out).

### Dependencies

- Stage 2 complete.

### Closeout Notes

- Four testing decisions: Pending phase close.
- Performance evidence: `PERF-002` version 2 (profile in [08 Release 0.1.0](08-release-0-1-0.md#perf-002-profile)), one pass on the published `0.2.0` on 2026-11-27: `pass` (`PERF-002-P9-R1`), `cold` median 765.8 ms, slowest 1,298.4 ms; recommendation to the owner, no package-size reduction now. See [First-Run npx for 0.2.0 (PERF-002, P9)](./evidence.md#first-run-npx-for-020-perf-002-p9).
- Human Experience Review: Pending phase close. Done 2026-11-27 with F-P9-01, owner-reported: the owner compared a `buildos fitgap` workbook with the script's workbook of the same inputs, after the instructions that the orchestrator gave, and answered "Same"; the answer does not state separately which programs and versions were used, whether a repair message appeared, or whether the second pair was opened. See [Workbook Check (F-P9-01 and the Human Experience Review)](./evidence.md#workbook-check-f-p9-01-and-the-human-experience-review-2026-11-27).
- Optional experience handoff: Pending phase close.
- Explicit human acceptance gate: Maintainer approval of the `0.2.0` publication, per [PRD 20 Release](../../prd/20-buildos-cli-and-distribution.md#release). It blocks publication only. Not given before publication: the owner approved the npm stage on 2026-11-27 before step i; the approval is asked after the fact ([Question for the 0.2.0 Publication Approval](./evidence.md#question-for-the-020-publication-approval)). Given after the fact by owner decision of 2026-11-27, "Yes, the public file is the reviewed file.", as a dated exception; A81's order stays missed for `0.2.0` ([Owner Decisions of 2026-11-27 (0.2.0 Close-Out)](./evidence.md#owner-decisions-of-2026-11-27-020-close-out)).
- Evidence report: Pending phase close.
- Phase / capability status: Stages 1 and 2 done; A77 met by CI run 45911537818 of `b49a06d` in this repository on three operating systems (P9-O2 closed); Stage 3 t9 to t13 performed (t13 on 2026-11-27: `build-os@0.2.0` is published; its checkbox stays open because A81 was missed, see [Publication Record for 0.2.0](./evidence.md#publication-record-for-020-2026-11-27)), no Stage 3 task ticked. On 2026-11-26 the Stage 1 and Stage 2 work, with the owner decisions of 2026-11-25 and 2026-11-26, came into this repository as file content only; see [P9 Move to the Public Repository](./evidence.md#p9-move-to-the-public-repository-2026-11-26). A76 is met (PE-021 approved), SD-04, SD-05, and SD-15 to SD-22 are accepted, and `intake --json` is built (`D-010`, PE-022). Stage 3 t9 to t12 are performed on `rewrite/p9-stage-3` before the P8 exit gate (departure recorded in the entry gate); the CSV formula-prefix note is in the Azure Boards skill (F-P9-02). No Stage 3 task is ticked: A79 is met since F-P9-04 (the `capability-matrix` command, on `feat/capability-matrix-command`), and A81 is not met (the publication came before the recorded approval); A80 is met (CI run 45921131235 of `bf6db38`: the `no-python-image` job for Linux, the restricted `PATH` for macOS and Windows).
