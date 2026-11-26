---
title: "W1 R7 P1 CI and Path-Port Fixes"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P1"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the P1 CI failures on Linux and Windows, redesigned the path port around OS resolution, and reported roots in Go filepath.Abs form; recorded PE-004 and the P3 follow-ups."
---

# W1 R7 P1 CI and Path-Port Fixes

## Changes

Fixes the Linux and Windows test failures from CI run 45270840446: link classification when stdout is a pipe on Linux, Windows 8.3 short paths, Windows device spelling, and CRLF line endings through `toolkits/buildos/.gitattributes`. The filesystem port now checks containment on the path the OS resolves, parses UNC paths by server and share, and reports the given root in Go `filepath.Abs` form through a new `go-path.ts` port that uses UTF-16 code units and matches 105 Go 1.24.1 goldens plus 8 extra astral cases. Root and target errors give typed envelopes that name the given root, with exit 3, and a failed write exits 5. The evidence report records the orchestrator decisions, the owner's approval of parity exception PE-004, the dispatcher-only scope of the P1 root-error evidence, and the CI fix rounds, and P3 gains t11 and t12 for the `entities` root-error checks and the `$PWD` current-folder base. The narrow review passed: 686 tests (672 pass, 14 skipped, 0 fail), `npm audit` 0, `npm pack` 6 files, guards and path hygiene pass.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P1 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md), [P3 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md).

```text
build-os/
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   ├── 00-index.md, 03-entities-port.md, evidence.md
└── toolkits/buildos/
    ├── .gitattributes
    ├── src/adapters/node-fs.ts
    ├── src/cli/run.ts
    ├── src/core/shared/fs-port.ts, root.ts, go-path.ts
    └── test/fs-port.test.ts, notices.test.ts, root.test.ts, fixtures/go-seed/root-spelling.json
```

| Area | Summary |
| --- | --- |
| CI fixes | Linux pipe-stdout link classification, Windows 8.3 paths, Windows device spelling, CRLF through `.gitattributes`. |
| Path port | Containment on the OS-resolved path; UNC server and share parsing; device checks below the share only. |
| Root spelling | Envelopes name the given root in Go `filepath.Abs` form; Go 1.24.1 goldens in `root-spelling.json`. |
| Root errors | Typed envelopes with the given root: exit 3 for roots and unreadable targets, exit 5 for failed writes; PE-004 approved. |
| Evidence scope | P1 root-error evidence is dispatcher-level only, through a test domain; P3 t11 repeats it for `entities`. |
| Backlog | P3 t11 (packaged-binary root errors for `entities`) and t12 (`$PWD` current-folder base, with a golden); index Change History entry. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Orchestrator decisions, PE-004 approval, dispatcher-only label for root-error evidence, and the P1 CI fix rounds note. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md) | New Stage 2 tasks t11 and t12. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md) | Change History entry for the P3 task additions. |

### Maintainer

None this session.

### User

None this session.
