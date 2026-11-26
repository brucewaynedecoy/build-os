---
title: "W1 R7 P8 npm Package Name build-os"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "release/npm-name-build-os"
summary: "Renamed the npm package from @brucewaynedecoy/buildos to build-os (owner decision of 2026-11-26), added the build-os bin for npx, and brought the wrappers, release scripts, workflows, tests, PRDs, and documents to the new name."
---

# W1 R7 P8 npm Package Name build-os

## Changes

The npm package is now `build-os`, unscoped, under the npm account `brucewaynedecoy` (owner decision of 2026-11-26). The command stays `buildos`, and the three legacy names stay. A new `bin` entry `build-os` points to `dist/buildos.js` and runs exactly as `buildos`, so `npx -y build-os@<version>` works. The project wrappers accept only a package named `build-os` and look for it in `node_modules/build-os`; a package with the earlier scoped name never counts. The release scripts, workflows, tests, PRDs, guide, and documents use the new name; the tarball is `build-os-<version>.tgz` and the SBOM file stays `buildos-<version>.cdx.json`. Nothing is published.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), [Q-017](../../../docs/prd/03-open-questions-and-risk-register.md#q-017-npm-package-name), and [Package Name `build-os`](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#package-name-build-os-2026-11-26).

Deferred obligations and Unassisted Goal Testing: `not-needed-now`. Guide coverage: `updated`; the guide chapters name the new package, and `guide/BuildOS-Guide.html` was rebuilt.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Package name, `npx` command, and `bin` map, with a Requirement History entry. |
| [docs/prd/06-operating-layer-and-routing.md](../../../docs/prd/06-operating-layer-and-routing.md) | Wrapper lookup folder, accepted package name, and `npx` command, with a Requirement History entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `Q-017` decision and the R-003 note. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Decisions, changes, and verification. |
| [toolkits/buildos/AGENTS.md](../../../toolkits/buildos/AGENTS.md) | First Publication commands with the new name. |
