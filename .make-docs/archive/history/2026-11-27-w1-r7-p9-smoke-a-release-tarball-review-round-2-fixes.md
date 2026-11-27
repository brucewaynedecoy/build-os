---
title: "W1 R7 P9 Smoke on a Release Tarball Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/smoke-a-tarball"
summary: "Fixed the findings of review round 2 of pull request 12: the tarball smoke forces npm bin links on and proves which executable each step ran, its install comparison fails when it is incomplete, no fixed name claims that something ran, and no cache error holds a runner path."
---

# W1 R7 P9 Smoke on a Release Tarball Review Round 2 Fixes

## Changes

Fixed the findings of review round 2 of pull request 12 (FAIL on `851046f`). In tarball mode, `toolkits/buildos/scripts/published-smoke.ts` now gives every process `npm_config_bin_links=true` (the caller's value in any spelling is dropped) and checks it in the preflight, and it proves which executable each step ran, per route, two ways: each launcher that a step starts must resolve to that bin's file inside the verified copy (on macOS and Linux the real path of npm's symbolic link; on Windows the target that the `.cmd` and PowerShell shims name, compared case-insensitively), the wrapper's own lookup (`localEntry` of the project's `pinned-version.cjs`) must choose the project install's bin file, and a launch probe that every Node.js process loads through `NODE_OPTIONS` records the real path of each step's main script, which must be the expected bin file (npm's own program and the wrapper's helper aside). The report records each route's resolved launchers and each step's programs, cleaned. The install comparison fails when its traversal is incomplete (an unreadable entry, a folder below the depth limit) and names the path, compares by own keys (`Map`), counts every folder below `_npx`, compares folder names case-insensitively on Windows, fails an installed entry that is not a regular file where the tarball's is, and states in the report what it compares and whether the tarball holds any entry that is not a regular file. The install-check steps and the step 9 check are renamed so that no fixed name says that something ran, and every cache-index error shows a tarball file key by its file name only. Release runbook step c now requires a real run of both fetch routes with the artifact-ID hand-off on `0.1.0` first, with a place for the run IDs.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), the [review round 1 history record](2026-11-27-w1-r7-p9-smoke-a-release-tarball-review-round-1-fixes.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-2-pull-request-12-2026-11-27).

| Area | Summary |
| --- | --- |
| Smoke script | `toolkits/buildos/scripts/published-smoke.ts` (bin links, the launch probe and per-step launch logs, the launcher, wrapper-lookup, and probe checks, the `launchers` report field, the renamed checks), `toolkits/buildos/scripts/smoke-source.ts` (the guard, the probe source, the shim parsers, the launcher and launch rules, the `Map` comparison, the comparison statement, the cache-key cleaning in errors), `toolkits/buildos/scripts/smoke-evidence.ts` (the complete traversal, the launcher reads), `toolkits/buildos/scripts/printed-fix-step.ts` (the step 10 shell step name) |
| Tests | `toolkits/buildos/test/smoke-tarball.test.ts` |
| Security | `toolkits/buildos/SECURITY.md`: Smoke Workflow |
| Records | The evidence report (runbook steps c and h2; the new section Review Round 2 (Pull Request 12)) |

Stacked on pull request 11 (`release/0.2.0-version`), pull request 10 (`feat/capability-matrix-command`), and pull request 9 (`fix/f-p8-11-printed-commands`), none merged. No source file under `src/`, version, `release-candidates.json`, `buildos-release.yml`, acceptance criterion, or gate text changed; no checkbox changed. The package file list is unchanged (168 files). Nothing is published, staged, or tagged.

Follow-up (same day): the name of the step 10 shell step in tarball mode says "the launch check after step 10 names the program", so no fixed step name holds the word "ran", and a test checks that name.

Follow-up (same day, CI): on Windows, npm's `npx.cmd` shim starts `npm-prefix.js` of the npm install before `npx-cli.js`, so the launch check of the printed command in `buildos-smoke` run 45994727376 failed on that record. The launch check now counts `npm-prefix.js` in npm's `bin` folder as npm's own program, like `npm-cli.js` and `npx-cli.js`, and a test has that record.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Runbook steps c and h2; new section Review Round 2 (Pull Request 12) with each finding, its fix, its tests, how a run proves which executable ran, and the fetch-route exercise with a place for its run IDs. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Smoke Workflow: bin links on, the launcher and launch-probe checks, and what the install comparison covers. |

### User

None this session.
