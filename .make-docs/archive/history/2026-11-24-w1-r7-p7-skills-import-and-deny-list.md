---
title: "W1 R7 P7 Skills Import and Deny List"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P7"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Imported the 21 owner-supplied adopter skills into system/.os/skills/ with client content removed, deleted the top-level skills/ folder, added the skills router and the client-name deny-list check in CI, and recorded the owner decisions on PE-017 and the R-009 design write format."
---

# W1 R7 P7 Skills Import and Deny List

## Changes

Builds W1 R7 P7 Stages 1 to 3 (t1 to t11, A54 to A59). The owner supplied the 21 adopter skills in `https://github.com/brucewaynedecoy/build-os-skills` at `ef12985`. They were cleaned outside the repository and then copied into `system/.os/skills/`: client names, a client-like business topic, client-derived identifiers, environment names, and a person's name were replaced with one invented topic, a community library's book-lending system. The three repository skills were already in the adopter set, so the count is 21. The adopter copy of `fit-gap-analysis` and `buildos-export-azure-boards` was kept; the `capability-matrix` copies were identical. `fit-gap-analysis` takes owner names from the project config and owner colors from config, not code. Skills now call the CLI through `.os/scripts/buildos`. The new router `.os/skills/AGENTS.md` lists every skill, says how to install one skill for Claude Code, Codex, or GitHub Copilot, and says what to do at `buildos init` exit `10`. The new `scripts/check-deny-list.mjs` runs in CI on every push, reads the list only from the repository secret `BUILDOS_DENY_LIST`, fails closed without it, and prints paths and lines only. PE-017 moved to the approved exceptions; the R-009 option B decision is recorded as P7 Stage 6.

Framing: [P7 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-stages-1-to-3).

```text
build-os/
├── .github/workflows/buildos-ci.yml (deny-list job; no path filter)
├── {README,AGENTS,USE_CASES,USE_CASES_TESTING}.md
├── skills/ (deleted)
├── docs/
│   ├── assets/user/build-os-getting-started.md
│   ├── prd/{03-open-questions-and-risk-register,06-operating-layer-and-routing,20-buildos-cli-and-distribution}.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/{07-skills-and-validation,evidence}.md
├── guide/ (chapters 14 and 19, BuildOS-Guide.html rebuilt)
├── system/.os/
│   ├── AGENTS.md
│   └── skills/ (new: 21 skills, AGENTS.md, CLAUDE.md)
└── toolkits/buildos/
    ├── SECURITY.md
    ├── scripts/check-deny-list.mjs (new)
    ├── src/adapters/package-content.ts (*.pyo)
    └── test/
        ├── {deny-list,skills}.test.ts (new)
        ├── {init,design}.test.ts
        └── golden/{parity-exceptions,proposed-exceptions}.json, self-test.test.ts (PE-017)
```

| Item | Result |
| --- | --- |
| Skills | 21 folders, 64 files; no listed name, no client-like topic, no clutter |
| Checks on macOS | `npm test` 2,135 tests, 2,123 pass, 0 fail, 12 skipped; installed-tarball golden 167/167; deny-list check with the real list: 0 matches |
| Open | The owner creates the secret `BUILDOS_DENY_LIST` before the next push; a three-OS CI run; R-009 option B build (Stage 6); a command or exception for the `capability-matrix` Python tool; old names in git history |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Packaged Skills (source, init rules, router, Python skills, fit-gap owners), the deny-list check in CI, and one requirement-history entry. |
| [docs/prd/06-operating-layer-and-routing.md](../../../docs/prd/06-operating-layer-and-routing.md) | The Python statement made true for skills, and one requirement-history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-009: PE-017 approved and the option B decision. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Owner decisions, P7 Stages 1 to 3 with the import table, the cleaning method and proof scan, the deny-list design, the router review, and open items. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) | t1 to t11 ticked, the A54 count, and Stage 6 for R-009 option B. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Package counts, the packaged skills and their scripts, and the Client-Name Deny-List Check section. |
