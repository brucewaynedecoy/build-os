---
title: "W1 R7 P9 Skill-Script Commands"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9"
summary: "Ported the three skill scripts to buildos extract bulk, buildos fitgap (with a hand-written .xlsx writer), and buildos export azure-boards, with parity on every fixture case and hostile-input tests."
---

# W1 R7 P9 Skill-Script Commands

## Changes

W1 R7 P9 Stage 2 (t4 to t8), on the branch `rewrite/ts-cli-p9`: `buildos extract bulk` (the port of `work.py`, with Python's JSON, repr, date, CSV, and error rules ported so its review files, staged rows, hashes, and messages are the script's byte for byte), `buildos fitgap` (the port of `fitgap.py`, with Python's arithmetic and the workbook written as hand-written Office Open XML parts zipped by the bundled `fflate`), and `buildos export azure-boards` (the port of `azure_boards_csv.mjs` and its Dynamics 365 CE adapter). Each has the shared help, envelope, `--root`, `--json`, and PRD 20 exit codes, reads only inside the project folder with bounds, and plans its writes so a failure leaves no files behind. On all 300 fixture runs stdout, stderr, and every CSV, Markdown, JSON, and JSONL file equal the scripts', except the recorded usage and crash texts, and every workbook equals openpyxl's by content; the 14 differences are recorded as divergences SD-01 to SD-14.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-skill-script-commands).

| Area | Summary |
| --- | --- |
| `extract bulk` (t4) | `src/core/extract/` (`bulk.ts`, `bulk-rules.ts`, `bulk-files.ts`, `py-lines.ts`), `src/cli/commands/extract.ts`; standard input bounded in `src/cli/io.ts`; a lock file instead of `flock` |
| `fitgap` (t5) | `src/core/fitgap/` (`fitgap.ts`, `py.ts`, `vocab.ts`, `workbook.ts`, `xlsx-write.ts`), `src/cli/commands/fitgap.ts`; owner names from the frame, colors from the frame or the project's skill palette |
| `export azure-boards` (t6) | `src/core/export/azure-boards/`, `src/cli/commands/export.ts` |
| Shared (t7) | `src/core/shared/py-json.ts`, `py-text.ts`, `py-datetime.ts`, `project-files.ts`; `src/cli/commands/skill-output.ts`; the clock in `RunOptions.now`; root help and PE-001's pinned value |
| Tests (t8) | `test/skill-script-parity.test.ts` (64), `test/skill-script-hostile.test.ts` (23, also the `--json` envelopes), `test/fitgap-xlsx.test.ts` (3, package structure and reproducibility), `test/golden/skills/divergences.json` |
| Checks on macOS | `npm test` 2,491 tests, 2,479 pass, 0 fail, 12 skipped; installed-tarball golden compare 167 of 167; bundle 3,638,507 bytes (+326,260) |
| Open | PE-021 owner decision; SD-04 owner question; a three-OS CI run; Stage 3 |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

None this session (the phase file and the evidence report change in the closing documentation commit).

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The `fflate` use for the workbook, the read bounds and sites, contained reads and planned writes of the three commands, read-back sizes, and the lock-file limit. |
| [toolkits/buildos/test/golden/parity-exceptions.json](../../../toolkits/buildos/test/golden/parity-exceptions.json) | PE-001's pinned root help, which now lists `extract`, `fitgap`, and `export`. |
| [toolkits/buildos/test/golden/skills/divergences.json](../../../toolkits/buildos/test/golden/skills/divergences.json) | Divergences SD-01 to SD-14 from the scripts. |

### User

None this session.
