---
title: "W1 R7 P6 Review Round 3 and CI Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P6"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the four Windows failures of CI run 45420565710 and the 17 P6 review round 3 findings: an integrity line proves BuildOS owns a shared-file section, hard links and changes during Make Docs stop init, and the Windows wrapper helper starts the program itself."
---

# W1 R7 P6 Review Round 3 and CI Fixes

## Changes

Fixes the four Windows test failures of CI run 45420565710 on `27e1cfc` and every finding of the third P6 review. Three tests now expect the Windows words "run this in Command Prompt", and the `!` folder test names the wrapper from the project folder. The installed-tarball CI step had a real Windows fault: a glob after `$RUNNER_TEMP` matched nothing in Git Bash; the tarball name now comes from `npm pack --json`, and a failure prints full diagnostics. A team instruction inside marker lines could be deleted when the region scan missed a raw HTML block or comment. Now each BuildOS section carries an integrity line with a SHA-256 of its text, and BuildOS replaces a section only when the hash matches; without it, BuildOS only adds bytes or stops. A property test checks this on 4,000 generated files. `buildos init` also stops on a hard-linked file it would replace and on any path that changed while Make Docs ran, keeps a replaced wrapper's permission bits, reads each router once, reports every rerun file, and tells leftovers from unsure undos. The BuildOS program clears the wrapper loop guard, the wrappers read the pin before `npx`, and on Windows the helper starts the chosen program itself, so no path is read back through a code page. `npm test` passes 1,919 tests with 0 failures on macOS; Windows is not run locally.

Framing: [P6 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p6-review-round-3).

```text
build-os/
├── .gitattributes
├── .github/workflows/buildos-ci.yml
├── docs/
│   ├── prd/{06-operating-layer-and-routing,20-buildos-cli-and-distribution}.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│       ├── 06-command-names-wrappers-and-initialization.md
│       └── evidence.md
├── system/.os/scripts/
│   ├── AGENTS.md
│   ├── buildos, buildos.cmd
│   └── pinned-version.cjs
└── toolkits/buildos/
    ├── .gitattributes
    ├── SECURITY.md
    ├── src/
    │   ├── adapters/node-fs.ts
    │   ├── cli/{main,wrapper-guard}.ts
    │   ├── cli/commands/init.ts
    │   └── core/
    │       ├── init/{apply,init,plan,shared-files}.ts
    │       └── shared/fs-port.ts
    └── test/
        ├── {init,init-review,init-review-2,init-review-3,manifest-contract,package,wrappers}.test.ts
        ├── fixtures/init/go-era-project/workspace/datasets/notes.txt
        ├── golden/harness.ts
        └── helpers.ts
```

| Item | Result |
| --- | --- |
| CI run 45420565710 | 4 Windows test failures fixed (3 expected the POSIX wording, 1 started the wrapper through an expanded `!TEMP!`); the installed-tarball step's Windows glob fault fixed before it ever ran |
| Review round 3 | 17 findings fixed, each with a test that fails without its fix |
| Checks on macOS | `npm test` 1,919 tests, 0 failures, 12 skipped; the same with a space in `TMPDIR`; installed-tarball golden 167/167; real Make Docs 2.0.9 run and rerun with one section per file |
| Open | A green three-OS CI run; follow-ups F-P6-01 (ACLs), F-P6-02 (top placement before front matter), F-P6-03 (Windows behavior not yet run in CI) |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Integrity-line ownership rule, top placement, hard links, adoption modes, the second read after Make Docs, rerun reports, manifest file rules, undo states, and two requirement-history entries. |
| [docs/prd/06-operating-layer-and-routing.md](../../../docs/prd/06-operating-layer-and-routing.md) | The loop guard, the pin before `npx`, the Windows start by Node.js, and one requirement-history entry. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md) | Closeout notes for round 3 and the phase status. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P6 CI Run 45420565710, P6 Review Round 3, open follow-ups, messages, and check results. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Integrity-line rule, hard links, carried expectations, adoption modes, undo states, the Windows wrapper start, the package file list, and fresh pack figures. |

### User

| Path | Description |
| --- | --- |
| [system/.os/scripts/AGENTS.md](../../../system/.os/scripts/AGENTS.md) | Manifest file rules, the `npx` message, the loop guard, and the Windows start by Node.js. |
