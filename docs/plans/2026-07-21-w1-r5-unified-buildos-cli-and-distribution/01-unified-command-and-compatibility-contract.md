# R5 P1 - Unified Command and Compatibility Contract

## Purpose

Freeze the interfaces that every migrated domain and release artifact must share before parallel migration begins.

## Dependency Position

- Starts after W1 R4 closeout proves the `buildos` seed and entity command.
- Blocks all domain migration, alias migration, and release packaging.
- No existing domain implementation is deleted in this phase.

## Scope

- Audit current intake, discovery, design, and entity commands, flags, stdout, stderr, and exit behavior.
- Freeze canonical command mappings and global `--root`, `--json`, help, and version behavior.
- Define the stable JSON envelope, typed diagnostics, exit-code policy, and domain result interfaces.
- Harden shared CLI, layout, version, and diagnostic packages created by W1 R4.
- Define legacy basename detection, argument translation, stderr deprecation text, and the one-stable-minor-cycle removal policy.
- Add Apache-2.0 licensing and release metadata required for distribution.

## Parallel Workstreams

After the command inventory is complete, these disjoint lanes can run concurrently:

| Lane | Deliverable | Integration dependency |
| ---- | ----------- | ---------------------- |
| CLI contract | Root parsing, help, global flags, command registry | Command inventory |
| Output contract | Human and JSON results, diagnostics, exit codes | Command inventory |
| Version and licensing | Build metadata, `dev` fallback, Apache-2.0 files and notices | None after phase start |
| Compatibility contract | Basename mappings, deprecation wording, removal release rules | Canonical command mapping |
| Fixture capture | Golden behavior for all existing commands | Current modules remain unchanged |

The shared interfaces are integrated and frozen only after all lane tests agree on the same command and error model.

## Deliverables

- Shared command and result interfaces under `toolkits/buildos/internal/`.
- A single exit-code table and JSON-envelope schema exercised by tests.
- Version injection and development fallback behavior.
- A complete legacy-to-canonical command map.
- License and release metadata suitable for the future `0.1.0` package.
- Parity fixtures that P2 uses as deletion gates.

## Validation

- `buildos help` and `buildos version` are stable in human and JSON modes.
- Every registered command reports version, source revision, resolved root when applicable, mode when applicable, and write status.
- Usage, validation, conflict, and internal errors map consistently to documented exit codes.
- Deprecation guidance is stderr-only and cannot corrupt stdout or JSON payloads.
- Source builds report `dev` and `unknown` without injected metadata.
- No new public binary name is created.

## Exit Gate

P2 may start only when the shared interfaces are reviewed, the parity fixture catalog is complete, and affected maintainer and user documentation records current behavior without claiming migration is finished.
