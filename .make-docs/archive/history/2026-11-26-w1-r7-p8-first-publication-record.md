---
title: "W1 R7 P8 First Publication Record for 0.1.0"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.1.0-publication-evidence"
summary: "Recorded the npm publication of build-os 0.1.0 in the P8 evidence, marked t1 done, recorded the missed release gate in P8 and R-003, and removed the draft line from the 0.1.0 release notes."
---

# W1 R7 P8 First Publication Record for 0.1.0

## Changes

Recorded the first publication of `build-os@0.1.0` on 2026-11-26 in the P8 evidence. This is step 9 of First Publication in `toolkits/buildos/AGENTS.md`. The record holds the placeholder SHA-256, the dist-tags before and after (the earlier tags attributed to the owner's report and the orchestrator's read before the release), the trusted-publisher settings (owner-reported), the reviewed entry, the three workflow runs, the immutable GitHub Release, the GitHub approval of `buildos-npm-stage` for run 45894295344, the `0.1.0` stage ID `8b8c8ef6-9e53-4973-928b-7826f1ddc85d` from the `stage` job of that run, the npm provenance, and the smoke check. Only the placeholder's stage ID was not recorded. Marked P8 t1 done. Unticked t19 to t21: they were performed and the `PERF-001` result stands, pending stage acceptance. Recorded the release-order departure in the P8 Closeout Notes and in `R-003`: the owner published `0.1.0` and approved the npm stage before t15 to t18 and t22 to t24 were done, because the orchestrator's step list put the approval first. This was an orchestration mistake, not an owner decision to skip the checks. A74 and A75 are not met, t25 stays open, and the owner decision is open. Added a dated note to the Stage 4 dependencies. Removed the draft status line from the `0.1.0` release notes. No code, workflow, package, or ledger file changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and [First Publication of 0.1.0](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#first-publication-of-010-2026-11-26).

Deferred obligations and Unassisted Goal Testing: `not-needed-now`. Guide coverage: `not-needed`; no guide changed.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section First Publication of 0.1.0. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | t1 done; t19 to t21 performed, pending stage acceptance; release-order departure; Stage 4 dependency note; status line after the publication. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `R-003` links the missed release gate. Its issue, follow-up, and gate fields say what is true after the publication. |

### Maintainer

None this session.

### User

| Path | Description |
| --- | --- |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The draft status line is removed. |
