---
title: "W1 R7 P9 Skill-Script Goldens"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9"
summary: "Built invented fixtures for the three skill scripts, captured what each script does on them, and recorded the .xlsx content comparison rule as proposed parity exception PE-021."
---

# W1 R7 P9 Skill-Script Goldens

## Changes

W1 R7 P9 Stage 1 (t1 to t3), started before the P8 exit gate on its own branch `rewrite/ts-cli-p9` (a recorded departure from the default order): 60 invented fixture cases for `work.py`, `fitgap.py`, and `azure_boards_csv.mjs` on the library book-lending topic, made by three generator scripts; a scenario harness that runs a case's steps the same way for a script and for BuildOS; a capture script that runs each script, read from git at `38d1e08` with a pinned SHA-256, under a fixed clock and hash seed, and records stdout, stderr, the exit code, and every written file; the goldens of all 300 runs; and a workbook content reader and comparison helper, with the `.xlsx` rule recorded as proposed parity exception PE-021 for the owner.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-skill-script-commands).

| Area | Summary |
| --- | --- |
| Fixtures (t1) | `toolkits/buildos/test/fixtures/skills/`: 35 `bulk-extract`, 14 `fitgap`, and 11 `azure-boards` cases from `generate-*.ts`, covering every subcommand and option, the error paths a user can reach, Unicode, CRLF, byte order marks, large inputs, and owner names and colors from the frame and the palette |
| Capture (t2) | `test/golden/skills/capture.ts` and `scenario.ts`; goldens in `test/golden/skills/<script>/cases/`, openpyxl workbooks in `fitgap/xlsx/`; `capture-record.json` names Python 3.14.10, openpyxl 3.1.5 (with its RECORD hash), Node 26.13.1, and the normalizations |
| `.xlsx` rule (t3) | `src/core/fitgap/xlsx-read.ts` and `xlsx-model.ts` (on the repository's Go XML port and intake ZIP reader), `src/adapters/xlsx-zip.ts`, `test/xlsx-compare.ts`; proposed PE-021 pending the owner (A76) |
| Defect found | `work.py` wrote the keys of a Python set, so its output order changed with each run's hash seed; the capture fixes `PYTHONHASHSEED=0` |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

None this session (the phase file and the evidence report change in the closing documentation commit).

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/test/golden/proposed-exceptions.json](../../../toolkits/buildos/test/golden/proposed-exceptions.json) | Proposed parity exception PE-021, the `.xlsx` content rule, pending the owner. |
| [toolkits/buildos/test/golden/skills/capture-record.json](../../../toolkits/buildos/test/golden/skills/capture-record.json) | The capture record: scripts, interpreters, clock, and normalizations. |

### User

None this session.
