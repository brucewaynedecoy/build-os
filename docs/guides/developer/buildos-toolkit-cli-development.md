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
  - "../../prd/16-revise-toolkit-ownership-boundaries.md"
  - "../../../system/.os/contracts/converted-source-contract.md"
  - "../../../system/.os/contracts/intake-translation-contract.md"
  - "../../../system/.os/contracts/playbook-contract.md"
  - "../../../system/.os/contracts/run-record-contract.md"
  - "../../../system/.os/contracts/finding-contract.md"
  - "../../../system/.os/indexes/AGENTS.md"
  - "../../../system/playbooks/administrative/manual-intake-conversion.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md"
  - "../../assets/history/2026-06-04-w1-r0-p4-data-layer-extraction.md"
  - "../../assets/history/2026-06-04-w1-r0-p5-playbooks.md"
  - "../../assets/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md"
  - "../../../toolkits/README.md"
  - "../../../toolkits/buildos-intake/README.md"
  - "../../../toolkits/buildos-discovery/README.md"
---

# Build OS Toolkit CLI Development

## Overview

Use this guide when creating a new first-party deterministic toolkit, revising an existing toolkit, or converting unmanaged deterministic scripts into packaged Build OS CLI tooling.

Coverage outcome: `developer`. This topic is maintainer-facing because it defines source layout, dependency posture, local execution, packaging expectations, script-wrapper boundaries, validation, and agent handoff rules. User-guide outcome: `none` for system docs guides in this phase. `buildos-intake` is an operating toolkit, and fallback operator guidance lives in `system/playbooks/administrative/manual-intake-conversion.md` instead of `system/docs/guides/user/`.

## Project Orientation

- [../../../toolkits/README.md](../../../toolkits/README.md) is the source home overview for first-party deterministic CLI toolkits.
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

Third-party packages, native dependencies, generated parsers, service SDKs, or external conversion engines require explicit rationale in the toolkit README. That rationale should include why the dependency is necessary, license notes, packaging implications, expected update cadence, and any enterprise review concerns.

## Toolkit Ownership Guardrails

Toolkit ownership is a design boundary, not a convenience choice.

Before adding a command or deterministic behavior, identify the capability domain and confirm the target toolkit README and local `AGENTS.md` already own that domain. If they do not, create or plan a new domain-specific toolkit instead of expanding the nearest existing Go CLI.

Known ownership from the active PRD set:

| Toolkit | Ownership |
| --- | --- |
| `buildos-intake` | Source intake, conversion, converted twins, and the `references.json` derived catalog. |
| `buildos-config` | Planned home for instance config validation, scoped metadata/frontmatter hygiene, and the eventual `validate_config.py` migration. |
| `buildos-playbooks` | Candidate home for playbook catalog rebuilds, active-only playbook resolution, and playbook contract checks if those remain durable commands. |
| `buildos-extract` or `buildos-data` | Candidate home for extraction load-plan helpers, entity-row loaders, and deterministic `.os/data` hygiene beyond config-owned checks. |
| `buildos-discovery` | Implemented home for discovery-run recording, raw-finding anchoring, finding qualification, negative assertions, and run/finding-specific validation. |
| `buildos-flow` or `buildos-stage` | Candidate home for qualified-finding hand-off and stage-mover orchestration. |

Do not add discovery runs, finding qualification, Flow C hand-offs, stage movers, config validation, or entity-row validation to `buildos-intake` unless an explicit PRD/design revision changes its scope.

Do not add new durable domains to `system/.os/scripts/validate_config.py`. It is a legacy transitional script, not the long-term validation expansion point.

## buildos-intake Reference

`buildos-intake` is the first implemented toolkit and is the model for future deterministic toolkits.

```sh
buildos-intake convert --source <path>
buildos-intake index references
buildos-intake index playbooks
```

The operating-layer wrapper is:

```sh
system/.os/scripts/buildos-intake convert --source <path>
system/.os/scripts/buildos-intake index references
system/.os/scripts/buildos-intake index playbooks
```

P3 approved only two third-party Go dependencies for this toolkit: `golang.org/x/net/html` for HTML parsing and `github.com/ledongthuc/pdf` for rudimentary local PDF plain-text extraction. Do not add `pdftotext`, Poppler, OCR engines, external converter utilities, network calls, or service calls to the intake command surface without a new design and README packaging review.

Maintain intake behavior against the contracts, not only against command output:

- Converted twins must follow [converted-source-contract.md](../../../system/.os/contracts/converted-source-contract.md) for path, frontmatter, provenance, and status.
- Converted twin bodies and side artifacts must follow [intake-translation-contract.md](../../../system/.os/contracts/intake-translation-contract.md).
- `convert` currently supports CSV, DOCX, XLSX, HTML, HTML-directory sources, and minimal PDF text extraction. If a source type or output shape changes, update contracts, tests, and wrapper-facing documentation in the same change.
- `index references` scans converted twins under `system/assets/` and writes the derived `system/.os/indexes/references.json` catalog.
- `index playbooks` scans Markdown playbooks under `system/playbooks/`, skips documents without playbook frontmatter, requires the playbook contract fields, sorts entries by `id`, and writes the derived `system/.os/indexes/playbooks.json` catalog. The output keeps `playbooks` as the full lifecycle catalog and `runnable_playbooks` as the active-only subset.
- Keep side artifacts under the same `system/assets/<source-slug>/` directory as the converted twin. Use deterministic relative references from the converted body. Prefer `media/` for copied images and `diagrams/` for inline SVG or Mermaid artifacts.
- For HTML, preserve local and data-URI images when accessible, preserve inline SVG as `diagrams/*.svg`, and preserve Mermaid as `diagrams/*.mmd` plus fenced `mermaid` code in the Markdown body. Do not add diagram rendering to bitmap output unless a future design approves the renderer dependency.
- Treat PDF extraction as best-effort plain text. Do not imply OCR, layout fidelity, table reconstruction, embedded-image extraction, or a future rich-PDF roadmap.
- Keep manual and agent-assisted fallback aligned with [manual-intake-conversion.md](../../../system/playbooks/administrative/manual-intake-conversion.md) so hand-built converted twins look like automated ones.

