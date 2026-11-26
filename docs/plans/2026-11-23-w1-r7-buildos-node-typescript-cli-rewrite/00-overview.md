---
title: "BuildOS Node and TypeScript CLI Rewrite PRD Authority Maintenance Plan"
kind: "plan"
status: "draft"
coordinate: "W1 R7"
follow_on:
  route: "prd-generation"
  next_prompt: "make-docs://system/prompt/plan-to-prd-change.prompt.md"
  why: "The active PRD set must state the Node and TypeScript CLI, its distribution, project initialization, skills, and supply-chain contract before the W1 R7 work backlog is generated."
  coordinate_handoff: "Carry W1 R7 into the downstream PRD requirement-history entries and the W1 R7 work backlog."
source:
  type: "design"
  path: "docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md"
---

# BuildOS Node and TypeScript CLI Rewrite PRD Authority Maintenance Plan

**Date:** 2026-11-23

**Repository:** Build OS repository root

**Purpose:** Plan the PRD authority maintenance that makes the [BuildOS Node and TypeScript CLI Rewrite design](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md) the current product authority, and set the shape of the W1 R7 work backlog that implements it.

## Objective

The active PRD set must describe BuildOS as one Node.js and TypeScript CLI, shipped as the npm package `@brucewaynedecoy/buildos`, with project initialization and adoption, optional Make Docs companion setup, packaged skills, no Python for users, and an explicit supply-chain and release contract. Every PRD that now states a Go-specific, Homebrew, Python-validator, or shipped-Make-Docs-content requirement must state the current requirement instead, with the prior contract kept only in `## Requirement History`.

The outputs serve three readers: maintainers and agents who build W1 R7, adopters and their agents who rely on the documented commands, and enterprise reviewers who check the supply-chain contract.

The plan is complete when:

- every candidate in [01 PRD Authority Maintenance](./01-prd-authority-maintenance.md) has one decision and its PRD edits are made;
- the new product PRD `docs/prd/20-buildos-cli-and-distribution.md` exists and owns the CLI and distribution subject;
- PRDs 14, 18, and 19 say plainly, at the top, that PRD 20 is their current authority;
- the risk register, index, and W1 R5 and W1 R6 lineage records are updated as in [02 Risk Register, Index, and Lineage](./02-risk-register-index-and-lineage.md);
- the legacy-PRD cleanup handoff in [05 Legacy PRD Cleanup Handoff](./05-legacy-prd-cleanup-handoff.md) is recorded in the register and index, with its requirement inventory seeded;
- the validation in [04 Validation and Review](./04-validation-and-review.md) passes.

This plan authorizes documentation maintenance only. It does not authorize code, toolkit changes, Go removal, publication, or a commit. The W1 R7 work backlog is generated after the PRD maintenance, from the updated PRDs and [03 Work Backlog Shape](./03-work-backlog-shape.md).

## Governing Invariant

> `docs/prd/` describes the current authoritative shape of the product. It must never describe the editorial operation used to change that authority.

Implementation sequencing, migration actions, and supersession language stay in this plan, the work backlog, and history records. The new PRD is named for its product subject, not for the rewrite.

## Coordinate Decision

- Coordinate: `W1 R7`
- Classification: `revision-wave`
- Evidence: Explicit owner guidance during the design interview selected W1 R7. The change reverses the architecture choice (Go runtime and one Go module) of the lineage, so the plan must be rewritten rather than extended, which passes the revision Wave test. The lineage is the W1 unified-distribution line: [W1 R5](../2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md) (unexecuted, superseded for execution by W1 R6) and [W1 R6](../2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation/00-overview.md) (an unexecuted, blocked candidate for a Go core, CLI, and MCP program). The owner chose that W1 R7 supersedes W1 R6 completely, that the MCP adapter is deferred to a later revision, and that W1 R5 and W1 R6 stay in place as historical evidence marked "superseded, do not execute."

W1 R7 needs a new work backlog because it is a revision Wave.

## Maintenance Inputs

