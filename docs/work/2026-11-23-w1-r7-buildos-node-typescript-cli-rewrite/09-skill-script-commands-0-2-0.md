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

- [ ] t1: Build synthetic fixtures for each script under `toolkits/buildos/test/fixtures/skills/`.
- [ ] t2: Run `system/.os/skills/buildos-bulk-extract/scripts/work.py`, `system/.os/skills/fit-gap-analysis/scripts/fitgap.py`, and `system/.os/skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs` on each fixture. Record stdout, stderr, exit codes, and written files under `toolkits/buildos/test/golden/skills/`.
- [ ] t3: For `.xlsx` output, compare workbook content instead of archive bytes: sheet names and order, cell values, number formats, and the fills and fonts the skill sets. Record this as a parity exception with its reason, since two zip writers do not produce identical bytes.

### Acceptance criteria

- A76: Goldens exist for every fixture of the three scripts, and the `.xlsx` comparison rule is recorded in `parity-exceptions.json` with a reason and an owner decision.

### Dependencies

- P8 complete.

## Stage 2 - Commands

### Tasks

- [ ] t4: Port `work.py` to `src/core/extract/bulk.ts` and add `buildos extract bulk` in `src/cli/commands/extract.ts`.
- [ ] t5: Port `fitgap.py` to `src/core/fitgap/` and add `buildos fitgap` in `src/cli/commands/fitgap.ts`. Write `.xlsx` with `fflate` and hand-written Office Open XML parts. Read owner names and colors from config, as P7 set up. If `fflate` was not admitted in P4, admit it now under the PRD 20 rules and update `SECURITY.md`.
- [ ] t6: Port `azure_boards_csv.mjs` and its adapters to `src/core/export/azure-boards/` and add `buildos export azure-boards` in `src/cli/commands/export.ts`.
- [ ] t7: Give all three commands the shared help, envelope, `--root`, `--json`, and exit codes.
- [ ] t8: Add parity tests against the Stage 1 goldens on three operating systems.

### Acceptance criteria

- A77: Every script fixture passes parity on three operating systems: byte for byte for stdout, stderr, exit code, and CSV and Markdown files, and by the recorded rule for `.xlsx`.
- A78: The three commands pass the P1 boundary test, and their `--json` output has all envelope fields.

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
- Phase / capability status: Not started.
