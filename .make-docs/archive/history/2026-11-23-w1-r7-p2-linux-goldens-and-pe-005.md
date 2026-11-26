---
title: "W1 R7 P2 Linux Goldens and PE-005"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P2"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Imported the linux goldens, fixed the Windows CRLF test failure, and added parity exception PE-005 with derived win32 goldens for the Go Windows directory-sync defect."
---

# W1 R7 P2 Linux Goldens and PE-005

## Changes

Follows up the P2 Golden Capture commit after capture run 45293367433. The linux goldens from that run (73 OS goldens, empty drift and mismatch lists, 265 files verified with `--verify-artifact`) are now in `os/linux/` with their capture record; the darwin artifact matched the committed set, so it was kept. A Windows CI failure came from CRLF line endings in a workflow file: the test now ignores line endings, and a new root `.gitattributes` checks out `.github/workflows/buildos-*.yml` with LF. The win32 capture showed that Go 1.24.1 fails its post-rename folder sync on Windows with `Access is denied.` in six cases. The owner chose option A on 2026-11-23: parity exception PE-005, "Go Windows directory-sync defect", makes the Go behavior on Linux and macOS the Windows target. `parity-exceptions.json` records PE-005 and its six cases; `capture.mjs` lists Go's defect output as `pe-005-skipped` and writes derived goldens with `--derive`; the harness accepts a derived golden only for a case PE-005 lists for that platform. Three derived win32 entity goldens are in `os/win32/`, and `pe-005.test.ts` covers the rules. A stale-golden fix records `removed-stale` with path and reason for this system's own golden of a shared case. New tasks P3 t14 and P5 t11 make the TypeScript atomic writes sync the parent folder in a way that works on Windows. Local: `npm test` 930 pass, 0 fail, 14 skipped; darwin `--check` passes; darwin and linux `--verify-artifact` match 265 files; path hygiene and PRD authority pass. The win32 goldens import and a green CI run on three operating systems were pending at commit time.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P2 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/02-golden-capture.md), the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md), and the prior record [W1 R7 P2 Golden Capture](./2026-11-23-w1-r7-p2-golden-capture.md).

```text
build-os/
├── .gitattributes
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   ├── 00-index.md, 03-entities-port.md, 05-discovery-and-design-port.md
│   └── evidence.md
└── toolkits/buildos/test/golden/
    ├── CAPTURE.md, parity-exceptions.json
    ├── capture.mjs, harness.ts
    ├── compare.test.ts, pe-005.test.ts, review-fixes.test.ts
    ├── self-test.test.ts, stale-goldens.test.ts
    └── os/linux/, os/win32/buildos/
```

| Area | Summary |
| --- | --- |
| Linux goldens | `os/linux/` from run 45293367433, with `capture-record.json`; 265 golden files verified. |
| CRLF fix | `review-fixes.test.ts` replaces `\r\n` with `\n`; root `.gitattributes` holds one LF rule for the BuildOS workflows. |
| PE-005 | Platform exception for `win32` with six cases: three entity cases and three design cases. |
| Capture tooling | `pe-005-skipped` records, `--derive`, and derived-golden checks in `capture.mjs`, `--check`, and `compare.test.ts`. |
| Derived goldens | Three entity cases in `os/win32/buildos/`; the design cases use the shared golden on Windows. |
| Stale goldens | `removed-stale` with `path` and `reason` `os-golden-for-shared-case`; `removed-os-golden` is gone. |
| Backlog | P3 t14 and P5 t11 for the Windows parent-folder sync, with a Change History entry in the backlog index. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md) | Change History entry for P3 t14 and P5 t11. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md) | New task t14: Windows parent-folder sync for the `entities` atomic writes. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md) | New task t11: Windows parent-folder sync for the `design promote` findings index. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Owner decision PE-005, P2 Windows Go Behavior, P2 CI Follow-Up, and PE-005 Derived Goldens. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Linux import, PE-005 capture rules, and the derived-golden transformation. |

### Maintainer

None this session.

### User

None this session.
