---
title: "W1 R7 P2 Golden Capture"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P2"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Captured Go goldens for 158 cases and added the golden comparison harness, its self-test, and the per-OS capture workflow."
---

# W1 R7 P2 Golden Capture

## Changes

Records what the four Go tools and their legacy names do today, as the parity reference for the P3 to P6 ports. A synthetic fixture set and a 158-case manifest cover success, dry run, and error exits, plus help and version for each invocation name. `capture.mjs` builds each Go tool from source (Go 1.24.1) and records stdout, stderr, exit code, JSON, and every file change with its mode, type, and link target. The goldens hold 85 shared cases and 73 `darwin` cases; the `buildos-golden-capture` workflow, run by a push to a `golden-capture/**` branch, captures the `linux` and `win32` sets. `compare.test.ts` runs the bundled CLI against the goldens, with `pending` and `enforced` domains, exact parity exceptions, and a planted-difference self-test; CI runs it as a separate step. Three review rounds returned CHANGES, and each fix has regression tests; the last made `--check` name stale golden folders and the capture report record each removal. Local: `capture.mjs --check` passes, `--verify-artifact` matches 265 files, `npm test` 905 pass, 0 fail, 14 skipped. The final verification review, the `linux` and `win32` goldens, and a green CI run on three operating systems were pending at commit time.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P2 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/02-golden-capture.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md).

```text
build-os/
├── .github/workflows/
│   ├── buildos-ci.yml
│   └── buildos-golden-capture.yml
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   ├── 02-golden-capture.md
│   └── evidence.md
└── toolkits/buildos/
    ├── SECURITY.md, package.json, tsconfig.json
    └── test/
        ├── go-parity.test.ts
        ├── fixtures/golden/
        └── golden/
            ├── CAPTURE.md, cases.json, parity-exceptions.json
            ├── capture.mjs, harness.ts, generate-fixtures.ts
            ├── *.test.ts
            └── buildos*/, os/darwin/
```

| Area | Summary |
| --- | --- |
| Fixtures | Six invented projects in the repository and installed layouts; entity cases reuse `testdata/persona-pilot/`. |
| Manifest | 158 cases across `cli`, `entities`, `intake`, `discovery`, and `design`, with normalizations and their reasons. |
| Capture | Go built from source; per-OS goldens for 73 OS-dependent cases; drift, stale, and changed goldens listed in the report. |
| Harness | Byte comparison of streams, exit code, JSON, file tree, and modes; PDF text compared after whitespace normalization. |
| Exceptions | `parity-exceptions.json` holds exact allowed values; `go-parity.test.ts` now reads the seed exceptions from it. |
| CI | Golden harness step in `buildos-ci.yml`; capture workflow with hidden-file upload and an artifact manifest check. |
| Security | `SECURITY.md` Scan Record now names CI run 45282558470 for the OSV job. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/02-golden-capture.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/02-golden-capture.md) | Tasks ticked; t6 and t12 open for the `linux` and `win32` goldens and CI; closeout notes. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P2 Golden Capture evidence, three fix rounds, and the P2 Review entry. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Capture record, refresh rule, and per-OS capture steps. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | OSV job row in the Scan Record. |

### Maintainer

None this session.

### User

None this session.
