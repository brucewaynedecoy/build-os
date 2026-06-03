# Scripts Router (`.os/scripts`)

Deterministic system processes live here. Scripts should read the relevant contract before
validating or generating artifacts, and they should report precise file paths and field paths for
operator action.

## Scripts

- [`validate_config.py`](validate_config.py) — validates `config/instance.yaml` against
  [`../contracts/config-contract.md`](../contracts/config-contract.md) and checks scoped Markdown
  frontmatter hygiene for playbooks and playbook templates.

## Use

Run from the repository root:

```sh
python3 system/.os/scripts/validate_config.py
```

Use `--self-test` to run the built-in invalid-config fixtures.
