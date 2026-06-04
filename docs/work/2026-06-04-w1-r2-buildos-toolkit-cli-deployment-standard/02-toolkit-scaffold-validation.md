# Phase 02: Toolkit Scaffold and Validation

## Purpose

Record the completed scaffold, routing, and validation work that makes W1 R2 consumable by W1 R0 P3.

## Overview

This phase creates the root `toolkits/` namespace, adds the scaffold-only `buildos-intake` toolkit directory, updates root README routing, and validates the docs/scaffold change set.

## Source PRD Docs

- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 07: Intake and Conversion](../../prd/07-intake-and-conversion.md)

## Stage 1 - Toolkit Namespace and Intake Scaffold

### Tasks

- [x] t1: Add `toolkits/README.md` describing first-party deterministic CLI toolkit standards.
- [x] t2: Add root `toolkits/AGENTS.md` as the thin router for toolkit work.
- [x] t3: Add root `toolkits/CLAUDE.md` as a pointer to `AGENTS.md`.
- [x] t4: Add scaffold-only `toolkits/buildos-intake/README.md`.
- [x] t5: Add scaffold-only `toolkits/buildos-intake/AGENTS.md` and `CLAUDE.md`.
- [x] t6: Ensure `buildos-intake` does not include converter logic, Go module files, generated binaries, converted outputs, or release artifacts in W1 R2.

### Acceptance criteria

- `toolkits/` exists and is discoverable through local routers.
- `buildos-intake` is named consistently and marked scaffold-only.
- The scaffold states Go, standard-library-first, local-only, and no-network defaults.
- Future converter behavior remains explicitly assigned to W1 R0 P3.

### Dependencies

- PRD 14 effective requirement.
- Root README routing update.

## Stage 2 - README Routing and Validation

### Tasks

- [x] t1: Update `README.md` to describe `toolkits/` as the source home for first-party deterministic CLI toolkits.
- [x] t2: Run config validation and self-test.
- [x] t3: Run make-docs path hygiene and self-test.
- [x] t4: Run `git diff --check`.
- [x] t5: Run targeted relative-link checks for touched docs.
- [x] t6: Confirm no prohibited make-docs-owned asset/template/reference paths changed, except the allowed W1 R2 history breadcrumb.
- [x] t7: Refresh jdocmunch and jcodemunch indexes after edits.

### Acceptance criteria

- Root README routes deterministic toolkit work to `toolkits/AGENTS.md`.
- Validation commands pass.
- Targeted relative-link check reports no missing links.
- Boundary scan shows no local changes under `.make-docs/`, `docs/assets/references/`, `docs/assets/templates/`, `system/.make-docs/`, or `system/docs/assets/`.
- The only `docs/assets/` addition, if present, is the project-specific history record.

### Dependencies

- Stage 1 scaffold complete.
- W1 R2 plan and work backlog present before final history closeout.
