# Build OS Toolkits

`toolkits/` holds the source of the first-party deterministic BuildOS CLI: the npm package `build-os` in [`buildos/`](./buildos/). It gives one `buildos` command with `buildos <domain>` subcommands, one help, version, root, diagnostic, and distribution surface.

`system/.os/scripts/` remains the operational wrapper, command router, compatibility, and command documentation surface. Its wrappers find BuildOS on `PATH`, or run `npx -y build-os@<version>` with the version pinned in `.os/manifest.json`.

## Standards

| Area | Default |
| --- | --- |
| Implementation language | TypeScript (strict, ESM), bundled by esbuild |
| Runtime | Node.js 24 or newer |
| Dependency posture | Node built-ins first; no runtime `dependencies` |
| Runtime posture | Local-only |
| Public command naming | `buildos <domain> <operation>` |
| Legacy names | `buildos-intake`, `buildos-discovery`, `buildos-design`, until `0.3.0` |
| Network calls | Disallowed unless a design approves them and the CLI requires opt-in flags |

Every outside package is listed in [`buildos/SECURITY.md`](./buildos/SECURITY.md) with its version, license, reason, and scan status.

## History

The separate Go toolkits (`buildos-intake`, `buildos-discovery`, `buildos-design`) and the Go `buildos` seed were removed in W1 R7 P8, after the TypeScript port passed every parity gate on three operating systems. Git history keeps them; [`buildos/test/golden/CAPTURE.md`](./buildos/test/golden/CAPTURE.md) names the frozen baseline commit and how to recover them.

## Development Flow

1. Read [AGENTS.md](./AGENTS.md) and [`buildos/AGENTS.md`](./buildos/AGENTS.md).
2. Confirm the owning PRD or design before changing command behavior.
3. Keep toolkit logic local, deterministic, and testable.
4. Keep `system/.os/scripts/` wrappers thin.
5. From the repository root: `just build-buildos` and `just test-buildos`.
