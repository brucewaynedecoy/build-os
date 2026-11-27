---
title: "W1 R7 P8 Post-Publication Checks Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.1.0-post-publication-checks"
summary: "Recorded the defect F-P8-11 in the published build-os 0.1.0 (a printed fix command with a bare buildos), corrected the A71 comparison to the final reviewed P6 output (5 differences), and corrected the PERF-002 tarball wording."
---

# W1 R7 P8 Post-Publication Checks Review Round 1 Fixes

## Changes

Fixed the five findings of review round 1 of pull request 5. The record now states one defect in the published `build-os@0.1.0`, reproduced on macOS in a clean folder with a clean npm cache: `entities validate` prints the fix command `buildos entities rebuild-index ...` with a bare `buildos`, which exits 127 for an adopter with no global install, while `.os/scripts/buildos entities rebuild-index ...` and `npx -y build-os@0.1.0 entities rebuild-index ...` exit 0; the data and the validation result are correct, the Go tool printed the same command, and F-P8-11 tracks it as a candidate for `0.1.1` or `0.2.0` with the owner decision open, together with the other printed bare commands (`buildos help`, `buildos validate`, `buildos init`). The A71 comparison now uses the final reviewed P6 output: 5 differences need the owner's acceptance (the package name, the 21 skills in the plan, the Make Docs sentence of P8-F-06, the legacy-wrapper notice, and the wrapper's `npx` call), not ten. The `PERF-002` decision calls the tarball fetch a reference measurement and states its limits instead of an upper bound. One illustrative Windows path is now a placeholder. One user guide says how to run the printed recovery command. No shipped source changed.

Framing: [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) and [Review Round 1 of Pull Request 5](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-1-of-pull-request-5-2026-11-26).

Deferred obligations and Unassisted Goal Testing: `not-needed-now`. Guide coverage: `update-existing`; one sentence in one user guide, for F-P8-11.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The F-P8-11 defect section with the reproduction, the other printed bare commands, and the Go baseline; the corrected A71 comparison; the corrected `PERF-002` decision; the review round 1 dispositions and checks. Review round 2 (same day): the legacy-name notices added to the list of printed bare commands, the reproduction without system folder paths, and the follow-ups F-P8-12 and F-P8-13. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | t15, t23, A71, and the post-publication status line corrected. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `R-003` names the defect, F-P8-11, and the 5 differences. |
| [.make-docs/archive/history/2026-11-26-w1-r7-p8-post-publication-checks.md](2026-11-26-w1-r7-p8-post-publication-checks.md) | Factual corrections in place: the defect and the count of differences. |

### Maintainer

None this session.

### User

| Path | Description |
| --- | --- |
| [docs/assets/user/entities-consolidation-curate-and-resolve-records.md](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md) | The printed recovery command always runs with `<buildos>` in place of its bare `buildos`, so it uses the selected version (CodeRabbit comment on `4afd19d`). |
