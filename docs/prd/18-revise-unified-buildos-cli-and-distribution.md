# 18 Revise Unified BuildOS CLI and Distribution

## Purpose

Replace the separately distributed `buildos-*` binary model with one modular, distributable `buildos` executable while preserving coherent domain ownership inside the Go source tree. This revision makes `buildos <domain>` the canonical command surface, assigns W1 R4 entity consolidation to `buildos entities`, and establishes the distribution contract that W1 R5 must prove before BuildOS is presented as a package-manager-installed product.

## Change Type

- Kind: `revision`
- Status: `active`
- Execution mode: active-set evolution
- Effective change: revise the packaging and ownership requirements in PRDs 14 and 16, and revise the W1 R4 command surface in PRD 17, without implementing W1 R5 consolidation during the W1 R4 architecture gate.

## Baseline Being Revised or Removed

This revision supersedes the parts of [14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md) that require each capability domain to ship an independent `buildos-<toolkit-slug>` binary and directory. It also supersedes the parts of [16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md) that equate domain isolation with separate public binaries.

The requirement for coherent domain ownership remains active. It moves from independently distributed toolkit modules into packages and subcommands within one Go module at `toolkits/buildos/`.

For [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md), this revision changes only the public executable and transitional source layout: W1 R4 delivers `buildos entities`, never `buildos-entities`. PRD 17's redirect, resolver, consolidation-manifest, index, compatibility/strict, persona-identity, extraction-outcome, and copied-root safety contracts remain effective.

## Rationale

The repository currently builds and installs `buildos-intake`, `buildos-discovery`, and `buildos-design` as separate Go modules and binaries through `toolkits/` and the root `justfile`. Adding another independently distributed entity binary and a later lifecycle binary would multiply versioning, help, diagnostics, installation, signing, upgrade, and removal surfaces.

One executable gives adopters one version, one root model, one output contract, and one release artifact while domain packages retain narrow ownership. Cross-domain behavior can use Go interfaces instead of subprocess calls, and package managers can install and upgrade one product rather than an expanding collection of binaries.

Code anchors:

- `toolkits/buildos-intake/`
- `toolkits/buildos-discovery/`
- `toolkits/buildos-design/`
- `justfile`

## Effective Requirement

### Unified module and domain ownership

BuildOS converges on one Go module rooted at `toolkits/buildos/` with the public executable entry point at `toolkits/buildos/cmd/buildos/`. Shared command, root-layout, output, diagnostic, and version behavior belongs under internal packages such as `internal/cli/` and `internal/layout/`; coherent domain behavior belongs under packages such as `internal/intake/`, `internal/discovery/`, `internal/design/`, `internal/entities/`, and later `internal/lifecycle/`.

Domain boundaries remain implementation and maintenance contracts. One executable does not permit unrelated behavior to accumulate in an undifferentiated package. Cross-domain operations use Go interfaces or shared packages inside the unified module rather than subprocess calls.

W1 R4 seeds this topology with the command entry point, shared CLI and layout behavior, and the entity domain. Until W1 R5 completes module consolidation, `toolkits/buildos/` exposes a temporary `pkg/entities` package so existing discovery and design modules can import the same resolver through explicit local module dependencies. W1 R5 moves those consumers into the unified module, internalizes the entity package, and removes the temporary replacement directives.

Code anchors:

- `toolkits/`
- `toolkits/buildos-discovery/`
- `toolkits/buildos-design/`

### Canonical command and output contract

The canonical public surface is one executable with domain subcommands:

```text
buildos intake ...
buildos discovery ...
buildos design ...
buildos entities ...
buildos setup ...
buildos update
buildos uninstall
buildos version
```

All domains share human-readable default output, a stable `--json` automation form, the global `--root` and `--json` behavior where applicable, common help/version behavior, shared exit codes, and shared diagnostic and JSON envelopes. Every W1 R4 entity result reports the executable version, source revision, resolved root, operating mode, and write status. Source builds default to version `dev` and source revision `unknown`; release builds may inject both values.

The shared JSON envelope has this minimum stable shape:

```json
{
  "ok": true,
  "command": "entities.resolve",
  "version": "dev",
  "source_revision": "unknown",
  "root": "<project-root>",
  "mode": "compat",
  "write_status": "not_requested",
  "result": {},
  "diagnostics": []
}
```

