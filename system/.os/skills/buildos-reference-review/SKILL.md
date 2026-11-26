---
name: buildos-reference-review
description: Review converted twins and the Build OS references index for usable extraction sources, missing files, stale entries, duplicates, zero-byte outputs, and unsupported material.
---

# Build OS Reference Review

Use this skill after intake conversion or before extraction planning.

## Inputs

- One converted twin path,
- a reference ID such as `REF-012`,
- `.os/indexes/references.json`,
- or a batch of sources/converted twins.

## Workflow

1. Read `.os/AGENTS.md` and the reference/index router if present.
2. Load `.os/indexes/references.json`. It exists only after intake has rebuilt the references index. If it is missing, or it lists no references, no source is converted yet: route to `buildos-intake-convert` and stop.
3. For each reference in scope, check:
   - converted file exists,
   - file is non-empty,
   - source path is recorded,
   - type/converter/status are present,
   - duplicate source or converted paths,
   - whether the twin is suitable for extraction evidence.
4. Classify each reference as:
   - usable,
   - usable with caveat,
   - stale/missing,
   - duplicate,
   - blocked/manual review needed.
5. Report recommended next skill:
   - `buildos-extraction-plan` for usable twins,
   - `buildos-intake-convert` for missing/stale/blocked twins.

## Stop conditions

Stop after reporting reference health and extraction readiness.
Do not write rows or modify converted twins unless the user explicitly starts an intake repair workflow.
