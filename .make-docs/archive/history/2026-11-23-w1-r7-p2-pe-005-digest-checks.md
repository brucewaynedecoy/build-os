---
title: "W1 R7 P2 PE-005 Digest Checks"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P2"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed two review findings on bd67f5e: PE-005 skips now need an exact Go observation digest, and --verify-artifact strictly checks derived goldens and PE-005 skips."
---

# W1 R7 P2 PE-005 Digest Checks

## Changes

Fixes two review findings on commit `bd67f5e`; each was reproduced first against the committed harness. Finding 1: the PE-005 capture skip checked only the exit code and a substring of one stream, so a defect with a second, different error still skipped. Each PE-005 case in `parity-exceptions.json` now records `go_observation_sha256`, the `observationDigest` (in `harness.ts`) of the complete normalized Go defect observation (exit code, full stdout and stderr SHA-256, and the filesystem changes with file SHA-256 values, links, and modes), and `go_observation_evidence`; a case is skipped only on an exact digest match, and any other Go output is listed in the new `parity_exception_mismatches`, which the capture workflow fails on. The six digests come from the real win32 observations of capture run 45293367433, copied unchanged to `test/golden/evidence/pe-005-win32/`, and `pe-005.test.ts` recomputes them. Finding 2: `--verify-artifact` accepted an all-zero derived `source_sha256` and a failing Windows design output marked as derived. It now requires exactly the three PE-005 derived goldens with recomputed folder and source SHA-256 values and a match to a fresh derivation, no folder for the three shared design cases, and exactly the six PE-005 skips, each with the recorded `observation_sha256`. The win32 artifact of run 45296349916 fails only that last rule (it came before the digest), so it was not imported and a fresh capture is needed. Regression tests in `pe-005.test.ts` cover both fixes on the real evidence. Local: `npm test` 947 pass, 0 fail, 14 skipped; darwin `--check` passes; darwin and linux `--verify-artifact` match 265 files; path hygiene passes.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P2 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/02-golden-capture.md), the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) (PE-005 Review Fix Round), and the prior record [W1 R7 P2 Linux Goldens and PE-005](./2026-11-23-w1-r7-p2-linux-goldens-and-pe-005.md).

```text
build-os/
├── .github/workflows/buildos-golden-capture.yml
├── docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│   └── evidence.md
└── toolkits/buildos/test/golden/
    ├── CAPTURE.md, parity-exceptions.json
    ├── capture.mjs, harness.ts, pe-005.test.ts
    └── evidence/pe-005-win32/
```

| Area | Summary |
| --- | --- |
| Capture skip | Exact `go_observation_sha256` match; other Go output goes to `parity_exception_mismatches`. |
| Evidence | Six real win32 Go observations from run 45293367433 in `evidence/pe-005-win32/`. |
| `--verify-artifact` | Strict rules for the derived goldens, the shared design cases, and the PE-005 skips. |
| Workflow | The last capture step also fails on `parity_exception_mismatches`. |
| Win32 import | Run 45296349916 not imported; a fresh capture is needed. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section PE-005 Review Fix Round: findings, digest source, win32 import result, regression tests, and checks. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Exact-digest skip rule, digest definition, evidence folder, and `--verify-artifact` PE-005 rules. |

### Maintainer

None this session.

### User

None this session.