The shared exit-code policy is:

| Code | Meaning |
| --- | --- |
| `0` | The requested operation completed successfully, including a clean check or dry run. |
| `2` | Command or flag usage is invalid. |
| `3` | The explicit root or required input cannot be loaded or parsed. |
| `4` | A contract, validation, graph, or reviewed-remap conflict prevents the operation. |
| `5` | An I/O or canonical-write failure prevented a valid write from being committed. |
| `6` | A valid canonical write committed but the derived index rebuild failed; the diagnostic must include the exact recovery command. |

Diagnostics are stable records in JSON mode and concise stderr messages in human-readable mode. Informational or deprecation messages go to stderr and do not alter successful stdout or exit behavior.

`write_status` is one of `not_requested` for read-only operations, `planned` for an unapplied dry run, `applied` when every authorized write completes, or `canonical_applied_index_failed` for exit code `6`.

No public `buildos-entities` or `buildos-lifecycle` binary is introduced.

### W1 R4 seed contract

W1 R4 implements:

```text
buildos help
buildos version
buildos entities resolve
buildos entities validate
buildos entities consolidate
buildos entities rebuild-index
```

The W1 R4 invocation contract is:

```text
buildos entities resolve \
  --root <path> \
  --mode compat|strict \
  --id <entity-id> \
  [--json]

buildos entities validate \
  --root <path> \
  --mode compat|strict \
  [--json]

buildos entities consolidate \
  --root <path> \
  --mode compat|strict \
  --manifest <path> \
  [--apply] \
  [--json]

buildos entities rebuild-index \
  --root <path> \
  --mode compat|strict \
  [--check|--apply] \
  [--json]
```

`consolidate` defaults to a dry run. `rebuild-index` defaults to check behavior when neither `--check` nor `--apply` is present; the two flags are mutually exclusive. All commands require an explicit root and mode rather than inferring a live installation.

The entity commands retain PRD 17's explicit-root, dry-run-by-default, compatibility/strict, atomic-write, deterministic-index, recovery, and copied-root requirements. A version 1 consolidation manifest may affect only one canonical JSONL dataset, so one apply operation performs at most one atomic canonical-file replacement; cross-dataset reviews require separately previewed and approved manifests. The derived index remains `.os/indexes/entity-resolution.json` in an installed root; the source scaffold counterpart is `system/.os/indexes/entity-resolution.json`. `references.json` remains intake-owned and never carries entity redirects.

W1 R4 P2 implements this source-build-only seed, including the shared command envelope and exit policy, whole-graph resolution and validation, deterministic index checking and rebuilding, and single-dataset reviewed consolidation. It does not implement W1 R5 migration or distribution.

W1 R4 is source-build-only. It does not replace existing installed binaries, publish packages, mutate live adopter data, or absorb the intake, discovery, and design implementations into the unified module.

W1 R4 P1 froze this command, flag, output-envelope, version-metadata, exit-code, and temporary package-sharing contract in authoritative documentation and normative examples. P2 implements and tests the source-built `buildos` executable, entity graph engine, index, and mutation surface. P3 proves the reviewed persona workflow, staged-binary isolation, copied-root apply, strict validation, deterministic replay, conflict refusal, and rollback against sanitized fixtures. The actual adopter-owned root was unavailable, so P3 does not claim live migration or authorize binary replacement. P4 owns canonical reference behavior across existing discovery, design, and extraction paths.

### W1 R5 consolidation and compatibility contract

W1 R5 migrates intake, discovery, and design into isolated packages within `toolkits/buildos/` and proves command parity before removing their old source modules. Canonical command mappings include:

```text
buildos intake convert
buildos intake index references
buildos intake index playbooks
buildos discovery run
buildos discovery qualify
buildos design promote
buildos entities ...
```

During one stable minor-release compatibility cycle, the invoked names `buildos-intake`, `buildos-discovery`, and `buildos-design` route to the same executable through aliases or symlinks. Invoked-basename routing preserves successful output and exit behavior while printing deprecation guidance to stderr. The root `justfile` installs one executable plus those temporary aliases and provides explicit rollback to the former binaries.

### Distribution contract

