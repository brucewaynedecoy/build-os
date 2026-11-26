---
title: "W1 R7 P4-5 Merge Review and Windows CI Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P4-5"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the three merge review cleanup findings and the six Windows CI failures of run 45336979268."
---

# W1 R7 P4-5 Merge Review and Windows CI Fixes

## Changes

Fixes the three findings of the P4-P5 merge review, each reproduced first on `e1dc814`, and the six Windows failures of CI run 45336979268. Discovery now lists a record file, copy, or folder for its cleanup only after it created it, so a file another process put in the reserved folder is never removed. The port's exclusive create is complete only after its close succeeds, and any failed step removes its own new file, so a retry works. Every port cleanup (temporary file, new file, temporary link, in-place create, and link replacement) now removes an entry only when its folder and the entry itself are still the ones it created, and otherwise refuses and names what it left. On Windows, the in-place writer now fails a folder target with Go's `open <path>: is a directory`; the other five Windows failures were POSIX-only test expectations (Go's `EIO` text and `/` separators), now platform-aware without changing the POSIX assertions. `npm test` passes 1,495 tests with 0 failures on macOS.

Framing: the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p4-p5-merge-fix-round).

```text
build-os/
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   └── evidence.md
└── toolkits/buildos/
    ├── SECURITY.md
    ├── src/
    │   ├── adapters/node-fs.ts
    │   └── core/
    │       ├── discovery/discovery.ts
    │       └── shared/{fs-port,go-os-error}.ts
    └── test/{discovery,fs-port,intake-hostile}.test.ts
```

| Item | Result |
| --- | --- |
| Merge review findings | 3 fixed, each with a regression test that fails without the fix; 10 cleanup sites audited |
| Windows CI failures | 1 port defect fixed (folder twin on Windows); 5 POSIX-only test expectations made platform-aware |
| Golden harness | `cli` 8/8, `entities` 27/27, `intake` 55/55, `discovery` 43/43, `design` 25/25 on macOS |
| Open | Three-OS CI run; independent review of this round |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P4-P5 Merge Fix Round: findings, cleanup audit, Windows causes, and checks. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Write Safety: the cleanup rule and the Windows folder rule. |

### User

None this session.
