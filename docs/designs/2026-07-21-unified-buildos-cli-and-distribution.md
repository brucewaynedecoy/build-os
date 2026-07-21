# Unified BuildOS CLI and Distribution

> Filename: `2026-07-21-unified-buildos-cli-and-distribution.md`.
> This design converges the separately distributed BuildOS toolkits on one modular, package-manager-ready executable.

## Purpose

Establish one distributable `buildos` command as the public automation surface for BuildOS while preserving clear domain packages, deterministic local operation, and a bounded compatibility path for existing `buildos-*` installations.

## Context

The [W1 R2 toolkit deployment standard](./2026-06-04-buildos-toolkit-cli-deployment-standard.md) correctly moved durable deterministic logic out of unmanaged scripts and into independently buildable Go toolkits. That decision enabled `buildos-intake`, `buildos-discovery`, and `buildos-design`, but each domain now carries its own executable, module boundary, help behavior, root handling, installation step, and prospective release lifecycle. Adding a separate public executable for every new domain would multiply those concerns for operators and maintainers.

The [entity consolidation design](./2026-07-21-entity-consolidation-and-canonical-resolution.md) creates the first feature that needs a shared resolver across existing domains. It also exposes a distribution question: the entity capability should seed a common command architecture instead of introducing `buildos-entities` immediately and then migrating it later. W1 R4 can safely establish the common shell, layout model, and entity package, provided that it does not absorb the existing domain modules or claim packaged distribution prematurely.

BuildOS must also serve teams with an existing installation and populated project data. Those teams need one version, one help system, one release artifact, and an upgrade story that separates executable replacement from live-project migration. The present source-build posture does not yet provide package-manager ownership, signed artifacts, a manifest-backed project synchronization lifecycle, or safe self-update behavior.

## Decision

### 1. Converge on one executable and one Go module

The future source home is one Go module at `toolkits/buildos/`:

```text
toolkits/buildos/
  cmd/buildos/
  internal/cli/
  internal/layout/
  internal/intake/
  internal/discovery/
  internal/design/
  internal/entities/
  internal/lifecycle/
```

The executable is named `buildos`. Domain boundaries remain explicit packages and subcommands rather than separate public binaries. Cross-domain behavior uses Go interfaces and shared packages, never subprocess calls between BuildOS commands.

W1 R4 seeds this module with the root command, layout behavior, and entity capability. During that seed period, `toolkits/buildos/pkg/entities` is an intentionally temporary cross-module API so existing discovery and design modules can consume canonical resolution without shelling out. W1 R5 migrates the existing domains into `toolkits/buildos/internal/`, then removes the temporary package export and local module replacements.

### 2. Make domain subcommands the canonical public surface

The canonical command families are:

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

W1 R4 implements only `buildos help`, `buildos version`, and `buildos entities ...`. W1 R5 adds the existing intake, discovery, and design behavior to the same executable. W2 adds project installation lifecycle behavior through `setup`, `update`, and `uninstall` routes in that executable. No public `buildos-entities` or `buildos-lifecycle` executable is introduced.

### 3. Share root, output, diagnostics, and version contracts

Every domain uses one root-resolution model, help system, diagnostic model, semantic version, and source-revision field. Common global behavior includes `--root`, `--json`, help, and version reporting. Human-readable output is the default. Automation output uses a stable JSON envelope that identifies the command, result status, version, source revision, resolved root, operating mode, write status, diagnostics, and domain-specific payload.

Exit codes are assigned centrally and distinguish success, usage errors, contract or validation failures, conflicts that require operator review, and unexpected internal failures. Domain packages return typed results and errors to the CLI layer rather than formatting process output directly.

Source builds report version `dev` and source revision `unknown` unless build flags inject release metadata. Packaged releases must report the semantic version and exact source revision used to build the artifact.

### 4. Preserve legacy names through bounded compatibility aliases

During W1 R5, `buildos-intake`, `buildos-discovery`, and `buildos-design` become aliases or symlinks to the same `buildos` executable. The executable detects its invoked basename and maps legacy arguments to the canonical domain command. A successful legacy invocation preserves its prior functional output and exit behavior, while stderr receives deprecation guidance that names the replacement command and removal window.

