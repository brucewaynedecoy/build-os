---
title: "W1 R7 P7 Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P7"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 10 findings of the second P7 review: a project set up without Make Docs now works in every domain, every file read has a size bound, design inputs stay inside the project, the Make Docs stop shows only a command that works, and validate checks anchors, depth, and its budget exactly. Recorded the owner decisions on D-006 and D-007."
---

# W1 R7 P7 Review Round 2 Fixes

## Changes

Fixes every finding of the second independent review of W1 R7 P7 Stages 4 and 5 (`3bced49`, CI run 45449688415 green on three operating systems). A project made by `buildos init --skip-make-docs` has no `docs/` folder, and the intake, discovery, and design commands read it as a source checkout; one installed-root rule now serves every domain (PRD 05), and end-to-end tests run every domain against real `init` output. Every file read in core has a size bound, and the Make Docs design inputs are read inside the project, with a link followed only to a regular file inside it. The design promotion stop now uses the `buildos init` rules: it gives the repair or setup command only where Make Docs 2.0.9 accepts the folder, and says plainly when it does not. `buildos validate` splits an anchor at its first `#`, rejects a folder target and a hidden `system/` prefix, checks YAML depth for a last `- key: value` item, and stops every loop at its findings budget. The owner decisions of 2026-11-24 on D-006 item 1 and D-007 items 1 and 2 are recorded. `npm test` passes 2,099 tests with 0 failures on macOS.

Framing: [P7 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-2).

```text
build-os/
├── docs/
│   ├── prd/{03-open-questions-and-risk-register,05-spaces-boundary-and-shipping,11-flow-c-integration,13-adopter-owned-config-surface,20-buildos-cli-and-distribution}.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md
└── toolkits/buildos/
    ├── SECURITY.md
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/commands/go-tool.ts
    │   └── core/
    │       ├── design/promote.ts
    │       ├── discovery/discovery.ts
    │       ├── entities/{commands,consolidate,graph,index}.ts
    │       ├── init/plan.ts
    │       ├── intake/{io,convert/convert}.ts
    │       ├── shared/{buildos-layout,errors,fs-port,go-files,go-fs,go-os-error,read-limits}.ts
    │       └── validate/{checks,yaml-subset}.ts
    └── test/
        ├── {installed-layout,read-bounds}.test.ts (new)
        ├── {boundary,design,fs-port,init,root,validate}.test.ts
        ├── fixtures/validate/ (cases.json and the case version-4301-digits)
        └── golden/
            ├── companion-record.test.ts (new)
            ├── make-docs-companion/{capture,record}.ts
            ├── proposed-exceptions.json (PE-017, full scope)
            └── validate/ (divergences.json, capture record, one new golden)
```

| Item | Result |
| --- | --- |
| Review round 2 | 10 findings fixed, each with a test that fails without its fix; VD-14 and VD-18 extended, VD-23 added; PE-017 states six behaviors and stays proposed |
| Checks on macOS | `npm test` 2,111 tests, 2,099 pass, 0 fail, 12 skipped; installed-tarball golden 167/167 with goldens unchanged; validate capture 85/85 with Python 3.14.10; Make Docs companion capture 6/6; real `init --skip-make-docs` and `init --make-docs` runs as stated in the evidence |
| Open | A three-OS CI run of this round; owner decisions on PE-017, the R-009 design write format, and the RFC 3339 profile; the `dataset_refs: null` check when skills are imported |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/05-spaces-boundary-and-shipping.md](../../../docs/prd/05-spaces-boundary-and-shipping.md) | The installed-root rule, and one requirement-history entry. |
| [docs/prd/13-adopter-owned-config-surface.md](../../../docs/prd/13-adopter-owned-config-surface.md) | The saved anchor spelling rules (first `#`, fragment, folder, raw `system/`), and one requirement-history entry with the owner decisions. |
| [docs/prd/11-flow-c-integration.md](../../../docs/prd/11-flow-c-integration.md) | The three stop cases and contained, bounded input reads, and one requirement-history entry. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | The promotion stop, read bounds, design input reads, the installed-root rule, the validator note, and one requirement-history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | Owner decisions on D-006 item 1 and D-007 items 1 and 2; review round 2 notes on D-006, D-007, and R-009. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Owner decisions, P7 CI Run 45449688415, P7 Review Round 2 with the read-site audit, the divergence table, and open items. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Read Safety: the read bounds and their sites, the design input rule, and where the audit is. |
