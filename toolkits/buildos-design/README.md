# buildos-design

`buildos-design` is the first-party Build OS toolkit for promoting qualified findings into user-gated design documents. It starts the evidence-backed design to plan path without losing the originating run and qualification lineage.

In this development repository the default paths live under `system/`, such as `system/.os/data/findings.jsonl`, `system/workspace/findings/`, and `system/docs/designs/`. In an installed Build OS system root, where `.os/`, `assets/`, `docs/`, `playbooks/`, and `workspace/` are copied to the root, the same defaults automatically target top-level `.os/data/findings.jsonl`, `workspace/findings/`, and `docs/designs/`.

## Command Surface

```sh
buildos-design promote finding --finding-id <FIND-NNN> --route baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root .] [--dry-run]
```

Use the wrapper at `system/.os/scripts/buildos-design` when operating through the Build OS script surface.

`promote finding` requires one `status: "qualified"` row in `system/.os/data/findings.jsonl`, a matching `system/workspace/findings/<FIND-NNN>/finding.md` artifact, the system design router, the design workflow, the design contract, the design template, and the route-specific next prompt.

The command writes one dated design under `system/docs/designs/`, then records the design path in the source finding's `designs` list and `findings.jsonl` row. It does not draft plans, PRD deltas, work packets, or docs closeout records.

## Contracts

- Finding lifecycle: [`system/.os/contracts/finding-contract.md`](../../system/.os/contracts/finding-contract.md)
- System design router: [`system/docs/designs/AGENTS.md`](../../system/docs/designs/AGENTS.md)
- Design contract: [`system/docs/assets/references/design-contract.md`](../../system/docs/assets/references/design-contract.md)
- Toolkit ownership: [`docs/prd/16-revise-toolkit-ownership-boundaries.md`](../../docs/prd/16-revise-toolkit-ownership-boundaries.md)

## Dependencies

Default posture remains standard library first. This toolkit has no third-party runtime dependencies.

No third-party or native dependency should be added without updating this README with rationale, license notes, and packaging review notes.

## Build and Test

From this directory:

```sh
go test ./...
go build ./...
```

Build a local runnable binary for the script wrapper:

```sh
mkdir -p bin
go build -o bin/buildos-design ./cmd/buildos-design
```

## References

- [Toolkit router](../AGENTS.md)
- [Build OS Toolkit CLI Development](../../docs/guides/developer/buildos-toolkit-cli-development.md)
- [Finding Contract](../../system/.os/contracts/finding-contract.md)
- [PRD 16 Toolkit Ownership Boundaries](../../docs/prd/16-revise-toolkit-ownership-boundaries.md)
