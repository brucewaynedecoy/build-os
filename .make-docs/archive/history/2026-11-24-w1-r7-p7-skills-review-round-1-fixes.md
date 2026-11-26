---
title: "W1 R7 P7 Skills Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P7"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 14 findings of the independent review of the P7 skills import: a stronger deny-list check with a home-folder path guard, the two committed Go binaries removed, capped test output, skill paths that match the installed layouts, the bulk-extract helper aligned with buildos validate, a corrected Azure Boards example, and the neutral topic in the use cases and the guide."
---

# W1 R7 P7 Skills Review Round 1 Fixes

## Changes

Fixes the 14 findings (P7S-R1-01 to P7S-R1-14) of the independent review of `d1f315b`, each with a test that fails without the fix. The deny-list check prints every path part through one redaction function, archive members and nested archives included; counts every file or archive member it cannot fully read and fails on one in a shipped path; reads the visible text of Office XML; matches across lines at any size; decodes UTF-16 text; and fails on a path inside a personal home folder. The two committed Go binaries held such a path and nothing runs them, so they are deleted and their folders are ignored (P8 work brought forward); the Go source stays. Tests print counts and sizes instead of file lists, file contents, or full command output. The skills name only paths that a new project has, with or without Make Docs, or say what to do without them, and a test checks every skill path against both layouts. The bulk-extract helper applies the `buildos validate` anchor, ID, sentinel, and time rules before staging and publication, and treats the CLI's empty references index as an empty queue. The Azure Boards fine cap is a maximum again, with a criterion on both sides of the cap and a rebuilt golden CSV. The use cases and the guide use the invented library lending topic, with real-work counts, timings, and quotes made general, and the guide HTML is rebuilt. The owner made the repository private on 2026-11-24 and left git history as it is until before P8.

Framing: [P7 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-review-round-1).

```text
build-os/
├── .gitignore (Go toolkit bin/ folders)
├── {USE_CASES,USE_CASES_TESTING}.md
├── docs/
│   ├── assets/user/{convert-source-material-with-buildos-intake,record-discovery-runs-and-qualify-findings}.md
│   ├── prd/20-buildos-cli-and-distribution.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/{07-skills-and-validation,08-release-0-1-0,evidence}.md
├── guide/ (17 chapters, BuildOS-Guide.html rebuilt)
├── system/.os/skills/
│   ├── 14 SKILL.md files (paths, intake source, read-only report)
│   ├── buildos-bulk-extract/{scripts/work.py,tests/test_work.py}
│   └── buildos-export-azure-boards/ (fine cap: manifest, examples, template, golden CSV)
└── toolkits/
    ├── buildos-{discovery,intake}/bin/ (deleted)
    ├── buildos-intake/internal/intake/convert_test.go (topic)
    └── buildos/
        ├── SECURITY.md
        ├── scripts/check-deny-list.mjs
        └── test/
            ├── helpers.ts (capped assertions)
            ├── {deny-list,skills}.test.ts
            └── {init,init-review,init-review-2,init-review-3,init-review-4,package,bundle,go-tool-cli,system-content,design,intake-core}.test.ts
```

| Item | Result |
| --- | --- |
| Findings | 14 of 14 fixed, each with a test |
| Checks on macOS | See the evidence report check table |
| Open | The real-list deny-list run (the orchestrator); a three-OS CI run; history rewrite and repository visibility before P8 |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | The deny-list guarantees and the skill path rule, and one requirement-history entry. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | CI run 45462792437, the review table, the binaries decision, the log-output audit, the skill path sweep, the guide changes, the owner decision, and P8 open items. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) | The round in the closeout notes. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | Entry-gate item for git history and repository visibility. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The deny-list check stated exactly: matching, the home-folder guard, no silent skips, output, and what it does not cover. |
