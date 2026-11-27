---
title: "W1 R7 P9 Smoke on a Release Tarball Final Fix Pass"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/smoke-a-tarball"
summary: "Final fix pass after review round 3 of pull request 12: the tarball smoke claims only the entry scripts that its launch probe observed, allows only the exact program files of one selected npm, compares Windows shims byte for byte, keeps the probe when npm's node-options is set, searches for stray copies and empty folders exactly, keeps absolute paths out of every report, and lets hand-started runs run side by side."
---

# W1 R7 P9 Smoke on a Release Tarball Final Fix Pass

## Changes

Fixed the findings of review round 3 of pull request 12 (FAIL on `873b319`), the last round under the project stop rule; no further review follows. In tarball mode, `toolkits/buildos/scripts/published-smoke.ts` now selects one npm installation in the preflight (the npm next to the Node.js that runs the smoke, by real path) and allows, by exact real path, only that npm's program files and the project's own `.os/scripts/pinned-version.cjs` next to the expected bin file; `pathKey` treats `\` and `/` as one separator and names as case-insensitive only on Windows. The report and the docs no longer say that the smoke proves which executable ran: they say that the launch probe shows the entry scripts of the Node.js processes that it observed in each step, and that a process that is not Node.js, or a Node.js process started with a cleared environment, is not observed. On Windows each installed shim (`<name>`, `<name>.cmd`, `<name>.ps1`) must be byte-equal to the shim that the selected npm's own `cmd-shim` writes for the same bin file in the same relative layout; no target is parsed. Every process gets npm's `node-options` equal to the probe's `NODE_OPTIONS` (a caller's value in any spelling is dropped), and the preflight reads it. The stray-folder search skips only this run's npm cache store and logs by exact path and matches names in any case on Windows, and the install comparison fails on a folder that holds no tarball file, also an empty one. npm's paths show below `{NPM}`, an unexpected cache key shows only its kind, and every string of the report loses any absolute path that the cleaning left, with the count in `absolute_paths_removed`. In `.github/workflows/buildos-smoke.yml`, a hand-started run has its own concurrency group (its run ID), so two hand-started runs never cancel each other; pull-request runs still cancel by ref.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), the [review round 2 history record](2026-11-27-w1-r7-p9-smoke-a-release-tarball-review-round-2-fixes.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-3-and-the-final-fix-pass-pull-request-12-2026-11-27).

| Area | Summary |
| --- | --- |
| Smoke script | `toolkits/buildos/scripts/published-smoke.ts` (the npm selection, the preflight with `node-options`, the probe's own check, and the canonical shims; `{NPM}`; the exact allowed programs; the last scrub of absolute paths), `toolkits/buildos/scripts/smoke-source.ts` (the guard, `pathKey`, `npmPrograms`, the shim and launch rules, the folder rule, the cache-key kinds, the narrowed claims and limits, `scrubAbsolutePaths`), `toolkits/buildos/scripts/smoke-evidence.ts` (the folder walk with folders, the exact skip list and Windows names, `canonicalShims`, the byte comparison), `toolkits/buildos/scripts/printed-fix-step.ts` (the step 10 shell step name) |
| Workflow | `.github/workflows/buildos-smoke.yml`: the concurrency group |
| Tests | `toolkits/buildos/test/smoke-tarball.test.ts`, `toolkits/buildos/test/release-workflow.test.ts`, `toolkits/buildos/test/post-publication-scripts.test.ts` |
| Security | `toolkits/buildos/SECURITY.md`: Smoke Workflow |
| Records | The evidence report (runbook steps c, h2, and k; the round 2 section corrected; the fetch-route section; the new section Review Round 3 and the Final Fix Pass (Pull Request 12)); the P9 phase file status |

Stacked on pull request 11 (`release/0.2.0-version`) and pull request 10 (`feat/capability-matrix-command`), none merged. No source file under `src/`, version, `release-candidates.json`, `buildos-release.yml`, acceptance criterion, or gate text changed; no checkbox changed. The package file list is unchanged (168 files). Nothing is published, staged, or tagged. The archived round 2 history record keeps its own words; the evidence report and this record correct its claim about executables.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Runbook steps c, h2, and k; the round 2 section limited to what the probe observes; the fetch-route results of the earlier head; new section Review Round 3 and the Final Fix Pass (Pull Request 12). |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | t13 status: the narrowed claim of the final fix pass. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Smoke Workflow: `node-options`, the selected npm, the byte-equal shims, the observation limit, the folder rule, the report cleaning, and the concurrency groups. |

### User

None this session.
