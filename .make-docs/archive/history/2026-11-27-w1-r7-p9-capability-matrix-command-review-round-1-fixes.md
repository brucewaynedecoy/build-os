---
title: "W1 R7 P9 Capability-Matrix Command Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/capability-matrix-command"
summary: "Fixed the five findings of review round 1 of pull request 10: buildos capability-matrix compares, hashes, and sorts numbers by exact value, reads integers at Python's limits, skips empty optional values, and builds no pattern from the system code; the skills' commands are one line with quoted paths; three new golden cases and SD-27."
---

# W1 R7 P9 Capability-Matrix Command Review Round 1 Fixes

## Changes

Fixed the five findings of review round 1 of pull request 10 (F-P9-04), each first run again with the pinned `cm_build.py` and the command side by side. `buildos capability-matrix` now compares, hashes, and sorts numbers by their exact value, as Python does (`pyEqual`, `pyEqualItem`, `pyHashKey`, `pyOrder`, and `pySorted` in `src/core/capability-matrix/py-values.ts`): `assemble` restores a skeleton `doc_ref` of `9007199254740992` over a part's `9007199254740993`, `1`, `1.0`, and `True` stay one key, and json's one `NaN` equals itself only where Python compares by identity first. `int()` of a CSV count follows Python 3.14 (its white space, not U+001C to U+001F; the 4,300-digit limit; the repr cut to 200 characters), and the shared JSON reader reads an integer of up to 4,300 digits and a float of any length, and gives int()'s `ValueError` above that (`PyIntDigitsError`; `buildos fitgap` and `buildos extract bulk` keep their goldens). An empty `--narrative=` or `--fitgap=` skips its checks, an empty pattern matches nothing (`pyGlob`, with `buildos fitgap` unchanged), and an empty path is `[Errno 2]`. The id check builds no pattern from the system code: the code is a literal prefix and the rest a fixed pattern, and a code with a pattern character still stops (SD-26, owner decision open, built as option A). An unhashable value is named in Python 3.14's words. The skills' commands are one line with `"<buildos>"` and `--root "<project>"` quoted (`capability-matrix`, `fit-gap-analysis`, `buildos-export-azure-boards` and its CSV contract, `buildos-bulk-extract`, and guide chapter 14), the capability-matrix delivery step carries the CSV formula warning, the help and the skill name exit 10, and the maintainer page no longer says the no-Python exception stays. Three new golden cases (15 steps) were captured from the pinned tool, so 18 cases and 81 steps pass byte for byte; SD-23 pins six more crash steps and SD-27 records Python's hash-order sort of a set that cannot be ordered. A side-by-side pass of 66 new inputs (74 steps) found four differences: one fixed, three recorded, none left unrecorded. Follow-ups F-P9-11 (no aggregate read limit across matched files) and F-P9-12 (`buildos fitgap`'s number helpers and empty pattern) are new.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-1-pull-request-10).

| Area | Summary |
| --- | --- |
| Command | `toolkits/buildos/src/core/capability-matrix/py-values.ts`, `cm-build.ts`; `src/cli/commands/capability-matrix.ts` (exit 10 in the help) |
| Shared ports | `src/core/shared/py-json.ts` (`PY_INT_MAX_STR_DIGITS`, `PyIntDigitsError`, no number length cap); `src/core/fitgap/fitgap.ts` (`pyGlob('')`, the digit error); `src/core/extract/bulk.ts` (the digit error as Python's `ValueError`) |
| Fixtures and goldens | `test/fixtures/skills/generate-capability-matrix.ts` and `test/fixtures/skills/capability-matrix/` (cases `exact-numbers`, `integer-limits`, `empty-values`); `test/golden/skills/capability-matrix/cases/`; `test/golden/skills/capture-record.json` (18 cases) |
| Divergences | `test/golden/skills/divergences.json`: SD-23 (six steps, an empty path, the digit limit, Python 3.14's words), SD-26 (no pattern from the code; decision open, built as A), SD-27 (new) |
| Tests | `test/capability-matrix.test.ts` (numbers, int() and JSON limits, empty values, SD-26, SD-27, exit 10); `test/azure-boards-skill-examples.test.ts` (double-quoted words) |
| Skills and guide | `system/.os/skills/capability-matrix/SKILL.md`, `fit-gap-analysis/SKILL.md`, `buildos-export-azure-boards/SKILL.md` and `references/azure-boards-csv-contract.md`, `buildos-bulk-extract/SKILL.md`; `guide/content/14-export-to-a-work-tracker.md` and the guide app |
| Records | The evidence report, the P9 phase file, the risk register (R-003), `SECURITY.md`, `docs/assets/maintainer/buildos-toolkit-cli-development.md`, `.github/workflows/buildos-ci.yml` (a comment) |

Stacked on pull request 9 (`fix/f-p8-11-printed-commands`), which is not merged. No version, release candidate, tag, release, or stage changed.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; chapter 14.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section Review Round 1 (Pull Request 10): each finding with its reproduction, fix, and fixture or test; the number audit; the differential pass; follow-ups F-P9-11 and F-P9-12; the checks. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | F-P9-04 status: 18 cases, 81 steps, SD-23 to SD-27. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: the case count, SD-27, and Q1 built as option A. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | CSV formula prefixes (the skill's delivery step); SD-04 to SD-27. |
| [docs/assets/maintainer/buildos-toolkit-cli-development.md](../../../docs/assets/maintainer/buildos-toolkit-cli-development.md) | Layout: the `capability-matrix` core folder; no no-Python exception. |

### User

| Path | Description |
| --- | --- |
| [system/.os/skills/capability-matrix/SKILL.md](../../../system/.os/skills/capability-matrix/SKILL.md) | One-line commands with quoted `<buildos>` and `<project>`; the CSV formula warning at delivery; exits 5 and 10. |
| [system/.os/skills/fit-gap-analysis/SKILL.md](../../../system/.os/skills/fit-gap-analysis/SKILL.md), [buildos-export-azure-boards/SKILL.md](../../../system/.os/skills/buildos-export-azure-boards/SKILL.md), [its CSV contract](../../../system/.os/skills/buildos-export-azure-boards/references/azure-boards-csv-contract.md), [buildos-bulk-extract/SKILL.md](../../../system/.os/skills/buildos-bulk-extract/SKILL.md) | One-line commands, quoted paths, double quotes. |
| [guide/content/14-export-to-a-work-tracker.md](../../../guide/content/14-export-to-a-work-tracker.md) | One-line commands; the shell sentence. |
