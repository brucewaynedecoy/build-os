---
title: "W1 R7 P7 Skills Round 2 and Closing Check Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P7"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 8 findings of skills review round 2 and the 5 findings of the Stages 4 to 6 closing check, recorded the owner approval of parity exceptions PE-018 and PE-019, and fixed the deny-list CI failure on the bundled PDF reader's simulated home path."
---

# W1 R7 P7 Skills Round 2 and Closing Check Fixes

## Changes

Fixes P7S-R2-01 to P7S-R2-08 and P7-R4-01 to P7-R4-05, each with a test that fails without the fix. The deny-list check reads XML in its declared encoding, joins actual text nodes, reads ZIP comments and extra fields, PDF strings, and PNG text chunks, matches POSIX, drive, and UNC home-folder paths with whole Unicode names, and allows one exact dependency path in the bundle only; its self-test now scans the built package as CI does, which explains CI run 45474800265. Test failure messages print counts and hash tags, with `scripts/locate-hash.ts` to find an item locally. The guide's chapter 7 record matches chapter 4, a test loads both into a project, and the guide's validator commands use `buildos validate`. The CI path filter covers whole folders, with a test. The bulk-extract helper takes ASCII digits only and refuses rows its reader could not read. Discovery records the raw finding it read; every JSONL writer checks each row against its reader's line limit (exit 4); HTML image addresses are percent-decoded once before the containment check; the Make Docs 2.0.9 design form checks the template first, puts values in once, escapes the title and block openers, and reads the result back. The owner approved PE-018 and PE-019; both moved to `parity-exceptions.json` with this round's additions.

Framing: [P7 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) and the evidence report sections [P7 Skills Review Round 2](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-review-round-2) and [P7 Review Round 4](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-4-closing-check).

```text
build-os/
├── .github/workflows/buildos-ci.yml (path filter)
├── docs/
│   ├── prd/{11-flow-c-integration,20-buildos-cli-and-distribution}.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/{07-skills-and-validation,evidence}.md
├── guide/ (8 chapters, BuildOS-Guide.html rebuilt)
├── system/.os/skills/buildos-bulk-extract/{scripts/work.py,tests/test_work.py}
└── toolkits/buildos/
    ├── SECURITY.md
    ├── scripts/{check-deny-list.mjs,locate-hash.ts}
    ├── src/core/
    │   ├── design/{make-docs-form,promote}.ts
    │   ├── discovery/discovery.ts
    │   ├── entities/consolidate.ts
    │   ├── intake/convert/convert.ts
    │   └── shared/read-limits.ts
    └── test/
        ├── golden/{parity-exceptions,proposed-exceptions}.json, golden/self-test.test.ts
        ├── {guide-examples,review-round-4}.test.ts (new)
        └── {deny-list,skills,system-content,package,design,review-round-3}.test.ts, helpers.ts
```

| Item | Result |
| --- | --- |
| Findings | 13 of 13 fixed, each with a test |
| Owner decisions | PE-018 and PE-019 approved; scope widened in the same round (image address decoding; JSONL row limits) |
| Checks on macOS | See the evidence report check table |
| Open | The real-list deny-list run (the orchestrator); a three-OS CI run after the push; the guide's Go-era install narrative (P8 t8) |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | JSONL row limits, image address decoding, the deny-list coverage, and two requirement-history entries. |
| [docs/prd/11-flow-c-integration.md](../../../docs/prd/11-flow-c-integration.md) | The 2.0.9 design form checks and escaping, and one requirement-history entry. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The CI runs, both review tables, the stored-path audit, the JSONL writer list, the exception scope, the owner decision, and open items. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) | The round in the closeout notes. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The deny-list coverage stated exactly, the allowed dependency path, the JSONL row-limit rule, HTML image decoding, and the CI path filter. |
