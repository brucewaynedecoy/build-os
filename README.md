# Build OS

Build OS is a filesystem-based, agent-operable operating system for running discovery, testing, requirements capture, design, and backlogging against a target system, platform, or application.

It turns unstructured source material and hands-on exploration into verified, reproducible knowledge and engineering-ready artifacts while staying plain-text, git-native, reviewable, and usable by both human practitioners and agents.

## Use BuildOS

You need Node.js 24 or newer. Nothing else: no build step, no Python, no manual install. An agent in a chat app with folder access can run every step for you.

Set up a project. In the project folder, run:

```sh
npx -y build-os@0.2.1 init
```

`buildos init` asks one question first: set up the optional Make Docs companion too? When no one can answer in the terminal (as with most agents), it stops with exit code `10`, changes nothing, and prints the question and the two exact commands to run, one for each answer. Then it adds the BuildOS files next to the files that are already there. In a new setup it does not replace your files: when one of its files would replace one of yours, it stops with exit code `10` and changes nothing. In your `AGENTS.md`, `CLAUDE.md`, and `.gitignore` it adds only its own marked section. Adopting a project that the earlier Go tools set up replaces their wrapper and skill files; the [guide](guide/content/04-install-and-configure-your-instance.md) has the details and the limits of its undo.

After setup, run every command through the project wrapper, from the project folder:

```sh
.os/scripts/buildos validate
.os/scripts/buildos intake convert --source <path>
```

On Windows, use `.os\scripts\buildos.cmd` in Command Prompt. The wrapper always runs the BuildOS version that `.os/manifest.json` pins (pin first). It uses an installed `buildos` only when it is an npm install of exactly that version: in the project's `node_modules` folder, or the first `buildos` on `PATH`. It reads only the package files and starts no program to check the version. A global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version through `npx`.

The legacy command names `buildos-intake`, `buildos-discovery`, and `buildos-design` of the npm package still work, print a notice, and stop working in BuildOS `0.3.0`. The project scripts with those names in `.os/scripts/` print the same notice, run `.os/scripts/buildos` with their domain, and are removed in `0.3.0` too. Use `buildos intake`, `buildos discovery`, and `buildos design`.

Read next:

- The [BuildOS user guide](guide/README.md), starting with [Install and configure your instance](guide/content/04-install-and-configure-your-instance.md). It covers setup without registry access, updates, and rollback.
- The npm package page text: [`toolkits/buildos/README.md`](toolkits/buildos/README.md).
- For security reviewers: [`toolkits/buildos/SECURITY.md`](toolkits/buildos/SECURITY.md), with every outside package, the SBOM, provenance, and the release checks.
- The [release notes](toolkits/buildos/RELEASE_NOTES.md) for `0.2.1`, `0.2.0`, and `0.1.0`.

## Repository Model

This repository contains separate source packages and project records:

- `docs/` is the build layer for this project. It records how Build OS itself is designed, planned, and implemented.
- `toolkits/buildos/` is the source of the `buildos` CLI, the npm package `build-os`.
- `system/` is the filesystem package source. `buildos init` places its contents at an adopter's project root; it does not install a `system/` directory.
- `system/.os/skills/` holds the first-party BuildOS skills. `buildos init` copies them to `.os/skills/` in a project, and the router `.os/skills/AGENTS.md` tells an agent how to install one into its own app. They are not necessarily used to work on this repository.
- `system/` holds no Make Docs content. In an initialized project, Make Docs creates `docs/` and `.make-docs/` when the user sets it up.
- `guide/` is the user guide for adopters.

The `docs/` and `.make-docs/` trees are managed by the make-docs documentation system. Treat their local routers and contracts as authoritative when working inside them.

## Source Paths and Initialized Paths

All paths in the Important Paths table below are source-checkout paths. In an initialized project, use `.os/`, `assets/`, `playbooks/`, `workspace/`, and `docs/` directly from the project root. The project does not need this checkout's `system/` or `toolkits/` directories.

Use [AGENTS.md](AGENTS.md) for maintainer rules and the [Root and Path Contract](system/.os/contracts/root-and-path-contract.md) for shipped paths and links. A source link can include `system/`; an installed instruction or new saved reference must not inherit that package prefix.

## What Build OS Does

Build OS is organized around three pillars:

