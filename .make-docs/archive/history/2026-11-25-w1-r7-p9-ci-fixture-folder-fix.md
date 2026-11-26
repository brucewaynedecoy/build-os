---
title: "W1 R7 P9 CI Fixture Folder Fix"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9-fix1"
summary: "Moved the fit-gap fixture's generated files out of a folder that the root .gitignore hides, so a fresh checkout has every file the tests need, and added a guard test for ignored fixture and golden files."
---

# W1 R7 P9 CI Fixture Folder Fix

## Changes

CI run 45535678445 on `4c02048` failed 25 tests on Ubuntu, macOS, and Windows: every fit-gap parity case, the workbook structure tests, and the fit-gap hostile tests. The root `.gitignore` rule `build/` matched `toolkits/buildos/test/fixtures/skills/fitgap/bases/library/build/`, so its 36 generated files were never committed (finding P9-R1-09). The folder is now `analysis/`: the generator writes there, the cases name `analysis/...`, the 14 fit-gap goldens were captured again with the scripts at `38d1e08` (only the folder name and the workbook time openpyxl writes changed), SD-03 pins the new paths, and the tests use them. No ignore rule changed. A new guard test (`test/fixture-tracking.test.ts`) asks git whether any file under `test/fixtures/` or `test/golden/` matches an ignore rule (`git check-ignore --no-index`), and shows that the old folder would be caught.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-ci-run-45535678445).

| Area | Summary |
| --- | --- |
| Fixture (P9-R1-09) | `test/fixtures/skills/generate-fitgap.ts` and `test/fixtures/skills/fitgap/`: `build/` is now `analysis/` |
| Goldens | `test/golden/skills/fitgap/cases/` and `xlsx/`, captured again; `divergences.json` SD-03 paths |
| Guard | `test/fixture-tracking.test.ts` |
| Checks | The parity, hostile, workbook, and guard tests: 95 of 95 on macOS at this commit |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

None this session (the evidence report changes in the closing documentation commit).

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/test/golden/skills/divergences.json](../../../toolkits/buildos/test/golden/skills/divergences.json) | SD-03 names the fixture paths under `analysis/`. |

### User

None this session.
