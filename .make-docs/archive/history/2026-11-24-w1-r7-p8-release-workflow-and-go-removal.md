---
title: "W1 R7 P8 Release Workflow and Go Removal"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Built the release workflow (reproducible pack, release candidates, release gates with dry run and planted failures, SBOM, build identity) and removed the Go sources with the goldens frozen as the parity baseline."
---

# W1 R7 P8 Release Workflow and Go Removal

## Changes

P8 Stage 1 (t2 to t6) and Stage 3 (t11 to t14) of the BuildOS Node and TypeScript CLI rewrite, built on `e8a1ec7` and not committed. Nothing was published, staged, or tagged. t1 needs the maintainer.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-release-010).

| Area | Summary |
| --- | --- |
| Reproducible pack (t2) | esbuild runs with the package root as its working folder (a build from another folder wrote the checkout's absolute path); `scripts/reproducible-pack.ts` in CI on three systems, with a report-only cross-OS comparison; byte identity claimed on `ubuntu-24.04`, Node 24.22.3, npm 11.19.1 |
| Release candidates (t3) | `toolkits/buildos/release-candidates.json` (no entry yet) and `scripts/release-candidate.ts` (`check`, `compute`, `verify`, `self`) |
| Release workflow (t4) | `.github/workflows/buildos-release.yml`: release mode on a published GitHub Release; dry run by hand or on `release-dry-run/**` pushes; every gate in `scripts/release-gate.ts`; `scripts/release-dry-run.ts` locally; planted failures for tag, version, digest, eval, audit, OSV, and deny list |
| SBOM (t5) | `scripts/sbom.ts`: `npm sbom` from the lockfile, with bundled packages `required`, build-time packages `excluded`, pdf.js and the ported Go code added, checked against `SECURITY.md` and the notices |
| Build identity (t6) | `scripts/release-build.ts`: package version and commit SHA; a dirty tree is refused (or `-dirty` with `--allow-dirty`); `package.json` gains `repository` |
| Go removal (t11 to t14) | Go sources, the three Go toolkits, and the capture workflow deleted; goldens frozen at Go source commit `263f5ca` (last Go commit `e8a1ec7`); `capture.mjs` keeps its no-Go modes; npm `justfile` recipes; three skill-script Python files only (tested) |
| Verified npm facts | `npm stage publish <tarball> --provenance` with OIDC confirmed; provenance needs a public repository; a trusted publisher needs an existing package, and `@brucewaynedecoy/buildos` does not exist (owner question) |
| Checks on macOS | `npm test` 2,291 tests, 2,279 pass, 0 fail, 12 skipped; installed-tarball golden compare 167 of 167; two packs SHA-256 `ca26a7e8…7987a`; `actionlint` clean; PRD authority and path hygiene pass |
| Open | t1; the first-publish and visibility owner questions; GitHub dry runs for A64 and A65; the first CI run of the new checks; Stages 2, 4, and 5 |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Release steps, SBOM, build identity, and first publish; Compatibility after the Go removal; two requirement-history entries. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | Code anchors of D-002, D-004, and D-008 moved off the Go paths; an R-003 note on the first publish. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The P8 Release 0.1.0 section. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | t2 to t6 and t11 to t14 ticked; A64 to A66, A69, and A70 status. |
| [README.md](../../../README.md), [AGENTS.md](../../../AGENTS.md) | Toolkit rows and the layout check no longer name Go. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/AGENTS.md](../../../toolkits/AGENTS.md), [toolkits/README.md](../../../toolkits/README.md) | The npm package as the one toolkit. |
| [toolkits/buildos/AGENTS.md](../../../toolkits/buildos/AGENTS.md) | Rewritten router, with the release steps. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Frozen Go Baseline: both commits and how to recover the Go tools. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The Go seed sentence and the reproducible-pack CI row. |
| `docs/assets/` (seven pages) | Removal notice; five dangling links fixed. |

### User

| Path | Description |
| --- | --- |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md) | Describes the npm package; the npm page text is Stage 2. |
