# System Assets Router

`system/assets/` stores Build OS source-adjacent artifacts such as converted-source twins and side artifacts produced during intake.

This tree is separate from make-docs-owned asset trees:

- `docs/assets/`
- `system/docs/assets/`

## Routing

- Before writing converted-source twins, read [`../.os/contracts/converted-source-contract.md`](../.os/contracts/converted-source-contract.md) and [`../.os/contracts/intake-translation-contract.md`](../.os/contracts/intake-translation-contract.md).
- Use `system/assets/<source-slug>/<asset-slug>.<ext>` for converted twins.
- Keep side artifacts such as copied images, chart images, SVG diagrams, or Mermaid sidecars under the same `system/assets/<source-slug>/` directory, usually below `media/`, `charts/`, or `diagrams/`.
- Do not create extracted entity records, findings, load plans, or run records in this tree.
- Rebuild `system/.os/indexes/references.json` after converted-source twins change.

## Commands

Use the packaged toolkit when available:

```sh
buildos-intake convert --source <path>
buildos-intake index references
```

The wrapper at [`../.os/scripts/buildos-intake`](../.os/scripts/buildos-intake) may be used when operators want to route through the operating-layer script surface.