Compatibility aliases remain for one stable minor-release cycle. Their removal release must be recorded in release notes and user documentation before the aliases are deleted. The former binaries remain available for rollback until archive, package-manager, upgrade, and alias-parity checks pass.

### 5. Package version 0.1.0 through signed archives and Homebrew

The first public package target is `buildos 0.1.0` under Apache-2.0. The release produces supported macOS, Linux, and Windows archives for applicable AMD64 and ARM64 targets, a SHA-256 checksum manifest, CycloneDX JSON software bills of materials, and signed provenance or attestations for the published artifacts. A Homebrew formula verifies the selected archive checksum.

Unsigned source builds remain development-only. Public publication is gated on clean archive installation, Homebrew installation and upgrade, compatibility-alias behavior, rollback, and clean-machine smoke tests. Package publication, remote release creation, and signing-key use require separate release authorization; they are not implied by implementation of this design.

### 6. Keep project installation lifecycle in the same executable

W2 extends `buildos` rather than creating another toolkit. It owns an embedded versioned project scaffold, `.os/manifest.json`, managed-file ownership classes, install and synchronization planning, backup, pre-manifest adoption, project removal, and machine-level uninstall guidance.

`buildos setup remove` concerns one project's BuildOS-managed files. `buildos uninstall` concerns the machine-level executable. When Homebrew owns the executable, `buildos update` delegates the persistent tool upgrade to Homebrew. Archive installations receive exact manual replacement guidance; the executable does not overwrite itself blindly.

## Alternatives Considered

**Continue shipping one public binary per domain.** Rejected because every additional binary multiplies installation, versioning, help, diagnostics, signing, and upgrade surfaces while making cross-domain contracts harder to keep consistent.

**Add a thin dispatcher while retaining independently distributed binaries.** Rejected as the long-term architecture because it preserves duplicate release artifacts and encourages subprocess coupling. The legacy names remain only as bounded aliases to the same executable.

**Introduce `buildos-entities` for W1 R4 and consolidate later.** Rejected because the entity module is new and can seed the intended architecture without adding another public name that immediately becomes deprecated.

**Create a separate `buildos-lifecycle` toolkit in W2.** Rejected because project installation, update, backup, removal, and machine-level uninstall are part of the same operator lifecycle and should share package ownership and diagnostics with the rest of `buildos`.

**Publish through a package manager before consolidating the modules.** Rejected because a public package should begin with one stable command contract and one artifact, not expose a transitional collection of independently versioned executables.

**Make the executable self-update for every installation type.** Rejected because package managers must retain ownership of package-managed files, and blind self-replacement creates avoidable integrity and rollback risk for archive installations.

## Consequences

Operators receive one installable command, version, help system, and release artifact. Maintainers retain domain isolation but must migrate existing packages carefully and prove parity before deleting old module code. The repository temporarily carries both the unified module and existing modules, plus local replacements for the W1 R4 entity-sharing bridge.

The alias cycle adds compatibility work and a documented removal obligation. Packaging adds licensing, checksums, SBOMs, attestations, cross-platform builds, and clean-install evidence that source builds do not require. R-003 cannot close merely because the unified executable compiles; it closes or narrows only when the promised distribution evidence is verified.

W1 R4 remains source-build-only and must not imply that existing installed binaries have been replaced. W1 R5 implements consolidation and distribution after W1 R4 is complete. W2 owns manifest-backed project synchronization and lifecycle behavior after the packaged command is proven.

## Design Lineage

- Update Mode: `new-doc-related`
- Prior Design Docs: [Build OS Toolkit CLI Deployment Standard](./2026-06-04-buildos-toolkit-cli-deployment-standard.md), [Entity Consolidation and Canonical Resolution](./2026-07-21-entity-consolidation-and-canonical-resolution.md)
- Reason: This design accepts W1 R2's packaged-toolkit direction but revises its one-binary-per-domain deployment decision now that multiple domains, shared entity resolution, and package-manager distribution require one public command architecture.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](../assets/prompts/designs-to-plan-change.prompt.md)
- Why: The decision revises the active toolkit deployment standard, creates a new PRD change contract, migrates existing command domains, and adds a scoped distribution backlog.
- Coordinate Handoff: W1 R2 established the separate toolkit deployment standard; W1 R5 is the next unused revision of that wave and supersedes the public multi-binary direction without rewriting W1 R2 history.
