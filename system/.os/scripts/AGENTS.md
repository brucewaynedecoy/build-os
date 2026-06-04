# Scripts Router (`.os/scripts`)

This directory is the operating-layer wrapper, command router, compatibility, and command documentation surface. Durable deterministic toolkit logic should live under root `toolkits/` and be invoked here only through thin wrappers.

## Scripts

- [`buildos-intake`](buildos-intake) — thin wrapper for the packaged `buildos-intake` toolkit.
- [`validate_config.py`](validate_config.py) — validates `config/instance.yaml` against [`../contracts/config-contract.md`](../contracts/config-contract.md) and checks scoped frontmatter hygiene for playbooks and playbook templates.

## Use

Run from the repository root:

```sh
python3 system/.os/scripts/validate_config.py
```

Use `--self-test` to run the built-in invalid-config fixtures.

For intake conversion and reference-index rebuilds:

```sh
system/.os/scripts/buildos-intake convert --source <path>
system/.os/scripts/buildos-intake index references
```

The wrapper must remain a call-through to the binary. Do not add converter, parser, or indexing logic to the wrapper.
