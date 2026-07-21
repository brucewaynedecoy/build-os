---
title: "Build OS Toolkit CLI Development"
path: "buildos/toolkit/cli"
status: draft
version: "2026-07-21"
order: 100
tags:
  - toolkits
  - cli
  - deterministic-execution
applies-to:
  - toolkits
  - buildos
related:
  - "./operating-layer-entities-consolidation-and-resolution.md"
  - "../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md"
  - "../../designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md"
  - "../../prd/14-revise-deterministic-toolkit-deployment.md"
  - "../../prd/16-revise-toolkit-ownership-boundaries.md"
  - "../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md"
  - "../../prd/18-revise-unified-buildos-cli-and-distribution.md"
  - "../../designs/2026-07-21-unified-buildos-cli-and-distribution.md"
  - "../user/convert-source-material-with-buildos-intake.md"
  - "../user/record-discovery-runs-and-qualify-findings.md"
  - "../user/promote-qualified-findings-to-designs.md"
  - "../user/use-playbooks-and-active-indexes.md"
  - "../user/entities-consolidation-curate-and-resolve-records.md"
  - "../../../system/.os/contracts/converted-source-contract.md"
  - "../../../system/.os/contracts/intake-translation-contract.md"
  - "../../../system/.os/contracts/playbook-contract.md"
  - "../../../system/.os/contracts/run-record-contract.md"
  - "../../../system/.os/contracts/finding-contract.md"
  - "../../../system/.os/contracts/entity-consolidation-contract.md"
  - "../../../system/.os/contracts/persona-identity-contract.md"
  - "../../../system/.os/indexes/AGENTS.md"
  - "../../../system/playbooks/administrative/manual-intake-conversion.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md"
  - "../../assets/history/2026-06-04-w1-r0-p4-data-layer-extraction.md"
  - "../../assets/history/2026-06-04-w1-r0-p5-playbooks.md"
  - "../../assets/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md"
  - "../../assets/history/2026-06-05-w1-r0-p7-qualified-finding-design-promotion.md"
  - "../../assets/history/2026-07-21-w1-r4-p3-reviewed-persona-consolidation-and-copied-root-rehearsal.md"
  - "../../../toolkits/README.md"
  - "../../../toolkits/buildos-intake/README.md"
  - "../../../toolkits/buildos-discovery/README.md"
  - "../../../toolkits/buildos-design/README.md"
---

# Build OS Toolkit CLI Development

## Overview

Use this guide when creating a new first-party deterministic toolkit, revising an existing toolkit, or converting unmanaged deterministic scripts into packaged Build OS CLI tooling.

Coverage outcome: `developer`. This topic is maintainer-facing because it defines source layout, dependency posture, local execution, packaging expectations, script-wrapper boundaries, validation, and agent handoff rules. User-facing operation of the current shipped toolkits is covered by the companion user guides for intake conversion, playbook indexes, discovery runs, finding qualification, and qualified-finding design promotion.

Architecture note: Build OS is converging on one distributable `buildos` executable.
W1 R4 seeds `toolkits/buildos/` with the entity domain as `buildos entities`.
W1 R5 will migrate intake,
discovery,
and design into that module and add temporary legacy-name aliases.
Until that migration is implemented and verified,
the current `buildos-intake`,
`buildos-discovery`,
and `buildos-design` binaries remain the runnable surfaces documented below.

## Project Orientation

- [../../../toolkits/README.md](../../../toolkits/README.md) is the source home overview for first-party deterministic CLI toolkits.
- [../../../toolkits/AGENTS.md](../../../toolkits/AGENTS.md) is the top router for toolkit work.
- The future public CLI lives in one Go module at `toolkits/buildos/`; coherent capabilities remain isolated as internal domain packages and subcommands.
- The existing separate toolkit directories remain in place until their W1 R5 parity migrations pass.
- `system/.os/scripts/` remains the operational wrapper, command router, compatibility, and command documentation surface.
- Durable deterministic logic should move into an owning `buildos <domain>` package instead of accumulating in unmanaged Python, Node, or shell scripts.
- Existing scripts may remain until a later phase explicitly ports them. Do not port `system/.os/scripts/validate_config.py` as part of the intake toolkit scaffold.

## Toolkit Defaults

| Decision | Default |
| --- | --- |
| Implementation language | Go |
| Dependency posture | Standard library first |
| Runtime posture | Local-only |
| Public binary name | `buildos` |
| Public command shape | `buildos <domain> <operation>` |
| Source module | `toolkits/buildos/` |
| Script role | Thin wrapper, router, compatibility shim, or command documentation |
| Network calls | Disallowed unless a design approves them and the CLI requires opt-in flags |

