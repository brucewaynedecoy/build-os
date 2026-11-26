---
title: "W1 R7 P4-5 Windows OS Error Text and Cleanup Naming"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P4-5"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the cleanup naming finding, pinned the discovery test texts, and matched Go's Windows os.Stat op name (CI run 45339414591)."
---

# W1 R7 P4-5 Windows OS Error Text and Cleanup Naming

## Changes

Fixes the last P4-P5 merge review finding and its test follow-ups, and the two Windows golden failures of CI run 45339414591 (`intake-convert-missing-source` and `intake-convert-missing-root`). The port's cleanup now checks that the entry's folder is still the one it was created in before it looks at the entry, so a refused atomic symlink put whose folder was replaced by an empty folder removes nothing and names the temporary link left in place. On Windows, Go 1.24.1's `os.Stat` reports its failure from `CreateFile` (`os/stat_windows.go`); a new shared `goStatOp` gives that op at every `os.Stat` site the port mirrors (the intake convert source, outputs, and index roots, and the entities index and consolidation datasets; discovery and design already did), and a new test checks the mapping against every win32 golden with an OS error and fails when a golden or a source site is not covered. The discovery tests now pin Go's `EIO` text as a literal per OS, require `/` on POSIX, and prove that a retry after a read failure succeeds. `npm test` passes 1,516 tests with 0 failures on macOS.

Framing: the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p4-p5-windows-os-error-text-round).

```text
build-os/
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   └── evidence.md
└── toolkits/buildos/
    ├── src/
    │   ├── adapters/node-fs.ts
    │   └── core/
    │       ├── entities/{consolidate,index}.ts
    │       ├── intake/{convert/convert,index/index}.ts
    │       └── shared/{go-files,go-os-error}.ts
    └── test/
        ├── {discovery,fs-port,go-os-error}.test.ts
        └── golden/review-fixes-2.test.ts
```

| Item | Result |
| --- | --- |
| Review finding | Fixed; regression test fails without the fix |
| Test follow-ups | `EIO` text pinned per OS; `/` required on POSIX; read-failure retry proven |
| Windows CI failures | 2 golden cases, one cause (`stat` where Go prints `CreateFile`); 6 `os.Stat` sites fixed |
| Win32 goldens checked | 19 golden files with an OS error: 17 match the mapping, 2 are PE-004 (not mirrored) |
| Golden harness | `cli` 8/8, `entities` 27/27, `intake` 55/55, `discovery` 43/43, `design` 25/25 on macOS |
| Open | Three-OS CI run; independent review of this round |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P4-P5 Windows OS Error Text Round: finding, Windows cause, golden audit, and checks. |

### Maintainer

None this session.

### User

None this session.
