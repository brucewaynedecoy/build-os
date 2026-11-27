---
title: "W1 R7 P9 Publication Record for 0.2.0"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.2.0-publication-record"
summary: "Recorded the publication of build-os@0.2.0 on 2026-11-27 (runbook step k): who did each step, the run IDs, stage ID, times, and digests, the missed order of the npm stage approval, the registry checks, the transparency-log lookup, the registry smoke on three systems, F-P8-09 on macOS only, and the open owner question; removed the draft status line of the 0.2.0 notes and moved the smoke workflow default to 0.2.0."
---

# W1 R7 P9 Publication Record for 0.2.0

## Changes

Recorded the publication of `build-os@0.2.0` on 2026-11-27 at 17:49:05.907Z (runbook step k) in the evidence report, with who did each step, the run IDs (dry run 46020963025, step c smoke 46021631698, prepare run 46043008348, release run 46043810434, registry smoke 46045192196), the stage ID `6b67a1e5-e85b-49d7-a7b5-046bcb7288ca`, the times, and the digests (SHA-256 `baf54ebf…f20da0` from the reviewed entry to the registry tarball). The record states plainly that the owner approved the npm stage right after the stage job, before steps h1, the second h2 run, h4, h5, and the step i approval, so A81 is not met for `0.2.0`; it writes the retrospective publication review and the owner's yes-or-no question and leaves the question open. After publication: the registry checks and the transparency-log lookup of h1 on the registry tarball passed (log index 4150680395 names `buildos-release.yml@refs/tags/v0.2.0` and run 46043810434); the registry smoke passed on Linux, macOS, and Windows, and its step 10 closes F-P8-10 and F-P8-11; the public rollback `0.2.0` to `0.1.0` through `npx` (F-P8-09) passed on macOS only, so t16 and A72 stay open; `PERF-002` is not measured. The three step records of steps b, c, and h3, written outside the repository before the tag, are added unchanged. The `0.2.0` notes lose their draft status line, and the `buildos-smoke` workflow's default version (and the registry mode of a pull-request run) is `0.2.0`, with its test. No checkbox changes under the checkbox rule.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [Release Runbook for 0.2.0](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#release-runbook-for-020).

| Area | Summary |
| --- | --- |
| Workflow | `.github/workflows/buildos-smoke.yml`: the `version` input defaults to `0.2.0`, and a pull-request run's registry mode uses `0.2.0` |
| Tests | `toolkits/buildos/test/release-workflow.test.ts`: the default and the pull-request version are `0.2.0` |
| Release notes | `toolkits/buildos/RELEASE_NOTES.md`: the draft status line of `0.2.0` is removed |
| Records | The evidence report (Publication Record for 0.2.0, the facts table, the open-items table, the runbook status, the decisions list); the P8 and P9 phase files (status notes) |
| Register | `R-003` (the `0.2.0` publication and the missed order), `R-010` (the `0.2.0` scans), `Q-012` (its gate is due) |

Nothing is published, staged, tagged, or deprecated by this change, and no setting changed. No source file under `src/`, version, `release-candidates.json`, golden output, parity exception, acceptance criterion, or gate text changed. No owner decision is recorded that the owner did not give.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed. New follow-up F-P9-16 (a rollback step in the smoke workflow, for F-P8-09 on three systems).

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Publication Record for 0.2.0, with the step b, c, and h3 records; the facts table; the open-items table; the runbook status. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | t16 and A72 status after F-P8-09 on macOS; a closeout note. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | Stage 3 status after the publication; the acceptance gate note. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `R-003`, `R-010`, and `Q-012`. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The draft status line of the `0.2.0` notes is removed. |

### User

None this session.
