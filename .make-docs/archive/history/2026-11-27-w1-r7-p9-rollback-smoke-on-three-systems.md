---
title: "W1 R7 P9 Rollback Smoke on Three Systems"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.2.0-closeout"
summary: "Added the rollback source of the buildos-smoke workflow (F-P9-16): a project made with build-os 0.1.0 is upgraded to 0.2.0 and rolled back to 0.1.0 with the user guide's steps on Linux, macOS, and Windows, every build-os from the public registry, and the project wrapper must run the pinned 0.1.0 after the rollback (F-P8-09)."
---

# W1 R7 P9 Rollback Smoke on Three Systems

## Changes

Added a rollback proof to the smoke route (F-P9-16, for F-P8-09). `toolkits/buildos/scripts/rollback-smoke.ts` makes a project with `npx -y build-os@0.1.0 init --skip-make-docs`, copies it, and in the copy runs the commands of the user guide, chapter 4 ("From 0.1.0 to 0.2.0" and "Roll back from 0.2.0 to 0.1.0"), as the guide writes them: through `sh -c` on Linux and macOS, and in their Command Prompt form on Windows. `toolkits/buildos/scripts/rollback-steps.ts` holds those commands and the Command Prompt changes that the guide names. The run makes the checks of the macOS hand proof of 2026-11-27: after the rollback the project wrapper prints `version: 0.1.0` with the source revision of `npx -y build-os@0.1.0`, `help` lists none of the four `0.2.0` domains, a `0.2.0` command stops with exit `2`, the compare commands against the backup print nothing, the tree equals the "Before BuildOS 0.2.0" commit, and the original project is untouched; no `buildos` is on `PATH`, npm's global prefix is a new empty folder, no npm install of `build-os` is made, and the npm cache holds only registry entries of `build-os` with the registry's integrity. The `buildos-smoke` workflow has a new source `rollback` (no inputs), and a pull request that changes the smoke files runs it on the three systems beside the registry and local-pack modes. `toolkits/buildos/test/rollback-smoke.test.ts` checks every literal command against the guide text, that every command of the guide's sh blocks in those sections runs (except the app-folder examples), the Command Prompt form, the pure checks, and the usage guard; `test/release-workflow.test.ts` covers the new source, its input checks, and the pull-request mode. `SECURITY.md` lists the fourth source. No existing guard of the smoke changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#close-out-of-020-2026-11-27).

| Area | Summary |
| --- | --- |
| Scripts | `toolkits/buildos/scripts/rollback-smoke.ts`, `toolkits/buildos/scripts/rollback-steps.ts` |
| Workflow | `.github/workflows/buildos-smoke.yml`: the `rollback` source, the pull-request mode, and the two new paths |
| Tests | `toolkits/buildos/test/rollback-smoke.test.ts`, `toolkits/buildos/test/release-workflow.test.ts` |
| Security | `toolkits/buildos/SECURITY.md`, "Smoke Workflow" |

Nothing is published, staged, tagged, or deprecated by this change, and no setting changed. No source file under `src/`, version, `release-candidates.json`, golden output, or parity exception changed.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; the run checks the guide's commands and changes no guide source.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The close-out of `0.2.0`: the route, its tests, and its runs. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The `rollback` source of the smoke workflow. |

### User

None this session.
