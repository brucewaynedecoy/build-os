# Phase Detail - Intake / Conversion

## Objective

Implement W1 R0 P3 as a dependency-minimal, local-only `buildos-intake` Go CLI plus thin operating wrappers and durable intake guidance. P3 converts supported sources into clean text, Markdown, or CSV twins; it does not perform extraction, classification, requirement loading, finding creation, or rich PDF interpretation.

## Locked Decisions

| Area | Decision |
| --- | --- |
| Binary | `buildos-intake` |
| Source home | `toolkits/buildos-intake/` |
| Wrapper surface | `system/.os/scripts/buildos-intake` |
| Runtime posture | Entirely local; no service calls and no network processing |
| Dependency posture | Standard library first |
| Approved dependencies | `golang.org/x/net/html` and `github.com/ledongthuc/pdf` |
| Rejected dependency path | No Poppler bundle, no `pdftotext` requirement, no `--pdf-engine pdftotext` |
| PDF scope | Minimal built-in text extraction only; no OCR, layout fidelity, table reconstruction, or embedded-image extraction promise |
| Manual fallback | Intentional path through an administrative playbook and intake translation contract |

## Command Surface

```sh
buildos-intake convert --source <path> [--repo-root .] [--assets-root system/assets] [--type auto|csv|docx|xlsx|pdf|html|html-dir] [--force] [--dry-run]
buildos-intake index references [--repo-root .] [--assets-root system/assets] [--output system/.os/indexes/references.json]
```

The `.os/scripts` wrapper may locate and execute the binary, but it must not parse source files, convert content, rebuild indexes, or duplicate toolkit behavior.

## Implementation Workstreams

| Workstream | Output | Notes |
| --- | --- | --- |
| CLI core | Go module, command parser, flags, stdout/stderr behavior | Keep command parsing explicit and predictable. |
| Conversion | CSV, DOCX, XLSX, HTML, HTML-dir, minimal PDF converters | Use ZIP/XML and CSV standard-library support where practical. |
| Provenance | Converted-source frontmatter and deterministic path derivation | Follow `converted-source-contract.md`. |
| Translation rules | Intake translation contract and manual conversion playbook | Keep manual and automated output compatible. |
| Indexing | `buildos-intake index references` | Rebuild from converted twin frontmatter only. |
| Wrappers | `system/.os/scripts/buildos-intake` | Call-through only. |
| Docs | Toolkit README, routers, PRD notes, backlog closeout, history | Record the no-`pdftotext` and no-rich-PDF stance durably. |
| Tests | Go unit tests and small local fixtures | Include PDF failure behavior and representative supported source conversion. |

## Agent Orchestration

Use a coordinator plus focused worker lanes:

- Coordinator: owns command contract, PRD/design reconciliation, final integration, validation, and boundary review.
- Worker A: implements CLI core, shared path/hash/frontmatter utilities, and command tests.
- Worker B: implements CSV, DOCX, XLSX, HTML, and HTML-dir conversion with fixture tests.
- Worker C: implements minimal `github.com/ledongthuc/pdf` support and PDF failure tests.
- Worker D: implements references-index rebuild and wrapper routing.
- Worker E: writes the intake translation contract, manual intake playbook, toolkit README updates, and W1 R0 P3 plan/backlog refresh.
- Worker F: performs final review for make-docs boundary violations, dependency drift, and validation gaps.

Concurrency rules:

- Workers A, E, and dependency review can start immediately.
- Workers B, C, and D wait for Worker A to settle shared path, status, and frontmatter utilities.
- Wrapper work waits for the command surface to stabilize.
- Final PRD/history closeout waits for tests and validation.

Blockers:

- If `github.com/ledongthuc/pdf` cannot produce usable plain text for minimal PDF fixtures, P3 should fail PDF conversion clearly and document the gap. Do not switch to `pdftotext` without a new decision.
- If automated conversion quality is inadequate, use the manual intake playbook rather than adding broader dependencies.

## Acceptance Criteria

- `go test ./...` and `go build ./...` pass in `toolkits/buildos-intake/`.
- The CLI writes converted twins only under `system/assets/` and rebuilds `system/.os/indexes/references.json` as a derived catalog.
- Converted twins satisfy the converted-source and intake-translation contracts.
- PDF behavior is clearly documented as minimal local text extraction, with no Poppler, `pdftotext`, OCR, or rich extraction promise.
- Manual fallback guidance exists outside `system/docs/guides/user/`.
- Thin wrappers remain call-through only.
- Validation passes: config validator, make-docs path hygiene, touched-doc link check, and `git diff --check`.
