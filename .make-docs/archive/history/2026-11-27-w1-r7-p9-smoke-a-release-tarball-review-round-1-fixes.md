---
title: "W1 R7 P9 Smoke on a Release Tarball Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/smoke-a-tarball"
summary: "Fixed the findings of review round 1 of pull request 12: the tarball smoke needs positive evidence of the bytes that each copy ran, stops when its preflight fails, claims only what ran, holds no runner path in its report, and survives a re-run of a failed smoke job."
---

# W1 R7 P9 Smoke on a Release Tarball Review Round 1 Fixes

## Changes

Fixed the findings of review round 1 of pull request 12 (FAIL on `2208bfb`; the three-system smoke passed). The tarball-mode guard of `toolkits/buildos/scripts/published-smoke.ts` now needs positive evidence of the bytes that ran, read from the layouts of npm 11.19.1 (the npm of CI): a preflight before step 1 that stops the run when npm does not read offline and the blocked registry; after step 7, before the project install exists, a check that exactly one npx folder was made for the tarball file and that its `build-os` package holds exactly the tarball's files with the tarball's SHA-256 for each and a lockfile entry with the tarball's version, file, and `sha512` integrity, with no other `build-os` folder below the run's root; after step 10, the same check of the project install that the wrapper and the printed command ran, and of the npx install again; and last, a check that the npm cache index holds at least one entry, each a tarball file entry with the tarball's name and integrity, and that the cache content for that integrity has the tarball's SHA-256. Every process also gets the new npm cache and a new empty global prefix in one spelling only, and the temporary root is used by its real path. The new module `scripts/smoke-evidence.ts` reads these layouts; `scripts/smoke-source.ts` judges them and makes the report claims from the steps that ran and their outcomes, so a skipped step 10 (the `0.1.0` form) is reported as not run. The report cleans the check labels like stdout and stderr. `.github/workflows/buildos-smoke.yml` downloads the checked tarball by the artifact ID that the fetch job's upload returned, so a re-run of only a failed smoke job finds it. Release runbook step h5 asks for both smoke run IDs (step c and h2), and steps c and h2 give the new step counts and the report claims to check.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), the [F-P9-15 history record](2026-11-27-w1-r7-p9-smoke-a-release-tarball.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-1-pull-request-12-2026-11-27).

| Area | Summary |
| --- | --- |
| Smoke script | `toolkits/buildos/scripts/published-smoke.ts` (the preflight stop, the two install checks, the cache check, the report from `finish()`), `toolkits/buildos/scripts/smoke-evidence.ts` (new), `toolkits/buildos/scripts/smoke-source.ts` (the guard rules and the claims), `toolkits/buildos/scripts/printed-fix-step.ts` (the step roles) |
| Workflow | `.github/workflows/buildos-smoke.yml`: the download by artifact ID; `smoke-evidence.ts` in the pull request paths |
| Tests | `toolkits/buildos/test/smoke-tarball.test.ts`, `toolkits/buildos/test/release-workflow.test.ts`, `toolkits/buildos/test/post-publication-scripts.test.ts` |
| Security | `toolkits/buildos/SECURITY.md`: Smoke Workflow |
| Records | The evidence report (runbook steps c, h2, and h5; the F-P9-15 section; the new section Review Round 1 (Pull Request 12)) |

Stacked on pull request 11 (`release/0.2.0-version`), pull request 10 (`feat/capability-matrix-command`), and pull request 9 (`fix/f-p8-11-printed-commands`), none merged. No source file under `src/`, version, `release-candidates.json`, `buildos-release.yml`, acceptance criterion, or gate text changed; no checkbox changed. The package file list is unchanged (168 files). Nothing is published, staged, or tagged.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed.

Follow-up (same day): the cache-check step of the report shows each tarball file key of the npm cache by its file name only (`pacote:tarball:file:.../build-os-0.2.0.tgz`), because npm records the path relative to the folder that read the file, and that relative path names runner folders; a failed check still prints the full key, cleaned.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Runbook steps c, h2, and h5; the F-P9-15 guard and workflow text; new section Review Round 1 (Pull Request 12) with each finding, its fix, its tests, and the checks. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Smoke Workflow: the guard's positive evidence, the preflight stop, the report claims, and the download by artifact ID. |

### User

None this session.