| Input | Format | Location | Confidence |
| --- | --- | --- | --- |
| Rewrite decisions | Design, draft, owner-confirmed through interview | [2026-11-23 BuildOS Node and TypeScript CLI Rewrite](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md) | High |
| Unified command contract, aliases, parity | Design and PRD | [Unified CLI design](../../designs/2026-07-21-unified-buildos-cli-and-distribution.md), [PRD 18](../../../.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md) | High for retained parts |
| Product boundary and core/adapter model | Design and draft PRD | [Product boundary design](../../designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md), draft [PRD 19](../../../.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md) | High for boundary rules; PRD 19 was never approved |
| Runtime evidence | Design | [Runtime-selection proof](../../designs/2026-08-14-build-os-runtime-selection-proof.md) | High as measurement; its decision is superseded |
| Current Go behavior | Source | `toolkits/buildos/`, `toolkits/buildos-intake/`, `toolkits/buildos-discovery/`, `toolkits/buildos-design/` | High |
| Make Docs 2.0.9 setup, resource, release, and validator behavior | CLI help and Make Docs repository | `make-docs setup --help`, Make Docs `README.md`, `RELEASING.md`, and PRDs | High for 2.0.9; no published companion contract |
| Adopter skills inventory | Adopter repository, read-only report | 21 skills in an adopter project's `.agents/skills/` | Medium; content must be reviewed and cleaned when imported |
| PRD authority validator baseline | Tool output | `make-docs run prd authority validate --target-root .` failed with 93 findings on 2026-11-23, all from legacy editorial PRDs 13–19 | High |

Open ambiguities are promoted into the register during execution, as listed in [02](./02-risk-register-index-and-lineage.md).

## Human Experience Propagation

Source intent: the `## Human Experience Intent` section of the [source design](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md). Impact is `direct`. Authority for the standard is `make-docs://system/contract/human-experience-contract.md`.

| Promise | Existing or planned owning PRD | Human-facing surface or indirect effect | Work phase | Evidence source or selected testing type | Accepted obligation, if any |
| --- | --- | --- | --- | --- | --- |
| One agent-run `buildos init` sets up a new project with Node 24 and no other install | PRD 20 (project initialization); PRD 05 (shipping model) | `buildos init` output and resulting project tree | P6 | Functional tests on macOS, Linux, and Windows through `npx`; inspection of real output | None |
| Missing or old Node gives one plain install message | PRD 20 (runtime prerequisite); PRD 06 (wrappers) | Wrapper script output | P6 | Wrapper tests with Node absent and Node 22; inspection of real output | None |
| The user decides Make Docs setup; with no TTY, `init` stops and gives the agent both choices in plain words | PRD 20 (Make Docs companion setup); PRD 05 (integrations) | `init` prompt, no-TTY human and JSON output | P6 | Functional tests for Yes, No, flags, and no-TTY; Human Experience Review of the no-TTY message | None |
| Make Docs failure does not fail BuildOS setup, and the retry command is shown | PRD 20 | `init` partial-success output | P6 | Functional test with a failing Make Docs stub; output inspection | None |
| Adoption of a Go-era project changes no user data | PRD 20 (adoption); PRD 05 | Adopted project tree | P6 | Byte comparison of every pre-existing file before and after adoption on a copied project | None |
| Commands, files, output, and exit codes match the Go tools; PDF matches after whitespace normalization | PRD 20 (compatibility); PRD 07 (conversion); PRD 17 (entities) | All ported command output | P2–P5 | Golden parity suite | None |
| Legacy names work for one minor release and name the new command | PRD 20 (legacy names) | Legacy command stderr | P6 | Alias parity tests | None |
| An enterprise reviewer finds every outside package, version, license, reason, and check in one document, plus SBOM and provenance | PRD 20 (supply chain and release) | Security document, SBOM, npm provenance | P1, P8 | Review of the document against bundle contents, SBOM, and scan output | None |
| Converted documents keep every section and stay highly accurate | PRD 07 (conversion quality) | Converted twins | P4 | Conversion eval set: section coverage and 98% text-similarity gate | None |

## Performance Evidence Plan

Governing contract: `make-docs://system/contract/performance-evidence-governance.md`. No candidate creates a product target.

| Candidate | Base maintenance action | Performance applicability | Target class | Canonical `PERF-###` or next record | Finite budget and stop reference | Lifecycle point |
| --- | --- | --- | --- | --- | --- | --- |
| CLI startup and per-command latency under Node 24, against the Go baseline in the runtime proof | `create` | `characterize-now` | `characterization-baseline` | `PERF-001`, created and owned by W1 R7 work P1 | Two characterization passes, one correction attempt, one review cycle, one working day, no external spend; stop at budget or when a pass does not change the decision | P1 baseline; P8 recheck before `0.1.0` |
| First-run `npx` fetch time for the published package | `create` | `characterize-now` | `characterization-baseline` | `PERF-002`, created and owned by W1 R7 work P8 | Two passes on a staged package, one review cycle, half a working day, no external spend | P8, before `0.1.0` |
| Conversion time for large eval files | `none` | `not-needed` | none | None; accuracy is the gate | Not applicable | None |

