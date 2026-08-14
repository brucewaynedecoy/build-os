# Build OS Phase 1 Capability Map and PRD Reconciliation Delta Candidate

## Purpose

Provide a dependency-ordered first implementation-backlog candidate for the single Go Build OS distribution containing the headless core, CLI, and MCP server. This directory is a planning artifact only and is not authoritative or executable.

Execution is blocked until the owner approves anticipated [PRD 19](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md) and its complete capability map, the reconciled [open questions and risk register](../../prd/03-open-questions-and-risk-register.md), the [W1 R6 plan](../../plans/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation/00-overview.md), this backlog, the W1 R6 coordinate, and the commit or merge state that makes those artifacts repository authority. A separate implementation instruction is required after those gates pass.

W1 R6 is a recommended revision coordinate derived from the W1 R5 lineage and remains subject to owner review. [W1 R5](../../plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md) remains untouched and unexecuted.

## Phase Map

| Phase | Work file | Candidate outcome | Entry dependency |
| --- | --- | --- | --- |
| 01 | [Pre-Implementation Reconciliation Gate](./01-pre-implementation-reconciliation-gate.md) | Repository authority, capability coverage, register dispositions, and phase evidence are revalidated immediately before implementation. | All approval and authority blockers in this index |
| 02 | [Go Core, CLI, and MCP Contract Seam](./02-go-core-cli-and-mcp-contract-seam.md) | One cohesive Go executable proves shared use-case and receipt semantics through a bounded entity read and mutation via CLI and MCP. | Phase 01 |
| 03 | [Project State, Intake, Data, and Query Migration](./03-project-state-intake-data-and-query-migration.md) | Local state and read-first evidence/data operations migrate behind the core with CLI/MCP and legacy parity. | Phase 02 |
| 04 | [Discovery, Qualification, and Provenance Migration](./04-discovery-qualification-and-provenance-migration.md) | Playbooks, runs, findings, qualification, handoff, relationships, and provenance use the shared safe mutation lifecycle. | Phase 03 |
| 05 | [Recovery, Removal, and Compatibility Migration](./05-recovery-removal-and-compatibility-migration.md) | Recovery, repair, Build OS removal, upgrade, rollback, and bounded legacy compatibility are proven before deletion or deprecation. | Phase 04 |
| 06 | [MCP Parity, Distribution Evidence, and Program Handoffs](./06-mcp-parity-distribution-evidence-and-program-handoffs.md) | MCP protocol parity and the cohesive distribution are qualified, while UI, server, and Make Docs work remain separate gated programs. | Phase 05 |

## Usage Notes

- This backlog does not authorize implementation, code or toolkit changes, commits, merges, publication, deployment, installed-state mutation, or Make Docs operations.
- Before planning or starting every phase, repeat the complete capability-map and risk-register reconciliation for that phase. A phase cannot proceed with an undispositioned capability, question, or risk.
- Use the stable capability identifiers defined by approved PRD 19. Do not infer new operations from directory names, router text, templates, manual steps, or current command count.
- The headless core, CLI, and MCP server are internal surfaces of one Go program, installed executable, package, and distribution. MCP mirrors the CLI domain-operation surface and neither adapter shells through the other.
- Preserve existing toolkits, fixtures, aliases, and adopter data until the relevant parity, migration, rollback, and owner-approval gates pass.
- UI and browser capture, an optional coordinating server, and Make Docs companion integration require separate later design, validation, and authorization gates.
- Task IDs are phase-local. Acceptance criteria are plain bullets. All tasks remain unchecked.

## Capability Trace Rule

The capability identifiers cited by the phase files come from the current uncommitted PRD 19 draft and remain provisional until the owner approves that PRD and its authority state. Any identifier, scope, disposition, or phase-gate change in PRD 19 requires reconciliation of this candidate before execution approval. Phase 01 revalidates the complete set; later phases name the subset they could implement, qualify, or hand off only after every relevant gate passes.