Third-party packages, native dependencies, generated parsers, service SDKs, or external conversion engines require explicit rationale in the toolkit README. That rationale should include why the dependency is necessary, license notes, packaging implications, expected update cadence, and any enterprise review concerns.

## Toolkit Ownership Guardrails

Toolkit ownership is a design boundary, not a convenience choice.

Before adding a command or deterministic behavior, identify the capability domain and confirm that the unified module's domain package and command router own it.
If they do not,
design a new isolated domain package and subcommand rather than a new public executable or an expansion of the nearest package.

Known ownership from the active PRD set:

| Domain | Ownership and current posture |
| --- | --- |
| `intake` | Source intake, conversion, converted twins, and `references.json`; still runs as `buildos-intake` until W1 R5 migration. |
| `discovery` | Discovery-run recording, raw-finding anchoring, finding qualification, and run/finding validation; still runs as `buildos-discovery` until W1 R5 migration. |
| `design` | Qualified-finding design hand-off and finding design-link updates; still runs as `buildos-design` until W1 R5 migration. |
| `entities` | W1 R4 seed for whole-graph loading, canonical resolution, reviewed consolidation, compatibility and strict validation, and `entity-resolution.json`; canonical command is `buildos entities`. |
| `config`, `playbooks`, `extraction`, or `stage` | Candidate future domains only; they require explicit product ownership and must not become new public binaries by default. |

Do not add discovery runs, finding qualification, qualified-finding design hand-offs, stage movers, config validation, or entity-row validation to `buildos-intake` unless an explicit PRD/design revision changes its scope.

Do not add stage-mover automation to `buildos-design` unless an explicit PRD/design revision moves that orchestration into this toolkit. P7 keeps the qualified-finding design hand-off separate from later stage movement.

Do not add new durable domains to `system/.os/scripts/validate_config.py`. It is a legacy transitional script, not the long-term validation expansion point.

Do not place entity graph behavior in intake,
config,
or a general extraction helper.
PRD 17 assigns the graph contract and PRD 18 assigns its public surface to `buildos entities` inside `toolkits/buildos/`.
W1 R4 P2 implements and validates that source-built seed.
Live entity cleanup remains separately approved work after copied-root rehearsal.

## W1 R4 P2 `buildos entities` Seed

`buildos entities` owns resolution, whole-graph validation, reviewed consolidation, and the derived entity-resolution index. P2 implements the command families `consolidate`, `resolve`, `validate`, and `rebuild-index` under the unified root command, plus shared help, version metadata, human output, stable JSON, and exit codes.

Maintainers should read the entity records, entity consolidation, persona identity, and extraction contracts together before changing this domain. The contracts freeze immediate-successor redirects, version 1 reviewed manifests and derived indexes, compatibility and strict behavior, exact persona-only identity reuse, and `minted`/`referenced`/`updated` extraction outcomes. Go code must implement those contracts rather than inventing a parallel schema.

Build and exercise the seed from its module:

```sh
cd toolkits/buildos
go test ./...
go build -o <staging-directory>/buildos ./cmd/buildos
<staging-directory>/buildos help
<staging-directory>/buildos version
<staging-directory>/buildos entities validate --root <copied-root> --mode compat
```

The root must be the Build OS `system/` root that contains `.os/data/` and `.os/indexes/`. Always invoke the staged binary by explicit path. Add `--json` for the stable envelope: `ok`, dotted `command`, `version`, `source_revision`, resolved `root`, `mode`, string `write_status`, `result`, and `diagnostics`. Source builds default to version `dev` and revision `unknown` unless linker flags inject them.

Use the shared exit policy in tests and integrations: `0` success, `2` usage, `3` input or root load, `4` validation or remap conflict, `5` canonical-write failure, and `6` canonical data applied but index rebuild failed. Exit `6` is not a rollback request; retain the canonical write and run the exact recovery command in the diagnostic.

W1 R4 temporarily exposes `toolkits/buildos/pkg/entities` so P4 can make the current discovery and design modules import the same resolver through explicit local module dependencies.
Consumers must not shell out to `buildos entities` or copy redirect traversal.
W1 R5 removes the local replacements and internalizes the package after those domains migrate into the unified module.

