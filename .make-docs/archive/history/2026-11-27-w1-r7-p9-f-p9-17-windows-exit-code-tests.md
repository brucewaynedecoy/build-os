---
title: "W1 R7 P9 F-P9-17 Windows Exit Code Tests"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "fix/f-p9-17-windows-wrapper-exit-code"
summary: "Added the F-P9-17 exit-code tests for the project wrappers with the real node, before the fix, so that the Windows CI job shows the defect; and made the rollback smoke test read the guide with LF line ends, which fixes the red Windows unit test on main."
---

# W1 R7 P9 F-P9-17 Windows Exit Code Tests

## Changes

Added `toolkits/buildos/test/wrapper-exit-codes.test.ts`, the tests-first half of the F-P9-17 fix (the owner's go of 2026-11-27, "Go ahead and implement the Windows fix."). The tests use the real `node` (no `node.cmd` stub) and a fake BuildOS program that prints one line to each stream and exits with a given code (0, 1, 2, 7, and 127). They reach it through the local-install route, the global-install route, and the `npx` route (on Windows a copy of npm's own `npx.cmd` whose `npx-cli.js` is the fake), and assert that each project wrapper exits with the program's code. On Windows they start `buildos.cmd` and each legacy `.cmd` wrapper through `cmd.exe /d /s /c` with and without `call`, and from PowerShell with `$LASTEXITCODE` when `pwsh` is on `PATH`; one case runs the helper `pinned-version.cjs --cmd` directly and then the wrapper under one `cmd.exe` and reads `%ERRORLEVEL%` after each; record-only probes show the `cmd.exe` exit-code rule for small batch shapes. On macOS and Linux the `sh` wrappers get the same exit-code cases, directly and through `sh -c`. This commit changes no wrapper, so the Windows job is expected to fail on the forms without `call`. It also fixes the Windows-only failure of `test/rollback-smoke.test.ts` "finds both guide sections" on `main`: git checks out `guide/content/` with CRLF on a Windows runner, and the section finder matched `\n` only, so the test now reads the guide with LF line ends, as the other guide tests do.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#f-p9-17-after-run-3-cause-narrowed).

| Area | Summary |
| --- | --- |
| Tests | `toolkits/buildos/test/wrapper-exit-codes.test.ts` (new); `toolkits/buildos/test/rollback-smoke.test.ts` (the guide read with LF line ends) |

No wrapper, product source, package version, release notes, or ledger changed. Nothing is published.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed.

## Documentation

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/test/wrapper-exit-codes.test.ts](../../../toolkits/buildos/test/wrapper-exit-codes.test.ts) | The F-P9-17 exit-code tests: routes, start forms, the one-`cmd.exe` measurement, and the `cmd.exe` probes. |
