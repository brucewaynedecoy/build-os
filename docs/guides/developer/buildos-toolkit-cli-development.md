---
title: "Build OS Toolkit CLI Development"
path: "buildos/toolkit/cli"
status: draft
version: "2026-06-04"
order: 100
tags:
  - toolkits
  - cli
  - deterministic-execution
applies-to:
  - toolkits
  - buildos
related:
  - "../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md"
  - "../../designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md"
  - "../../prd/14-revise-deterministic-toolkit-deployment.md"
  - "../../../toolkits/README.md"
---

# Build OS Toolkit CLI Development

## Overview

Use this guide when creating a new first-party deterministic toolkit, revising an existing toolkit, or converting unmanaged deterministic scripts into packaged Build OS CLI tooling.

Coverage outcome: `developer`.
This topic is maintainer-facing because it defines source layout, dependency posture, local execution, packaging expectations, script-wrapper boundaries, validation, and agent handoff rules.
User-guide outcome: `none` for this phase because no end-user `buildos-*` command has shipped yet.

## Project Orientation

- [../../../toolkits/](../../../toolkits/) is the source home for first-party deterministic CLI toolkits.
- [../../../toolkits/AGENTS.md](../../../toolkits/AGENTS.md) is the top router for toolkit work.
- Each toolkit directory should include a local `README.md`, `AGENTS.md`, and `CLAUDE.md`.
- `system/.os/scripts/` remains the operational wrapper, command router, compatibility, and command documentation surface.
- Durable deterministic logic should move into packaged `buildos-*` binaries instead of accumulating in unmanaged Python, Node, or shell scripts.
- Existing scripts may remain until a later phase explicitly ports them. Do not port `system/.os/scripts/validate_config.py` as part of the intake toolkit scaffold.

## Toolkit Defaults

| Decision | Default |
| --- | --- |
| Implementation language | Go |
| Dependency posture | Standard library first |
| Runtime posture | Local-only |
| Binary name | `buildos-<toolkit-slug>` |
| Script role | Thin wrapper, router, compatibility shim, or command documentation |
| Network calls | Disallowed unless a design approves them and the CLI requires opt-in flags |

Third-party packages, native dependencies, generated parsers, service SDKs, or external conversion engines require explicit rationale in the toolkit README.
That rationale should include why the dependency is necessary, license notes, packaging implications, expected update cadence, and any enterprise review concerns.

## Create a New Toolkit

1. Create `toolkits/<toolkit-slug>/`.
2. Name the compiled binary `buildos-<toolkit-slug>`.
3. Add a local `README.md` that states purpose, command surface, dependency posture, local-only posture, build instructions, validation, packaging notes, and known future work.
4. Add a thin `AGENTS.md` router that points contributors to the local README, owning PRD or design, and relevant operating-layer contracts.
5. Add `CLAUDE.md` as a pointer to the local `AGENTS.md`.
6. Prefer a small Go module rooted in the toolkit directory. Keep command parsing explicit and predictable.
7. Add tests close to the toolkit source once behavior exists.
8. Add script wrappers only when they improve compatibility or discoverability from `system/.os/scripts/`.
9. Update PRDs, designs, guides, or work backlogs only when the toolkit changes a durable contract or source-of-truth boundary.

## Enhance an Existing Toolkit

1. Read the toolkit's local `AGENTS.md` and README first.
2. Confirm the owning command surface and compatibility promises.
3. Keep behavior deterministic, local, and reproducible.
4. Prefer additive subcommands or flags over changing existing command semantics.
5. If a dependency becomes necessary, update the toolkit README before landing code.
6. Keep wrappers thin. A wrapper should not duplicate toolkit logic.
7. Run toolkit tests, repository validators, and `git diff --check`.

## Convert an Existing Script

1. Identify whether the script is durable logic, a temporary validator, a compatibility wrapper, or command documentation.
2. If it is durable deterministic logic, create or select a toolkit directory under `toolkits/`.
3. Port the behavior into the toolkit while preserving input and output contracts.
4. Keep the old script only as a wrapper when existing workflows still call it.
5. Make the wrapper call the packaged binary and keep any compatibility mapping obvious.
6. Update documentation to name the toolkit binary as the implementation surface.
7. Record any intentionally unported behavior as future work in the toolkit README or owning backlog.

## Parallel Agent Workflow

For larger toolkit work, use a coordinator plus focused workers:

- Coordinator: owns PRD/design reconciliation, command naming, integration, validation, and final diff review.
- Contract worker: reviews affected `.os/contracts/`, PRDs, and guides for source-of-truth changes.
- Toolkit worker: implements or revises the Go CLI and local tests.
- Wrapper worker: updates `system/.os/scripts/` wrappers or command docs after the toolkit command shape is stable.
- Packaging worker: checks dependency posture, license notes, binary naming, and future installer implications.
- Review worker: checks for boundary violations, especially edits under make-docs-owned assets or generated outputs.

Do not parallelize work that depends on an unsettled command contract.
For example, wrappers should wait until the toolkit worker and coordinator agree on subcommands, flags, exit codes, and output paths.

## Validation

Run repository validation after toolkit documentation or scaffold changes:

```sh
python3 system/.os/scripts/validate_config.py --self-test
python3 system/.os/scripts/validate_config.py
python3 .make-docs/scripts/check_path_hygiene.py --self-test
python3 .make-docs/scripts/check_path_hygiene.py --repo-root . --manifest .make-docs/manifest.json
git diff --check
```

When toolkit code exists, also run the toolkit's Go tests and build checks from its directory:

```sh
go test ./...
go build ./...
```

After edits, refresh the project documentation and code indexes when the jdocmunch and jcodemunch MCP servers are available.

## Troubleshooting

If a wrapper starts doing parsing, conversion, indexing, or validation logic, move that logic into the toolkit and leave the script as a call-through.

If a toolkit needs network access, stop and write or update a design first.
The design must state why local processing is insufficient, what opt-in flags enable the behavior, what data leaves the machine, and how failures are reported.

If a dependency is attractive but optional, prefer a standard-library implementation until the dependency materially improves correctness, supportability, or packaging risk.

If enterprise distribution concerns block a rollout, track them against R-003 in [03 Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md) instead of hiding them inside a toolkit README.

## Related Resources

- [Toolkit CLI deployment standard design](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
- [make-docs import strategy design](../../designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md)
- [PRD 14 deterministic toolkit deployment revision](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [Toolkits root README](../../../toolkits/README.md)
- [Toolkits router](../../../toolkits/AGENTS.md)

## Future Coverage

- Blocked by: W1 R0 P3 intake/conversion toolkit implementation.
  Update when: `buildos-intake` has real commands, tests, and build metadata.
  Guide change: Add concrete command examples, exit-code rules, build/install steps, wrapper examples, and troubleshooting for conversion and index rebuild failures.
- Blocked by: Enterprise installer and release hardening.
  Update when: signing, checksums, SBOM generation, installer behavior, and package distribution are approved.
  Guide change: Add release packaging and enterprise deployment procedures.