## Active Authority Baseline

- Active `docs/prd/` status: active set `00`–`19`; `19` is `draft` and was never approved.
- Current index: `docs/prd/00-index.md`
- Discovery pass required: yes
- Discovery scope if required: every numbered PRD, for normative text that names Go, `go test`, `go build`, Go modules, Homebrew, signed archives, `validate_config.py`, shipped `system/docs/` or `system/.make-docs/`, or the separate `buildos-*` binaries as current behavior. A 2026-11-23 scan found such terms in PRDs 01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 12, 13, 14, 15, 16, 17, 18, and 19.
- Known noncompliance or legacy editorial PRDs: PRDs 13–19 use editorial filenames, titles, kinds, or headings and fail `make-docs run prd authority validate`. This plan does not rename them. It records the drift, keeps them truthful, and hands the cleanup forward as described in [05](./05-legacy-prd-cleanup-handoff.md).

## Phase Map

| File | Purpose |
| --- | --- |
| [01-prd-authority-maintenance.md](./01-prd-authority-maintenance.md) | Candidate decision matrix, existing PRDs to update, the new PRD 20, and requirement-history entries |
| [02-risk-register-index-and-lineage.md](./02-risk-register-index-and-lineage.md) | Register items, index changes, superseded banners, and W1 R5 and W1 R6 lineage records |
| [03-work-backlog-shape.md](./03-work-backlog-shape.md) | Phases, gates, and PRD citations for the W1 R7 work backlog |
| [04-validation-and-review.md](./04-validation-and-review.md) | Checks that close the PRD maintenance and the plan |
| [05-legacy-prd-cleanup-handoff.md](./05-legacy-prd-cleanup-handoff.md) | The through-line from this maintenance to the full legacy-PRD cleanup |

## Output Contract

- Plan directory: `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/`
- Existing authoritative PRDs to update: `01`, `02`, `04`, `05`, `06`, `07`, `11`, `13`, `16`, `17`, and any of `08`, `10`, `12`, `15` where the discovery pass finds current normative stale text
- Genuinely new authoritative PRDs: `docs/prd/20-buildos-cli-and-distribution.md`
- Requirement-history entries: as listed in [01](./01-prd-authority-maintenance.md)
- Shared PRD surfaces: `docs/prd/00-index.md`, `docs/prd/03-open-questions-and-risk-register.md`, status banners on `14`, `18`, and `19`
- Lineage records: `## Change History` entries in the W1 R5 and W1 R6 plan overviews and work indexes, plus execution-status lines
- Work backlog (new, revision Wave): `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/`, generated after the PRD maintenance

## Dependencies

- The source design is accepted by the owner (done through the interview; the design file is still `draft` and uncommitted).
- Make Docs 2.0.9 or newer is available for `make-docs run prd authority validate` and `make-docs project path-hygiene validate`.
- No code dependency. Go code stays in place until W1 R7 work P8.

## Worker Ownership

Delegation is the default. The coordinator writes nothing.

| Worker | Scope | Write Scope | Dependencies | Deliverables |
| --- | --- | --- | --- | --- |
| New-authority worker | Draft PRD 20 from the design, PRD 18's retained command contract, and PRD 19's retained boundary rules | `docs/prd/20-buildos-cli-and-distribution.md` | None | PRD 20 |
| Owner-update worker A | Core and boundary owners | `docs/prd/01-*.md`, `02-*.md`, `04-*.md`, `05-*.md`, `06-*.md` | PRD 20 headings fixed | Inline updates and requirement history |
| Owner-update worker B | Domain owners and discovery pass | `docs/prd/07-*.md`, `08-*.md`, `10-*.md`, `11-*.md`, `12-*.md`, `13-*.md`, `15-*.md`, `16-*.md`, `17-*.md` | PRD 20 headings fixed | Inline updates and requirement history |
| Assembly worker | Shared surfaces and lineage | `docs/prd/00-index.md`, `docs/prd/03-*.md`, banners in `14`, `18`, `19`, W1 R5 and W1 R6 plan overviews and work indexes | All PRD workers | Register, index, authority map, banners, lineage entries, cleanup inventory seed |
| Validation worker | Checks in [04](./04-validation-and-review.md) and small fixes | Any file above, fixes only | Assembly worker | Validation record |

