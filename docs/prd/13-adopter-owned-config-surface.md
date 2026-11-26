# 13 Adopter-Owned Config Surface

## Purpose

This subsystem owns the adopter-owned configuration surface. It keeps reusable Build OS docs, contracts, templates, and validators neutral, while each deployed instance defines its own systems, environments, and owners.

## Scope

In scope:

- the instance config file, `system/.os/config/instance.yaml`;
- the config contract and the starter template;
- the scoped vocabulary: `systems`, `environments`, and `owners`;
- the list of checks that `buildos validate` makes.

Covered elsewhere:

- the `buildos validate` command surface, owned by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#command-surface);
- project identity, the machine-global registry, and project relocation, which are open questions `Q-006` and `Q-007` in the [open questions and risk register](./03-open-questions-and-risk-register.md). They must not be inferred from `instance.yaml`.

Code anchors:

- `system/.os/config/`
- `system/.os/contracts/config-contract.md`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| `system/.os/config/instance.yaml` | The canonical instance configuration file, owned by the adopting team |
| `system/.os/contracts/config-contract.md` | Defines the schema shape, identifier rules, cross-reference behavior, defaults, and validation requirements |
| `system/.os/templates/instance-config.yaml` | A neutral starter config with replaceable example values |
| `buildos validate` | Runs every check in [buildos validate checks](#buildos-validate-checks) against the instance config and the frontmatter and data that depend on it |

Code anchors:

- `system/.os/config/instance.yaml`
- `system/.os/contracts/config-contract.md`
- `system/.os/templates/instance-config.yaml`

## Contracts and Data

### Config schema

`system/.os/contracts/config-contract.md` must define these top-level config properties:

| Property | Requirement |
| --- | --- |
| `version` | Integer schema version. |
| `instance` | Object containing a stable slug `id` and human-readable `name`. |
| `systems` | List of configured system records with unique slug IDs. |
| `environments` | List of configured environment records with unique slug IDs and `systems` references. |
| `owners` | List of configured owner records with unique slug IDs. |
| `defaults` | Optional default lists whose values reference configured IDs. |

Configured IDs must be stable slugs, unique within their collection, and referenced explicitly. `environments[].systems` entries must reference configured `systems[].id` values. `defaults.systems`, `defaults.environments`, and `defaults.owners` must reference configured IDs when present.

### Scoped vocabulary

The scoped vocabulary is:

- `systems`: configured systems, platforms, products, or applications in scope for the Build OS instance.
- `environments`: configured deployments, sandboxes, tenants, configurations, or execution contexts.
- `owners`: configured teams, organizations, vendors, internal groups, or other accountable parties.

These fields must be plural lists where artifacts can apply to several configured IDs. Frontmatter and structured rows that carry scoped metadata must use `systems`, `environments`, and `owners` as list fields. Empty lists are allowed only when the specific artifact contract permits system-neutral, environment-neutral, or owner-neutral scope.

`env`, `for`, `envs`, `target_systems`, and sentinel values such as `both` are not contract vocabulary. They must not be introduced or kept as scoped fields. The reserved sentinel value is `both`, the one value the legacy `env` and `for` fields used. A scoped list never holds it, and the config never defines it as a configured ID, because such an ID could never be used.

### Neutral reusable content

Reusable Build OS templates and contracts must not contain customer-, vendor-, product-, or instance-specific configured values. The starter template may contain neutral example IDs only. The release check against the client-name deny list in [PRD 20 Release](./20-buildos-cli-and-distribution.md#release) guards the published package.

### buildos validate checks

Validation runs through `buildos validate`, a command of the one `buildos` CLI ([PRD 20 Command Surface](./20-buildos-cli-and-distribution.md#command-surface)). Users need no Python to validate config. `buildos validate` makes these checks, and only these. Every path in this list, and every saved anchor it checks, is relative to the initialized project root that `system/.os/contracts/root-and-path-contract.md` defines. The `system/` prefix applies only in this repository checkout, where the source package holds the same files (for example `system/.os/config/instance.yaml`). It is never part of an installed path or a saved anchor, as open drift item [D-004](./03-open-questions-and-risk-register.md#d-004-source-package-paths-leak-into-installed-project-guidance) tracks.

- Config contract: `.os/contracts/config-contract.md` exists and names every schema term: `version`, `instance`, `systems`, `environments`, `owners`, `defaults`, `environments[].systems`, `defaults.systems`, `defaults.environments`, and `defaults.owners`.
- Config file: `.os/config/instance.yaml` parses to a mapping. `version` is an integer of any size, and a boolean is not an integer. `instance` is a mapping with string `id` and `name`, and `instance.id` is a slug.
- Collections: `systems`, `environments`, and `owners` are lists of mappings. Each system has `id`, `name`, and `description`. Each environment has `id`, `name`, `systems`, and `description`. Each owner has `id`, `name`, and `kind`, and `kind` is a string slug.
- ID uniqueness and slug format: every configured `id` is a string slug, and it is unique within its collection. A slug matches `[a-z0-9][a-z0-9-]*`. It uses only lowercase ASCII letters, digits, and hyphens, and its first character is a lowercase letter or a digit. No configured `id` is the reserved sentinel `both`.
- Environment references: every `environments[].systems` value is a list whose entries are configured `systems[].id` values.
- Default references: `defaults` is optional. When it is present, it is a mapping. Each of `defaults.systems`, `defaults.environments`, and `defaults.owners` is optional, and when it is present it is a list of configured IDs from the matching collection.
- Reserved values: in every list of configured IDs that this list names (environment references, default references, frontmatter, and entity rows), the reserved sentinel `both` fails, also when the config defines it.
- Frontmatter hygiene: the check covers playbooks and other scoped Markdown artifacts. That is every Markdown file with frontmatter under `playbooks/`, every playbook template under `.os/templates/`, and every other Markdown artifact whose contract carries scoped metadata. Today no other contract carries scoped frontmatter, so the check reads every `.md` file under `playbooks/` (hidden names too) and every `.os/templates/` file whose name holds `playbook` and ends in `.md`. Names match ASCII case-insensitively on every operating system, so `Check.MD` and `Sample-PlayBook.Md` are checked too. A file has frontmatter when its first line is `---` and a later line is `---`. Its frontmatter parses to a mapping. It carries no legacy scoped field (`env`, `for`, `envs`, or `target_systems`). It has `systems`, `environments`, and `owners`, each a list of configured IDs. The check is unconditional.
- Scoped data references: no entity row carries a legacy scoped field (`env`, `for`, `envs`, or `target_systems`). In every entity row, `systems`, `environments`, and `owners`, when present, are lists of configured IDs, and a sentinel value such as `both` in one of these fields fails. The check is unconditional.
- Entity record hygiene: each canonical entity file under `.os/data/` (`requirements`, `capabilities`, `personas`, `test-cases`, `results`, `runs`, `findings`, and `extractions`, each a `.jsonl` file) exists. Every line is a JSON object, and no line is blank. IDs are unique within a file. Each row has the `type` of its file and an ID with the file's prefix (`REQ`, `CAP`, `PER`, `TC`, `RES`, `RUN`, `FIND`, or `EXT`) and at least three digits. `status` is a value of the common lifecycle vocabulary (`draft`, `active`, `superseded`, or `archived`) or an entity-specific state that its entity type allows, such as `qualified` for a finding or `running`, `closed`, or `aborted` for a run. `source_anchor` is a required `path#anchor` reference. A row that is not `draft` has a `doc_anchor` `path#anchor` reference under `docs/`. A `draft` row may omit `doc_anchor` or set it to null, and a non-null value meets the same rule. A saved anchor splits at its first `#`. The part after it, the fragment, is not empty and may itself hold `#` (a heading ID such as `C#`). The path before the `#` names a file in the initialized project, relative to its root: it is not empty, it has no URI scheme (such as `https:` or `file:`), it is not absolute (`/x`, `\x`, or a drive such as `C:`), it does not start with the source-package folder `system/` as written or with `.` and `..` folded (so `system/../docs/a.md` fails), its last part is a name and not empty, `.`, or `..` (so a path that ends in `/` names a folder and fails), and with `.` and `..` folded it neither leaves the project folder nor folds to the project folder itself. The `docs/` and `assets/` prefix rules apply to the folded path. The check reads the spelling only: it does not look up the file or the fragment, so an anchor to a document that is not written yet passes.
- Extraction rows: `source_anchor` points to a converted source twin under `assets/`. `minted` is a list of IDs. Each ID is a registered prefix (one of the entity prefixes or `PB`), a hyphen, and at least three ASCII digits. `extracted_by` is a non-empty string. `extracted_at` is a UTC time in the RFC 3339 profile `YYYY-MM-DDTHH:MM:SS`, with an optional `.` and one or more fraction digits, then `Z`, for example `2026-01-31T09:30:00Z`. Digits are ASCII, and `T` and `Z` are uppercase. The date is a real calendar date in the years 0001 to 9999, the hour is 00 to 23, and the minute and second are 00 to 59, so `24:00:00` and a leap second (`:60`) fail. The basic format (`20261124T102030Z`), a comma fraction, an offset such as `+00:00`, and a time with no seconds fail. `dataset_refs` is optional, and when the field is present its value is a list of non-empty strings.

Input handling: every checked file is untrusted input. `buildos validate` reads only regular files inside the project root, once each, with a size limit. An entry at a checked name (a checked Markdown name, the contract, the config, or a data file) that is a link or a special file (a pipe, socket, or device) is never read and is a finding, because it cannot be checked. A link at any other name, also a folder link under `playbooks/`, is skipped without a finding: BuildOS never follows it, enters it, or looks through it to decide what it is. `playbooks/` or `.os/templates/` itself as a link is a finding. It never reads through a link that leads out of the project, and reports such a case as a finding. Text must be UTF-8, and one byte order mark at the start of a file is ignored. Entity files are split into lines at LF, with one CR before it removed; a lone CR is not a line break. YAML nesting (block levels and inline list levels together), JSON nesting, folder depth under `playbooks/`, the number of Markdown files, and the number of reported findings are bounded; the findings bound stops every check once it is reached. `toolkits/buildos/SECURITY.md` lists the limits. A file that breaks one of these rules is a finding, never a crash.

Root and result: `buildos validate` checks the folder given by `--root`, or else the current folder, and never a parent folder. A folder with no `.os/` folder stops with exit code `3`. The command changes no file. It exits `0` when it finds no problem and `4` when it finds one. Each finding has a stable `code`, the project-relative `path`, the `field` inside the file, and a plain message; the human output groups findings by file, and `--json` returns them in the shared envelope.

The removed legacy Python validator, `validate_config.py`, differed from these checks in some cases. Register items D-004, D-006, and D-007 list them, and each one is a recorded divergence with a parity fixture.

The frontmatter hygiene check should also be callable on its own, by index builders or repository hygiene scripts.

[08 Data Layer and Extraction](./08-data-and-extraction.md#contracts-and-data) owns the common lifecycle vocabulary and the anchor rules that the entity record hygiene check enforces. [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md#contracts-and-data) owns the entity-specific states.

Code anchors:

- `system/.os/contracts/config-contract.md`
- `toolkits/buildos/src/core/validate/`

## Integrations

Operational contracts, generated indexes, playbook frontmatter, data rows, run records, findings, and docs hand-off metadata resolve scope through `system/.os/config/instance.yaml` and the config contract. The consumers are [08 Data Layer and Extraction](./08-data-and-extraction.md), [09 Playbooks](./09-playbooks.md), [10 Discovery, Runs and Qualification](./10-discovery-runs-and-qualification.md), [11 Flow C Integration](./11-flow-c-integration.md), and [12 Stage Automation](./12-stage-automation.md).

[20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#command-surface) owns the `buildos validate` command. [06 Operating Layer and Routing](./06-operating-layer-and-routing.md) owns the wrappers that reach it.

Code anchors:

- `system/.os/contracts/playbook-contract.md`
- `system/.os/scripts/`

## Rebuild Notes

Rebuild each check in [buildos validate checks](#buildos-validate-checks), and add no other. Where the legacy validator, `validate_config.py`, followed that list, `buildos validate` gives the same results on the same fixtures, under the parity rule in [PRD 20 Compatibility](./20-buildos-cli-and-distribution.md#compatibility). Where the script differed from the list, the list governs, and each difference is a recorded divergence. The parity fixtures are in `toolkits/buildos/test/fixtures/validate/`, the recorded legacy results and divergences in `toolkits/buildos/test/golden/validate/`. The script is no longer in `system/`; git history keeps it.

The move to `systems`, `environments`, and `owners` is complete in the shipped `system/` content. No playbook, playbook template, or data row uses a legacy scoped field, so the frontmatter hygiene check reports legacy fields as errors with no transition condition.

Code anchors:

- `toolkits/buildos/test/fixtures/validate/`
- `toolkits/buildos/test/golden/validate/`
- `system/playbooks/`
- `system/.os/data/`

## Requirement History

### 2026-11-23 — W1 R7

- Affected requirement or section: `## Contracts and Data`, `## Integration Impact` (config validation)
- Previous contract: `system/.os/scripts/validate_config.py` validated the instance config, scoped references, and frontmatter hygiene.
- Replacement contract: `buildos validate` performs the same validation as a command of the one `buildos` CLI. The Python script is no longer the validator.
- Rationale: Users need no Python. Node is the only runtime BuildOS requires.
- Source: [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Contracts and Data`, `buildos validate` checks
- Previous contract: This PRD listed the config and scoped-reference checks only. Entity record hygiene was implied by a separate lifecycle record and by the Python validator. The rejection of legacy scoped fields in entity rows was stated only in a note in PRD 08.
- Replacement contract: One full check list in this PRD states the intended `buildos validate` checks, including entity record hygiene and the rejection of legacy scoped fields in entity rows, with installed-project paths. `buildos validate` matches `validate_config.py` where the script follows that list. Where the script differs, the list governs.
- Rationale: The entity record hygiene checks had no owner. PRD 20 requires parity with the former tools, and the PRD states the intended rule rather than legacy script behavior.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Contracts and Data`, frontmatter hygiene check
- Previous contract: The frontmatter hygiene check reported legacy scoped fields or unconfigured IDs as errors "once the migration lands".
- Replacement contract: The check reports them as errors with no condition.
- Rationale: The shipped `system/` content no longer uses any legacy scoped field, and the validator already treats them as errors.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

### 2026-11-24 — W1 R7 P7

- Affected requirement or section: `## Contracts and Data`, `buildos validate` checks; `## Rebuild Notes`
- Previous contract: The check list named the intended checks, and the legacy Python validator, `system/.os/scripts/validate_config.py`, stayed in the package. The frontmatter file set, the input handling, the root, and the result shape were not stated.
- Replacement contract: `buildos validate` makes the listed checks. The frontmatter check states its current file set. Input handling, the default root, exit codes `0`, `3`, and `4`, and the finding shape are stated. The legacy script is removed from the package, and each difference from it is a recorded divergence with a parity fixture.
- Rationale: The port is done (W1 R7 P7), and the PRD must match its behavior. Users need no Python.
- Source: [W1 R7 P7 Skills and Validation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md)

### 2026-11-24 — W1 R7 P7 review round 1

- Affected requirement or section: `## Contracts and Data`: Scoped vocabulary, `buildos validate` checks (config file, ID rules, reserved values, frontmatter file set, saved anchors, `extracted_at`, input handling)
- Previous contract: `both` failed only when the config did not define it. A saved anchor had to be relative and stay inside the project. `extracted_at` was "an ISO 8601 UTC datetime that ends in `Z`", wider than the check, which needed seconds and the extended format. The frontmatter file set matched names by exact case. Input handling reported every link under `playbooks/` that might be a folder, and did not name special files at checked names.
- Replacement contract: `both` is the reserved sentinel: it fails in every scoped list, also when configured, and the config may not define it as an ID. A saved anchor path also has no URI scheme, no `system/` prefix, and does not fold to the project folder. `extracted_at` is the RFC 3339 UTC profile, stated exactly, with `24:00:00` and leap seconds rejected. Names match ASCII case-insensitively on every OS. A link at an unchecked name is skipped and never followed or looked through; a link or special file at a checked name is a finding. `version` may be an integer of any size. The YAML depth bound covers inline lists, and the findings bound stops every check.
- Rationale: Independent review of the W1 R7 P7 port found invalid anchors and a configured `both` that passed, a datetime contract wider than the check, a link to a PDF out of the project that failed validation, and names that checked differently by operating system. The `extracted_at` profile is an orchestrator decision that the owner may veto (register D-007).
- Source: [W1 R7 P7 Skills and Validation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md), [P7 Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-1)

### 2026-11-24 — W1 R7 P7 review round 2

- Affected requirement or section: `## Contracts and Data`: Entity record hygiene (saved anchors); the owner decisions on register items D-006 and D-007
- Previous contract: A saved anchor split at its first `#`, but the check failed any value that ended in `#`, so a fragment such as `C#` failed. The `system/` prefix was checked on the folded path only, and a path that named a folder (`docs/designs/`) passed. D-006 item 1 and D-007 items 1 and 2 waited for the owner.
- Replacement contract: The fragment after the first `#` is not empty and may hold `#`. The `system/` prefix fails as written and folded. A path whose last part is empty, `.`, or `..` fails. The check reads the spelling only. The owner chose form (a) for D-006 item 1 (`defaults` is optional), D-007 item 1 (`dataset_refs: null` fails), and D-007 item 2 (a closed or running run and a qualified finding pass), so the rules in this PRD stand.
- Rationale: Independent review (P7-R2-04) found a folder anchor and a hidden `system/` prefix that passed and a valid fragment that failed. The owner answered the open D-006 and D-007 items on 2026-11-24.
- Source: [P7 Review Round 2](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-2)

## Source Anchors

- [2026-06-03-adopter-owned-config-surface.md](../designs/2026-06-03-adopter-owned-config-surface.md)
- [2026-06-03-w1-r1-adopter-owned-config-surface](../plans/2026-06-03-w1-r1-adopter-owned-config-surface/00-overview.md)
- [01-prd-and-contract-alignment.md](../work/2026-06-03-w1-r1-adopter-owned-config-surface/01-prd-and-contract-alignment.md)
- `docs/prd/03-open-questions-and-risk-register.md`
- `system/.os/contracts/playbook-contract.md`
- `system/.os/config/instance.yaml`
- `system/.os/contracts/config-contract.md`
- `system/.os/templates/instance-config.yaml`
- `system/.os/scripts/validate_config.py` (removed in W1 R7 P7; git history keeps it)
- [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)