The first packaged public CLI version is `0.1.0` and uses the Apache-2.0 distribution license. Initial distribution channels are signed release archives and Homebrew.

Release acceptance requires supported macOS, Linux, and Windows AMD64/ARM64 archives as applicable, a SHA-256 checksum manifest, CycloneDX JSON SBOMs, signed provenance or attestations, a Homebrew formula that verifies archive checksums, versioned release notes, upgrade compatibility notes, and clean archive/formula installation, upgrade, rollback, and uninstall smoke tests. Unsigned source builds remain development-only.

Planning this distribution contract does not close R-003. That risk closes only after the release pipeline and installation evidence exist.

### W2 installation-lifecycle follow-on

W2 adds project and machine lifecycle behavior to the same executable:

```text
buildos setup
buildos setup --dry-run
buildos setup backup
buildos setup remove
buildos update
buildos uninstall
```

W2 owns the embedded versioned scaffold, `.os/manifest.json`, managed/adopter-owned/derived/merge-required classifications, install and synchronization planning, backup, conservative project removal, pre-manifest adoption, executable-owner-aware update guidance, and copied-root rehearsal and rollback. `buildos setup remove` manages one project's BuildOS files; `buildos uninstall` manages the machine-level tool. `buildos update` delegates executable upgrades to Homebrew when Homebrew owns the binary and gives exact manual replacement guidance for archive installations rather than overwriting itself blindly.

The complete W2 design, plan, PRD, and work bundle is finalized during W1 R5 closeout after the packaged command and compatibility behavior are proven.

## Impacted Docs and Dependencies

- PRD 14 remains valuable baseline history for the move away from unmanaged scripts, but its independent-binary and independent-module requirements are superseded by this revision.
- PRD 16 remains the domain-ownership authority, but ownership is enforced by modular packages and subcommands within the unified module rather than by one public binary per domain.
- PRD 17 retains the entity-data and resolver contracts while using `buildos entities` and the temporary `pkg/entities` sharing boundary.
- R-003 in [03 Open Questions and Risk Register](./03-open-questions-and-risk-register.md) remains open and now uses this revision's packaging evidence as part of its closure gate.
- The W1 R5 plan and delta backlog implement module consolidation, compatibility aliases, packaging, and deprecation closeout after W1 R4.
- W2 lifecycle planning must use this executable and may not introduce a separate `buildos-lifecycle` toolkit.

Code anchors:

- `toolkits/`
- `justfile`
- `docs/prd/03-open-questions-and-risk-register.md`
- `docs/prd/14-revise-deterministic-toolkit-deployment.md`
- `docs/prd/16-revise-toolkit-ownership-boundaries.md`
- `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md`

## Required Baseline Annotations

- `14-revise-deterministic-toolkit-deployment.md`: add `Superseded by` notes to the independent-module/binary contract and related distribution impact.
- `16-revise-toolkit-ownership-boundaries.md`: add `Superseded by` notes explaining that domain ownership now maps to packages and subcommands inside `toolkits/buildos/`.
- `17-enhance-entity-consolidation-and-canonical-resolution.md`: update the planned public command and source-build references to `buildos entities`, and add a `Superseded by` note for the prior separate-binary/source-layout decision.
- `00-index.md`: add PRD 18 and reciprocal lineage for PRDs 14, 16, and 17.
- `03-open-questions-and-risk-register.md`: update R-003 in place without adding a `Change Notes` heading or closing it prematurely.

## Source Anchors

- `toolkits/`
- `toolkits/buildos-intake/`
- `toolkits/buildos-discovery/`
- `toolkits/buildos-design/`
- `justfile`
- [Unified BuildOS CLI and distribution design](../designs/2026-07-21-unified-buildos-cli-and-distribution.md)
- [W1 R5 unified BuildOS CLI and distribution plan](../plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md)
- [PRD 14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md)
- [PRD 16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md)
- [PRD 17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md)
- [Entity consolidation contract](../../system/.os/contracts/entity-consolidation-contract.md)
- [Persona identity contract](../../system/.os/contracts/persona-identity-contract.md)
- [Extraction contract](../../system/.os/contracts/extraction-contract.md)
- `toolkits/buildos/testdata/persona-pilot/`
- `toolkits/buildos/internal/cli/persona_rehearsal_test.go`
