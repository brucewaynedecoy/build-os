# Build OS Toolkit CLI Deployment Standard

> Filename: `2026-06-04-buildos-toolkit-cli-deployment-standard.md`.
> This design makes packaged first-party CLI toolkits the standard deployment form for durable deterministic Build OS logic.

## Purpose

Define the repository structure, implementation defaults, runtime posture, and script-wrapper boundary for deterministic Build OS tooling.
This design is a prerequisite for W1 R0 P3 intake/conversion implementation so converter and index logic can land as a packaged toolkit instead of unmanaged standalone scripts.

## Context

The W1 R0 baseline established `system/.os/scripts/` as the obvious place for deterministic operating-layer processes.
That is workable for early validators, but it is not a good long-term deployment model for Build OS.

Build OS is expected to be installed in enterprise environments where unmanaged scripts can be flagged by endpoint monitoring, policy controls, or software inventory systems.
It is also expected to be used by teams whose operators may not be comfortable installing Python, Node, shell dependencies, or language-specific runtimes.
Durable deterministic logic should therefore be packaged, locally runnable, and easy to inventory.

The current immediate need is W1 R0 P3 intake/conversion.
That work should consume the standard by implementing `buildos-intake` under `toolkits/buildos-intake/`, while `system/.os/scripts/` remains available for wrappers or command routing.

## Decision

Add root `toolkits/` as the source home for first-party deterministic CLI toolkits.
Each toolkit lives in its own subdirectory and is independently buildable.

Use these defaults:

| Area | Decision |
| --- | --- |
| Language | Go is the default language for new deterministic toolkits. |
| Dependencies | Standard library first. Third-party or native dependencies require explicit rationale, license notes, and packaging review in the toolkit README. |
| Runtime | Local-only by default. Network or service calls are disallowed unless a design explicitly approves them and the CLI requires opt-in flags. |
| Binary naming | Use `buildos-<toolkit-slug>`, for example `buildos-intake`. |
| Script boundary | `system/.os/scripts/` is a wrapper, command router, compatibility, and command documentation surface. |
| Existing scripts | Existing scripts can remain until intentionally converted. This design does not port `validate_config.py`. |

The initial scaffold is:

```text
toolkits/
  README.md
  AGENTS.md
  CLAUDE.md
  buildos-intake/
    README.md
    AGENTS.md
    CLAUDE.md
```

A future installer may expose a unified `buildos` dispatcher, but that should not erase the independent toolkit directories or the `buildos-*` binary naming convention.

For agent orchestration, use a coordinator plus specialized workers:

- The coordinator owns PRD reconciliation, command naming, final integration, validation, and boundary review.
- Documentation workers can update PRDs, guides, and design records in parallel once the decision is stable.
- Toolkit scaffold or implementation workers can create directories and local README/AGENTS/CLAUDE files in parallel with documentation work.
- Wrapper work should wait until the toolkit command surface is stable.
- Review workers should check for boundary violations, especially edits under `.make-docs/`, `docs/assets/`, `system/.make-docs/`, and `system/docs/assets/`.

## Alternatives Considered

**Keep deterministic logic in unmanaged scripts.**
Rejected because it keeps language-runtime assumptions in the operating layer and increases enterprise monitoring, install, and support risk.

**Use Python for first-party toolkits.**
Rejected as the default because Python is excellent for development but still requires runtime and packaging decisions for non-technical and enterprise adopters.
Python may still be used for temporary validators or explicitly approved cases.

**Use Node or TypeScript for first-party toolkits.**
Rejected as the default because it adds package-manager and runtime concerns that are disproportionate for deterministic file processing.

**Adopt an external PDF or document-conversion service.**
Rejected as the default.
Build OS deterministic tooling should run entirely locally unless a later design approves service calls and requires explicit opt-in flags.

**Use a single monolithic `buildos` binary immediately.**
Deferred.
The project can add a unified dispatcher later, but independent `buildos-*` toolkit binaries are simpler to build, test, replace, and review during the baseline rollout.

## Consequences

Build OS gains a clearer path for deterministic logic that can become installable, inventory-friendly, and easier to approve in controlled environments.
Script wrappers remain useful for discoverability and compatibility, but they are no longer the durable implementation home.

The repository now needs a toolkit source namespace and guide coverage for future contributors.
Future script conversion work should evaluate whether each script is durable logic, a temporary validator, or a wrapper before moving it.

Enterprise release hardening remains open.
Signing, checksums, SBOM generation, installer behavior, and package distribution are tracked separately as R-003 in the PRD risk register.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](../assets/prompts/designs-to-plan-change.prompt.md)
- Why: This revises the W1 R0 baseline before W1 R0 P3 implementation so intake/conversion can be built on the toolkit standard.
- Coordinate Handoff: Use W1 R2 as the prerequisite change coordinate. W1 R0 P3 should consume `toolkits/buildos-intake/` and implement converter/index behavior through the `buildos-intake` CLI.