The implementation must distinguish three roots: the source checkout, installed program files, and adopter-owned data. Building in the source checkout must not replace an installed binary. Testing must invoke the source-built binary by explicit path against a recoverable copy of adopter data, never the live root first.

Mutation must be dry-run by default, require an explicit root and explicit apply authorization, validate the complete graph before writing, and limit each version 1 manifest to one canonical JSONL dataset. It uses same-filesystem temporary output and atomic replacement for that one affected file, preserves permissions and unknown row fields, and rebuilds the derived index. Binary deployment and live-data mutation require separate operator approvals.

W1 R4 is source-build-only.
It does not provide Homebrew installation,
signed archives,
automatic executable replacement,
or project lifecycle commands.
Those belong to W1 R5 distribution work and W2 lifecycle work respectively.

## W1 R4 P3 Copied-Root Reference Rehearsal

P3 proves the source-build boundary without replacing any installed command or touching live adopter data. The coordinator built `<staging-dir>/buildos` from revision `ce5aafb62bcd233a4671ca0d6eb4fe39ea38dca5`, injected that revision into the development build, and recorded binary SHA-256 `f28a1b83ba20065a39035f38fec045b04863212ee5173e4a019a1d8a04596946`. The binary reported version `dev` and the injected source revision.

The inventory found no `buildos` command on `PATH`. The existing `buildos-intake`, `buildos-discovery`, and `buildos-design` commands remained under `<user-home>/.local/bin/`; each `help` command exited successfully. The three shipped wrappers inspected in the checkout remained executable. The actual adopter-owned root was unavailable, so the rehearsal used a disposable copy of `toolkits/buildos/testdata/persona-pilot/root/` and did not invent or infer a live path.

The sanitized review package and manifests live under `toolkits/buildos/testdata/persona-pilot/`. Maintainers can reproduce the code-level rehearsal with:

```sh
cd toolkits/buildos
go test ./internal/cli -run TestPersonaCopiedRootRehearsal -count=1
go test ./...
go test -race ./...
```

The test copies the fixture root into a temporary directory, then proves compatibility validation, dry-run byte preservation, approved apply, strict validation, representative multi-hop resolution, preservation of provenance and unknown fields, deterministic index rebuilding, byte-stable replay, fail-closed conflicting remap, injected canonical-write failure, and byte-identical rollback. A passing test is evidence for the sanitized reference workflow only. It is not approval to change installed binary routing or live data.

## buildos-intake Reference

`buildos-intake` is the first implemented toolkit and the behavior baseline for the future `buildos intake` migration.
Its separate module and binary are current behavior,
not the pattern for new public executables.

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

During W1 R4, `toolkits/buildos-discovery/go.mod` has an explicit local dependency on `../buildos`, and discovery imports `toolkits/buildos/pkg/entities` directly. It must not invoke `buildos entities` as a subprocess or implement its own redirect traversal. Before writing, `run discovery` resolves authored playbook targets and explicit targets; `qualify finding` resolves the requested run ID. Results and CLI output expose the requested ID, canonical ID, and complete chain.

Preserve authored and historical provenance. Do not rewrite the playbook index, losing entity rows, or the requested raw-finding anchor. New run targets use terminal canonical IDs while retaining requested targets and resolution details. New finding `run_id`, `origin_run`, `basis_refs`, and `related` governed references use the terminal canonical run; `requested_run_id` and the raw anchor preserve what the operator supplied. The canonical run supplies runtime systems, environments, and owners.

The resolver treats `running`, `closed`, and `aborted` as valid terminal states for run entities. A stale `.os/indexes/entity-resolution.json` does not override authoritative canonical JSONL. Invalid graphs, missing IDs, or invalid terminal lifecycle states fail before any run or finding artifact is written.

Keep raw findings inside the run artifact until qualification. Do not route run/finding commands through `buildos-intake`, and do not add run/finding-specific validation to `validate_config.py`.

## buildos-design Reference

`buildos-design` owns the user-gated hand-off from a qualified finding to a make-docs-routed design.

```sh
buildos-design promote finding --finding-id <FIND-NNN> --route baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root <path>] [--dry-run]
```

The operating-layer wrapper is:

```sh
system/.os/scripts/buildos-design promote finding --finding-id <FIND-NNN> --route baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root <path>] [--dry-run]
```

Maintain design-promotion behavior against [finding-contract.md](../../../system/.os/contracts/finding-contract.md), the active qualified-finding design-promotion requirement, and the make-docs design router under [system/docs/designs/AGENTS.md](../../../system/docs/designs/AGENTS.md).

