# BuildOS CLI

`toolkits/buildos/` is the unified Go module that produces the `buildos` executable. W1 R4 seeds it with shared root/output behavior and the entity consolidation domain.

This is currently a source-build-only development surface. It is not yet a Homebrew package or signed release archive, and building it does not replace any installed `buildos-intake`, `buildos-discovery`, or `buildos-design` binary.

## Build and test

From the repository root:

```sh
just test-buildos
just build-buildos
```

The staged binary is written to `toolkits/buildos/bin/buildos`. Invoke that exact path during W1 R4 rehearsals:

```sh
toolkits/buildos/bin/buildos help
toolkits/buildos/bin/buildos version
```

Source builds report version `dev` and source revision `unknown` unless Go linker flags inject other values.

## Entity commands

Every entity command requires an explicit BuildOS system root: a directory that contains `.os/data/`.

```sh
toolkits/buildos/bin/buildos entities validate --root /path/to/system-root --mode compat
toolkits/buildos/bin/buildos entities resolve --root /path/to/system-root --mode strict --id PER-001
toolkits/buildos/bin/buildos entities consolidate --root /path/to/system-root --mode compat --manifest /path/to/reviewed-manifest.json
toolkits/buildos/bin/buildos entities rebuild-index --root /path/to/system-root --mode strict --check
```

`consolidate` and `rebuild-index` do not write unless `--apply` is present. Add `--json` for the stable automation envelope.

There is no `buildos-entities` executable. The temporary `pkg/entities` facade exists only so the separately built discovery and design modules can share the resolver until W1 R5 consolidates those domains into this module.

## Safety boundary

- Test against copied or temporary roots.
- Review consolidation output before adding `--apply`.
- Treat canonical JSONL as authority and the entity-resolution index as disposable derived data.
- If a canonical write succeeds but index rebuilding fails, preserve the canonical write and run the exact recovery command printed by the CLI.
- Do not use this source build to replace installed binaries or migrate live data without a separately reviewed procedure.
