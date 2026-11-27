---
title: "W1 R7 P9 Smoke on a Release Tarball (F-P9-15)"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/smoke-a-tarball"
summary: "Gave the published-package smoke a tarball mode, so the 0.2.0 smoke before the npm approval runs on the release tarball on three systems with the registry blocked, and wrote the exact smoke commands into release runbook steps c, h2, and k."
---

# W1 R7 P9 Smoke on a Release Tarball (F-P9-15)

## Changes

Gives `toolkits/buildos/scripts/published-smoke.ts` a tarball mode (`--tarball <file> --sha256 <hex>`, exclusive with `--version`), so the smoke before the npm approval of `0.2.0` runs on the release tarball, which has the same bytes as the stage (follow-up F-P9-15, orchestrator decision of 2026-11-27). The file's SHA-256 must equal the given value before any step, and the version is read from the tarball. The direct steps run `npx -y --package=<tarball> -- buildos`, the project wrapper runs the pinned version from an offline install of the tarball into the project, and the printed fix command of step 10 is checked exactly and run as printed, with npm resolving `build-os@0.2.0` to that local install. Every process runs with npm offline and a blocked registry, and the run fails unless npm reads both settings, the npm cache holds only tarball file entries, and every `build-os` folder a step could run has the tarball's bytes. The new module `scripts/smoke-source.ts` holds this logic without process starts; the report records the mode, the tarball's SHA-256 and version, and what the mode proves and does not prove (the registry fetch and the registry copy's bytes wait for runbook steps h1 and k). `.github/workflows/buildos-smoke.yml` takes a source (`registry`, `release-run` for the artifact of a `buildos-release` run, or `release-tag` for the asset of a published release) with a required SHA-256, checks every input before use, gives `actions: read` only to the job that downloads a run artifact, and on a pull request also runs the tarball mode on a release build of its own tree on three systems. Release runbook steps c, h2, and k now hold the exact `gh workflow run buildos-smoke.yml` commands, and `SECURITY.md` describes the workflow.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), [A Staged Version Cannot Be Installed Before Approval](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#a-staged-version-cannot-be-installed-before-approval), and [F-P9-15 Smoke on a Release Tarball](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#f-p9-15-smoke-on-a-release-tarball-2026-11-27).

| Area | Summary |
| --- | --- |
| Smoke script | `toolkits/buildos/scripts/published-smoke.ts` (tarball mode, guard steps, install before the wrapper step, report fields), `toolkits/buildos/scripts/smoke-source.ts` (new), `toolkits/buildos/scripts/printed-fix-step.ts` (the tarball-mode step name) |
| Workflow | `.github/workflows/buildos-smoke.yml`: the three sources, the input check, the two fetch jobs, the local pack on pull requests |
| Tests | `toolkits/buildos/test/smoke-tarball.test.ts` (new), `toolkits/buildos/test/release-workflow.test.ts` (smoke workflow tests) |
| Security | `toolkits/buildos/SECURITY.md`: new section Smoke Workflow |
| Records | The evidence report (runbook steps c, g, h2, and k; the open-items row; the new section), the P9 phase file (t13 status) |

Stacked on pull request 11 (`release/0.2.0-version`), pull request 10 (`feat/capability-matrix-command`), and pull request 9 (`fix/f-p8-11-printed-commands`), none merged. No source file under `src/`, version, `release-candidates.json`, `buildos-release.yml`, acceptance criterion, or gate text changed; no checkbox changed. The package file list is unchanged (168 files). Nothing is published, staged, or tagged.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed.

Checks and CI (same day): a tarball smoke on a clean pack of `dbe771a` passed 18 of 18 steps on macOS. In pull request 12, `buildos-smoke` run 45980072112 passed the registry mode on `0.1.0` and the tarball mode on a release build of the tree on Linux, macOS, and Windows. Two runs by hand on the published `0.1.0` passed both fetch routes on the three systems: release-tag `v0.1.0` (run 45980577022) and release-run 45894295344 (run 45980854201). See [CI Run (F-P9-15)](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#ci-run-f-p9-15).

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Runbook steps c, g, h2, and k with the tarball-mode and registry-mode smoke commands and what each proves; F-P9-15 marked built; new section F-P9-15 Smoke on a Release Tarball. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | t13 status: F-P9-15 is built. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Smoke Workflow: the sources, inputs, permissions, the SHA-256 checks, the registry guard, and what tarball mode does not prove. |

### User

None this session.
