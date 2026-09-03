# Build OS Phase 1 Capability Map and PRD Reconciliation Change Plan

**Date:** 2026-08-14

**Repository:** Build OS repository root

**Purpose:** Produce the reviewable Phase 1 contract inventory and active-PRD reconciliation required before any implementation of the single Go Build OS distribution containing the headless core, CLI, and MCP server.

## Objective

Reconcile the approved-but-uncommitted product-boundary and runtime-proof inputs with the live PRD namespace, W1 R5 lineage, current Go modules, and existing toolkit behavior. Completion means anticipated [PRD 19](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md), the living risk register, and the complete capability map can be reviewed as one decision package; the map covers every initial capability and explicitly binds each domain operation to shared core semantics, CLI and MCP parity, data authority, lifecycle behavior, dependencies, migration obligations, evidence, phase, and non-goals.

This plan authorizes documentation and planning only. It does not authorize Go implementation, toolkit changes, execution of the candidate backlog, commits, merges, publication, deployment, or changes to Make Docs.

## Coordinate Decision

- Coordinate: `W1 R6`
- Classification: `revision`; adopted successor execution coordinate
- Evidence: [W1 R5](../2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md) is the unexecuted prior revision of the W1 unified-distribution lineage.
  The [product-boundary design](../../designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md) retains useful W1 R5 choices but revises its CLI-first application boundary, brings MCP into the same executable and release, and requires a complete capability-map gate before implementation.
  The owner adopted `W1 R6` as the successor execution coordinate in that lineage.

W1 R5 is superseded for execution, remains unexecuted, and is retained in place as historical and compatibility evidence; it must not be executed.
This coordinate decision does not authorize implementation.
W1 R6 remains subject to the technical, artifact-approval, repository-authority, and phase gates below.

## Change Classification

- Requested change type: `revision`
- Effective execution mode: `active-set evolution`
- Cleanup rewrite requested: no
- Full backlog regeneration requested: no; create only a scoped, non-authoritative delta candidate
- Archive action: none

## Change Inputs

| Input | Format | Location | Confidence |
| --- | --- | --- | --- |
| Product boundary, operating model, capability-map discipline, and program gates | Approved design input, currently uncommitted | [Build OS Product Boundary and Headless Operating Model](../../designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md) | Approved drafting input; not committed repository authority |
| Runtime-selection evidence | Approved design input, currently uncommitted | [Build OS Phase 0.5 Runtime-Selection Proof](../../designs/2026-08-14-build-os-runtime-selection-proof.md) | Verified decision evidence; not committed repository authority |
| Current unified executable and distribution requirement | Active PRD change doc | [PRD 18](../../prd/18-revise-unified-buildos-cli-and-distribution.md) | Committed active authority, narrower than the approved design input |
| Toolkit deployment and ownership constraints | Active PRD change docs | [PRD 14](../../prd/14-revise-deterministic-toolkit-deployment.md) and [PRD 16](../../prd/16-revise-toolkit-ownership-boundaries.md) | Committed active authority subject to newer linked revisions |
| Canonical entity behavior and migration evidence | Active PRD enhancement | [PRD 17](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md) | Committed active authority and preferred first core seam |
| Product, architecture, and decision state | Active core PRDs | [Product overview](../../prd/01-product-overview.md), [architecture overview](../../prd/02-architecture-overview.md), and [open questions and risk register](../../prd/03-open-questions-and-risk-register.md) | Committed active authority requiring reconciliation |
| Current implementation behavior | Go source and tests | `toolkits/buildos/`, `toolkits/buildos-intake/`, `toolkits/buildos-discovery/`, and `toolkits/buildos-design/` | Current code authority for observed behavior, not the complete future contract |
| Prior revision plan and candidate backlog | Plan and work directories | [W1 R5 plan](../2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md) and [W1 R5 work](../../work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md) | Useful unexecuted lineage; must not be mistaken for implemented behavior |

The approved design inputs may guide this draft, but implementation remains blocked until their authority and the resulting PRD, register, plan, and backlog disposition are committed or merged through separately approved repository actions.

## Baseline Context

- Active `docs/prd/` status: populated active namespace; evolve in place without archive or renumbering.
- Primary new change doc: anticipated [PRD 19](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md).
- Impacted active docs: PRDs 00 through 03 and PRDs 05 through 18, with the exact annotations and register updates owned by the PRD reconciliation task.
- Current implementation baseline: the W1 R4 `toolkits/buildos/` seed exposes shared CLI plumbing and entity operations; intake, discovery, and design remain separate Go modules.
- Required discovery posture: directory conventions, routers, templates, manual workflows, and current commands are evidence only. Every observed behavior must be supported, deferred with owner and gate, retained as manual convention, or explicitly excluded.

## Output Contract

