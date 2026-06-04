# Phase 01: PRD, Guide, and Design Lineage

## Purpose

Record the completed requirement, design, and guidance work that makes packaged `buildos-*` toolkits the Build OS standard for deterministic logic.

## Overview

This phase captures the durable documentation surface for W1 R2. It defines the effective PRD change, records the downstream W1 R0 P3 impact, adds the enterprise distribution risk, and gives future maintainers a reusable toolkit-development guide.

## Source PRD Docs

- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 02: Architecture Overview](../../prd/02-architecture-overview.md)
- [PRD 03: Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md)
- [PRD 06: Operating Layer and Routing](../../prd/06-operating-layer-and-routing.md)
- [PRD 07: Intake and Conversion](../../prd/07-intake-and-conversion.md)
- [PRD 12: Stage Automation](../../prd/12-stage-automation.md)

## Stage 1 - PRD Revision and Baseline Notes

### Tasks

- [x] t1: Create `docs/prd/14-revise-deterministic-toolkit-deployment.md` as the effective requirement for packaged deterministic Build OS toolkits.
- [x] t2: Update `docs/prd/00-index.md` so PRD 14 is discoverable and related baseline PRDs list the revision.
- [x] t3: Add baseline change notes to PRDs 02, 06, 07, and 12 without rewriting their original W1 R0 context.
- [x] t4: Add R-003 in `docs/prd/03-open-questions-and-risk-register.md` for enterprise installer, signing, checksum, SBOM, vulnerability scanning, and distribution hardening.

### Acceptance criteria

- PRD 14 states Go as the default language, standard-library-first dependency posture, local-only runtime posture, and `buildos-*` binary naming.
- PRD 07 names `buildos-intake` as the downstream converter/index toolkit target.
- `.os/scripts/` is documented as wrapper/router surface rather than the durable implementation home.
- Enterprise distribution hardening remains visible as an open risk, not an implicit blocker for W1 R0 P3.

### Dependencies

- [2026-06-04-buildos-toolkit-cli-deployment-standard.md](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
- Existing W1 R0 and W1 R1 PRD set.

## Stage 2 - Guide and Design Records

### Tasks

- [x] t1: Add `docs/guides/developer/buildos-toolkit-cli-development.md` with reusable guidance for creating new toolkits, revising existing toolkits, and converting unmanaged scripts.
- [x] t2: Add `docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md` with the architecture decision and W1 R0 P3 handoff.
- [x] t3: Add `docs/designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md` for upstream make-docs maintainer work.
- [x] t4: Keep the make-docs handoff explicit that make-docs-owned assets should change upstream and be imported back later.

### Acceptance criteria

- The developer guide uses required guide frontmatter and stays maintainer-facing.
- Both design records include the required design headings.
- The make-docs handoff does not instruct local edits under `.make-docs/`, `docs/assets/references/`, `docs/assets/templates/`, `system/.make-docs/`, or `system/docs/assets/`.
- Future coverage notes distinguish W1 R0 P3 implementation from enterprise installer hardening.

### Dependencies

- `docs/guides/AGENTS.md`
- `docs/designs/AGENTS.md`
- `docs/assets/references/guide-contract.md`
