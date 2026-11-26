# PRD Set Authority Cleanup Evidence

## Purpose

This report holds the evidence for the [W1 R8 work backlog](./00-index.md): validator counts, owner decisions, the requirement trace record, change-note dispositions, recorded reviewed moves, link-check results, Human Experience evidence, and phase reviews. Each phase adds its own entries.

## Validator Counts

Command: `make-docs run prd authority validate --target-root . --json`. Counts by code use `jq -r '.diagnostics | group_by(.code) | map("\(.[0].code) \(length)") | .[]'`.

| Point | `PRD-AUTH-001` | `PRD-AUTH-002` | `PRD-AUTH-003` | `PRD-AUTH-004` | `PRD-AUTH-005` | Total | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 baseline (before any W1 R8 change, 2026-11-23) | 6 | 6 | 7 | 23 | 51 | 93 | `1` |
| After P1 implementation (2026-11-23) | 6 | 6 | 7 | 15 | 51 | 85 | `1` |
| After P2 implementation (2026-11-23) | 6 | 6 | 7 | 15 | 51 | 85 | `1` |
| After P3 implementation (2026-11-23) | 6 | 6 | 7 | 15 | 51 | 85 | `1` |
| After P3 review round 1 fixes (2026-11-23) | 6 | 6 | 7 | 15 | 51 | 85 | `1` |
| After P3 review round 2 fixes (2026-11-23) | 6 | 6 | 7 | 15 | 51 | 85 | `1` |
| After P4 implementation (2026-11-23) | 0 | 0 | 0 | 0 | 0 | 0 | `0` |
| P5 final check on the committed P4 state plus the P5 edits (2026-11-23) | 0 | 0 | 0 | 0 | 0 | 0 | `0` |

P1 notes: the eight `PRD-AUTH-004` findings in PRDs 13 (4) and 17 (4) cleared. The remaining 15 sit in PRDs 14, 15, 16, 18, and 19, which P1 does not edit. PRD 17 keeps its `PRD-AUTH-001` and `PRD-AUTH-002` findings until P4 renames it. No finding sits in a file this phase created.

P2 notes: the counts did not move, as planned. The validator does not flag change notes.

P3 notes: the counts did not move, as planned. No finding sits in the register or the inventory, the two files this phase changes besides this backlog. After the review round 1 fixes, no finding sits in PRD 02 or PRD 20 either.

P4 notes: the validator reports `status: passed`, 0 diagnostics, exit `0`, as planned. The PRD 17 rename cleared its `PRD-AUTH-001` and `PRD-AUTH-002` findings. The archive moves of PRDs 14, 15, 16, 18, and 19 cleared the rest of `PRD-AUTH-001` to `PRD-AUTH-004`. The archive moves of the five backlogs cleared the 51 `PRD-AUTH-005` findings.

P5 notes: the validator reports `status: passed`, 0 diagnostics, exit `0`, before and after the P5 edits to the register and the W1 R7 work index. The totals went from 93 at the P1 baseline to 0, as planned.

## Owner Decisions

### 2026-11-23 — P1 entry gate

- Decision: The owner approved the [W1 R8 plan](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md) and this backlog on 2026-11-23.
- Effect: The P1 entry gate is met.

### 2026-11-23 — P1 pre-upgrade audit prompt (implementer decision, design decision 6)

- Decision: **move**. P4 moves `.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md` to `docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` and turns the PRD 17 mention into a link.
- Facts checked: The resolver, validator, writer, and index that the prompt waited for now exist in the source package (`toolkits/buildos/pkg/entities` and the `buildos entities` commands in `toolkits/buildos/internal/cli/`). The prompt still has a job: it prepares proposal-only review artifacts for an installed root whose BuildOS version does not yet support canonical resolution. The user guide `docs/assets/user/entities-consolidation-curate-and-resolve-records.md` (`## Safe Pre-Upgrade Audit`) and the maintainer guide `docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md` still send readers to it, so retiring it would break a live guide step.
- PRD effect: PRD 17 `## Integrations` names the prompt at its new path as a code path. The old condition "until the resolver, validator, writer, and index are available" is restated as the current boundary: the prompt is proposal-only and never writes canonical data.

### 2026-11-23 — P1 scoped-field migration state (implementer decision, design decision 6)

- Decision: **landed**. The frontmatter hygiene rule in PRD 13 is unconditional, and PRD 13 has the W1 R8 history entry for it.
- Facts checked: No file under `system/` has a frontmatter key `env`, `for`, `envs`, or `target_systems` (search `^(env|for|envs|target_systems):`). No row in `system/.os/data/*.jsonl` has those keys. The sentinel `both` appears only as `audience: both`, in 13 files: six playbooks under `system/playbooks/` and seven playbook templates under `system/.os/templates/` (search `audience: both` over `*.md` under `system/`). `audience` is a different field, not a scoped field. `validate_config.py` reports the legacy fields as errors with no condition (`LEGACY_SCOPED_FIELDS`, `validate_frontmatter_data`). `python3 system/.os/scripts/validate_config.py` prints `OK: config, frontmatter, and entity data hygiene passed` (exit `0`), and `--self-test` passes.

### 2026-11-23 — P4 entry gate: links inside archived copies

