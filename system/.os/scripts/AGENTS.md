# Scripts Router (`.os/scripts`)

This directory is the operating-layer wrapper, command router, compatibility, and command documentation surface. Durable deterministic logic lives in the BuildOS CLI, the npm package `@brucewaynedecoy/buildos`. The scripts here only find that CLI and call it.

## Scripts

- [`buildos`](buildos) and [`buildos.cmd`](buildos.cmd) — run the `buildos` CLI on macOS and Linux (`sh`) and on Windows (`.cmd`).
- [`buildos-intake`](buildos-intake) and [`buildos-intake.cmd`](buildos-intake.cmd) — run `buildos intake`. Legacy name: removed in BuildOS `0.3.0`.
- [`buildos-discovery`](buildos-discovery) and [`buildos-discovery.cmd`](buildos-discovery.cmd) — run `buildos discovery`. Legacy name: removed in BuildOS `0.3.0`.
- [`buildos-design`](buildos-design) and [`buildos-design.cmd`](buildos-design.cmd) — run `buildos design`. Legacy name: removed in BuildOS `0.3.0`.
- [`pinned-version.cjs`](pinned-version.cjs) — wrapper helper: checks the Node.js version and the manifest contract, reads the BuildOS version pinned in [`../manifest.json`](../manifest.json), and finds an npm install of exactly that version by reading `package.json` files only. It never starts a program to learn its version. It reads only regular files (no link), with a size limit. For the `.cmd` wrapper it also searches `PATH` and starts the chosen program itself. For the `sh` wrapper it starts `npx`.
- [`node-required.txt`](node-required.txt) — the one plain message every wrapper prints when Node.js is missing or older than 24.

## Order

Pin first: every wrapper always runs the BuildOS version pinned in `.os/manifest.json` (`buildos_version`; `buildos init` writes that file). It finds BuildOS in this order:

1. With no Node.js, or Node.js older than 24: the plain message in `node-required.txt` on stderr, and exit code `127`.
2. A manifest that breaks the manifest contract (PRD 20) stops with a plain message and exit code `3`. Only an exact version reaches the `npx` command line.
3. A local npm install of the pinned version: `node_modules/@brucewaynedecoy/buildos` in the project folder and in each folder above it, then in the folder where npm looks for the local project (the first folder up from the current folder with a `package.json` file or a `node_modules` folder; a file named `node_modules` does not count) and in each folder above it. This is the order that Node.js uses to find a package, so a package that npm put in the root folder of an npm workspace counts. The first install that counts runs. A bin link is not needed.
4. Only when step 3 finds nothing that counts: the first `buildos` in `PATH` order that is not this wrapper itself (checked by file identity, so a link or another spelling counts) and not a BuildOS project wrapper of any shipped generation, the Go-era wrapper included, when it is an npm install of exactly the pinned version. On macOS and Linux, its real path (all links followed) must be the `buildos` bin file of the nearest `package.json` above it. On Windows, it must be an npm `.cmd` shim with the package next to it (`node_modules\@brucewaynedecoy\buildos`), or a shim in a `node_modules\.bin` folder with the package in that `node_modules` folder; the shim itself never runs. `pinned-version.cjs` reads `PATH` as POSIX does for the `sh` wrappers: an empty entry is the current folder, and a relative entry is relative to it. It reads at most the first 1,024 bytes of a candidate to tell a project wrapper. The `sh` wrappers start `node` and `npx` by their path on `PATH`, with a leading `./` for a relative entry, so a name that starts with `-` is never read as an option. The `.cmd` wrapper asks Node.js to search `PATH` in order, and never the current folder unless `PATH` names it; a `;` inside a quoted `PATH` entry is part of the folder name.
5. Else `npx -y --prefix <current folder> --workspaces=false @brucewaynedecoy/buildos@VERSION` with the pinned version, with `npm_config_bin_links=true`. `--prefix` and `--workspaces=false` keep npm in the current folder: in an npm workspace, npm does not change to the workspace folder above it. `pinned-version.cjs` starts `npx` on every system, and keeps your own npm bin-links settings in any case and spelling. With no `npx`, a plain message names it and the exit code is `127`. On Windows, a command line that Command Prompt cannot take (8,191 characters) stops with a plain message and exit code `2`; a local install has no such limit.

