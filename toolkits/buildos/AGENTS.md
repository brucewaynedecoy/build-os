# Unified BuildOS CLI Router

This module builds the source-only W1 R4 `buildos` CLI seed. It owns shared CLI behavior, root layout, and the entity domain. Intake, discovery, and design remain in their existing modules until W1 R5.

## Routing

- `cmd/buildos/` is the executable entry point. Keep it thin and delegate domain behavior.
- `internal/cli/` owns parsing, shared output envelopes, diagnostics, version metadata, and exit-code mapping.
- `internal/layout/` owns explicit BuildOS root resolution. Never infer a root from the current working directory.
- `internal/entities/` owns entity graph loading, validation, resolution, consolidation, and the derived entity-resolution index.
- `pkg/entities/` is a temporary W1 R4 facade for existing Go modules. Do not add unrelated public APIs; W1 R5 removes this package after domain migration.

## Constraints

- Build one public executable named `buildos`; do not add a `buildos-entities` executable.
- Preserve unknown JSONL fields whenever a canonical row changes.
- Keep mutations dry-run by default and require explicit `--apply`.
- Use same-filesystem temporary files and atomic replacement for canonical JSONL writes.
- Generate `.os/indexes/entity-resolution.json` only from canonical JSONL data.
- Return typed results and errors from domain code. Only the CLI layer formats process output.
- Use Go standard-library dependencies unless an approved design explicitly changes that posture.
- Do not migrate intake, discovery, or design code into this module during W1 R4.

## Validation

From the repository root:

```sh
just test-buildos
just build-buildos
toolkits/buildos/bin/buildos help
toolkits/buildos/bin/buildos version
```

Use copied or temporary BuildOS roots for entity mutation tests. Never point tests at live adopter data.

## Authorities

- [`system/.os/contracts/entity-consolidation-contract.md`](../../system/.os/contracts/entity-consolidation-contract.md)
- [`system/.os/contracts/entity-records-contract.md`](../../system/.os/contracts/entity-records-contract.md)
- [`docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md`](../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [`docs/prd/18-revise-unified-buildos-cli-and-distribution.md`](../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md)
