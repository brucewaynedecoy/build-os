# 06 Operating Layer & Routing

## Purpose

This subsystem is the `.os/` brain and the agent-routing model that make Build OS navigable and self-propelling.

## Scope

Covered here: `.os/` structure (contracts, templates, indexes, data, config, scripts, skills, and the manifest), the routing conventions, and contracts-as-authority with forward-routing. The data shapes themselves are detailed in `08`; the boundary is in `05`.

Code anchors:

- `system/.os/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| `.os/contracts/` | Authority for each artifact type; each contract carries an `Intended Follow-On` ("Next Step") |
| `.os/templates/` | Copy-this starting shapes |
| `.os/indexes/` | Derived catalogs (`playbooks.json`, `references.json`) |
| `.os/scripts/` | Thin wrappers, command routers, compatibility shims, and command documentation for deterministic system processes. Each wrapper reaches the one `buildos` CLI through wrapper resolution and ships as a POSIX `sh` script and a Windows `.cmd` script. No Python ships |
| `.os/config/` | The adopter-owned operational config. `instance.yaml` holds the configured systems, environments, and owners. `.os/contracts/config-contract.md` shapes it, and `.os/templates/instance-config.yaml` is the neutral starter. [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md) owns the schema |
| `.os/config/` validation | `buildos validate` checks the adopter config and entity record hygiene |
| `.os/manifest.json` | Written by `buildos init`. Records the BuildOS package version, the schema version, and the time of initialization; wrappers read the pinned version from it |
| `.os/skills/` | Packaged BuildOS skills, copied from `system/.os/skills/` by `buildos init`, with the skills router `.os/skills/AGENTS.md` |
| Routers | Thin `AGENTS.md` dispatchers (`CLAUDE.md` is a one-line pointer) |

Code anchors:

- `system/.os/contracts/playbook-contract.md`
- `system/.os/AGENTS.md`
- `system/.os/templates/guardrail-playbook.md`

### Change Notes

- Superseded for wrappers, validation, and skills by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md): wrappers reach the one `buildos` CLI, `buildos validate` replaces `system/.os/scripts/validate_config.py`, and skills ship in `.os/skills/` with a router. The `buildos-*` binaries survive only as legacy command names. See `## Requirement History`.

## Contracts and Data

`AGENTS.md` is canonical; the sibling `CLAUDE.md` only points to it. Routers never restate rules — authority lives in `.os/contracts/`. Contracts encode forward-routing, so playbook → run-record → finding → design propels itself. The `.os/` router is the operating entry point, reachable from the co-owned `system/AGENTS.md` pointer.