## MCP Strategy

- Preferred servers available: `make-docs` MCP (`prd_validate`, `paths_validate`) and the `make-docs` CLI; `jdocmunch` for section lookup.
- Fallback plan if unavailable: run the same checks through the `make-docs` CLI; use direct reads and `grep` for the discovery pass.

## Validation

See [04 Validation and Review](./04-validation-and-review.md). In short: every candidate has a decision; current requirements are inline in their owners; PRD 20 is product-named; the PRD authority validator reports no finding in any file this plan creates or newly edits beyond the 93-finding legacy baseline; path hygiene passes; links resolve; and each Human Experience promise above reaches an owning PRD and a work phase.

## Intended Follow-On

This handoff is advisory-default-but-overridable: it is authoritative unless the user explicitly overrides it, and it is not a gate or precondition.

- Route: `prd-generation`
- Next step: Update the active PRD set from this plan with `make-docs://system/prompt/plan-to-prd-change.prompt.md`, then generate the W1 R7 work backlog from the updated PRDs and [03](./03-work-backlog-shape.md).
- Why: The PRD must state the Node CLI, distribution, initialization, skills, and supply-chain contract before work is planned against it.
- Coordinate Handoff: Carry `W1 R7` into requirement-history entries and the backlog `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/`. The legacy-PRD cleanup runs first as W1 R8, with its own design and plan, and must close `D-005` before W1 R7 work P1 starts; see [05](./05-legacy-prd-cleanup-handoff.md).

## Change History

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: [03 Work Backlog Shape](./03-work-backlog-shape.md) P1 and P8 entry gates and the Legacy-PRD Cleanup Gate; [05 Legacy PRD Cleanup Handoff](./05-legacy-prd-cleanup-handoff.md) Priority and Sequencing; the Coordinate Handoff above.
- Previous scope: P1 through P7 could run while the legacy-PRD cleanup ran. Only P8 waited for `D-005` to close.
- Replacement scope: The cleanup runs as W1 R8 and must close `D-005` before W1 R7 P1 starts. Every later phase follows P1. P8 needs no separate `D-005` condition.
- Rationale: The Make Docs PRD router requires `make-docs run prd authority validate` to exit zero before downstream work uses the PRD set.
- PRD decision: `update-existing` — register `D-005` sequencing.
- Owner approval: Owner decision on 2026-11-23 in the planning chat.
- Source: [PRD set authority cleanup design](../../designs/2026-11-23-prd-set-authority-cleanup.md)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: [03 Work Backlog Shape](./03-work-backlog-shape.md) P1 outcome (test runner).
- Previous scope: Tests run with Vitest, and Vitest is a pinned dev dependency.
- Replacement scope: Tests run with Node's built-in test runner (`node:test`) and `node:assert/strict`. The pinned dev dependencies are `typescript`, `esbuild`, and `@types/node`. Task meanings are otherwise unchanged.
- Rationale: Vitest's dependency tree includes MPL-2.0 `lightningcss` packages, which the PRD 20 Supply Chain license list does not allow, and PRD 20 prefers Node built-ins.
- PRD decision: `update-existing` — PRD 20 `## Runtime and Package` now names `node:test`.
- Owner approval: Owner decision on 2026-11-23, relayed by the orchestrating maintainer chat.
- Source: [W1 R7 P1 TypeScript Package Foundation](../../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: [01 PRD Authority Maintenance](./01-prd-authority-maintenance.md) candidate `C-04` (shared command contract).
- Previous scope: The shared command contract parses arguments with `node:util` `parseArgs`.
- Replacement scope: The shared command contract parses arguments with a small built-in parser that follows Go's `flag` package rules. No CLI framework or outside parsing package is used.
- Rationale: `node:util` `parseArgs` cannot parse Go `flag`-style spellings such as `-json`. It splits them into short flags. Go output parity requires those spellings.
- PRD decision: `update-existing` — PRD 20 `## Runtime and Package` now names the built-in Go `flag`-rules parser and records the change in `## Requirement History`.
- Owner approval: Owner decision on 2026-11-23, relayed by the orchestrating maintainer chat.
- Source: [W1 R7 P1 TypeScript Package Foundation](../../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md)
