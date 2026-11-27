---
title: "20 BuildOS CLI and Distribution"
kind: "prd"
status: "active"
source:
  type: "plan"
  path: "docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md"
---

# 20 BuildOS CLI and Distribution

## Purpose

This subsystem owns the `buildos` command as a product surface. It covers the runtime and package, the command surface, the shared output and exit contract, legacy command names, project initialization and adoption, Make Docs companion setup, compatibility with earlier output, supply chain, release, and the skills that ship in the package.

BuildOS serves adopters who are mostly non-technical product owners and project managers. They work through chat apps with folder access, and the agent in the chat app runs the commands. An adopter with Node.js 24 or newer can set up and run BuildOS without a build step, a manual install, or Python.

## Scope

In scope:

- The runtime, language, module format, package name, license, and supported platforms of the `buildos` CLI.
- The command domains and the rule that splits domain logic from the CLI.
- The JSON envelope, diagnostics, exit codes, root handling, help, and version output that every command shares.
- Legacy command names and how long they work.
- `buildos init`, `.os/manifest.json`, and the adoption of existing projects.
- Optional Make Docs setup during `buildos init`, and the Make Docs commands BuildOS relies on.
- Output compatibility with the earlier Go tools.
- Rules for outside packages, bundling, license notices, and the security document.
- The release flow, provenance, SBOM, scans, and maintainer approval.
- The skills that ship in the package and their router.

Out of scope:

- An MCP server. The core and CLI seam reserves it. The decision on when to build it is tracked as `Q-012` in the [open questions and risk register](./03-open-questions-and-risk-register.md).
- Standalone executables with Node embedded.
- `buildos update`, `buildos uninstall`, and project sync. W2 owns them and extends `.os/manifest.json` for them.
- OCR for scanned PDFs.

Related authority:

- [02 Architecture Overview](./02-architecture-overview.md) owns the module map and runtime boundaries.
- [05 Spaces, Boundary, and Shipping](./05-spaces-boundary-and-shipping.md) owns what ships and where it lands in a project.
- [06 Operating Layer and Routing](./06-operating-layer-and-routing.md) owns wrapper resolution and agent routing to skills.
- [07 Intake and Conversion](./07-intake-and-conversion.md) owns conversion behavior and the conversion accuracy gate.
- [11 Flow C Integration](./11-flow-c-integration.md) owns design promotion and the Make Docs hand-off.
- [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md) owns the config that `buildos validate` checks.
- [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md) owns entity identity, redirects, and the shared resolver that entity commands use.

Code anchors:

- `toolkits/buildos/`
- `system/`

## Runtime and Package

BuildOS requires Node.js 24 or newer. The package declares `"engines": { "node": ">=24.0.0" }`, the same floor as Make Docs.

BuildOS is written in TypeScript with `strict` on, compiled with `tsc`, and shipped as ESM. Tests run with Node's built-in test runner (`node:test`). esbuild builds the published bundle. Arguments are parsed by a small built-in parser that follows Go's `flag` package rules, so existing commands and flag spellings keep working. No CLI framework or outside parsing package is used.

The package source lives at `toolkits/buildos/`. It is one npm package named `build-os`, an unscoped name published under the npm account `brucewaynedecoy`, licensed Apache-2.0. The command it installs is `buildos`. A `LICENSE` file sits at the repository root and in the package.

BuildOS supports macOS, Linux, and Windows, each on x64 and arm64 where Node 24 supports them. CI runs on all three operating systems.

npm is the only distribution channel. An agent runs BuildOS with `npx -y build-os@<version>` and needs no install step. A person can install it with `npm install build-os` in a project or `npm install -g build-os` for the whole machine. BuildOS ships no Homebrew formula and no per-OS archive.

