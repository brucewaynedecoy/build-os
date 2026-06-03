# Phase 08: Stage Automation

## Purpose

This phase makes the three flows self-propelling without manual prompting, using hooks and slash-commands rather than the deprecated make-docs prompt mechanism.

## Overview

Implement the stage-movers as hooks and slash-commands: intake→extract, run→qualify, and qualify→design. Each respects the gates and the make-docs boundary. This phase comes last because the stages it connects must exist first.

## Source PRD Docs

- [12 Stage Automation](../../prd/12-stage-automation.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - Stage-movers

### Tasks

- [ ] t1: Implement an intake→extract stage-mover (hook/slash-command) that takes a converted twin and opens the extraction step.
- [ ] t2: Implement a run→qualify stage-mover that takes a run's raw finding into the qualification flow.
- [ ] t3: Implement a qualify→design stage-mover that initiates the Flow C hand-off for a qualified finding.

### Acceptance criteria

- Stage-movers are hooks/slash-commands, not prompt files.
- Each stage-mover respects its gate (review-to-activate, verify-to-promote) and never writes into a make-docs tree outside its router.
- The promotion enforcement decision (convention vs. machinery) is resolved before these are hardened.

### Dependencies

- Phases 03–07 (the stages being connected must exist).
