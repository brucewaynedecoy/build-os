---
title: "Upgrade an Existing BuildOS Project"
path: "operations/upgrade-existing-project"
status: draft
version: "2026-11-24"
order: 150
tags:
  - upgrade
  - migration
  - adoption
  - rollback
applies-to:
  - .os/
  - .os/manifest.json
related:
  - "../maintainer/upgrade-existing-buildos-installation.md"
  - "entities-consolidation-curate-and-resolve-records.md"
  - "validate-system-data-and-indexes.md"
  - "understand-workspace-artifacts.md"
  - "../maintainer/buildos-toolkit-cli-development.md"
persona: user
---

# Upgrade an Existing BuildOS Project

Use this guide to move a project that the earlier Go tools set up onto the `build-os` npm package (its command is `buildos`), and to change the BuildOS version of a project later. Paths start at the project root, the folder that holds `.os/`, `assets/`, `playbooks/`, and `workspace/`.

## What changed

The earlier BuildOS tools were separate Go programs (`buildos-intake`, `buildos-discovery`, `buildos-design`) that someone built or copied onto your machine, plus a Python validator, `.os/scripts/validate_config.py`. From `0.1.0`, BuildOS is one npm package, `build-os`, with one command, `buildos`, for Node.js 24 or newer. Every command and flag of the Go tools keeps working with the same output. The differences you might notice are in the `0.1.0` release notes (`toolkits/buildos/RELEASE_NOTES.md` in the BuildOS repository).

## Before you begin

- Install Node.js 24 or newer, and check it with `node --version`.
- Commit or back up the project. Adoption changes no data file, but a clean git state lets you see exactly what it wrote.
- Remove any Go-era `buildos` program from `PATH`. The project wrappers always run the pinned version and never start a program to check its version: they read only the `package.json` file of an npm install, and a Go-era program is not one, so they skip it. Remove it so nobody runs it by habit. (Remove the Go-era `buildos-intake` and similar programs too, for the same reason.)

## Adopt the project

In the project root, run:

```sh
npx -y build-os@0.2.1 init --dry-run
```

The dry run shows what adoption would write and writes nothing. BuildOS adopts a folder that has an `.os/` folder, no `.os/manifest.json`, and the marks of a Go-era project (an `.os/data/` folder, or all of `.os/`, `assets/`, `docs/`, `playbooks/`, and `workspace/`). Any other `.os/` folder stops it with exit code `10` and a plain message.

Then run it for real:

```sh
npx -y build-os@0.2.1 init
```

When no one can answer in the terminal, it first stops with exit code `10` and asks whether to set up Make Docs; run the one command it prints for the answer. Adoption writes only these paths:

- `.os/manifest.json`, which pins the BuildOS version of the project;
- the wrapper scripts in `.os/scripts/` (`buildos`, `buildos-intake`, `buildos-discovery`, `buildos-design`, each with a `.cmd` form for Windows, and their helpers);
- the skills in `.os/skills/` (it keeps any other file you added there).

It changes no data file, run, finding, index, or config: they stay byte for byte. It never writes `AGENTS.md`, `CLAUDE.md`, or `.gitignore` during an adoption. A file it replaces that has more than one hard link stops it before anything is written. When it finds the old `.os/scripts/validate_config.py`, it leaves the file in place and says so in a note: no BuildOS command uses it, and you can delete it.

## Check the result

```sh
.os/scripts/buildos version
.os/scripts/buildos validate
```

On Windows, use `.os\scripts\buildos.cmd`. `buildos validate` replaces the Python validator and checks the config, the scoped frontmatter, and the entity records. If it reports problems that the Python validator did not, see [Validate System Data and Indexes](validate-system-data-and-indexes.md). For redirect-aware entity checks, run `.os/scripts/buildos entities validate --root . --mode compat`; see [Curate and Resolve Duplicate Entity Records](entities-consolidation-curate-and-resolve-records.md).

Review the git diff, then commit `.os/manifest.json`, `.os/scripts/`, and `.os/skills/`.

## Change your commands

Replace the old names everywhere you wrote them (notes, playbooks, scripts):

| Before | Now |
| --- | --- |
| `buildos-intake convert --source <path>` | `.os/scripts/buildos intake convert --source <path>` |
| `buildos-intake index references` | `.os/scripts/buildos intake index references` |
| `buildos-discovery run discovery ...` | `.os/scripts/buildos discovery run discovery ...` |
| `buildos-design promote finding ...` | `.os/scripts/buildos design promote finding ...` |
| `python3 .os/scripts/validate_config.py` | `.os/scripts/buildos validate` |

The old names still work and print a notice. The project scripts `.os/scripts/buildos-intake`, `buildos-discovery`, and `buildos-design` print the same notice. They all stop working in BuildOS `0.3.0`.

## Change the version later

`.os/manifest.json` decides which BuildOS version the project wrapper runs:

```json
{
  "schema_version": 1,
  "buildos_version": "0.2.1",
  "initialized_at": "2026-11-24T22:15:17.018Z"
}
```

- To update, set `buildos_version` to the new exact version and run `.os/scripts/buildos version`. Read the release notes first: when a version changes skills, change the skills too. From `0.1.0` to `0.2.0`, four skills and the skills router change; the BuildOS guide, chapter 4, section "From 0.1.0 to 0.2.0", gives the steps and the rollback. From `0.2.0` to `0.2.1`, no skill changes, but a project on Windows needs the fixed wrapper `.os/scripts/buildos.cmd`; the same chapter, section "From 0.2.0 to 0.2.1", gives the steps and the rollback.
- To roll back, set it to the earlier exact version. A range or a tag such as `latest` is refused (exit code `3`).
- You do not need to change or remove a global install (`npm install -g`). The pin always decides: a global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version through `npx`.

Commit the manifest change so the whole team runs the same version. There is no `buildos update` command yet: a new version does not refresh the contracts, templates, or skills that `buildos init` copied.

## If something goes wrong

- `buildos init` exits `10` and lists clashing paths: nothing was written. Move or back up those files, then run it again.
- A wrapper prints "BuildOS needs Node.js 24 or newer": install Node.js 24 or newer.
- A wrapper exits `3` about `.os/manifest.json`: the file is missing or not valid. Put back the exact version, or run `buildos init` again in the project root.
- To undo an adoption completely, restore the project from git: adoption only added or replaced the paths listed above.

## Future Coverage

- Blocked by: W2 `buildos update`. Update when: the update command ships. Guide change: replace the manual version change with the update command and describe how copied files are refreshed.
