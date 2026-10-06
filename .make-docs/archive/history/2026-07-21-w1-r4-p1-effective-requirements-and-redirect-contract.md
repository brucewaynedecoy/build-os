---
date: "2026-07-21"
client: "Codex Desktop"
coordinate: "W1 R4 P1"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Froze the unified entity redirect, resolution, persona identity, extraction outcome, and CLI contracts."
---

# W1 R4 P1 Effective Requirements and Redirect Contract

## Changes

Freeze the W1 R4 effective requirements for non-destructive entity redirects, deterministic terminal resolution, reviewed manifests, persona identity reuse, extraction outcomes, and the unified `buildos entities` command contract. Align maintainer and user guidance with the P1 contract boundary while keeping the executable and mutation behavior explicitly deferred to P2.

The phase adds normative positive and negative fixtures for every governed entity type, graph diagnostics, persona exact-match decisions, and extraction outcomes. JSON and JSONL fixtures parse successfully; config, frontmatter, entity-data, path-hygiene, internal-link, and diff checks pass.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [PRD 17](../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md) | Reconciled the effective entity, manifest, persona identity, and extraction outcome requirements with P1 contracts. |
| [PRD 18](../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md) | Recorded that P1 freezes the unified CLI contract while P2 implements the executable. |
| [P1 backlog](../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md) | Marked tasks t1 through t10 complete after contract and fixture evidence landed. |
| [Toolkit router](../../../toolkits/AGENTS.md) | Replaced the one-public-binary-per-domain rule with unified module and subcommand routing. |
| [Toolkit README](../../../toolkits/README.md) | Documented the current transition from legacy binaries to one public `buildos` executable. |
| [Contracts router](../../../system/.os/contracts/AGENTS.md) | Added routes for entity consolidation and persona identity authority. |
| [Entity records contract](../../../system/.os/contracts/entity-records-contract.md) | Added redirect fields, lifecycle rules, graph invariants, field preservation, and remap behavior. |
| [Entity consolidation contract](../../../system/.os/contracts/entity-consolidation-contract.md) | Added terminal resolution, reviewed manifest, derived index, validation mode, and diagnostic contracts. |
| [Persona identity contract](../../../system/.os/contracts/persona-identity-contract.md) | Added the persona-only `persona-v1` exact identity and approved-alias contract. |
| [Extraction contract](../../../system/.os/contracts/extraction-contract.md) | Added versioned `minted`, `referenced`, and `updated` outcomes while preserving legacy provenance. |
| [Entity-resolution fixture guide](../../../system/.os/contracts/examples/entity-resolution/README.md) | Cataloged valid and invalid graph, manifest, resolver, diagnostic, and index fixtures. |
| `system/.os/contracts/examples/persona-identity/*.json` | Added exact, ambiguous, and normalization-collision persona fixtures. |
| `system/.os/contracts/examples/extraction-outcomes/*.json` | Added minted, referenced, and updated extraction fixtures. |

### Developer

| Path | Description |
| --- | --- |
| [Entity consolidation maintenance](../../../docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md) | Explained P1 authority, graph rules, persona matching, extraction outcomes, and the P2 no-command boundary for naive maintainers. |
| [BuildOS toolkit CLI development](../../../docs/assets/maintainer/buildos-toolkit-cli-development.md) | Updated module, domain, contract, and public-command guidance for the unified CLI transition. |

### User

| Path | Description |
| --- | --- |
| [Curate and resolve duplicate entity records](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md) | Explained what P1 makes reviewable, what remains unsafe until P2, and how exact persona reuse differs from fuzzy review. |
