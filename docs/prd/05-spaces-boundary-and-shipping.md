# 05 Spaces, Boundary & Shipping

## Purpose

This subsystem defines the three-space separation, the make-docs plug-in boundary that protects it, and what it means to ship `system/`.

## Installed Project Paths

`system/` is the filesystem package source in the BuildOS checkout. BuildOS reaches adopters as the npm package `@brucewaynedecoy/buildos`, which carries the `system/` package content. `buildos init` places those contents directly at the adopter project root and writes `.os/manifest.json` with at least the BuildOS package version, the schema version, and the time of initialization. An initialized project contains `.os/`, `assets/`, `playbooks/`, and `workspace/`; it contains `docs/` and `.make-docs/` only when Make Docs is set up. It does not require a `system/` child.

Every `buildos` domain uses one rule to tell an initialized project from the BuildOS checkout. A root whose `.os/`, `assets/`, `docs/`, `playbooks/`, and `workspace/` are all folders is an initialized project (the rule of the earlier Go tools). Otherwise a root with an `.os/` folder is an initialized project, so a project set up without Make Docs counts as one. The one exception is a root that also has `system/.os/` and no `.os/manifest.json` file: it is read as a checkout, as the Go tools read it. A root with no `.os/` folder is read as a checkout, where the BuildOS content lives under `system/`. The rule serves the commands that take a repository root (`--repo-root` of `buildos intake`, `buildos discovery`, and `buildos design`) and `buildos init`. `buildos entities --root` and `buildos validate --root` do not apply it: each names the content root directly, the folder that holds `.os/` (`.os/data/` for entities), so in the checkout that is `system/` and in an initialized project it is the project root.

