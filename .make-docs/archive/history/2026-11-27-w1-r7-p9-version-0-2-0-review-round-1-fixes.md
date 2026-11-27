---
title: "W1 R7 P9 Version 0.2.0 Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.2.0-version"
summary: "Fixed the findings of review round 1 of pull request 11: step 0 of the 0.2.0 runbook holds the P8 exit gate as open owner decisions, h2 to h5 say what ran and what did not, the runbook commands are exact, the release notes and SECURITY.md say only what is true, and a test runs the release-body filter."
---

# W1 R7 P9 Version 0.2.0 Review Round 1 Fixes

## Changes

Fixed the findings of review round 1 of pull request 11 (FAIL on `a577bc9`; the package gates passed) in the release runbook, the release notes, and `SECURITY.md`. Step 0 of the `0.2.0` runbook now needs P8 closure or a dated owner exception that names each open item (t25, A71, t17 and A73, t16 and A72, and F-P9-01 with the Human Experience Review), each one owner decision with its question and each still open; "F-P9-15 merged" is a precondition, and anything that merges after the dry run needs a new dry run and review. Under the orchestrator decisions of 2026-11-27 (the owner may overrule), h2 has one route, the three-system tarball smoke of F-P9-15, run while the dry-run artifact exists, and h4 records that no `0.2.0` performance measurement runs before approval, with one `PERF-002` pass after publication in a fixed order. h5 lists what ran with run IDs and what did not, and the step i approval names each accepted omission. Step f adds the owner's check of the two settings that no job can read, release immutability and the ruleset bypass actors. The commands of steps b, c, e, h1, and h3 are exact; h3 was rehearsed on a clean release-stamped local pack of this branch (168 files, 1,141,583 bytes) and passed. The release notes qualify the exit `10` and SD-11 statements and add five adopter-visible limits. `SECURITY.md` describes the provenance result after publication and extracts the draft-release notes from the tag. `test/release-notes.test.ts` runs the release-body filter of the runbook and `SECURITY.md` on the tagged notes file.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-1-pull-request-11-2026-11-27).

| Area | Summary |
| --- | --- |
| Runbook | The evidence report: the open-items table, the staged-version and trusted-publishing paragraphs, steps 0 to k, the orchestrator decisions, the owner decisions, and two corrected Check Results rows |
| Release notes | `toolkits/buildos/RELEASE_NOTES.md`: "What is new", "Changed for 0.1.0 users", and "Known limits" of `0.2.0` |
| Security | `toolkits/buildos/SECURITY.md`: "How to Check a Release" step 1; Release Procedure steps 2 and 4 |
| Tests | `toolkits/buildos/test/release-notes.test.ts` (new) |
| Records | The evidence report (new section Review Round 1 (Pull Request 11) with the h3 rehearsal and the checks), the P9 phase file (t13 status) |

Stacked on pull request 10 (`feat/capability-matrix-command`) and pull request 9 (`fix/f-p8-11-printed-commands`), neither merged. No source file under `src/`, release workflow, `release-candidates.json`, acceptance criterion, or gate text changed; no checkbox changed, and A81 stays open. Nothing is published.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed.

Review round 2 (same day): step h1 of the release runbook now binds the stage download to the release run through a transparency-log lookup by the file's SHA-512 (checked on `0.1.0`); step 0 exempts the reviewed ledger-only merge from the new-dry-run rule; the runbook says that step j is an owner-enforced gate, because nothing technical stops an early npm approval; the release notes say that `capability-matrix` exits `10` when the rollback or the cleanup is incomplete.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The corrected runbook and the new section Review Round 1 (Pull Request 11): each finding and its fix, the clean stamped pack, the h3 rehearsal, the checks. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | t13 status: F-P9-15 before the dry run; step 0 holds the P8 exit gate. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | Exact exit statements and the new known limits of `0.2.0`. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The provenance check before and after publication; the release body from the tag; the owner's settings check before publishing a draft. |
