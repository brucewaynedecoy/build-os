---
title: "W1 R7 P7 Final Check Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P7"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 7 findings of the P7 final check (4 blockers, 3 majors), including the Windows deny-list scan that read no package file, and prepared the P7 closeout."
---

# W1 R7 P7 Final Check Fixes

## Changes

The last fix pass of W1 R7 P7, after the final check of `d2e45e6` and the Windows failure of CI run 45483759496. Under the project stop rule there is no further review round; the orchestrator verifies through CI and the evidence report.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P7 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-final-check).

| Area | Summary |
| --- | --- |
| Deny-list package scan (P7-F-01) | Each package file is opened by its own disk path, kept apart from its printed label (`scripts/deny-list-paths.mjs`); the check fails when a listed package file cannot be read or the list is empty; the summary says `N of M package files read` |
| Deny-list encoded names (P7-F-02) | Every text is also checked with character references decoded and percent-decoded; names and printed path parts too |
| Test output (P7-F-03) | 381 assertions on shipped, imported, or guide content swept to none that can print a value; new helpers `assertSame`, `assertDifferent`, `shape`; a meta-test with planted invented values |
| JSONL append (P7-F-04) | A line feed goes before an added row when the index does not end in one; the read-back checks run on the exact bytes; PE-019 part (3) |
| 2.0.9 design form (P7-F-05, P7-F-06) | Every template placeholder checked against its 2.0.9 position and the exact Next Prompt line; the rendered link checked; balanced fenced code in finding text kept byte for byte |
| Tags (P7-F-07) | The link check prints a file tag and line; `scripts/locate-hash.ts` finds path, line, and value tags |
| Checks on macOS | `npm test` 2,252 tests, 2,240 pass, 0 fail, 12 skipped; installed-tarball golden compare 167 of 167; deny-list `173 of 173 package files read` |
| Open | A green three-OS CI run and a real-list deny-list run of this commit; PE-019 part (3) flagged to the owner |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | The JSONL append separator, the deny-list package and decoding coverage, and one requirement-history entry. |
| [docs/prd/11-flow-c-integration.md](../../../docs/prd/11-flow-c-integration.md) | The 2.0.9 placeholder and Next Prompt checks, fenced code in finding text, and one requirement-history entry. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The CI runs, the final check table, Go's append behavior, the assertion sweep, checks, the P7 closeout, and the P7 entry in Phase Reviews. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md) | A56 and A63a results, closeout notes, and the phase status. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The deny-list package files read count and the decoded forms it checks. |
| [toolkits/buildos/test/golden/parity-exceptions.json](../../../toolkits/buildos/test/golden/parity-exceptions.json) | PE-019 part (3) and the PE-020 final-check scope. |

### User

None this session.
