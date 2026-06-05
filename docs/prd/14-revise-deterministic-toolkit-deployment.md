# 14 Revise Deterministic Toolkit Deployment

## Purpose

Establish packaged first-party CLI toolkits as the Build OS standard for deterministic logic execution, so operational scripts can stay thin, auditable wrappers while implementation source and build metadata live in a clear project-owned location.

## Change Type

- Kind: `revision`
- Status: `active`
- Source design: [2026-06-04 BuildOS Toolkit CLI Deployment Standard](../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)

## Baseline Being Revised or Removed

The W1 R0 baseline treated `system/.os/scripts/` as the likely home for deterministic operating-layer implementations. That remains acceptable for small temporary validators and routers, but it is no longer the standard for new durable deterministic tooling.

## Rationale

Build OS is expected to run inside enterprise environments where unmanaged or unpackaged Python, Node, or shell scripts may be difficult to approve, scan, distribute, or support. Non-technical adopters also need tooling that can be installed and invoked without understanding local language runtimes.

The safer baseline is to keep deterministic logic in versioned, buildable first-party CLI toolkits, with scripts acting only as compatibility wrappers, command routers, and command documentation.

## Effective Requirement

| Area | Requirement |
| --- | --- |
| Source home | First-party deterministic toolkit source and build metadata live under root `toolkits/`. |
| Toolkit structure | Each toolkit gets its own directory under `toolkits/<toolkit-slug>/` with local `README.md`, `AGENTS.md`, and `CLAUDE.md` routing files. |
| Toolkit ownership | Each toolkit owns a coherent deterministic capability domain. A toolkit README and local `AGENTS.md` are scope contracts; unrelated commands require a new or explicitly revised owning toolkit. |
| Default language | Go is the default implementation language for new Build OS deterministic CLI toolkits. |
| Dependency posture | Prefer the Go standard library. Third-party or native dependencies require explicit rationale, license notes, and packaging review in the toolkit README. |
| Runtime posture | Toolkits are local-only by default. Network or service calls are disallowed unless a design explicitly approves them and the CLI requires opt-in flags. |
| Binary naming | Toolkit binaries use `buildos-<toolkit-slug>`, for example `buildos-intake`. A future unified `buildos` dispatcher may route to these binaries without replacing independently buildable toolkit directories. |
| Script role | `system/.os/scripts/` is a thin wrapper, command router, compatibility, and documentation surface. New durable deterministic logic should not be implemented there as unmanaged scripts. |
| Existing scripts | Existing scripts may remain until they are explicitly converted. `validate_config.py` is not ported by this change. |

### Change Notes

- Superseded by [16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md) where this revision was too broad about "toolkits" generally: new deterministic behavior must choose the correct domain-owned toolkit rather than expanding an unrelated existing Go CLI or legacy unmanaged script.

## Initial Toolkit Target

W1 R0 P3 intake/conversion work should implement converter/index logic through the `buildos-intake` toolkit instead of adding standalone converter scripts. The initial prerequisite added only the scaffold and standards; W1 R0 P3 now implements the initial toolkit behavior. That implementation keeps runtime processing local, uses only approved Go dependencies for HTML parsing and rudimentary PDF text extraction, and preserves `.os/scripts/` as a thin wrapper surface.

## Impacted Docs and Dependencies

- [02 Architecture Overview](./02-architecture-overview.md) now recognizes `toolkits/` as the build-source home for deterministic execution tooling.
- [06 Operating Layer and Routing](./06-operating-layer-and-routing.md) now treats `.os/scripts/` as a wrapper/router surface for packaged toolkits where applicable.
- [07 Intake and Conversion](./07-intake-and-conversion.md) now routes converter/index implementation through `buildos-intake`.
- [12 Stage Automation](./12-stage-automation.md) now expects deterministic runners to call packaged toolkits where applicable.
- [03 Open Questions and Risk Register](./03-open-questions-and-risk-register.md) tracks unresolved enterprise installer, signing, SBOM, and distribution hardening.

## Required Baseline Annotations

This PRD revision should be referenced from the impacted baseline PRDs as a change note rather than rewriting their original W1 R0 context in place.

## Source Anchors

- `toolkits/`
- `toolkits/buildos-intake/`
- `system/.os/scripts/`
- `system/.os/contracts/intake-translation-contract.md`
- `system/playbooks/administrative/manual-intake-conversion.md`
- `docs/guides/developer/buildos-toolkit-cli-development.md`
- `docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md`
- `docs/plans/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/`
- `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/`