- Plan directory: `docs/plans/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation/`
  - entry point: `00-overview.md`
  - phase files: `01-authority-and-capability-map-gate.md` through `04-validation-and-owner-review.md`
- Anticipated revision doc: `docs/prd/19-revise-build-os-headless-core-cli-and-mcp-program.md`
- Living register: `docs/prd/03-open-questions-and-risk-register.md`
- Baseline annotations and index updates: `docs/prd/00-index.md`, `docs/prd/01-product-overview.md`, `docs/prd/02-architecture-overview.md`, and affected PRDs 05 through 18
- Non-authoritative delta candidate: `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/`

## Change Doc Strategy

| New doc | Kind | Why it exists | Affected baseline docs |
| --- | --- | --- | --- |
| `19-revise-build-os-headless-core-cli-and-mcp-program.md` | Revision | Defines the complete initial contract inventory, single-Go-distribution boundary, CLI/MCP operation parity, local-first data and provenance rules, migration obligations, phase assignments, evidence, and non-goals. | PRDs 00 through 03 and 05 through 18 |

The living risk register remains the only repository-native location for unresolved questions, decisions, drift, and risks. PRD 19 must reference rather than duplicate register authority and must not invent answers where evidence is absent.

## Baseline Annotation Plan

| Baseline doc | Impacted sections | Note verb | Target change doc |
| --- | --- | --- | --- |
| `docs/prd/01-product-overview.md` | Key capabilities, system boundaries, current limitations | `Superseded by` where the effective product boundary changes | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/02-architecture-overview.md` | Module map, runtime boundaries, data flow, configuration surfaces | `Superseded by` where the headless-core and MCP architecture changes | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/05-spaces-boundary-and-shipping.md` | Make Docs ownership, three-space model, shipping boundary | `Superseded by` where Make Docs is treated as a Build OS-owned subsystem or bundled concern | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/06-operating-layer-and-routing.md` | Directory authority, routers, scripts, operation discovery | `Superseded by` where directories or wrappers can be read as the complete product contract | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/07-intake-and-conversion.md` | Converter ownership, provenance, toolkit placement | `Superseded by` only for migration behind transport-neutral operations with CLI/MCP parity | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/08-data-and-extraction.md` | Authority, extraction transitions, indexes, validation, recovery | `Superseded by` where explicit core-operation and canonical-versus-derived contracts are required | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/09-playbooks.md` | Playbook enumeration, validation, selection, runnable index | `Superseded by` where explicit operations replace inferred directory/index behavior | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/10-discovery-runs-and-qualification.md` | Runs, raw findings, qualification authority, promotion floor | `Superseded by` for explicit operations and the unresolved authority gate while preserving verify-to-promote | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/11-flow-c-integration.md` | Direct design promotion and downstream handoff | `Superseded by` for the Build OS-owned export/handoff boundary and public-operation-only Make Docs integration | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/12-stage-automation.md` | Stage movers, mutation authority, safety lifecycle | `Superseded by` where automation could bypass core plans, authorization, verification, receipts, or parity | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/13-adopter-owned-config-surface.md` | Config validation, global/project authority, identity | `Superseded by` for core config operations and separately decided global/project state | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/14-revise-deterministic-toolkit-deployment.md` | Toolkit structure, binary naming, runtime posture | `Superseded by` only for the cohesive-distribution scope | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/15-revise-extraction-draft-lifecycle.md` | Transition authority and adapter exposure | `Superseded by` only for explicit core transitions; preserve established lifecycle vocabulary | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/16-revise-toolkit-ownership-boundaries.md` | Domain ownership, candidate toolkits, integration boundaries | `Superseded by` only for migration into the cohesive program | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | Entity command seam, canonical state, acceptance evidence | `Superseded by` only for core/adapter placement and parity; preserve entity contracts and safety evidence | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | CLI-first boundaries, MCP omission, W1 R5 migration and lifecycle handoff | `Superseded by` for the changed scope | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/03-open-questions-and-risk-register.md` | Existing and new items relevant to Phase 1 | Direct register reconciliation; no `Change Notes` block | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `docs/prd/00-index.md` | Document map, reading order, lineage | Add PRD 19 and update affected relationships | `19-revise-build-os-headless-core-cli-and-mcp-program.md` |

## Architecture and Capability-Map Target

The selected product boundary is one cohesive Go program, product package, installed executable, and distribution containing the headless core, CLI, and MCP server. The core owns domain rules and authoritative Build OS writes. CLI and MCP are built-in adapters that invoke the same versioned use cases, and MCP mirrors the complete approved CLI domain-operation surface in the same release. Neither adapter shells through the other.

The capability map is a contract inventory rather than a command list. For every initial capability it must identify domain and operation; core use case; CLI and MCP mapping and parity; canonical and derived data authority; states and transitions; inputs, outputs, diagnostics, and receipts; idempotency, dry-run, authorization, verification, interruption, recovery, and error behavior; dependencies; compatibility and migration obligations; acceptance evidence; phase; and non-goals.

