---
date: "2026-07-21"
client: "Codex Desktop"
coordinate: "W1 R4 P4"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Integrated canonical references across discovery, design, persona matching, and extraction validation without rewriting historical provenance."
---

# W1 R4 P4 Canonical References Across Consumers and Producers

## Changes

Integrate canonical entity resolution across discovery and design, add persona-only exact matching and extraction-outcome validation, preserve requested IDs and historical references for audit, and write only terminal canonical IDs into new governed references.

Discovery now imports the temporary shared resolver package directly, resolves authored playbook targets, explicit targets, and requested run IDs before runtime use, and reports requested IDs, canonical IDs, and complete chains. New run targets and finding references use terminal canonical IDs, while authored playbooks, requested targets, requested run IDs, raw-finding anchors, losing rows, and historical references remain unchanged. Invalid graphs, missing IDs, invalid terminals, and contradictory derived indexes are covered by fail-before-write tests.

Design uses the same direct local module dependency to resolve a requested finding before promotion. A terminal `qualified` finding supplies the design lineage and receives the back-reference; a losing finding remains unchanged. Promotion preserves unknown JSONL fields, performs canonical-row updates atomically, and prevents partial design or finding writes when resolution, validation, or a write step fails.

The shared package now owns type-specific terminal lifecycle rules, persona-only exact matching, and extraction-outcome validation. Persona matching accepts exact IDs, unique approved aliases, and unique `persona-v1` keys only when they converge on one active terminal persona; malformed, inactive, ambiguous, colliding, fuzzy, semantic, and unsupported-type inputs remain non-mutating review outcomes. `ValidateExtractionOutcomes` covers graph-governed entity IDs, while `ValidateExtractionOutcomesWithPlaybooks` uses the separate authoritative playbook resolver for `PB-NNN` outcomes. Neither API writes records or authorizes live migration.

The discovery, design, and unified shared-package suites pass their unit, integration, race, and vet gates. This phase adds no public `buildos-entities` binary, performs no W1 R5 domain migration or packaging, replaces no installed binary, and changes no live adopter data.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/10-discovery-runs-and-qualification.md](../../prd/10-discovery-runs-and-qualification.md) | Reconciled discovery lifecycle, canonical target and run resolution, provenance, and fail-before-write behavior. |
| [docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md) | Recorded completed P4 consumer, producer, persona, extraction, and type-specific terminal contracts. |
| [docs/prd/18-revise-unified-buildos-cli-and-distribution.md](../../prd/18-revise-unified-buildos-cli-and-distribution.md) | Advanced the W1 R4 seed through temporary direct package sharing without claiming W1 R5 migration or distribution. |
| [docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md](../../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md) | Marked the fourteen P4 tasks complete against implementation and test evidence. |
| [system/.os/contracts/entity-records-contract.md](../../../system/.os/contracts/entity-records-contract.md) | Reconciled the common status vocabulary with the existing finding and run type-specific lifecycle states. |
| [system/.os/contracts/entity-consolidation-contract.md](../../../system/.os/contracts/entity-consolidation-contract.md) | Defined current terminal resolution without weakening the type scope of `qualified`, `running`, `closed`, or `aborted`. |

### Developer

| Path | Description |
| --- | --- |
| [docs/guides/developer/buildos-toolkit-cli-development.md](../../guides/developer/buildos-toolkit-cli-development.md) | Documented temporary local module imports, requested/canonical/chain output, canonical writes, lifecycle, and atomic failure behavior. |
| [docs/guides/developer/operating-layer-entities-consolidation-and-resolution.md](../../guides/developer/operating-layer-entities-consolidation-and-resolution.md) | Added the durable P4 consumer/producer inventory, persona and extraction APIs, playbook authority boundary, and failure matrix. |
| [docs/guides/developer/operating-layer-contracts-maintenance.md](../../guides/developer/operating-layer-contracts-maintenance.md) | Reconciled discovery and finding maintenance steps with canonical resolution and type-specific terminal states. |

### User

| Path | Description |
| --- | --- |
| [docs/guides/user/entities-consolidation-curate-and-resolve-records.md](../../guides/user/entities-consolidation-curate-and-resolve-records.md) | Explained exact persona review boundaries, extraction validation, and how existing tools preserve history while using canonical winners. |
| [docs/guides/user/record-discovery-runs-and-qualify-findings.md](../../guides/user/record-discovery-runs-and-qualify-findings.md) | Explained canonical discovery targets and run links, requested provenance, lifecycle, and safe resolver failures. |
| [docs/guides/user/promote-qualified-findings-to-designs.md](../../guides/user/promote-qualified-findings-to-designs.md) | Explained promotion from redirected finding IDs, canonical back-references, source-build posture, and partial-write protection. |
