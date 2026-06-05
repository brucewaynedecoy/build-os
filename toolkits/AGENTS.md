# Toolkits Router

`toolkits/` contains source and build metadata for first-party deterministic Build OS CLI toolkits.

## Routing

- For a new toolkit, create `toolkits/<toolkit-slug>/` with `README.md`, `AGENTS.md`, and `CLAUDE.md`.
- For an existing toolkit, read its local `AGENTS.md` before changing files.
- For deterministic script wrappers, command routers, compatibility shims, or command documentation, work under `system/.os/scripts/`.
- Do not place release archives, runtime output, converted source twins, or workspace artifacts in `toolkits/`. Local `bin/buildos-*` binaries are allowed only when a phase explicitly requires the wrapper target to be present.
- Treat each toolkit README and local `AGENTS.md` as a scope contract. Do not add a command or deterministic capability to an existing toolkit unless that toolkit already owns the domain.
- If no existing toolkit owns the capability, create or plan a new domain-specific toolkit instead of expanding the nearest Go CLI.

## Standards

- Default implementation language: Go.
- Binary naming: `buildos-<toolkit-slug>`.
- Runtime posture: local-only unless a design explicitly approves network or service calls and the CLI requires opt-in flags.
- Dependency posture: Go standard library first. Third-party or native dependencies require README rationale, license notes, and packaging review notes.
- Existing unmanaged scripts may remain until an explicit conversion phase ports them.
- Do not add new durable domains to unmanaged scripts while waiting for that port.

## References

- [Toolkit root README](./README.md)
- [Build OS Toolkit CLI Development](../docs/guides/developer/buildos-toolkit-cli-development.md)
- [PRD 14 deterministic toolkit deployment revision](../docs/prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16 toolkit ownership boundary revision](../docs/prd/16-revise-toolkit-ownership-boundaries.md)
- [Toolkit CLI deployment standard design](../docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
