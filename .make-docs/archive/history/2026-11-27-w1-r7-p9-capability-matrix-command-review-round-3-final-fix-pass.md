---
title: "W1 R7 P9 Capability-Matrix Command Review Round 3 Final Fix Pass"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/capability-matrix-command"
summary: "Fixed the five findings of review round 3 of pull request 10, the last round under the stop rule: an authorized --out through a folder link, installed system/ paths again, option values that start with a minus as argparse reads them, a backslash in a POSIX folder name, and makedirs' exit class for two --out errors; SD-24 now says what is looked at outside the root; one new golden case."
---

# W1 R7 P9 Capability-Matrix Command Review Round 3 Final Fix Pass

## Changes

Fixed the five findings of review round 3 of pull request 10 (F-P9-04), the last round under the stop rule, each first run again with the pinned `cm_build.py` and the command side by side. An `--out` folder and its folders are looked at through the write-authorized port (`destinationKind` and `destinationEntryExists` in `src/core/shared/project-files.ts`, `osLookup(..., { forWrite: true })`, and `WritePlan.folder(path, { destination: true })`), so with `--allow-outside-root` a folder link at `--out` that leads outside the project is followed and written through, and without the switch it is still refused (SD-24). The one-name-at-a-time lookup applies the installed-path rule first, so a `system/…` path works again in an initialized project (the regression of round 2), and messages name the path as typed. `buildos capability-matrix` reads an option value that starts with a minus as Python 3.14's `argparse` does (a value with a space, or one that matches its negative-number pattern with Unicode digits, is a value; anything else is an option). In its glob, `\` ends a folder only on Windows. A link at `--out` that leads nowhere is `[Errno 17] File exists` and a `..` after a missing folder is checked as `os.makedirs` checked it (`[Errno 20]`), both exit 3. `buildos fitgap` is unchanged (F-P9-12 stays open). SD-24, `SECURITY.md`, and a code comment now say that the identity check of an absolute path looks at the metadata of its folders, also outside the root, and never at their content or a listing; that code is unchanged. The Dynamics 365 CE adapter has a one-line Command Prompt example, held by a test that splits it by the Command Prompt rules (not run on Windows itself). One new golden case (`dash-values`, 7 steps) was captured from the pinned tool, so 20 cases and 93 steps pass byte for byte; the no-Python smoke runs a `system/` path in its initialized project. Every confirmed case of rounds 1 to 3 holds. F-P9-13 (a link that leads nowhere before the last name of `--out`) and F-P9-14 (`buildos fitgap`'s minus values) are new follow-ups. No further review round follows.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-3-and-the-final-fix-pass-pull-request-10-2026-11-27).

| Area | Summary |
| --- | --- |
| Command | `toolkits/buildos/src/cli/commands/capability-matrix.ts` (`seenAsOption`); `src/core/capability-matrix/cm-build.ts` (`checkOut`, `plan.folder(..., { destination: true })`) |
| Shared ports | `src/core/fitgap/fitgap.ts` (`osLookup` with `userRel` and `forWrite`; the `spelled` glob join; `buildos fitgap` unchanged); `src/core/shared/project-files.ts` (`destinationTarget`, `destinationKind`, `destinationEntryExists`, `folderWriteTarget`, `WritePlan.folder` option) |
| Fixtures and goldens | `test/fixtures/skills/generate-capability-matrix.ts` and `test/fixtures/skills/capability-matrix/cases.json` (case `dash-values`); `test/golden/skills/capability-matrix/cases/dash-values.json`; `test/golden/skills/capture-record.json` (20 cases) |
| Divergences | `test/golden/skills/divergences.json`: SD-02 (two usage steps), SD-24 (the corrected record and the round 3 `--out` rules) |
| Tests and smoke | `test/capability-matrix-review-3.test.ts`; `test/azure-boards-skill-examples.test.ts` (the Command Prompt example); `scripts/no-python-smoke.ts` (a `system/` path) |
| Skills | `system/.os/skills/buildos-export-azure-boards/adapters/dynamics-365-ce/ADAPTER.md` (a Command Prompt example) |
| Records | The evidence report, the P9 phase file, the risk register (R-003), `toolkits/buildos/SECURITY.md` |

Stacked on pull request 9 (`fix/f-p8-11-printed-commands`), which is not merged. No version, release candidate, tag, release, or stage changed. SD-26 stays "owner decision open, built as A".

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `not-needed`; no guide chapter changed, and chapter 4's upgrade table already lists `ADAPTER.md`.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section Review Round 3 and the Final Fix Pass (Pull Request 10): each finding with its reproduction, fix, and test; the root safety record; the adapter note; the confirmed-cases table; F-P9-13 and F-P9-14; the checks. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | F-P9-04 status: 20 cases, 93 steps. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: the case count and round 3. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Paths Outside the Project: what the identity check looks at. |

### User

| Path | Description |
| --- | --- |
| [system/.os/skills/buildos-export-azure-boards/adapters/dynamics-365-ce/ADAPTER.md](../../../system/.os/skills/buildos-export-azure-boards/adapters/dynamics-365-ce/ADAPTER.md) | A one-line Command Prompt example beside the `sh` ones. |
