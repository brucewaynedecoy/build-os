---
title: "W1 R7 P9 Rollback Smoke Review Round 2"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.2.0-closeout"
summary: "Review round 2 of pull request 15: the F-P9-17 diagnosis now claims only what run 3 measured, the guide names the Windows exit code exception, and the rollback smoke stops when one of its first two route guards fails."
---

# W1 R7 P9 Rollback Smoke Review Round 2

## Changes

Review round 2 of pull request 15 found that the F-P9-17 diagnosis claimed more than run 3 measured, that the guide promised exit `2` for an unknown skill command where Windows gives `0` through the project wrapper, and that a failed route guard did not stop the rollback smoke. The evidence, R-003, the phase notes, and the step's reading in `toolkits/buildos/scripts/rollback-steps.ts` now say that the code is lost on the wrapper invocation path (a `.cmd` wrapper started through `cmd.exe`), that npm and the helper started directly pass it, and that the batch file's own exit path is the leading hypothesis, not shown ("cause (b) consistent, not isolated"); the first task of the fix is to run both forms under the same `cmd.exe` and read `%ERRORLEVEL%` right after each. Chapter 4 of the guide names the Windows exception where it first describes the failure and in the repeated claim, and `guide/BuildOS-Guide.html` is rebuilt. In `toolkits/buildos/scripts/rollback-smoke.ts` the first two route guards go through `need()`, so the run stops before any command on a disqualified route; on this Mac the smoke passed (75 of 75 steps) and stopped with exit 1 after the first guard with an install above the temporary root. Run 3 remains the proof of F-P8-09; run 4 has a marked place.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-2-pull-request-15-2026-11-27).

| Area | Summary |
| --- | --- |
| Scripts | `toolkits/buildos/scripts/rollback-smoke.ts`, `toolkits/buildos/scripts/rollback-steps.ts` |
| Tests | `toolkits/buildos/test/rollback-smoke.test.ts` |
| Guide | `guide/content/04-install-and-configure-your-instance.md`, `guide/BuildOS-Guide.html` (rebuilt) |
| Evidence | The F-P9-17 wording, the run 4 place, the review round and its checks |
| Risk register | R-003: the run 3 paragraph |

Nothing is published, staged, tagged, or deprecated by this change, and no setting changed. No source file under `src/`, no wrapper under `system/.os/scripts/`, no version, `release-candidates.json`, golden output, or parity exception changed. The product defect F-P9-17 is not fixed.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; two sentences in chapter 4.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The F-P9-17 wording, the run 4 place, and review round 2 of pull request 15. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | The F-P9-17 qualification wording. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | The F-P9-17 note after run 3. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: the run 3 paragraph. |

### Maintainer

None this session.

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | The Windows exit code exception for an unknown skill command. |
