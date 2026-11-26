---
title: "BuildOS CLI Development"
path: "buildos/toolkit/cli"
status: draft
version: "2026-11-24"
order: 100
tags:
  - toolkits
  - cli
  - deterministic-execution
  - npm
applies-to:
  - toolkits
  - buildos
related:
  - "operating-layer-entities-consolidation-and-resolution.md"
  - "upgrade-existing-buildos-installation.md"
  - "../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md"
  - "../../prd/20-buildos-cli-and-distribution.md"
  - "../../prd/02-architecture-overview.md"
  - "../../prd/17-entity-identity-and-canonical-resolution.md"
  - "../user/convert-source-material-with-buildos-intake.md"
  - "../user/record-discovery-runs-and-qualify-findings.md"
  - "../user/promote-qualified-findings-to-designs.md"
  - "../user/use-playbooks-and-active-indexes.md"
  - "../user/entities-consolidation-curate-and-resolve-records.md"
  - "../../../toolkits/buildos/AGENTS.md"
  - "../../../toolkits/buildos/SECURITY.md"
  - "../../../toolkits/buildos/test/golden/CAPTURE.md"
  - "../../../toolkits/README.md"
persona: maintainer
---

# BuildOS CLI Development

This guide is for maintainers who change the `buildos` command. The command is one npm package, `@brucewaynedecoy/buildos`, in `toolkits/buildos/`: TypeScript with `strict` on, shipped as one ESM bundle that esbuild builds, for Node.js 24 or newer, with no runtime dependencies. [PRD 20 BuildOS CLI and Distribution](../../prd/20-buildos-cli-and-distribution.md) is the authority. The design is [BuildOS Node and TypeScript CLI Rewrite](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md).

The earlier Go tools (`toolkits/buildos-intake/`, `toolkits/buildos-discovery/`, `toolkits/buildos-design/`, and the Go seed in `toolkits/buildos/`) were removed in W1 R7 P8. Their output is the frozen parity baseline in `toolkits/buildos/test/golden/`; [`CAPTURE.md`](../../../toolkits/buildos/test/golden/CAPTURE.md) names the Go source commit and how to recover the Go tools from git history.

## Layout

| Path | What it owns |
| --- | --- |
| `toolkits/buildos/src/core/` | Domain logic: `entities`, `intake`, `discovery`, `design`, `init`, `validate`, `version`, and `shared`. Core returns typed results and errors, never writes to stdout, and never calls `process.exit`. It writes only through the filesystem port (`src/core/shared/fs-port.ts`). |
| `toolkits/buildos/src/cli/` | The thin CLI adapter: argument parsing (Go `flag` rules, no CLI framework), help, output, exit codes, and the legacy command names. |
| `toolkits/buildos/src/adapters/` | The only Node-facing code: the filesystem port (`node-fs.ts`), hashing, the one place that may start a process (`node-process.ts`), the document parsers, and the package content. |
| `toolkits/buildos/scripts/` | The build (`build.ts`), the dependency guard, the release flow (`release-build.ts`, `release-gate.ts`, `release-candidate.ts`, `sbom.ts`, `reproducible-pack.ts`, `release-dry-run.ts`), the deny-list check, and the startup instrument. |
| `toolkits/buildos/test/` | `node:test` suites, the golden parity harness, the conversion eval, and the hostile-input tests. |
| `system/` | The project files that `buildos init` copies into a project, including `.os/scripts/` wrappers and `.os/skills/`. |

Rules that tests enforce: an adapter never shells out to another adapter or another `buildos` command; each domain keeps its own boundary (`test/boundary.test.ts`); only `src/adapters/node-process.ts` may load `child_process`; core loads no `node:crypto` except two older files allowed by path (follow-up F-P6-04).

## Build and test

From `toolkits/buildos/`:

```sh
npm ci --ignore-scripts
npm run check:deps
npm run check:deps:installed
npm run typecheck
npm test
npm run build
node dist/buildos.js version
```

From the repository root, the same through `just`: `just build-buildos`, `just test-buildos`, `just install-toolkits` (packs the package and installs the tarball globally), `just check-toolkits`, and `just uninstall-toolkits`.

A source build reports version `dev` and source revision `unknown`. `node scripts/release-build.ts` reports the `package.json` version and the source commit, and refuses a dirty tree unless you pass `--allow-dirty` (then the revision ends in `-dirty`).

## Parity and goldens

Every command and every legacy name must give the same files, stdout, stderr, JSON, and exit code as the Go tools for the same input, byte for byte. PDF text is the one standing exception (it must match after whitespace normalization). Any other difference needs a parity exception with an owner decision in `test/golden/parity-exceptions.json`. Goldens never change by hand; read `test/golden/CAPTURE.md` first. The golden harness also runs from the installed tarball on macOS, Linux, and Windows in CI.

## Outside packages

Node built-ins come first. A new outside package must pass every PRD 20 Supply Chain rule and the admission checklist in [`SECURITY.md`](../../../toolkits/buildos/SECURITY.md), and the same change updates `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, and the SBOM check. Every install uses `--ignore-scripts`; only `esbuild` 0.28.2 may declare an install script, under a closed owner-approved exception.

## Release

The release flow is in [`SECURITY.md`](../../../toolkits/buildos/SECURITY.md), section Release Checks, and the maintainer steps are in the header of `scripts/release-candidate.ts` and in [`toolkits/buildos/AGENTS.md`](../../../toolkits/buildos/AGENTS.md). `node scripts/release-dry-run.ts --allow-dirty` runs the `verify` gates locally, with an invented deny list, and never stages; the real-list scan, the ruleset and environment checks, and the release-asset checks run only in prepare and release runs. No agent publishes, stages, or tags.

## Future Coverage

- Blocked by: W1 R7 P9 (`0.2.0`). Update when: `buildos extract bulk`, `buildos fitgap`, and `buildos export azure-boards` land. Guide change: add the new domains to the layout table and drop the Python note from the skills.
- Blocked by: W2 update and uninstall. Update when: `buildos update` exists. Guide change: describe the update path and the manifest fields W2 adds.
