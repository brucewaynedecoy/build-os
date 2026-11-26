---
title: "W1 R7 P4 Intake Port"
kind: "history"
status: "completed"
date: "2026-11-23"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P4"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Ported buildos-intake to buildos intake with evidence-chosen converters, a reviewed conversion eval gate, and the intake golden domain enforced."
---

# W1 R7 P4 Intake Port

## Changes

Ports `buildos-intake` (`convert`, `index references`, `index playbooks`) to `src/core/intake/` and `src/cli/commands/intake.ts`, with the same arguments, output, and Go error text. Converters were chosen by a two-candidate comparison on a 12-file conversion eval set whose reference text the owner reviewed and approved: `fflate` (ZIP), `parse5` (HTML), and `unpdf` (PDF text), plus a port of Go's `encoding/xml` reader in place of `@xmldom/xmldom`. Each is pinned, listed in `SECURITY.md`, and covered in `THIRD_PARTY_NOTICES.md`; `package.json` still has no `dependencies`. Untrusted input is bounded before it is read: ZIP entries, XML depth and attributes, HTML nesting, XLSX cells and shared strings, PDF pages, cross-reference sections, and extracted text. Every write is checked in Go's order before the first one, so a failed convert leaves no files behind, and intake writes outside the repository root need the new `--allow-outside-root` flag. The golden harness enforces `intake` (55/55), checks every PDF twin under the PE-009 class rule in both directions, and the eval gate passes 12/12. Three review rounds returned CHANGES, and each fix has regression tests; the owner approved PE-008, PE-009, PE-010 with `--allow-outside-root`, PE-013, and PE-015 on 2026-11-23. Local, on macOS: `npm test` 1,343 tests, 1,339 pass, 0 fail, 4 skipped (Windows-only); `capture.mjs --check` 158 cases; `--verify-artifact` passes for three sets. The three-OS CI run was pending at commit time, and the Go intake tool is unchanged until P8.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P4 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/04-intake-port.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p4-intake-port).

```text
build-os/
├── docs/
│   ├── prd/20-buildos-cli-and-distribution.md
│   └── work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/
│       ├── 00-index.md, 04-intake-port.md, 06-command-names-wrappers-and-initialization.md
│       └── evidence.md
└── toolkits/buildos/
    ├── .gitattributes, package.json, package-lock.json, SECURITY.md, THIRD_PARTY_NOTICES.md
    ├── scripts/ (capture-intake-edge-goldens.ts, capture-intake-eval-goldens.ts)
    ├── src/
    │   ├── adapters/ (intake-parsers.ts, node-fs.ts)
    │   ├── cli/ (commands/intake.ts, invocation.ts, main.ts, run.ts)
    │   └── core/
    │       ├── intake/ (convert/, index/, go-text.ts, io.ts, limits.ts)
    │       ├── entities/io.ts
    │       └── shared/ (errors, fs-port, go-fs, go-json)
    └── test/
        ├── conversion-eval/ (inputs, references, REVIEW.md, review.html, eval runner)
        ├── fixtures/go-seed/ (intake-edge-goldens.json, intake-eval-goldens.json)
        ├── golden/ (cases.json, harness.ts, parity-exceptions.json, proposed-exceptions.json, CAPTURE.md, tests)
        └── fs-port, intake-core, intake-edge, intake-eval-parity, intake-hostile, notices tests
```

| Area | Summary |
| --- | --- |
| Converters | CSV, DOCX, multi-sheet XLSX, HTML, the HTML-directory mirror, and PDF text, each mapped to its Go source; scanned-page PDFs behave as the golden shows, with no OCR code. |
| Indexes | `index references` and `index playbooks` rebuilt as Go does, including exact 64-bit `next_id`. |
| Input limits | Every limit failure exits 1 with one `<format>: <what> exceeds the BuildOS input limit (<limit>)` line; the hostile tests run the real CLI under a 256 MiB heap. |
| Writes | A narrow in-place writer only intake gets; a preflight checks folder creation, existence against `--force`, entry type, an open probe, link count, and containment for every twin and side artifact before the first write. |
| Exceptions | PE-008 (callout text kept), PE-009 (PDF word gaps, a class), PE-010 (outside-root refusal and `--allow-outside-root`), PE-013 (no files after a failed convert, with four preflight cases), PE-015 (clean exit 1 where Go crashes or hangs on a malformed PDF). No exception is pending. |
| Notices | Licenses for the bundled packages and the components inlined in pdf.js, checked by `test/notices.test.ts`. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. `PERF-001` is flagged for the P8 recheck on the 3,028,756-byte bundle.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Outside-root write rule with `--allow-outside-root` (PE-010) and its requirement history row. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md) | Change History entry for the P6 t29 follow-up. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/04-intake-port.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/04-intake-port.md) | Tasks ticked; t12 open for three-OS CI with a status line; closeout status Done pending three-OS CI. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md) | New task t29 for the BOM handling found in P3 code. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P4 Intake Port evidence, owner decisions, three review rounds, open items, and the P4 Review entry. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Bundled npm packages, components inside pdf.js, intake input limits, and write safety. |
| [toolkits/buildos/THIRD_PARTY_NOTICES.md](../../../toolkits/buildos/THIRD_PARTY_NOTICES.md) | License texts for the bundled packages and inlined pdf.js components. |
| [toolkits/buildos/test/conversion-eval/REVIEW.md](../../../toolkits/buildos/test/conversion-eval/REVIEW.md) | Owner review of the 12 eval reference texts. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Capture record for the enforced intake domain. |

### Maintainer

None this session.

### User

None this session.
