# Toolkits Router

`toolkits/` holds the source of the first-party deterministic BuildOS CLI: one npm package, `@brucewaynedecoy/buildos`, in `toolkits/buildos/`.

## Routing

- For any CLI change, read [`buildos/AGENTS.md`](./buildos/AGENTS.md) and its README first.
- For a new CLI domain, confirm its product ownership first, then add it as a `buildos <domain>` command inside `toolkits/buildos/`. Do not create another public executable or package.
- For deterministic script wrappers, command routers, compatibility shims, or command documentation, work under `system/.os/scripts/`.
- Do not place release archives, runtime output, converted source twins, or workspace artifacts in `toolkits/`.

## Standards

- Implementation: TypeScript with `strict` on, ESM, bundled by esbuild, for Node.js 24 or newer (PRD 20 Runtime and Package).
- Public command naming: `buildos <domain> <operation>`. The legacy names `buildos-intake`, `buildos-discovery`, and `buildos-design` work until `0.3.0`.
- Runtime posture: local-only unless a design explicitly approves network or service calls and the CLI requires opt-in flags.
- Dependency posture: Node built-ins first. An outside package follows PRD 20 Supply Chain and is recorded in `toolkits/buildos/SECURITY.md`.
- The earlier Go toolkits were removed in W1 R7 P8; their output is the frozen parity baseline in `toolkits/buildos/test/golden/`.

## References

- [Toolkit root README](./README.md)
- [20 BuildOS CLI and Distribution](../docs/prd/20-buildos-cli-and-distribution.md)
- [02 Architecture Overview: Module Map](../docs/prd/02-architecture-overview.md#module-map)
- [BuildOS Node and TypeScript CLI rewrite design](../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)