`promote finding` requires a terminal `qualified` finding row, a qualification anchor, and an explicit route. The requested finding ID may be historical and superseded: the toolkit resolves it through the shared `toolkits/buildos/pkg/entities` package and reports the requested ID, canonical ID, and complete chain. The `baseline-plan` route prepares a design for fresh baseline planning; the `change-plan` route prepares a design for additive planning against the active PRD namespace.

A successful promotion writes a dated design under `system/docs/designs/`, records the design link only on the canonical finding, and updates the findings index for traceability. The losing finding row and authored historical references remain unchanged. The canonical finding supplies lineage, qualification evidence, and configured scope. JSONL updates preserve unknown and type-specific fields and use atomic replacement; a resolver, validation, design-write, or canonical-finding update failure must not leave a partial promotion.

During W1 R4, `toolkits/buildos-design/go.mod` depends explicitly on `../buildos` and imports the resolver package directly. It must not shell out to `buildos entities` or duplicate graph traversal. This local cross-module dependency is temporary and is removed when W1 R5 migrates design into the unified module.

Keep design promotion user-gated. Do not auto-promote qualified findings, do not bypass the make-docs design router, and do not rewrite the origin run or qualification evidence during design promotion.

## Add a New CLI Domain

1. Confirm the domain's product ownership in the active PRD set.
2. Add the domain under `toolkits/buildos/internal/<domain>/` after W1 R5 establishes that internal structure; W1 R4 alone uses the temporary exported entity package required for cross-module sharing.
3. Route the public operation as `buildos <domain> <operation>` and reuse the shared help, root, output, diagnostic, version, and exit-code behavior.
4. Keep the domain package coherent and use Go interfaces for cross-domain operations rather than subprocess calls.
5. Add focused tests close to the domain source and parity tests for any command being migrated from a legacy binary.
6. Add wrappers or legacy-name aliases only when the owning compatibility plan requires them.
7. Update PRDs, designs, guides, or work backlogs whenever the domain changes a durable contract or source-of-truth boundary.

Do not introduce a new public `buildos-<domain>` executable.
The only temporary legacy names planned by W1 R5 are compatibility aliases for already shipped intake,
discovery,
and design commands.

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
2. If it is durable deterministic logic, select or create its domain package inside the unified module.
3. Port the behavior into the toolkit while preserving input and output contracts.
4. Keep the old script only as a wrapper when existing workflows still call it.
5. Make the wrapper call the packaged binary and keep any compatibility mapping obvious.
6. Update documentation to name `buildos <domain>` as the canonical implementation surface.
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

For the current W1 R4 unified seed, use the complete entity-domain gate:

```sh
cd toolkits/buildos
go test ./...
go test -race ./...
go vet ./...
go build ./...
go test ./internal/cli -run TestPersonaCopiedRootRehearsal -count=1
```

If `toolkits/buildos/pkg/entities` or governed-reference behavior changes, run the temporary W1 R4 consumer gates as well:

```sh
cd toolkits/buildos-discovery
go test ./...
go test -race ./...
go vet ./...

cd ../buildos-design
go test ./...
go test -race ./...
go vet ./...
```

The entity failure suites are release requirements. Preflight validation, remap conflicts, and injected canonical-write failures must leave canonical bytes unchanged. A simulated post-commit index failure must instead retain the canonical write, emit `write_status: canonical_applied_index_failed`, exit `6`, and provide the exact `buildos entities rebuild-index ... --apply` recovery command. Repeated unchanged index builds and approved-manifest replays must be byte-identical.

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

For entity consolidation, do not substitute the Python validator or hand-edited JSON for `buildos entities`. The Python checks are not whole-graph or redirect-resolution certification.

For the P3 persona rehearsal, run the focused integration test, the full module suite, and the race-enabled suite shown above. Confirm the approved-manifest, baseline persona, and baseline index checksums against `toolkits/buildos/testdata/persona-pilot/review/checksums.txt` before treating a copied-root result as comparable evidence.

## Troubleshooting

If a wrapper starts doing parsing, conversion, indexing, or validation logic, move that logic into the toolkit and leave the script as a call-through.

If a toolkit needs network access, stop and write or update a design first. The design must state why local processing is insufficient, what opt-in flags enable the behavior, what data leaves the machine, and how failures are reported.

If a dependency is attractive but optional, prefer a standard-library implementation until the dependency materially improves correctness, supportability, or packaging risk.

