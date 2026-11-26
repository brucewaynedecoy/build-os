---
title: "W1 R7 P9 Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9-fix1"
summary: "Fixed the findings of the independent review of the P9 skill-script commands: checked reads, rename-based writes that never read a destination, transactional bulk-extract writes with truthful write status, buildos validate checks before publication, contained pattern expansion, sheet-name and model checks for the workbook, and safer tests."
---

# W1 R7 P9 Review Round 1 Fixes

## Changes

Fix round 1 for P9 Stages 1 and 2 after the independent review of `4c02048`, on the branch `rewrite/ts-cli-p9-fix1`. The CI fixture failure (P9-R1-09) is fixed in the commit before this one. Nothing was pushed, merged, published, staged, tagged, or released.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-review-round-1).

| Area | Summary |
| --- | --- |
| Reads (P9-R1-05) | Every project read of the three commands goes through `readFileLimited` with the in-root link rule (`project-files.ts`, `bulk-files.ts`) |
| Writes (P9-R1-04, -06) | `WritePlan` never reads a destination: a new file under a private name, the old entry moved aside by rename, a link replaced and never followed, undo by rename; `fitgap packages` cleans an authorized outside folder too; the port's `rename` takes `entries` |
| Bulk transaction (P9-R1-10, -11) | Every write of a command is queued, checked (sizes, folders, no folder at a file's name), then made in the script's order; undo in reverse; `write_status` and exit 10 are truthful; a publication resumes after a partial undo |
| Validate rules (P9-R1-01) | Candidate and published rows pass `buildos validate`'s row checks with the project config, at check, stage, decide, and publish |
| Paths (P9-R1-02, -13) | Patterns expand from their literal folder inside the project, outside is exit 3; typed paths follow the shared `system/` layout rule |
| Workbook (P9-R1-03, -08, -19, -20, -21) | Sheet names checked before building; both models' identities compared; one pass per sheet extent; true shared-string count; `_xHHHH_` escaped; `#N/A` kept as text; title cleaned |
| Script defects (P9-R1-07, -14) | `uncited` reads string target IDs as `merge` does; CSV rows with surplus or missing fields are read as `csv.DictReader` reads them (a new golden case) |
| CLI (P9-R1-12, -15, -16) | JSON mode known before a `--root` error; `--help` at every level; oversized standard input exit 3; a 512-level bound for every JSON input |
| Lock (P9-R1-22) | The lock file records process, host, and time; the message says how to check and clear it |
| Capture (P9-R1-17) | `capture.ts --check` compares reproducible facts only; provenance keeps versions and wheel SHA-256 |
| Tests (P9-R1-18) | `test/skill-script-review.test.ts` (31 tests); capped helpers in every P9 test file, enforced by `test/test-output-safety.test.ts`; case-to-golden names compared both ways |
| Divergences | SD-02, SD-04, SD-05, SD-06, SD-09, SD-11, SD-13 corrected; SD-15 to SD-19 new |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

None this session (the evidence report and the phase file change in the closing documentation commit).

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Checked reads, rename-based writes, the bulk transaction, the validate checks, the lock record, CSV formula prefixes, and workbook text in Known Limits. |
| [toolkits/buildos/test/golden/skills/divergences.json](../../../toolkits/buildos/test/golden/skills/divergences.json) | Corrected and new divergences, with owner recommendations for those that change a result. |
| [toolkits/buildos/test/golden/skills/capture-record.json](../../../toolkits/buildos/test/golden/skills/capture-record.json) | Reproducible facts and provenance kept apart. |

### User

None this session.