Wrapper resolution is pin-first. A wrapper in `.os/scripts/` always runs the BuildOS version pinned in `.os/manifest.json` under the manifest contract of [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#project-initialization-and-adoption). It finds the CLI in this order:

1. If Node.js is missing or older than 24, print one plain message that names what to install, and stop with a non-zero exit code (`127`). The adopter never sees a stack trace.
2. Read the pin. A missing pin, or a pin that breaks the manifest contract, stops with one plain message and exit code `3`. Only an exact version reaches the `npx` command line, never an empty or unsafe one.
3. A local npm install of the pinned version: `node_modules/build-os` in the project folder and in each folder above it, then in npm's local project folder (the first folder up from the current folder that holds a `package.json` file or a `node_modules` folder; a file named `node_modules` does not count) and in each folder above it, in the order that Node.js uses to find a package. The first install that counts runs, also one that npm hoisted to the root folder of an npm workspace. A bin link is not needed.
4. Only when step 3 finds no install that counts: the first `buildos` on `PATH`, only when it is an npm install of the pinned version. The wrapper reads at most the first 1,024 bytes of a candidate to tell a project wrapper. The candidate is the first `buildos` in `PATH` order that is not this wrapper and not a BuildOS project wrapper of any shipped generation, the Go-era wrapper included. On macOS and Linux, `PATH` is read as POSIX reads it: an empty entry is the current folder, and a relative entry is relative to it; the candidate counts only when its real path (all links followed) is the `buildos` bin file of the nearest `package.json` above it. On Windows, the current folder is never searched unless `PATH` names it, a `;` inside a quoted `PATH` entry is part of the folder name, and the wrapper uses Node.js to search `PATH`; the candidate counts only when it is an npm `.cmd` shim with the package next to it (or, for a shim in `node_modules\.bin`, in that `node_modules` folder).
5. `npx -y --prefix <current folder> --workspaces=false build-os@<version>` with the pinned version, so npm runs BuildOS in the current folder and never changes to an npm workspace folder above it. `pinned-version.cjs` starts `npx` on every system, with npm bin links on, and it keeps the caller's own bin-links settings in any case and spelling. With Node.js but no `npx`, the wrapper prints one plain message that names `npx` and what to install, and stops with exit code `127`. The `sh` wrapper starts `node` and `npx` by their path on `PATH` (a relative entry gets a leading `./`), never by bare name. On Windows, a command line that Command Prompt cannot take (8,191 characters) stops with one plain message and exit code `2`.

The wrapper never starts a program to learn its version. An install counts only when its `package.json` is a regular file (no link) of at most 256 KiB, strict JSON, with the name `build-os` and exactly the pinned version (any version for a `dev` pin), and its `buildos` bin file is a readable regular file inside the package and not inside a `node_modules` folder below it. The wrapper runs that bin file with the same Node.js that runs the wrapper logic (`node <bin file> <arguments>`), in the same working folder. Any other layout (a pnpm, yarn, or Volta shim, a hand-made script, a file that cannot be read) does not count, and the pinned version runs through `npx`: a global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version.

A `dev` pin (a project set up by a source build) has no published version. It runs only an install that steps 3 and 4 find, of any `package.json` version; the program then checks that it is a development build (below). Otherwise it stops with exit code `3` before `npx` matters, and its message names the two ways that work: use the matching development build (for example `npm link` from its source folder), or set `buildos_version` to a published version.

The program checks itself. On every start (step 3, step 4, or `npx`), the wrapper sets `BUILDOS_REQUIRE_VERSION` to the pinned version (or `dev`). The BuildOS program reads it before any command code, output, or file access; only its own Node.js check comes first ([20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#output-and-exit-contract)). When it is set, not empty, and not exactly the program's own build identity (the version `buildos version` reports), the program stops with nothing on stdout, one plain message on stderr that names the required version, the version that started, and the two fixes (fix the install, then run the project wrapper again; or set the version in `.os/manifest.json`), and exit code `3`; with `--json`, the JSON failure envelope instead ([20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#output-and-exit-contract)). There is no fallback after a refusal. The program removes the variable, and puts back the caller's npm bin-links settings that the wrapper changed for `npx`, before it starts any other program. An unset or empty variable means no check. The `package.json` read of steps 3 and 4 only chooses a candidate; this check is what makes sure that a command runs only at the pinned version.

Threat model. The pin gives a repeatable version and a rollback path. It does not defend against a hostile program named `buildos`, `build-os` (the `bin` that `npx` starts by name), `npx`, or `node` on `PATH`, or against a hostile `node_modules` folder: a person who controls those controls the run already. A program that is not BuildOS and ignores `BUILDOS_REQUIRE_VERSION` is outside what the wrapper can check. A direct `npx` call has no self-check unless the caller sets the variable. On Windows, the wrapper compares paths without case, also on a case-sensitive folder; with the self-check, that can choose a wrong candidate but cannot run another BuildOS version.

A chain of wrappers that comes back to a BuildOS wrapper stops with one plain message instead of running forever. A hand-made chain on `PATH` is not an npm install, so it never starts. The guard holds only from wrapper to wrapper: the BuildOS program ends it as the first thing it does, so a program that BuildOS starts can call a wrapper again. Each wrapper passes the arguments on exactly as it got them. On Windows, Node.js finds the program and starts it itself, with the same console and exit code, so no path goes back to Command Prompt as text, and a folder name in any language works whatever the console code page.

Wrappers ship as POSIX `sh` scripts and as Windows `.cmd` scripts with the same resolution order. The adopter does not need to know about npm, `npx`, `PATH`, Node versions, or which wrapper runs. This outcome follows the Human Experience Contract at `make-docs://system/contract/human-experience-contract.md`.

Validation. `buildos validate` checks the adopter config (systems, environments, owners, defaults) and entity record hygiene. It replaces the Python validator. No BuildOS command needs Python. Until `0.2.0`, three packaged skills still carry or write Python tools ([20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#packaged-skills)).

Skills. `.os/skills/` holds the packaged BuildOS skills. The skills router `.os/skills/AGENTS.md` tells an agent how to install a skill into its own app's skill location when the user or a BuildOS workflow needs it. `buildos init` never writes into app folders such as `.claude/` or `.agents/`. The router also tells agents to put the Make Docs companion choice to the user when `init` asks for it. [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#packaged-skills) owns the package contents.

Code anchors:

- `system/.os/contracts/AGENTS.md`
- `system/playbooks/AGENTS.md`

## Integrations

Every operational subtree (`assets/`, `playbooks/`, `workspace/`, `.os/data/`) reads its contract here before writing. Crossings into `docs/` defer to the make-docs routers per `05`. Wrappers in `.os/scripts/` integrate with the `buildos` CLI from the npm package `build-os`, whose command and output contract [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md#command-surface) owns. Agents in chat apps integrate through the skills router.

Code anchors:

- `system/playbooks/administrative/AGENTS.md`

## Rebuild Notes

Preserve the `AGENTS.md`-canonical / `CLAUDE.md`-pointer rule and thin routers; do not let routers accrete authority that belongs in contracts. The contract set must exist before later phases can "read before write."

Code anchors:

- `system/.os/contracts/`

## Requirement History

### 2026-11-23 — W1 R7

- Affected requirement or section: Script wrappers in `## Component and Capability Map` and `## Contracts and Data`
- Previous contract: Wrappers resolved a separate `buildos-*` binary by environment variable, then `PATH`, then `toolkits/*/bin/`, and shipped as POSIX `sh` scripts only. Config validation ran through `system/.os/scripts/validate_config.py`.
- Replacement contract: Wrappers resolve `buildos` on `PATH`, then `npx` with the version pinned in `.os/manifest.json`, then print one plain message that names what to install. They ship as POSIX `sh` and Windows `.cmd` scripts. `buildos validate` replaces the Python validator, and skills ship in `.os/skills/` with a router.
- Rationale: Agents in chat apps and Windows users must reach the CLI with no build step, no binary install, and no Python.
- Source: [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)

### 2026-11-24 — W1 R7 P6 review round 2

- Affected requirement or section: Wrapper resolution in `## Contracts and Data`
- Previous contract: Wrappers resolved `buildos` on `PATH`, then `npx` with the pinned version, then printed one plain message. Nothing said how `PATH` is read, which wrappers are skipped, or what stops a loop.
- Replacement contract: The first `buildos` in `PATH` order that is not a BuildOS project wrapper of any shipped generation runs. POSIX wrappers read `PATH` as POSIX does (an empty entry is the current folder, a relative entry is relative to it). The Windows wrapper never searches the current folder unless `PATH` names it, and uses Node.js for the search. A chain of wrappers that comes back stops with one plain message, and arguments pass through exactly.
- Rationale: The W1 R7 P6 review round 2 found that the Go-era wrapper first on `PATH` made the new wrapper loop, that a relative `PATH` entry was skipped, and that Windows could run a `buildos.cmd` from the current folder.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6 review round 3

- Affected requirement or section: Wrapper resolution in `## Contracts and Data`
- Previous contract: The loop guard stayed set while BuildOS ran. With Node.js but no `npx`, a wrapper printed the Node.js message, also for a `dev` pin. The Windows wrapper read the path of the program to run back from Node.js as text.
- Replacement contract: The BuildOS program ends the loop guard when it starts, so a nested call through a wrapper works. A wrapper reads the pin before it looks for `npx`, and a missing `npx` has its own message (exit `127`). On Windows, Node.js starts the chosen program itself, so no path is read back as text.
- Rationale: The W1 R7 P6 review round 3 found that a companion program that BuildOS starts could not call the project wrapper (exit `127` with the loop message), that a `dev` pin with no `npx` was told to install Node.js, and that a path with letters outside ASCII could be read wrongly under a console code page that is not UTF-8.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-25 — W1 R7 P8 owner decision (Q-015)

- Affected requirement or section: Wrapper resolution in `## Contracts and Data`
- Previous contract: A wrapper ran the first `buildos` on `PATH` that is not a project wrapper, whatever its version. Only when there was none did it run the pinned version through `npx`. On macOS and Linux, a `buildos` on `PATH` ran without Node.js.
- Replacement contract: Pin-first. A wrapper checks Node.js and reads the pin first. It runs the `buildos` on `PATH` only when `buildos version --json` reports exactly the pinned version; else it runs the pinned version through `npx`. A `dev` pin runs only a program that reports `dev`. Every other rule stays.
- Rationale: With global-first, rollback by version pin worked only when no `buildos` was on `PATH`. The owner chose pin-first on 2026-11-25 (register `Q-015`, option A), so the pin decides always.
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md)

### 2026-11-25 — W1 R7 P8 pin-first review round 1

- Affected requirement or section: Wrapper resolution in `## Contracts and Data`
- Previous contract: A wrapper ran `buildos version --json` on the first `buildos` on `PATH`, with a 20-second limit, and ran it when it reported the pinned version. A `dev` pin ran a program that reported `dev`. The Windows wrapper split `PATH` at every `;`.
- Replacement contract: A wrapper never starts a program to learn its version. It runs a local npm install of exactly the pinned version first, then the first `buildos` on `PATH` only when it is an npm install of exactly the pinned version, as `node <bin file>` with the same Node.js and working folder; else `npx` with npm bin links on. A `dev` pin runs only an install of a source build (`0.0.0-dev`), and its message names working steps. A `;` inside a quoted Windows `PATH` entry is part of the folder name.
- Rationale: The review of `f6adf5f` found that the version check ran code from `PATH` with no limit on its process tree or its stderr, that `npx` with a local install of the pinned version and no bin link started `buildos` by name from `PATH`, that a quoted Windows `PATH` entry with `;` was skipped, and that the `dev` message gave a step that does not work. The orchestrator chose the no-execute design on 2026-11-25.
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md)

### 2026-11-25 — W1 R7 P8 pin-first review round 2

- Affected requirement or section: Wrapper resolution in `## Contracts and Data` (the self-check and the threat model)
- Previous contract: The wrapper's `package.json` read decided which version ran. A `dev` pin ran only a package whose `package.json` version was `0.0.0-dev`. The `sh` wrapper searched `PATH` with unbounded line reads before the Node.js check, and started `npx` by bare name.
- Replacement contract: Every start sets `BUILDOS_REQUIRE_VERSION`, and the BuildOS program stops itself (exit `3`, nothing on stdout) when its own build identity is another version; it removes the variable and puts back the caller's npm bin-links settings before it starts another program. The `package.json` read only chooses a candidate: any version for a `dev` pin, a readable bin file not inside a nested `node_modules` folder, a `node_modules` folder (not a file) for npm's local project folder. `PATH` is searched only after the local lookup misses, with at most 1,024 bytes read of a candidate; `node` and `npx` start by path. On Windows, a command line over 8,191 characters stops with exit `2`. The threat model is stated.
- Rationale: The review of `9913d62` found that npm can start another version than the wrapper chose (`<pin>+local`, a concurrent upgrade), that a release bump made the source build's `package.json` and its reported version differ, and that dash read a `-` folder name in `PATH` as options (ubuntu CI). The orchestrator chose the self-check on 2026-11-25 instead of a perfect file inspection.
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md)

### 2026-11-25 — W1 R7 P8 pin-first final check

- Affected requirement or section: Wrapper resolution in `## Contracts and Data` (steps 3 and 5)
- Previous contract: The local lookup checked only the project folder and npm's local project folder. The wrappers ran `npx -y @brucewaynedecoy/buildos@<version>`, and the `sh` wrapper started it itself and saved only two spellings of the npm bin-links variable.
- Replacement contract: The local lookup checks the `node_modules` folder of the project folder and of each folder above it, then of npm's local project folder and of each folder above it. The wrappers run `npx -y --prefix <current folder> --workspaces=false @brucewaynedecoy/buildos@<version>`, and `pinned-version.cjs` starts it on every system with the case-insensitive save of the bin-links settings.
- Rationale: The review of `a474c45` found that npm hoists a workspace install to the workspace root, where the wrapper did not look, so `npx` started `buildos` by name from `PATH`; that a fresh `npx` fetch from a subfolder of a workspace member ran `init` in the member folder; and that `npm_config_Bin_Links=false` broke a cold run on macOS and Linux.
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md)

### 2026-11-26 — W1 R7 P8 owner decision (package name)

- Affected requirement or section: Wrapper resolution in `## Contracts and Data` (steps 3 and 5, and the package name an install must have)
- Previous contract: A local install counted in `node_modules/@brucewaynedecoy/buildos`, and on Windows next to a `.cmd` shim in `node_modules\@brucewaynedecoy\buildos`. An install counted only with the name `@brucewaynedecoy/buildos`. The wrappers ran `npx -y --prefix <current folder> --workspaces=false @brucewaynedecoy/buildos@<version>`.
- Replacement contract: A local install counts in `node_modules/build-os`, and on Windows next to a `.cmd` shim in `node_modules\build-os`. An install counts only with the name `build-os`; a package with the earlier name never counts. The wrappers run `npx -y --prefix <current folder> --workspaces=false build-os@<version>`. The threat model also names a hostile program named `build-os` on `PATH`, since `npx` starts the `bin` named after the package. Every other rule stays.
- Rationale: The owner decided on 2026-11-26 to publish the package as `build-os`. Nothing was published under the earlier name.
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) and [Package Name `build-os`](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#package-name-build-os-2026-11-26)

### 2026-11-24 — W1 R7 P7 skills import

- Affected requirement or section: Validation in `## Contracts and Data`
- Previous contract: No Python shipped to adopters.
- Replacement contract: No BuildOS command needs Python. Until `0.2.0`, three packaged skills still carry or write Python tools, and the skills router says so.
- Rationale: W1 R7 P7 imported the adopter skills into `system/.os/skills/`; two of them ship Python scripts and one writes a Python tool. W1 R7 P9 moves the scripts into CLI commands.
- Source: [W1 R7 P7 Skills and Validation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md`
- `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md`
