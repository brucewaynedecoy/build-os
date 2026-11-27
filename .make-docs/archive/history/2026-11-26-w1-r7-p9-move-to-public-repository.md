---
title: "W1 R7 P9 Stages 1 and 2 Moved to the Public Repository"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/p9-skill-commands"
summary: "Moved the finished P9 Stage 1 and Stage 2 work (extract, fitgap, export, intake --json, their goldens, tests, and records) from the private archive into the public repository as file content only, resolved four conflicts, pointed the P9 owner decision links at the renamed P9 section, and noted that the moved commit hashes and branch names name the private archive."
---

# W1 R7 P9 Stages 1 and 2 Moved to the Public Repository

## Changes

Moved the finished W1 R7 P9 Stage 1 and Stage 2 work into the public repository as file content only, on the branch `rewrite/p9-skill-commands` from `6db975a` (the head of pull request 5, not merged yet). The source is the private archive diff from `38d1e08` to `1240758`: 332 files, 49,225 lines added and 179 removed, with the commands `buildos extract bulk`, `buildos fitgap`, and `buildos export azure-boards`, the intake `--json` envelope, their goldens, fixtures, and tests, and their records. No archive commit, commit message, or author data came along. Four conflicts were merged by content (PRD 20, `SECURITY.md`, the evidence report, and the generated guide); the P9 heading `Owner Decisions 2026-11-25` became `P9 Owner Decisions 2026-11-25`, and 15 P9 links follow it. Stage 3 (t9 to t13) is not part of this move.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-move-to-the-public-repository-2026-11-26).

| Area | Summary |
| --- | --- |
| Goldens and fixtures | 78 files under `toolkits/buildos/test/golden/` and 188 under `toolkits/buildos/test/fixtures/`, as in the archive, except the owner decision links in three record files |
| Commands and tests | 36 files under `toolkits/buildos/src/` and 13 more test files; `test/golden/compare.test.ts` accepts an owner decision link to the P9 section |
| Records | The 10 P9 history records of 2026-11-24 and 2026-11-25, kept as dated records; PRD 03 (`D-010` closed), PRD 20 (Output and Exit Contract and its history), the P9 phase file, the evidence report, the guide chapter 4 and app, the package README, and `SECURITY.md` |
| Archive references | One note in the P9 introduction of the evidence report: the 13 archive commit hashes and the branches `rewrite/ts-cli-p9` to `rewrite/ts-cli-p9-owner4` name the private archive |
| Checks | Typecheck, build, and `npm test` (2,732 tests, 0 fail) on Node 26; paths, PRD, and markdown checks no worse than the base; the real-list deny-list check finds 0 matches |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P9 sections, the archive note, and the new section P9 Move to the Public Repository. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | t1 to t8 done; the status names this move. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `D-010` closed. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Output and Exit Contract for `--json` on every domain command, with its requirement history. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Skill-script command reads, writes, bounds, and known limits. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | `intake` prints the envelope from `0.2.0`; the help and `--json` order; the guide app is rebuilt. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md) | The same in the package README. |
