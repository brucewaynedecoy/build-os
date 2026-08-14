# Phase 02: Go Core, CLI, and MCP Contract Seam

## Purpose

Establish the smallest representative seam for the cohesive Go program without changing established filesystem behavior.

## Overview

The candidate seam uses bounded entity read and mutation operations because `toolkits/buildos/` already contains canonical resolution, validation, consolidation, derived-index, dry-run, and recovery evidence. The same transport-neutral use cases must project through the built-in CLI and MCP server in one executable and release.

## Source PRD Docs

- [PRD 19: Build OS Headless Core, CLI, and MCP Program](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md)
- [PRD 17: Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 18: Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)

## Candidate Capability Trace

- Foundation and bounded proof: `SYS-001`, `DAT-001`, `DAT-002`, `ENT-001` through `ENT-004`, `OPR-001`, `OPR-002`, the entity subset of `LFC-001`, `SAF-001`, `SAF-002`, and `MCP-001`.
- Deferred behavior within those rows remains blocked by its PRD 19 or register disposition and is not inferred into this phase.

## Stage 1 - Transport-Neutral Core Contracts

### Tasks

- [ ] t1: Implement the approved internal Go request, inspect, plan, authorization, apply, verify, result, diagnostic, and receipt contracts without importing CLI, MCP, HTTP, or UI concepts into the core.
- [ ] t2: Implement approved local operation identity, plan digest, idempotency, dry-run, locking, atomic write, interruption, recovery, and redaction rules for the bounded entity seam.
- [ ] t3: Preserve canonical JSONL and redirect authority while treating indexes and other caches as reproducible derived state.

### Acceptance criteria

- Internal core packages test without transport dependencies.
- Read operations remain non-mutating and mutation plans are serializable and inspectable.
- Interrupted or partially applied mutations are diagnosable and recoverable under the approved contract.

### Dependencies

- Phase 01 gate.
- Approved entity capability rows and register dispositions.

## Stage 2 - Built-In CLI and MCP Parity

### Tasks

- [ ] t4: Make the existing CLI adapter call the bounded core use cases while preserving approved human output, JSON envelope, diagnostics, exit behavior, dry-run, and filesystem effects.
- [ ] t5: Add the approved MCP launch mode and operation mappings inside the same `buildos` executable without shelling through the CLI.
- [ ] t6: Prove CLI-to-MCP semantic parity for success, validation failure, conflict, dry-run, applied mutation, replay, recovery, and receipt content.

### Acceptance criteria

- One built executable contains the headless core, CLI, and MCP server.
- Every approved CLI domain operation has an equivalent MCP operation and both produce the same core outcome and receipt semantics.
- Transport-only behavior is labeled and creates no alternate domain operation or write path.

### Dependencies

- Stage 1 core contracts.
