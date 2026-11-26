# Phase 04: Validation and Handoff

## Purpose

Assemble the prompt-pack implementation, validate touched docs and prompt assets, refresh indexes, and leave a clean handoff for the later deterministic flow orchestrator plan.

## Scope

This phase covers cross-link cleanup, docs hygiene, PRD and guide coverage closeout, history record updates, validation evidence, and the explicit handoff to the phase-two deterministic orchestrator. It does not implement `buildos-flow`, hooks, plugins, or harness-specific automation.

## Workstreams

| Workstream | Output | Notes |
| --- | --- | --- |
| Cross-link assembly | verified links across prompt packs, PRDs, design docs, testing guide, and work backlog | Keep `USE_CASES_TESTING.md` as the source for scenario language unless a prompt contract deliberately narrows it. |
| PRD and guide closeout | PRD change doc, baseline annotations, guide coverage decision, history record | Record `none` rationale if guides are not updated. |
| Validation | style, path hygiene, config validation where applicable, diff whitespace check, index refresh | Report baseline debt separately from touched-file issues. |
| Handoff | note that prompt packs are phase-one contracts for later `buildos-flow` manifests and harness integrations | Reference the phase-two design but do not start it. |

## Concurrency

Validation and cross-link assembly should run after all writing workstreams are complete. If delegated workers are available, one worker should run mechanical checks while another performs a human-readable contract review against the design and plan.

## Blockers

- If validation reveals prompt files using unsupported absolute paths, fix those before closeout.
- If PRD updates imply a broader shipped workflow than the prompt-pack implementation actually delivers, narrow the PRD wording or defer shipped claims to the phase-two orchestrator.
- If guide coverage is warranted for adopter workflows, do not close out with `none`; update the existing guide or create a draft guide according to the guide contract.

## Validation

- `python3 .make-docs/scripts/check_markdown_style.py --format text <touched-docs-and-prompts>`
- `python3 .make-docs/scripts/check_path_hygiene.py --repo-root . --manifest .make-docs/manifest.json --format text`
- `python3 system/.os/scripts/validate_config.py --self-test`
- `python3 system/.os/scripts/validate_config.py`
- `git diff --check`
- refresh `jdocmunch` for `local/build-os`.
- confirm no prompt-pack text claims the phase-two deterministic orchestrator has been implemented.
