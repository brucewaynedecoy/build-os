# BuildOS Release Notes

## 0.1.0

Status: draft. This version is not published yet. The maintainer removes this line when the release is approved and published.

`0.1.0` is the first npm release of BuildOS. It replaces the earlier Go tools with one `buildos` command for Node.js 24 or newer, a one-command project setup, and the BuildOS skills in the package.

### What is new

- One prerequisite: Node.js 24 or newer, on macOS, Linux, or Windows (x64 and arm64). No Go tools, no Homebrew, no archive download, no build step, and no Python for any BuildOS command.
- One package, `build-os`, on npm. An agent runs it with `npx -y build-os@0.1.0 <command>`, with no install step. A global install (`npm install -g`) and an install from a downloaded tarball (no registry access) also work.
- One command, `buildos`, with the domains `entities`, `intake`, `discovery`, `design`, `init`, `validate`, `version`, and `help`. Every command and flag of the Go tools keeps working with the same output.
- `buildos init` sets up a new project, or adopts a project that the Go tools set up, in one command. It asks one question first: set up the optional Make Docs companion too? With no terminal to answer in, it stops with exit code `10`, changes nothing, and gives the agent the question and the two exact commands. In a new setup it does not replace your files: a clash stops it with exit code `10` and nothing written. It adds only its own marked section to `AGENTS.md`, `CLAUDE.md`, and `.gitignore`. An adoption replaces the Go-era wrapper and skill files at the paths it writes. When a step fails, it undoes its own writes; a path it cannot put back is listed, and the run exits `10` with `write_status` `partially_applied`. It does not undo the Make Docs writes, and a crash in the middle of a run is not undone. An `.os/` folder without the marks of a Go-era project (an empty one too) stops it with exit code `10`.
- `.os/manifest.json` pins the BuildOS version of each project. The project wrapper `.os/scripts/buildos` (`.os\scripts\buildos.cmd` on Windows) always runs that version (pin first). It uses an installed `buildos` only when it is an npm install of exactly that version: in the project's `node_modules` folder, or the first `buildos` on `PATH` (for example a global install). It reads only the package files, starts no program to check the version, and runs that package's bin file with the same `node`. Otherwise it fetches the pinned version through `npx`.
- `buildos validate` replaces the Python script `.os/scripts/validate_config.py`. It checks the config, the scoped frontmatter of playbooks and templates, and the entity records, and it changes no file.
- The BuildOS skills ship in the package. `buildos init` copies 21 skills to `.os/skills/`, with a router, `.os/skills/AGENTS.md`, that tells an agent what each skill does and how to install one into its own app.
- `buildos design promote finding` writes a design in the Make Docs 2.0.9 form in a project that Make Docs 2.0.9 set up.
- `--json` gives one stable JSON envelope on `version`, `validate`, `init`, and the `entities`, `discovery`, and `design` commands. Help prints text, also with `--json`, and the `intake` commands have no `--json` form yet (they refuse the flag, as the Go tool did).
- Security: no runtime dependencies (all code is in one bundle), npm provenance, a CycloneDX SBOM on each GitHub Release, a reviewed tarball digest, `npm audit` and OSV scans, and a client-name deny-list check before each release. See `SECURITY.md`.

### Move a project from the Go tools

1. Install Node.js 24 or newer.
2. In the project folder, run `npx -y build-os@0.1.0 init`. BuildOS sees the Go-era project (an `.os/` folder with no `.os/manifest.json`) and adopts it.
3. Adoption writes only `.os/manifest.json`, the wrapper scripts in `.os/scripts/`, and the skills in `.os/skills/`. It changes no data file, run, finding, index, or config: they stay byte for byte. It does not change `AGENTS.md`, `CLAUDE.md`, or `.gitignore`.
4. The old `.os/scripts/validate_config.py` stays where it is. `buildos init` says so in a note. No BuildOS command uses it, and you can delete it.
5. Use `.os/scripts/buildos validate` where you used the Python script, and `.os/scripts/buildos <domain>` for every other command.
6. Remove the Go tools from your machine. The project wrappers never run a Go-era `buildos` binary on `PATH`, because it is not an npm install of the pinned version; they run the pinned version through `npx` instead.

### Differences you might notice

BuildOS matches the Go tools byte for byte for the same input. These are the recorded differences (parity exceptions PE-001 to PE-020), by what you see:

