# Build OS Toolkits

`toolkits/` contains source and build metadata for first-party deterministic Build OS CLI toolkits. These toolkits are the durable implementation home for deterministic logic that should be packaged, installed, scanned, and invoked consistently.

`system/.os/scripts/` remains the operational wrapper, command router, compatibility, and command documentation surface. Scripts can call toolkit binaries, but new durable deterministic logic should not accumulate as unmanaged Python, Node, or shell implementations.

## Standards

| Area | Default |
| --- | --- |
| Implementation language | Go |
| Dependency posture | Standard library first |
| Runtime posture | Local-only |
| Binary naming | `buildos-<toolkit-slug>` |
| Network calls | Disallowed unless a design approves them and the CLI requires opt-in flags |

Any third-party or native dependency must be documented in the owning toolkit README with rationale, license notes, and packaging review notes.

## Current Toolkits

| Toolkit | Binary | Status | Purpose |
| --- | --- | --- | --- |
| [buildos-intake](./buildos-intake/) | `buildos-intake` | Initial implementation | Intake, conversion, and reference-index toolkit for W1 R0 P3 |
| [buildos-discovery](./buildos-discovery/) | `buildos-discovery` | Initial implementation | Discovery-run recording, raw-finding anchoring, and finding qualification toolkit for W1 R0 P6 |

## Development Flow

1. Read [AGENTS.md](./AGENTS.md).
2. Read the local toolkit `AGENTS.md` and README.
3. Confirm the owning PRD or design before changing command behavior.
4. Keep toolkit logic local, deterministic, and testable.
5. Keep `system/.os/scripts/` wrappers thin.
6. Run repository validation and toolkit tests before closeout.

See [Build OS Toolkit CLI Development](../docs/guides/developer/buildos-toolkit-cli-development.md) for the full maintainer workflow.
