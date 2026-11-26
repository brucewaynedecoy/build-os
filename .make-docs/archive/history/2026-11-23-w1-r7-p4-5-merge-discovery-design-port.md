---
title: "W1 R7 P4-5 Merge Discovery and Design Port"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P4-5"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Merged the reviewed P5 discovery and design port into the P4 intake branch, with one filesystem port, one --allow-outside-root, and PE-001 to PE-015."
---

# W1 R7 P4-5 Merge Discovery and Design Port

## Changes

Merges `t3/w1-r7-p5-discovery-design-port` into `rewrite/ts-cli` with `--no-ff` and resolves 12 conflicted files. The filesystem port keeps P4's after-open checks, preflight, and intake-only in-place writer, and P5's link replacement, exclusive create, stream copy, rollback methods, and contained reads; P4's after-open rule now covers P5's writes too. The canonical-data port has no write in place, so discovery creates its record files with an exclusive create. Intake, discovery, and design share one `--allow-outside-root` parser and one refusal message (exit 3). Intake folders use Go's `0o755`. `parity-exceptions.json` holds PE-001 to PE-015 once each, with PE-001 regenerated for six domains. All five golden domains are enforced and pass on macOS.

Framing: the [evidence report, P4-P5 Merge](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p4-p5-merge).

```text
build-os/
├── docs/
│   ├── prd/20-buildos-cli-and-distribution.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md
└── toolkits/buildos/
    ├── {SECURITY,THIRD_PARTY_NOTICES}.md
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/{invocation,main,run}.ts
    │   ├── cli/commands/{go-tool,intake}.ts
    │   └── core/
    │       ├── discovery/discovery.ts
    │       ├── entities/io.ts
    │       ├── intake/io.ts
    │       └── shared/{fs-port,go-files,go-fs}.ts
    └── test/
        ├── {discovery,fs-port,intake-core}.test.ts
        └── golden/{parity-exceptions.json,selection.test.ts,self-test.test.ts}
```

| Item | Result |
| --- | --- |
| Conflicts | 12 files resolved; see the evidence table |
| `npm test` | 1,486 tests, 1,477 pass, 0 fail, 9 skipped |
| Golden harness | `cli` 8/8, `entities` 27/27, `intake` 55/55, `discovery` 43/43, `design` 25/25 |
| Bundle | 3,124,383 bytes |
| Open | Independent review of the merge; three-OS CI run |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Both phases' content in order, and the new P4-P5 Merge section. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | The outside-root Requirement History entry now covers intake, discovery, and design. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Both bundled-code rows; Write Safety states the merged write rules. |
| [toolkits/buildos/THIRD_PARTY_NOTICES.md](../../../toolkits/buildos/THIRD_PARTY_NOTICES.md) | Both Go port notices. |

### Maintainer

None this session.

### User

None this session.
