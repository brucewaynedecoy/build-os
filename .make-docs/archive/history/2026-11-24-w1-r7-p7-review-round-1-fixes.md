---
title: "W1 R7 P7 Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P7"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 14 findings of the first P7 review: buildos validate now rejects invalid saved anchors and the reserved value both, states its exact time format, bounds every loop, skips links it does not check, and matches names without case; design promotion reads the Make Docs 2.0.9 inputs; adoption notes the old Python validator."
---

# W1 R7 P7 Review Round 1 Fixes

## Changes

Fixes every finding of the first independent review of W1 R7 P7 Stages 4 and 5 (`b6c18c8`, CI run 45443040059 green on three operating systems). `buildos validate` now rejects a saved anchor with a URI scheme, the source-package `system/` prefix, or a path that folds to the project folder. It treats `both` as a reserved value: it fails in every scoped list, also when configured, and the config may not define it. `extracted_at` keeps its narrow check, and PRD 13 now states it as the RFC 3339 UTC profile (an orchestrator decision the owner may veto). The bounded reader checks its folder after the open, as writes do. YAML inline lists share the 64-level budget, and the findings budget stops every loop. A link at an unchecked name is skipped and never looked through, and a special file at a checked name is a finding. Names match ASCII case-insensitively on every OS. Design promotion read its Make Docs inputs only from `docs/assets/`, which Make Docs 2.0.9 does not write, so it failed in every normal project; it now reads `.make-docs/system/` first, keeps Go's behavior for the legacy layout, and otherwise stops with exit 3 and the setup command. An adoption that finds `validate_config.py` says it is no longer used. `npm test` passes 2,069 tests with 0 failures on macOS.

Framing: [P7 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-1).

```text
build-os/
├── AGENTS.md
├── docs/
│   ├── prd/{03-open-questions-and-risk-register,11-flow-c-integration,13-adopter-owned-config-surface,20-buildos-cli-and-distribution}.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│       ├── 07-skills-and-validation.md
│       └── evidence.md
└── toolkits/buildos/
    ├── SECURITY.md
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/commands/{go-tool,init}.ts
    │   └── core/
    │       ├── design/promote.ts
    │       ├── init/{init,plan}.ts
    │       └── validate/{checks,validate,yaml-subset}.ts
    └── test/
        ├── {design,fs-port,init,validate}.test.ts
        ├── fixtures/
        │   ├── make-docs-companion/ (byte copy of Make Docs 2.0.9 design inputs)
        │   └── validate/ (cases.json and 10 new cases)
        └── golden/
            ├── make-docs-companion/{capture.ts,capture-record.json}
            ├── proposed-exceptions.json (PE-017)
            └── validate/ (cases.ts, divergences.json, capture record, 11 new goldens)
```

| Item | Result |
| --- | --- |
| Review round 1 | 14 findings fixed, each with a test that fails without its fix; VD-18 to VD-22 added, VD-01, 05, 07, 13, 14, 15, 17 corrected |
| Checks on macOS | `npm test` 2,081 tests, 2,069 pass, 0 fail, 12 skipped; installed-tarball golden 167/167; validate capture 84/84 with Python 3.14.10; Make Docs companion capture 6/6; real `init --make-docs`, `validate`, and `design promote --dry-run` exit 0 |
| Open | A three-OS CI run of this round; owner questions on the R-009 design write format and on proposed parity exception PE-017; the D-007 time profile decision may be vetoed |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/13-adopter-owned-config-surface.md](../../../docs/prd/13-adopter-owned-config-surface.md) | The reserved value `both`, saved anchor path rules, the RFC 3339 UTC profile, case-insensitive names, link and special-file rules, and one requirement-history entry. |
| [docs/prd/11-flow-c-integration.md](../../../docs/prd/11-flow-c-integration.md) | The order in which promotion reads the Make Docs inputs, and one requirement-history entry. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Design input reading, the adoption note, and one requirement-history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | Review round 1 notes on D-006, D-007, and R-009 (Make Docs 2.0.9 facts and the write-side gaps). |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) | Closeout notes for the CI run and review round 1. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P7 CI Run 45443040059, P7 Review Round 1, the divergence table, the corrected design statement, and open items. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Read Safety, the remaining read window, validate link and budget rules, and the package file count without fixed byte sizes. |
| [AGENTS.md](../../../AGENTS.md) | The `system/docs/` row now says the folder was removed and where Make Docs 2.0.9 keeps its files. |
