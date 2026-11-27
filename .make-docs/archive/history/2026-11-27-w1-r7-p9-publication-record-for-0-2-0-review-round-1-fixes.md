---
title: "W1 R7 P9 Publication Record for 0.2.0 Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.2.0-publication-record"
summary: "Fixed the findings of review round 1 of pull request 14: SECURITY.md says that 0.2.0 is published and that pull-request smoke runs use 0.2.0, the rollback record gives each exit code, R-003 and R-010 say exactly which gates passed and when the signatures were verified, and two tests no longer depend on the published notes or the host PATH."
---

# W1 R7 P9 Publication Record for 0.2.0 Review Round 1 Fixes

## Changes

Fixed the findings of review round 1 of pull request 14 (FAIL on `414a294`). `toolkits/buildos/SECURITY.md` now says that `build-os@0.2.0` is published and `latest` and that its provenance commands give the result, and that a pull-request smoke run uses the `registry` source on `0.2.0`; the published package and the GitHub Release do not change, so their copy of `SECURITY.md` still has the old text in those two passages, and the evidence report says so. A search of the whole repository found two more `R-003` entries that said "(not released)" with no date context, now corrected. The F-P8-05 facts table names the text changes. The F-P8-09 rollback record gives each exit code of rollback step 5 on its own, with the two expected exit codes `1` (`command -v buildos` on the isolated `PATH`, and `.os/scripts/buildos-intake version` under `0.1.0`), re-run on a new `0.1.0` project. `R-003` says that the automated workflow gates passed and A81 did not; `R-010` says that `npm audit signatures` ran after the publication, in step k. `test/release-notes.test.ts` puts a draft status line into its scratch copy of the notes, so the test proves that the release-body filter removes it. The missing-launcher test of `test/smoke-tarball.test.ts` gives its child processes a `PATH` with only Node.js and the system folders, so it passes with a global `build-os` installed; the evidence text that called this a failure of the machine is corrected. The Markdown check summary counts the six findings by location.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-1-pull-request-14-2026-11-27).

| Area | Summary |
| --- | --- |
| Security | `toolkits/buildos/SECURITY.md`: "How to Check a Release" step 1 and "Smoke Workflow" |
| Tests | `toolkits/buildos/test/release-notes.test.ts`, `toolkits/buildos/test/smoke-tarball.test.ts` |
| Register | `R-003` (the gates before the approval; two dated entries), `R-010` (when the signatures were verified) |
| Records | The evidence report: the facts table (F-P8-05), the F-P8-09 rollback table, Documentation Changes (Step k), Check Results (Publication Record), and the new section Review Round 1 (Pull Request 14) |

Nothing is published, staged, tagged, or deprecated by this change, and no setting changed. No source file under `src/`, workflow, version, `release-candidates.json`, golden output, parity exception, acceptance criterion, gate text, or checkbox changed. The owner's retrospective approval question stays open. No owner decision is recorded that the owner did not give.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The corrected facts table, rollback table, and check summary; the new section Review Round 1 (Pull Request 14) with each finding, its fix, and the checks. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `R-003` and `R-010`. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | `0.2.0` is published; a pull-request smoke run uses `0.2.0`. |

### User

None this session.
