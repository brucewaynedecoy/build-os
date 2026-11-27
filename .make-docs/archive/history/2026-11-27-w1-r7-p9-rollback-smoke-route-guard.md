---
title: "W1 R7 P9 Rollback Smoke Route Guard"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.2.0-closeout"
summary: "Review round 1 of pull request 15: the rollback smoke now fails when a build-os install that the wrapper could run stands in for npx, and proves the npx route with the launch probe; the F-P9-17 diagnosis is corrected and gets a Windows diagnostic step; the guide tells a Command Prompt reader to confirm the copy overwrites."
---

# W1 R7 P9 Rollback Smoke Route Guard

## Changes

Review round 1 of pull request 15 found that the rollback smoke could pass on the wrong route: with `build-os@0.1.0` installed in a `node_modules` folder above the temporary project, every step passed while the wrapper commands after the rollback ran that install, because the wrapper's helper looks in each folder above the project. `toolkits/buildos/scripts/rollback-smoke.ts` now runs a route guard before any `npx` command, before the first wrapper run, and after the last one: it fails on any `node_modules/build-os` entry in a folder that the helper reads (`wrapperLookupFolders` in `toolkits/buildos/scripts/rollback-steps.ts`, with the helper's own `npmLocalPrefix`), on any `buildos` program in a `PATH` folder as the helper reads `PATH`, and on a non-empty npm global prefix. The launch probe of the published-version smoke now runs in every step, and after the run each wrapper run must have started the bin file of the npx folder that holds `build-os` at the step's pin. On this Mac the smoke passed (75 of 75 steps) and failed as it must with an install above the project (71 of 75: the three guards and the probe). The F-P9-17 diagnosis is corrected (the Windows wrapper tests that return `7` and `5` do not run the `npx.cmd` chain, and the `5` test bypasses the wrapper's `exit /b`), both causes stay open, and a record-only Windows step starts the helper directly with `node.exe` next to `buildos.cmd` to tell them apart; Linux and macOS check the helper's `--npx` route directly. The guide's Windows upgrade and rollback note tells the reader to answer `Yes` when `copy` asks to overwrite a file. Run 2 (46056570552) is marked as passed before the guard, and F-P8-09 closes only when run 3 passes; t15 to t18 stay ticked by the reviewer's ruling.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-1-pull-request-15-2026-11-27).

| Area | Summary |
| --- | --- |
| Scripts | `toolkits/buildos/scripts/rollback-smoke.ts`, `toolkits/buildos/scripts/rollback-steps.ts` |
| Tests | `toolkits/buildos/test/rollback-smoke.test.ts` |
| Guide | `guide/content/04-install-and-configure-your-instance.md`, `guide/BuildOS-Guide.html` (rebuilt) |
| Evidence | Run 2 marked, run 3 place, the F-P9-17 correction, the reviewer's ruling on t15 to t18, the review round and its checks |
| Risk register | R-003: review round 1 of pull request 15 |

Nothing is published, staged, tagged, or deprecated by this change, and no setting changed. No source file under `src/`, no wrapper under `system/.os/scripts/`, no version, `release-candidates.json`, golden output, or parity exception changed. The product defect F-P9-17 is not fixed.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; one sentence in chapter 4.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Run 2 marked, run 3 place, the F-P9-17 correction, and review round 1 of pull request 15. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | A72 and the close-out status: F-P8-09 waits for run 3; the ticks stay. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: review round 1 of pull request 15. |

### Maintainer

None this session.

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | The Windows note of the upgrade and rollback steps: answer `Yes` when `copy` asks to overwrite a file. |