In an initialized project, a leading `system/` in a stored reference or a BuildOS default path names the initialized path without `system/`. A relative path the user names on the command line is used as written; only where the project has no `system` entry at its root is a leading `system/` dropped, because it is the earlier spelling of the source package ([PRD 20 Output and Exit Contract](./20-buildos-cli-and-distribution.md#output-and-exit-contract)).

`buildos init` applies the same rule before it plans: when the rule reads the folder as the checkout (a `system/.os/` folder and no `.os/manifest.json`), it stops with exit code `10` and writes nothing. When `buildos init` finds an existing `.os/` directory with the marks of a project set up with the earlier Go tools (an `.os/data/` folder, or all five folders above), it adopts the project; any other `.os/` folder stops it with exit code `10`. Adoption writes only `.os/manifest.json`, the wrapper scripts, and `.os/skills/`. It never changes user data, runs, findings, indexes, or config. It shows the planned writes before it writes them, and `--dry-run` shows the plan only. [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#project-initialization-and-adoption) owns the command contract.

The checkout's `toolkits/` is a separate source package; `toolkits/buildos/` holds the CLI source. BuildOS skills have one source home, `system/.os/skills/`, and `buildos init` copies them to `.os/skills/`. Source package locations are not project data paths. User instructions and new saved references use initialized-project paths. Source evidence can use checkout paths when clearly marked. The [Root and Path Contract](../../system/.os/contracts/root-and-path-contract.md) owns the detailed path rules.

## Scope

Covered here: the build/system/target-docs distinction, the boundary rules and their guardrail, co-owned-router augmentation, the shipping/gitignore model, npm delivery and the placement of the `system/` package by `buildos init`, and the Make Docs companion boundary. BuildOS ships no Make Docs content: the source package has no `system/docs/` or `system/.make-docs/` folder. Routing mechanics are covered in `06`; the make-docs `docs/` pipelines themselves are external. The `buildos` command contract is covered in [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md).

Code anchors:

- `docs/`, `system/`

### Change Notes

- Superseded for delivery by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#project-initialization-and-adoption): the installed program is the npm package, `buildos init` places the `system/` package, and no Make Docs content ships. See `## Requirement History`.

## Component and Capability Map

| Component | Capability |
| --- | --- |
| Three spaces | Keep "building the system" (`docs/` in the checkout), "the system" (`system/`), and "outputs about the target" (the initialized project's `docs/`) un-confused |
| Boundary guardrail (`PB-001`) | Forbid edits to the make-docs trees (`docs/` and `.make-docs/`); require crossings via their routers |
| Co-owned router augmentation | Add the `.os/` pointer to `system/AGENTS.md` append-only |
| Shipping model | The npm package `@brucewaynedecoy/buildos` is the shippable unit. It carries the `system/` package, which `buildos init` places at the project root, and no Make Docs content. Adopters own their data and gitignore choices |
| Make Docs companion setup | After BuildOS setup, `buildos init` offers to set up Make Docs. The user decides, and BuildOS runs Make Docs only through its public CLI |

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `system/AGENTS.md`

### Change Notes

- Superseded for the distribution by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#runtime-and-package): the installed distribution is the npm package with the Node.js and TypeScript `buildos` CLI and no MCP server; Make Docs remains an external companion reached only through its public CLI.

## Contracts and Data

The boundary is encoded as an `active` guardrail playbook (Scope/Rules/Rationale). Shipping is governed by a planned runtime-only `system/.gitignore` (ignores `node_modules`, `.playwright`, `test-results`; leaves `.os/data/` and `workspace/datasets/` tracked). BuildOS `assets/` must never be confused with the make-docs `docs/assets/` tree.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `.make-docs/manifest.json`

## Integrations

BuildOS runs without Make Docs. Make Docs is an optional companion. When the user sets it up, the make-docs CLI installs and maintains `docs/` and `.make-docs/` and appends to the co-owned top routers. BuildOS ships no Make Docs content and never writes Make Docs-owned files or global state itself. Surfaces the boundary guardrail through the `.os/`, `playbooks/`, and `administrative/` routers.

After BuildOS setup, `buildos init` offers Make Docs companion setup. These outcomes are current requirements:

- The user decides Yes or No before Make Docs is set up.
- When an agent runs `init` with no terminal and no answer flag, `init` stops before it writes anything. Its output explains both choices in plain words and gives the exact command for each, so the agent can put the choice to the user.
- When the answer is Yes, BuildOS sets up Make Docs only through the public Make Docs CLI and passes every setup choice explicitly.
- When Make Docs setup fails, BuildOS setup still completes. The output says that Make Docs is not set up and shows the exact command to retry.

These outcomes follow the Human Experience Contract at `make-docs://system/contract/human-experience-contract.md`. [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#make-docs-companion-setup) owns the prompt, flags, exit codes, and pinned Make Docs version range.

Code anchors:

- `system/.os/AGENTS.md`

### Change Notes

- Superseded for the setup flow by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#make-docs-companion-setup): `buildos init` offers companion setup, the user chooses, and BuildOS relies only on the Make Docs commands named there. Q-010 and R-001 are narrowed, not closed. See `## Requirement History`.

## Rebuild Notes

A rebuild must preserve append-only treatment of the top routers and must never invent new directories or doc types under any `docs/` tree. The two `assets/` namespaces are distinct and easy to conflate.

Code anchors:

- `system/AGENTS.md`

## Requirement History

### 2026-11-23 — W1 R7

- Affected requirement or section: `## Scope`, `## Integrations`
- Previous contract: The source package shipped Make Docs scaffold content in `system/docs/` and `system/.make-docs/`, and BuildOS depended on the make-docs CLI to install and maintain four Make Docs trees.
- Replacement contract: No Make Docs content ships. BuildOS reaches adopters as the npm package `@brucewaynedecoy/buildos`, and `buildos init` places the `system/` package. `init` offers Make Docs setup, the user decides, and BuildOS runs it only through the public Make Docs CLI.
- Rationale: The product boundary says Make Docs owns its own content and setup, and the shipped copy was far behind the current Make Docs release.
- Source: [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)

### 2026-11-24 — W1 R7 P7 review round 3

- Affected requirement or section: `## Installed Project Paths`
- Previous contract: The rule did not say which commands use it, a `system/` prefix was dropped from every path in an initialized project, and `buildos init` adopted any root with an `.os/` folder.
- Replacement contract: The rule serves the `--repo-root` commands and `buildos init`; `entities --root` and `validate --root` name the content root directly. A path the user names is used as written, except the earlier `system/` spelling where the project has no `system` entry. `buildos init` stops in the checkout and adopts only a folder with Go-era marks.
- Rationale: Review findings P7-R3-01 and P7-R3-07: an explicit `system/...` path read another file, and `buildos init` in the checkout turned it into an initialized project.
- Source: [P7 Review Round 3](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-3)

### 2026-11-24 — W1 R7 P7 review round 2

- Affected requirement or section: `## Installed Project Paths`
- Previous contract: An initialized project could omit `docs/`, but no requirement said how a command tells an initialized project from the checkout. The commands kept the Go rule, which needed `docs/`, so a project set up without Make Docs was read as a checkout and its intake, discovery, and design commands failed.
- Replacement contract: Every domain uses one rule: all five Go folders, or else a root `.os/` folder, means an initialized project, unless `system/.os/` is there too and `.os/manifest.json` is not a file.
- Rationale: `buildos init --skip-make-docs` writes no `docs/` folder by design, and that setup must work (review finding P7-R2-01).
- Source: [P7 Review Round 2](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-2)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md`
