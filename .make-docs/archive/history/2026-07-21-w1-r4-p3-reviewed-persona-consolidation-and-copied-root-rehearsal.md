---
date: "2026-07-21"
client: "Codex Desktop"
coordinate: "W1 R4 P3"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Proved reviewed persona consolidation and copied-root rollback with sanitized fixtures and an explicitly staged BuildOS binary."
---

# W1 R4 P3 Reviewed Persona Consolidation and Copied-Root Rehearsal

## Changes

Prove reviewed persona consolidation end to end with sanitized proposal-only evidence, an explicitly staged unified BuildOS binary, copied-root dry-run and apply checks, deterministic resolution and index results, and byte-identical rollback while leaving installed tooling and live adopter data unchanged.

The proposal package inventories 19 governed records and their references, records explicit fixture-review-board decisions, leaves the ambiguous persona group unresolved, and separates approved, replay, and intentionally conflicting manifests. The staged binary was built from revision `ce5aafb62bcd233a4671ca0d6eb4fe39ea38dca5`, reported `dev` with the injected source revision, and had SHA-256 `f28a1b83ba20065a39035f38fec045b04863212ee5173e4a019a1d8a04596946`.

The copied-root rehearsal began with baseline tree SHA-256 `a24550f9329324372b4533d2d8a0b8086198b423fd45ede0d06523686a65c326`. Compatibility validation passed with 19 records and the current reproducible index. The dry run planned three persona changes and wrote nothing. Apply changed only `personas.jsonl` and `entity-resolution.json`, strict validation and index checking passed, representative one-hop and multi-hop resolutions reached the expected active personas, replay was byte-stable, the intentional remap exited `4` without writes, and snapshot recreation restored the baseline tree hash exactly.

The focused copied-root test, full Go suite, and race-enabled Go suite passed. The actual adopter-owned root was unavailable; the phase therefore proves the sanitized reference procedure only. No installed binary was replaced, no live data was changed, and no deployment or migration approval was granted.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md](../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md) | Reconciled the entity contract with completed sanitized P3 evidence and the live-root boundary. |
| [docs/prd/18-revise-unified-buildos-cli-and-distribution.md](../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md) | Advanced the unified CLI seed from P2 implementation to completed P3 copied-root proof. |
| [docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md](../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md) | Marked P3 tasks complete against the sanitized proposal, staged build, copied-root, and rollback evidence. |
| [toolkits/buildos/testdata/persona-pilot/README.md](../../../toolkits/buildos/testdata/persona-pilot/README.md) | Routes the sanitized persona pilot fixtures, review evidence, manifests, and checksums. |

### Developer

| Path | Description |
| --- | --- |
| [docs/guides/developer/buildos-toolkit-cli-development.md](../../../docs/assets/maintainer/buildos-toolkit-cli-development.md) | Added staged-build inventory, checksums, focused tests, isolation rules, and safe stops for maintainers. |
| [docs/guides/developer/operating-layer-entities-consolidation-and-resolution.md](../../../docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md) | Added the executed copied-root runbook, complete sanitized evidence table, recovery checks, and approval boundaries. |

### User

| Path | Description |
| --- | --- |
| [docs/guides/user/entities-consolidation-curate-and-resolve-records.md](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md) | Added a naive operator walkthrough, reference outcomes, review-packet checklist, rollback procedure, and safe-stop guidance. |
