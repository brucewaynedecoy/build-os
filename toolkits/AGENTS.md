# Toolkits Router

`toolkits/` contains source and build metadata for first-party deterministic Build OS CLI toolkits.

## Routing

- For a new toolkit, create `toolkits/<toolkit-slug>/` with `README.md`, `AGENTS.md`, and `CLAUDE.md`.
- For an existing toolkit, read its local `AGENTS.md` before changing files.
- For deterministic script wrappers, command routers, compatibility shims, or command documentation, work under `system/.os/scripts/`.
- Do not place generated binaries, release archives, runtime output, converted source twins, or workspace artifacts in `toolkits/`.

## Standards

- Default implementation language: Go.
- Binary naming: `buildos-<toolkit-slug>`.
- Runtime posture: local-only unless a design explicitly approves network or service calls and the CLI requires opt-in flags.
- Dependency posture: Go standard library first. Third-party or native dependencies require README rationale, license notes, and packaging review notes.
- Existing unmanaged scripts may remain until an explicit conversion phase ports them.

## References

- [Toolkit root README](./README.md)
- [Build OS Toolkit CLI Development](../docs/guides/developer/buildos-toolkit-cli-development.md)
- [PRD 14 deterministic toolkit deployment revision](../docs/prd/14-revise-deterministic-toolkit-deployment.md)
- [Toolkit CLI deployment standard design](../docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
