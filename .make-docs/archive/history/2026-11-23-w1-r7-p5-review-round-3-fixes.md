---
title: "W1 R7 P5 Review Round 3 Fixes"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P5"
provider: "Anthropic"
repo: "build-os"
branch: "t3/w1-r7-p5-discovery-design-port"
summary: "Fixed the two P5 review round 3 findings: a promotion rollback keeps each link's own mode whatever the umask, and discovery fails as Go does on a read-only index."
---

# W1 R7 P5 Review Round 3 Fixes

## Changes

Fixes the two findings of the third P5 review, each reproduced first on `2ceccce`. A promotion rollback now puts a symlink back with its own original mode (macOS `lchmod`; skipped on Linux, where a link's mode is always 0777), and restored files and folders keep their exact modes under any umask. Discovery now checks that an existing regular `runs.jsonl` or `findings.jsonl` is writable before it replaces it, so a 0444 index fails with Go's `open <path>: permission denied`, exit 1, and keeps its bytes and mode. No other port write replaces a file that Go writes in place. The evidence records the reviewer's Go rollback observation and the index-link replacement as pending owner decision PE-014, not approved. Two new P5 edge goldens come from the Go 1.24.1 discovery tool; `npm test` passes 1,248 tests with 0 failures on macOS.

Framing: [P5 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p5-review-fix-round-3).

```text
build-os/
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   ├── 05-discovery-and-design-port.md
│   └── evidence.md
└── toolkits/buildos/
    ├── scripts/capture-p5-edge-goldens.ts
    ├── src/
    │   ├── adapters/node-fs.ts
    │   └── core/
    │       ├── design/promote.ts
    │       └── shared/{fs-port,go-files}.ts
    └── test/
        ├── {design,fs-port,p5-edge}.test.ts
        └── fixtures/go-seed/p5-edge-goldens.json
```

| Item | Result |
| --- | --- |
| Findings | 2 fixed, each with a regression test that fails without the fix |
| P5 edge goldens | 27/27 match the Go tools (24 earlier cases unchanged in a fresh capture; 2 new read-only index cases equal Go except the folder the approved cleanup removes) |
| Golden harness | `cli` 8/8, `entities` 27/27, `discovery` 43/43, `design` 25/25 on macOS |
| Open | Owner decision PE-014; three-OS CI run; P4 merge (see the P5 merge notes) |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md) | Closeout note for review round 3. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P5 Review Fix Round 3, P5 Merge Notes, and P5 Open Items. |

### Maintainer

None this session.

### User

None this session.
