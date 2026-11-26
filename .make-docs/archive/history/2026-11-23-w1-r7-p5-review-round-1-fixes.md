---
title: "W1 R7 P5 Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P5"
provider: "Anthropic"
repo: "build-os"
branch: "t3/w1-r7-p5-discovery-design-port"
summary: "Fixed the five P5 review findings against the Go tools, and recorded the approved parity exceptions PE-011 and PE-012 with the --allow-outside-root opt-in."
---

# W1 R7 P5 Review Round 1 Fixes

## Changes

Fixes the two blockers and three major findings of the first P5 review, each reproduced first against the Go 1.24.1 `buildos-discovery` and `buildos-design` tools. `--json` counts only as a whole argument in flag position, with Go `flag` rules (PE-011). A symlink at the finding record or the findings index is replaced, never followed, as Go's `os.Rename` does. A write that would land outside the root through a symlinked folder is refused before the first write (PE-012), unless `--allow-outside-root` is given, and a refusal after a write rolls back as a Go error does. Discovery reserves the run or finding folder with an exclusive `mkdir`, copies evidence as a stream (no 2 GiB limit), and removes what it created when a later step fails. A run row's `inputs` and `outputs` are checked for numbers out of Go's `float64` range. 22 new P5 edge goldens from the Go tools match through the bundle; `npm test` passes 1,215 tests with 0 failures on macOS.

Framing: [P5 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p5-review-fix-round-1).

```text
build-os/
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   ├── 05-discovery-and-design-port.md
│   └── evidence.md
└── toolkits/buildos/
    ├── scripts/capture-p5-edge-goldens.ts
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/
    │   │   ├── commands/{discovery,design,go-tool}.ts
    │   │   ├── go-flagset.ts
    │   │   └── run.ts
    │   └── core/
    │       ├── design/promote.ts
    │       ├── discovery/discovery.ts
    │       └── shared/{fs-port,go-files,go-json}.ts
    └── test/
        ├── {design,discovery,fs-port,go-tool-cli,p5-edge}.test.ts
        ├── fixtures/go-seed/p5-edge-goldens.json
        └── golden/{parity-exceptions.json,self-test.test.ts}
```

| Item | Result |
| --- | --- |
| Parity exceptions | PE-011 and PE-012 approved and recorded (proposed earlier as PE-008 and PE-009) |
| P5 edge goldens | 22/22 match the Go tools (17 byte for byte, 5 with exactly the approved values) |
| Golden harness | `cli` 8/8, `entities` 27/27, `discovery` 43/43, `design` 25/25 on macOS |
| Open | Three-OS CI run; P4 merge (see the P5 merge notes); PRD 20 sentence for PE-012 at merge |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md) | Closeout note for review round 1. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Owner decisions for PE-011, PE-012, and the reservation safety improvement; P5 Review Fix Round 1; P5 Merge Notes. |

### Maintainer

None this session.

### User

None this session.
