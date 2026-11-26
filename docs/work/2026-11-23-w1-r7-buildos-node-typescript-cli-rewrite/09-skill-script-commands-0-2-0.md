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

Three skill scripts become commands: `buildos extract bulk` from `buildos-bulk-extract/scripts/work.py`, `buildos fitgap` from `fit-gap-analysis/scripts/fitgap.py`, and `buildos export azure-boards` from `buildos-export-azure-boards/scripts/azure_boards_csv.mjs`. Each command must match its script on fixtures. The release reuses the P8 workflow and needs separate maintainer approval.

## Entry Gate

- P8 exit gate passed.
- Departure from the default order (2026-11-24): the orchestrator started Stages 1 and 2 before the P8 exit gate, because P8 waits on owner actions. The work is implementation only, on its own branch `rewrite/ts-cli-p9` from `38d1e08`, so the `0.1.0` release candidate on `rewrite/ts-cli` does not gain the `0.2.0` commands. Stage 3 (skills, the no-Python check, docs, and the release) waits for the P8 exit gate. See [P9 Skill-Script Commands](./evidence.md#p9-skill-script-commands).

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
| Performance Testing | `not-needed-now` | `PERF-001` and `PERF-002` cover startup and fetch; no decision depends on these commands' speed. |
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

### Dependencies

- Stage 2 complete.

### Closeout Notes

- Four testing decisions: Pending phase close.
- Performance evidence: None; not needed now.
- Human Experience Review: Pending phase close.
- Optional experience handoff: Pending phase close.
- Explicit human acceptance gate: Maintainer approval of the `0.2.0` publication, per [PRD 20 Release](../../prd/20-buildos-cli-and-distribution.md#release). It blocks publication only.
- Evidence report: Pending phase close.
- Phase / capability status: Stages 1 and 2 done pending a green three-OS CI run in this repository (A77, P9-O2); Stage 3 not started. On 2026-11-26 the Stage 1 and Stage 2 work, with the owner decisions of 2026-11-25 and 2026-11-26, came into this repository as file content only; see [P9 Move to the Public Repository](./evidence.md#p9-move-to-the-public-repository-2026-11-26). A76 is met (PE-021 approved), SD-04, SD-05, and SD-15 to SD-22 are accepted, and `intake --json` is built (`D-010`, PE-022). Stage 3 waits for the P8 exit gate, and adds the CSV formula-prefix note to the Azure Boards skill (F-P9-02).
