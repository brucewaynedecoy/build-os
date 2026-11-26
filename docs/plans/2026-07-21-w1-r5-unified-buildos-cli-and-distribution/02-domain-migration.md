# R5 P2 - Domain Migration

## Purpose

Move intake, discovery, design, and entities into isolated packages inside the unified module while preserving behavior and removing temporary cross-module coupling.

## Dependency Position

- Requires the frozen P1 command, output, diagnostic, layout, and version interfaces.
- Domain lanes may proceed in parallel because they own disjoint packages.
- Old module code remains available until its domain parity gate passes.
- Blocks compatibility installation migration.

## Scope

- Move intake behavior to `toolkits/buildos/internal/intake/`.
- Move discovery behavior to `toolkits/buildos/internal/discovery/`.
- Move design behavior to `toolkits/buildos/internal/design/`.
- Internalize W1 R4 entity behavior at `toolkits/buildos/internal/entities/`.
- Register canonical routes for each domain in the shared command tree.
- Replace cross-domain imports with Go interfaces inside the unified module.
- Remove the temporary `pkg/entities` export and local module replacement directives only after all consumers migrate.

## Parallel Workstreams

| Lane | Owned package | Required proof |
| ---- | ------------- | -------------- |
| Intake migration | `internal/intake` | Convert and reference/playbook index parity |
| Discovery migration | `internal/discovery` | Run, qualify, root, and failure parity |
| Design migration | `internal/design` | Promotion, provenance, and failure parity |
| Entity migration | `internal/entities` | Resolver, validator, consolidation, and index parity |
| Integration validation | Command registry and cross-domain interfaces | End-to-end canonical reference behavior |

Each domain lane can copy and adapt its implementation independently after P1. The integration lane begins when two or more migrated domains are ready, but old-module deletion remains serial and domain-by-domain.

## Canonical Command Map

```text
buildos intake convert
buildos intake index references
buildos intake index playbooks
buildos discovery run
buildos discovery qualify
buildos design promote
buildos entities resolve
buildos entities validate
buildos entities consolidate
buildos entities rebuild-index
```

## Deliverables

- One buildable Go module and `buildos` executable containing all four domains.
- Domain packages that do not format process output or invoke each other through subprocesses.
- Golden and integration parity tests against P1 fixtures.
- Removed duplicate implementations only where parity has passed.
- Removed temporary entity export and local replacements after the final consumer migration.

## Validation

- Canonical commands match required successful output, mutations, and exit behavior.
- Existing root and installed-root fixtures pass through the shared layout package.
- Entity resolution is used by migrated discovery and design behavior without graph duplication.
- No domain shells out to `buildos` or a legacy executable.
- `go test ./...` passes in the unified module and every not-yet-removed legacy module.
- A source-tree scan finds no stale local replacement after final internalization.

## Exit Gate

P3 may start only when all domain parity gates pass, the unified executable is the sole implementation target, and rollback artifacts or source references for the former binaries remain available.
