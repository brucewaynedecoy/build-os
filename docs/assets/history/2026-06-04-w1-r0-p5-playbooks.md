---
date: "2026-06-04"
coordinate: "W1 R0 P5"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Completed the W1 R0 P5 playbook templates, routers, seed drafts, active-only runnable index, and phase closeout."
---

# W1 R0 P5 Playbooks

## Changes

Completed the playbook baseline by adding the six procedure template shapes, category routers for build/discovery/testing, minimal target rows for playbook linkage, and draft seed playbooks for each new category. The `buildos-intake index playbooks` output now preserves the full `playbooks` catalog and adds `runnable_playbooks` as the active-only subset used for runnable procedure and enforceable guardrail surfaces.

| Area | Summary |
| --- | --- |
| Templates | Added explicit-steps, guided-objective, and inferred-actions procedure templates for both standing and stateful playbooks. |
| Routers | Updated the top-level and category playbook routers to separate active runnable/enforced entries from draft seed candidates. |
| Data | Seeded `REQ-001`, `CAP-001`, and `TC-001` so draft playbooks can link to target entities. |
| Seed playbooks | Added draft `PB-004`, `PB-005`, and `PB-006` under build, discovery, and testing. |
| Indexing | Added `runnable_playbooks` to the generated playbook index while keeping `playbooks` as the full lifecycle catalog. |
| Closeout | Marked the P5 work backlog tasks complete and added a narrow `.gitignore` exception so `system/playbooks/build/` remains trackable. |

Manual-test coverage decision: worthwhile. P5 changes both administrator-facing routers and generated catalog behavior, so a human review adds value beyond the automated assertions by checking that the supported command and the readable router surfaces communicate the active-only gate correctly.

User-acceptance scenario produced: a Build OS administrator builds the local `buildos-intake` binary, runs `system/.os/scripts/buildos-intake index playbooks --repo-root . --playbooks-root system/playbooks --output system/.os/indexes/playbooks.json`, confirms the command reports six playbooks, reviews `system/.os/indexes/playbooks.json` to verify `playbooks` includes `PB-001` through `PB-006` while `runnable_playbooks` includes only active `PB-001`, `PB-002`, and `PB-003`, then reads the top-level and category routers to confirm draft `PB-004` through `PB-006` are listed only as draft seed candidates.

Manual-test result: passed as expected. The generated playbook index, active-only runnable subset, and router inspections matched the expected P5 behavior.

Developer-guide coverage decision: `update-existing`. The completed work creates maintainer-facing knowledge about playbook authoring, template selection, category routers, active-only routing, and generated index shape, and the existing developer guides already own those topics. Updated the operating-layer contracts maintenance guide with the playbook maintenance workflow, router/index safe-change rules, and build-category ignore caveat. Updated the toolkit CLI development guide with the full-catalog versus active-only `runnable_playbooks` behavior and validation/troubleshooting guidance. No new developer guide was needed because the topic is split across those existing ownership boundaries.

User-guide coverage decision: `none`. P5 creates internal playbook templates, category routers, draft seed instruments, minimal target rows, and an administrator-facing generated index. These capabilities are `developer` or maintainer-facing for guide purposes and are covered by developer guidance, but they do not add or change a shipped end-user task, concept, configuration choice, adoption path, expected result, or troubleshooting workflow. No `docs/guides/user/` guide was created.

PRD coverage decision: `none`. The implementation matches existing PRD 09 behavior for category routers, playbook templates, `targets`, lifecycle status, and active-only running/enforcement. No numbered PRD revision, baseline annotation, PRD index update, or risk-register change was warranted.

| Capability or finding | Outcome | Rationale |
| --- | --- | --- |
| Procedure templates, category routers, and draft seed playbooks | `none` | PRD 09 already covers templates, `administrative`/`build`/`discovery`/`testing` category directories, procedure and guardrail playbooks, flat `PB-NNN` IDs, and the `draft → reviewed → active → archived` lifecycle. |
| Minimal target rows for `REQ-001`, `CAP-001`, and `TC-001` | `none` | PRD 09 already requires playbook `targets` to reference entity IDs from the data layer, and PRD 08/15 already cover `draft` entity rows as pending structured data. |
| `playbooks.json` full catalog plus active-only `runnable_playbooks` | `none` | PRD 09 already says `playbooks.json` indexes playbooks and only `active` instruments should be runnable or enforced. The new index field implements that requirement without changing the requirement surface. |
| Promotion enforcement risk register item Q-001 | `none` | P5 exposes an active-only runnable subset, but it does not decide whether future promotion gates should be hard-enforced by tooling or remain documented conventions. Q-001 therefore remains open and unchanged. |

## Documentation

### Project

