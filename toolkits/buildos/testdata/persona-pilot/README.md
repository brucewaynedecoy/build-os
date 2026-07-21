# Sanitized Persona Consolidation Pilot

This fixture is a complete, synthetic BuildOS entity root for W1 R4 P3 copied-root rehearsal. It contains all eight governed JSONL datasets, a reproducible baseline resolution index, proposal-only review evidence, and deliberately separated version 1 manifests.

## Layout

- `root/` is the canonical baseline. Copy it before any `--apply` rehearsal.
- `review/` is read-only audit and handoff evidence. It is never canonical entity input.
- `manifests/approved-persona-consolidations-v1.json` adds three reviewed immediate redirects in `personas.jsonl`: duplicate, intentional consolidation, and replacement.
- `manifests/approved-existing-replay-v1.json` repeats the existing `PER-002 -> PER-001` edge and must be a no-op that retains original redirect metadata.
- `manifests/intentionally-conflicting-remap-v1.json` is not approved. It attempts to remap `PER-002` and must fail without a write.

## Scenario Coverage

| Scenario | Evidence |
| --- | --- |
| Duplicate proposal | `PER-004 -> PER-001` |
| Intentional consolidation | `PER-005 -> PER-001` |
| Replacement | `PER-006 -> PER-007` |
| One-hop history | `PER-002 -> PER-001` |
| Multi-hop history | `PER-003 -> PER-002 -> PER-001` |
| Winner later superseded | `PER-002` was the immediate winner for `PER-003` and later points to `PER-001` |
| Identical replay | approved existing-replay manifest; the main approved manifest may also be replayed after its first apply |
| Conflicting remap | intentionally conflicting manifest maps `PER-002` to `PER-007` |
| Ambiguous lookalikes | `PER-008` and `PER-009` remain active and unmapped |
| Exact approved alias | `EXT-002` normalizes `  Procurement   Lead  ` and references `PER-001` |
| Exact `persona-v1` identity | `EXT-003` references `PER-001` |
| Repeated extraction | `EXT-002` and `EXT-003` reuse `PER-001` without minting |
| Deliberate update outcome | `EXT-004` records the reviewed alias update separately |
| Event-time provenance | `EXT-001.minted` continues to name `PER-004` after later consolidation |
| Unknown-field preservation | `PER-004.x_preserve` and other `x_*` objects must survive mutation |

## Safe Rehearsal Order

1. Copy `root/` to a disposable directory and record its checksum identity.
2. Invoke a staged `buildos` binary by explicit path. Validate the copy in compatibility mode, then strict mode.
3. Dry-run `approved-persona-consolidations-v1.json` and review the exact three planned persona changes.
4. Apply that manifest only to the disposable copy, rebuild/check the index, and resolve representative IDs.
5. Replay the same manifest and confirm it reports only no-ops.
6. Run the intentionally conflicting manifest and confirm it fails without changing any hash.
7. Restore a fresh copy from the untouched baseline and compare hashes with `review/checksums.txt`.

Never run these fixture manifests against a live root. No manifest, proposal, confidence value, or repository test grants deployment or live-data approval.
