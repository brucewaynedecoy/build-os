---
title: "W1 R7 P5 Discovery and Design Port"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P5"
provider: "Anthropic"
repo: "build-os"
branch: "t3/w1-r7-p5-discovery-design-port"
summary: "Ported buildos-discovery to buildos discovery and buildos-design to buildos design promote, and turned both golden domains to enforced."
---

# W1 R7 P5 Discovery and Design Port

## Changes

Ports the Go tools `buildos-discovery` (run recording, raw-finding anchoring, finding qualification) and `buildos-design` (design promotion) to `buildos discovery` and `buildos design promote`, with the same subcommands, flags, output, written files, and exit codes, and resolves playbook, target, run, and finding IDs through the P3 entity core in the same process. Core stays free of `fs`: the filesystem port gains `statEntry`, `writeNewFile`, `writeFile`, and `appendFile`, and its `mkdir` takes a mode, so folders are made with Go's `0o755` under any umask. The atomic replaces of the findings index and the finding record skip the folder flush on Windows (PE-005, t11). A minimal `src/cli/invocation.ts` maps the legacy tool names to their domains, because the golden harness runs these cases under those names. On macOS, the golden harness enforces `discovery` (43/43) and `design` (25/25), and 33 extra edge cases match the Go 1.24.1 tools. The ported Go tests, A33, A35, A36, and the t11 test pass, and `npm test` passes 1,176 tests with 0 failures. The Linux and Windows results wait for CI. `R-009` stays open, and no Go code was deleted.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P5 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p5-discovery-and-design-port).

```text
build-os/
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   ├── 05-discovery-and-design-port.md
│   └── evidence.md
└── toolkits/buildos/
    ├── SECURITY.md
    ├── THIRD_PARTY_NOTICES.md
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/
    │   │   ├── commands/{discovery,design,go-tool}.ts
    │   │   ├── go-flagset.ts
    │   │   ├── invocation.ts
    │   │   ├── main.ts
    │   │   └── run.ts
    │   └── core/
    │       ├── design/promote.ts
    │       ├── discovery/discovery.ts
    │       ├── entities/io.ts
    │       └── shared/{buildos-layout,fs-port,go-files,go-text}.ts
    └── test/
        ├── {discovery,design,go-tool-cli}.test.ts
        └── golden/{cases,parity-exceptions}.json
```

| Item | Result |
| --- | --- |
| Golden harness | `discovery` and `design` enforced; 43/43 and 25/25 on macOS; Linux and Windows pending CI |
| Proposed parity exceptions | PE-008 (`--json` for the ported tools) and PE-009 (port refusals of writes outside the root); neither approved |
| Open | t3, t4, t7, t8, and t11 wait for the three-OS CI run; the PE-001 root help value needs one more update when P4 adds `intake` |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md) | Ticked t1, t2, t5, t6, t9, and t10; filled the closeout notes. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section P5 Discovery and Design Port. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Inventory row for the P5 Go standard library ports. |
| [toolkits/buildos/THIRD_PARTY_NOTICES.md](../../../toolkits/buildos/THIRD_PARTY_NOTICES.md) | Notice entry for the P5 Go standard library ports. |

### Maintainer

None this session.

### User

None this session.
