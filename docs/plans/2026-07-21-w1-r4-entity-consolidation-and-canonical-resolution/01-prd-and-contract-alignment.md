# Phase Detail: PRD and Contract Alignment

## P1 - Effective Requirements and Redirect Contract

Create the authoritative enhancement contract before implementation so every later worker shares one lifecycle, graph, migration, and ownership model.

## Source Inputs

- [Entity consolidation and canonical resolution design](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [Pre-upgrade audit prompt](../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
- `system/.os/contracts/entity-records-contract.md`
- `system/.os/contracts/extraction-contract.md`
- Active PRDs 00, 01, 02, 03, 04, 08, 09, 14, 15, 16, 17, and 18

## Workstreams

1. Author `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` with the required enhancement headings and decision-complete requirements for redirect fields, allowed kinds, lifecycle invariants, terminal resolution, derived reverse membership, compatibility and strict validation, deterministic commands, matching tiers, and source-build adoption.
2. Extend the shipped entity and extraction contracts so `superseded` plus `redirect` has one meaning across every governed entity type and extraction metadata distinguishes newly minted IDs from references or updates to canonical IDs.
3. Add only genuine `Enhanced by` annotations to the baseline sections named in the overview; preserve existing text and chronological change-note order.
4. Update existing risk item R-004 with the accepted mitigation and closure gates, without adding `Change Notes` inside the register.
5. Freeze the W1 R4 portion of PRD 18: `toolkits/buildos/`, `buildos entities`, shared `--root`, `--json`, version/help, output-envelope, and exit-code behavior, plus the temporary `pkg/entities` cross-module boundary.

## Dependencies

- Starts from the accepted design and does not depend on implementation.
- PRD 17 entity terminology and PRD 18 CLI terminology must settle before contract fixtures, package API names, baseline annotations, or guide prose become final.
- Baseline and index workers may proceed in parallel after the PRD 17 path and vocabulary are fixed, but assembly occurs after both are complete.

## Acceptance Checks

- PRD 17 is the next numbered doc and no existing PRD is renamed, reordered, archived, or silently rewritten.
- The contract states that losing records remain authoritative historical rows, `related` remains non-canonical, and reverse members are derived rather than hand-maintained.
- The contract defines actionable errors for missing targets, self-redirects, type mismatches, cycles, inactive terminals, illegal redirect statuses, duplicate IDs, remap conflicts, and stale indexes.
- Compatibility mode is explicitly temporary and read-oriented; strict mode is the release and post-migration gate.
- The public command contract says `buildos entities`; no public `buildos-entities` binary is introduced.
- Baseline links resolve from old requirements to PRD 17 and back, and R-004 carries executable closure conditions.

## Execution Notes

Use `jdocmunch` to inspect current section order and existing backlinks before writing. Do not annotate PRD 07 merely because it precedes extraction; its converted-source intake contract remains semantically separate. If implementation discovery exposes a distinct requirement scope, stop and reconcile PRD strategy before splitting the accepted one-doc enhancement.
