# Build OS Toolkits

`toolkits/` contains source and build metadata for the first-party deterministic BuildOS CLI. BuildOS is converging on one public `buildos` executable with coherent domain packages and `buildos <domain>` subcommands. This keeps one help, version, root, diagnostic, and distribution surface without collapsing domain ownership.

`system/.os/scripts/` remains the operational wrapper, command router, compatibility, and command documentation surface. Scripts can call toolkit binaries, but new durable deterministic logic should not accumulate as unmanaged Python, Node, or shell implementations.

## Standards

| Area | Default |
| --- | --- |
| Implementation language | Go |
| Dependency posture | Standard library first |
| Runtime posture | Local-only |
| Public binary naming | `buildos` |
| Public command naming | `buildos <domain> <operation>` |
| Source-module target | `toolkits/buildos/` |
| Network calls | Disallowed unless a design approves them and the CLI requires opt-in flags |

Any third-party or native dependency must be documented in the owning toolkit README with rationale, license notes, and packaging review notes.

## Current Transition State

W1 R4 P2 seeds the unified module with the source-built `buildos entities` executable, graph resolver and validator, deterministic resolution index, and single-dataset reviewed consolidation writer. It is development tooling rather than a packaged installation. W1 R5 later migrates intake, discovery, and design after parity tests, then keeps their old names as temporary compatibility aliases for one stable minor-release cycle.

Build and test the seed from `toolkits/buildos/` with `go test ./...` and `go build ./cmd/buildos`. Invoke the resulting binary by explicit path against fixtures or a copied Build OS root. Do not replace an installed binary or mutate live adopter data as part of source-build validation.

The separately runnable modules below remain current behavior during W1 R4:

| Toolkit | Binary | Status | Purpose |
| --- | --- | --- | --- |
| [buildos-intake](./buildos-intake/) | `buildos-intake` | Initial implementation | Intake, conversion, and reference-index toolkit for W1 R0 P3 |
| [buildos-discovery](./buildos-discovery/) | `buildos-discovery` | Initial implementation | Discovery-run recording, raw-finding anchoring, and finding qualification toolkit for W1 R0 P6 |
| [buildos-design](./buildos-design/) | `buildos-design` | Initial implementation | Qualified-finding to design promotion toolkit for W1 R0 P7 |

The unified seed lives at [buildos](./buildos/). It emits only the `buildos` binary; no public entity-specific binary is built.

## Development Flow

1. Read [AGENTS.md](./AGENTS.md).
2. Read the local toolkit `AGENTS.md` and README.
3. Confirm the owning PRD or design before changing command behavior.
4. Keep toolkit logic local, deterministic, and testable.
5. Keep `system/.os/scripts/` wrappers thin.
6. Run repository validation and toolkit tests before closeout.

For a new domain, add or plan an isolated package and `buildos <domain>` subcommand inside the unified module. Do not create another public `buildos-<domain>` executable. The only planned legacy public names are temporary aliases for the three binaries that already shipped.

See [Build OS Toolkit CLI Development](../docs/assets/maintainer/buildos-toolkit-cli-development.md) for the full maintainer workflow.
