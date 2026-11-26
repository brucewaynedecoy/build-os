---
title: "W1 R7 P1 TypeScript Package Foundation"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P1"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Added the BuildOS Node 24 and TypeScript package foundation with the shared CLI contract, supply-chain guards, CI workflow, first security document, and PERF-001 baseline."
---

# W1 R7 P1 TypeScript Package Foundation

## Changes

Adds the `@brucewaynedecoy/buildos` Node 24 and TypeScript package at `toolkits/buildos/` beside the unchanged Go seed, built with `tsc` and esbuild and tested with `node:test`, with a structural core and CLI boundary and a filesystem port, the shared root model, JSON envelope, central exit codes, help, version, and a built-in parser that follows Go `flag` rules and matches the Go seed byte for byte except approved parity exceptions PE-001 to PE-003. It adds the Apache-2.0 `LICENSE`, the first `SECURITY.md`, the Go BSD-3-Clause notice for the bundled Unicode tables, a dependency guard with a closed esbuild 0.28.2 install-script exception, an OSV gate, the three-OS CI workflow, and the `PERF-001` startup baseline, and it records the owner decisions in PRD 20, the design, the W1 R7 plan and backlog, and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md). The independent review passed on final verification; A8 and the CI parts of A9 and A10 wait for the owner-approved push.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P1 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md), and [design](../../../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md).

```text
build-os/
├── LICENSE
├── .github/workflows/buildos-ci.yml
└── toolkits/buildos/
    ├── package.json, package-lock.json, .npmrc, tsconfig.json
    ├── LICENSE, SECURITY.md, THIRD_PARTY_NOTICES.md
    ├── scripts/   (dependency guard, OSV gate, Go golden capture, Go isprint generator)
    ├── src/       (core/, cli/, adapters/)
    └── test/      (node:test suites and Go seed goldens)
```

| Area | Summary |
| --- | --- |
| Package and build | Exact dev dependencies `typescript` 7.0.2, `esbuild` 0.28.2, `@types/node` 24.19.2; no runtime dependencies; `npm pack` holds 6 files. |
| Shared contract | Root model with no walk-up, nine-field envelope, exit codes 0 to 6 and 10, help and version, diagnostics formatter. |
| Boundary | Core may not load I/O modules or reach `src/cli/` or `src/adapters/`; core reads and writes through `src/core/shared/fs-port.ts`, adapter `src/adapters/node-fs.ts`. |
| Supply chain | Dependency guard before and after install, `.npmrc` `ignore-scripts=true`, closed esbuild install-script exception, `npm audit`, OSV gate; 50 lockfile packages, all MIT or Apache-2.0. |
| Go parity | 88 Go seed goldens; 66 match, 11 approved exceptions, 11 `entities` cases skipped until P3; Go 1.24.1 `strconv.IsPrint` tables with their BSD-3-Clause notice. |
| Review | Independent review: CHANGES in rounds 1 to 3 and the final review, then PASS on final verification; 648 tests (637 pass, 11 skipped, 0 fail). |
| Performance | `PERF-001` pass 1 `pass`; no lazy-load or bundling change before `0.1.0`. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | `node:test`, the Go `flag`-rules parser, and the closed esbuild install-script exception as current requirements, with Requirement History entries. |
| [docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md](../../../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md) | Design aligned with the owner decisions. |
| [docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md](../../../docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md) | Plan overview, PRD maintenance, and backlog-shape files aligned with the owner decisions. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md) | Backlog index change notes; P3, P4, and P5 test tasks use `node:test`. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md) | P1 tasks, `PERF-001` profile, and closeout (Done pending CI). |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New evidence report: owner decisions, P1 acceptance, checks, parity, `PERF-001`, and Phase Reviews. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | First security document for maintainers and enterprise reviewers. |
| [toolkits/buildos/THIRD_PARTY_NOTICES.md](../../../toolkits/buildos/THIRD_PARTY_NOTICES.md) | Go 1.24.1 BSD-3-Clause notice for the bundled Unicode tables. |

### Maintainer

None this session.

### User

None this session.
