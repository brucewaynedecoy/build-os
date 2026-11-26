---
title: "W1 R7 P7 Review Round 3 Fixes and Design Text"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P7"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 7 blockers and majors of the third P7 review, tracked the 4 minors as follow-ups, split the deny-list check into its own CI workflow, and built P7 Stage 6: a design promoted in a Make Docs 2.0.9 project now follows the project's 2.0.9 template and contract."
---

# W1 R7 P7 Review Round 3 Fixes and Design Text

## Changes

Fixes the blockers and majors of the third independent review of W1 R7 P7 Stages 4 and 5. A path the user names is used as written, so an explicit `system/...` path no longer reads another file in a project that owns a `system/` folder. An HTML image is read only from the document's own folder or the project, so an export can no longer pull an unrelated local file into a project. `--allow-outside-root` no longer widens reads of project data, and discovery and design read the entity graph inside the project. A file BuildOS reads back is never written over its read bound. The Make Docs design stop tells an empty file from a missing one, with steps checked against Make Docs 2.0.9, and an over-limit input no longer falls back to a legacy body. `buildos init` stops in the BuildOS source checkout and adopts only a folder with Go-era marks. The deny-list job moved to its own workflow with no path filter, and the test workflow has its path filter back. Stage 6 writes the Make Docs 2.0.9 design form in 2.0.9 projects and keeps the Go bytes in the earlier layout (PE-020). `npm test` passes 2,154 tests with 0 failures on macOS.

Framing: [P7 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-3).

```text
build-os/
├── .github/workflows/
│   ├── buildos-ci.yml (path filter back, deny-list job removed)
│   └── buildos-deny-list.yml (new)
├── docs/
│   ├── prd/{03-open-questions-and-risk-register,05-spaces-boundary-and-shipping,11-flow-c-integration,20-buildos-cli-and-distribution}.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/{07-skills-and-validation,evidence}.md
└── toolkits/buildos/
    ├── SECURITY.md
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/commands/{go-tool,intake}.ts
    │   └── core/
    │       ├── design/{make-docs-form (new),promote}.ts
    │       ├── discovery/discovery.ts
    │       ├── entities/{commands,consolidate,index}.ts
    │       ├── init/init.ts
    │       ├── intake/{io,convert/convert,index/index}.ts
    │       └── shared/{buildos-layout,go-files,read-limits}.ts
    └── test/
        ├── review-round-3.test.ts (new)
        ├── {design,installed-layout,manifest-contract,package}.test.ts
        ├── init-review{,-2,-3,-4}.test.ts (Go-era fixtures gain .os/data/)
        └── golden/
            ├── parity-exceptions.json (PE-020)
            ├── proposed-exceptions.json (PE-018, PE-019)
            ├── self-test.test.ts
            └── validate/divergences.json (VD-03, VD-06, VD-08 decided)
```

| Item | Result |
| --- | --- |
| Review round 3 | P7-R3-01 to P7-R3-07 fixed, each with a test that fails without its fix; P7-R3-11 fixed in words; P7-R3-08 to P7-R3-10 tracked as F-P7-01 to F-P7-04, and F-P7-05 for the templates listing |
| Stage 6 | The 2.0.9 form built from the project's template and checked against its contract; links and `make-docs://` URIs resolve against the 2.0.9 companion fixture; unknown forms stop before any write; PE-020 approved under option B |
| Checks on macOS | `npm test` 2,166 tests, 2,154 pass, 0 fail, 12 skipped; installed-tarball golden 167/167 with goldens unchanged; validate capture 85/85; Make Docs companion capture 6/6; a real promotion with Make Docs 2.0.9 passes Make Docs path hygiene |
| Open | Owner decisions on proposed PE-018 and PE-019; a three-OS CI run after a push; the `BUILDOS_DENY_LIST` secret; the R-009 write path |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/05-spaces-boundary-and-shipping.md](../../../docs/prd/05-spaces-boundary-and-shipping.md) | Which commands use the installed-root rule, the content-root contracts of `entities --root` and `validate --root`, paths the user names, the `init` checkout stop and adoption marks, and one requirement-history entry. |
| [docs/prd/11-flow-c-integration.md](../../../docs/prd/11-flow-c-integration.md) | The empty and over-limit input rules, the copied-project note, contained input reads, the written 2.0.9 form, and two requirement-history entries. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Paths the user names, the switch for writes only, read-back sizes, contained reads, HTML images, the `init` stops, the design form, and two requirement-history entries. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-009: the design format resolved; the write path and the version boundary stay open. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) | t9 wording, t20 and t21 done, A63a and A63b results, closeout notes. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The PE-020 owner-decision row, P7 CI Run 45456513930, P7 Review Round 3, P7 Stage 6, and open items. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Read Safety: design inputs and the switch, the entity graph, HTML images, read-back sizes; CI path filter and the deny-list workflow. |
