---
title: "W1 R7 P9 Rollback Smoke Windows Exit Codes"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.2.0-closeout"
summary: "Run 1 of the rollback smoke (pull-request run 46054715769) passed on Linux and macOS and failed on Windows, where the project wrapper on its npx route gave exit 0 for a failing command; the smoke now asserts that behavior on Windows under the new follow-up F-P9-17 and records which layer loses the exit code."
---

# W1 R7 P9 Rollback Smoke Windows Exit Codes

## Changes

Run 1 of the rollback smoke (pull-request run 46054715769, F-P9-16) passed on Linux and macOS and failed on Windows in two steps: after the rollback, `.os\scripts\buildos.cmd capability-matrix --help` and `.os\scripts\buildos-intake.cmd version` exited `0`, where Linux and macOS gave `2` and `1`, with the same `0.1.0` error text on all three systems. The pinned `0.1.0` ran on Windows, and every pin check passed there. The cause is a product defect of the Windows project wrapper on its `npx` route, recorded as the new follow-up F-P9-17: a failing command can report success to a script or an agent. The wrappers and `pinned-version.cjs` are the same in `0.1.0` and `0.2.0`. `toolkits/buildos/scripts/rollback-smoke.ts` now asserts the true behavior on Windows (exit `0`, with the `0.1.0` error text, and a comment that names F-P9-17) and keeps `2` and `1` on Linux and macOS; the `capability-matrix` step also checks `version: 0.1.0` and the exact usage error on all three systems. Four new "F-P9-17 evidence" steps run a failure through each layer of the wrapper's `npx` route (the wrapper with the `0.2.0` pin, `npx-cli.js` started by `node`, `npx` in the shell, and `npx` with the wrapper's own arguments): Linux and macOS check exit `2`, and Windows records the exit code with no check. The report cleans step names too. `toolkits/buildos/test/rollback-smoke.test.ts` covers the exact exit codes, the error text checks, the unchanged pin checks, and the evidence steps.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#three-system-run-f-p8-09).

| Area | Summary |
| --- | --- |
| Scripts | `toolkits/buildos/scripts/rollback-smoke.ts` |
| Tests | `toolkits/buildos/test/rollback-smoke.test.ts` |
| Evidence | Run 1 results, the cause, the adopter effect, F-P9-17, and the checks |
| Risk register | R-003: run 1 and F-P9-17 |

Nothing is published, staged, tagged, or deprecated by this change, and no setting changed. No source file under `src/`, no wrapper under `system/.os/scripts/`, no guide source, version, `release-candidates.json`, golden output, or parity exception changed. t16, A72, and t15 to t18 stay unticked until the next pull-request run passes on three systems.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; the guide's Windows steps ran as written, and the guide's "exit code `2`" for a `0.2.0` command under `0.1.0` waits for the F-P9-17 fix.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Run 1 of the three-system rollback route, F-P9-17, and the checks. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: run 1 and F-P9-17. |

### Maintainer

None this session.

### User

None this session.