- Convert: deterministic intake that transforms source files such as documents, spreadsheets, PDFs, and HTML into clean text or CSV twins with provenance.
- Playbooks: typed Markdown instruments that guide humans and agents through discovery, testing, qualification, and guardrails.
- Workspace: executable and evidentiary artifacts such as run records, findings, datasets, and deterministic tests.

Those pillars support three chained flows:

- Intake and knowledge: `convert -> extract -> candidates`.
- Discovery and execution: `active playbook -> run -> raw finding -> qualify -> qualified finding`.
- Planning and engineering: `qualified finding -> design -> plan -> PRD -> work backlog`.

## Important Paths

| Path | Purpose |
| --- | --- |
| `system/AGENTS.md` | Entry point for operating the shipped system. |
| `system/.os/` | Operational layer for contracts, config, templates, indexes, data, scripts, and skills. |
| `system/.os/contracts/` | Authority for Build OS artifact shapes and lifecycle rules. |
| `system/.os/config/instance.yaml` | Adopter-owned instance configuration. |
| `system/.os/templates/instance-config.yaml` | Neutral starter config for new instances. |
| `system/.os/scripts/` | Wrappers that find and run the `buildos` CLI, including `buildos validate`. |
| `system/playbooks/` | Typed playbooks and guardrails. |
| `system/workspace/` | Home for run records, findings, datasets, and execution artifacts. |
| `toolkits/buildos/` | The `buildos` CLI: the npm package `build-os` (TypeScript, Node.js 24 or newer). |
| `guide/` | The user guide and its single-page HTML build. |
| `docs/designs/` | Build-layer design records for Build OS itself. |
| `docs/prd/` | Build-layer product requirements for Build OS itself. |

## Adopter-Owned Configuration

Reusable Build OS contracts and templates stay neutral. Instance-specific vocabulary belongs in `system/.os/config/instance.yaml` (`.os/config/instance.yaml` in a project), where adopters define:

- `systems`: the systems, platforms, products, or applications being discovered, tested, documented, or built.
- `environments`: deployments, sandboxes, tenants, configurations, or other execution contexts.
- `owners`: teams, organizations, vendors, internal groups, or other accountable parties.

Scoped artifacts refer to configured IDs through plural fields: `systems`, `environments`, and `owners`. Legacy placeholder fields such as `env`, `envs`, `for`, and hard-coded target names are not Build OS contract vocabulary. `buildos validate` checks all of this.

## Working In This Repo

Start with the router nearest the work:

- For system operation, read `system/AGENTS.md`, then follow `system/.os/AGENTS.md`.
- For contracts, read the specific file under `system/.os/contracts/` before creating or changing that artifact type.
- For adopter-owned configuration, read `system/.os/contracts/config-contract.md` and validate changes with `buildos validate`.
- For CLI work, read `toolkits/AGENTS.md`, then `toolkits/buildos/AGENTS.md`.
- For build-layer planning, design, PRD, or work artifacts, use the corresponding router under `docs/`.
- For target-system deliverables in an initialized project, use its Make Docs `docs/` router.

## Source-Checkout Validation

These commands are maintainer checks from this repository root. They need the package dependencies: run `npm ci --ignore-scripts` in `toolkits/buildos/` first.

Run `buildos validate` after changing config, playbook frontmatter, structured data references, or scoped artifact vocabulary. The `system/` folder has the layout of an initialized project, so the source CLI can check it:

```sh
node toolkits/buildos/src/cli/main.ts validate --root system
```

The validate parity and hostile-input tests run with the rest of the package tests (`npm test` in `toolkits/buildos/`).

Check the package content links and the commands in the initialized-project layout:

```sh
cd toolkits/buildos
node --test test/system-content.test.ts test/installed-layout.test.ts
```

The first checks every relative Markdown link in `system/`; the second runs every domain against a project made by the built package's `buildos init`. Make Docs owns its resource bodies and needs its own checks.

For Markdown and repository hygiene work, also use the relevant make-docs validators from the router for the documentation tree you changed.

## Design Records

The current architecture and CLI decisions are captured in:

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/designs/2026-06-03-adopter-owned-config-surface.md`
- `docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md`

The active product requirements live under `docs/prd/`.

## License

Apache-2.0. See [LICENSE](LICENSE).
