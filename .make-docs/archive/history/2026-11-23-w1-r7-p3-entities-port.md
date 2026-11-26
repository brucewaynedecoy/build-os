---
title: "W1 R7 P3 Entities Port"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P3"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Ported buildos entities from the Go seed to the TypeScript core and CLI, and turned the entities golden domain to enforced."
---

# W1 R7 P3 Entities Port

## Changes

Ports `buildos entities` (resolve, validate, consolidate, and rebuild-index) from the Go seed to `src/core/entities/` and a thin adapter in `src/cli/commands/entities.ts`, with no intended behavior change. Shared Go behavior moved to core: `encoding/json` decoding and key folding (`go-json.ts`, `go-fold.ts`), `%q` quoting and the `IsPrint` tables (`go-quote.ts`, `go-isprint.ts`), and `syscall` error text (`go-os-error.ts`). The filesystem port gained Go's atomic replace: a temporary file from `os.CreateTemp` rules in the target's folder, rename over a symlinked target, and a folder sync on POSIX only. The CLI reads `$PWD` as Go's `os.Getwd`, and UNC roots with doubled separators are spelled as `GetFullPathNameW` gives. The golden harness now enforces `entities` (27/27) and `cli` (8/8), and 30 POSIX edge goldens, 145 Go JSON answers, and 5 `$PWD` goldens, all from Go 1.24.1, check the port. Three review rounds returned CHANGES, and each fix has regression tests; the owner approved the PE-004 scope extension, PE-006, and PE-007 on 2026-11-23. The production code matched Go on all 67 reviewer fixtures. Local, on macOS: `npm test` 1,120 pass, 0 fail, 4 skipped (Windows-only); `capture.mjs --check` 158 cases; `--verify-artifact` passes for three sets. The Linux and Windows CI runs were pending at commit time, and the Go seed is unchanged until P8.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P3 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p3-entities-port).

```text
build-os/
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   ├── 03-entities-port.md
│   └── evidence.md
└── toolkits/buildos/
    ├── SECURITY.md, THIRD_PARTY_NOTICES.md
    ├── scripts/
    │   ├── capture-entity-edge-goldens.ts, capture-entity-json-goldens.ts
    │   ├── capture-pwd-goldens.ts, generate-go-fold.ts, generate-go-isprint.ts
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/ (commands/entities.ts, domain.ts, io.ts, parse.ts, run.ts)
    │   └── core/
    │       ├── entities/ (commands, consolidate, graph, index, io, resolve, types, validate)
    │       └── shared/ (errors, fs-port, go-path, go-fold, go-isprint, go-json, go-os-error, go-quote)
    └── test/
        ├── entities-bundle, entities-cli, entities-core, entities-edge tests
        ├── fs-port, go-parity, notices, root tests
        ├── fixtures/go-seed/ (entity-edge-goldens, entity-json, pwd-goldens)
        └── golden/ (CAPTURE.md, cases.json, harness.ts, parity-exceptions.json, selection and self tests)
```

| Area | Summary |
| --- | --- |
| Core | Graph loader, terminal resolution, validation, index rebuild, and consolidation, each mapped to its Go source in the evidence Port Map. |
| CLI | Go flags, required `--root`, human and JSON output, and exit 6 with the exact recovery command after a canonical write. |
| Port | Atomic replace in the target's folder, `os.CreateTemp` names and errors, symlink and containment rules, and no folder sync on Windows (PE-005). |
| Goldens | `entities` enforced; 30 edge goldens with field-scoped `{RAND}`, snapshot before permission restore, and outside link targets recorded. |
| Exceptions | PE-001 lists `entities`; PE-004 per-OS values and scope extension; PE-006 and PE-007 added with exact values and owner approval. |
| Notices | Go standard library ports and the generated fold tables listed under the Go BSD-3-Clause notice. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. `PERF-001` is flagged for the P8 recheck on the 159,026-byte bundle.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md) | Tasks ticked; t6, t8, t11, t13, and t14 open for three-OS CI with status lines; closeout status Done pending three-OS CI. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P3 Entities Port evidence, three review fix rounds, open items, and the P3 Review entry. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Capture record for the enforced entities domain. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Go standard library port and generated table rows. |
| [toolkits/buildos/THIRD_PARTY_NOTICES.md](../../../toolkits/buildos/THIRD_PARTY_NOTICES.md) | Go BSD-3-Clause notice scope for the new ports. |

### Maintainer

None this session.

### User

None this session.