The published package has no runtime `dependencies`. All runtime code is in the bundle. See [Supply Chain](#supply-chain).

BuildOS is local-only. The CLI makes no network calls. There are only two exceptions: the `npx` fetch of the BuildOS package itself, and the Make Docs setup that the user chooses in [Make Docs Companion Setup](#make-docs-companion-setup). Any new network call needs an accepted design and an opt-in flag.

The package carries the `system/` package content that `buildos init` places in a project. It carries no Make Docs content: the source `system/` folder has no `docs/` or `.make-docs/` folder, and the build leaves out any such folder.

When Node is missing or older than 24, the project wrapper scripts print one plain message that names what to install and stop with a non-zero exit code. The adopter sees no stack trace. [06 Operating Layer and Routing](./06-operating-layer-and-routing.md) owns the wrapper resolution order.

Code anchors:

- `toolkits/buildos/`
- `system/.os/scripts/`

## Command Surface

BuildOS is one `buildos` executable with domain commands:

| Domain | Purpose |
| --- | --- |
| `buildos entities` | Resolve, validate, index, and consolidate entities |
| `buildos intake` | Convert sources and rebuild the references and playbooks indexes |
| `buildos discovery` | Run discovery, anchor raw findings, and qualify findings |
| `buildos design` | Promote a qualified finding into a design file, through `buildos design promote` |
| `buildos init` | Initialize a new project or adopt an existing one |
| `buildos validate` | Check the adopter config and entity record hygiene |
| `buildos version` | Print the package version and source revision |
| `buildos help` | Print help for the CLI or a domain |

From `0.2.0`, the CLI also provides these commands, which carry logic that skills run today:

| Command | Purpose |
| --- | --- |
| `buildos extract bulk` | Bulk extraction |
| `buildos fitgap` | Fit-gap analysis, with `.xlsx` output |
| `buildos export azure-boards` | Azure Boards CSV export |

After `0.2.0`, an adopter needs Node and nothing else. No user-facing command needs Python.

The entity commands keep the contract in [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md). [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md) owns what `buildos validate` checks.

Domain logic lives in a transport-neutral core inside the package. The CLI is a thin adapter. It parses arguments, calls the core, and formats results. These rules hold:

- Only the core applies BuildOS domain rules and makes authoritative BuildOS writes.
- The core returns typed results and typed errors. It never writes to stdout and never calls `process.exit`.
- An adapter never shells out to another adapter or to another `buildos` command to do domain work.
- Each domain keeps its own ownership boundary inside the one package. [02 Architecture Overview](./02-architecture-overview.md#module-map) owns the domain ownership rule and the domain table.

`buildos design promote` writes a design file under `docs/designs/`. Make Docs owns that path, so this is a current limitation that conflicts with the Make Docs product boundary. It is tracked as `R-009` in the [open questions and risk register](./03-open-questions-and-risk-register.md). In a project whose design template is in the Make Docs 2.0.9 layout, the design follows that template and the project's design contract (the Make Docs 2.0.9 form); a project with the earlier layout gets the earlier text. It reads the Make Docs design inputs from the project as Make Docs set them up, and never starts `make-docs` itself. When an input is missing or empty it stops with exit code `3` and says what to do, by the same rules `buildos init` uses: where the tested Make Docs version cannot set up the folder (a root `AGENTS.md` or `CLAUDE.md` with no Make Docs section, as after `buildos init --skip-make-docs`), it says so and shows no command; otherwise it shows the Make Docs setup command that `buildos init` shows for a later setup, for the folder that holds the BuildOS content, written for the shell of the system. [11 Flow C Integration](./11-flow-c-integration.md) owns the promotion contract and the input order.

Code anchors:

- `toolkits/buildos/`

## Output and Exit Contract

Every command shares one output contract:

- Human-readable output is the default.
- `--json` gives a stable automation form.
- `--root` sets the project root where the command takes one.
- Help and version behave the same in every domain.
- Diagnostics, the JSON envelope, and exit codes are shared and assigned centrally.

Every domain command takes `--json`: `version`, `validate`, `init`, the `entities` commands, `intake convert`, `intake index references`, `intake index playbooks`, the `discovery` and `design` commands, and `extract bulk`, `fitgap`, and `export azure-boards`. With `--json`, stdout holds only the envelope, and stderr holds only informational and legacy-name notices. The exit code is the same as in the human form, except for a failed `intake` write that changed something (see the next paragraph). A warning that the human form prints on stderr, such as an image that `intake convert` did not copy, is a `warning` diagnostic in the envelope. For `intake`, `discovery`, and `design`, an unexpected error gives exactly one output form: the envelope with an `internal_error` diagnostic when the command's own parser found `--json`, else one stderr line. Help prints text: `buildos help <domain>`, `buildos <domain> --help`, and `buildos <domain> help` print the help text, also with `--json` after them. The ported commands (`intake`, `discovery`, `design`) find `--json` with the earlier Go tools' flag rules: only as a whole argument in flag position of the subcommand. For these commands, `--help` after a subcommand is a Go flag request: it prints the flag list on stderr and exits `1`. When `--json` comes before `--help`, it is a `usage_error` envelope with exit code `1`. When `--json` comes after `--help`, the parse stops at `--help`, so the text form prints (stdout empty, exit code `1`). For these commands, `root` is the project root as the command cleans it, set from the moment the flags parse (empty before), and each path in `result` is relative to `root` with `/`; a destination outside the project that `--allow-outside-root` allowed is the absolute path with `/`.

Intake does not undo; the envelope names what stayed. When a write of `intake convert` or `intake index` fails, the command never removes or puts back a folder or file, with or without `--json` (as the earlier Go tool). With `--json`, each write operation of the run says what it did: it made a folder, made a file, changed an entry that was there, or changed nothing. When no operation changed anything, the envelope reports `not_requested`, `result` null, and the exit code of the text form. When an operation changed something, the envelope reports `partially_applied`, lists in `result.left_in_place` each path that the run created or changed, once, with the reason `created` or `changed`, and the command exits with code `10`. The text form keeps the exit code of the underlying failure (`1` for a failed write, `3` for a refusal). So the two forms can give different codes for one failure: for an index whose parent folder the run made before the port refused the file, the text form exits `3` and the JSON form exits `10` (parity exception PE-022). Each entry says what the run did at that time; another program can change the path after that, so look at the entry before you remove it. Without `--force`, `intake convert` never overwrites a twin or side artifact: when another program makes the file after the command's existence check, the command stops with the `use --force` error and that file keeps its bytes (parity exception PE-010).

Root handling uses one model for every domain. The root is the project folder that holds `.os/`. Entity commands require an explicit `--root` whose `.os/data/` exists. They never infer the root from the current folder. `buildos init` with no `--root` targets the current working directory. It never walks up to a parent folder to find a root. `buildos validate` uses the same rule: with no `--root`, it checks the current working directory, and a folder with no `.os/` folder stops it with exit code `3`.

A write that would land outside the project root is refused (exit 3) unless the command is given `--allow-outside-root`; a link at the written file itself is replaced, never followed. The switch is for write destinations only: it never widens a read of project data or of a file another file names.

A relative path that the user names on the command line (a source, an evidence file, a confirmation test, or a non-default output or folder) is used as written, relative to the project root. In an initialized project that has no `system` entry at its root, a leading `system/` is the earlier spelling of the source package and is dropped, as the earlier Go tools did; where the project owns a `system/` folder, a `system/...` path names that folder. The default paths, such as `--assets-root system/assets`, always name the initialized-project paths (`assets/`).

Every domain tells an initialized project from the BuildOS checkout by one rule, which [05 Spaces, Boundary, and Shipping](./05-spaces-boundary-and-shipping.md#installed-project-paths) states: a project without `docs/` (set up without Make Docs) is an initialized project.

Every file read has a size bound, checked on the opened file before its bytes are kept: 128 MiB for a data file, index, or manifest, 64 MiB for a document that discovery or design reads whole, 4 MiB for a Make Docs design input, and 512 MiB for an intake file. A larger file is not read, and the command fails with a message that names the bound. A file that BuildOS writes and later reads back (an index, a dataset, a run or finding record, a converted file) is never written larger than the bound its reader uses: the command stops before its first write with exit code `4`, names the file and the bound, and writes nothing; a dry run reports the same stop. Each row of a JSONL file that BuildOS writes also fits the line limit of its reader: 64 KiB for `.os/data/runs.jsonl` and `.os/data/findings.jsonl`, which discovery and design read line by line, and 16 MiB for any other governed dataset, which the entity commands read; a longer row stops the command the same way, with exit code `4`. When a command adds a row to `.os/data/runs.jsonl` or `.os/data/findings.jsonl` and the file does not end in a line feed, it writes a line feed before the new row, so the new row never joins the last one on a line; the size and row checks run on the exact bytes the command would write, in a dry run too. A file that BuildOS reads from the project itself for a check or a hand-off (the files `buildos validate` checks, the shared files and manifest of `buildos init`, the entity data that discovery and design resolve, and the Make Docs design inputs of `buildos design promote`) is read inside the project only, with or without `--allow-outside-root`. For the design inputs, a link is read only when it leads to a regular file inside the project; a link that leads out of the project stops the command with exit code `3`, and the message does not offer the write switch. [11 Flow C Integration](./11-flow-c-integration.md#contracts-and-data) states the one exception for a designs folder that is itself a link. An image that an HTML document names is read only when its real path is inside the folder that holds the document (or the HTML folder the user selected) or inside the project. Its address is percent-decoded once before that check, so `my%20image.png` names `my image.png` and an encoded `../` is refused like a plain one; when no file has the decoded name, the address as written is used. Any other image, an address that decodes to a zero byte, and an image over the intake bound are not copied: the converted file keeps an "Uncopied image" marker with the address as the document gives it (relative to the document, not to the converted file), and the command names the image and the reason on stderr and still succeeds. `SECURITY.md` lists each read site and its bound.

The JSON envelope has at least these fields:

```json
{
  "ok": true,
  "command": "entities.resolve",
  "version": "dev",
  "source_revision": "unknown",
  "root": "<project-root>",
  "mode": "compat",
  "write_status": "not_requested",
  "result": {},
  "diagnostics": []
}
```

`write_status` is one of these values:

- `not_requested` for a read-only operation.
- `planned` for a dry run that was not applied.
- `applied` when every authorized write completed.
- `canonical_applied_index_failed` when a canonical write committed but the derived index rebuild failed.
- `partially_applied` when a write failed and the command could not undo all of its own changes. The result and the diagnostics name every path that was left changed, and the command exits with code `10`.

A write command that stopped before any write took effect, or that undid every write it made, reports `not_requested`.

`buildos version` and every envelope report the package version and the source revision. A source build reports version `dev` and source revision `unknown`. A release build sets both.

Exit codes fall into these classes: success, usage error, contract or validation failure, needs operator review, and internal failure. The current numbered codes are:

| Code | Meaning |
| --- | --- |
| `0` | The operation completed, including a clean check or a dry run. |
| `1` | An internal or unexpected failure stopped the command. This matches the legacy tools. |
| `2` | Command or flag usage is invalid. |
| `3` | The root or a required input cannot be loaded or parsed. |
| `4` | A contract, validation, graph, or reviewed-remap conflict prevents the operation. |
| `5` | An I/O or canonical-write failure stopped a valid write from committing. |
| `6` | A canonical write committed but the derived index rebuild failed. The diagnostic names the exact recovery command. |
| `10` | The command needs operator review before it can continue. For example, `buildos init` has no TTY and no Make Docs flag. |

Every BuildOS entry (`buildos` and each legacy name) checks its own Node.js version first, before any command code, output, or file access. Below the `engines` minimum (24), it stops with exit code `3`: a required input, a Node.js that BuildOS supports, is missing. Stdout stays empty, and stderr has one plain message that names the needed and the found version and how to fix it. With `--json` on the command line, stdout has the failure envelope instead (`ok` false, `write_status` `not_requested`, one diagnostic with code `node_version`), and stderr stays empty. The bundle reaches this check on Node.js 20.

A project wrapper sets `BUILDOS_REQUIRE_VERSION` to the pinned version (or `dev`) on every start. Every BuildOS entry (`buildos` and each legacy name) reads it next, before any command code, output, or file access. When it is set, not empty, and not exactly the program's own version as `buildos version` reports it, the program stops with exit code `3`: the pinned version, a required input, cannot be loaded. Stdout stays empty, and stderr has one plain message that names the required version, the version that started, and the two fixes (fix the install, then run the project wrapper again; or set `buildos_version` in `.os/manifest.json`). For a `dev` pin, the message also names the development-build recovery: replace a project-local install with the built development package, or remove the local install so that the linked build on `PATH` runs. With `--json` on the command line, stdout has the failure envelope instead (`ok` false, `write_status` `not_requested`, one diagnostic with code `version_mismatch`), and stderr stays empty. Nothing falls back after a refusal. The program then removes the variable from its own environment, and puts back the caller's npm bin-links settings that the wrapper changed for `npx` (`BUILDOS_NPM_BIN_LINKS_OVERRIDE` and `BUILDOS_SAVED_<name>`), so a program that BuildOS starts gets neither. An unset or empty variable means no check.

Code `10` means needs operator review and nothing else. No other code reuses its meaning. `buildos init` uses it when it stops for a Make Docs choice. See [Make Docs Companion Setup](#make-docs-companion-setup).

In JSON mode, diagnostics are stable records. In human mode, they are short messages on stderr. Informational and legacy-name notices go to stderr. They never change stdout or the exit code of a successful command.

The core returns results, diagnostics, and errors as typed values. The CLI alone turns them into stdout, stderr, and an exit code.

Code anchors:

- `toolkits/buildos/`

## Legacy Command Names

The package `bin` map lists `buildos`, `build-os`, `buildos-intake`, `buildos-discovery`, and `buildos-design`. `buildos` points to the bundle, `dist/buildos.js`. `build-os` points to the same file and runs exactly as `buildos`: no notice line and no domain added. It exists because `npx -y build-os@<version>` runs the `bin` named after the package when a package has more than one. `build-os` is not a legacy name and does not go away in `0.3.0`. Each legacy name points to its own small entry file (`dist/buildos-intake.js`, `dist/buildos-discovery.js`, `dist/buildos-design.js`). An entry file passes its legacy name to the same bundle explicitly, then runs it. BuildOS never takes the command name from the path it was started under, so each legacy name works the same way on macOS, Linux, and Windows, including through npm's Windows `.cmd` and `.ps1` shims. The entry files ship in the package and go away with the legacy names.

When BuildOS starts under a legacy name, it maps the legacy arguments to the matching `buildos <domain>` command. It keeps the legacy output and exit behavior. It writes one line to stderr that says the name is going away and names the new command to use.

The project scripts with the legacy names follow the same rule. `.os/scripts/buildos-intake`, `buildos-discovery`, and `buildos-design`, and their `.cmd` forms, write the same one line to stderr first, with the same words as the package legacy name, once. Then they run `.os/scripts/buildos <domain>` with the arguments unchanged. The line never changes stdout or the exit code of the real command.

Legacy names work through the `0.2.x` releases. They stop working in `0.3.0`: the package legacy names and the project scripts with the legacy names are removed together. Release notes and the user guide announce that change before `0.3.0` ships.

No `buildos-entities` or `buildos-lifecycle` command name exists.

Code anchors:

- `toolkits/buildos/`

## Project Initialization and Adoption

`buildos init` sets up a new project with one command. It places the `system/` package content at the project root. It writes `.os/manifest.json` with at least:

- the BuildOS package version;
- the manifest schema version;
- the time of initialization.

The project wrapper scripts read the pinned BuildOS version from `.os/manifest.json`. W2 extends the same file for update and sync.

The manifest contract is one rule set. `buildos init` and the wrappers apply the same rules, and a shared table of accepted and refused manifests tests both:

- The file is a regular file at its name: a link is not followed. `buildos init` and the wrappers each check this at their own read, open the file once, and read it with a bound, so a larger file is refused without being read.
- The file is UTF-8 text of at most 64 KiB. One UTF-8 byte order mark at the start is allowed and ignored. Bytes that are not valid UTF-8 are refused.
- The content is one JSON object. Other fields are allowed.
- `schema_version` is the number `1`.
- `buildos_version` is an exact version or `dev`. An exact version follows semver.org 2.0.0 without build metadata: `MAJOR.MINOR.PATCH` with no leading zeros, and an optional pre-release of dot-separated identifiers made of ASCII letters, digits, and `-`, where a numeric identifier has no leading zero. Each of `MAJOR`, `MINOR`, and `PATCH` is at most 9007199254740991, the largest number that npm reads as a version; npm reads a version with a larger number as a dist-tag. It has at most 256 characters. A range, a tag such as `latest`, a `v` prefix, and build metadata (`+...`, which npm ignores) are refused. `dev` is what a source build writes. It has no published package, so a wrapper never runs `npx` for it. A wrapper runs a `dev` pin only with an installed package that it finds (of any `package.json` version, for example a build linked with `npm link` from its source folder, [06 Operating Layer and Routing](./06-operating-layer-and-routing.md#contracts-and-data)); the program itself then refuses to run unless it is a development build. Without such a package, it stops with exit code `3` and a message that names the two ways that work: use the matching development build, or pin a published version in `.os/manifest.json`.
- `initialized_at` is an ISO 8601 UTC time, `YYYY-MM-DDTHH:MM:SS` with an optional fraction of 1 to 9 digits and a final `Z`, that names a real calendar time.

A manifest that breaks the contract stops a rerun with exit code `10`, and stops a wrapper with exit code `3`. A rerun reports the manifest on disk, not a new one.

Before it plans, `buildos init` applies the rule that tells an initialized project from the BuildOS checkout ([05 Spaces, Boundary, and Shipping](./05-spaces-boundary-and-shipping.md#installed-project-paths)). When that rule reads the folder as the BuildOS source code (a `system/.os/` folder and no `.os/manifest.json`), `buildos init` stops with exit code `10`, writes nothing, and says to run it in the project folder or to pass `--root` with it.

When `buildos init` finds an existing `.os/` folder with no `.os/manifest.json`, it adopts the project, which the earlier Go tools set up. It adopts only a folder with the marks of such a project: an `.os/data/` folder, or all five of `.os/`, `assets/`, `docs/`, `playbooks/`, and `workspace/`. Any other `.os/` folder stops it with exit code `10`, nothing written, and a plain message. Adoption writes only these paths:

- `.os/manifest.json`;
- the wrapper scripts;
- `.os/skills/`.

With no `--root`, `buildos init` sets up or adopts the current working directory. It never walks up to a parent folder to find a root. See [Output and Exit Contract](#output-and-exit-contract).

Adoption never changes user data, runs, findings, indexes, or config. A project set up with the earlier Go tools keeps every data file byte for byte. Adoption also never removes a file that an earlier version shipped and this version does not, such as the earlier Python config validator `.os/scripts/validate_config.py`; it stays in place, and no BuildOS command uses it. W2 update owns the removal of such files. When an adoption (or its dry run) finds a regular file at `.os/scripts/validate_config.py` (a folder or a link there is not the old validator), the human output adds one plain note, and the JSON result adds it to `notes` (code `legacy_validator_kept`, the path, and the message): BuildOS no longer uses the file, `buildos validate` replaces it, BuildOS left the file as it is, and the user can delete it. The JSON result has `notes` only when there is a note.

When `.os/manifest.json` exists, BuildOS is already set up, and running `buildos init` again is idempotent. The rerun checks that `.os/manifest.json` is a regular file that holds a valid manifest. If it does not, the rerun writes nothing, exits with code `10`, names the file, and says how to fix it. A valid rerun writes no BuildOS file and never overwrites one: it reports the other installed files as already present and keeps them as they are. It only refreshes a valid BuildOS section that is already in a shared file, and reports each such file as updated or unchanged. It creates no shared file and adds no section, and it reports every other shared file as not changed, with the reason: no BuildOS section, missing, not a regular file, a link, larger than 4 MiB, not UTF-8 text, or not readable. It decides each shared file from its whole content, so a section changed by hand stops a rerun too, before any write. The rerun summary says that a section is up to date only for a file whose section BuildOS read and checked. When BuildOS could not read a shared file (not readable, or larger than 4 MiB), the summary names each such file and says why, in the human and the JSON output. A successful rerun exits with code `0`, also when nothing changed. W2 owns update and repair of the installed files.

`buildos init` also sets up a folder that already holds other files but has no `.os/` folder. This is the normal case when a user opens an existing project folder. BuildOS adds its files next to the existing ones and never overwrites a file. When any path that `buildos init` must write already exists, it writes nothing and exits with code `10`. Its human and JSON output list every clashing path and give a plain tip, for example: "Move or back up these files, then run `buildos init` again."

Three root files are shared, and they never clash: `AGENTS.md`, `CLAUDE.md`, and `.gitignore`. This list is closed. In each of them, `buildos init` owns only its own section and never changes a byte outside it. The section starts with a `<!-- buildos:begin -->` line and ends with a `<!-- buildos:end -->` line in `AGENTS.md` and `CLAUDE.md`, and with `# buildos:begin` and `# buildos:end` lines in `.gitignore`. Its first line inside is an integrity line: `<!-- buildos:section v1 sha256=<hex> -->` in `AGENTS.md` and `CLAUDE.md`, and `# buildos:section v1 sha256=<hex>` in `.gitignore`. The hash is the SHA-256 of the exact section text after the integrity line up to the end line, with each CRLF read as LF, so a conversion of the whole file to CRLF keeps it valid.

- When the file does not exist, `buildos init` creates it with only the section.
- When the file has no valid section, `buildos init` adds the section at the end of the file, after one empty line. It uses the file's own line breaks (CRLF or LF). A UTF-8 byte order mark and the end of the file without a final line break stay as they were. When the file ends inside a code block, raw HTML block, or HTML comment that is never closed, a section at the end would be inside it, so `buildos init` adds the section at the start of the file instead (after a UTF-8 byte order mark), with one empty line after it, and reports it as added at the top. A file with no marker lines never stops for a region.
- When the file has one valid section, `buildos init` replaces that section in place with the current content. When the section's text (each CRLF read as LF) is already the current content, the file is not written and keeps every byte, whatever line breaks it and the rest of the file use; such a file is not subject to the hard link stop below, because nothing is written. A second run never adds a second section.
- BuildOS owns a section only when it can prove that it wrote it and that no one changed it: a begin line at column 0, the integrity line right after it, the next end line at column 0, and a hash that matches the text between them. The proof holds wherever the section sits. A marker line is a whole line that starts at column 0, with only spaces and tabs after the marker, at any line length; marker text anywhere else, such as an indented line or the middle of a line, is the user's text.
- A pair of marker lines without a valid integrity line is never replaced and never deleted. When it is inside a code or raw region, it is the user's example: it stays, and `buildos init` adds its own section as usual. When it is outside every region, the section was changed by hand or is an example, and `buildos init` writes nothing, exits with code `10`, names the file and the line, and says: move your own text outside the buildos lines, or delete the buildos lines, then run `buildos init` again. More than one valid section, or marker lines outside every region that do not form one pair (a begin line with no end line after it, an end line before the begin line or with no begin line), also stop the command with exit code `10`, the file, and the line.
- In `AGENTS.md` and `CLAUDE.md`, the regions are fenced code (three or more backticks or tildes, at any indentation, also inside list items and block quotes, closed by a line of the same character that is at least as long), raw HTML `<pre>`, `<script>`, `<style>`, and `<textarea>` opened anywhere in a line outside code spans and closed only by their own closing tag, and HTML comments opened anywhere in a line outside code spans and closed only by `-->`. A fence inside an HTML comment is not a fence, and a marker line inside an open comment does not close it. A begin line inside a region starts the user's example: every line through the next end line belongs to it, whatever comment closers its lines hold, and the region open at the begin line is still open after that end line. `.gitignore` has no regions. The region scan errs toward "inside a region". It is a second line of defense: without a valid integrity line, `buildos init` only adds bytes or stops, so a mistake in the scan never changes or removes a byte of the user's.
- A line ends at LF or CRLF. A bare CR (one not followed by LF) is ordinary text: it is never a line break and never marker padding. A shared file whose buildos lines BuildOS finds only when it reads a bare CR as a line break (old Mac line endings, CR only) stops the command before any write, with exit code `10`, the file and line named, and the fix: save the file with LF or CRLF line endings, then run `buildos init` again.
- BuildOS changes only UTF-8 text, or any text whose bytes outside the section it can keep as they are. A shared file that starts with a UTF-16 or UTF-32 byte order mark, or holds a zero byte, stops the command before any write, with exit code `10`, the file named, and a plain fix. A UTF-8 byte order mark stays, also when the section starts on the first line.
- A shared file that is a link is never followed for a write. A link that the operating system resolves to another of the three shared files in the same folder (the same entry), for example `CLAUDE.md` pointing to `AGENTS.md`, stays as it is, because that file gets the section. Any other link, including a dangling one, stops the command before it writes, with exit code `10` and a plain message.
- Each shared file and the manifest are read once per plan, with a hard bound on the bytes read. A shared file larger than 4 MiB stops the command before it writes, with exit code `10`. A root router that BuildOS may not read stops only an operation that needs its text, such as adding a section; an adoption or a rerun goes on, and for the Make Docs text the file counts as one that Make Docs did not write.
- A file that `buildos init` would replace and that has more than one hard link stops the command before Make Docs runs, with exit code `10`, the file named, and a plain fix: a replace would break the link, so the names would no longer share their text. This covers the shared files that BuildOS writes and the files an adoption replaces, also a wrapper link that itself has more than one hard link. On Windows the link count is the one Node.js reports; a file system without hard links and some network shares report one link, so the check cannot see a link there.
- The output reports each shared file as created, section added (at the top, when the file ends inside an unclosed region), section updated, unchanged, or, in a rerun, not changed with the reason. The dry run and the JSON output describe the same actions.

On a volume that finds names in any letter case (macOS and Windows by default), an existing entry spelled differently from the package path, for example `agents.md`, is the entry `buildos init` uses, and it keeps its spelling. On a case-sensitive volume, differently spelled names stay distinct.

Every clash and shared-file check happens before the first write of any kind, including the Make Docs setup. Before Make Docs runs, `buildos init` also reads every file or link that it will replace, once, with a bound; a file it cannot keep a copy of (over 4 MiB) stops the command with exit code `10`. Before Make Docs runs, it also checks that every existing folder it writes in allows a new entry. The check looks at the folder that the create or rename acts in, never through a link in it. On macOS and Linux it is the operating system's access check. On Windows, Node.js cannot check a folder's access rules, so only the folder's existence and type are checked there; a denied write then fails during the run and is undone. When a folder does not allow it, `buildos init` writes nothing, runs nothing, lists the folders, and exits with code `5`. Just before it replaces a file or link, it checks that the entry is still exactly what it read before Make Docs ran: the same bytes or link text, the same permission bits (a link's own bits where the operating system keeps them), the same hard link count, and the same identity. An identity that the file system does not report (an inode number of 0) never matches, so such a check declines. When the entry changed, the run stops and is undone (exit `10`), and the user's change stays. The writes of one run succeed or fail as one unit: when a later step fails, `buildos init` removes every file and folder it created and puts back each file or link it replaced, with its exact earlier bytes or link text and its full permission bits. A write that took effect before a later part of it failed, such as the folder flush after a rename, is undone too. It acts only on an entry that is still exactly what it wrote there: the same identity, the same bytes, and the same permission bits. A later change by the user, also one made in place, stays. The human and JSON output list every path that it could not put back, and every temporary file that it could not remove, with the reason; then the command exits with code `10`, the needs-operator-review code, and the JSON `write_status` is `partially_applied`. Each listed path has a `state`: `left` for something still there that BuildOS could not undo, or `unsure` for an earlier file that BuildOS put back but whose save to disk it could not confirm. A created file that is already gone is not listed. A folder that BuildOS made but could not read back is listed and left in place. After a complete undo, the command exits with the code of the error. An adoption never writes the shared files. A replaced shared file keeps its POSIX permission bits. A file that an adoption replaces keeps its own permission bits and gets the owner-execute bit, so the wrapper runs; a link that an adoption replaces becomes a file with the package mode. A replaced file does not keep extended access control lists (ACLs) or extended attributes; the security document states this limit.

Before it writes, `buildos init` shows the planned writes. `buildos init --dry-run` shows the plan and writes nothing.

[05 Spaces, Boundary, and Shipping](./05-spaces-boundary-and-shipping.md) owns the installed project paths. [06 Operating Layer and Routing](./06-operating-layer-and-routing.md) owns the wrappers and `.os/` routing.

Code anchors:

- `toolkits/buildos/`
- `system/`
- `system/.os/scripts/`

## Make Docs Companion Setup

`buildos init` offers to set up Make Docs. The user makes this choice before anything is written. When the answer is Yes, Make Docs setup runs first, before BuildOS writes any file, so Make Docs sees the folder as the user had it. Then BuildOS writes its files and adds its section to the shared files, including the `AGENTS.md` and `CLAUDE.md` that Make Docs created. Both tools then share these files, each in its own marked section.

- In an interactive terminal, `buildos init` asks `Set up Make Docs in this project? [Y/n]`. Yes is the default.
- `--make-docs` answers Yes without a prompt. `--skip-make-docs` answers No without a prompt.
- With no TTY and no flag, `buildos init` stops before it writes anything. It exits with code `10`, the needs-operator-review code.

When it stops for this choice, the human output and the JSON output both explain the two choices in plain words. They say what Make Docs adds and whether the user can set it up later with the tested Make Docs version (see below). They give the two exact commands to run, quoted so that they work when copied into the shell of the system: `sh` on macOS and Linux, and Command Prompt with its default settings on Windows. The output names that shell: the JSON `shell` field is `sh` or `cmd`, and on Windows the human output says to run each command in Command Prompt. The skills router tells agents to put this choice to the user.

When the answer is Yes, BuildOS runs Make Docs through its public CLI only. It uses `make-docs` on `PATH`. If that is not found, it uses `npx -y @brucewaynedecoy/make-docs@<pinned range>`. It passes every setup choice explicitly:

```sh
make-docs setup --target <project> --codex-method none --claude-code-method none --no-github-copilot --no-skills --project-resources all --yes --json
```

`--project-resources all` copies templates and contracts into the project, so agents in chat apps can read them without the Make Docs CLI.

When Make Docs setup fails, BuildOS setup still counts as complete. `buildos init` exits with code `0`. The human output says that Make Docs is not set up and shows the exact command to retry. The JSON envelope has `ok` set to `true` and `result.status` set to `partial`, and it carries the same retry command, so an agent can tell the user.

The tested Make Docs range refuses to set up a folder that already has a root `AGENTS.md` or `CLAUDE.md` that Make Docs did not write. Make Docs marks the files it writes with its own section, between `<!-- make-docs:begin -->` and `<!-- make-docs:end -->` lines; a file with that section does not block it, also after BuildOS added its own section. `buildos init` decides what to say from those sections on disk, and from what it actually wrote, never from the kind of setup alone. A new project with no such files gets them from BuildOS with only the BuildOS section, so after BuildOS setup, Make Docs from this range cannot be set up there later. Every output says this plainly where it matters, and none promises a later setup that cannot work, or says that a later setup cannot work when it can:

- The no-TTY stop says that after a No answer, Make Docs cannot be set up in this folder later with this Make Docs version, when BuildOS would create such a file. When the folder already has an `AGENTS.md` or `CLAUDE.md` without a Make Docs section, it says that Make Docs setup will not finish there, now or later, and that BuildOS setup finishes either way. When every such file in the folder has a Make Docs section, or the folder will have neither file, it says that Make Docs can be set up later.
- The No result says the same. It gives a later Make Docs command only when that command can work.
- When Make Docs setup fails, the output still shows the exact retry command. When the folder has such a file after the run, it also says that the command stops the same way in this folder with this Make Docs version and can work with a newer one. When the folder had its own `AGENTS.md` or `CLAUDE.md` without a Make Docs section before Make Docs ran, it also says that the user's files were kept, and it names each of them that BuildOS added its section to. It never says that BuildOS added a section that it did not write.

BuildOS does not move its section aside to make room for Make Docs. The open question of a Make Docs mode that accepts sections it did not write is tracked as `Q-010` in the [open questions and risk register](./03-open-questions-and-risk-register.md).

After Make Docs ran, BuildOS reads the folder again. When the folder now looks like a different setup (for example, an `.os/` folder appeared), or a new clash or problem is there, BuildOS writes nothing and exits with code `10`. BuildOS carries what the first read saw at each path it will write (missing, a folder, or a file or link with its snapshot) through the second read. When any such path appeared, went away, or changed while Make Docs ran, BuildOS writes nothing, lists each path with what changed, and exits with code `10`. The three shared files are the exception: Make Docs may create or change them, so BuildOS decides them from what is there after Make Docs ran, by the section rules above. BuildOS keeps the Make Docs result the moment the Make Docs process returns, before any other step. Every result after Make Docs ran, including a stop, a failed second read of the folder, or a failed BuildOS write, says what Make Docs did and that a rerun needs `--skip-make-docs`. Such a result never says that nothing was changed.

BuildOS never writes Make Docs-owned files or Make Docs global state itself.

BuildOS pins a tested Make Docs version range. It relies on only these Make Docs commands:

- `make-docs --version`
- `make-docs project state status --json`
- `make-docs setup --json`

A CI contract test runs these commands against the pinned range. It fails when their shape changes. Make Docs publishes no companion contract, so this dependency stays tracked as `Q-010` and `R-001` in the [open questions and risk register](./03-open-questions-and-risk-register.md).

[05 Spaces, Boundary, and Shipping: Integrations](./05-spaces-boundary-and-shipping.md#integrations) owns the Make Docs product boundary. [11 Flow C Integration: Contracts and Data](./11-flow-c-integration.md#contracts-and-data) owns the design hand-off to Make Docs.

Code anchors:

- `toolkits/buildos/`

## Compatibility

For the same input, every BuildOS command and every legacy name gives the same results as the earlier Go tools. That covers written files, stdout, stderr, JSON output, and exit codes. Each must match byte for byte.

PDF text is the one standing exception. It must match after whitespace and line-break normalization. [07 Intake and Conversion](./07-intake-and-conversion.md) owns the conversion accuracy gate that guards PDF content.

Any other difference from the Go output needs an explicit parity exception with a recorded reason. A difference without a recorded exception is a defect.

The entity contract in [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md) is part of this compatibility promise.

The earlier Go code for a domain stays in the repository until that domain passes its parity gate. A domain passes its parity gate when its commands and legacy names match the Go output as this section requires, and every difference has a recorded parity exception. Only then may the Go code for that domain be removed. Git history keeps the removed Go code.

The entities, intake, discovery, and design domains passed their parity gates, and W1 R7 P8 removed the Go code. The committed goldens are the frozen parity baseline. `toolkits/buildos/test/golden/CAPTURE.md` names the Go source commit they were captured from and how to recover the Go tools from git history. The parity harness runs without Go.

Code anchors:

- `toolkits/buildos/`

## Supply Chain

BuildOS uses Node built-in modules first. An outside package is allowed only when Node cannot do the job, and only when it meets every rule below:

1. It is widely used and actively maintained.
2. Its license is MIT, Apache-2.0, BSD, or ISC.
3. It has few or no dependencies of its own.
4. It is pinned to an exact version and recorded in the lockfile.
5. It has no install scripts. CI installs with `--ignore-scripts`.
6. `npm audit` and an OSV scan pass with no high or critical findings.

Rule 5 has one closed exception. Exactly one package, `esbuild` at version `0.28.2`, the exact version pinned in `toolkits/buildos/package-lock.json`, may declare an install script, and only its `postinstall` script. esbuild is a build-time-only package, and it declares a `postinstall` script. That script never runs, because every install uses `--ignore-scripts` and `toolkits/buildos/.npmrc` sets `ignore-scripts=true`. esbuild works without the script through its platform packages. esbuild is never bundled or shipped.

No other package may declare an install script. To add a package to this exception, or to change the esbuild version, the owner must make a new decision, and this PRD must record it. Agents may not extend the exception. The CI dependency guard fails when any other package declares a `preinstall`, `install`, or `postinstall` script, when the esbuild version differs from the allowed version, when the exception holds more than one entry, or when `.npmrc` does not set `ignore-scripts=true`. Each release checks again whether the exception is still needed.

esbuild bundles all runtime code, including outside packages, into the published files. The published package has no runtime `dependencies`. `npm install` and `npx` fetch only `build-os`. They never resolve new third-party versions on a user's machine. A fixed upstream package reaches users only through a rebuilt and republished BuildOS release.

A third-party license notice file ships with the package.

BuildOS keeps one security document for maintainers and enterprise engineering reviewers. It lists every outside package with its version, license, reason, transitive packages, and scan status. It explains the bundling, provenance, SBOM, and release checks. A reviewer can find all of this in that one document. The security document is `toolkits/buildos/SECURITY.md`. It ships inside the npm package.

Code anchors:

- `toolkits/buildos/`

## Release

The first public version is `0.1.0`. It ships when the port of the earlier Go tools, `buildos init`, the packaged skills, `buildos validate`, and the release checks in this section are done. `0.2.0` adds the commands that [Command Surface](#command-surface) lists from `0.2.0`.

A BuildOS release follows these steps. They follow GitHub's procedure for an immutable release: every asset is attached to a draft, and the release is published after that.

1. A reviewed tarball SHA-256 digest is committed in `toolkits/buildos/release-candidates.json` before the release, with the source commit and the reference build environment it was built in: the runner image and the exact Node and npm versions. The same commit gives the same tarball bytes in that environment. Each entry has a kind: `reviewed` (a maintainer inspected the downloaded tarball and the entry records that tarball's digest) or `self` (a dry run made it from its own build). The committed file holds `reviewed` entries only, and a release accepts only a `reviewed` entry. A release reads the file by commit and path from git, and it must be a regular file there (git mode `100644`), never a link.
2. The maintainer creates the tag `v<version>` on a commit of the default branch and a draft GitHub Release for it.
3. A prepare run of the GitHub Actions workflow `.github/workflows/buildos-release.yml`, started by hand from the default branch with that tag, checks the release (steps 5 to 7) and attaches the checked tarball and the CycloneDX SBOM to the draft. The job that attaches them checks that the tarball has the reviewed digest and that the SBOM records that digest and the reviewed source commit.
4. The maintainer reviews the draft and publishes it. Release immutability is on, so the release's tag and assets cannot change after that. Publishing starts a release run of the same workflow.
5. The workflow resolves one commit: in a release run the event commit and the tag's commit must be the same, and in a prepare run it is the tag's commit; either way that commit must be on the default branch. This check runs before any repository code runs, and every later job checks out an exact commit.
6. The workflow checks that the tag, the package version, and the committed entry agree; that the reviewed source commit is an ancestor of the release commit and that the two differ only in the bytes of the release-candidates file; and that the rebuilt tarball's digest equals the committed digest. A release run rebuilds again, so the staged bytes are the reviewed digest and a fresh build of the tagged commit.
7. npm trusted publishing (OIDC) is used, so no publish token is stored. The trusted publisher allows `npm stage publish` only, not `npm publish`. The staging job holds the OIDC permission in the environment `buildos-npm-stage`, which has a required reviewer: a person approves the job in GitHub before it starts. It runs only release-control code from the default branch and reads the candidate as data: it checks that the default branch and the release tags are protected by active rulesets; it requires the published release to hold exactly the tarball and the SBOM, each with GitHub's SHA-256 digest, downloads both, checks the tarball against the committed digest at the release commit, and checks that the SBOM records that digest and the reviewed source commit, is valid against the CycloneDX schema, and has the same bytes as the SBOM that the same run generated from the tagged commit (SBOM generation is deterministic in the reference build environment); it refuses a tarball whose `package.json` holds `publishConfig`, a top-level `tag`, `private`, a lifecycle script, or a dependency field, and runs `npm stage publish <tarball> --provenance` with the registry and the dist-tag set on the command line by that code and with no npm configuration from the environment. npm makes a provenance statement only for a public source repository, so the workflow stops before any build when the repository is not public, and the staging job checks it again first.
8. The maintainer approves the stage with npm 2FA.

npm configures a trusted publisher only for a package that already exists on the registry. The first publication therefore has its own maintainer procedure, chosen by the owner on 2026-11-24: the maintainer stages and approves, by hand, a small placeholder version built from this repository and marked as a reserved name (for example `0.0.0-reserved.0`, with a dist-tag that is not `latest`); then configures trusted publishing for the release workflow, staging only; then `0.1.0` goes through the full workflow with provenance and the dist-tag `latest`. The placeholder is deprecated after `0.1.0` is public. `toolkits/buildos/AGENTS.md` holds the exact steps ([`R-003`](./03-open-questions-and-risk-register.md#r-003-build-os-packaging-upgrade-rollback-and-removal-hardening)).

A release build sets the package version and the source commit, and `buildos version` and every JSON envelope report them. A development build reports version `dev` and source revision `unknown`. A release build refuses a working tree with uncommitted changes.

Each release check is a script that also runs on a maintainer machine. A dry run of the workflow runs the candidate verification checks (the `verify` job) with an invented deny list, reports the provenance preconditions (a public repository and its repository URL) as warnings, and stops before staging; it never stages or publishes. It does not exercise the real-list scan, the ruleset and environment checks, the attachment of the assets to the draft, the required reviewer's approval, the release-asset checks, or staging. A prepare run first exercises the real-list scan, the ruleset and environment checks, and the attachment; a release run first exercises the approval, the release-asset checks, and staging. A dry run that makes its own entry checks a second, independent build against it. The golden comparison also runs from the installed release-stamped tarball: it expects the release version and source commit where a golden holds the development identity, and every other byte as captured.

Release trust boundary: no job that holds the real deny list, a write permission, or the OIDC permission runs code that the release candidate controls. Those jobs run release-control code from the default branch only, with scripts that need only Node built-in modules, and read the candidate tree, its release-candidates file, and the tarball as data. The candidate's build and tests run in a job with no secret and read-only permissions. The tarball is kept for the later jobs only after every check in that job passed, and for a short time. The workflow file of a release run comes from the tagged commit, so the owner's settings keep that commit trusted: required code-owner review on the default branch of the workflows and of every file that defines what a release or CI check means, a tag ruleset, release immutability, and the required reviewer of `buildos-npm-stage`. Write access to the repository is a release-trusted role: a writer can change workflows on their own branch and create tags and draft releases within the rulesets, so code-owner review constrains the default branch only. Untrusted contributions come through pull requests from forks, which get no secrets. The owner deletes any repository secret and protects the default branch and the release tags with rulesets before any environment secret exists. The jobs that hold the real list or the OIDC permission check, with the job token, that those rulesets are active before the secret or npm is used, and fail closed; the job token cannot read who may bypass a ruleset or the repository's release-immutability setting, so the staging job checks that the release itself is immutable.

Each release also has these checks and outputs:

- A CycloneDX SBOM is attached to the draft release with the tarball. `npm sbom` makes it from the lockfile. Because the package has no runtime dependencies, the SBOM marks each package that esbuild bundles into the package with scope `required` and each build-time-only package with scope `excluded`, and it lists the pdf.js build inside `unpdf` and the ported Go code. The document must be valid against the official CycloneDX JSON schema of the spec version it states (1.5), which the repository keeps with its source and SHA-256, so the check needs no new dependency. A check also compares its values with the bundle, the lockfile, `SECURITY.md`, and the third-party notices: each hash with the lockfile integrity, and each package's version and license.
- The `npm audit` and OSV scans from [Supply Chain](#supply-chain) must pass.
- A release check fails when the package contains any name on a maintained client-name deny list. The deny list lives in a CI secret. It is never committed to the repository or shipped in the package, because the list itself names clients. On a match, the check reports the file and line, never the matched name, in the log and in the job summary.

The same deny-list check also runs in CI. Anyone who can push a branch can change a workflow on that branch, so the real list is given only to refs that the owner protects: it is a secret of the GitHub environment `buildos-deny-list` only, under a name that no repository or organization secret has, and the environment's deployment refs are the default branch and the release tags. CI runs the real list on every push to the default branch and the release workflow runs it before staging; both fail closed when the list is missing or empty, and both run only the scanner, with Node built-in modules, over the tree and the built tarball as data. Every other push and pull request, from a fork too, runs the same scanner with an invented list and shows a notice that the real list runs after merge. It scans every file the repository tracks or would track (test fixtures included) and every file the package would ship. It matches each name case-insensitively as a substring, also across a line break at any file size, in file contents, in file, folder, and archive member names, and inside ZIP-based files such as `.docx` and `.xlsx`, where it also reads the visible text of each paragraph, cell, or shared string as one string, joining the text nodes and ignoring the formatting white space between elements. It reads each XML part in its declared encoding (UTF-8, UTF-16LE, or UTF-16BE), and it reads the metadata channels it can reach without a new dependency: ZIP archive and member comments and extra fields, PDF string objects (the document information) and inflated streams (XMP), PNG text chunks, and the raw bytes of other binary files, JPEG metadata included, as UTF-8, Latin-1, and UTF-16. It also fails on a path inside a personal home folder (POSIX, drive, or UNC, with a profile name in any script), such as a build path kept in a compiled file; one fixed simulated path that the bundled PDF reader defines is allowed, only as that exact text in the bundle file. The test suite runs the same check over the repository and the built package file list, as CI does. It also checks every text once with XML and HTML character references decoded (such as `&amp;` and `&#38;`) and once percent-decoded (such as `%20`), so a name with an ampersand written as `&amp;` in a spreadsheet tab name, in HTML-escaped text in a CSV file, or in a link address still matches. It opens each file of the package from that file's own location, and it fails when a file on the package list cannot be read or the list is empty; its summary gives the number of package files it read. It skips nothing silently: every file or archive member it cannot fully read is counted, and such a file in `system/` or in the package fails the check. Every part of every printed path, archive members included, is shown hidden when it matches a name or is a home folder name. It reads every file of the built tarball from the tarball itself, so npm never runs in the candidate's folder. It refuses a malformed or truncated tarball, and it reads every copy of a path or archive member name that occurs twice and fails for it in a shipped file.

Each publication needs explicit maintainer approval.

Code anchors:

- `toolkits/buildos/`
- `toolkits/buildos/release-candidates.json`
- `toolkits/buildos/scripts/release-gate.ts`
- `toolkits/buildos/scripts/release-stage-check.ts`
- `toolkits/buildos/scripts/release-github.ts`
- `toolkits/buildos/scripts/tar-reader.mjs`
- `toolkits/buildos/scripts/release-ledger.ts`
- `toolkits/buildos/scripts/json-schema.ts`
- `.github/workflows/buildos-release.yml`
- `.github/workflows/buildos-deny-list.yml`

## Packaged Skills

`system/.os/skills/` is the one source of BuildOS skills. It holds one folder per skill, each with a `SKILL.md`, and the skills router `AGENTS.md` with a sibling `CLAUDE.md` that points to it. The package carries them, without local clutter (`.DS_Store`, `__pycache__`, `*.pyc`, `*.pyo`). `buildos init` copies them to `.os/skills/` in the project.

- A new project gets every packaged skill file.
- An adoption writes every packaged skill file: it creates a missing one and replaces one at the same path. It keeps any other file under `.os/skills/`, such as a skill the adopter added.
- A rerun writes nothing under `.os/skills/`. W2 update owns refreshing installed skills.

The router, `.os/skills/AGENTS.md`, lists every skill with its purpose. It tells an agent how to install one skill into its own app's skill location when the user or a BuildOS workflow needs it: copy that one skill folder, unchanged, to the app's project skill folder (Claude Code, Codex, and GitHub Copilot are named), and for any other app use that app's documentation or read the skill from `.os/skills/`. It tells agents that when `buildos init` exits `10` for the Make Docs choice, they put the question to the user, explain the Make Docs limit in the words `buildos init` uses, and run the one command `buildos init` printed for the answer.

Skills run BuildOS commands through the project wrapper `.os/scripts/buildos`. Until `0.2.0`, three skills still need Python 3 for their own tools (`buildos-bulk-extract`, `fit-gap-analysis`, and `capability-matrix`), and the router says so. No BuildOS command needs Python.

The `fit-gap-analysis` skill takes owner names from the project config (`owners[].name` in `.os/config/instance.yaml`, [PRD 13](./13-adopter-owned-config-surface.md)) and owner colors from its frame or its own neutral palette file. Its code holds no owner name or owner color.

`buildos init` never writes into app folders such as `.claude/` or `.agents/`.

Shipped skills hold no client content. Their examples use one invented topic. The client-name deny-list check in [Release](#release) guards this.

A skill names only project paths that a new project has, with or without Make Docs, or says what to do when a path is missing: `docs/` exists only with Make Docs, a raw-source staging folder such as `assets/_incoming/` is optional, and a project's own test router is read only when present. A progress report reads indexes and records by default and runs a file-writing generator only when the user asks.

[06 Operating Layer and Routing](./06-operating-layer-and-routing.md) owns how agents route to skills.

Code anchors:

- `system/.os/skills/`
- `toolkits/buildos/scripts/check-deny-list.mjs`

## Human Experience Outcomes

These observable outcomes are current requirements of this subsystem. The standard is `make-docs://system/contract/human-experience-contract.md`.

- An adopter with Node 24 or newer sets up a new project with one agent-run command, `buildos init`, and needs no other install step.
- When Node is missing or older than 24, the adopter sees one plain message that names what to install, not a stack trace.
- The user decides whether Make Docs is set up. With no TTY, `buildos init` stops before it writes anything and gives the agent a short, plain explanation of both choices to put to the user.
- When Make Docs setup fails, BuildOS setup still completes. The output says that Make Docs is not set up and shows the exact retry command.
- When `buildos init` would overwrite an existing file, it changes nothing, lists the clashing files, and gives a plain tip on what to do next.
- A project that already has `AGENTS.md`, `CLAUDE.md`, or `.gitignore` can be set up. BuildOS adds only its own marked section to them and keeps every other line, and the output says what it did to each file.
- Adoption of a project set up with the earlier Go tools changes none of its data files, runs, findings, or config.
- Commands, files, output, and exit codes match the earlier Go tools for the same input. PDF text matches after whitespace normalization.
- Legacy command names work until `0.3.0` and name the new command to use.
- An enterprise reviewer finds every outside package, its version, license, reason, and checks in one security document, plus the SBOM and provenance for each release.

The adopter does not need to know about npm, `npx`, `PATH`, Node versions, bundling, wrapper choice, Make Docs setup flags, or where each chat app keeps skills.

## Requirement History

### 2026-11-26 — W1 R7 P8 owner decision (package name)

- Affected requirement or section: `## Runtime and Package` (the package name and the `npx` command), `## Legacy Command Names` (the `bin` map), `## Supply Chain` (the fetched package)
- Previous contract: The package was named `@brucewaynedecoy/buildos`. An agent ran `npx -y @brucewaynedecoy/buildos@<version>`. The `bin` map listed `buildos` and the three legacy names.
- Replacement contract: The package is named `build-os` (unscoped, npm account `brucewaynedecoy`). An agent runs `npx -y build-os@<version>`, and a person can run `npm install build-os` or `npm install -g build-os`. The `bin` map also lists `build-os`, which points to `dist/buildos.js` and runs exactly as `buildos`. The command name stays `buildos`.
- Rationale: The owner decided on 2026-11-26 that `npm install build-os` and `npm install -g build-os` must work. Nothing was published under the earlier name. npx needs a `bin` named after the package when a package has several `bin` entries (orchestrator decision of 2026-11-26), and without it npm stops with "could not determine executable to run".
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) and [Package Name `build-os`](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#package-name-build-os-2026-11-26)

### 2026-11-25 — W1 R7 P8 pin-first final check

- Affected requirement or section: `## Output and Exit Contract` (the Node.js check and the `dev` refusal message)
- Previous contract: The program checked only `BUILDOS_REQUIRE_VERSION` at its start; only the wrappers checked the Node.js version. The `dev` refusal named the two general fixes only.
- Replacement contract: Every BuildOS entry checks its own Node.js version first and stops below 24 with exit code `3` (nothing on stdout; with `--json`, the failure envelope with `node_version`). The `dev` refusal also names how to recover when a project-local install runs before a linked development build.
- Rationale: The review of `a474c45` found that a project's own `node_modules/.bin/node` at Node.js 20 ran the BuildOS that `npx` fetched, with exit code `0`, and that the `dev` message did not help when a project-local release install ran before a linked development build. Exit code `3` follows the version self-check; the CLI exit-code table has no `127`, which only the wrappers use.
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md)

### 2026-11-25 — W1 R7 P8 pin-first review round 2

- Affected requirement or section: `## Output and Exit Contract` (the version self-check), `## Project Initialization and Adoption` (the `buildos_version` number bound and the `dev` value)
- Previous contract: The program ran whatever version the wrapper or `npx` started. A `dev` pin ran only a package whose `package.json` version was `0.0.0-dev`. A version number had no upper bound.
- Replacement contract: Every BuildOS entry reads `BUILDOS_REQUIRE_VERSION` first and stops with exit code `3` (nothing on stdout; with `--json`, the failure envelope with `version_mismatch`) when its own version is another one; it then removes the variable and puts back the caller's npm bin-links settings. A `dev` pin runs a found package of any `package.json` version, and the program decides. `MAJOR`, `MINOR`, and `PATCH` are at most 9007199254740991.
- Rationale: The review of `9913d62` found that npm can start another version than the wrapper chose (a local `<pin>+local`, a concurrent upgrade), that after the release bump a plain build says `0.1.0` in `package.json` but reports `dev`, and that npm reads `9007199254740992.0.0` as a dist-tag. The orchestrator chose the self-check on 2026-11-25. Exit code `3` fits: the pinned version is a required input that cannot be loaded, and the wrapper already uses `3` for a pin it cannot use.
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md)

### 2026-11-25 — W1 R7 P8 pin-first review round 1

- Affected requirement or section: `## Project Initialization and Adoption`, the `dev` value of `buildos_version`
- Previous contract: A `dev` pin stopped a wrapper with exit code `3`, and its message said to install BuildOS, which did not help.
- Replacement contract: A wrapper runs a `dev` pin only with an installed source build (`0.0.0-dev`); without one it stops with exit code `3`, and the message names the matching development build and a published version pin as the two ways that work.
- Rationale: The review of `f6adf5f` found that the PRD said a `dev` pin always stops while a `dev` program on `PATH` ran, and that the recovery message looped.
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md)

### 2026-11-25 — W1 R7 P8 owner decision (Q-016)

- Affected requirement or section: `## Legacy Command Names`, project scripts with the legacy names
- Previous contract: The section covered the package `bin` names only. The project scripts `.os/scripts/buildos-intake`, `buildos-discovery`, and `buildos-design` ran `.os/scripts/buildos <domain>` and printed no notice. Nothing said when they go away.
- Replacement contract: The project scripts write the same one-line legacy-name notice to stderr first, once, and run `.os/scripts/buildos <domain>` with the arguments, stdout, and exit code unchanged. They are removed in `0.3.0` together with the package legacy names.
- Rationale: A skill or playbook that calls a project script got no warning before `0.3.0`. The owner chose option A on 2026-11-25 (register `Q-016`; parity exception PE-016 covers the line).
- Source: [W1 R7 P8 Release 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md)

### 2026-11-25 — W1 R7 P9 intake JSON final check

- Affected requirement or section: `## Output and Exit Contract` (the exit codes of a failed `intake` write in the two forms, what a `left_in_place` entry says, and `intake convert` without `--force`)
- Previous contract: The exit code with `--json` was the same as in the human form, and a failed `intake` write exited `1` without `--json`. The section did not say that an entry tells what the run did at that time, or what `intake convert` without `--force` does with a file that another program makes after its existence check.
- Replacement contract: The text form keeps the exit code of the underlying failure (`1` for a failed write, `3` for a refusal). With `--json`, a failure after a recorded change exits `10`, also when the text form gives another code. Each entry says what the run did at that time, so the operator looks at the entry before removing it. Without `--force`, `intake convert` never overwrites a twin or side artifact: a file that another program makes after the existence check stops the command with the `use --force` error and keeps its bytes.
- Rationale: The intake JSON review round 3 found that the two forms give `3` and `10` for an index whose parent folder the run made before the port refused the file, that the recovery text could make an operator delete another program's file, and that the writer could truncate a file that another program made after the existence check (as Go's `os.WriteFile` did).
- Source: [P9 Intake JSON Final Check](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-final-check)

### 2026-11-25 — W1 R7 P9 intake JSON review round 2

- Affected requirement or section: `## Output and Exit Contract` (a failed `intake` write with `--json`, the scope of the one-output-form rule for an unexpected error, and `--help` before or after `--json`)
- Previous contract: A failed `intake` write with `--json` removed what the run made, only while each entry was still the one it made; what stayed gave `partially_applied`, `result.not_restored`, and exit `10`. An unexpected error gave exactly one output form in every domain. With `--json`, `--help` after a subcommand was a `usage_error` envelope.
- Replacement contract: Intake does not undo; the envelope names what stayed. A failed `intake` write removes nothing, with or without `--json`. With `--json`, a run whose write operations changed something gives `partially_applied`, each created or changed path once in `result.left_in_place` (reason `created` or `changed`), and exit `10`; a run that changed nothing gives `not_requested` and the text form's exit code. The one-output-form rule for an unexpected error applies to `intake`, `discovery`, and `design`. `--json` before `--help` gives the `usage_error` envelope; `--json` after `--help` gives the text form.
- Rationale: The intake JSON review round 2 found that the undo could remove a file or folder of another program: it took the identity of what it found at a path after the write, not from the write itself. A delete-based undo from outside the writer cannot be made safe from such races at a low cost, and the intake writes were never a transaction in the Go tool. The report must come from the write operations themselves. `buildos validate --json` still prints an `internal_error` envelope and a stderr line for an unexpected error (follow-up F-P9-06), so the rule could not stay general.
- Source: [P9 Intake JSON Review Round 2](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-review-round-2)

### 2026-11-25 — W1 R7 P9 intake JSON review round 1

- Affected requirement or section: `## Output and Exit Contract` (help with `--json`, unexpected errors, the ported commands' `root` and result paths, and a failed `intake` write with `--json`)
- Previous contract: Help prints text, also with `--json`. The section did not say how an unexpected error, the `root` of a ported command, or its result paths look in the envelope. A failed `intake` write with `--json` reported `not_requested` also when files it wrote stayed.
- Replacement contract: `buildos help <domain>`, `buildos <domain> --help`, and `buildos <domain> help` print the help text, also with `--json` after them; for a ported command, `--help` after a subcommand is a Go flag request (exit `1`, a `usage_error` envelope with `--json`). An unexpected error gives exactly one output form, the one the command's parser decided. For a ported command, `root` is the project root as the command cleans it, set from the moment the flags parse, and result paths are relative to `root` with `/` (an allowed outside destination: absolute with `/`). A failed `intake` write with `--json` removes what the run made; what stays gives `partially_applied` and exit `10`. Without `--json`, the Go behavior stays.
- Rationale: The intake JSON review round 1 found a partial conversion reported as `not_requested`, two output forms for one unexpected error, an empty or relative `root`, native absolute result paths, and help text that the CLI did not match. The envelope must be true about what is on disk, and an agent must read one form.
- Source: [P9 Intake JSON Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-review-round-1)

### 2026-11-25 — W1 R7 P9 owner decisions

- Affected requirement or section: `## Output and Exit Contract` (which commands take `--json`)
- Previous contract: Every command shares one output contract, and `--json` gives a stable automation form. The `intake` commands refused `--json` (`flag provided but not defined: -json`, exit 1), as the earlier Go tool did, and no PRD text or parity exception recorded that difference (register D-010).
- Replacement contract: Every domain command takes `--json`, the `intake` commands too. With `--json`, stdout holds only the envelope, stderr holds only informational and legacy-name notices, and the exit code is the same as in the human form. A human-form warning on stderr is a `warning` diagnostic in the envelope. Help prints text, also with `--json`. The ported commands find `--json` with the Go flag rules. Parity exception PE-022 records the difference from the Go intake tool.
- Rationale: The owner decided register D-010 on 2026-11-25 with option A: `buildos intake` gains the shared envelope in `0.2.0`, so an agent that follows this contract gets the envelope from every domain command.
- Source: [P9 Owner Decisions 2026-11-25](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-owner-decisions-2026-11-25)

### 2026-11-24 — W1 R7 P8 final check

- Affected requirement or section: `## Release` (the dry run, the staging job's release-asset checks, the trust boundary and the owner settings)
- Previous contract: A dry run "runs every check". The staging job downloaded the tarball from the published release and checked it; the SBOM on the release was not checked again before staging. The trust boundary relied on required review of workflow and release-script changes, and the in-job checks covered the environments only.
- Replacement contract: A dry run runs the candidate verification checks with an invented deny list and treats the provenance preconditions as warnings; the real-list scan, the ruleset and environment checks, and the attachment are first exercised by a prepare run, and the approval, the release-asset checks, and staging by a release run. Before staging, the trusted check requires exactly the tarball and the SBOM on the published release, each with GitHub's SHA-256 digest, and checks the SBOM's recorded digest and source commit, its schema validity, and its bytes against the SBOM generated by the same run. Write access is a release-trusted role; code-owner review covers every file that defines what a release or CI check means; the owner protects the refs before any secret exists; the privileged jobs check the rulesets in-job and fail closed.
- Rationale: The independent review of `6e8e226` (P8 review round 3) found that the owner checklist installed the secret before the rulesets, that a release with only the tarball passed the staging check, that a direct asset download failed, that CODEOWNERS missed gate implementations and policy inputs, that the sole-maintainer route did not work as written, and that the dry run was described as running every check.
- Source: [P8 Final Check for Stages 1 to 3](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-final-check-for-stages-1-to-3)

### 2026-11-24 — W1 R7 P8 review round 2

- Affected requirement or section: `## Release` (the release steps, the trust boundary, the SBOM check, the deny-list check and its secret)
- Previous contract: A published GitHub Release started the workflow; the staging job checked out the release commit and ran its stage-check script and ledger; the SBOM was uploaded to the already published release; the ledger was read from the checkout; the real list was an environment secret under the same name as the old repository secret; the SBOM check tested the presence of hashes and rows.
- Replacement contract: The tag and a draft release come first; a prepare run checks everything and attaches the tarball and the SBOM to the draft; the maintainer publishes it (immutable); the release run rebuilds, then stages the release asset. Every privileged job runs release-control code from the default branch only and reads the candidate as data (the ledger by commit and path, a regular file only). The staging job needs a required reviewer's approval in GitHub, refuses a packed `publishConfig`, `tag`, `private`, lifecycle script, or dependency field, and sets the registry and dist-tag itself with a clean npm configuration. The real list is the environment-only secret `BUILDOS_DENY_LIST_ENV`. The SBOM check compares values. The deny-list scanner reads every duplicate member and refuses a malformed tarball.
- Rationale: The independent review of `b3430d9` (P8 review round 2) found that the staging job ran candidate code with the OIDC permission, that npm could act on a packed `publishConfig`, that an immutable published release refuses a later asset, that a repository secret could stand in for the environment secret, that a ledger link passed the identity gate, and that duplicate archive members were not all read. This is a material change to the approved release flow (a draft, a prepare run, and a required reviewer before staging); the owner reviews it with the round 2 report. The owner confirmed this release flow on 2026-11-25 (option A).
- Source: [P8 Review Round 2](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-review-round-2)

### 2026-11-24 — W1 R7 P8 review round 1

- Affected requirement or section: `## Release` (the release steps, the first publication, the trust boundary, the SBOM check, the deny-list check in CI, the dry run)
- Previous contract: The workflow checked out the release tag by name in each job, and the staging job ran repository scripts. The real deny list was a repository secret given to every push. The SBOM was checked against the bundle and the documents only. A ledger entry had no kind. The first publish needed "a separate step that the owner approves".
- Replacement contract: The workflow resolves one commit from the event (event commit and tag commit equal, on the default branch) before any repository code runs, and every job checks out that commit. The jobs that hold the real list or the OIDC permission run no candidate-controlled code and read the tarball as data. The real list lives in the environment `buildos-deny-list` (default branch and release tags only); other refs use an invented list. The SBOM must be valid against the official CycloneDX 1.5 JSON schema. Ledger entries are `reviewed` or `self`; only `reviewed` entries are committed or released, and a reviewed entry records the digest of the tarball the maintainer inspected. The first publication follows the owner's option A (placeholder, then trusted publishing, then `0.1.0` through the workflow).
- Rationale: The independent review of `548f4ea` (P8 review round 1) found that the checked commit, the staged code, and the provenance source could differ, that branch code could read the real list, that the SBOM failed the CycloneDX schema, and that a self entry passed as a review. The owner chose the first-publication procedure on 2026-11-24 ("A, A").
- Source: [P8 Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-review-round-1)

### 2026-11-24 — W1 R7 P8 release workflow

- Affected requirement or section: `## Release` (the release steps, the SBOM, the build identity, the first publish)
- Previous contract: A GitHub Release started a workflow; npm trusted publishing was used; a reviewed tarball digest was committed; the workflow checked that the tag, the package version, and the digest agreed; `npm stage publish --provenance` staged the package; a CycloneDX SBOM was attached. The file, the tag form, the reference build environment, what the SBOM lists, the build identity, and the first publish were not stated.
- Replacement contract: The tag is `v<version>`. The reviewed digest is committed in `toolkits/buildos/release-candidates.json` with its source commit and reference build environment, and the release commit must have the same files apart from that file. The trusted publisher allows `npm stage publish` only, and the workflow stops before staging when the repository is not public, because npm makes provenance only for a public repository. The SBOM comes from `npm sbom` and marks bundled packages `required` and build-time-only packages `excluded`, with pdf.js and the ported Go code listed. A release build reports the package version and the source commit; a development build reports `dev` and `unknown`. Every check also runs as a script and in a dry run that never stages. The first publish needs a separate owner-approved step, because npm configures a trusted publisher only for a package that exists.
- Rationale: W1 R7 P8 Stage 1 built the release flow. npm's documentation for npm 11.20.0 and docs.npmjs.com (trusted publishers, staged publishing), read on 2026-11-24, confirmed `npm stage publish` with `--provenance` and OIDC, and showed the public-repository and existing-package limits. `npm sbom --omit dev` lists nothing for a package with no runtime dependencies.
- Source: [P8 Release 0.1.0 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-release-010)

### 2026-11-24 — W1 R7 P8 Go removal

- Affected requirement or section: `## Compatibility` (the earlier Go code)
- Previous contract: The earlier Go code for a domain stayed in the repository until that domain passed its parity gate.
- Replacement contract: All four domains passed their parity gates and the Go code is removed. The committed goldens are the frozen parity baseline, and `toolkits/buildos/test/golden/CAPTURE.md` names the Go source commit and how to recover the Go tools from git history.
- Rationale: W1 R7 P8 Stage 3 (t11 to t13) confirmed the four parity gates from the evidence report and deleted the Go sources.
- Source: [P8 Release 0.1.0 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-release-010)

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Runtime and Package`, network use
- Previous contract: Network or service calls were disallowed unless a design approved them and the CLI used opt-in flags. No exceptions were named.
- Replacement contract: The CLI makes no network calls, except the `npx` package fetch and the Make Docs setup that the user chooses. A new network call needs an accepted design and an opt-in flag.
- Rationale: The rule had no current owner, and the two existing exceptions were not stated.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

### 2026-11-23 — W1 R7 P1

- Affected requirement or section: `## Runtime and Package`, test runner
- Previous contract: Tests run with Vitest.
- Replacement contract: Tests run with Node's built-in test runner (`node:test`).
- Rationale: Vitest's dependency tree includes MPL-2.0 packages, which are outside the Supply Chain license list. Node built-ins come first.
- Source: [W1 R7 P1 TypeScript Package Foundation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md)

### 2026-11-23 — W1 R7 P1

- Affected requirement or section: `## Supply Chain`, rule 5 (install scripts)
- Previous contract: No package may declare an install script. No exceptions.
- Replacement contract: A closed exception allows exactly one package, `esbuild` at version `0.28.2` (the exact lockfile version), to declare its `postinstall` script and no other install script. The script never runs, because every install uses `--ignore-scripts` and `.npmrc` sets `ignore-scripts=true`. No other package may declare an install script. Any change to the exception needs a new owner decision recorded in this PRD.
- Rationale: This PRD names esbuild for the bundle, and esbuild declares a `postinstall` script. esbuild works without it through its platform packages, and it is never shipped. The owner approved the exception on 2026-11-23 on the condition that it does not become a precedent, so it is closed and CI enforces it.
- Source: [W1 R7 P1 TypeScript Package Foundation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md)

### 2026-11-23 — W1 R7 P1

- Affected requirement or section: `## Runtime and Package`, argument parsing
- Previous contract: Arguments are parsed with `node:util` `parseArgs`. No CLI framework is used.
- Replacement contract: Arguments are parsed by a small built-in parser that follows Go's `flag` package rules, so existing commands and flag spellings keep working. No CLI framework or outside parsing package is used.
- Rationale: `parseArgs` cannot accept Go `flag`-style spellings such as `-json`. It splits them into short flags. Go output parity requires those spellings. The owner decided the change on 2026-11-23.
- Source: [W1 R7 P1 TypeScript Package Foundation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md)

### 2026-11-23 — W1 R7 P4

- Affected requirement or section: `## Output and Exit Contract`, root handling (writes outside the project root)
- Previous contract: Writes must land inside the project root, with no opt-out.
- Replacement contract: A write that would land outside the project root is refused (exit 3) unless the command is given `--allow-outside-root`; a link at the written file itself is replaced, never followed. The switch is for write destinations only: it never widens a read of project data or of a file another file names.

A relative path that the user names on the command line (a source, an evidence file, a confirmation test, or a non-default output or folder) is used as written, relative to the project root. In an initialized project that has no `system` entry at its root, a leading `system/` is the earlier spelling of the source package and is dropped, as the earlier Go tools did; where the project owns a `system/` folder, a `system/...` path names that folder. The default paths, such as `--assets-root system/assets`, always name the initialized-project paths (`assets/`).
- Rationale: The owner decided on 2026-11-23 to keep the Go tools' capability to write outside the project root, but only behind an explicit flag. The rule covers the intake, discovery, and design commands, with one flag, one message, and exit 3.
- Source: [W1 R7 P4 Intake Port](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/04-intake-port.md); [W1 R7 P5 Discovery and Design Port](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md)

### 2026-11-24 — W1 R7 P6

- Affected requirement or section: `## Project Initialization and Adoption`, existing files; `## Make Docs Companion Setup`, order of setup
- Previous contract: When any path that `buildos init` must write already exists, including the root `AGENTS.md`, `CLAUDE.md`, and `.gitignore`, it writes nothing and exits with code `10`. Make Docs setup runs after BuildOS setup.
- Replacement contract: The root `AGENTS.md`, `CLAUDE.md`, and `.gitignore` are a closed list of shared files. `buildos init` adds or updates its own marked section in them (`<!-- buildos:begin -->` and `<!-- buildos:end -->`, or `# buildos:begin` and `# buildos:end` in `.gitignore`), creates a missing one with only the section, and never changes a line outside the section. Malformed markers, a link other than one to another shared file, or a file over 4 MiB stop the command before any write (exit `10`). Every other existing path still clashes. Make Docs setup runs before BuildOS writes any file, and every BuildOS check happens before the first write of any kind.
- Rationale: Almost every existing project already has these three files, so `buildos init` stopped on a clash in the usual case. Make Docs 2.0.9 also refuses setup when a root `AGENTS.md` or `CLAUDE.md` exists that it did not write, so a Yes answer always ended as partial after BuildOS wrote them. The owner chose option A on 2026-11-24.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6

- Affected requirement or section: `## Legacy Command Names`, entry files
- Previous contract: All four `bin` names point to the same entry file.
- Replacement contract: `buildos` points to the bundle. Each legacy name points to its own small entry file, which passes the legacy name to the same bundle explicitly. BuildOS never takes the command name from the path it was started under.
- Rationale: On Windows, npm's `.cmd` and `.ps1` shims start Node with the entry file path, so with one shared entry file the program could not tell which legacy name was used, and the legacy names failed there. The owner chose option A on 2026-11-24. Legacy names still go away in `0.3.0`.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6

- Affected requirement or section: `## Project Initialization and Adoption`, rerun, marker lines, encodings, names, checks, and undo
- Previous contract: An existing `.os/` folder always meant adoption, so a rerun in a set-up project stopped with exit `10`. A marker line was any line that was the marker after trimming. Nothing was said about encodings, letter case, folder permissions, a change between the check and the write, links replaced in an adoption, or what the undo does when it cannot put a path back.
- Replacement contract: A valid `.os/manifest.json` makes a rerun: it only refreshes a BuildOS section that is already there, keeps every other file, reports them as already present, and exits `0`. A damaged manifest stops with exit `10`. Lines in a Markdown code block or indented by four or more columns are never markers, and one whitespace rule holds at every line length. UTF-16, UTF-32, and zero bytes stop with exit `10`; a UTF-8 BOM stays. An existing entry spelled differently on a case-insensitive volume keeps its spelling. Folder permissions are checked before Make Docs runs (exit `5`). A changed destination stops and undoes the run (exit `10`). The undo restores files and links with their full mode, acts only on entries the run made, and lists every path it cannot put back (exit `10`).
- Rationale: The W1 R7 P6 review round 1 found that a rerun was not idempotent (owner decision 1), that sample text in a code block was taken as the section and deleted, and that a failed run could leave changed files behind without saying so.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6

- Affected requirement or section: `## Make Docs Companion Setup`, setting up Make Docs later, and results after Make Docs ran
- Previous contract: The no-TTY stop said that the user can set up Make Docs later. A failure or stop after Make Docs ran did not have to report what Make Docs did.
- Replacement contract: Every output says plainly whether Make Docs can be set up later with the tested Make Docs version, and gives a later command only when it can work. A failed Make Docs setup still shows the retry command, with a plain note when that command cannot work in this folder with this version. After Make Docs ran, every result says what Make Docs did, never says that nothing was changed, and stops when the folder looks like a different setup. The shown commands are quoted for the shell of the system.
- Rationale: With Make Docs 2.0.9, a later setup fails in any folder with an `AGENTS.md` or `CLAUDE.md` that Make Docs did not write, which BuildOS creates. The orchestrator chose option A (truthful text, no move-aside step) on 2026-11-24, pending an owner veto.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6 review round 2

- Affected requirement or section: `## Project Initialization and Adoption`, shared-file markers
- Previous contract: A marker line was the marker after leading and trailing spaces and tabs were removed. In Markdown, a line inside a CommonMark fenced code block or indented by four or more columns was never a marker. Only a Markdown file with no section that ended inside an open code block stopped.
- Replacement contract: A section is BuildOS's only when both marker lines are whole lines at column 0 with only trailing spaces and tabs, in order, exactly one pair, and outside every code or raw region. In Markdown the regions are fenced code at any indentation (also in list items and block quotes), `<pre>`, `<script>`, `<style>`, and `<textarea>` blocks, and HTML comments that start a line; a fence inside a comment is not a fence. `.gitignore` has no regions. Marker text anywhere else is the user's text. An unclosed region, a column-0 marker inside a region with no clean pair outside, or marker lines that are not one pair stop the command with exit `10`, the file, and the line.
- Rationale: The W1 R7 P6 review round 2 found that a sample in a list-item fence or a `<pre>` block was taken as the section and deleted, and that a fence character inside an HTML comment hid the real section, so a second section was added. The orchestrator chose one conservative rule over a growing Markdown parser on 2026-11-24.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6 review round 2

- Affected requirement or section: `## Project Initialization and Adoption`, the manifest contract
- Previous contract: `.os/manifest.json` held the package version, the schema version, and the time of initialization. `buildos init` and the wrappers each checked it their own way.
- Replacement contract: One manifest contract, applied by `buildos init` and the wrappers alike and tested against one shared table: UTF-8 of at most 64 KiB with one optional byte order mark, one JSON object, `schema_version` `1`, `buildos_version` an exact semver 2.0.0 version without build metadata or `dev`, and `initialized_at` an ISO 8601 UTC time. A rerun reports the manifest on disk.
- Rationale: The review found that `latest` and a time of `"1"` passed a rerun, that a manifest with a byte order mark passed `buildos init` but failed the wrapper, and that the wrapper accepted `1.2.3-..` and refused `1.2.3-alpha-beta.1`.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6 review round 2

- Affected requirement or section: `## Project Initialization and Adoption`, checks and undo; `## Output and Exit Contract`, `write_status`
- Previous contract: A replaced file was read at write time and checked by its bytes. The undo acted on an entry with the identity the run recorded. Folder permissions were checked on POSIX through the entry path. A run whose undo was incomplete reported `write_status` `applied`.
- Replacement contract: Every file or link to be replaced is read once, with a bound, before Make Docs runs, and the write checks its bytes or link text, permission bits, and identity just before the rename. The undo acts only on an entry that still has the identity, bytes, and permission bits this run wrote, and it also undoes a write that took effect before a later part of it failed. Temporary files that could not be removed are listed. The folder check looks at the folder the write acts in; on Windows it checks only existence and type. An incomplete undo reports `write_status` `partially_applied`, a new value. Extended ACLs and extended attributes are not kept on a replaced file.
- Rationale: The review found a changed file left behind after a failed folder flush while the output said it was undone, a user's in-place save overwritten by the undo, a temporary file left in the project without a report, a wrapper changed after the plan and overwritten, a `chmod` undone, and an adoption refused because the check followed a wrapper link.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6 review round 2

- Affected requirement or section: `## Make Docs Companion Setup`, the "later" text, the user-files tip, the shown commands, and the Make Docs result
- Previous contract: Whether Make Docs could be set up later was decided from the kind of setup and whether a root router existed. The user-files tip always said that BuildOS added its section. The shown commands did not name their shell.
- Replacement contract: The text follows the Make Docs sections on disk (`<!-- make-docs:begin -->` and `<!-- make-docs:end -->`) and what BuildOS actually wrote, and names each file that got the BuildOS section. The output names the shell of the shown commands (`sh`, or Command Prompt with default settings). The Make Docs result is kept the moment the process returns, and every later result reports it.
- Rationale: The review found that a folder Make Docs set up first was told that Make Docs could never be set up there, that a Go-era adoption was told BuildOS added a section to a file it never changed, and that a failure while BuildOS read the folder again lost the Make Docs result.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6 review round 3

- Affected requirement or section: `## Project Initialization and Adoption`, shared-file ownership
- Previous contract: A section was BuildOS's when its marker lines were a clean column-0 pair outside every code or raw region. A region that was never closed, or a column-0 marker inside a region with no clean pair outside, stopped the command.
- Replacement contract: Each section carries an integrity line with the SHA-256 of its text. BuildOS replaces a section only when the hash matches, wherever it sits. A marker pair without a valid integrity line is never replaced or deleted: inside a region it is the user's example and the section is added; outside every region the command stops with exit `10` and a plain fix. A file that ends inside an unclosed region gets the section at its start. The region scan finds raw HTML and comment openers anywhere in a line, and a region ends only at its own closer; it is a second line of defense.
- Rationale: The W1 R7 P6 review round 3 found that a team instruction between marker lines inside a `<pre>` opened after other tags, a `<script>` that held `</pre>`, or a comment opened mid-line was deleted with exit `0`. The orchestrator directed a proof of ownership that does not depend on the scanner. No released version wrote a section without the integrity line, so no migration is needed.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6 review round 3

- Affected requirement or section: `## Project Initialization and Adoption`, reruns, hard links, permission bits, and the undo report; `## Make Docs Companion Setup`, the second read of the folder
- Previous contract: A rerun skipped a file with no marker line before it scanned the file, and reported only the files it refreshed. Nothing was said about hard links. An adoption wrote each replaced wrapper with the package mode. The second read after Make Docs kept only the snapshots of replaced files. The undo report did not tell a leftover from content it put back.
- Replacement contract: A rerun decides each shared file from its whole content and reports every file it does not change, with the reason. A file that BuildOS would replace and that has more than one hard link stops before Make Docs runs (exit `10`). An adoption keeps a replaced file's permission bits and adds the owner-execute bit. Every path BuildOS will write must look the same after Make Docs ran as before, else BuildOS writes nothing (exit `10`). An unreadable router stops only an operation that needs its text. The undo report marks each path `left` or `unsure`, skips a created file that is already gone, and lists a folder it could not read back.
- Rationale: The review found a rerun that rewrote `.gitignore` while it hid a problem in `AGENTS.md`, a hard link broken silently by a successful run, a `0700` wrapper made `0755`, a wrapper that appeared or went away during Make Docs overwritten or made again, and an adoption stopped by an unreadable `AGENTS.md` it does not touch.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P6 review round 4 (closing check)

- Affected requirement or section: `## Project Initialization and Adoption`, the rerun summary, line breaks in shared files, examples inside HTML comments, and the hard link stop
- Previous contract: A rerun summary said the sections were up to date also when a shared file could not be read. Line breaks were not defined: a bare CR could end a line or count as marker padding. A section whose text was current but whose line breaks differed from the file's first line was written again. A marker pair that started inside an HTML comment could end the comment early.
- Replacement contract: The rerun summary says "up to date" only for sections BuildOS checked and names each file it could not check, with why. A line ends at LF or CRLF; a bare CR is text, and a file whose buildos lines appear only when a bare CR is read as a line break stops with exit `10` and a plain fix. A current section is not written, so it keeps every byte and needs no hard link check. A begin line inside a region starts an example that runs through the next end line. The hard link stop covers a wrapper link that is itself hard-linked.
- Rationale: The W1 R7 P6 closing check found a needless rewrite (and a false hard link stop) of a current section, a stop on a commented example, a summary that claimed a check it did not make, and bytes dropped after a bare CR.
- Source: [W1 R7 P6 Command Names, Wrappers, and Initialization](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/06-command-names-wrappers-and-initialization.md)

### 2026-11-24 — W1 R7 P7

- Affected requirement or section: `## Output and Exit Contract` (root handling), `## Runtime and Package` (Make Docs content), `## Project Initialization and Adoption` (files earlier versions shipped)
- Previous contract: Only `buildos init` stated its default root. The package rule said that `system/docs/` and `system/.make-docs/` were not part of the package, while the source folder still held them. Adoption did not say what happens to a file that an earlier version shipped and this version does not.
- Replacement contract: `buildos validate` with no `--root` checks the current working directory and never walks up; a folder with no `.os/` exits `3`. The source `system/` folder has no `docs/` or `.make-docs/` folder, and the build leaves out any such folder. Adoption leaves the earlier Python validator, and any other file that is no longer shipped, in place; W2 update owns its removal.
- Rationale: W1 R7 P7 added `buildos validate`, removed `validate_config.py` from the package, and deleted the Make Docs copy from the source package. Adoption must never delete a file in a user's project.
- Source: [W1 R7 P7 Skills and Validation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md)

### 2026-11-24 — W1 R7 P7 skills review round 1

- Affected requirement or section: `## Release` (deny-list check), `## Packaged Skills` (paths and read-only reports)
- Previous contract: The deny-list check printed archive member names as is, left out archive members over its size limit without saying so, read Office files as raw markup only, and matched across line breaks only below a size limit. It did not look for home-folder paths. Skills required `docs/`, a raw-source staging folder, and routers that a new project may not have, and the report skill ran a file-writing generator by default.
- Replacement contract: Every printed path part is hidden when it matches; nothing is skipped silently, and an unread shipped file or member fails; Office visible text is checked; cross-line matching works at any size; a home-folder path fails the check. Skills name only paths a new project has, or say what to do when one is missing, and a report is read-only unless the user asks for files.
- Rationale: Independent review of the skills import (P7S-R1-01 to P7S-R1-08 and P7S-R1-12).
- Source: [P7 Skills Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-review-round-1)

### 2026-11-24 — W1 R7 P7 skills review round 2

- Affected requirement or section: `## Release` (deny-list check)
- Previous contract: The visible text of an Office file was read from the raw markup, so formatting white space between elements split a name, and an XML part in UTF-16 was read as raw bytes only. ZIP comments and extra fields and PDF strings were not read. The home-folder check missed UNC profiles and names that start with a non-ASCII letter, and it failed on the simulated path the bundled PDF reader defines. The test suite checked the repository but not the built package.
- Replacement contract: The check reads each XML part in its declared encoding, joins the actual text nodes, reads the metadata channels it can reach without a new dependency, matches POSIX, drive, and UNC profile paths with a whole profile name in any script, allows one exact dependency path in the bundle file only, and runs over the built package file list in the test suite as in CI.
- Rationale: Independent review of the skills import fixes (P7S-R2-01, P7S-R2-02, P7S-R2-04) and the failed deny-list run 45474800265.
- Source: [P7 Skills Review Round 2](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-review-round-2)

### 2026-11-24 — W1 R7 P7 review round 4 (closing check)

- Affected requirement or section: `## Output and Exit Contract` (JSONL row limits, HTML image addresses), `## Compatibility` (parity exceptions PE-018 and PE-019)
- Previous contract: A JSONL row could be written longer than its reader's line limit, so the next command failed. An HTML image address with a percent escape named no file. Parity exceptions PE-018 and PE-019 waited for the owner.
- Replacement contract: Every row a command writes fits its reader's line limit, or the command stops with exit `4` and writes nothing. An image address is percent-decoded once before the containment check, with the address as written as the fallback, and the warning says what the converted file holds. The owner approved PE-018 and PE-019 on 2026-11-24, with these two additions in their scope.
- Rationale: Closing check of W1 R7 P7 Stages 4 to 6 (P7-R4-02, P7-R4-03) and the owner decision of 2026-11-24.
- Source: [P7 Review Round 4](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-4-closing-check)

### 2026-11-24 — W1 R7 P7 final check

- Affected requirement or section: `## Output and Exit Contract` (adding a JSONL row), `## Release` (deny-list check), `## Compatibility` (parity exception PE-019)
- Previous contract: A row added to `runs.jsonl` or `findings.jsonl` went straight after the last byte, so when the file did not end in a line feed the new row joined the last row on one line, and the next command could not read it. The deny-list check found the package files by a path built from the printed label, so on Windows, with the package staged on another drive, it read none of them and still passed; it did not decode character references or percent-encoding.
- Replacement contract: A line feed goes before an added row when the file does not end in one, and the read-back checks run on the exact bytes to be written; this is in PE-019's scope. The deny-list check reads every package file from its own disk path, fails when one cannot be read or the list is empty, reports `<n> of <m> package files read`, and also checks each text with character references decoded and percent-decoded.
- Rationale: Final check of W1 R7 P7 (P7-F-01, P7-F-02, P7-F-04) and the Windows failure of CI run 45483759496.
- Source: [P7 Final Check](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-final-check)

### 2026-11-24 — W1 R7 P7 skills import and deny list

- Affected requirement or section: `## Packaged Skills`, `## Release` (deny-list check)
- Previous contract: `system/.os/skills/` was named as the one source of skills, but it did not exist; the skills lived in a top-level `skills/` folder and in an adopter project. The router and the adoption and rerun rules for `.os/skills/` were not stated. The deny-list check was named only as a release check.
- Replacement contract: `system/.os/skills/` holds the skills and their router; the top-level `skills/` folder is gone. A new project and an adoption get every packaged skill file, an adoption keeps other files there, and a rerun writes nothing there. The router names how to install one skill per app and what to do at `buildos init` exit `10`. Three skills still need Python until `0.2.0`. Fit-gap owner names and colors come from config. The deny-list check also runs in CI on every push, fails closed, and reads the list from the repository secret `BUILDOS_DENY_LIST`.
- Rationale: W1 R7 P7 Stages 1 to 3 imported the owner-supplied adopter skills, removed their client content, and added the router and the deny-list check.
- Source: [W1 R7 P7 Skills and Validation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md)

### 2026-11-24 — W1 R7 P7 Stage 6

- Affected requirement or section: `## Command Surface` (the written design)
- Previous contract: `buildos design promote` wrote the earlier Go text in every project.
- Replacement contract: In a project whose design template is in the Make Docs 2.0.9 layout, the design follows that template and the project's design contract; the earlier layout keeps the earlier text. PRD 11 owns the form.
- Rationale: Owner decision of 2026-11-24 (register `R-009`, option B); parity exception PE-020.
- Source: [P7 Stage 6](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-stage-6)

### 2026-11-24 — W1 R7 P7 review round 3

- Affected requirement or section: `## Output and Exit Contract` (paths the user names, the switch, read-back sizes, contained reads, HTML images), `## Command Surface` (an empty design input), `## Project Initialization and Adoption` (the checkout stop and the adoption marks)
- Previous contract: A `system/...` path the user named was always turned into the path without `system/` in an initialized project. `--allow-outside-root` also widened design input reads, and discovery and design read the entity data through any link. A file could be written larger than its read bound. An HTML image was read from any path. `buildos init` adopted any `.os/` folder, also in the BuildOS checkout.
- Replacement contract: A path the user names is used as written, except the earlier `system/` spelling where the project has no `system` entry. The switch is for write destinations only. Project data is read inside the project. A write over the read bound stops with exit `4` before any write. An HTML image comes only from the document's folder or the project. `buildos init` stops with exit `10` in the checkout and adopts only a folder with Go-era marks.
- Rationale: Independent review of W1 R7 P7 (P7-R3-01 to P7-R3-07). Parity exceptions PE-018 and PE-019 were proposed here; the owner approved both on 2026-11-24 (see the review round 4 entry).
- Source: [P7 Review Round 3](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-3)

### 2026-11-24 — W1 R7 P7 review round 2

- Affected requirement or section: `## Command Surface` (the design promotion stop), `## Output and Exit Contract` (the installed-project rule, read bounds, and design input reads), `## Project Initialization and Adoption` (the legacy validator note)
- Previous contract: The promotion stop always gave the `make-docs` setup command for the project root. No requirement bounded file reads, and design inputs were read through any link. The commands read a project with no `docs/` as a checkout. The legacy validator note named any entry at `.os/scripts/validate_config.py`.
- Replacement contract: The stop tells three cases apart with the `buildos init` rules and shows a command only where it works. Every read has a stated size bound; design inputs are read inside the project, and a link out of it stops with exit `3` unless `--allow-outside-root` is given. One installed-project rule (PRD 05) serves every domain. The note names only a regular file there.
- Rationale: Independent review of W1 R7 P7 (P7-R2-01 to P7-R2-03 and P7-R2-07): a project made by `buildos init --skip-make-docs` failed in four domains, the printed command failed there too, and a link could lead a design read out of the project.
- Source: [P7 Review Round 2](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-2)

### 2026-11-24 — W1 R7 P7 review round 1

- Affected requirement or section: `## Command Surface` (design promotion inputs), `## Project Initialization and Adoption` (the legacy validator note)
- Previous contract: Design promotion read its Make Docs inputs only from `docs/assets/`, which Make Docs 2.0.9 no longer writes, so promotion failed in a project set up with `buildos init --make-docs`. An adoption that found the legacy Python validator said nothing about it.
- Replacement contract: Design promotion reads the Make Docs inputs in the order that PRD 11 states and stops with exit `3` and the Make Docs setup command when one is missing; it never starts `make-docs`. An adoption that finds `.os/scripts/validate_config.py` adds one plain note to the human and JSON result and changes nothing about the file.
- Rationale: Independent review of W1 R7 P7 (P7-R1-05 and P7-R1-09). A normal installed project must be able to promote, and a user must learn that the old script is no longer used.
- Source: [P7 Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-1)

## Source Anchors

- `docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md`
- `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md`
- `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-prd-authority-maintenance.md`
- `docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md`
- `docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md`
- `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` (superseded legacy evidence)
- `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` (superseded legacy evidence for the shared command contract)
- `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` (superseded legacy evidence for the core and adapter rules; never approved)
- `toolkits/buildos/`
- `.github/workflows/buildos-release.yml`
- `system/.os/scripts/`
- `system/.os/skills/`
