# Baseline Validation

## Scope

- Environment: `sanitized-fixture`
- Root: `root/`
- Canonical datasets: all eight governed `.os/data/*.jsonl` files
- Existing derived index: `root/.os/indexes/entity-resolution.json`
- Canonical writes during audit: none

## Expected Baseline

- Compatibility validation succeeds without graph errors.
- Strict validation succeeds.
- `PER-002` resolves in one hop to `PER-001`.
- `PER-003` resolves through `PER-002` to `PER-001`.
- A derived-index check is byte-identical to the checked-in fixture index.
- The approved consolidation manifest plans three persona-row changes and writes nothing unless `--apply` is explicit.
- The approved replay manifest plans an idempotent no-op.
- The intentionally conflicting remap fails without writing.

The P3 copied-root rehearsal records concrete command output, a staged binary checksum, and snapshot identity separately. This file describes the version-controlled baseline and does not pretend that a repository fixture is a live installation.

## Fixture Authoring Verification

The source-built development CLI verified this checked-in baseline on 2026-07-21:

- Compatibility validation: valid, 19 records, no diagnostics.
- Strict validation: valid, 19 records, no diagnostics.
- Derived index: current and reproducible; SHA-256 `941c43d958ae76c8aa3b5b6775883675dc230f8776c806ee4a9afcb49c5061e9`.
- Main approved dry run: three mappings, three changes, one affected file (`personas.jsonl`), no write.
- Existing-edge replay dry run: one mapping, zero changes, one no-op, no write.
- Conflicting-remap dry run: `redirect_remap_conflict`, zero changes, no write.

These checks establish fixture correctness only. They do not replace the explicit staged-binary copied-root evidence required by P3.
