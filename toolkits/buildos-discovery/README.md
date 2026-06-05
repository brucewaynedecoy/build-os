# buildos-discovery

`buildos-discovery` is the first-party Build OS discovery-run and finding-qualification toolkit. It records immutable run artifacts under `system/workspace/runs/`, keeps raw findings anchored inside the source run, and promotes only deterministically confirmed observations into `system/workspace/findings/`.

## Command Surface

```sh
buildos-discovery run discovery --playbook-id <PB-NNN> --outcome positive|negative|inconclusive [--title <text>] [--target <ID>] [--dataset-ref <path>] [--evidence <path>] [--raw-finding <path>] [--repo-root .] [--dry-run]
buildos-discovery qualify finding --run-id <RUN-NNN> --raw-finding-ref <path#anchor> --outcome positive|negative [--title <text>] --confirmation-test <path> --confirmation-evidence <path> [--repo-root .] [--dry-run]
```

Use the wrapper at `system/.os/scripts/buildos-discovery` when operating through the Build OS script surface.

`run discovery` requires an active `category: discovery` playbook from `system/.os/indexes/playbooks.json`, allocates the next `RUN-NNN`, copies evidence, writes `run.md` and `raw-findings.md`, and appends one `type: "run"` row to `system/.os/data/runs.jsonl`.

`qualify finding` requires an existing run, a raw-finding anchor, a Playwright confirmation test file, confirmation evidence, and a positive or negative outcome before allocating `FIND-NNN`, writing finding artifacts, and appending one `status: "qualified"` row to `system/.os/data/findings.jsonl`.

Raw findings do not receive `FIND` IDs. Negative findings qualify only when a deterministic confirmation test asserts the negative condition and passes.

## Contracts

- Run records: [`system/.os/contracts/run-record-contract.md`](../../system/.os/contracts/run-record-contract.md)
- Findings: [`system/.os/contracts/finding-contract.md`](../../system/.os/contracts/finding-contract.md)
- Playbook catalog inputs: [`system/.os/contracts/playbook-contract.md`](../../system/.os/contracts/playbook-contract.md)
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
go build -o bin/buildos-discovery ./cmd/buildos-discovery
```

## References

- [Toolkit router](../AGENTS.md)
- [Build OS Toolkit CLI Development](../../docs/guides/developer/buildos-toolkit-cli-development.md)
- [PRD 10 Discovery, Runs and Qualification](../../docs/prd/10-discovery-runs-and-qualification.md)
- [PRD 16 Toolkit Ownership Boundaries](../../docs/prd/16-revise-toolkit-ownership-boundaries.md)
