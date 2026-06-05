# 16 Revise Toolkit Ownership Boundaries

## Purpose

Clarify that packaged `buildos-*` toolkits are domain-owned deterministic CLIs, not a single expandable catch-all toolkit, and prevent durable logic from moving into legacy scripts or unrelated toolkit directories.

This revision tightens [14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md) after the W1 R0 P6 implementation attempt exposed ambiguity between "use a Go toolkit" and "choose the correct owning Go toolkit."

## Change Type

This document records a `revision`.

The effective requirement is stricter toolkit ownership: before implementing deterministic behavior, the work must identify the capability domain and either use the existing toolkit that already owns that domain or create a new domain-specific toolkit.

## Baseline Being Revised or Removed

This revision updates the toolkit deployment requirement in PRD 14 and constrains implementation ownership for PRDs 07 through 12.

It does not remove the packaged-toolkit standard. It narrows where future deterministic logic may be placed.

## Rationale

The P6 implementation attempt placed discovery-run and finding-qualification behavior in `buildos-intake` and added run/finding validation to `system/.os/scripts/validate_config.py`. That was a serious ownership mismatch:

- `buildos-intake` is scoped to intake, conversion, and intake-adjacent indexes.
- `validate_config.py` is a legacy unmanaged script that should eventually move to a dedicated config toolkit, not accumulate new durable domains.
- PRD 14 makes scripts wrappers, routers, compatibility surfaces, and command documentation, not the default home for new deterministic logic.

Code anchors:

- `toolkits/`
- `toolkits/buildos-intake/`
- `system/.os/scripts/validate_config.py`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md`

## Effective Requirement

Toolkit ownership is part of the implementation contract.

Before adding or moving durable deterministic logic, the work must:

1. Identify the capability domain.
2. Read the target toolkit's README and `AGENTS.md`.
3. Confirm the target toolkit already owns that capability.
4. If no existing toolkit owns the capability, create or plan a new domain-specific toolkit under `toolkits/<toolkit-slug>/`.
5. Keep `system/.os/scripts/` as wrappers, routers, compatibility shims, or command documentation.
6. Avoid adding new durable domains to legacy unmanaged scripts unless an explicit PRD/design revision authorizes that temporary state.

A toolkit README and local `AGENTS.md` are scope contracts. An existing toolkit may not gain unrelated commands merely because it is already written in Go.

Known toolkit ownership inventory from the active PRD set and remaining W1 R0 work:

| Toolkit | Status | Owns | PRD / phase source |
| --- | --- | --- | --- |
| `buildos-intake` | Existing | Source intake, conversion, converted twins, and the `references.json` derived catalog. | PRD 07, W1 R0 P3 |
| `buildos-config` | Planned | Instance config validation, scoped metadata/frontmatter hygiene, and eventual migration of `validate_config.py` behavior. | PRD 13, PRD 14 |
| `buildos-playbooks` | Candidate / needs ownership decision | Playbook catalog rebuilds, active-only runnable playbook resolution, and playbook contract validation if these remain durable deterministic commands. | PRD 08, PRD 09, W1 R0 P5 |
| `buildos-extract` or `buildos-data` | Candidate / needs ownership decision | Extraction load-plan helpers, entity-row loaders, and `.os/data` deterministic hygiene beyond config-owned checks. | PRD 08, W1 R0 P4 |
| `buildos-discovery` | Implemented for P6 | Discovery-run recording, run artifact creation, raw-finding anchoring, finding qualification, negative assertions, and run/finding-specific validation. | PRD 10, W1 R0 P6 |
| `buildos-flow` or `buildos-stage` | Candidate / needs ownership decision | Qualified-finding to design hand-off and stage-mover orchestration that routes to the owning toolkits. | PRD 11, PRD 12, W1 R0 P7-P8 |

W1 R0 P6 remediation moved Flow B behavior to `buildos-discovery` and removed P6-specific logic from `buildos-intake` and `validate_config.py`.

Code anchors:

- `toolkits/AGENTS.md`
- `toolkits/buildos-intake/AGENTS.md`
- `docs/guides/developer/buildos-toolkit-cli-development.md`

## Impacted Docs and Dependencies

- PRD 07 remains the source for `buildos-intake`; it should not be read as permission to add discovery, finding, config, extraction, or stage commands to that toolkit.
- PRD 08 and PRD 09 need an explicit ownership decision before further durable playbook/data commands are added.
- PRD 10 needs a discovery-owned toolkit implementation for P6.
- PRD 11 and PRD 12 need an explicit stage/flow ownership decision before implementation.
- PRD 14 remains active but is superseded where it did not force a domain ownership check.

Code anchors:

- `docs/prd/07-intake-and-conversion.md`
- `docs/prd/08-data-and-extraction.md`
- `docs/prd/09-playbooks.md`
- `docs/prd/10-discovery-runs-and-qualification.md`
- `docs/prd/11-flow-c-integration.md`
- `docs/prd/12-stage-automation.md`
- `docs/prd/14-revise-deterministic-toolkit-deployment.md`

## Required Baseline Annotations

- `10-discovery-runs-and-qualification.md`: add a `### Change Notes` entry stating that Flow B implementation ownership is superseded by this revision and belongs in a discovery-specific toolkit.
- `12-stage-automation.md`: add a `### Change Notes` entry stating that stage-movers route to owning toolkits rather than becoming unmanaged script logic or expanding unrelated toolkits.
- `14-revise-deterministic-toolkit-deployment.md`: add a `### Change Notes` entry stating that this revision adds a toolkit-domain ownership gate.

## Source Anchors

- `docs/prd/14-revise-deterministic-toolkit-deployment.md`
- `docs/prd/10-discovery-runs-and-qualification.md`
- `docs/prd/12-stage-automation.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md`
- `docs/assets/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md`
- `toolkits/`
- `toolkits/buildos-intake/`