## buildos-discovery Reference

`buildos-discovery` owns filesystem-first discovery runs and deterministic finding qualification.

```sh
buildos-discovery run discovery --playbook-id <PB-NNN> --outcome positive|negative|inconclusive
buildos-discovery qualify finding --run-id <RUN-NNN> --raw-finding-ref <path#anchor> --outcome positive|negative --confirmation-test <path> --confirmation-evidence <path>
```

The operating-layer wrapper is:

```sh
system/.os/scripts/buildos-discovery run discovery --playbook-id <PB-NNN> --outcome positive|negative|inconclusive
system/.os/scripts/buildos-discovery qualify finding --run-id <RUN-NNN> --raw-finding-ref <path#anchor> --outcome positive|negative --confirmation-test <path> --confirmation-evidence <path>
```

Maintain discovery behavior against [run-record-contract.md](../../../system/.os/contracts/run-record-contract.md) and [finding-contract.md](../../../system/.os/contracts/finding-contract.md). `run discovery` requires an active runnable `category: discovery` playbook from `system/.os/indexes/playbooks.json`; `qualify finding` requires an existing source run, a raw finding anchor, deterministic confirmation test evidence, and a positive or negative qualification outcome.

Keep raw findings inside the run artifact until qualification. Do not route run/finding commands through `buildos-intake`, and do not add run/finding-specific validation to `validate_config.py`.

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
7. Add or update focused regression tests for changed command parsing, path derivation, hashing, frontmatter, conversion shape, side-artifact handling, and index rebuild behavior.
8. Run toolkit tests, repository validators, and `git diff --check`.

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

Do not parallelize work that depends on an unsettled command contract. For example, wrappers should wait until the toolkit worker and coordinator agree on subcommands, flags, exit codes, and output paths.

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

After changing an index builder, regenerate the affected catalog from the real checkout and then run repository validation. For playbooks:

```sh
go run ./cmd/buildos-intake index playbooks --repo-root ../.. --playbooks-root system/playbooks --output system/.os/indexes/playbooks.json
python3 ../../system/.os/scripts/validate_config.py
```

For playbook index changes, inspect the generated JSON before closing out:

- `playbooks` should include every valid playbook regardless of `status`.
- `runnable_playbooks` should include only entries with `status: active`.
- Draft, reviewed, or archived playbooks may appear in `playbooks`, but must not appear in `runnable_playbooks`.

After edits, refresh the project documentation and code indexes when the jdocmunch and jcodemunch MCP servers are available.

## Troubleshooting

If a wrapper starts doing parsing, conversion, indexing, or validation logic, move that logic into the toolkit and leave the script as a call-through.

If a toolkit needs network access, stop and write or update a design first. The design must state why local processing is insufficient, what opt-in flags enable the behavior, what data leaves the machine, and how failures are reported.

If a dependency is attractive but optional, prefer a standard-library implementation until the dependency materially improves correctness, supportability, or packaging risk.

If `index playbooks` fails, inspect the reported playbook frontmatter before changing parser behavior. Administrative routers such as `AGENTS.md` should be skipped because they do not have playbook frontmatter; real playbooks should supply every required field in `playbook-contract.md`.

If generated list fields become `null` or output order changes unexpectedly, fix the index builder or tests. Derived catalogs should remain deterministic and should serialize empty lists as arrays.

If draft, reviewed, or archived playbooks appear under `runnable_playbooks`, fix the index filter and add or update regression fixtures before changing router wording.

If a proposed command does not fit the toolkit's README and local `AGENTS.md`, stop and route the work through [PRD 16](../../prd/16-revise-toolkit-ownership-boundaries.md) instead of broadening the current toolkit by convenience.

If enterprise distribution concerns block a rollout, track them against R-003 in [03 Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md) instead of hiding them inside a toolkit README.

## Related Resources

- [Toolkit CLI deployment standard design](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
- [make-docs import strategy design](../../designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md)
- [PRD 14 deterministic toolkit deployment revision](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16 toolkit ownership boundary revision](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [P4 data and extraction backlog](../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md)
- [P4 history record](../../assets/history/2026-06-04-w1-r0-p4-data-layer-extraction.md)
- [P5 playbooks backlog](../../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md)
- [P5 history record](../../assets/history/2026-06-04-w1-r0-p5-playbooks.md)
- [P6 discovery runs backlog](../../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md)
- [P6 history record](../../assets/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md)
- [Indexes router](../../../system/.os/indexes/AGENTS.md)
- [Playbook contract](../../../system/.os/contracts/playbook-contract.md)
- [Run record contract](../../../system/.os/contracts/run-record-contract.md)
- [Finding contract](../../../system/.os/contracts/finding-contract.md)
- [Toolkits root README](../../../toolkits/README.md)
- [Toolkits router](../../../toolkits/AGENTS.md)
- [buildos-discovery README](../../../toolkits/buildos-discovery/README.md)

## Future Coverage

- Blocked by: expanded installer and release packaging. Update when `buildos-intake` has signed release artifacts, checksums, SBOM generation, and installer integration. Guide change: add enterprise deployment procedures and release checklist details.
