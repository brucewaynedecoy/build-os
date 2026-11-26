---
title: "W1 R7 P6 Command Names, Wrappers, and Initialization"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P6"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Added the legacy command names with their own entry files, the project wrappers, and buildos init with shared-file sections and the optional Make Docs step."
---

# W1 R7 P6 Command Names, Wrappers, and Initialization

## Changes

Adds the three legacy command names (`buildos-intake`, `buildos-discovery`, `buildos-design`) to the package, each with its own entry file that passes its name to the program, so the names also work through the npm shims on Windows; each prints the PE-016 deprecation line and stays until `0.3.0`. Adds the project wrappers under `system/.os/scripts/` for POSIX and Windows, with a pinned version, a Node version message, a PATH search that skips the wrapper itself, and a refusal of an empty or unsafe pin. Adds `buildos init` in `src/core/init/` and `src/cli/commands/init.ts`: it installs the BuildOS system files from the package, adopts a Go-era project by replacing only the four wrappers, and asks one question about Make Docs (with no terminal it stops with exit 10 and gives the agent the question and both commands). By owner decision on 2026-11-24, `init` does not stop on root `AGENTS.md`, `CLAUDE.md`, or `.gitignore`; it adds or refreshes its own marked section and changes no other line. All checks run before the first write, Make Docs runs before BuildOS writes, a later failure restores every byte or lists each path it could not restore, and a rerun changes only a stale section. Review round 1 returned 19 findings (2 blockers); each is fixed with a regression test. Local, on macOS: `npm test` 1,634 tests, 1,624 pass, 0 fail, 10 skipped; installed-package golden compare 166 of 166; pack 110 files. Review round 2 and the three-OS CI run were pending at commit time; the Windows wrapper logic runs for the first time in CI.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P6 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md).

| Area | Summary |
| --- | --- |
| Command names | Four `bin` entries; the program no longer reads its name from the file path. |
| Wrappers | POSIX and `.cmd` wrappers, `pinned-version.cjs`, `node-required.txt`. |
| Init | Plan, apply with an undo journal, shared-file sections, rerun, adoption, Make Docs step, plain messages and `--json`. |
| Make Docs | Pinned contract check for 2.0.9; the messages say truthfully that this version does not set up a folder whose `AGENTS.md` or `CLAUDE.md` holds content it did not write. |
| Exceptions | PE-016 added; PE-001 lists `init`. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Init, shared-file section, rerun, and legacy-name rules with requirement history. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | Make Docs companion question and risk updates. |
| [docs/prd/04-glossary.md](../../../docs/prd/04-glossary.md) | Init order note. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md) | Task status and acceptance criteria. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P6 evidence, owner decisions, and review round 1. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Package contents, entry files, and the rules for changing user files. |

### Maintainer

None this session.

### User

None this session.
