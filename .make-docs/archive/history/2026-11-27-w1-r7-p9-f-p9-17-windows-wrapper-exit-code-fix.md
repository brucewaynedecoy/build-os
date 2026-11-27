---
title: "W1 R7 P9 F-P9-17 Windows Wrapper Exit Code Fix"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "fix/f-p9-17-windows-wrapper-exit-code"
summary: "Fixed F-P9-17 in the repository: buildos.cmd now ends with exit /b %ERRORLEVEL% and removes a caller variable named ERRORLEVEL first, so Command Prompt gives the BuildOS exit code to a caller that starts the wrapper without call; the evidence records the mechanism that the red Windows run showed, and the guide names the versions with the defect."
---

# W1 R7 P9 F-P9-17 Windows Wrapper Exit Code Fix

## Changes

Fixed F-P9-17 in the repository (the owner's go of 2026-11-27; the release that carries the fix stays an open owner question). The tests of the first commit failed on Windows in `buildos-ci` run 46066863403: started through `cmd /c` with no `call`, and from PowerShell, `buildos.cmd` exited `0` on the local-install, global-install, and `npx` routes, and the three legacy `.cmd` scripts exited `0` on the local-install route (with one more legacy case only: `cmd /c` on the `npx` route with code `2`), while `call`, and the helper started directly, kept the code; probe batch files showed the rule that a `.cmd` file run by `cmd /c` with no `call` gives the code of its last command, and a bare `exit /b` is that command, with code `0`. So `system/.os/scripts/buildos.cmd` now ends its normal path with `exit /b %ERRORLEVEL%`, and removes a variable named `ERRORLEVEL` from its own environment after `setlocal`, because a caller's variable of that name hides the real code. Every other line and safety property of the wrapper is the same; the legacy `.cmd` scripts and `pinned-version.cjs` do not change. The probe test now asserts the measured codes, `test/rollback-smoke.test.ts` checks the new last line and the new guide sentences, `system/.os/scripts/AGENTS.md` states the exit-code rule, chapter 4 of the guide names `0.1.0` and `0.2.0` as the versions with the defect and says the fix waits for a release, the evidence report records the mechanism, the fix, what stays unproven, and the missing review round 3 record of pull request 15, and `R-003` records the fix.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#f-p9-17-mechanism-and-fix-pull-request-16-2026-11-27).

| Area | Summary |
| --- | --- |
| Wrapper | `system/.os/scripts/buildos.cmd`: `set "ERRORLEVEL="` after `setlocal`, and `exit /b %ERRORLEVEL%` after `node` |
| Shipped instructions | `system/.os/scripts/AGENTS.md`: the exit-code rule of `buildos.cmd` |
| Tests | `toolkits/buildos/test/wrapper-exit-codes.test.ts` (the probes assert); `toolkits/buildos/test/rollback-smoke.test.ts` (the last line, the guide sentences) |
| Guide | `guide/content/04-install-and-configure-your-instance.md` and the rebuilt `guide/BuildOS-Guide.html` |
| Records | The evidence report (Review Round 3 (Pull Request 15), F-P9-17 Mechanism and Fix (Pull Request 16)); `docs/prd/03-open-questions-and-risk-register.md` (`R-003`) |

No package version, release notes of a published version, ledger, golden, or smoke script changed. No golden capture ran. An existing project gets the fixed wrapper only by a copy of `.os/scripts/buildos.cmd` from the release that has it. Nothing is published.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; chapter 4 names the versions with the Windows exit-code defect.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Review Round 3 (Pull Request 15); F-P9-17 Mechanism and Fix (Pull Request 16). |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `R-003`: the F-P9-17 mechanism and the fix in the repository. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | The Windows exit-code exception names `0.1.0` and `0.2.0` and says the fix waits for a release. |