- Help: `buildos help` lists the current domains, `buildos help <domain>` prints that domain's help, and `version --help` prints help with exit code `0` (PE-001 to PE-003).
- Clearer errors: a project folder that cannot be read gives exit code `3` with a typed reason (PE-004). A malformed PDF that crashed or hung the Go tool now fails with one clear line and exit code `1` (PE-015).
- Safer writes: an `intake` write outside `--repo-root`, or a `discovery` or `design` write that would land outside the project folder through a linked folder, stops with exit code `3` unless you pass `--allow-outside-root`; a link at the written file itself is replaced, never followed (PE-010, PE-012). An entity dataset that is a link to a file outside the project is refused with exit code `3`, and the `entities` commands have no switch to allow it (PE-007). A failed conversion or promotion leaves nothing behind and is fully undone, and a link at `runs.jsonl` or `findings.jsonl` is replaced, never written through (PE-013, PE-014). `entities consolidate` in a dry run writes nothing at all (PE-006).
- HTML images: `intake convert` copies a local image only from the HTML file's folder or the project. Any other image gets an "Uncopied image" marker and a warning, and the command still succeeds (PE-018).
- Better text: text directly inside an HTML box (`div`) is kept (PE-008). PDF text can have a space between words that the Go tool ran together (PE-009).
- Size limits: every file read has a size limit (128 MiB for data and indexes, 64 MiB for discovery and design documents, 4 MiB for Make Docs inputs, 512 MiB for intake files); a larger file is not read, and the command fails with exit code `1` or its own message (PE-017). A command that would write a file or a row that the next command could not read back stops before any write, with exit code `4` (PE-019).
- Records: when a run or finding row is added to a file that does not end with a line break, a line break goes first, so the new row no longer joins the last one (PE-019).
- A path you name is used as written in a project that has its own `system` folder (PE-019).
- `--json` works on `discovery` and `design` (PE-011).
- Windows: six apply and promote cases succeed where Go reported a failure after the write had landed (PE-005).
- Make Docs 2.0.9: design promotion reads the Make Docs 2.0.9 inputs inside the project, stops with exit code `3` and a plain message when one is missing or empty, and writes the 2.0.9 design form there (PE-017, PE-020). A project that `buildos init --skip-make-docs` made (no `docs/` folder) counts as a project in every domain (PE-017).
- Legacy names print one notice line first (PE-016), below.

### Legacy command names end in 0.3.0

The Go tool names `buildos-intake`, `buildos-discovery`, and `buildos-design` still work in every `0.1.x` and `0.2.x` release, with the same output. Each run prints one line to stderr first, for example:

```text
Note: the command name "buildos-intake" goes away in BuildOS 0.3.0. Use "buildos intake" instead.
```

**They stop working in `0.3.0`.** Change every script, skill, and note that uses them to `buildos intake`, `buildos discovery`, and `buildos design` (in a project: `.os/scripts/buildos intake` and the others).

### Known limits

- Make Docs 2.0.9 cannot set up a folder that already has an `AGENTS.md` or `CLAUDE.md` that it did not write. A new project where you answer No to Make Docs gets those files from BuildOS, so Make Docs 2.0.9 cannot be set up there later. `buildos init` says this before you answer, and every output says it where it matters. A newer Make Docs may lift this limit.
- Three skills still need Python 3 for their own tools until `0.2.0`: `buildos-bulk-extract`, `fit-gap-analysis` (its workbook step also needs `openpyxl`), and `capability-matrix`. No BuildOS command needs Python. `0.2.0` plans `buildos extract bulk`, `buildos fitgap`, and `buildos export azure-boards`.
- When `buildos init` replaces a file (`AGENTS.md`, `CLAUDE.md`, `.gitignore`, or a Go-era wrapper), the new file keeps its permission bits but not extended access control lists (ACLs) or extended attributes. Set an ACL again after `buildos init` if you rely on one.
- Windows: Command Prompt is the supported shell for the commands BuildOS shows; there is no PowerShell form. A `!` in a folder name breaks a shown command when delayed expansion is on (`cmd /v:on`). `buildos init` cannot check a folder's access rules before it writes on Windows; a denied write is found during the run and undone. A file system without hard links reports one link, so the hard link check cannot see a link there.
- A global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version. Acceptance goes by layout, not by tool: a package folder `node_modules/build-os` with a matching `package.json` counts whatever tool made it (for example a local pnpm or Yarn link to such a folder). A shim script that only starts the package (as pnpm, Yarn, and Volta make for a global install) does not count, and the wrapper fetches the pinned version through `npx` instead. Every start sets `BUILDOS_REQUIRE_VERSION` to the pin, and BuildOS stops itself with a plain message (exit code 3) when another version starts. The project scripts `.os/scripts/buildos-intake`, `buildos-discovery`, and `buildos-design` print the legacy-name notice once, first on stderr, and go away in `0.3.0`.
- Windows: an argument with an odd number of double quotes (`"`) changes how Command Prompt reads the rest of the `.cmd` wrapper's command line. A later argument with `&`, `|`, `<`, `>`, or `^` is then read as a command character. Put such an argument last, or run `npx -y build-os@<version>` directly.
- Start time: on the one machine measured (Apple M2 Pro, macOS), a short command such as `buildos version` takes about 68 ms: about 28 ms is Node.js itself and about 40 ms is loading the 3.3 MB bundle (the bundled PDF reader is 2.4 MB of it).
- Not in this release: `buildos update`, `buildos uninstall`, project sync, OCR for scanned PDFs, and an MCP server.

### Check the package

See `SECURITY.md`, "How to Check a Release". In short:

```sh
npm install --ignore-scripts build-os@0.1.0
npm audit signatures
npm pack build-os@0.1.0
shasum -a 256 build-os-0.1.0.tgz
```

Run the first two in an empty folder made with `npm init -y`. `npm audit signatures` must report a verified registry signature and a verified attestation (provenance). The SHA-256 must equal the reviewed digest for the tag `v0.1.0` in `toolkits/buildos/release-candidates.json` and in the SBOM `buildos-0.1.0.cdx.json` on the GitHub Release.

### Roll back

Set `buildos_version` in `.os/manifest.json` to the version you want, and the project wrapper runs it. That is the only step: you do not need to change or remove a global install, because the wrapper uses one only when it is an npm install of exactly the pinned version. The version must still be installable from npm. See `SECURITY.md`, "Rollback by Version Pin".
