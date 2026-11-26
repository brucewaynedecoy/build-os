---
title: "W1 R7 P6 Review Round 2 and CI Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P6"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the seven failures of CI run 45412403531 and the 17 P6 review round 2 findings: rewritten .cmd wrappers, one ownership rule for shared-file sections, one manifest contract, and an init journal that checks what the run wrote."
---

# W1 R7 P6 Review Round 2 and CI Fixes

## Changes

Fixes every failure of CI run 45412403531 on `9c6712a` and every finding of the second P6 review. The Windows `.cmd` wrapper never reached `npx`: its version check broke when the last character was removed, so a valid version was refused. The wrapper is rewritten: Node.js searches `PATH` in order (never the current folder), every shipped BuildOS wrapper is skipped, a loop guard stops a wrapper chain, delayed expansion is off, and arguments pass on without `call`. The `sh` wrapper reads `PATH` as POSIX does and skips the Go-era wrapper. `buildos init` now owns a section only when both marker lines are whole lines at column 0 outside every code or raw region, and stops with the file and line when it cannot decide. One manifest contract is shared by `buildos init` and the wrapper helper, tested against one table. The init journal records the identity, bytes, and mode it wrote, journals a write that committed before a later failure, lists temporary files it could not remove, and checks snapshots taken before Make Docs ran. Make Docs text now follows the Make Docs sections on disk and what BuildOS wrote. `npm test` passes 1,847 tests with 0 failures on macOS; Windows is not run locally.

Framing: [P6 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p6-review-round-2).

```text
build-os/
├── docs/
│   ├── prd/{06-operating-layer-and-routing,20-buildos-cli-and-distribution}.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│       ├── 06-command-names-wrappers-and-initialization.md
│       └── evidence.md
├── system/.os/scripts/
│   ├── AGENTS.md
│   ├── buildos, buildos.cmd, buildos-{intake,discovery,design}.cmd
│   └── pinned-version.cjs
└── toolkits/buildos/
    ├── SECURITY.md
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/commands/init.ts
    │   └── core/
    │       ├── init/{apply,init,make-docs,manifest,plan,shared-files}.ts
    │       └── shared/{envelope,fs-port}.ts
    └── test/
        ├── {init,init-review,init-review-2,manifest-contract,package,wrappers}.test.ts
        ├── {discovery,envelope}.test.ts
        ├── fixtures/manifest-contract.json
        └── golden/compare.test.ts
```

| Item | Result |
| --- | --- |
| CI run 45412403531 | 7 failures fixed: 1 Linux (inode reuse fooled the undo), 6 Windows (5 from the `.cmd` version check, 1 test that compared link text with `/`) |
| Review round 2 | 17 findings fixed, each with a test that fails without its fix; 2 round 1 items closed |
| Checks on macOS | `npm test` 1,847 tests, 0 failures, 12 skipped; the same with a space in `TMPDIR`; installed-tarball golden 167/167 |
| Open | A green Windows CI run of the `.cmd` wrappers; extended ACLs are not kept on a replaced file (tracked follow-up) |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Ownership rule, manifest contract, checks and undo, `partially_applied`, Make Docs text, and four requirement-history entries. |
| [docs/prd/06-operating-layer-and-routing.md](../../../docs/prd/06-operating-layer-and-routing.md) | Wrapper resolution details and one requirement-history entry. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md) | t19 and A47 wording, and closeout notes for round 2. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P6 Review Round 2 and P6 CI Run 45412403531. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Ownership rule, journal and undo guarantees, the ACL limit, the Windows folder-check limit, the wrapper limits, and the Windows installed-tarball CI step. |

### User

| Path | Description |
| --- | --- |
| [system/.os/scripts/AGENTS.md](../../../system/.os/scripts/AGENTS.md) | Wrapper order, the loop guard, and exact argument pass-through. |
