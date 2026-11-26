---
title: "W1 R7 P1 Windows Path Fixes"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P1"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the three Windows test failures from CI run 45281077505 with Win32 path folding and platform-aware errno checks."
---

# W1 R7 P1 Windows Path Fixes

## Changes

Fixes the three Windows test failures from CI run 45281077505; macOS, Linux and OSV passed in that run. Windows path folding in `go-path.ts` now follows the Win32 path normalization rules for `GetFullPathNameW`: separator folding, path type and current folder, `.` and `..` folding above the root, trailing dot and space rules, and the dropped separator after a UNC share. A Windows-only test compares 37 cases with the real `GetFullPathNameW`, and 25 published-example cases are added. One `root-spelling.json` entry that real Windows output contradicts is removed. The ENAMETOOLONG and ENOTDIR expectations are now platform-aware on Windows. Local: 687 tests, 0 fail, 14 skipped; build, guards, `npm audit` 0, `npm pack` 6 files, path hygiene pass. Review and the Windows CI run were pending at commit time.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P1 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md).

```text
build-os/
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   └── evidence.md
└── toolkits/buildos/
    ├── src/core/shared/go-path.ts
    └── test/root.test.ts, fixtures/go-seed/root-spelling.json
```

| Area | Summary |
| --- | --- |
| Path folding | `win32FullPath` follows the Win32 path normalization rules for `GetFullPathNameW`. |
| Tests | Windows-only `GetFullPathNameW` comparison (37 cases) and 25 published-example cases. |
| Fixture | One contradicted UNC `..` entry removed from `root-spelling.json`. |
| Errno | ENAMETOOLONG and ENOTDIR expectations are platform-aware on Windows. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | CI fix round 2 line in the P1 CI fix rounds note. |

### Maintainer

None this session.

### User

None this session.
