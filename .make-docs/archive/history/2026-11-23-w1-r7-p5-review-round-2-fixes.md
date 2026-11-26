---
title: "W1 R7 P5 Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P5"
provider: "Anthropic"
repo: "build-os"
branch: "t3/w1-r7-p5-discovery-design-port"
summary: "Fixed the five P5 review round 2 findings: atomic discovery index writes, an exact promotion rollback, --allow-outside-root for writes only, a resolution retry for a race, and raw-byte edge digests."
---

# W1 R7 P5 Review Round 2 Fixes

## Changes

Fixes the two blockers and three major findings of the second P5 review, each reproduced first on `7ddf54c` and, where Go behavior applies, against the Go 1.24.1 `buildos-discovery` and `buildos-design` tools. Discovery adds its index row with an atomic replace that writes Go's exact bytes, so a failed write leaves the old index and a symlink at the index is replaced, never followed. Promotion restores every replaced entry as it was after any failure (a symlink stays a symlink), also after a step that fails once its rename has landed. `--allow-outside-root` now applies only to write destinations; content reads stay inside the root. Path resolution starts again when a missing folder appears during the walk, so the loser of a `qualify finding` race gets Go's `already exists` and exit 1. The P5 edge harness hashes raw bytes, so a BOM added to a file changes the observation. Three new P5 edge goldens from the Go tools are recorded under PE-012; `npm test` passes 1,232 tests with 0 failures on macOS.

Framing: [P5 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p5-review-fix-round-2).

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
    │       ├── discovery/discovery.ts
    │       └── shared/{fs-port,go-files}.ts
    └── test/
        ├── {design,discovery,fs-port,p5-edge}.test.ts
        ├── fixtures/go-seed/p5-edge-goldens.json
        └── golden/parity-exceptions.json
```

| Item | Result |
| --- | --- |
| Findings | 2 blockers and 3 major findings fixed, each with a regression test |
| P5 edge goldens | 25/25 match the Go tools (22 earlier cases unchanged in a fresh capture; 3 new PE-012 cases differ only in the tree) |
| Golden harness | `cli` 8/8, `entities` 27/27, `discovery` 43/43, `design` 25/25 on macOS |
| Open | Owner confirmation of the PE-012 index-link extension; three-OS CI run; P4 merge (see the P5 merge notes) |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md) | Closeout note for review round 2. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P5 Review Fix Round 2, the PE-012 table row, P5 Merge Notes, and P5 Open Items. |

### Maintainer

None this session.

### User

None this session.
