# 04 Validation and Review

## Purpose

Define the checks that close the W1 R7 PRD maintenance. The validation worker runs them and fixes small defects.

## Checks

1. Every candidate in [01](./01-prd-authority-maintenance.md) has one decision, and each `create`, `update-existing`, or `link-only` decision is visible in its target file.
2. Current normative requirements are inline in their owning PRDs. No reader needs a history entry, banner, or plan to learn a current requirement.
3. `docs/prd/20-buildos-cli-and-distribution.md` has a product-subject filename and H1, a product kind, no editorial headings, and no document-level `coordinate`.
4. Each requirement-history entry has date, coordinate, affected section, previous contract, replacement contract, rationale, and a resolving source link, and sits after the current sections and before `## Source Anchors`.
5. `make-docs run prd authority validate --target-root .` reports no finding in PRD 20, in the index's new sections, or in any line this maintenance adds. The total stays at or below the 93-finding baseline; any finding left belongs to legacy PRDs 13–19 and is covered by `D-005`.
6. `make-docs project path-hygiene validate` reports zero failing findings.
7. Every relative link in changed files resolves, including the `#current-authority-map` anchor.
8. The register keeps its fixed sections and item numbering; new items have every required field.
9. Every Human Experience promise in the [plan overview](./00-overview.md#human-experience-propagation) appears as a current observable requirement in its owning PRD.
10. No PRD was renumbered. PRDs 14, 18, and 19 changed only by their banner (and index status).
11. The discovery pass record lists each stale-term hit and its decision (updated, historical, or out of scope).
12. The cleanup requirement inventory seed from [05](./05-legacy-prd-cleanup-handoff.md) exists.

## Review

After the checks pass, prepare a short review for the owner: what changed in each PRD, the new register items, the validator before-and-after counts, and anything left open. The owner approves the PRD maintenance before the work backlog is generated. A commit needs a separate owner decision.

## Discovery Pass Record

Recorded by the validation worker on 2026-11-23. Terms searched in every `docs/prd/*.md`: `Go`, `go test`, `go build`, `Homebrew`, `archive`, `validate_config`, `system/docs`, `system/.make-docs`, `buildos-intake`, `buildos-discovery`, `buildos-design`, and `MCP`. Hits are grouped by PRD and section. "Historical" means a requirement-history entry, a dated change note, a rationale, or a legacy change note that a W1 R7 note or the index marks as not current. "Superseded" means a body under the PRD 14, 18, or 19 banner.

| PRD | Hits and location | Decision |
| --- | --- | --- |
| 00 | Document map focus text for PRD 19 | Updated (states superseded and never approved) |
| 01 | `## Current Limitations` body (no Go toolchain, no MCP server) | Updated |
| 01 | PRD 19 change notes in `## Key Capabilities`, `## System Boundaries`, `## Current Limitations`; `## Requirement History` | Historical; each section has a W1 R7 note or new body text |
| 02 | `## Topology` and `## Runtime Boundaries` body (npm, Node, no MCP) | Updated |
| 02 | Code anchors `system/docs/` in `## Topology` and `system/docs/designs/` in `## Data Flow` | Out of scope; checkout evidence that stays until W1 R7 work P7 deletes the folder |
| 02 | PRD 14, 17, and 19 change notes; `## Requirement History` | Historical; W1 R7 notes added |
| 03 | D-002, D-003, D-004 evidence and closed resolutions | Historical |
| 03 | Q-008 recommendation and Q-009 decision named the Go program | Updated (wording made runtime-neutral) |
| 03 | Q-010, Q-011, Q-013, R-003, R-004, R-006, R-011 | Updated by the assembly worker |
| 04 | `Target docs`, `Layered canonicity`, `make-docs boundary`, `Golden output` | Updated |
| 05 | `## Installed Project Paths`, `## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations` body | Updated |
| 05 | Code anchor `system/docs/` in `## Scope`; PRD 19 change notes | Out of scope (checkout evidence); historical |
| 06 | PRD 13, 14, 19 change notes naming `validate_config.py` and `buildos-*` binaries | Historical; W1 R7 note and new body text |
| 07 | `## Component and Capability Map`, `## Contracts and Data`, `## Rebuild Notes` body | Updated |
| 07 | W1 R0 P3 note naming an approved Go package; PRD 14 and 19 notes | Historical; W1 R7 note names them |
| 08 | `## Contracts and Data` layered canonicity (`system/docs/`) | Updated |
| 08 | PRD 19 change notes (MCP) | Historical; PRD 19 carries the superseded banner |
| 09 | PRD 19 change notes (MCP); `archived` lifecycle state | Historical; out of scope (lifecycle term) |
| 10 | `## Integrations` body cites `system/docs/assets/references/harness-capability-matrix.md` | Out of scope for W1 R7 PRD maintenance; tracked in `R-004` (move before W1 R7 work P7) |
| 10 | PRD 19 change notes (MCP) | Historical |
| 11 | `## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, `## Rebuild Notes` body and anchors | Updated |
| 11 | PRD 13, 16, 19 change notes | Historical; W1 R7 notes added |
| 12 | `## Contracts and Data` body (`buildos validate`) | Updated |
| 12 | PRD 13, 16, 19 change notes naming `validate_config.py` and `buildos-config` | Historical; W1 R7 note added |
| 13 | `## Contracts and Data`, `## Integration Impact` body | Updated |
| 13 | `validate_config.py` source anchor; PRD 19 note | Historical |
| 14 | All hits | Superseded |
| 15 | `## Rationale` (`archived` lifecycle state); PRD 19 notes | Out of scope; historical |
| 16 | `## Effective Requirement` ownership table and rules | Updated (legacy names shown beside `buildos <domain>`) |
| 16 | `## Purpose`, `## Rationale`, W1 R0 remediation narrative, `## Required Baseline Annotations`, source anchors | Historical; legacy structure tracked in `D-005` |
| 17 | `### Deterministic toolkit and index` body | Updated |
| 17 | W1 R4 P4 and P5 change notes (Go package, binaries), `## Affected Baseline Docs`, `archived` lifecycle state | Historical; W1 R7 note added; legacy structure tracked in `D-005` |
| 18, 19 | All hits | Superseded |
| 20 | Scope, runtime, legacy names, adoption, compatibility, Human Experience outcomes | Current; each names Go or `buildos-*` only as earlier tools or legacy names |
