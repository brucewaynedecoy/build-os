---
title: "W1 R7 P8 npm Package Name Review Fixes"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-fable-5-2"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "release/npm-name-build-os"
summary: "Fixed the review findings on the package name change: the wrapper needs an object bin with a buildos entry, four guides name the package build-os, the lockfile bin map is complete, and the First Publication steps reserve the name early."
---

# W1 R7 P8 npm Package Name Review Fixes

## Changes

Fixed the five findings of the review of the package name change. `system/.os/scripts/pinned-version.cjs` accepts only an object `bin` with a `buildos` entry, because npm links a string `bin` only under the package name `build-os`. Four guides under `docs/assets/` name the npm package `build-os` and the command `buildos`. The root `bin` map of `toolkits/buildos/package-lock.json` lists the five commands. The First Publication steps in `toolkits/buildos/AGENTS.md` say to reserve the unscoped name as early as possible and use a query that prints the dist-tags when only `reserved` exists.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and [Review of the Package Name Change](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-of-the-package-name-change-2026-11-26).

Deferred obligations and Unassisted Goal Testing: `not-needed-now`. Guide coverage: `not-needed`; the guide chapters did not change.

## Verification

`npm run typecheck`, `npm run build`, `npm test` (2504 tests: 2491 passed, 0 failed, 13 skipped), and `npm run check:deps` passed on macOS.
