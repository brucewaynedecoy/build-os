---
title: "W1 R7 P9 Intake JSON Final Check Fixes"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9-owner4"
summary: "Fixed the seven findings of intake JSON review round 3, the last round: no overwrite without --force (also in a race), the writer factory refusal, a removed index link, recovery text that names what the run did then, one entry per file on a case-insensitive volume, close-fault coverage, and the exit codes of the two forms."
---

# W1 R7 P9 Intake JSON Final Check Fixes

## Changes

Final fix pass for the intake `--json` envelope (parity exception PE-022) after review round 3 of `4f4fb08`, on the branch `rewrite/ts-cli-p9-owner4`. The three-round review limit is reached, and this pass closes the review. Without `--force`, the in-place writer never opens an entry at the name of a twin or side artifact, so a file that another program makes after the existence check keeps its bytes and the command gives Go's `use --force` error (Go had this race; PE-010 states the racing case). The writer factory is opened before the effect record, a removed index link is named as a link, each `left_in_place` diagnostic says what the run did at that time and asks the operator to look before a removal, and two spellings of one file are one entry by the identity the writer's own `fstat` gives. A test hook makes a close fail after a complete write. PRD 20 and PE-022 state the exit codes of the two forms. Each code fix has a test that fails without it. Nothing was pushed, merged, published, staged, tagged, or released.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-final-check).

| Area | Summary |
| --- | --- |
| Writer port (findings 1, 3, 5, 6) | `InPlaceWriteOptions` (`overwrite`, `opened`) and `inPlaceLinkRemovedOf` in `src/core/shared/fs-port.ts`; `writeFileInPlace` and the test hook `writeRaceHooks.afterStep` in `src/adapters/node-fs.ts` |
| Intake core (findings 1, 2, 5) | `IntakeFs.writeFileWithParents` and `WriteRecord` in `src/core/intake/io.ts`; `writeConvertedOutput` and `writeSideArtifact` in `src/core/intake/convert/convert.ts` |
| Envelope (findings 3, 4) | The `left_in_place` text in `src/cli/commands/intake.ts` and its correction in `src/cli/commands/go-tool.ts` |
| Documentation (findings 1, 4, 7) | PRD 20 Output and Exit Contract with a requirement history entry; PE-010 and PE-022; `SECURITY.md` |
| Tests | `test/intake-json.test.ts`: 6 new tests, 2 extended; `test/fs-port.test.ts`: 3 new tests |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | The exit codes of the two forms, what an entry says, and no overwrite without `--force`; requirement history entry. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-final-check) | The final check: findings, tests, checks, and follow-ups. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The overwrite policy, the qualified ownership statement, the link entry, and the identity rule. |
| [toolkits/buildos/test/golden/parity-exceptions.json](../../../toolkits/buildos/test/golden/parity-exceptions.json) | PE-010: the racing case without `--force`. PE-022: findings 2 to 5 and 7. |
