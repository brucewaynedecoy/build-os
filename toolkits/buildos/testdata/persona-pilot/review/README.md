# Persona Pilot Review Artifacts

This directory is proposal-only audit evidence for a wholly synthetic BuildOS root. Reading these files must not change `root/`, lifecycle state, redirects, references, indexes, or installed tools.

## Review Status

- `consolidation-proposals.json` follows `buildos-entity-consolidation-proposal/v1` and contains three explicitly approved proposals plus one `needs_review` group with no winner or loser mapping.
- `../manifests/approved-persona-consolidations-v1.json` is the only manifest that introduces new redirects during the main rehearsal.
- `../manifests/approved-existing-replay-v1.json` is approved only as an idempotence check; it repeats an already canonical immediate edge.
- `../manifests/intentionally-conflicting-remap-v1.json` is unsafe negative-test input. It is not approved and must return a non-writing remap conflict.
- `PER-008` and `PER-009` are ambiguous lookalikes. They remain active, separate, and absent from every approved mapping.

## Intentionally Conflicting Input

The conflicting manifest maps `PER-002` to `PER-007`, while the canonical baseline already maps `PER-002` to `PER-001`. It exists only to prove fail-closed behavior.

## Sanitization Boundary

All names, evidence, timestamps, identifiers, and paths are synthetic. Relative fixture paths replace machine and adopter paths. Markers in `upgrade-handoff.md` identify evidence that a real rehearsal operator must record independently.
