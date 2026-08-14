# Phase 06: MCP Parity, Distribution Evidence, and Program Handoffs

## Purpose

Complete the built-in MCP protocol and qualify the cohesive Build OS distribution while preserving separate later-program boundaries.

## Overview

This phase completes schema, discovery, authorization context, progress, cancellation, diagnostics, packaging, upgrade, rollback, and removal evidence for the single `buildos` executable. It does not implement an app UI, browser extension, optional coordinating server, or Make Docs companion lifecycle.

## Source PRD Docs

- [PRD 19: Build OS Headless Core, CLI, and MCP Program](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md)
- [PRD 03: Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md)
- [PRD 18: Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)

## Candidate Capability Trace

- Completion and qualification: `SYS-001`, `MCP-001`, and `PKG-001`, plus parity evidence for every approved core/CLI domain-operation identifier completed by prior phases.
- Handoff only: `SRV-001`, `UI-001`, `CMP-001`, and `CMP-002`; this backlog does not implement those separately gated capabilities.

## Stage 1 - MCP Protocol Completion and Parity

### Tasks

- [ ] t1: Complete approved MCP tool and resource schemas, capability discovery, authorization context, cancellation, progress, error, and diagnostic mappings inside the same Go program.
- [ ] t2: Execute the approved operation-parity matrix for the complete approved CLI domain-operation surface and its MCP mirrors, including results, durable effects, errors, receipts, versioning, and compatibility behavior.
- [ ] t3: Classify all MCP-only transport capabilities and prove that none creates an alternate domain operation, authorization bypass, or filesystem write path.

### Acceptance criteria

- The installed `buildos` executable contains both CLI and MCP launch modes.
- Every approved CLI domain operation has equivalent core outcomes and receipts through CLI and MCP.
- MCP protocol behavior is versioned and cannot bypass core safety guards.

### Dependencies

- Phases 02 through 05 operation and recovery completion.

## Stage 2 - Distribution Qualification and Separate Program Gates

### Tasks

- [ ] t4: Produce approved cross-platform packaging, clean-install, upgrade, rollback, removal, checksum, SBOM, provenance, and supported-platform evidence for the cohesive Go distribution.
- [ ] t5: Reconcile documentation, legacy compatibility windows, release approvals, and deprecation gates without publishing or deploying unless separately authorized.
- [ ] t6: Create separate owner-review handoffs for the optional coordinating server, app UI and browser capture, and Make Docs companion integration, each with its own open-question, evidence, privacy, security, and lifecycle gate.

### Acceptance criteria

- Packaging treats the core, CLI, and MCP server as one product and executable rather than separate installations.
- Passing distribution checks does not itself authorize publication or deployment.
- UI, browser capture, coordinating server, and Make Docs implementation remain outside this backlog and require new approved plans.

### Dependencies

- Stage 1 MCP parity.
- Approved distribution and security evidence profile.
