---
title: "W1 R7 P8 Pin-First Wrappers Final Check Fixes"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the review round 3 findings on the pin-first wrappers of a474c45, the last round of the three-round review limit: the local lookup walks up the parent folders, npx runs with --prefix and --workspaces=false and is started by the helper on every system, the CLI checks its own Node.js version first, the dev refusal names the recovery, the owner checklist works on GitHub Free, and the tests no longer depend on the host npm config. The Windows long-line estimate stays and is follow-up F-P8-08."
---

# W1 R7 P8 Pin-First Wrappers Final Check Fixes

## Changes

Fixed the ten findings of review round 3 of `a474c45` (the pin-first project wrappers after round 2). This is the final pass: the three-round review limit is reached, and this pass closes the review. Each fix is the small form that the orchestrator set, with a regression test that fails on the code of `a474c45`. The local lookup of `pinned-version.cjs` looks in the `node_modules` folder of the project folder and of each folder above it, then of npm's local project folder and each folder above it, so a `--no-bin-links` install that npm hoisted to a workspace root runs directly. The `npx` fallback is `npx -y --prefix <current folder> --workspaces=false @brucewaynedecoy/buildos@<version>`, and `pinned-version.cjs --npx` starts it on macOS and Linux too, with the case-insensitive save of the caller's npm bin-links settings. The CLI checks its own Node.js version first (below 24: nothing on stdout, a plain message, exit code 3, the JSON envelope with `node_version` under `--json`); the bundle reaches the check on a real Node.js 20.18.0. The `dev` refusal names the development-build recovery. The owner checklist in `SECURITY.md` has 17 steps that work on GitHub Free: private and empty, one commit from a fresh folder, only `main` pushed, the remote checked, public, then at once the rulesets and the rest, and the remote checked again. The real-npm tests set bin links explicitly and pass with `npm_config_bin_links=false`; a small registry on 127.0.0.1 in a worker thread lets real npm do a fresh `npx` fetch. The Windows long-line estimate is not changed (follow-up F-P8-08). Nothing was pushed, published, staged, tagged, or released, and no repository or npm setting changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and [Pin-First Wrappers Final Check](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#pin-first-wrappers-final-check).

| Area | Summary |
| --- | --- |
| Wrappers (findings 1, 2, 5) | `pinned-version.cjs`: walk-up local lookup, `npxArguments` with `--prefix` and `--workspaces=false`, new `--npx` mode. `buildos` (sh): the `npx` start goes through the helper. `buildos.cmd`: unchanged. |
| CLI (findings 3, 7) | `src/cli/required-version.ts`: `nodeRefusal` and `MINIMUM_NODE_MAJOR`, the `dev` recovery text. `src/cli/main.ts`: the Node.js check before the version check. |
| Tests (findings 1 to 9) | `test/wrappers.test.ts` (hoisted install, `npx` arguments, old Node.js through `npx`, `npm_config_Bin_Links`, the nested pin, the local install); `test/required-version.test.ts` (Node.js check, `dev` text); `test/package.test.ts` (explicit bin links, local registry, workspace and plain `npx` fetches, hoisted install); `test/release-workflow.test.ts` (the GitHub Free checklist). |
| Documents (findings 1 to 4, 6, 10) | `SECURITY.md` (checklist, lookup, no package marker, Node.js check, `npx` flags, long-line estimate); PRD 06 and PRD 20 with requirement history; `.os/scripts/AGENTS.md`; guide chapter 4; maintainer page; P8 phase file and `toolkits/buildos/AGENTS.md` step numbers. |

After CI run 45763347158, one Windows-only test in `test/wrappers.test.ts` was corrected to the walk-up local lookup of finding 1 (a verified package above the current folder runs as a local install; the shim file never runs). No product file changed.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing` for chapter 4; `guide/BuildOS-Guide.html` rebuilt; no new guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/06-operating-layer-and-routing.md](../../../docs/prd/06-operating-layer-and-routing.md) | Wrapper resolution steps 3 and 5; requirement-history entry. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | The Node.js check and the `dev` recovery in the Output and Exit Contract; requirement-history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | Git history note: the new step numbers. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Pin-First Wrappers Final Check: findings table, checks, follow-up F-P8-08, limits. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | Entry Gate: the GitHub Free cutover; step numbers. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Owner checklist steps 1 to 17; lookup, Node.js check, `npx` flags, threat model, Windows line limit. |
| [toolkits/buildos/AGENTS.md](../../../toolkits/buildos/AGENTS.md) | First Publication prerequisites with the new step numbers. |
| [docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md](../../../docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md) | Record the pinned version with `.os/scripts/buildos version`. |

### User

| Path | Description |
| --- | --- |
| [system/.os/scripts/AGENTS.md](../../../system/.os/scripts/AGENTS.md) | Order: the walk-up lookup, the `npx` flags, the Node.js check. |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | The walk-up lookup and the Node.js check; `guide/BuildOS-Guide.html` rebuilt. |
