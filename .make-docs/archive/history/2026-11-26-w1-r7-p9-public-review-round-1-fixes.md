---
title: "W1 R7 P9 Public Repository Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/p9-skill-commands"
summary: "Pointed the skill-script golden capture at the first public commit, removed the other run-time reads of private archive commits, added a test that fails on a capture revision that is not in this repository, and corrected the archive commit count."
---

# W1 R7 P9 Public Repository Review Round 1 Fixes

## Changes

Fixed the findings of review round 1 of pull request 6 on `rewrite/p9-skill-commands`. The skill-script golden capture now reads the four skill scripts and the fit-gap palette from `085927e3c1324fc73fe57af9493ca0b01fcaed18`, the first commit of the public repository, where they have the same SHA-256 as at the archive capture commit `38d1e08`; the palette is pinned too, and no golden changed. The validator capture now needs `--script <path>`, because no public commit holds `validate_config.py`, and the wrapper test holds the exact Go-era wrapper text instead of reading it from an archive commit. A new test, `test/capture-sources.test.ts`, fails when a capture revision is not a commit of this repository or when code names an unknown commit, and CI checks out the full history for it. The archive note now counts 13 P9 commit IDs plus the earlier Go baseline commit.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-review-round-1-on-the-public-repository-2026-11-26).

| Area | Summary |
| --- | --- |
| Skill-script capture | `toolkits/buildos/test/golden/skills/script-source.ts` (new), `capture.ts`, `script-sha256.json` (palette pin), `capture-record.json` (revision) |
| Other archive reads | `toolkits/buildos/test/golden/validate/capture.ts` (`--script` required), `toolkits/buildos/test/wrappers.test.ts` (embedded Go-era wrapper with its SHA-256) |
| Guard | `toolkits/buildos/test/capture-sources.test.ts` (new); `.github/workflows/buildos-ci.yml` test job checks out the full history |
| Records | `toolkits/buildos/test/golden/CAPTURE.md` (Skill-Script and Validator Sources), the evidence report |
| Checks | Every `capture.ts --check` mode and the validator `--check` pass; `npm test` 2,735 tests, 0 fail |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section P9 Review Round 1 on the Public Repository; the archive note recount. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Skill-Script and Validator Sources: the public read commit and the archive capture provenance. |

### User

| Path | Description |
| --- | --- |
| None | No user-facing change. |
