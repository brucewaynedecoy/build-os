---
title: "W1 R7 P6 Closing Check Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P6"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 10 findings of the P6 closing check (round 4): a current section is never written again, a commented example no longer stops init, the rerun summary names files it could not check, a bare CR is text, and the init core hashes through a port. The P6 review loop is closed."
---

# W1 R7 P6 Closing Check Fixes

## Changes

Fixes every finding of the P6 closing check (review round 4) on `22d5970`, and records CI run 45429667932, which passed on Linux and Windows (the Windows installed-tarball golden step 167/167) and so closes F-P6-03. A section whose text is already current is no longer written again when the file mixes CRLF and LF, so it keeps every byte and a hard link on it no longer stops `init`. A marker pair that starts inside an HTML comment is one example through its end line, so a commented example with a stale hash is kept and setup goes on. A rerun says "up to date" only for sections it checked and names each file it could not read, with why. A bare CR is now ordinary text, never a line break or marker padding; a file whose buildos lines appear only through bare CRs stops before any write. The init core hashes through a new port, and `crypto` left the core allowlist. Smaller fixes: a folder removed during Make Docs is reported as removed, a hard-linked wrapper link stops an adoption, inode 0 never matches in the adapter's and the helper's identity checks, the helper reports a program ended by a signal, and the fixture scan finds more absolute paths. The P6 review loop is closed under the project stop rule. `npm test` passes 1,941 tests with 0 failures on macOS; Linux and Windows wait for CI.

Framing: [P6 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p6-review-round-4-closing-check).

```text
build-os/
├── .make-docs/archive/history/2026-11-24-w1-r7-p6-closing-check-fixes.md
├── docs/
│   ├── prd/20-buildos-cli-and-distribution.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│       ├── 06-command-names-wrappers-and-initialization.md
│       └── evidence.md
├── system/.os/scripts/pinned-version.cjs
└── toolkits/buildos/
    ├── SECURITY.md
    ├── src/
    │   ├── adapters/{node-fs,node-hash}.ts
    │   ├── cli/commands/init.ts
    │   └── core/
    │       ├── init/{apply,init,plan,shared-files}.ts
    │       └── shared/{fs-port,hash-port}.ts
    └── test/
        ├── {boundary,init-review,init-review-4,manifest-contract,package}.test.ts
        └── boundary-rules.ts
```

| Item | Result |
| --- | --- |
| CI run 45429667932 | Linux and Windows passed; Windows installed-tarball golden 167/167; F-P6-03 closed |
| Closing check | 3 majors and 7 minors fixed, each with a test that fails without its fix |
| Checks on macOS | `npm test` 1,941 tests, 0 failures, 12 skipped; installed-tarball golden 167/167; pack 110 files |
| Open | A green three-OS CI run of this change; follow-ups F-P6-01 (ACLs), F-P6-02 (top placement before front matter), F-P6-04 (two older core files still load `crypto`) |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Line-break rule and the CR-only stop, the unchanged rule for a current section, examples inside comments, the hard-linked wrapper link, the rerun summary rule, and one requirement-history entry. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md) | Closeout notes for the closing check and the phase status. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P6 CI Run 45429667932, P6 Review Round 4 (closing check), follow-ups, loop status, messages, and check results. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The bare-CR rule, the unchanged rule, the hash port, the hard-linked link, inode 0 in the lower-level checks, and fresh pack figures. |
