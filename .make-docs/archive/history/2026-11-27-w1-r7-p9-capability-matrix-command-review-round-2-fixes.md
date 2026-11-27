---
title: "W1 R7 P9 Capability-Matrix Command Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/capability-matrix-command"
summary: "Fixed the five findings of review round 2 of pull request 10: buildos capability-matrix looks paths up as the operating system does, reports a lone surrogate at Python's position and range, and gives makedirs' errors for --out; extract bulk's integer-digits error is exit 3 again; examples quote every variable file name; one new golden case."
---

# W1 R7 P9 Capability-Matrix Command Review Round 2 Fixes

## Changes

Fixed the five findings of review round 2 of pull request 10 (F-P9-04), each first run again with the pinned `cm_build.py` and the command side by side. `buildos capability-matrix` now looks every path up as macOS and Linux do, one name at a time (`osLookup` and `pyGlob(..., { spelled: true })` in `src/core/fitgap/fitgap.ts`, `entryExists` in `src/core/shared/project-files.ts`): `--parts p.json/`, `p.json/.`, `p.json/../p.json`, and `gone/../p.json` match nothing, a final separator matches only folders, a link that leads nowhere is matched and then cannot be opened, every read gives `open()`'s `[Errno 2]`, `[Errno 20]`, or `[Errno 21]`, and `--out` gives `os.makedirs`' `[Errno 17]` or `[Errno 20]`; `..` is still folded as text, recorded in SD-24 with its two visible cases (a `..` after a folder link, and `--out gone/../o`). `buildos fitgap` keeps its own rule (F-P9-12 stays open). A lone surrogate is reported at the position Python gave, counted in the chunk that Python wrote (`cmDumpChunks` gives `json.dump`'s chunks; each CSV row and printed line is one chunk), and a run of surrogates as one range (`checkEncodable`). `extract bulk` classifies int()'s `ValueError` for an integer of more than 4,300 digits as an input error, so it exits 3 again, in Python's words; the reader's change is the only change in `extract bulk` and `buildos fitgap` since `eb0187f`, and a test per caller holds it. The `repr` of a character that Unicode 17.0 added (U+11DE1) is recorded as a Unicode-version difference (Python 3.14.10 with Unicode 16.0, Node 26.13.1 with Unicode 17.0) and pinned in a test. Every variable file name in the four migrated skills, their reference and adapter files, and the guide is in double quotes, and each changed example ran with a name that holds a space. One new golden case (5 steps) was captured from the pinned tool, so 19 cases and 86 steps pass byte for byte; SD-23 pins three more crash steps. A side-by-side pass of 77 new inputs found four differences: two fixed, two recorded, none left unrecorded. F-P9-11 notes that one float token can now take nearly a whole file's read allowance.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-2-pull-request-10).

| Area | Summary |
| --- | --- |
| Command | `toolkits/buildos/src/core/capability-matrix/cm-build.ts` (`checkOpen`, `checkOut`, chunked writes), `py-values.ts` (`cmDumpChunks`, `checkEncodable`) |
| Shared ports | `src/core/fitgap/fitgap.ts` (`osLookup`, opt-in `spelled` glob; `buildos fitgap` unchanged); `src/core/shared/project-files.ts` (`entryExists`); `src/core/extract/bulk.ts` (exit 3 for the digit error); `src/core/shared/py-json.ts` (a comment only) |
| Fixtures and goldens | `test/fixtures/skills/generate-capability-matrix.ts` and `test/fixtures/skills/capability-matrix/` (case `spelled-paths`); `test/golden/skills/capability-matrix/cases/spelled-paths.json`; `test/golden/skills/capture-record.json` (19 cases) |
| Divergences | `test/golden/skills/divergences.json`: SD-01 (`FileExistsError`), SD-23 (three steps, the `open` and `makedirs` errors, the surrogate range), SD-24 (how a path is looked up, the two `..` folds) |
| Tests | `test/capability-matrix.test.ts` (paths, surrogate positions, the Unicode version, the JSON reader in each caller) |
| Skills and guide | `system/.os/skills/capability-matrix/SKILL.md`, `fit-gap-analysis/SKILL.md`, `buildos-export-azure-boards/SKILL.md` and `adapters/dynamics-365-ce/ADAPTER.md`; `guide/content/` chapters 5, 11, 14, 19, and 20, and the guide app |
| Records | The evidence report, the P9 phase file, the risk register (R-003) |

Stacked on pull request 9 (`fix/f-p8-11-printed-commands`), which is not merged. No version, release candidate, tag, release, or stage changed. SD-26 stays "owner decision open, built as A".

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; chapters 5, 11, 14, 19, and 20.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section Review Round 2 (Pull Request 10): each finding with its reproduction, fix, and fixture or test; `buildos fitgap` and F-P9-12; the callers of the JSON reader against `eb0187f`; the differential pass; the Unicode-version paragraph; F-P9-11. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | F-P9-04 status: 19 cases, 86 steps. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: the case count. |

### User

| Path | Description |
| --- | --- |
| [system/.os/skills/capability-matrix/SKILL.md](../../../system/.os/skills/capability-matrix/SKILL.md), [fit-gap-analysis/SKILL.md](../../../system/.os/skills/fit-gap-analysis/SKILL.md), [buildos-export-azure-boards/SKILL.md](../../../system/.os/skills/buildos-export-azure-boards/SKILL.md), [its Dynamics 365 adapter](../../../system/.os/skills/buildos-export-azure-boards/adapters/dynamics-365-ce/ADAPTER.md) | Every variable file name in double quotes. |
| [guide/content/14-export-to-a-work-tracker.md](../../../guide/content/14-export-to-a-work-tracker.md) and chapters 5, 11, 19, and 20 | Every variable file name in double quotes. |
