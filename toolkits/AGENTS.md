# Toolkits Router

`toolkits/` contains source and build metadata for the first-party deterministic BuildOS CLI.
BuildOS is converging on one public `buildos` executable while preserving narrow domain packages and subcommands.

## Routing

- For a new CLI domain, confirm its product ownership first, then add it to the unified module under `toolkits/buildos/` using the module's local routing instructions.
- For an existing toolkit or domain, read its local `AGENTS.md` and README before changing files.
- For deterministic script wrappers, command routers, compatibility shims, or command documentation, work under `system/.os/scripts/`.
- Do not place release archives, runtime output, converted source twins, or workspace artifacts in `toolkits/`. Local `bin/buildos` or temporary legacy binaries are allowed only when a phase explicitly requires a wrapper target to be present.
- Treat each toolkit README and local `AGENTS.md` as a scope contract. Do not add a command or deterministic capability to an existing toolkit unless that toolkit already owns the domain.
- If no existing domain owns the capability, design or plan a new isolated package and `buildos <domain>` subcommand instead of expanding the nearest package or creating another public binary.
- The existing `buildos-intake`, `buildos-discovery`, and `buildos-design` modules and binaries remain current behavior until W1 R5 proves parity and migration. Do not move or remove them during W1 R4.

## Standards

- Default implementation language: Go.
- Public binary naming: `buildos`.
- Public command naming: `buildos <domain> <operation>`.
- Source-module target: one Go module at `toolkits/buildos/`, with coherent domain packages rather than separate public executables.
- Transitional exception: `buildos-intake`, `buildos-discovery`, and `buildos-design` remain separately runnable until W1 R5 replaces them with temporary aliases to the unified executable.
- Runtime posture: local-only unless a design explicitly approves network or service calls and the CLI requires opt-in flags.
- Dependency posture: Go standard library first. Third-party or native dependencies require README rationale, license notes, and packaging review notes.
- Existing unmanaged scripts may remain until an explicit conversion phase ports them.
- Do not add new durable domains to unmanaged scripts while waiting for that port.

## References

- [Toolkit root README](./README.md)
- [Build OS Toolkit CLI Development](../docs/guides/developer/buildos-toolkit-cli-development.md)
- [PRD 14 deterministic toolkit deployment revision](../docs/prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16 toolkit ownership boundary revision](../docs/prd/16-revise-toolkit-ownership-boundaries.md)
- [PRD 18 unified BuildOS CLI and distribution revision](../docs/prd/18-revise-unified-buildos-cli-and-distribution.md)
- [Toolkit CLI deployment standard design](../docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
- [Unified BuildOS CLI and distribution design](../docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md)
