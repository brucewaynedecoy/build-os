# System Assets Router

`assets/` stores Build OS source-adjacent artifacts such as converted-source twins and side artifacts produced during intake.

This tree is separate from make-docs-owned asset trees:

- `docs/assets/`
- `docs/assets/`

## Routing

- Before writing converted-source twins, read [`../.os/contracts/converted-source-contract.md`](../.os/contracts/converted-source-contract.md) and [`../.os/contracts/intake-translation-contract.md`](../.os/contracts/intake-translation-contract.md).
- Use `assets/<source-slug>/<asset-slug>.<ext>` for converted twins.
- Keep side artifacts such as copied images, chart images, SVG diagrams, or Mermaid sidecars under the same `assets/<source-slug>/` directory, usually below `media/`, `charts/`, or `diagrams/`.
- Do not create extracted entity records, findings, load plans, or run records in this tree.
- Rebuild `.os/indexes/references.json` after converted-source twins change.

## Commands

Use the BuildOS CLI:

```sh
.os/scripts/buildos intake convert --source <path>
.os/scripts/buildos intake index references
```

Run the commands from the project root through the wrapper [`../.os/scripts/buildos`](../.os/scripts/buildos) (`.os\scripts\buildos.cmd` on Windows), which runs the BuildOS version that the project pins.
