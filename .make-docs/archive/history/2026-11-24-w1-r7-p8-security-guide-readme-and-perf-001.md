---
title: "W1 R7 P8 Security Document, Guide, READMEs, and PERF-001 Recheck"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Finished SECURITY.md and the notices for the released state, rewrote the user guide and READMEs for the Node CLI, drafted the 0.1.0 release notes, added the A67 and guide-output tests, and ran the PERF-001 recheck."
---

# W1 R7 P8 Security Document, Guide, READMEs, and PERF-001 Recheck

## Changes

P8 Stage 2 (t7 to t10) and Stage 5 t19 to t21 of the BuildOS Node and TypeScript CLI rewrite, built on `548f4ea` and not committed. Nothing was published, staged, tagged, or released. No source, script, or workflow file changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and the evidence report sections [P8 Stage 2](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-stage-2) and [Startup Recheck (PERF-001, P8)](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#startup-recheck-perf-001-p8).

| Area | Summary |
| --- | --- |
| Security document (t7) | `SECURITY.md` for the released state: how to check a release (signature, provenance, digest, SBOM), rollback by version pin, every release check as the workflow runs it, safety rules grouped by topic, and one Known Limits and Out of Scope section; the pending scan row replaced by real results; `THIRD_PARTY_NOTICES.md` introduction |
| A68 | No gap between `SECURITY.md`, the bundle metafile, the SBOM (57 components), `npm audit` (0), and the OSV scan (54 packages, 0 findings) |
| Guide (t8) | All 22 chapters checked, 18 changed; chapter 04 rewritten around `npx … init`, the Make Docs choice, the wrapper, `buildos validate` with real output, skills, an offline install, update and rollback, and the `0.3.0` notice; guide HTML rebuilt |
| `docs/assets/` and use cases | The seven pages with the Go notice brought to the Node CLI (three rewritten), plus false lines in two more pages; `USE_CASES.md` links and `USE_CASES_TESTING.md` commands |
| READMEs (t9) | Root `README.md` "Use BuildOS" section; npm page `toolkits/buildos/README.md` |
| Release notes (t10) | `toolkits/buildos/RELEASE_NOTES.md`, `0.1.0` draft |
| Tests | `test/guide-examples.test.ts`: five guide output blocks compared with real output, and the A67 search with a planted-line control |
| `PERF-001` recheck | Profile v1.1 unchanged; one pass on `548f4ea`; outcome `pass`; BuildOS overhead about 40 ms over a 28.5 ms Node start (P1: about 1.5 ms); the PDF reader is 73% of the 3.3 MB bundle and loads on every command; lazy-load question to the owner |
| Checks on macOS | `npm test` 2,299 tests, 2,287 pass, 0 fail, 12 skipped; installed-tarball golden compare 167 of 167; two packs the same SHA-256; deny-list check 0 matches; PRD authority, path hygiene, and performance evidence validators pass; link check clean |
| Open | Owner questions on startup cost and on a global `buildos` overriding the pin; owner action to turn on private vulnerability reporting; the release-time facts list in the evidence report |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing` for every changed guide; no new guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P8 Stage 2 and the PERF-001 recheck; one P1 link moved off a removed heading. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | t7 to t10 and t19 to t21 ticked; A67 and A68 status. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md) | The PERF-001 result record links its later result. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: a `PATH` `buildos` runs before the pin. |
| [README.md](../../../README.md), [USE_CASES.md](../../../USE_CASES.md), [USE_CASES_TESTING.md](../../../USE_CASES_TESTING.md) | Use BuildOS section; fixed links; npm-based preflight and cleanup. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md), [toolkits/buildos/THIRD_PARTY_NOTICES.md](../../../toolkits/buildos/THIRD_PARTY_NOTICES.md) | Finished for the released state. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The `0.1.0` draft. |
| [docs/assets/maintainer/buildos-toolkit-cli-development.md](../../../docs/assets/maintainer/buildos-toolkit-cli-development.md), [docs/assets/maintainer/upgrade-existing-buildos-installation.md](../../../docs/assets/maintainer/upgrade-existing-buildos-installation.md) | Rewritten for the npm package. |
| [docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md](../../../docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md), [docs/assets/maintainer/operating-layer-contracts-maintenance.md](../../../docs/assets/maintainer/operating-layer-contracts-maintenance.md) | Go steps replaced with npm and wrapper commands. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) and 17 more chapters | The Node CLI; `guide/BuildOS-Guide.html` rebuilt. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md) | The npm page. |
| [docs/assets/user/upgrade-an-existing-buildos-project.md](../../../docs/assets/user/upgrade-an-existing-buildos-project.md) | Rewritten around `buildos init` adoption and the version pin. |
| [docs/assets/user/entities-consolidation-curate-and-resolve-records.md](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md), [docs/assets/user/promote-qualified-findings-to-designs.md](../../../docs/assets/user/promote-qualified-findings-to-designs.md), [docs/assets/user/build-os-getting-started.md](../../../docs/assets/user/build-os-getting-started.md), [docs/assets/user/convert-source-material-with-buildos-intake.md](../../../docs/assets/user/convert-source-material-with-buildos-intake.md) | Go-era steps replaced. |