| Path | Description |
| --- | --- |
| [../../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md](../../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md) | Marked P5 playbook template, router, seed, and active-only index tasks complete. |
| [../../../.gitignore](../../../.gitignore) | Added a narrow exception so `system/playbooks/build/` is not hidden by the generic `build/` output ignore rule. |
| [../../../system/.os/templates/AGENTS.md](../../../system/.os/templates/AGENTS.md) | Replaced the placeholder with links to the six procedure playbook templates. |
| [../../../system/.os/templates/procedure-playbook-explicit-steps-standing.md](../../../system/.os/templates/procedure-playbook-explicit-steps-standing.md) | Added the explicit-steps standing procedure template. |
| [../../../system/.os/templates/procedure-playbook-explicit-steps-stateful.md](../../../system/.os/templates/procedure-playbook-explicit-steps-stateful.md) | Added the explicit-steps stateful procedure template. |
| [../../../system/.os/templates/procedure-playbook-guided-objective-standing.md](../../../system/.os/templates/procedure-playbook-guided-objective-standing.md) | Added the guided-objective standing procedure template. |
| [../../../system/.os/templates/procedure-playbook-guided-objective-stateful.md](../../../system/.os/templates/procedure-playbook-guided-objective-stateful.md) | Added the guided-objective stateful procedure template. |
| [../../../system/.os/templates/procedure-playbook-inferred-actions-standing.md](../../../system/.os/templates/procedure-playbook-inferred-actions-standing.md) | Added the inferred-actions standing procedure template. |
| [../../../system/.os/templates/procedure-playbook-inferred-actions-stateful.md](../../../system/.os/templates/procedure-playbook-inferred-actions-stateful.md) | Added the inferred-actions stateful procedure template. |
| [../../../system/.os/data/requirements.jsonl](../../../system/.os/data/requirements.jsonl) | Added draft target row `REQ-001` for the active-only playbook execution gate. |
| [../../../system/.os/data/capabilities.jsonl](../../../system/.os/data/capabilities.jsonl) | Added draft target row `CAP-001` for playbook routing and catalog capability. |
| [../../../system/.os/data/test-cases.jsonl](../../../system/.os/data/test-cases.jsonl) | Added draft target row `TC-001` for draft playbooks not being runnable. |
| [../../../system/playbooks/AGENTS.md](../../../system/playbooks/AGENTS.md) | Updated the top-level router with category links, active sections, and draft seed candidates. |
| [../../../system/playbooks/administrative/AGENTS.md](../../../system/playbooks/administrative/AGENTS.md) | Updated administrative routing to separate active procedures, active guardrails, and draft candidates. |
| [../../../system/playbooks/build/AGENTS.md](../../../system/playbooks/build/AGENTS.md) | Added the build category router. |
| [../../../system/playbooks/build/CLAUDE.md](../../../system/playbooks/build/CLAUDE.md) | Added the build category Claude pointer. |
| [../../../system/playbooks/build/package-build-artifact.md](../../../system/playbooks/build/package-build-artifact.md) | Added draft seed playbook `PB-004`. |
| [../../../system/playbooks/discovery/AGENTS.md](../../../system/playbooks/discovery/AGENTS.md) | Added the discovery category router. |
| [../../../system/playbooks/discovery/CLAUDE.md](../../../system/playbooks/discovery/CLAUDE.md) | Added the discovery category Claude pointer. |
| [../../../system/playbooks/discovery/inspect-ui-discoverability.md](../../../system/playbooks/discovery/inspect-ui-discoverability.md) | Added draft seed playbook `PB-005`. |
| [../../../system/playbooks/testing/AGENTS.md](../../../system/playbooks/testing/AGENTS.md) | Added the testing category router. |
| [../../../system/playbooks/testing/CLAUDE.md](../../../system/playbooks/testing/CLAUDE.md) | Added the testing category Claude pointer. |
| [../../../system/playbooks/testing/run-core-validation.md](../../../system/playbooks/testing/run-core-validation.md) | Added draft seed playbook `PB-006`. |
| [../../../system/.os/indexes/playbooks.json](../../../system/.os/indexes/playbooks.json) | Regenerated the derived playbook catalog after the seed playbooks were added. |

### Developer

| Path | Description |
| --- | --- |
| [../../guides/developer/operating-layer-contracts-maintenance.md](../../guides/developer/operating-layer-contracts-maintenance.md) | Added maintainer workflow and safe-change guidance for playbook templates, routers, target rows, active-only gating, and the build category ignore exception. |
| [../../guides/developer/buildos-toolkit-cli-development.md](../../guides/developer/buildos-toolkit-cli-development.md) | Added maintainer guidance for `playbooks` versus `runnable_playbooks`, active-only validation, and index troubleshooting. |
| [../../../toolkits/buildos-intake/README.md](../../../toolkits/buildos-intake/README.md) | Documented full-catalog versus active-only runnable playbook index output. |
| [../../../toolkits/buildos-intake/cmd/buildos-intake/main_test.go](../../../toolkits/buildos-intake/cmd/buildos-intake/main_test.go) | Added CLI output coverage for `runnable_playbooks`. |
| [../../../toolkits/buildos-intake/internal/intake/types.go](../../../toolkits/buildos-intake/internal/intake/types.go) | Added the `runnable_playbooks` index field. |
| [../../../toolkits/buildos-intake/internal/intake/index.go](../../../toolkits/buildos-intake/internal/intake/index.go) | Filters active playbooks into the runnable subset while retaining the full catalog. |
| [../../../toolkits/buildos-intake/internal/intake/convert_test.go](../../../toolkits/buildos-intake/internal/intake/convert_test.go) | Added draft/reviewed fixtures to assert only active playbooks are runnable. |

### User

None this session.