If `index playbooks` fails, inspect the reported playbook frontmatter before changing parser behavior. Administrative routers such as `AGENTS.md` should be skipped because they do not have playbook frontmatter; real playbooks should supply every required field in `playbook-contract.md`.

If generated list fields become `null` or output order changes unexpectedly, fix the index builder or tests. Derived catalogs should remain deterministic and should serialize empty lists as arrays.

If draft, reviewed, or archived playbooks appear under `runnable_playbooks`, fix the index filter and add or update regression fixtures before changing router wording.

If a proposed command does not fit the toolkit's README and local `AGENTS.md`, stop and route the work through [PRD 16](../../prd/16-revise-toolkit-ownership-boundaries.md) instead of broadening the current toolkit by convenience.

If enterprise distribution concerns block a rollout, track them against R-003 in [03 Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md) instead of hiding them inside a toolkit README.

If `buildos` is absent from `PATH`, that is expected during W1 R4. Invoke the staged binary by its explicit path. Do not create a symlink or replace a legacy command as part of a copied-root rehearsal.

If the actual adopter-owned root is unavailable or ambiguous, stop at the sanitized fixture rehearsal. Record the missing live authority and do not substitute the source scaffold or a guessed installed path.

If a staged binary or manifest checksum differs from the recorded review package, rebuild or re-review before applying. Do not continue merely because the command still runs.

If `buildos entities` exits `3`, correct the explicit root, mode, or input before retrying. Exit `4` means the graph or remap is invalid and no mutation is allowed. Exit `5` means canonical writing failed before commit; verify copied-root byte identity. Exit `6` means canonical data committed but index completion failed; preserve that write, run the exact correction from the diagnostic, then repeat strict validation and `rebuild-index --check`.

## Related Resources

- [Toolkit CLI deployment standard design](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
- [make-docs import strategy design](../../designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md)
- [PRD 14 deterministic toolkit deployment revision](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16 toolkit ownership boundary revision](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [Convert Source Material With buildos-intake](../user/convert-source-material-with-buildos-intake.md)
- [Use Playbooks and Active Indexes](../user/use-playbooks-and-active-indexes.md)
- [Curate and Resolve Duplicate Entity Records](../user/entities-consolidation-curate-and-resolve-records.md)
- [Entity Consolidation Maintainer Guide](./operating-layer-entities-consolidation-and-resolution.md)
- [Record Discovery Runs and Qualify Findings](../user/record-discovery-runs-and-qualify-findings.md)
- [Promote Qualified Findings to Designs](../user/promote-qualified-findings-to-designs.md)
- [P4 data and extraction backlog](../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md)
- [P4 history record](../../assets/history/2026-06-04-w1-r0-p4-data-layer-extraction.md)
- [P5 playbooks backlog](../../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md)
- [P5 history record](../../assets/history/2026-06-04-w1-r0-p5-playbooks.md)
- [P6 discovery runs backlog](../../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md)
- [P6 history record](../../assets/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md)
- [P7 history record](../../assets/history/2026-06-05-w1-r0-p7-qualified-finding-design-promotion.md)
- [Indexes router](../../../system/.os/indexes/AGENTS.md)
- [Playbook contract](../../../system/.os/contracts/playbook-contract.md)
- [Run record contract](../../../system/.os/contracts/run-record-contract.md)
- [Finding contract](../../../system/.os/contracts/finding-contract.md)
- [Entity consolidation contract](../../../system/.os/contracts/entity-consolidation-contract.md)
- [Persona identity contract](../../../system/.os/contracts/persona-identity-contract.md)
- [Toolkits root README](../../../toolkits/README.md)
- [Toolkits router](../../../toolkits/AGENTS.md)
- [buildos-discovery README](../../../toolkits/buildos-discovery/README.md)
- [buildos-design README](../../../toolkits/buildos-design/README.md)
- `buildos-design` command surface: `toolkits/buildos-design/cmd/buildos-design/main.go`

## Future Coverage

- Blocked by: W1 R5 package distribution. Update when `buildos 0.1.0` has verified signed archives, checksums, SBOMs, provenance, Homebrew install/upgrade/uninstall, and legacy aliases. Guide change: replace multi-tool installation guidance with the verified unified release procedure.
- Blocked by: W2 project installation lifecycle. Update when: manifest-backed setup, update, backup, remove, and uninstall behavior is implemented. Guide change: replace manual project synchronization notes with the verified lifecycle commands while preserving rollback guidance.