The map must cover project and global state, configuration and registries, evidence intake and conversion, extraction and candidates, data/index/query/validation, playbooks/runs/raw findings/qualification, relationships/provenance/operations, lifecycle recovery/repair/removal, the external Make Docs boundary, and operational safety. Unresolved semantics remain explicit register items with owner, phase, required evidence, and blocking disposition.

## Dependencies and Decision Gates

1. The two uncommitted design inputs require owner acceptance and a separately authorized commit or merge before they can become repository authority for implementation.
2. PRD 19, required baseline annotations, `docs/prd/00-index.md`, and the reconciled living register must be reviewed as one active-set evolution package.
3. The complete initial capability map must contain no undispositioned in-scope capability, open question, or risk. A documented blocking or deferred disposition is valid; silence is not.
4. The W1 R6 coordinate is adopted and supersedes W1 R5 for execution. The W1 R6 plan and candidate backlog still require owner review; W1 R5 remains unexecuted historical and compatibility evidence and must not be executed.
5. The candidate backlog remains non-authoritative until PRD 19, the capability map, the register, this plan, and commit or merge authority are approved.
6. Implementation, toolkit mutation, publication, and deployment each require separate authorization after the documentation gates pass.
7. The optional coordinating server, UI and browser evidence client, and Make Docs companion integration require later independent design and validation gates; none is implementation scope here.

## Worker Ownership

Any later execution should keep write scopes disjoint and delegation-ready.

| Worker lane | Scope | Write scope | Dependencies | Deliverables |
| --- | --- | --- | --- | --- |
| Capability contract | PRD 19 and complete capability-map inventory | PRD 19 only | Design inputs and live evidence | Reviewable contract inventory |
| Register reconciliation | Open questions, risks, owners, phases, evidence, dispositions | Risk register only | Capability inventory | Reconciled decision state |
| Baseline assembly | PRD index and affected `Change Notes` | PRD 00, 01, 02, and 05 through 18 only | PRD 19 draft | Effective lineage |
| Delta backlog | Dependency-ordered implementation candidate | W1 R6 delta work directory only | PRD 19 and register draft | Explicitly non-authoritative candidate |
| Validation | Template, status, link, coverage, path, and exact-diff review | Fix scope assigned after audit | All producer lanes | Bounded findings and fixes |

## MCP Strategy

- Documentation discovery and section reads: jdocmunch, with an incremental reindex before fallback.
- Code and signature evidence: jcodemunch, with an incremental reindex before fallback.
- Fallback: targeted `rg` and direct reads only after the relevant index cannot be refreshed.
- Product MCP rule: the built-in MCP server mirrors the CLI domain-operation surface through the same Go core. Product MCP parity is a contract requirement, not evidence that an MCP server is already implemented.

## Validation

Planning closeout must confirm:

- the active namespace was evolved without archive, renumbering, or silent baseline rewrite;
- PRD 19 and the capability map trace to current code, current PRDs, and both approved design inputs;
- every initial capability has the required contract fields or an explicit blocking disposition;
- every decision-inventory item appears as a PRD requirement, register item, risk, or follow-on design gate with owner, phase, evidence, and disposition;
- core, CLI, and MCP are consistently described as one Go executable and distribution with semantic operation parity;
- UI, browser capture, optional coordinating server, and Make Docs integration remain separately gated;
- the candidate backlog is dependency ordered, uses phase-local task checkboxes and plain acceptance bullets, and cannot be read as implementation authorization;
- relative links, Markdown style, path hygiene, and exact diffs pass repository checks.

## Phase Map

| File | Purpose |
| --- | --- |
| [01-authority-and-capability-map-gate.md](./01-authority-and-capability-map-gate.md) | Resolve authority, scope, capability coverage, and blocking register dispositions before any implementation path is accepted. |
| [02-operation-contract-and-parity-reconciliation.md](./02-operation-contract-and-parity-reconciliation.md) | Reconcile transport-neutral operations, data authority, safety semantics, CLI/MCP parity, and acceptance evidence. |
| [03-migration-acceptance-and-backlog-handoff.md](./03-migration-acceptance-and-backlog-handoff.md) | Convert the approved contract into a reversible migration and compatibility sequence plus a non-authoritative delta candidate. |
| [04-validation-and-owner-review.md](./04-validation-and-owner-review.md) | Validate the assembled active-set changes and present the owner gates that remain before execution. |

## Handoff to Execution

Saving or approving this plan does not authorize its candidate backlog. Implementation may begin only after the owner approves the effective PRD 19 capability map, reconciled risk register, W1 R6 coordinate and plan, candidate backlog, and the commit or merge state that makes those artifacts repository authority, then separately authorizes the relevant implementation phase. Each later phase must repeat the capability-map and register reconciliation before planning or execution.