- Question: The archived PRDs and backlogs move to new directories, so their own relative links break. Should P4 repair those link paths (option A) or leave the archived copies byte-identical and exclude their links from the link check (option B)? See [Owner Decision Before The Archive Moves](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md#owner-decision-before-the-archive-moves).
- Decision: **option A**, chosen by the owner on 2026-11-23, before any P4 file move. Inside the archived copies, P4 changes only the path part of each broken relative link so it resolves from the new location. No other text changes. Each repair is a recorded reviewed move under `## Recorded Reviewed Moves`.
- Effect: The P4 entry gate is met. The full link check covers `.make-docs/archive/` with no exclusion.

## Requirement Trace

### P3 register items

Register items added to [03 Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md), at the next unused numbers. No existing item was renumbered.

| Item | Title | Carries |
| --- | --- | --- |
| `D-006` | Legacy validator config and frontmatter checks differ from PRD 13 | R1, R2, R5 |
| `D-007` | Legacy validator entity and extraction row checks differ from PRD 13 | R3, R4, R7, R8 |
| `D-008` | Legacy playbook catalog rebuild accepts unresolved target redirect chains | R9 |
| `D-009` | PRD 01 Current Limitations describe a greenfield build | R10 |
| `Q-014` | Domain ownership for playbooks, data and extraction, and stage automation | Plan C-42 (16-05, 16-08 stage part) and R11 |

Items updated: `D-004` (R6, new `**Validator anchor rules**` paragraph and a stricter `To close`), `D-005` (`Follow-Up` names the W1 R8 work backlog; `Status` stays `Open`), `Q-001` (`To close` names PRD 10 and PRD 11 as the owners of the approved result, with the PRD 19 archive path as provenance; `Phase/gate` no longer cites PRD 19 approval), `Q-011` and `Q-012` (the PRD 19 capability map and decision inventory are kept at the archive path as input to the MCP revision), `R-003` (names the W2 lifecycle commands, the upgrade, rollback, and uninstall smoke tests, the managed, adopter-owned, derived, and merge-required manifest classifications, and the upgrade compatibility notes; `To close` and `Phase/gate` require the W2 design to accept the handoff before the item closes), and `R-004` (names the PRD 17 `### Adoption and live-root migration safety` gate with the package version pin).

Framing of `D-006` to `D-008`: each states the open decision for the W1 R7 port as "follow the PRD rule and record a parity exception, or match the legacy behavior and change the PRD". Each recommends the PRD rule. R1 to R8 cover `buildos validate` (W1 R7 work P7). R9 covers `buildos intake index playbooks` (W1 R7 work P4).

Review round 2 fix: the governing contracts win. `D-004` no longer offers to match the legacy anchor behavior and change PRD 13, because that would break the [Root and Path Contract](../../../system/.os/contracts/root-and-path-contract.md#saved-paths-and-anchors). It keeps the installed-path rule, records the legacy anchor differences as parity exceptions, and its `To close` requires a fixture for each anchor form: initialized-project anchors accepted, and `#heading`, absolute `/…#…`, and escaping `../…#…` anchors rejected. `D-006` and `D-007` now state the second option as one approved change to every affected owner (PRD and contract) with its fixtures. Their `To close` requires either (a) fixtures plus recorded parity exceptions that keep the governing rules, or (b) that full change. A change to PRD 13 alone does not close either item. This keeps an omitted `defaults` valid under the config contract, and a `qualified` finding valid under PRD 17 and the entity records contract, as PRD 11 design promotion needs. `D-008` was aligned with the same rule: it keeps the PRD 09 redirect-chain rule and the PRD 17 terminal resolution rule, records the legacy difference as a parity exception, and its `To close` requires either (a) fixtures plus a recorded parity exception, including a fixture where a target whose redirect successor is missing is rejected, or (b) one approved change to every affected PRD and contract with its fixtures. A change to PRD 09 alone does not close it.

Review round 1 fix: `Q-014` item 1 now names active-only runnable-playbook resolution and playbook contract validation, the two playbook responsibilities whose owner legacy PRD 16 left open. `D-008` now says "playbook contract validation" to match.

`R-004` did not contain the words "binary cutover" at execution time, so no replacement was needed. The new sentence names the package version pin instead.

### Mechanical check (t8)

Method: a script in `$TMPDIR` parses every row of section 2 of the [requirement inventory](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md). For each `PRD NN ##` or `PRD NN ###` reference in the `Final owner` cell, it requires a heading of that exact text and level in `docs/prd/NN-*.md`. For each `D-`, `Q-`, or `R-` ID, including `Q-003 to Q-011` style ranges, it requires a `###` item in the register. It also compares the file with `HEAD` and requires that only the empty `Final owner` cells changed. A self-test caught an empty cell, a heading with extra text (`Config schemaX`), and an unknown register ID (`Q-099`).

Result: 155 rows (13: 20, 14: 15, 15: 10, 16: 12, 17: 48, 18: 22, 19: 28). 0 empty `Final owner` cells. Before review: 212 section and register references (165 heading references and 47 register references), 0 unresolved. The first record said 216; that count was wrong. A range such as `Q-003 to Q-011` counts each ID in it. After the review round 1 fixes: 220 references (172 heading references and 48 register references), 0 unresolved. No other cell changed.

Cell form: `PRD NN ## Section` or `PRD NN ### Subsection`, `register X-NNN`, or `none: <reason>`. Several owners are separated by `;`. PRD 17 sections use their names after P1. P4 renames the file but not the sections.

Rows by final owner type: 119 name a current PRD section or a register item; 36 are `none` with a reason. Before review the split was 116 and 39. Rows 14-12, 15-06, and 17-14 moved from `none` to named owners.

### Quoted owner sentences (t9)

Selection rule: the four gap rows, every row of medium or low confidence, and every row whose `Final owner` names a PRD, or a top-level `##` section, that the `Proposed product owner` cell does not name. A `###` subsection inside the proposed `##` section counts as the same owner. A `none` row whose proposal was an owner also counts as different. 56 rows, plus 15-06 and 18-16, whose owners changed in the review round 1 fixes: 58 rows. Review round 2 added 19-20, whose final register range is narrower than its proposed range: 59 rows.

| Row | Why | Final owner | Owner sentence | Same meaning |
| --- | --- | --- | --- | --- |
| 13-01 | section differs | PRD 13 `## Component and Capability Map` | `system/.os/config/instance.yaml`: "The canonical instance configuration file, owned by the adopting team" | Yes |
| 13-02 | section differs | PRD 13 `## Component and Capability Map`; `### Config schema` | Config contract row: "Defines the schema shape, identifier rules, cross-reference behavior, defaults, and validation requirements". `### Config schema`: "`system/.os/contracts/config-contract.md` must define these top-level config properties" | Yes |
| 13-04 | section differs | PRD 13 `### buildos validate checks`; PRD 20 `## Command Surface` | 13: "`buildos validate` makes these checks, and only these." 20: "[13 ...] owns what `buildos validate` checks." | Yes |
| 13-05 | section differs | PRD 13 `### Scoped vocabulary`; PRD 04 `## Terms` | 13: "The scoped vocabulary is:" followed by the list `systems`, `environments`, and `owners`, each with its meaning. 04 rows `Systems`, `Environments`, `Owners`: "The config-backed scoped field that lists configured ..." | Yes |
| 13-13 | section differs | PRD 13 `### Scoped vocabulary` | "Frontmatter and structured rows that carry scoped metadata must use `systems`, `environments`, and `owners` as list fields. Empty lists are allowed only when the specific artifact contract permits system-neutral, environment-neutral, or owner-neutral scope." 08 and 09 link to `#scoped-vocabulary` | Yes |
| 13-14 | section differs | PRD 13 `### buildos validate checks`; PRD 06 `## Contracts and Data` | 13: "Validation runs through `buildos validate`, a command of the one `buildos` CLI ... Users need no Python to validate config." 06: "It replaces the Python validator; no Python ships to adopters." | Yes |
| 13-17 | medium | PRD 13 `### buildos validate checks` | Frontmatter hygiene: "It carries no legacy scoped field (`env`, `for`, `envs`, or `target_systems`). It has `systems`, `environments`, and `owners`, each a list of configured IDs. The check is unconditional." Also: "The frontmatter hygiene check should also be callable on its own, by index builders or repository hygiene scripts." | Yes; the "once the migration lands" condition is dropped under the P1 owner decision and the PRD 13 W1 R8 history entry |
| 13-20 | gap, medium, section differs | PRD 13 `### buildos validate checks` | "Entity record hygiene: each canonical entity file under `.os/data/` ... exists. Every line is a JSON object ... `status` is a value of the common lifecycle vocabulary ... or an entity-specific state ... `source_anchor` is a required `path#anchor` reference. A row that is not `draft` has a `doc_anchor` `path#anchor` reference under `docs/`." | Yes; the design gives the check list to PRD 13, and 08 and 17 own the vocabulary it enforces |
| 14-02 | section differs | PRD 02 `### Domain ownership` | "Each domain is a separate part of that package. Each domain has its own scope contract, its README and `AGENTS.md`, and is exposed as `buildos <domain>`." | Yes, as the per-domain rule that replaced per-toolkit directories (02 W1 R8 history) |
| 14-06 | gap, medium | PRD 20 `## Runtime and Package` | "BuildOS is local-only. The CLI makes no network calls. There are only two exceptions: the `npx` fetch of the BuildOS package itself, and the Make Docs setup that the user chooses ... Any new network call needs an accepted design and an opt-in flag." | Yes; the two existing exceptions are now named (20 W1 R8 history) |
| 14-08 | PRD differs | PRD 06 `## Component and Capability Map`; PRD 02 `### Domain ownership` | 06 `.os/scripts/` row: "Thin wrappers, command routers, compatibility shims, and command documentation". 02: "Keep `system/.os/scripts/` thin ... Do not add durable logic to an unmanaged script unless a PRD or design authorizes that temporary state." | Yes |
| 14-11 | section differs | PRD 07 `## Contracts and Data` | "The converters live in the BuildOS TypeScript package at `toolkits/buildos/`." | Yes for the current part; the W1 R0 P3 Go delivery is historical |
| 14-12 | `none` vs proposal; review fix | PRD 17 `### Entity commands`; `### Atomic writes`; `## Component and Capability Map`; PRD 20 `## Legacy Command Names` | 17 `### Entity commands`: "Every entity command requires an explicit `--root` ..." and "`consolidate` is a dry run by default. It writes only with `--apply`." `### Atomic writes`: "It writes to a temporary file on the same filesystem and atomically replaces the one affected JSONL file." 17 `## Component and Capability Map`: "Each command reports the package version, the source revision ..." 20: "No `buildos-entities` or `buildos-lifecycle` command name exists." | Yes for the surviving safeguards. The Go toolkit is retired; PRD 20 `## Runtime and Package` states the TypeScript package |
| 14-13 | medium | PRD 17 `### Adoption and live-root migration safety`; PRD 02 `## Runtime Boundaries` | 17: "Package verification, project adoption, and live-data migration are distinct actions." 02: "The source checkout, the installed npm package, and adopter-owned data are distinct runtime boundaries." | Yes, restated for the npm package |
| 15-06 | review fix | PRD 02 `## Data Flow`; PRD 08 `## Rebuild Notes` | 02: "**A — Intake** (`convert → extract → draft entity and extraction rows`)". 08: "Extraction is smart and gated; its outputs remain `draft` until promoted, regardless of destination." | Yes for the Flow A draft rule. The instruction to PRD authors is retired |
| 16-01 | medium, PRD differs | PRD 02 `### Domain ownership`; PRD 20 `## Command Surface` | 02: "BuildOS deterministic tooling is one package at `toolkits/buildos/` with one `buildos` CLI ... The package boundary does not merge domain boundaries." 20: "[02 ...] owns the domain ownership rule and the domain table." | Yes |
| 16-02 | medium | PRD 02 `### Domain ownership` | "Before adding or moving durable deterministic logic, identify the owning domain and read its scope contract. When no domain owns the capability, plan a new domain inside `toolkits/buildos/` ... The maintainer guide ... gives the step-by-step procedure." | Yes; the six steps are in the maintainer guide `### Before Adding Domain Logic` |
| 16-04 | medium; review fix | PRD 02 `### Domain ownership`; register `Q-014` | The domain table lists `entities`, `intake`, `discovery`, `design`, `init`, `validate`, `version`, `help`, `extract`, `fitgap`, and `export`. "No domain yet owns three areas. The first is playbook behavior beyond the intake catalog rebuild: active-only runnable-playbook resolution and playbook contract validation." | Yes, reconciled with PRD 20. The open playbook rows are named, as in legacy PRD 16 |
| 16-05 | gap, medium; review fix | register `Q-014`; PRD 02 `### Domain ownership` | `Q-014`: "Which `buildos` domain owns each of these areas?" Item 1: "Playbook behavior beyond the intake catalog rebuild: active-only runnable-playbook resolution ... and playbook contract validation, including the target-resolution rule in PRD 09." Items 2 and 3: extraction load-plan and data helpers beyond `buildos extract bulk`, and stage-mover orchestration | Yes |
| 16-08 | PRD differs | PRD 02 `### Domain ownership`; PRD 11 `## Contracts and Data`; register `Q-014` | 02: "A domain must not gain an unrelated command because it already exists." 02 table: `design` row owned by 11. 11: "The deterministic hand-off is: `buildos design promote finding ...`". `Q-014` item 3: stage-mover orchestration | Yes |
| 17-09 | section differs | PRD 17 `### Entity commands` | "`consolidate` is a dry run by default. It writes only with `--apply`." | Yes |
| 17-10 | section differs | PRD 17 `### Entity commands`; PRD 20 `## Output and Exit Contract` | 17: "Every entity command requires an explicit `--root` ... Every mutating invocation loads and validates the complete entity graph before it writes." 20: "Entity commands require an explicit `--root` whose `.os/data/` exists." | Yes |
| 17-13 | section differs | PRD 17 `## Component and Capability Map`; PRD 20 `## Output and Exit Contract` | 17: "Each command reports the package version, the source revision, the resolved root, the mode, and the write status through the shared envelope in [PRD 20 ...]." | Yes; "package version" replaces "executable version" |
| 17-14 | `none` vs proposal; review fix | PRD 06 `## Component and Capability Map`; PRD 20 `## Command Surface`; `## Legacy Command Names` | 06 `.os/scripts/` row: "Thin wrappers, command routers, compatibility shims, and command documentation ... No Python ships". 20 `## Command Surface`: "No user-facing command needs Python." 20 `## Legacy Command Names`: "No `buildos-entities` or `buildos-lifecycle` command name exists." | Yes |
| 17-20 | medium | PRD 17 `### Matching and review policy`; PRD 08 `### Draft lifecycle and anchors` | 17: "New outcome-aware rows use `extraction-outcomes-v1` with disjoint `minted`, `referenced`, and `updated` ID lists, each terminal at the time of the event. Legacy rows keep their earlier minted-or-updated provenance and are not guessed or rewritten." 08: "[17 ...] owns ... the `extraction-outcomes-v1` outcome lists." | Yes |
| 17-21 | medium | PRD 17 `### Adoption and live-root migration safety` | "Package verification, project adoption, and live-data migration are distinct actions. Adoption uses `buildos init` and pins the package version in `.os/manifest.json`." | Yes, restated for npm (design decision 3); the Go wording is in 17 history |
| 17-22 | medium | PRD 17 `### Adoption and live-root migration safety`; `## Requirement History` | Steps 1 to 7, for example: "3. Run the candidate version, named by an explicit `npx` version, against the copied root in compatibility and dry-run modes." and "7. Get a separate operator approval before mutating the live data root". History: "got a separate operator approval to reroute or replace installed binaries" | Yes: legacy steps 1, 3 to 7, and 9 are current steps 1 to 7; legacy steps 2 and 8 are in history |
| 17-23 | medium | PRD 20 `## Project Initialization and Adoption`; PRD 17 `### Adoption and live-root migration safety` | 20: "Adoption writes only these paths:" followed by the list `.os/manifest.json`, the wrapper scripts, and `.os/skills/`. 17: "An earlier BuildOS version stays read-only for redirect-bearing datasets until the cutover is complete." | Yes |
| 17-26 | section differs | register `R-004`; PRD 17 `### Adoption and live-root migration safety`; `## Requirement History` | 17: "Copied-root acceptance does not authorize a live migration." History: "The copied-root acceptance stays a prerequisite for a live migration, not evidence that one happened." `R-004`: "The live-root migration gate for redirect-bearing entity data is stated in [PRD 17 ...]" | Yes |
| 17-28 | section differs | PRD 20 `## Compatibility`; PRD 17 `## Component and Capability Map` | 20: "The entity contract in [17 ...] is part of this compatibility promise." 17: "The entities domain lives inside the one BuildOS TypeScript package at `toolkits/buildos/` ... The entity commands are part of the output compatibility promise in [PRD 20 Compatibility]." | Yes; plan C-51 listed this row as `none`, but the requirement is current, so the trace names its owners |
| 17-46 | low | PRD 17 `## Integrations` | "The pre-upgrade audit prompt at `docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` is proposal-only ... It never writes canonical data, sets a record to `superseded`, or adds a redirect." | Yes, restated under the P1 owner decision; P4 moves the prompt to that path |
| 17-47 | medium | PRD 17 `### Adoption and live-root migration safety`; register `R-004` | "Live-root migration requires snapshot evidence, strict validation, and deterministic index reproduction. The change of the pinned version and the migration of live data are separate cutovers, and each needs its own approval." | Yes; the package version pin replaces the binary cutover |
| 18-02 | medium | PRD 02 `### Domain ownership` | "The package boundary does not merge domain boundaries ... Cross-domain calls use in-package interfaces and never subprocesses." | Yes, now general for every domain |
| 18-04 | section differs | PRD 20 `## Command Surface`; `## Scope` | Command Surface domain table, with `buildos init`. Scope out of scope: "`buildos update`, `buildos uninstall`, and project sync. W2 owns them" | Yes |
| 18-06 | section differs | PRD 20 `## Output and Exit Contract` | "The JSON envelope has at least these fields:" with `ok`, `command`, `version`, `source_revision`, `root`, `mode`, `write_status`, `result`, `diagnostics` | Yes |
| 18-07 | section differs | PRD 20 `## Output and Exit Contract` | The code table: `0`, `1`, `2`, `3`, `4`, `5`, `6`, `10` | Yes; `1` and `10` are added |
| 18-08 | section differs | PRD 20 `## Output and Exit Contract` | "In JSON mode, diagnostics are stable records. In human mode, they are short messages on stderr. Informational and legacy-name notices go to stderr. They never change stdout or the exit code of a successful command." | Yes |
| 18-09 | section differs | PRD 20 `## Output and Exit Contract` | "`write_status` is one of these values:" `not_requested`, `planned`, `applied`, `canonical_applied_index_failed` | Yes |
| 18-10 | section differs | PRD 20 `## Output and Exit Contract` | "A source build reports version `dev` and source revision `unknown`. A release build sets both." | Yes |
| 18-12 | gap | PRD 17 `### Entity commands` | The invocation block for `resolve`, `validate`, `consolidate`, and `rebuild-index`, and: "Every entity command requires an explicit `--root` and an explicit `--mode` of `compat` or `strict` ... `consolidate` is a dry run by default ... `rebuild-index` checks by default when neither `--check` nor `--apply` is present. `--check` and `--apply` are mutually exclusive." | Yes; checked against the Go parser in P1 (B3) |
| 18-15 | medium, section differs | PRD 07 and 10 `## Component and Capability Map`; PRD 11 `## Contracts and Data`; PRD 20 `## Command Surface` | 07: "`buildos intake convert` ... `buildos intake index references` and `buildos intake index playbooks`". 10: "`buildos discovery run` ... Record a discovery run and its raw findings" and "`buildos discovery qualify`". 11: "`buildos design promote finding ...`" | Yes |
| 18-16 | review fix | PRD 20 `## Compatibility` | "The earlier Go code for a domain stays in the repository until that domain passes its parity gate. ... Only then may the Go code for that domain be removed." | Yes; rewrite design decision 3 |
| 18-18 | section differs; review fix | PRD 20 `## Release`; `## Runtime and Package` | `## Release`: "The first public version is `0.1.0`." `## Runtime and Package`: "It is one npm package named `@brucewaynedecoy/buildos`, licensed Apache-2.0." | Yes; rewrite design decision 4 |
| 18-19 | PRD differs; review fix | PRD 20 `## Release`; `## Supply Chain`; register `R-003` | 20: "BuildOS ships no Homebrew formula and no per-OS archive" (`## Runtime and Package`), "A CycloneDX SBOM is attached to the release", "`npm stage publish --provenance` stages the package". `R-003`: "W2 owns ... their upgrade, rollback, and uninstall smoke tests. W2 also owns ... the upgrade compatibility notes that the earlier archive and Homebrew release contract required with each release." | Yes; archives, Homebrew, and signing are withdrawn. The smoke tests and upgrade compatibility notes are deferred to W2 in `R-003` |
| 18-21 | medium, PRD differs; review fix | register `R-003`; PRD 20 `## Scope` | `R-003`: "W2 owns the remaining installation-lifecycle commands, `setup` backup and removal beyond `buildos init`, `buildos update`, and `buildos uninstall` ... W2 also owns the managed, adopter-owned, derived, and merge-required file classifications in `.os/manifest.json` ..." `To close`: "This item does not close before that acceptance." 20 `## Scope`: "W2 owns them and extends `.os/manifest.json` for them." | Yes (design decision 6) |
| 19-02 | `none` vs proposal | `none` | 20 `## Scope`: "An MCP server. The core and CLI seam reserves it." | Never approved; `Q-012` tracks MCP |
| 19-08 | medium | PRD 08 `## Contracts and Data`; register `Q-003` | "All data is NDJSON/CSV — no SQLite ... structured fields are canonical in `.os/data/*.jsonl`" | Yes for the current part; other projections stay open in `Q-003` |
| 19-09 | medium, section differs | PRD 20 `## Command Surface`; register `R-006` | "The core returns typed results and typed errors." | Yes for typed results; result versioning stays open in `R-006` |
| 19-12 | medium | `none` | 20: "`buildos init --dry-run` shows the plan and writes nothing." 17: "`consolidate` is a dry run by default." 11 `## Contracts and Data`: `buildos design promote finding ... [--dry-run]` | Never approved as a general rule; the three dry runs are current |
| 19-13 | section differs | PRD 20 `## Output and Exit Contract` | "Exit codes fall into these classes: success, usage error, contract or validation failure, needs operator review, and internal failure." | Yes |
| 19-14 | medium | `none` | 20 exit `6`: "The diagnostic names the exact recovery command." | Never approved as a general rule; `R-005` tracks recovery |
| 19-16 | medium, section differs | PRD 20 `## Runtime and Package`; register `R-007` | 20: "BuildOS is local-only. The CLI makes no network calls." `R-007`: "Durable provenance can unintentionally retain secrets or identifying context" | The network part is current in 20; secrets and privacy stay open in `R-007`; the rest was never approved |
| 19-19 | `none` vs proposal | `none` | Current facts are in 07, 10, 11, and 17 (for example the 17 resolver result and the 10 run and finding records) | Never approved; `Q-011` keeps the capability contracts as MCP input |
| 19-20 | range differs; review fix | register `Q-001`, `Q-003` to `Q-011`, and `R-001` to `R-008` (Disposition lines) | `Q-011`: "**Disposition**: DI-017 is deferred by W1 R7. No implementation authority follows from PRD 19." `Q-012` has no `**Disposition**` line and names no DI ID; it says the PRD 19 capability map and decision inventory "are input to that revision for the MCP adapter. They are not current authority." | Yes; the proposal listed `Q-012`, but no DI disposition lives there, so the range ends at `Q-011` |
| 19-22 | medium, section differs | PRD 20 `## Command Surface`; `## Scope` | "BuildOS is one `buildos` executable with domain commands". Out of scope: "An MCP server." | Yes |
| 19-23 | medium, section differs | PRD 20 `## Command Surface`; PRD 08 `## Contracts and Data`; register `Q-003` | 20: "Only the core applies BuildOS domain rules and makes authoritative BuildOS writes." 08: "no SQLite" | Yes for the current part; server and cache authority stay open in `Q-003` |
| 19-24 | section differs | PRD 05 `## Integrations`; PRD 20 `## Make Docs Companion Setup`; register `R-009` | 05: "BuildOS ships no Make Docs content and never writes Make Docs-owned files or global state itself." 20: "BuildOS never writes Make Docs-owned files or Make Docs global state itself." | Yes; `R-009` tracks the `design promote` exception |
| 19-26 | section differs | PRD 11 `## Contracts and Data`; PRD 20 `## Command Surface`; register `R-009` | 11: "Current limitation: `buildos design promote` keeps its existing behavior so that output parity holds, and it still writes a design file under `docs/designs/` ... The conflict is tracked as `R-009`" | Yes as a limitation; the `HOF-001` export was never approved |
| 19-27 | section differs | PRD 05 `## Integrations`; PRD 20 `## Make Docs Companion Setup` | 05: "BuildOS runs without Make Docs. Make Docs is an optional companion." 20: "BuildOS runs Make Docs through its public CLI only." | Yes |

### Stop rule (t10)

First pass: no row failed t8. The implementer judged that every row passed t9.

Review round 1: the stop rule fired. The reviewer found rows whose owner did not state the requirement, or whose `none` hid a current rule. The implementer fixed each one in this phase. Each fix only moves existing meaning from the legacy PRDs and the rewrite design:

- 18-16: PRD 20 `## Compatibility` now states that the Go code for a domain is removed only after that domain passes its parity gate (rewrite design decision 3; legacy PRD 18).
- 18-18: PRD 20 `## Release` now states that the first public version is `0.1.0`, what it needs before it ships, and that `0.2.0` adds the later commands (rewrite design decision 4).
- 17-14, 14-12, 15-06: the `none` cells now name the owner sections that state the surviving rules. Each row names what is retired. No owner text was needed; the rules were already stated.
- 16-04, 16-05: PRD 02 `### Domain ownership` and register `Q-014` now name active-only runnable-playbook resolution and playbook contract validation as open ownership decisions, as legacy PRD 16 did.
- 18-19, 18-21: register `R-003` now names the manifest ownership classifications and the upgrade compatibility notes as deferred to W2. Its `To close` requires the W2 design to accept the handoff.
- 19-12: the `none` reason now names all three current dry runs.

No fix replaces a prior contract, so no `## Requirement History` entry was needed. No row needed an owner decision.

### P5 trace recheck (t4)

- Method: a temporary script in `$TMPDIR` read the `Final owner` cell of every row in section 2 of the [requirement inventory](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md#2-requirement-inventory-per-legacy-prd). For each `PRD NN <heading>` reference it checked that the heading exists in the active PRD with that number. For each register reference, including ranges such as `Q-003 to Q-011`, it checked that the item exists.
- Result: 155 rows, every cell filled. 119 name an owner and 36 are `none` with a reason. 169 heading references and 48 register references, 0 missing. The script counts references by a pattern, so its heading count differs from the 172 that the P3 reviewer counted by hand; neither count found a missing section.
- Old filename: no `Final owner` cell names PRD 17 by its old filename, so no cell text changed. The one old PRD 17 filename in the inventory is in section 1, the validator breakdown, which is read-only research text.

## Change-Note Dispositions

Baseline: commit `c14c5fa`. Line numbers are from that commit. Method: a script listed every bullet under a `### Change Notes` heading in `docs/prd/01-*.md` to `docs/prd/12-*.md` that links or names a file `13-*` to `19-*`.

Count: 65 bullets, matching the phase overview: 01 ×6, 02 ×11, 04 ×2, 05 ×4, 06 ×4, 07 ×3, 08 ×10, 09 ×7, 10 ×6, 11 ×6, 12 ×6. Three more bullets are listed and marked "extra" (X1 to X3). They name PRD 14, 16, or 19 by number, not by file, or they sit next to such a bullet. See [Extra bullets](#extra-bullets).

Dispositions for the 65: `body` 10, `history` 2, `delete` 53. With the extras: `body` 10, `history` 2, `delete` 54, `keep` 2.

| # | PRD:line | Section | Points at | Bullet in short | Disposition | Target or reason |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 01:35 | `## Key Capabilities` | 17 | Entity consolidation, canonical resolution, persona reuse | `body` | New `Entity identity` bullet in `## Key Capabilities`, linked to PRD 17 |
| 2 | 01:36 | `## Key Capabilities` | 19 | Core-operation inventory with CLI and MCP parity in one Go distribution | `delete` | Never approved. PRD 20 owns runtime and delivery (Node, no MCP). The 01 W1 R7 history entry records the Go and MCP plan |
| 3 | 01:50 | `## System Boundaries` | 19 | Make Docs reached only through public operations | `delete` | Stated in the 01 `## System Boundaries` body and PRD 20 `## Make Docs Companion Setup` |
| 4 | 01:66 | `## Current Limitations` | 13 | Config replaces concrete scoped placeholders | `delete` | Stated in the 01 `## Current Limitations` body and PRD 13 |
| 5 | 01:67 | `## Current Limitations` | 17 | Data layer delivery includes resolver, index, toolkit, staged source-build migration | `delete` | PRD 17 owns the entity contract. Source-build migration is a prior contract in the PRD 17 W1 R8 history. The stale greenfield sentence goes to P3 (R10) |
| 6 | 01:68 | `## Current Limitations` | 19 | Readiness governed by the Phase 1 capability-map gate | `delete` | Never approved. `D-005` and `Q-012` track the gate and MCP |
| 7 | 02:19 | `## Topology` | 19 | One Go program with core, CLI, and MCP | `delete` | Never approved. 02 `## Topology` body and PRD 20 `## Runtime and Package`. The 02 W1 R7 history entry records the Go plan |
| 8 | 02:64 | `## Module Map` | 17 | Redirect rows, entity-resolution index, `toolkits/buildos-entities/` | `delete` | The 02 domain table `entities` row and PRD 17 own it. The separate toolkit layout is in the 02 W1 R8 history |
| 9 | 02:65 | `## Module Map` | 19 | Core domains in the Go program with CLI and MCP adapters | `delete` | Never approved. 02 `## Module Map` body and PRD 20 `## Command Surface` hold the core and adapter rules |
| 10 | 02:80 | `## Runtime Boundaries` | 17 | Distinct runtime boundaries; separate approvals for binaries and live data | `delete` | 02 `## Runtime Boundaries` body names the three boundaries. PRD 17 `### Adoption and live-root migration safety` owns live-data approval. Binary approval is in the PRD 17 W1 R8 history |
| 11 | 02:81 | `## Runtime Boundaries` | 19 | Core owns semantics; CLI and MCP share one surface | `delete` | PRD 20 `## Command Surface` and the 02 body. No MCP in the current product |
| 12 | 02:95 | `## Data Flow` | 15 | Flow A uses `draft` rows; `candidate` only for converted sources | `delete` | 02 `## Data Flow` body names draft rows. 07 and 08 `## Contracts and Data` own the `candidate` rule |
| 13 | 02:96 | `## Data Flow` | 17 | Reads expose canonical IDs; new references store canonical IDs | `delete` | 08 `## Integrations` and PRD 17 `### Terminal resolution` |
| 14 | 02:97 | `## Data Flow` | 19 | Every flow step a core operation; Flow C an export | `delete` | Never approved. 11 owns the hand-off and its current limitation (`R-009`) |
| 15 | 02:110 | `## Configuration Surfaces` | 13 | `env`/`for` replaced by config-backed lists | `delete` | The P1 body fix stands alone. The 02 W1 R8 history holds the prior contract |
| 16 | 02:111 | `## Configuration Surfaces` | 14 | Tooling under `toolkits/` as packaged `buildos-*` CLIs | `delete` | 02 `## Module Map` and PRD 20. The 02 W1 R7 history records separate `buildos-*` binaries |
| 17 | 02:113 | `## Configuration Surfaces` | 19 | Config as a core operation surface; registry and identity decisions | `delete` | Never approved. PRD 13 `## Scope` and `Q-006`, `Q-007` |
| 18 | 04:47 | `## Terms` | 15 | `draft` is the pending term; `candidate` is not an entity status | `body` | `Draft` row now says `candidate` is never an entity or extraction row status |
| 19 | 04:48 | `## Terms` | 17 | Consolidation vocabulary | `delete` | The five terms are rows in the `## Terms` table |
| 20 | 05:25 | `## Scope` | 19 | Scope splits program, project state, UI and server, companion | `delete` | Never approved. 05 `## Scope` body and PRD 20 |
| 21 | 05:45 | `## Component and Capability Map` | 19 | Go distribution with core, CLI, MCP | `delete` | 05 `## Installed Project Paths` and PRD 20 `## Runtime and Package` |
| 22 | 05:59 | `## Contracts and Data` | 19 | BuildOS does not own Make Docs state | `delete` | 05 `## Integrations` body: BuildOS never writes Make Docs-owned files or global state |
| 23 | 05:80 | `## Integrations` | 19 | Profile invokes Make Docs setup and records a receipt | `delete` | 05 `## Integrations` body and PRD 20 `## Make Docs Companion Setup`. `Q-010` and `R-001` stay open |
| 24 | 06:36 | `## Component and Capability Map` | 13 | `.os/` owns `config/`: `instance.yaml`, config contract, starter template | `body` | New `.os/config/` row and `config` in `## Scope`. The `validate_config.py` part is replaced by `buildos validate` (06 W1 R7 history) |
| 25 | 06:37 | `## Component and Capability Map` | 14 | New logic under `toolkits/` as `buildos-*` binaries | `delete` | 06 `.os/scripts/` row and 02 `### Domain ownership`. The 06 W1 R7 history records the binaries |
| 26 | 06:38 | `## Component and Capability Map` | 19 | Core capability inventory defines behavior | `delete` | Never approved |
| 27 | 06:64 | `## Contracts and Data` | 19 | Only core operations interpret authority | `delete` | Never approved. PRD 20 `## Command Surface` holds the core rules |
| 28 | 07:31 | `## Component and Capability Map` | 19 | `buildos-intake` behind core operations with MCP parity | `delete` | Never approved. 07 body and PRD 20 `## Compatibility` |
| 29 | 07:61 | `## Contracts and Data` | 14 | Converters in `toolkits/buildos-intake/` | `delete` | 07 body: converters in `toolkits/buildos/`. The 07 W1 R7 history records the Go toolkit |
| 30 | 07:63 | `## Contracts and Data` | 19 | Intake writes as core-operation contracts | `delete` | Never approved |
| 31 | 08:31 | `## Component and Capability Map` | 17 | Redirect rows, resolution, index, persona consolidation | `delete` | PRD 17 `## Component and Capability Map`. 08 `## Contracts and Data` links to PRD 17 for the redirect rules |
| 32 | 08:32 | `## Component and Capability Map` | 19 | Data contract as core operations | `delete` | Never approved |
| 33 | 08:52 | `## Contracts and Data` | 13 | Rows use config-backed scoped lists; validators reject legacy fields | `body` | New scoped-metadata paragraph in 08 `## Contracts and Data` keeps the rule: validation rejects an entity row with a legacy scoped field, a sentinel value such as `both`, or an unconfigured ID. PRD 13 `### buildos validate checks` (Scoped data references) now lists the rejection, matching 12 `## Contracts and Data`. The "after the migration lands" condition is dropped, because PRD 13 checks are unconditional. The legacy validator gap is P3 item R8 |
| 34 | 08:53 | `## Contracts and Data` | 15 | `draft` pending state; non-draft rows need `doc_anchor` | `delete` | 08 `### Draft lifecycle and anchors`. The 08 W1 R8 history holds the prior contract |
| 35 | 08:54 | `## Contracts and Data` | 17 | Redirects, derived reverse membership, `related`, strict mode | `delete` | PRD 17 `### Lifecycle and redirects` and `### Strict and compatibility modes` |
| 36 | 08:55 | `## Contracts and Data` | 19 | Authority and receipts as Phase 1 decisions | `delete` | Never approved |
| 37 | 08:69 | `## Integrations` | 17 | Readers show both IDs; producers store canonical IDs | `delete` | 08 `## Integrations` body, second paragraph |
| 38 | 08:70 | `## Integrations` | 19 | Integrations through core operations | `delete` | Never approved |
| 39 | 08:82 | `## Rebuild Notes` | 17 | Rebuilds validate the graph and reproduce the index byte for byte | `delete` | PRD 17 `### Entity commands`, `### Derived index`, and `### Acceptance`; 07 owns `references.json` |
| 40 | 08:83 | `## Rebuild Notes` | 19 | Rebuild, validate, repair, recover as operations | `delete` | Never approved |
| 41 | 09:32 | `## Component and Capability Map` | 19 | `PBK-001` operation family | `delete` | Never approved |
| 42 | 09:46 | `## Contracts and Data` | 13 | No `env`/`for` or `both`; config-backed lists | `body` | Body listed `env`/`for`; corrected to the three lists, plus a new paragraph. The `both` ban covers only the scoped fields; `audience: both` stays valid (`playbook-contract.md`). The prior contract is in a new 09 W1 R8 history entry |
| 43 | 09:47 | `## Contracts and Data` | 17 | Playbook targets resolve canonically | `delete` | 09 `## Contracts and Data` body written in P1 |
| 44 | 09:48 | `## Contracts and Data` | 19 | Inspect, validate, select as core operations | `delete` | Never approved |
| 45 | 09:60 | `## Integrations` | 17 | Execution resolves targets; new references store canonical IDs | `delete` | 09 `## Contracts and Data` (resolution), 08 `## Integrations` (producers), 10 `## Integrations` (execution) |
| 46 | 09:61 | `## Integrations` | 19 | Same core semantics through CLI or MCP | `delete` | Never approved |
| 47 | 09:73 | `## Rebuild Notes` | 17 | Validation and catalog rebuilds reject bad chains, keep text | `body` | New sentence in 09 `## Rebuild Notes`. See P3 item R9 |
| 48 | 10:33 | `## Component and Capability Map` | 19 | `RUN`, `FND`, `QLF` core operations | `delete` | Never approved. `Q-001` tracks qualification authority |
| 49 | 10:47 | `## Contracts and Data` | 13 | Runs and findings keep scoped lists through qualification | `body` | New paragraph in 10 `## Contracts and Data` |
| 50 | 10:48 | `## Contracts and Data` | 16 | Flow B logic belongs in `buildos-discovery` | `delete` | 02 domain table `discovery` row. The 02 W1 R8 history records the old toolkit names |
| 51 | 10:49 | `## Contracts and Data` | 17 | Discovery resolves targets and run IDs before writes | `delete` | 10 `## Contracts and Data` body, second paragraph |
| 52 | 10:50 | `## Contracts and Data` | 19 | Run and finding transitions in the capability map | `delete` | Never approved. `Q-001` |
| 53 | 10:62 | `## Integrations` | 19 | Integrations as core operations | `delete` | Never approved |
| 54 | 11:19 | `## Scope` | 19 | Ends at an `HOF-001` export receipt | `delete` | Never approved. 11 body and `R-009` state current promotion |
| 55 | 11:37 | `## Component and Capability Map` | 19 | `HOF-001` replaces direct design creation | `delete` | Never approved. 11 current limitation and `R-009` |
| 56 | 11:65 | `## Contracts and Data` | 13 | Hand-off passes lists, not `env`/`for` | `history` | Body already states the lists. New 11 W1 R8 history entry |
| 57 | 11:66 | `## Contracts and Data` | 16 | Promotion in `buildos-design`; stage movers separate | `delete` | 02 domain table `design` row and the unowned stage-mover sentence; 11 `## Rebuild Notes` |
| 58 | 11:67 | `## Contracts and Data` | 19 | External-handoff package instead of a design write | `delete` | Never approved. 11 current limitation and `R-009` |
| 59 | 11:84 | `## Integrations` | 19 | Public lifecycle API; removal leaves Make Docs | `delete` | 11 `## Integrations` body. Uninstall is out of scope in PRD 20 (W2) |
| 60 | 12:29 | `## Component and Capability Map` | 14 | Movers call packaged `buildos-*` toolkits as routers | `body` | New paragraph after the 12 table. Prior contract in the new 12 W1 R8 history entry |
| 61 | 12:30 | `## Component and Capability Map` | 16 | Movers call the owning domain, add no durable script logic | `body` | Same paragraph, linked to 02 `### Domain ownership`. Stage-mover ownership is not written; see P3 item R11 |
| 62 | 12:31 | `## Component and Capability Map` | 19 | Movers as adapters over core operations | `delete` | Never approved |
| 63 | 12:45 | `## Contracts and Data` | 13 | Movers run `validate_config.py`; fail after migration lands | `body` | Body already used `buildos validate`. Corrected: dropped "after the config migration lands", because PRD 13 says the check is unconditional. Recorded in the 12 W1 R8 history entry |
| 64 | 12:46 | `## Contracts and Data` | 16 | Config checks route through `buildos-config` | `history` | No `buildos-config` exists; 02 domain table `validate` row. New 12 W1 R8 history entry |
| 65 | 12:47 | `## Contracts and Data` | 19 | Automation sequences only core operations | `delete` | Never approved |

### Extra bullets

These do not link a file `13-*` to `19-*`, so they are outside the 65. X1 and X3 name PRDs 14, 16, or 19 by number and would point at removed notes. X2 never pointed at PRDs 13 to 19, so it is outside the fold and stays.

| # | PRD:line | Section | Bullet in short | Disposition | Reason |
| --- | --- | --- | --- | --- | --- |
| X1 | 07:64 | `## Contracts and Data` | W1 R7: "the notes above that cite PRDs 14 and 19, and the Go package ... are not current authority" | `keep` (trimmed) | Kept in 07 `### Change Notes`, after the X2 note it corrects. The references to PRDs 14 and 19 and the MCP sentence, which only served the removed notes, are removed. The Go-package clarification stays. The rest is in the 07 body and the 07 W1 R7 history |
| X2 | 07:62 | `## Contracts and Data` | W1 R0 P3 PDF posture, Go package | `keep` | Out of the fold: it never pointed at PRDs 13 to 19. Restored byte for byte, so the 07 `## Contracts and Data` `### Change Notes` section stays, with X1 after it. The 07 body also states "no plan for richer PDF extraction", so the body holds the current rule without the note |
| X3 | 11:68 | `## Contracts and Data` | W1 R7: "the PRD 19 notes in this document are not current authority" | `delete` | It names PRD 19 and would point at removed notes. The 11 body states the current limitation, and the 11 W1 R7 history records it |

Kept bullets (not pointing at PRDs 13–19): the 07 `## Contracts and Data` notes X2 and X1 (trimmed); the PRD 20 notes in 01 `## Key Capabilities`, 02 (four sections), 04 `## Terms`, 05 (three sections), and 06 `## Component and Capability Map`; and the W1 R7 notes in 11 `## Integrations` and 12 `## Contracts and Data`. They stay as they are.

### Per-PRD counts

| PRD | Bullets | `body` | `history` | `delete` | `keep` | Empty `### Change Notes` sections removed |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 6 | 1 | 0 | 5 | 0 | 2 |
| 02 | 11 | 0 | 0 | 11 | 0 | 1 |
| 04 | 2 | 1 | 0 | 1 | 0 | 0 |
| 05 | 4 | 0 | 0 | 4 | 0 | 1 |
| 06 | 4 | 1 | 0 | 3 | 0 | 1 |
| 07 | 3 + 2 extra | 0 | 0 | 3 | 0 + 2 | 1 |
| 08 | 10 | 1 | 0 | 9 | 0 | 4 |
| 09 | 7 | 2 | 0 | 5 | 0 | 4 |
| 10 | 6 | 1 | 0 | 5 | 0 | 3 |
| 11 | 6 + 1 extra | 0 | 1 | 5 + 1 | 0 | 3 |
| 12 | 6 | 3 | 1 | 2 | 0 | 1 |
| Total | 65 + 3 | 10 | 2 | 53 + 1 | 0 + 2 | 21 |

### History entries written

| PRD | Entry | Covers |
| --- | --- | --- |
| 09 | `2026-11-23 — W1 R8`, `## Contracts and Data`, scoped frontmatter | Body correction for row 42 |
| 11 | `2026-11-23 — W1 R8`, `## Contracts and Data`, hand-off scope metadata | Row 56 |
| 12 | `2026-11-23 — W1 R8`, `## Component and Capability Map`, `## Contracts and Data` | Rows 60, 63, and 64 |

Each entry has the date, coordinate, affected section, previous contract, replacement contract, rationale, and a source link to the design. 09 and 12 got a new `## Requirement History` section before `## Source Anchors`.

One existing entry changed: the PRD 13 W1 R8 `buildos validate` checks entry now names the entity-row legacy-field rejection in its previous and replacement contracts (row 33 review fix).

### t15 search

Command: `grep -nE '1[3-9]-(adopter|revise|enhance)' docs/prd/0[1-9]-*.md docs/prd/1[0-2]-*.md`. No hit is inside a `### Change Notes` section. Line numbers below are after P2.

- Body links to PRD 13: 02:45 and 02:90, 04:34 to 04:36 (Notes column), 06:23, 08:33, 09:34, 10:37, 12:33.
- Body links to PRD 17, which P4 renames: 01:22, 02:40, 07:33, 08:41, 08:51, 09:36, 11:43.
- `## Source Anchors` lines: 06:90 (14), 07:92 (14), 11:102 (13), 11:103 (16), 12:73 (14).
- Register lines, which P3 and P4 own: 03:48 and 03:165 (code anchors), 03:571 and 03:744 (source anchors).

## Recorded Reviewed Moves

P4 rule: option A (see `## Owner Decisions`). Every move and every link repair inside `.make-docs/archive/` is listed here. Totals: 38 moves, 178 link repairs inside the archived copies, and 34 link repairs in history records. The tables were generated from the repair scripts' logs, and a second script counted the changed `](...)` targets in `git diff -M HEAD` for `.make-docs/archive/`: 212, the same number.

### Archive surface (t2)

`make-docs project surface ensure archive` did not run. Inside the sandbox it stopped with `store-unavailable` (no Store access). Outside the sandbox it stopped with `This project does not have verified installation evidence in the Store. Run make-docs setup reconfigure before you ensure a project surface.` No project file changed. Only that operation stopped. `.make-docs/archive/` already existed with its `AGENTS.md` and `CLAUDE.md` routers and `history/`. The implementer created `.make-docs/archive/prds/2026-11-23/` and `.make-docs/archive/work/` as plain directories for the `git mv` moves; both are usable. The `make-docs setup reconfigure` repair is left to the owner.

### Audit prompt (t6)

The P1 decision was **move**. The prompt moved with `git mv`, byte-identical. The prompt text has no PRD 17 mention to turn into a link. PRD 17 `## Integrations` now links the prompt at its new path instead of naming it as a code path.

### Moves (t3 to t7)

Each move used `git mv`. Similarity is from `git diff -M --name-status HEAD` (100 means byte-identical). Every archived file that changed differs only in link targets: a script compared each file with its `HEAD` version after removing every `](...)` target and found no other difference (0 of 36 archived files). The PRD 17 rename also changes the H1 and the PRD 17 link to the audit prompt.

| # | Source | Destination | Similarity |
| --- | --- | --- | --- |
| 1 | `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `docs/prd/17-entity-identity-and-canonical-resolution.md` | 99% |
| 2 | `docs/prd/14-revise-deterministic-toolkit-deployment.md` | `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 79% |
| 3 | `docs/prd/15-revise-extraction-draft-lifecycle.md` | `.make-docs/archive/prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` | 77% |
| 4 | `docs/prd/16-revise-toolkit-ownership-boundaries.md` | `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` | 89% |
| 5 | `docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 92% |
| 6 | `docs/prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 96% |
| 7 | `docs/work/2026-06-03-w1-r0-build-os-baseline/00-index.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/00-index.md` | 86% |
| 8 | `docs/work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md` | 93% |
| 9 | `docs/work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md` | 91% |
| 10 | `docs/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md` | 95% |
| 11 | `docs/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md` | 92% |
| 12 | `docs/work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md` | 92% |
| 13 | `docs/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` | 94% |
| 14 | `docs/work/2026-06-03-w1-r0-build-os-baseline/07-flow-c-integration.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/07-flow-c-integration.md` | 89% |
| 15 | `docs/work/2026-06-03-w1-r0-build-os-baseline/08-stage-automation.md` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/08-stage-automation.md` | 89% |
| 16 | `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/00-index.md` | `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/00-index.md` | 100% |
| 17 | `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 81% |
| 18 | `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/02-toolkit-scaffold-validation.md` | `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/02-toolkit-scaffold-validation.md` | 92% |
| 19 | `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | 81% |
| 20 | `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 87% |
| 21 | `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 91% |
| 22 | `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | 88% |
| 23 | `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | 91% |
| 24 | `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 90% |
| 25 | `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 72% |
| 26 | `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/01-unified-command-and-compatibility-contract.md` | `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/01-unified-command-and-compatibility-contract.md` | 89% |
| 27 | `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/02-domain-migration.md` | `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/02-domain-migration.md` | 88% |
| 28 | `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/03-legacy-alias-and-installation-migration.md` | `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/03-legacy-alias-and-installation-migration.md` | 87% |
| 29 | `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/04-packaging-and-release-hardening.md` | `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/04-packaging-and-release-hardening.md` | 91% |
| 30 | `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/05-documentation-deprecation-and-w2-handoff.md` | `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/05-documentation-deprecation-and-w2-handoff.md` | 91% |
| 31 | `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 76% |
| 32 | `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/01-pre-implementation-reconciliation-gate.md` | `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/01-pre-implementation-reconciliation-gate.md` | 90% |
| 33 | `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/02-go-core-cli-and-mcp-contract-seam.md` | `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/02-go-core-cli-and-mcp-contract-seam.md` | 91% |
| 34 | `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/03-project-state-intake-data-and-query-migration.md` | `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/03-project-state-intake-data-and-query-migration.md` | 86% |
| 35 | `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/04-discovery-qualification-and-provenance-migration.md` | `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/04-discovery-qualification-and-provenance-migration.md` | 88% |
| 36 | `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/05-recovery-removal-and-compatibility-migration.md` | `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/05-recovery-removal-and-compatibility-migration.md` | 86% |
| 37 | `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/06-mcp-parity-distribution-evidence-and-program-handoffs.md` | `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/06-mcp-parity-distribution-evidence-and-program-handoffs.md` | 91% |
| 38 | `.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md` | `docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` | 100% |

### Link repairs inside archived PRDs and backlogs (t15, option A)

Path only. The anchor is kept. 178 links in 35 files. One archived file needed no repair.

| File | Line | Old target | New target |
| --- | --- | --- | --- |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 3 | `./00-index.md#current-authority-map` | `../../../../docs/prd/00-index.md#current-authority-map` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 3 | `./20-buildos-cli-and-distribution.md` | `../../../../docs/prd/20-buildos-cli-and-distribution.md` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 13 | `../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md` | `../../../../docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 42 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 52 | `./02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 53 | `./06-operating-layer-and-routing.md` | `../../../../docs/prd/06-operating-layer-and-routing.md` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 54 | `./07-intake-and-conversion.md` | `../../../../docs/prd/07-intake-and-conversion.md` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 55 | `./12-stage-automation.md` | `../../../../docs/prd/12-stage-automation.md` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 56 | `./03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` | 60 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` | 11 | `../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md` | `../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md` |
| `.make-docs/archive/prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` | 35 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` | 40 | `./02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` | 41 | `./04-glossary.md` | `../../../../docs/prd/04-glossary.md` |
| `.make-docs/archive/prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` | 42 | `./08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` | 48 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` | 40 | `./20-buildos-cli-and-distribution.md#command-surface` | `../../../../docs/prd/20-buildos-cli-and-distribution.md#command-surface` |
| `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` | 76 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` | 102 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` | 121 | `../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md` | `../../../../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md` |
| `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` | 135 | `../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md` | `../../../../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 3 | `./00-index.md#current-authority-map` | `../../../../docs/prd/00-index.md#current-authority-map` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 3 | `./20-buildos-cli-and-distribution.md` | `../../../../docs/prd/20-buildos-cli-and-distribution.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 22 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 237 | `./03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 265 | `../designs/2026-07-21-unified-buildos-cli-and-distribution.md` | `../../../../docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 266 | `../plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` | `../../../../docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 269 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 270 | `../../system/.os/contracts/entity-consolidation-contract.md` | `../../../../system/.os/contracts/entity-consolidation-contract.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 271 | `../../system/.os/contracts/persona-identity-contract.md` | `../../../../system/.os/contracts/persona-identity-contract.md` |
| `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` | 272 | `../../system/.os/contracts/extraction-contract.md` | `../../../../system/.os/contracts/extraction-contract.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 3 | `./00-index.md#current-authority-map` | `../../../../docs/prd/00-index.md#current-authority-map` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 3 | `./20-buildos-cli-and-distribution.md` | `../../../../docs/prd/20-buildos-cli-and-distribution.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 9 | `../designs/2026-08-14-build-os-runtime-selection-proof.md` | `../../../../docs/designs/2026-08-14-build-os-runtime-selection-proof.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 9 | `../designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md` | `../../../../docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 26 | `./02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 26 | `./01-product-overview.md` | `../../../../docs/prd/01-product-overview.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 27 | `./05-spaces-boundary-and-shipping.md` | `../../../../docs/prd/05-spaces-boundary-and-shipping.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 28 | `./06-operating-layer-and-routing.md` | `../../../../docs/prd/06-operating-layer-and-routing.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 29 | `./12-stage-automation.md` | `../../../../docs/prd/12-stage-automation.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 29 | `./10-discovery-runs-and-qualification.md` | `../../../../docs/prd/10-discovery-runs-and-qualification.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 29 | `./09-playbooks.md` | `../../../../docs/prd/09-playbooks.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 29 | `./08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 29 | `./07-intake-and-conversion.md` | `../../../../docs/prd/07-intake-and-conversion.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 30 | `./11-flow-c-integration.md` | `../../../../docs/prd/11-flow-c-integration.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 31 | `./13-adopter-owned-config-surface.md` | `../../../../docs/prd/13-adopter-owned-config-surface.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 33 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 610 | `../designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md` | `../../../../docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 611 | `../designs/2026-08-14-build-os-runtime-selection-proof.md` | `../../../../docs/designs/2026-08-14-build-os-runtime-selection-proof.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 613 | `./17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 614 | `./10-discovery-runs-and-qualification.md` | `../../../../docs/prd/10-discovery-runs-and-qualification.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 615 | `./11-flow-c-integration.md` | `../../../../docs/prd/11-flow-c-integration.md` |
| `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 616 | `./03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/00-index.md` | 7 | `../../designs/2026-06-03-build-os-architecture.md` | `../../../../docs/designs/2026-06-03-build-os-architecture.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/00-index.md` | 7 | `../../plans/2026-06-03-w1-r0-build-os-baseline/00-overview.md` | `../../../../docs/plans/2026-06-03-w1-r0-build-os-baseline/00-overview.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md` | 13 | `../../prd/06-operating-layer-and-routing.md` | `../../../../docs/prd/06-operating-layer-and-routing.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md` | 14 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md` | 13 | `../../prd/05-spaces-boundary-and-shipping.md` | `../../../../docs/prd/05-spaces-boundary-and-shipping.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md` | 14 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md` | 15 | `../../prd/07-intake-and-conversion.md` | `../../../../docs/prd/07-intake-and-conversion.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md` | 16 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md` | 17 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md` | 13 | `../../prd/08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md` | 14 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md` | 13 | `../../prd/09-playbooks.md` | `../../../../docs/prd/09-playbooks.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md` | 14 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` | 15 | `../../prd/10-discovery-runs-and-qualification.md` | `../../../../docs/prd/10-discovery-runs-and-qualification.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` | 16 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` | 17 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` | 43 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/07-flow-c-integration.md` | 13 | `../../prd/11-flow-c-integration.md` | `../../../../docs/prd/11-flow-c-integration.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/07-flow-c-integration.md` | 14 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/08-stage-automation.md` | 13 | `../../prd/12-stage-automation.md` | `../../../../docs/prd/12-stage-automation.md` |
| `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/08-stage-automation.md` | 14 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 13 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 14 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 15 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 16 | `../../prd/06-operating-layer-and-routing.md` | `../../../../docs/prd/06-operating-layer-and-routing.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 17 | `../../prd/07-intake-and-conversion.md` | `../../../../docs/prd/07-intake-and-conversion.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 18 | `../../prd/12-stage-automation.md` | `../../../../docs/prd/12-stage-automation.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 38 | `../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md` | `../../../../docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/02-toolkit-scaffold-validation.md` | 13 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/02-toolkit-scaffold-validation.md` | 14 | `../../prd/07-intake-and-conversion.md` | `../../../../docs/prd/07-intake-and-conversion.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | 7 | `../../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md` | `../../../../docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | 7 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | 9 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | 10 | `../../plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` | `../../../../docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | 33 | `../../../.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md` | `../../../../docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 13 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 14 | `../../prd/08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 15 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 16 | `../../prd/15-revise-extraction-draft-lifecycle.md` | `../../prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 17 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 18 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 13 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 14 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 15 | `../../prd/08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 16 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 17 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 18 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | 13 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | 14 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | 15 | `../../prd/08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | 16 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | 17 | `../../prd/15-revise-extraction-draft-lifecycle.md` | `../../prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | 23 | `../../../.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md` | `../../../../docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | 13 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | 14 | `../../prd/08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | 15 | `../../prd/09-playbooks.md` | `../../../../docs/prd/09-playbooks.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | 16 | `../../prd/10-discovery-runs-and-qualification.md` | `../../../../docs/prd/10-discovery-runs-and-qualification.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | 17 | `../../prd/15-revise-extraction-draft-lifecycle.md` | `../../prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 13 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 14 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 15 | `../../prd/01-product-overview.md` | `../../../../docs/prd/01-product-overview.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 16 | `../../prd/02-architecture-overview.md` | `../../../../docs/prd/02-architecture-overview.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 17 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 18 | `../../prd/04-glossary.md` | `../../../../docs/prd/04-glossary.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 19 | `../../prd/08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 20 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 3 | `../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` | `../../../../docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 11 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 11 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 11 | `../../plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` | `../../../../docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 11 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 41 | `../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` | `../../../../docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 45 | `../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md` | `../../../../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/01-unified-command-and-compatibility-contract.md` | 13 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/01-unified-command-and-compatibility-contract.md` | 14 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/01-unified-command-and-compatibility-contract.md` | 15 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/01-unified-command-and-compatibility-contract.md` | 16 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/02-domain-migration.md` | 13 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/02-domain-migration.md` | 14 | `../../prd/07-intake-and-conversion.md` | `../../../../docs/prd/07-intake-and-conversion.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/02-domain-migration.md` | 15 | `../../prd/10-discovery-runs-and-qualification.md` | `../../../../docs/prd/10-discovery-runs-and-qualification.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/02-domain-migration.md` | 16 | `../../prd/11-flow-c-integration.md` | `../../../../docs/prd/11-flow-c-integration.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/02-domain-migration.md` | 17 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/03-legacy-alias-and-installation-migration.md` | 13 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/03-legacy-alias-and-installation-migration.md` | 14 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/03-legacy-alias-and-installation-migration.md` | 15 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/03-legacy-alias-and-installation-migration.md` | 16 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/04-packaging-and-release-hardening.md` | 13 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/04-packaging-and-release-hardening.md` | 14 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/04-packaging-and-release-hardening.md` | 15 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/05-documentation-deprecation-and-w2-handoff.md` | 13 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/05-documentation-deprecation-and-w2-handoff.md` | 14 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/05-documentation-deprecation-and-w2-handoff.md` | 15 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/05-documentation-deprecation-and-w2-handoff.md` | 16 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/05-documentation-deprecation-and-w2-handoff.md` | 17 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 3 | `../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` | `../../../../docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 9 | `../../plans/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation/00-overview.md` | `../../../../docs/plans/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation/00-overview.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 9 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 9 | `../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `../../prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 13 | `../../plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` | `../../../../docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 48 | `../../prd/03-open-questions-and-risk-register.md#q-012-when-to-build-the-mcp-adapter` | `../../../../docs/prd/03-open-questions-and-risk-register.md#q-012-when-to-build-the-mcp-adapter` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 48 | `../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` | `../../../../docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 52 | `../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md` | `../../../../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/01-pre-implementation-reconciliation-gate.md` | 13 | `../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `../../prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/01-pre-implementation-reconciliation-gate.md` | 14 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/01-pre-implementation-reconciliation-gate.md` | 15 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/02-go-core-cli-and-mcp-contract-seam.md` | 13 | `../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `../../prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/02-go-core-cli-and-mcp-contract-seam.md` | 14 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/02-go-core-cli-and-mcp-contract-seam.md` | 15 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/03-project-state-intake-data-and-query-migration.md` | 13 | `../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `../../prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/03-project-state-intake-data-and-query-migration.md` | 14 | `../../prd/07-intake-and-conversion.md` | `../../../../docs/prd/07-intake-and-conversion.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/03-project-state-intake-data-and-query-migration.md` | 15 | `../../prd/08-data-and-extraction.md` | `../../../../docs/prd/08-data-and-extraction.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/03-project-state-intake-data-and-query-migration.md` | 16 | `../../prd/13-adopter-owned-config-surface.md` | `../../../../docs/prd/13-adopter-owned-config-surface.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/03-project-state-intake-data-and-query-migration.md` | 17 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/04-discovery-qualification-and-provenance-migration.md` | 13 | `../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `../../prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/04-discovery-qualification-and-provenance-migration.md` | 14 | `../../prd/09-playbooks.md` | `../../../../docs/prd/09-playbooks.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/04-discovery-qualification-and-provenance-migration.md` | 15 | `../../prd/10-discovery-runs-and-qualification.md` | `../../../../docs/prd/10-discovery-runs-and-qualification.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/04-discovery-qualification-and-provenance-migration.md` | 16 | `../../prd/11-flow-c-integration.md` | `../../../../docs/prd/11-flow-c-integration.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/04-discovery-qualification-and-provenance-migration.md` | 17 | `../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/05-recovery-removal-and-compatibility-migration.md` | 13 | `../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `../../prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/05-recovery-removal-and-compatibility-migration.md` | 14 | `../../prd/14-revise-deterministic-toolkit-deployment.md` | `../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/05-recovery-removal-and-compatibility-migration.md` | 15 | `../../prd/16-revise-toolkit-ownership-boundaries.md` | `../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/05-recovery-removal-and-compatibility-migration.md` | 16 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/06-mcp-parity-distribution-evidence-and-program-handoffs.md` | 13 | `../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `../../prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/06-mcp-parity-distribution-evidence-and-program-handoffs.md` | 14 | `../../prd/03-open-questions-and-risk-register.md` | `../../../../docs/prd/03-open-questions-and-risk-register.md` |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/06-mcp-parity-distribution-evidence-and-program-handoffs.md` | 15 | `../../prd/18-revise-unified-buildos-cli-and-distribution.md` | `../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |

### Link repairs in `.make-docs/archive/history/` (t14)

Links to PRDs 14, 15, 16, 18, and 19 point at `../prds/2026-11-23/<file>`, links to PRD 17 use its new filename, links to an archived backlog point at `../work/<directory>/<file>`, and links to the audit prompt use its new path. Link text and all other text are unchanged. 34 links in 15 files.

| File | Line | Old target | New target |
| --- | --- | --- | --- |
| `.make-docs/archive/history/2026-06-04-w1-r0-p1-operating-layer-contracts.md` | 45 | `../../../docs/work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md` | `../work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md` |
| `.make-docs/archive/history/2026-06-04-w1-r0-p2-spaces-boundary-shipping.md` | 46 | `../../../docs/work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md` | `../work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md` |
| `.make-docs/archive/history/2026-06-04-w1-r0-p3-intake-conversion.md` | 72 | `../../../docs/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md` | `../work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md` |
| `.make-docs/archive/history/2026-06-04-w1-r0-p3-intake-conversion.md` | 74 | `../../../docs/prd/14-revise-deterministic-toolkit-deployment.md` | `../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/history/2026-06-04-w1-r0-p4-data-layer-extraction.md` | 53 | `../../../docs/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md` | `../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md` |
| `.make-docs/archive/history/2026-06-04-w1-r0-p4-data-layer-extraction.md` | 58 | `../../../docs/prd/15-revise-extraction-draft-lifecycle.md` | `../prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` |
| `.make-docs/archive/history/2026-06-04-w1-r0-p5-playbooks.md` | 52 | `../../../docs/work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md` | `../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md` |
| `.make-docs/archive/history/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard.md` | 26 | `../../../docs/prd/14-revise-deterministic-toolkit-deployment.md` | `../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/history/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard.md` | 36 | `../../../docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/00-index.md` | `../work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/00-index.md` |
| `.make-docs/archive/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md` | 60 | `../../../docs/prd/16-revise-toolkit-ownership-boundaries.md` | `../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md` | 65 | `../../../docs/prd/14-revise-deterministic-toolkit-deployment.md` | `../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| `.make-docs/archive/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md` | 66 | `../../../docs/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` | `../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` |
| `.make-docs/archive/history/2026-06-05-w1-r0-p7-qualified-finding-design-promotion.md` | 59 | `../../../docs/prd/16-revise-toolkit-ownership-boundaries.md` | `../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-entity-consolidation-planning.md` | 31 | `../../system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md` | `../../../docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-entity-consolidation-planning.md` | 33 | `../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-entity-consolidation-planning.md` | 35 | `../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | `../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p1-effective-requirements-and-redirect-contract.md` | 25 | `../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p1-effective-requirements-and-redirect-contract.md` | 26 | `../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | `../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p1-effective-requirements-and-redirect-contract.md` | 27 | `../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | `../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p2-deterministic-graph-engine-and-mutation-surface.md` | 25 | `../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p2-deterministic-graph-engine-and-mutation-surface.md` | 26 | `../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | `../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p2-deterministic-graph-engine-and-mutation-surface.md` | 27 | `../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | `../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p3-reviewed-persona-consolidation-and-copied-root-rehearsal.md` | 29 | `../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p3-reviewed-persona-consolidation-and-copied-root-rehearsal.md` | 30 | `../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | `../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p3-reviewed-persona-consolidation-and-copied-root-rehearsal.md` | 31 | `../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | `../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p4-canonical-references-across-consumers-and-producers.md` | 32 | `../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p4-canonical-references-across-consumers-and-producers.md` | 33 | `../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | `../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p4-canonical-references-across-consumers-and-producers.md` | 34 | `../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | `../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p5-naive-reader-documentation-and-release-evidence.md` | 62 | `../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `../../../docs/prd/17-entity-identity-and-canonical-resolution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p5-naive-reader-documentation-and-release-evidence.md` | 63 | `../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | `../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r4-p5-naive-reader-documentation-and-release-evidence.md` | 64 | `../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | `../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` |
| `.make-docs/archive/history/2026-07-21-w1-r5-unified-buildos-cli-and-distribution-planning.md` | 25 | `../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | `../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| `.make-docs/archive/history/2026-07-21-w1-r5-unified-buildos-cli-and-distribution-planning.md` | 28 | `../../../docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | `../work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` |
| `.make-docs/archive/history/2026-07-21-w1-r5-unified-buildos-cli-and-distribution-planning.md` | 31 | `../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | `../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` |

## Link Check

### P1

- Method: a temporary relative-link and anchor checker in `$TMPDIR` (GitHub heading slugs; code fences skipped; external URLs skipped).
- Changed files checked (15): `docs/assets/maintainer/buildos-toolkit-cli-development.md`, PRDs 02, 04, 07, 08, 09, 10, 11, 13, 17, and 20, `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md`, and this backlog's `00-index.md`, `01-owner-text.md`, and `evidence.md`. Result: 0 broken links.
- Anchors into PRDs 13 and 17 from any file in the repository: the only anchors used are `#contracts-and-data` (12) and `#integrations` (1), and both exist. The one repaired link was the W1 R7 `07-skills-and-validation.md` link to `#capability-addition-or-enhancement`, now merged into its `#contracts-and-data` link. B13 passes.
- Path hygiene: `make-docs project path-hygiene validate` reports 169 files checked, `failingFindings: 0`, `valid: true`.
- Review-fix rerun (2026-11-23): the same checker over the 15 changed files reports 0 broken links, including the new PRD 13 link to `#d-004-source-package-paths-leak-into-installed-project-guidance`. `make-docs run prd authority validate` still reports 85 findings with the same counts by code, none in a file this phase created. Path hygiene reports 169 files checked and `failingFindings: 0`.

### P2

- Method: the same kind of temporary relative-link and anchor checker in `$TMPDIR` (GitHub heading slugs; code fences and code spans skipped; external URLs skipped). A self-test caught a missing file and a bad anchor.
- Files checked (13): PRDs 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, and 12, this backlog's `02-baseline-change-note-folding.md`, and `evidence.md`. Result: 96 relative links, 0 broken. New anchors used: 13 `#scoped-vocabulary` and 02 `#domain-ownership`; both exist.
- Path hygiene: `make-docs project path-hygiene validate` reports 169 files checked, `failingFindings: 0`, `valid: true`.
- Review-fix rerun (2026-11-23): the checker, after a self-test that caught a missing file and a bad anchor, reports 122 relative links in the 14 changed files (PRDs 01, 02, 04 to 13, this phase file, and `evidence.md`), 0 broken. Inbound links into PRDs 01–13 from every tracked Markdown file: 331, 0 broken. The new anchor 13 `#buildos-validate-checks` exists. A change-note scan of PRDs 01–12 finds no bullet that names PRDs 13–19 by file or number and no empty `### Change Notes` section. `make-docs run prd authority validate` reports 85 findings with the P1 counts per code. Path hygiene reports `failingFindings: 0`.

### P3

- Method: a temporary relative-link and anchor checker in `$TMPDIR` (GitHub heading slugs; code fences and code spans skipped; external URLs skipped). A self-test caught a missing file and a bad anchor and passed a good anchor.
- Changed files checked (4): the register `docs/prd/03-open-questions-and-risk-register.md`, the plan `04-requirement-inventory.md`, this backlog's `03-register-and-requirement-trace.md`, and `evidence.md`. Result: 77 relative links, 0 broken.
- After the review round 1 fixes, changed files checked (6): the four above plus `docs/prd/02-architecture-overview.md` and `docs/prd/20-buildos-cli-and-distribution.md`. Result: 132 relative links, 0 broken. The checker self-test caught a missing file and a bad anchor. Inbound links from every tracked Markdown file: 70 to the register, 43 to PRD 02, 161 to PRD 20, 0 broken. New anchors used in the register: 01 `#current-limitations`, 02 `#module-map` and `#domain-ownership`, 08 `#draft-lifecycle-and-anchors`, 09 and 12 `#rebuild-notes`, 10 and 11 `#contracts-and-data`, 13 `#buildos-validate-checks`, and 17 `#lifecycle-and-redirects` and `#adoption-and-live-root-migration-safety`. All exist.
- Inbound links to the register from every tracked Markdown file: 70, 0 broken.
- Path hygiene: `make-docs project path-hygiene validate` reports 169 files checked, `failingFindings: 0`, `valid: true`.
- Validator: `make-docs run prd authority validate` reports 85 findings with the P1 counts per code (exit `1`), none in the register or the inventory.

### P4

- Method: a temporary relative-link and anchor checker in `$TMPDIR` (GitHub heading slugs with duplicate suffixes, code text kept in heading slugs; explicit HTML anchors; code fences, code spans, and YAML frontmatter skipped; external URLs skipped). It also reports malformed link syntax: every `](` outside code must close with `)` before any space or the end of the line. Its self-test caught a missing file, a bad anchor, and a link with no closing `)`, skipped links inside code, and passed a good anchor.
- Scope: every tracked Markdown file in the repository, including `.make-docs/archive/`, excluding `.git/` and `node_modules/`. No source file is excluded.
- Result: 385 files, 2266 relative links, 11 broken, 0 malformed. The same 11 links are broken at `HEAD` (`5f256b6`), before any P4 change: `USE_CASES.md` links to `DESIGN_PROGRESS.md` and `GLOSSARY.md`, which do not exist, and 9 links in `system/docs/assets/templates/` (`design.md`, `prd-index.md`, `work-index.md`, and `work-phase.md`) are template placeholders such as `../../prd/{{DOC_PATH}}`. None is a link to a PRD, a moved backlog file, or the moved prompt. These 11 are outside P4 scope and are reported, not changed.
- Links that resolve into `docs/prd/`, `.make-docs/archive/prds/`, `.make-docs/archive/work/`, or the moved audit prompt: 799, 0 broken. B48 passes.
- Review fix: the first P4 check missed 9 PRD 17 links that lost their closing `)` in the rename (PRD 03 ×3, 07, 08 ×2, 09, 11, and 13). A link with no closing `)` does not render as a link, so the checker did not count it. Each now closes after its PRD 17 anchor (`#lifecycle-and-redirects`, `#terminal-resolution`, `#adoption-and-live-root-migration-safety`, `#contracts-and-data`, or `#integrations`), and each anchor exists. A second script compared the links in every changed or moved Markdown file with its `HEAD` version: it found no other malformed link, no truncated link text, and no dropped anchor. Every changed link text or target is an intended P4 update.
- `.make-docs/archive/` alone: 54 files, 467 relative links, 0 broken.
- Moves: `git diff -M --name-status HEAD` shows all 38 moves as renames (`R072` to `R100`). The only rename inside `docs/prd/` is 17; no PRD number changed.
- Path hygiene: `make-docs project path-hygiene validate` reports `valid: true`, `checkedFiles: 133`, `failingFindings: 0`. The checked count fell from 169 to 133 because the 36 archived files left `docs/`.
- Validator: `make-docs run prd authority validate --target-root . --json` reports `status: passed`, 0 diagnostics, exit `0`.

#### Link and mention updates outside `.make-docs/archive/` (t8 to t13)

| Location | Files changed | Changed link targets | What changed |
| --- | --- | --- | --- |
| `docs/prd/` | 14 | 14 | Links to PRD 17 use the new filename, and their labels use the new title. `## Source Anchors` and register code anchors name the archived PRDs and backlogs. `D-002` and `D-005` code anchors point at the archived copies and the renamed 17. `Q-001`, `Q-011`, and `Q-012` already named the archived PRD 19 path from P3. `R-004` links the renamed 17. PRD 04 names no legacy filename. The index changes are below. |
| W1 R7 backlog | 4 | 16 | Code-span cites of PRD 16 and PRD 17 became links to 02 `## Module Map` and to the renamed 17 with its new section names. The "legacy editorial PRD" notes are gone. The `00-index.md` links to the W1 R5 and W1 R6 backlogs point at the archived copies. |
| W1 R7 plan | 3 | 2 | Two evidence-table links to PRDs 18 and 19 point at the archived copies (historical input). Code-span names of PRD 17 and the two archived backlogs use the new paths. |
| Other plans (W1 R0, R2, R4, R5, R6) | 14 | 25 | 17 links to retired PRDs point at the archived copies; each cites the PRD as the plan's historical input, and none sends a reader to current authority. Links and plain paths to PRD 17, the archived backlogs, and the moved prompt use the new paths. |
| `docs/designs/` | 2 | 2 | The entity design links the moved prompt. The product-boundary design links PRD 18 at its archived copy (see the judgment below). |
| `docs/assets/` | 5 | 20 | Links and frontmatter `related` paths to PRDs 14, 16, and 18 point at the new owners (20, 02 `## Module Map`, 20); PRD 17, the archived backlogs, and the moved prompt use the new paths. Two textual mentions that sent readers to current authority now name PRD 02 `## Module Map` and PRD 20. |
| `toolkits/` | 9 | 16 | Links to PRDs 14, 16, and 18 point at 20 `## Runtime and Package`, 02 `## Module Map`, and 20; PRD 17 uses the new filename. One textual "PRD 16" mention became "PRD 02 Module Map". |

Judgments for the reviewer:

- `docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md` `### Existing W1 R5 and P5 Assessment` assesses PRD 18 as a document ("establish a useful but narrower program"). Pointing that link at PRD 20 would change what the sentence says, so it points at the archived PRD 18. This departs from the design's "new owner" rule for `docs/designs/` for this one link.
- Textual "PRD 14", "PRD 18", and "PRD 19" mentions left unchanged, because they record past decisions and do not send a reader to current authority: the product-boundary design (lines 330, 410, 522), the Node rewrite design (lines 120, 255, 283, 295), and the W1 R7 plan tables.
- `docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` named PRD 17 as `docs/prd/17-add-entity-consolidation-and-canonical-resolution.md`, a name that never existed. It now uses the new filename.
- `docs/plans/2026-06-10-w1-r3-flow-automation-prompt-packs/00-overview.md` and `01-lineage-and-prd-scope.md` name a planned `17-revise-flow-automation-prompt-packs.md` that was never created. It is not PRD 17, so it is unchanged.

#### Search for old locations (t16)

Search over every tracked file outside `.git/` for `17-enhance-entity-consolidation-and-canonical-resolution`, `docs/prd/14-`, `docs/prd/15-`, `docs/prd/16-`, `docs/prd/18-`, `docs/prd/19-`, `prd/1[4-9]-revise` (not preceded by `archive/`), the five old backlog paths under `docs/work/` (not preceded by `archive/`), and `system/prompts/pre-upgrade`. Hits that remain outside `.make-docs/archive/`, all allowed:

- This backlog, the W1 R8 plan, and the cleanup design, which name the old paths as move sources.
- The W1 R3 plan's planned `docs/prd/17-revise-flow-automation-prompt-packs.md` (never created; see above).
- No other live link or path names an old location. B42 passes.

Inside `.make-docs/archive/`, option A changed link targets only, so old paths stay in link labels (for example the history records' `[../../prd/14-revise-deterministic-toolkit-deployment.md](../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md)` rows) and in code spans and plain text. These are archived text, kept unchanged by the rule.

### P5

- Validator (t1): `make-docs run prd authority validate --target-root . --json` exits `0` with `status: passed` and 0 diagnostics. B50 passes.
- Path hygiene (t2): `make-docs project path-hygiene validate` reports `valid: true`, `checkedFiles: 133`, `failingFindings: 0`. B51 passes.
- Full link check (t3): a new temporary relative-link and anchor checker in `$TMPDIR` (GitHub heading slugs with duplicate suffixes, code text kept in heading slugs; explicit HTML anchors; code fences, code spans, and YAML frontmatter skipped; external URLs skipped; malformed link syntax reported). Its self-test caught a missing file, a bad anchor, and a link with no closing `)`, skipped links inside code, and passed a good anchor.
- Scope: every tracked and untracked Markdown file in the repository, including `.make-docs/archive/`, excluding `.git/` and `node_modules/`. Option A applies, so no source file is excluded.
- Result: 385 files, 2287 relative links, 11 broken, 0 malformed, after the P5 edits. On the committed P4 state, before the P5 edits, the same checker found 385 files, 2267 relative links, and the same 11 broken links. The 11 broken links are the same ones recorded for P4 and existed before W1 R8: `USE_CASES.md` links to `DESIGN_PROGRESS.md` and `GLOSSARY.md`, which do not exist, and 9 template placeholder links in `system/docs/assets/templates/` (`design.md`, `prd-index.md`, `work-index.md`, and `work-phase.md`). None is a link to a PRD, a moved backlog file, or the moved prompt. They are reported, not changed.
- Links that resolve into `docs/prd/`, `.make-docs/archive/prds/`, `.make-docs/archive/work/`, or the moved audit prompt: 808 after the P5 edits (799 before them), 0 broken. B52 passes.
- Links whose source file is under `.make-docs/archive/`: 467 in 52 files that have links, 0 broken.

#### Plan checks 5 to 11 (t5)

| Check | Method | Result |
| --- | --- | --- |
| 5. No renumbering | `git diff --name-status -M 5f256b6 263f5ca -- docs/prd` (the P4 commit) and `git diff --name-status -M 59e3a36 HEAD -- docs/prd .make-docs/archive/prds` (the whole cleanup) | Pass. The P4 commit shows PRD 17 as the only rename inside `docs/prd/` (`R098`, `17-enhance-entity-consolidation-and-canonical-resolution.md` to `17-entity-identity-and-canonical-resolution.md`). PRDs 14, 15, 16, 18, and 19 leave only by renames to `.make-docs/archive/prds/2026-11-23/` (`R077` to `R096`). Over the whole cleanup git pairs 17 as delete and add, because P1 rewrote most of its text before the rename. The active set is 00 to 13, 17, and 20. No PRD number changed. |
| 6. Template conformance | `grep '^## '` on PRDs 13 and 17; frontmatter and heading search | Pass. Both have `## Purpose`, `## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, `## Rebuild Notes`, `## Requirement History`, and `## Source Anchors`, in that order. Neither has frontmatter, so neither has a document-level `coordinate`. Neither has a `### Change Notes` section or a retired heading (`Change Type`, `Capability Addition or Enhancement`, `Integration Impact`, `Affected Baseline Docs`, `Required Baseline Annotations`). |
| 7. No pointer notes | A script over every `### Change Notes` section in PRDs 01–12; `grep -nE '1[4-9]-(revise\|enhance)' docs/prd/*.md` | Passes with planned register-provenance exceptions. No `### Change Notes` bullet names a file `13-*` to `19-*` or PRDs 13–19, and no `### Change Notes` section is empty. The grep finds archived paths only: `## Source Anchors` in 06, 07, 11, 12, and 20, the register `## Source Anchors`, the register `D-002` code anchors, and the `Q-001`, `Q-011`, and `Q-012` fields that cite the archived PRD 19 as provenance or as input to the MCP revision. The register lines are the planned [register changes](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md#register-changes). Every hit names a path under `.make-docs/archive/prds/2026-11-23/`. |
| 8. No superseded banner | The first 8 lines of every file in `docs/prd/`; `grep -i 'superseded by' docs/prd/*.md` | Pass. No file starts with a banner. The only "superseded" in a file's first lines is the PRD 17 `## Purpose` phrase "duplicate or superseded Build OS entity records", which is the entity lifecycle state. "Superseded by" appears in the `D-003` closure text, about guide history records, and in two cells of the register `D-005` seed table (`Status after W1 R7` for PRDs 14 and 18). Those cells record the W1 R7 status of two PRDs that are now archived; no sentence says an active PRD is superseded. |
| 9. W1 R7 links | `grep -rnE '1[4-9]-(revise\|enhance)'` over the W1 R7 work folder; the same and `prd/16-` and `PRD 16` over the W1 R7 plan folder; a list of every PRD 17 link; the full link check | Pass. The W1 R7 work folder has no hit. Every PRD 17 link in the W1 R7 work and plan folders uses `17-entity-identity-and-canonical-resolution.md`, and its anchors (`#entity-commands`, `#atomic-writes`, `#component-and-capability-map`, `#derived-index`, `#acceptance`, `#terminal-resolution`) exist. The plan names 02 `## Module Map` as the domain-ownership owner, with the archived PRD 16 as historical input only. The two plan evidence-table links to PRDs 18 and 19 point at the archived copies, as P4 recorded. The link check finds no broken PRD 13 anchor. |
| 10. Requirement history | A script over every `## Requirement History` section in `docs/prd/` | Pass. Every planned entry exists: 17 (two), 13 (two), 02 (two W1 R8 entries and the moved PRD 16 W1 R7 entry), 08, and 20, plus the P2 entries in 09, 11, and 12. Each entry has its date, coordinate, affected section, previous contract, replacement contract, rationale, and a source link. In every PRD the section is the last before `## Source Anchors`. The link check finds every source link resolves. |
| 11. Register shape | Heading list; item list at `59e3a36` against the current list; a script for the required fields | Pass. The register keeps `## Confirmed Drift`, `## Open Questions`, `## Rebuild Risks`, and `## Source Anchors`. The 30 items at `59e3a36` keep their numbers. The 5 new items take the next numbers (`D-006` to `D-009`, `Q-014`). All 35 items have `Status`, `Decision`, `Follow-Up`, `Issue` or `Question`, `Why it matters`, `Recommendation`, and `To close`. `D-005` has a `Resolution`. |

B53 passes.

#### W1 R7 plan files (t10)

- `03-work-backlog-shape.md` `## Legacy-PRD Cleanup Gate` states the gate as a condition: P1 must not start until the cleanup is complete and `D-005` is closed. No change.
- `05-legacy-prd-cleanup-handoff.md` describes what W1 R7 did and the gate as conditions. `## Priority and Sequencing` says the cleanup started after the W1 R7 work backlog was generated and runs before W1 R7 work P1. Both are still true. No sentence says the cleanup has not started. No change.
- No W1 R7 plan file changed in P5.

#### P5 edits (t7 to t9)

- Register `D-005`: `Status` is `Closed`. `Decision` states the current result. `Follow-Up` is "None. W1 R8 has satisfied the D-005 prerequisite for W1 R7 P1." `Phase/gate` says the item gated W1 R7 work P1 and its condition of the gate is met. `Resolution` is added and says the other P1 entry-gate conditions are not part of `D-005`. `#### Cleanup inventory` points at the inventory `Final owner` column for the final trace. The item number, `Issue`, `Why it matters`, `Recommendation`, `To close`, `Owner`, the seed table, the safety rules, and the sequencing are unchanged. B55 passes.
- W1 R7 work index: the P1 entry gate in `01-typescript-package-foundation.md` names `D-005` closed by W1 R8, so a `## Change History` entry dated 2026-11-23, coordinate `W1 R7`, kind `edit`, records the P4 link changes and the `D-005` closure. It says W1 R8 has satisfied the `D-005` prerequisite and that the owner approvals in the gate are still open. It has every field of the wave-model entry shape, and its source link resolves to the W1 R8 work index. `make-docs run work backlog snapshot --target-root . --json` reports no diagnostic for the W1 R7 or W1 R8 backlogs. B56 passes.

## P1 Implementation Records

### Entity command flags against the Go command definitions (B3)

Source read: `toolkits/buildos/internal/cli/cli.go` (`parseEntityOptions`) and `toolkits/buildos/internal/cli/help.go`.

| PRD 17 `### Entity commands` rule | Go definition | Match |
| --- | --- | --- |
| `--root` required on every command | `--root is required` | Yes |
| `--mode compat\|strict` required on every command | `--mode must be compat or strict` | Yes |
| `resolve` requires `--id` | `--id is required` (resolve only) | Yes |
| `consolidate` requires `--manifest`; `--apply` optional | `--manifest is required`; `apply` flag on consolidate | Yes |
| `consolidate` dry run by default | write status `planned` when `consolidate` runs without `--apply` | Yes |
| `rebuild-index` checks by default; `--check` and `--apply` mutually exclusive | `apply` false unless set; `--check and --apply are mutually exclusive` | Yes |
| `--json` on every command | `json` flag registered for every entity command | Yes |

Differences: none. The Go parser also rejects extra positional arguments; that is shared usage-error behavior under PRD 20, not an entity flag.

### `buildos validate` checks against `validate_config.py` (B12)

| Script check (function) | PRD 13 `### buildos validate checks` line |
| --- | --- |
| `validate_contract`: contract file exists and names each `CONTRACT_TERMS` term | Config contract |
| `validate_config_data`: top-level mapping; `version` integer; `instance` mapping with string `id`, `name`; `instance.id` slug | Config file |
| `validate_collection`: lists of mappings with required fields per collection; owner `kind` slug | Collections |
| `validate_collection` and `validate_slug`: string `id`, slug format, unique per collection | ID uniqueness and slug format |
| `environments[].systems` list of configured system IDs | Environment references |
| `validate_default_list`: `defaults.*` lists of configured IDs | Default references |
| `validate_frontmatter` and `validate_frontmatter_data` over `system/playbooks/**/*.md` and `system/.os/templates/*playbook*.md`: mapping; no legacy field; scoped fields required lists of configured IDs | Frontmatter hygiene |
| `validate_scoped_entity_fields`: scoped row fields, when present, lists of configured IDs | Scoped data references |
| `validate_entity_jsonl_file` and `validate_entity_row`: file exists; no blank line; JSON object; unique ID; `type`; ID prefix; lifecycle `status`; `source_anchor`; `doc_anchor` under `system/docs/` when not `draft` or when set | Entity record hygiene |
| `validate_extraction_row` plus the converted-source rule in `validate_anchor_value`: `source_anchor` under `system/assets/`; `minted`; `extracted_by`; `extracted_at`; `dataset_refs` | Extraction rows |

Review fix (2026-11-23): PRD 13 now states the intended checks with installed-project paths. Where the script differs, PRD 13 says in one sentence that the legacy Python validator differs from these checks in some cases. Each difference is recorded under [Register Items For P3](#register-items-for-p3). Round-2 fix: PRD 13 now states the existing slug pattern (`SLUG_RE`) and the `minted[]` ID form (`ENTITY_ID_RE`), and the `draft` `doc_anchor` rule from `entity-records-contract.md`.

B12 result: pass. Every script check maps to one PRD 13 line in the table above, and the PRD list adds no check category that the script does not make. The differences in path prefix, anchor form, type strictness, optional `defaults`, entity-specific states, frontmatter scan scope, and datetime precision are routed to the register, not hidden. t24 stays ticked on the same basis.

### Deleted-section placement (t11 and t25)

- PRD 17: every sentence of `## Capability Addition or Enhancement` and `## Integration Impact` moved into `## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, or `## Rebuild Notes`. Side-by-side source-build steps 2 and 8, the binary checksum, the Go rehearsal anchors, and the W1 R4 P2 to P5 change notes moved to `## Requirement History`. Step 1 (inventory) was kept, restated for the package; the plan matrix did not name it, so it was kept rather than dropped. The W1 R7 change note is covered by the link to PRD 20 `## Compatibility`. The PRD 18 and 19 change notes, `## Change Type`, `## Affected Baseline Docs`, and `## Required Baseline Annotations` are `none` rows (C-51). The "PRD 07 is not changed" fact is stated as the `references.json` boundary in `### Derived index`. The thin-wrapper, no-Python, and no `buildos-entities` sentence is a `none` row (C-06), already owned by 06 and 20.
- PRD 13: every sentence of `## Capability Addition or Enhancement`, `## Contracts and Data`, and `## Integration Impact` moved into the new sections. The PRD 19 change notes are `none` (C-51, 13-08; `Q-006` and `Q-007` track the ideas, and the boundary sentence "must not be inferred from `instance.yaml`" is kept in `## Scope`). The W1 R7 note is covered by the existing W1 R7 history entry. "Initial implementation scope, not deferred hardening" was dropped as editorial. `## Change Type`, `## Affected Baseline Docs`, and `## Required Baseline Annotations` are `none` rows (13-09, 13-18).

### Other P1 confirmations

- t15: PRD 07 `## Component and Capability Map` already names `buildos intake convert`, `buildos intake index references`, and `buildos intake index playbooks`. No change needed.
- t18: The six-step procedure is now in `docs/assets/maintainer/buildos-toolkit-cli-development.md` under `### Before Adding Domain Logic`. Its legacy links to PRDs 14, 16, 17, and 18 stay for P4.
- t20: The PRD 16 W1 R7 entry was copied into PRD 02 byte for byte (checked with `diff`).

## Register Items For P3

P3 adds these items to `docs/prd/03-open-questions-and-risk-register.md`. P1 did not edit the register. Each reproduction ran `validate_config_data` or `validate_entity_jsonl_file` from `system/.os/scripts/validate_config.py`, loaded with `importlib`, on in-memory fixtures that are valid except for the named change. The script was not changed.

P3 result: R1, R2, and R5 are `D-006`; R3, R4, R7, and R8 are `D-007`; R6 is in `D-004`; R9 is `D-008`; R10 is `D-009`; R11 is part of `Q-014`. See [P3 register items](#p3-register-items).

### R1 — Legacy validator requires `defaults`

- Script: `validate_config_data` reports `defaults: must be a mapping` when `defaults` is absent. `validate_default_list` reports `defaults.<name>: must be a list` when any of the three child lists is absent.
- PRD 13: `defaults` is optional, and each child list is checked only when present (`### Config schema`, `### buildos validate checks`). `config-contract.md` agrees.
- Reproduction: remove `defaults` from a valid config, and separately remove only `defaults.owners`. Each gives one finding.
- Recommended register wording: "Drift: the legacy Python validator rejects a config with no `defaults` mapping or with a missing `defaults` child list. PRD 13 and the config contract make them optional. `buildos validate` follows PRD 13. To close: the parity fixtures for `buildos validate` record this as an intended difference, or the legacy validator is retired."

### R2 — Legacy validator accepts wrong config value types

- Script: `validate_collection` slug-checks owner `kind` only when it is a string, so an integer `kind` passes. `isinstance(version, int)` is true for a Python boolean, so `version: true` passes.
- PRD 13: owner `kind` is a string slug, and `version` is an integer that is not a boolean.
- Reproduction: set `owners[0].kind` to `7`; no finding. Set `version` to `True`; no finding.
- Recommended register wording: "Drift: the legacy Python validator accepts an integer owner `kind` and a boolean `version`. PRD 13 requires a string slug and a non-boolean integer. `buildos validate` follows PRD 13."

### R3 — Legacy validator accepts `null` for `dataset_refs`

- Script: `validate_extraction_row` checks `dataset_refs` only when its value is not `None`, so `"dataset_refs": null` passes.
- PRD 13: `dataset_refs` is optional; when the field is present, its value is a list of non-empty strings.
- Reproduction: a valid draft extraction row with `"dataset_refs": null` gives no finding.
- Recommended register wording: "Drift: the legacy Python validator treats `dataset_refs: null` as absent. PRD 13 requires a list when the field is present. `buildos validate` follows PRD 13."

### R4 — Legacy validator rejects entity-specific lifecycle states

- Script: `LIFECYCLE_STATUSES` holds only `draft`, `active`, `superseded`, and `archived`, and `validate_entity_row` applies it to every entity file.
- PRD 08 and PRD 17: the common vocabulary plus entity-specific states. Findings may end `qualified`; runs may end `running`, `closed`, or `aborted`. PRD 13 checks against both.
- Reproduction: a `findings.jsonl` row with `status: qualified`, and a `runs.jsonl` row with `status: running`, each with valid anchors, give `status: must be one of: active, archived, draft, superseded`. Both data files are empty today, so no shipped data shows the conflict.
- Recommended register wording: "Drift: the legacy Python validator rejects `qualified` findings and `running`, `closed`, or `aborted` runs. PRD 08 and PRD 17 allow them. `buildos validate` follows PRD 13. To close: parity fixtures cover each entity-specific state."

### R5 — Legacy validator scans only playbooks for scoped frontmatter

- Script: `iter_scoped_markdown` reads only `system/playbooks/**/*.md` and `system/.os/templates/*playbook*.md`.
- PRD 13: the frontmatter hygiene check covers playbooks and other scoped Markdown artifacts, which includes any Markdown artifact whose contract carries scoped metadata.
- Reproduction: `iter_scoped_markdown` returns only playbook and playbook-template paths. A search for `^(systems|environments|owners):` in `*.md` under `system/` finds no file outside that scope today, so the gap is latent.
- Recommended register wording: "Gap: the legacy Python validator checks scoped frontmatter only in playbooks and playbook templates. PRD 13 covers every scoped Markdown artifact. `buildos validate` must define the full file set from the artifact contracts."

### R6 — Legacy validator uses source-checkout paths (extends `D-004`)

- Script: default `--config`, `--contract`, and `--data-dir` paths sit under `system/`. `validate_anchor_value` requires `doc_anchor` under `system/docs/` and an extraction `source_anchor` under `system/assets/`.
- PRD 13: paths and saved anchors are relative to the initialized project root (`docs/`, `assets/`, `.os/`). The `system/` prefix applies only in this repository checkout.
- Reproduction: an `active` requirement row with `doc_anchor: docs/a.md#b` gives `doc_anchor: must point under system/docs/`. An extraction row with `source_anchor: assets/s.md#a` gives `source_anchor: must point to a converted source twin under system/assets/`.
- Anchor form: `validate_anchor_value` checks only that the value holds `#` and does not end with `#`. It does not check that the path part is a non-empty, project-relative path. PRD 13 says every saved anchor is a `path#anchor` reference relative to the initialized project root.
- Anchor-form reproduction: a valid `draft` requirement row with `source_anchor` set to `#heading`, to `/outside/source.md#heading`, or to `../outside.md#a` gives no finding in each case. The first has no path, the second is absolute, and the third leaves the project root.
- Recommended register wording: add to `D-004` evidence: "The legacy Python validator rejects installed-project anchors under `docs/` and `assets/`. It also accepts a `source_anchor` with no path, an absolute path, or a path that leaves the project root. PRD 13 specifies project-relative `path#anchor` references for `buildos validate`. To close: parity fixtures cover each anchor form as an intended difference."

### R7 — Legacy validator requires seconds in `extracted_at`

- Script: `UTC_DATETIME_RE` is `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$`, so it requires seconds.
- PRD 13: `extracted_at` is an ISO 8601 UTC datetime that ends in `Z`. ISO 8601 allows a time with hours and minutes only.
- Reproduction: a valid `draft` extraction row with `extracted_at: 2026-01-01T01:02Z` gives `extracted_at: must be an ISO 8601 UTC datetime ending in Z`. The same row with `2026-01-01T01:02:03Z` gives no finding.
- Recommended register wording: "Drift: the legacy Python validator rejects an ISO 8601 UTC `extracted_at` value with no seconds, such as `2026-01-01T01:02Z`. PRD 13 accepts any ISO 8601 UTC datetime that ends in `Z`. `buildos validate` follows PRD 13. To close: parity fixtures record this as an intended difference, or the PRD narrows the format."

### Items from P2

P2 did not edit the register. These come from folding the change notes.

#### R8 — Legacy validator accepts legacy scoped fields in entity rows

- Source: change note 08:52 said validators reject legacy scoped fields in structured rows. PRD 08 `## Contracts and Data` keeps that rule, and the PRD 13 `### buildos validate checks` Scoped data references check now lists it. PRD 12 `## Contracts and Data` already says stage-movers fail on legacy scoped fields.
- Script: `validate_scoped_entity_fields` checks only `systems`, `environments`, and `owners`. `LEGACY_SCOPED_FIELDS` is checked only in frontmatter (`validate_frontmatter_data`).
- Reproduction: `validate_entity_jsonl_file`, loaded with `importlib`, on a temporary `requirements.jsonl` in `$TMPDIR`. A valid `draft` row plus `env: both`, `for: both`, `envs`, or `target_systems` gives no finding in each case. A row with `systems: ["both"]` gives `unknown configured ID 'both'` only because `both` is not a configured ID. The shipped data files hold no legacy scoped field today, so the gap is latent.
- Recommended register wording: "Gap: the legacy Python validator does not reject a legacy scoped field (`env`, `for`, `envs`, or `target_systems`) in an entity row, and it rejects `both` in a scoped row field only when `both` is not a configured ID. PRD 08 and PRD 13 require validation to reject both cases. `buildos validate` follows PRD 13. To close: parity fixtures record this as an intended difference, or the legacy validator is retired."

#### R9 — Playbook catalog rebuild and redirect chains

- Source: change note 09:73 said playbook validation and catalog rebuilds reject unresolved or invalid redirect chains. It was the only home of this rule. P2 moved it into 09 `## Rebuild Notes`.
- Confirmed gap: the legacy Go indexer does not enforce it. `BuildPlaybooksIndex` and `playbookEntry` in `toolkits/buildos-intake/internal/intake/index.go` copy `targets` from frontmatter as strings and check only that the required fields exist. They never read `.os/data/` or resolve a target. So a playbook whose target is a `superseded` row with a missing redirect successor is still cataloged, with no error.
- Recommended register wording: "Gap: 09 requires playbook validation and catalog rebuilds to reject unresolved or invalid target redirect chains. The legacy Go indexer catalogs a playbook whose target redirects to a missing successor. `buildos intake index playbooks` follows 09. To close: a parity fixture records this as an intended difference."

#### R10 — PRD 01 `## Current Limitations` describes a greenfield build

- Source: 01 `## Current Limitations` says only the first slice is built and that intake, the data layer, discovery, Flow C, and stage automation are not implemented. No change note overrode this sentence, so P2 did not change it.
- Implemented today: the Go toolkits in this checkout implement intake (`toolkits/buildos-intake/`), discovery (`toolkits/buildos-discovery/`), design promotion (`toolkits/buildos-design/`), and the entity commands (`toolkits/buildos/`).
- Planned, not evidence of implementation: PRD 20 `## Command Surface` is the release contract for the TypeScript CLI. It lists `buildos entities`, `intake`, `discovery`, and `design` commands that the rewrite must ship.
- Recommended register wording: "Drift: 01 `## Current Limitations` describes a greenfield state. The Go toolkits already implement intake, discovery, design promotion, and entity commands. To close: restate the current limitations in 01 from the implemented domains, kept apart from the PRD 20 release contract."

#### R11 — Stage-mover orchestration ownership

- Source: change notes 12:30 and 11:66. 12 now states only the routing rule: movers call the owning domain commands and keep no durable logic in scripts. Which domain owns stage-mover orchestration is open, as 02 `## Module Map` says. P2 did not write it into 12.
- Recommended register action: fold this into the planned domain-ownership `Q` item (plan row C-42) as its stage-automation part, not a separate item. P3 t1 already plans that question.

## Human Experience Evidence

### P1

- Promise "no active PRD body relies on a change note, banner, or another document to override what it says": PRDs 13 and 17 have no `### Change Notes` section. PRDs 08, 07, 02, 20, 09, 10, 11, and 04 now state, in their section bodies, the rules that before lived only in PRDs 15, 16, 17, or 18 or in change notes. The change notes in 01–12 stay until P2. The independent reviewer read every changed PRD section in full and passed P1 (see `## Phase Reviews`).
- Promise "no current requirement is lost": the P1 placement record is above. The full trace runs in P3.

### P2

- Promise "no active PRD body relies on a change note, banner, or another document to override what it says": no `### Change Notes` bullet in PRDs 01–12 links or names PRDs 13–19. Where a note held the only statement of a current rule, the rule is now in the section body (10 bullets). Bodies that a note overrode were corrected: 09 `## Contracts and Data` (`env`/`for`) and 12 `## Contracts and Data` (the migration condition). The 07 PDF note, which never pointed at PRDs 13–19, is kept verbatim, with its trimmed W1 R7 correction. The independent reviewer read every changed section in full and passed P2 (see `## Phase Reviews`).
- Promise "no current requirement is lost": each of the 68 listed bullets has a disposition and an owner above: 66 folded and 2 kept. The row-level legacy-field rejection stays a current rule in 08 and is now a PRD 13 `buildos validate` check.

### P3

- Promise "no current requirement from PRDs 13–19 is lost; each one is traceable to its new owner section": every one of the 155 inventory rows has a `Final owner` cell. 119 name a current PRD section or register item, and the check found every named heading and item. 36 are `none` with a reason. 59 rows have a quoted owner sentence under `## Requirement Trace`. The stop rule fired in review round 1, and the fixes are recorded under `### Stop rule (t10)`. The independent reviewer passed P3 in round 3 (see `## Phase Reviews`).

### P4

- Promise "every topic in the `## Current Authority Map` points to exactly one active PRD with a product name": the map has 15 topics. Each links exactly one active product-named PRD that exists (02, 05, 06, 07, 08, 11, 13, 17, 20). Domain ownership is 02 `## Module Map`, Entities is 17 Entity Identity and Canonical Resolution, Config validation is 13, and Data lifecycle is 08. No "legacy name" note and no sentence about superseded PRDs remains. The validator reports 0 findings.
- Promise "every link to a moved or retired PRD resolves, to the new owner or the archived copy": the full-repository check finds 799 links into PRDs, archived PRDs, archived backlogs, or the moved prompt, 0 broken. Every repaired link inside `.make-docs/archive/` is listed under `## Recorded Reviewed Moves`.
- Review round 2 found that this P4 summary had stale counts (12 topics, 774 links) and a stale claim of multi-owner map rows, and that PRD 20 `## Make Docs Companion Setup` gave the Make Docs product boundary to both PRD 05 and PRD 11. Both are fixed: PRD 20 now links PRD 05 `## Integrations` for the product boundary and PRD 11 `## Contracts and Data` for the design hand-off, as the map does.
- The independent reviewer passed P4 in round 3 (see `## Phase Reviews`).

### P5

- Promise "every topic in the `## Current Authority Map` points to exactly one active PRD with a product name": supported. The validator reports 0 findings, including the authority-map and filename checks. P4 confirmed the 15 map topics and their targets, and the P5 link check finds every map link resolves. Limit: P5 did not reopen each map target by hand; the P5 reviewer does that under t12.
- Promise "no active PRD body relies on a change note, banner, or another document to override what it says": supported. Plan checks 6, 7, and 8 pass: PRDs 13 and 17 have no `### Change Notes` section, no `### Change Notes` bullet in 01–12 names PRDs 13–19, and no file in `docs/prd/` starts with a superseded banner. Limit: the checks are searches; the meaning of each corrected body was checked by the P1 and P2 reviewers.
- Promise "every link to a moved or retired PRD resolves, to the new owner or the archived copy": supported. The full link check over the whole repository, including `.make-docs/archive/`, finds 808 links into active PRDs, archived PRDs, archived backlogs, or the moved prompt, with 0 broken and 0 malformed. Option A applies, so no link is excluded. Limit: 11 broken links outside this scope existed before W1 R8 and remain.
- Promise "no current requirement from PRDs 13–19 is lost; each one is traceable to its new owner section": supported. The P5 trace recheck finds all 155 rows filled and every named section and register item present after the rename. `D-005` records the trace as its closing evidence. Limit: the recheck confirms that each named section exists; the sample of owner text against the requirement is the P3 reviewer's, and the P5 reviewer re-reads it.
- B54 passes.

## Phase Reviews

### 2026-11-23 — P1 Owner Text

Reviewer: independent reviewer agent (GPT 6.2 Astra). Result: PASS in round 3.

- Round 1: CHANGES. Findings: installed paths, defaults and type parity, lifecycle vocabulary, frontmatter scope, and the canonical-write boundary. The implementer fixed each one.
- Round 2: CHANGES. Findings: slug first character, minted ID format, anchor and timestamp parity items, and `doc_anchor` null on draft rows. The implementer fixed each one.
- Round 3: PASS with no findings.
- Reviewer-run checks: PRD authority validator 85 findings (`PRD-AUTH-001` 6, `PRD-AUTH-002` 6, `PRD-AUTH-003` 7, `PRD-AUTH-004` 15, `PRD-AUTH-005` 51), down from 93. Path hygiene 0 failing findings across 169 files. Link check 296 relative links in the 15 changed files, 0 broken.

### 2026-11-23 — P2 Baseline Change-Note Folding

Reviewer: independent reviewer agent (GPT 6.2 Astra). Result: PASS in round 2.

- Round 1: CHANGES. Findings: restore the entity-row rejection of legacy scoped fields in PRD 08 and PRD 13; restore the PRD 07 W1 R0 P3 PDF note verbatim; limit the PRD 09 `both` prohibition to scoped fields; refine P3 items R8 to R11. The implementer fixed each one.
- Round 2: PASS with no blocker or major finding. One minor finding: the changed-file relative-link count in `## Link Check` was 146 and is now corrected to 122.
- Reviewer-run checks: PRD authority validator 85 findings (`PRD-AUTH-001` 6, `PRD-AUTH-002` 6, `PRD-AUTH-003` 7, `PRD-AUTH-004` 15, `PRD-AUTH-005` 51), unchanged from P1. Path hygiene 0 failing findings across 169 files. Link check 122 relative links in the 14 changed files and 331 inbound links into PRDs 01–13, 0 broken.
- Dispositions: the reviewer checked the 65 targeted bullets (10 body, 2 history, 53 delete) and extras X1 to X3 against the diff.

### 2026-11-23 — P3 Register and Requirement Trace

Reviewer: independent reviewer agent (GPT 6.2 Astra). Result: PASS in round 3.

- Round 1: CHANGES. Findings: trace gaps for rows 18-16 (Go-removal parity gate, now in PRD 20), 17-14, 14-12, and 15-06 (real owners now named), 16-04 and 16-05 (`Q-014` and PRD 02 now name both open playbook jobs), 18-18, 18-19, and 18-21 (`0.1.0` and `0.2.0` now in PRD 20 `## Release`; `R-003` names the W2 handoff), and 19-12; and the evidence counts. The implementer fixed each one.
- Round 2: CHANGES. Findings: the `D-004`, `D-006`, and `D-007` closure rules now follow the governing contracts (fixtures plus parity exceptions, or one approved change to every affected owner); row 19-20 evidence. The orchestrator aligned `D-008` with the same rule. The implementer fixed each one.
- Round 3: PASS with no blocker or major finding.
- Rows the reviewer named in findings and rechecked: 14-12, 15-06, 16-04, 16-05, 17-14, 18-16, 18-18, 18-19, 18-21, 19-12, 19-20.
- Reviewer-run checks: PRD authority validator 85 findings (`PRD-AUTH-001` 6, `PRD-AUTH-002` 6, `PRD-AUTH-003` 7, `PRD-AUTH-004` 15, `PRD-AUTH-005` 51), unchanged from P1. Path hygiene 0 failing findings across 169 files. Link check 138 relative links in the changed files and all inbound links to PRD 02 (43), PRD 20 (161), and the register (70), 0 broken. Trace 155 rows: 119 name an owner and 36 are a justified `none`; all 172 heading references and 48 register references resolve.
- Rows sampled for B36, by round:
  - Round 1 sampled 13-01 to 13-20, 14-01 to 14-15, 15-01 to 15-10, 16-01 to 16-12, 17-01 to 17-48, 18-01 to 18-22, and 19-01, 19-02, 19-04 to 19-16, 19-18, 19-19, 19-21 to 19-24, and 19-26 to 19-28.
  - Round 2 sampled 13-17, 13-20, 14-06, 14-13, 15-04, 15-05, 16-02, 16-09, 17-18, 17-41, 17-42, 17-44, 17-46, 18-02, 18-11, 18-12, and 19-09, plus the `none` rows 13-08, 13-09, 13-18, 14-04, 14-09, 14-15, 15-08, 15-10, 16-06, 16-07, 16-12, 18-03, 18-14, 19-04, 19-05, 19-10, 19-11, and 19-15.
  - Round 3 spot-checked 13-20, 14-12, 15-06, 16-04, 16-05, 17-14, 18-16, 18-18, 18-19, 18-21, 19-12, and 19-20.

### 2026-11-23 — P4 Rename, Archive, Links, and Index

Reviewer: independent reviewer agent (GPT 6.2 Astra). Result: PASS in round 3.

- Round 1: CHANGES. Findings: nine PRD 17 links that lost their closing `)` in the rename; two `## Current Authority Map` rows that named more than one owner; PRD 20 `## Scope` did not name PRD 17; the W1 R7 plan still named PRD 16 as an owner; the option A entry in `## Change History`. The implementer fixed each one.
- Round 2: CHANGES. Findings: the PRD 20 Make Docs boundary sentence did not match the map (it now names PRD 05 `## Integrations` for the product boundary and PRD 11 `## Contracts and Data` for the design hand-off); the evidence counts. The implementer fixed each one.
- Round 3: PASS with no blocker or major finding.
- Reviewer-run checks: PRD authority validator passed with 0 findings (exit `0`). Path hygiene 0 failing findings across 133 files. Link check 2,266 relative links across 385 Markdown files; all 799 links to active or archived PRDs, archived backlogs, and the moved prompt resolve; 0 malformed. The 11 other broken links existed before P4 (`USE_CASES.md` and `system/docs/assets/templates/`).
- Open item t2: `make-docs project surface ensure archive` did not run, because this checkout has no Make Docs Store installation evidence (see `## Recorded Reviewed Moves`). The archive surface and its routers already exist, and the reviewer judged them adequate.

### 2026-11-23 — P5 Final Validation and Closure

Reviewer: independent reviewer agent (GPT 6.2 Astra). Result: PASS in round 3.

- Round 1: CHANGES. Findings: the `docs/prd/00-index.md` migration reading path pointed at the closed `D-005` (it now links PRD 17, PRD 20, and `R-004`); the claim that W1 R7 P1 may start, in `D-005`, the W1 R7 history entry, the P5 closeout, and `## Owner Summary` (it now says W1 R8 satisfied the `D-005` prerequisite for W1 R7 P1); the wording of evidence check 7 and `D-009`. The implementer fixed each one.
- Round 2: CHANGES. Findings: seven more statements of the same claim in the W1 R8 work index, the P5 phase file, the W1 R8 plan overview, and the cleanup design, each corrected with a `## Change History` entry; the link-check totals in `evidence.md`. The implementer fixed each one.
- Round 3: PASS with no blocker or major finding. One minor finding: the affected-scope field of the new W1 R8 work index `## Change History` entry named `## Usage Notes`; it now names `## Intended Follow-On`, the section that holds the edited next step.
- Reviewer-run checks: PRD authority validator passed with 0 findings (exit `0`). Path hygiene 0 failing findings across 133 files. Link check 2,287 relative links across 385 Markdown files; all 808 links to active or archived PRDs, archived backlogs, and the moved prompt resolve; 0 malformed. The 11 other broken links existed before W1 R8 (2 in `USE_CASES.md` and 9 in `system/docs/assets/templates/`).

## Owner Summary

W1 R8 made the BuildOS PRD set valid product authority. One known exception is recorded: PRD 01 `## Current Limitations` is stale, and `D-009` tracks it. Every current requirement of PRDs 13–19 now lives in a product-named owner. `D-005` is closed. W1 R8 has satisfied the D-005 prerequisite for W1 R7 P1.

### Validator

`make-docs run prd authority validate --target-root .` went from 93 findings (exit `1`) at the P1 baseline to 0 findings (exit `0`) after P4, and stays at 0 after P5. Path hygiene has 0 failing findings. The full link check finds no broken link to a PRD, a moved backlog, or the moved prompt.

### What changed in each PRD

| PRD | Change |
| --- | --- |
| 00 Index | `## Purpose`, `## Document Map`, `## Reading Order`, `## Source Anchors`, and `## Audience Paths` list only the active set. `## Current Authority Map` has 15 topics, each with one active product-named owner. |
| 01 Product Overview | 6 change notes folded (1 into the body, 5 deleted). Links use the renamed PRD 17. |
| 02 Architecture Overview | `## Module Map` states the domain ownership rule for one package and has one domain table, reconciled with PRD 20. `### Domain ownership` names the open playbook jobs. `## Configuration Surfaces` states the `systems`, `environments`, and `owners` fields. The PRD 16 W1 R7 history entry moved here unchanged, with two W1 R8 entries. 11 change notes deleted. |
| 03 Register | `D-005` closed. New `D-006` to `D-009` and `Q-014`. `D-004`, `Q-001`, `Q-011`, `Q-012`, `R-003`, and `R-004` updated. `D-002` and the source anchors point at the archived copies. |
| 04 Glossary | Adds `systems`, `environments`, and `owners`. The Notes column names PRDs 08 and 17. 2 change notes folded. |
| 05 Spaces Boundary and Shipping | 4 change notes deleted. |
| 06 Operating Layer and Routing | 4 change notes folded (1 into the body). Source anchor names the archived PRD 14. |
| 07 Intake and Conversion | States when converted twins may use `candidate` and the `references.json` rule. 3 change notes deleted and 2 kept, including the PDF note verbatim. |
| 08 Data and Extraction | `draft` is the pending lifecycle state, and `candidate` is never an entity status. Producers and consumers handle canonical IDs. One history entry. 10 change notes folded. |
| 09 Playbooks | A target that names a losing entity ID resolves to the terminal canonical ID. The redirect-chain rule is in `## Rebuild Notes`. Scoped fields are `systems`, `environments`, and `owners`. One history entry. 7 change notes folded. |
| 10 Discovery Runs and Qualification | Discovery stores canonical targets and keeps requested IDs and chains. 6 change notes folded. |
| 11 Flow C Integration | Design promotion resolves a requested finding ID to a terminal `qualified` finding. Hand-off scope metadata uses the configured lists. One W1 R8 history entry. 7 change notes folded. |
| 12 Stage Automation | Stage-movers call the owning `buildos` domain commands and keep no durable logic in scripts. One history entry. 6 change notes folded. |
| 13 Adopter-Owned Config Surface | Restructured to the subsystem template under the same filename. `### buildos validate checks` lists every check. The frontmatter hygiene rule is unconditional. Two W1 R8 history entries. |
| 17 Entity Identity and Canonical Resolution | Restructured to the subsystem template, then renamed from `17-enhance-entity-consolidation-and-canonical-resolution.md`. States the entity command flags and adoption through the npm package. Two W1 R8 history entries. |
| 20 BuildOS CLI and Distribution | States the local-only network rule, the Go-removal parity gate, and the `0.1.0` and `0.2.0` release scope. Links the renamed PRD 17. The Make Docs boundary matches the map (PRD 05 and PRD 11). One W1 R8 history entry. |
| 14, 15, 16, 18, 19 | Archived at `.make-docs/archive/prds/2026-11-23/`. Five finished or superseded backlogs (W1 R0, R2, R4, R5, R6) are archived at `.make-docs/archive/work/`. |

### Decisions taken

- P4 links inside archived copies: **option A**, chosen by the owner. Only the path part of each broken link inside the archived copies changed, as recorded reviewed moves. The link check covers `.make-docs/archive/` with no exclusion.
- Pre-upgrade audit prompt: **moved** to `docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md`, byte-identical, because live guides still use it. PRD 17 links it.
- Scoped-field migration: **landed**. No shipped file or data row uses a legacy scoped field, so the PRD 13 frontmatter hygiene rule is unconditional.

### Open items

1. P4 task t2 did not run. `make-docs project surface ensure archive` needs Store installation evidence for this checkout. The owner runs `make-docs setup reconfigure` (interactive), then `make-docs project surface ensure archive`. The archive surface and its routers already exist and work, so this does not block anything.
2. 11 broken links existed before W1 R8 and stay: `USE_CASES.md` links to `DESIGN_PROGRESS.md` and `GLOSSARY.md`, which do not exist, and 9 template placeholder links in `system/docs/assets/templates/`. They are outside this backlog.
3. Register items stay open for W1 R7: `D-004`, `D-006`, and `D-007` before W1 R7 work P7 (`buildos validate`), `D-008` before W1 R7 work P4 (`buildos intake index playbooks`), `D-009` (PRD 01 `## Current Limitations`), and `Q-014` (domain ownership).
4. W1 R7 P1 still needs the owner's approval of the W1 R7 PRD maintenance and backlog (its other entry-gate conditions).
5. P5 still needs the independent review (t12) and the commit (t13).
