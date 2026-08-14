# R6 P2 - Operation Contract and Parity Reconciliation

## Purpose

Make the capability map decision-complete at the operation boundary while preserving explicit open questions where evidence is missing.

## Dependency Position

- Starts after P1 establishes the full capability catalog and register identifiers.
- Blocks migration sequencing and implementation-backlog approval.
- Produces documentation contracts and evidence requirements only.

## Scope

- For every mapped capability, define the domain operation, transport-neutral core use case, CLI command family, MCP tool or resource, and semantic parity expectation.
- Identify canonical and derived state, ownership, state transitions, inputs, outputs, diagnostics, provenance, operation plans, authorization, verification, and receipts.
- Define or explicitly defer idempotency, dry-run, concurrency, locking, interruption, recovery, redaction, privacy, retention, and error semantics.
- Cover global and project identity, configuration and registries, intake and conversion, extraction and candidates, data/index/query/validation, playbooks/runs/findings/qualification, relationships/provenance/operations, and lifecycle recovery/repair/removal.
- Reconcile existing entity, intake, discovery, and design behavior as compatibility evidence rather than copying CLI handlers into the future core contract.

## Parallel Workstreams

| Lane | Deliverable | Integration dependency |
| --- | --- | --- |
| State and provenance | Canonical/derived authority, transitions, plans, receipts, recovery | P1 capability identifiers |
| Adapter parity | Core-to-CLI-to-MCP mapping and transport-only exceptions | P1 capability identifiers |
| Safety and privacy | Authorization, redaction, retention, concurrency, failure semantics | State and provenance draft |
| Evidence and non-goals | Fixtures, environments, compatibility duties, exclusions | All operation drafts |

## Deliverables

- One operation-contract row or equivalent structured entry for every capability.
- CLI/MCP parity matrix that forbids a second domain contract or alternate write path.
- Acceptance-evidence matrix covering current behavior, migration parity, crash and recovery cases, and supported platforms.
- Explicit later gates for UI and browser capture, the optional coordinating server, and Make Docs companion integration.

## Validation

- The headless core, CLI, and MCP server are one Go program and distribution in every normative statement.
- CLI and MCP map to the same operation semantics, while transport-only progress, cancellation, discovery, or presentation behavior is separately labeled.
- Mutations and external actions cannot bypass plan, authorization, apply, verify, and record.
- Missing evidence produces a register disposition rather than an invented requirement.

## Exit Gate

P3 may begin only when every capability row has all required fields or an explicit blocking disposition and the register contains no undispositioned in-scope question or risk.