An install counts only when its `package.json` is a regular file of at most 256 KiB, strict JSON, with the name `@brucewaynedecoy/buildos` and exactly the pinned version (any version for a `dev` pin), and its `buildos` bin file is a readable regular file inside the package and not inside a `node_modules` folder below it. The wrapper then runs that bin file as `node <bin file> <arguments>`, with the same Node.js that ran `pinned-version.cjs`, in the same working folder. A global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version. A pnpm, yarn, or Volta shim, a hand-made script, or a file that cannot be read does not count. To roll back, change `buildos_version` only.

Every start sets `BUILDOS_REQUIRE_VERSION` to the pinned version (or `dev`). BuildOS reads it before it does anything else, after one check of its own Node.js version: below 24, it stops with nothing on stdout, a plain message that names the needed and the found version, and exit code `3`. When its own version (the one `buildos version` reports) is another one, it stops with nothing on stdout, a plain message that names both versions and the two fixes, and exit code `3`; there is no fallback. The `package.json` read above only chooses a candidate. BuildOS removes the variable, and puts back your own npm bin-links setting, before it starts another program.

A `dev` pin (a project set up by a source build) has no published version. It runs only an npm install found as above, of any `package.json` version; BuildOS itself then stops unless it is a development build. Else it stops with exit code `3` and a message that names the two ways that work: use the matching development build (in its source folder `toolkits/buildos`, `npm run build` and `npm link`, or `npm install <that folder>` in the project), or set `buildos_version` to a published version.

A chain of wrappers that comes back to a BuildOS wrapper stops with one plain message and exit code `127` (the `BUILDOS_WRAPPER_ACTIVE` variable marks a running wrapper). The BuildOS program clears that variable when it starts, so a program that BuildOS runs may call a wrapper again. Each wrapper passes the arguments on exactly as it got them: the `.cmd` wrappers never use `call` for that, so Command Prompt does not read the arguments a second time. On Windows, `pinned-version.cjs` starts the chosen program with the same console and returns its exit code, so a folder name in any language, or with `!` or `%TEMP%` in it, works. Command Prompt limit: an argument with an odd number of double quotes changes how Command Prompt reads the rest of the `.cmd` wrapper's line, so a later argument with `&`, `|`, `<`, `>`, or `^` is read as a command character. Put such an argument last.

The `buildos-intake`, `buildos-discovery`, and `buildos-design` wrappers use the legacy command names. Each writes one notice line to stderr first, with the same words as the package legacy name, then runs the `buildos` wrapper in this folder with the matching domain, so the order is the same for all of them. Stdout and the exit code are those of the real command. They are removed in BuildOS `0.3.0` (PRD 20 Legacy Command Names).

## Use

Run wrapper commands from the initialized project root:

```sh
.os/scripts/buildos intake convert --source <path>
.os/scripts/buildos intake index references
.os/scripts/buildos discovery run discovery --playbook-id <PB-NNN> --outcome positive --evidence <path>
.os/scripts/buildos discovery qualify finding --run-id <RUN-NNN> --raw-finding-ref <path#anchor> --outcome positive --confirmation-test <path> --confirmation-evidence <path>
```

On Windows, run the `.cmd` form, for example `.os\scripts\buildos.cmd intake convert --source <path>`.

## Validate

Check the config, scoped frontmatter, and entity records from the initialized project root:

```sh
.os/scripts/buildos validate
.os/scripts/buildos validate --json
```

On Windows, run `.os\scripts\buildos.cmd validate`. It reads [`../contracts/config-contract.md`](../contracts/config-contract.md), [`../config/instance.yaml`](../config/instance.yaml), the frontmatter of the playbooks and playbook templates, and the entity files in [`../data/`](../data/). It changes no file. It exits `0` when it finds no problem and `4` when it finds one; each problem names the file, the field, and what to fix.

`buildos validate` replaces the earlier Python config validator, which BuildOS no longer ships. A project set up with the earlier tools may still have that Python file in this folder. `buildos init` leaves it in place, and no BuildOS command uses it.

Wrappers must remain call-throughs to the BuildOS CLI. Do not add converter, parser, indexing, run-recording, or finding-qualification logic to wrapper scripts.
