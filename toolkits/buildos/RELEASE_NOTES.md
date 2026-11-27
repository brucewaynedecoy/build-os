# BuildOS Release Notes

## 0.2.0

Status: draft. This version is not published yet. The maintainer removes this line when the release is approved and published.

`0.2.0` moves the tools that four skills ran as scripts into BuildOS commands, so no skill needs Python, and it makes every command that BuildOS prints for you to run work as printed, with no global install.

### What is new

- Four new commands for skills: `buildos extract bulk` (the `buildos-bulk-extract` skill), `buildos fitgap` (the `fit-gap-analysis` skill; it writes the Excel workbook itself), `buildos export azure-boards` (the `buildos-export-azure-boards` skill), and `buildos capability-matrix` with `skeleton`, `assemble`, `fitgap`, and `validate` (the `capability-matrix` skill; it replaces the Python tool `cm_build.py` that the skill told the agent to write). On every test fixture each command gives the result of the script it replaces, except where a script result was wrong or lost data (see "Changed for 0.1.0 users" below).
- No skill needs Python or `openpyxl`. The skills run these commands through the project wrapper `.os/scripts/buildos` (`.os\scripts\buildos.cmd` on Windows) and ship no script of their own. BuildOS needs only Node.js 24 or newer.
- The four commands read only files inside the project folder (`--root`, default the current folder). `fitgap`, `export azure-boards`, and `capability-matrix` write outside it only with `--allow-outside-root`; `extract bulk` writes only its own project paths.
- `buildos capability-matrix` writes nothing when it stops on a check or an input error. When a write fails, it puts back every file that it changed (exit `5`); only when it cannot put a file back does it exit `10` and name each file that is left. The Python tool could leave a half-written model or fit/gap file. It writes the same bytes on every system (the Python tool wrote `\r\n` line ends in its JSON files on Windows).
- `buildos intake` takes `--json` and prints the same envelope as the other domains, so every domain command has a JSON form.
- Printed fix commands run as printed: see the next section.
- The guide has the upgrade steps from `0.1.0`, with a backup first and a rollback: see "Upgrade a project from 0.1.0" below.

### Fix commands run as printed

- A command that BuildOS prints for you to run now starts with `npx -y build-os@<version>`, where `<version>` is the version that printed it, so it runs as printed with no global install, in `sh` on Linux and macOS and in Command Prompt on Windows (limits below). This covers the `entities rebuild-index` recovery command (the `action:` line, and `remediation_command`, `recovery_command`, and `correction` in JSON), `Run npx -y build-os@<version> help for command syntax.` after a usage error, and the help commands that `extract` and `export` name. In `0.1.0` these commands start with a bare `buildos`, which exits 127 without a global install (follow-up F-P8-11).
- On Windows, a printed command is for Command Prompt with delayed expansion off (its default), and the `action:` line says so: `run this in Command Prompt: <command>`, or `run this in Command Prompt, with delayed expansion off: <command>` when the command holds a `!`. Do not paste it into PowerShell, which reads `$` and backticks in its own way: type `cmd /v:off` first (Command Prompt with delayed expansion off), paste the command, then type `exit`. The JSON fields hold the command alone: `sh` on Linux and macOS, Command Prompt on Windows.
- The folder in the printed `entities rebuild-index` command is always quoted for the shell: single quotes on Linux and macOS, so the shell expands nothing in it, and Command Prompt double quotes on Windows, with each `\` written once. `0.1.0` wrote each `\` twice there (follow-up F-P8-10).
- When `init`, `validate`, or `extract bulk` stops and asks you to try again, it now says to run the same command again. Your own command keeps your folder (`--root`) and your flags. When Make Docs already ran in that `init` run (its process started), every retry advice says to use `--skip-make-docs` and not `--make-docs`. When Make Docs could not start, the advice keeps your own command, with `--make-docs`. The note about the old Python validator names the project folder and the project wrapper: `After adoption completes, in the project folder <folder>, run .os/scripts/buildos validate`. When `design promote` runs with `--repo-root` from another folder and asks you to delete an empty Make Docs file, it names that file under the `--repo-root` folder.
- A build from source (version `dev`) still prints `buildos`, because no npm version names it. Help text keeps the program name `buildos` in its usage lines, and the legacy-name notice still says `Use "buildos intake" instead.`

### Changed for 0.1.0 users

The parity exceptions and divergences named here are recorded in the BuildOS repository (`toolkits/buildos/test/golden/parity-exceptions.json` and `toolkits/buildos/test/golden/skills/divergences.json`).

- `buildos intake ... --json` (and `buildos-intake ... --json`): `0.1.0` refused the flag, as the Go tool did (`flag provided but not defined: -json`, exit `1`). `0.2.0` prints the JSON envelope on stdout (PE-022).
- Printed fix commands: only the command text changed (above); JSON field names and shapes and every exit code are the same. On Windows the `action:` line of the rebuild command now starts with the shell label (PE-023). One JSON field is new: a failed `make_docs` result of `buildos init` has `started` (`false` when no Make Docs process started).
- Skill exit codes: the scripts exited `1` or `2` for every failure. The commands exit `2` for a usage error, `3` for an input they cannot read or parse or a path outside the project, `4` for a failed check (also `extract bulk check` on a review that is not ready, where the script exited `1`), `5` for a failed write, and `10` when a failed write could not be undone (SD-01). Passing and failing stay the same.
- Skill messages: usage and help name `buildos`, not the script (SD-02). Where a script crashed with a Python traceback (a missing file, a file that is not JSON, a value of the wrong type), the command prints one plain line and exits `3` (SD-03, SD-11, SD-23). One crash is a failed check instead: in `buildos fitgap merge`, two marks with no requirement ID crashed `fitgap.py`; the command lists `requirements marked twice: None` among the problems and exits `4` (SD-11).
- Skill files: reads and writes stay inside the project unless you pass `--allow-outside-root` for an output (SD-04, SD-05, SD-24), every read has a size limit (SD-06), and each file is written whole or not at all. When one write of a command fails, the command puts back the files that it changed; a file that it cannot put back is named, and the command exits `10`.
- Skill results that change, because the script result was wrong or lost data: SD-14 (`export azure-boards --profile` takes only a real profile name), SD-15 to SD-22 (bulk extract and fit-gap; accepted by the owner on 2026-11-26), and SD-27 (`capability-matrix` sorts a set of values in one fixed order, also in an error message, where the Python order could change from run to run). SD-26: a `capability-matrix` system code with a pattern character (such as `.`, `+`, or `(`) stops the id check with a plain message (exit `4`), where the Python tool read the code as part of a regular expression; real codes are letters and digits.
- The fit-gap workbook is written by BuildOS's own writer, so its file bytes differ from the `openpyxl` file; its sheets, cells, formats, and colors are the same (PE-021). Cell text that is exactly an Excel error token, such as `#N/A`, stays text (SD-19).
- `buildos export azure-boards` keeps a CSV field that starts with `=`, `+`, `-`, or `@` as it is, as the script did, so the file imports into Azure Boards unchanged. To inspect such a CSV, read it as plain text or with a CSV reader that treats every cell as text. Open it in a spreadsheet program only when you trust its manifest.

### Removed

These files that `buildos init` copied in `0.1.0` are gone in `0.2.0`; the commands above replace them:

- `.os/skills/buildos-bulk-extract/scripts/work.py` and `.os/skills/buildos-bulk-extract/tests/test_work.py`
- `.os/skills/fit-gap-analysis/scripts/fitgap.py`
- `.os/skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs` and `.os/skills/buildos-export-azure-boards/scripts/adapters/dynamics-365-ce.mjs`
- the appendix of `.os/skills/capability-matrix/SKILL.md` with the Python tool `cm_build.py`

### Upgrade a project from 0.1.0

`0.2.0` changes four skills (`buildos-bulk-extract`, `buildos-export-azure-boards`, `capability-matrix`, and `fit-gap-analysis`) and the skills router `.os/skills/AGENTS.md`. Every other file that `buildos init` copied is the same as in `0.1.0`. The new skills call commands that `0.1.0` does not have, so change the version and these skills together, in the project and in each copy that an agent app installed. `buildos init` does not do this, and BuildOS has no update command yet.

The steps, with a backup first and the rollback, are in the BuildOS guide: chapter 4, "Install and configure your instance", section "From 0.1.0 to 0.2.0", with its part "Roll back from 0.2.0 to 0.1.0" (`guide/content/04-install-and-configure-your-instance.md` in the BuildOS repository). They refresh only those four skills, by name. They do not touch a skill that you added, and they show how to find and keep a change that you made to one of the four. A copy of the old capability-matrix tool that an agent wrote into the project (for example `build/cm_build.py`) is not used by `0.2.0`, and you can delete it.

### Legacy command names end in 0.3.0

`buildos-intake`, `buildos-discovery`, and `buildos-design`, and the project scripts `.os/scripts/buildos-intake`, `buildos-discovery`, and `buildos-design` (with their `.cmd` forms), still work in `0.2.0`, with the same one-line notice. **They stop working in `0.3.0`.** Use `buildos intake`, `buildos discovery`, and `buildos design` (in a project: `.os/scripts/buildos intake` and the others).

### Known limits

- npm setting `bin-links=false`: an `npx` run that must download the package caches it without its link, and that run exits 127 (`sh: build-os: command not found`; tested in `sh` on macOS with npm 11.20.0). That cached copy then fails the same way, also with the setting off and through the project wrapper; a copy cached with its link still runs. Remove the bad copy with `npm cache npx ls` and `npm cache npx rm <key>`. After the bad copy is removed, the next fetch must have bin links on, or it caches a bad copy again. Two routes were tested in `sh` on macOS with npm 11.20.0 and a new npm cache, each with exit 0: put `npm_config_bin_links=true` in front of the command for that one run (`npm_config_bin_links=true npx -y build-os@<version> …`), or type the same arguments after the project wrapper (`.os/scripts/buildos`), which turns bin links on for its own `npx` run. After either one, the printed command runs as printed, also with `bin-links=false` set. The Command Prompt form of the first route and the Windows wrapper route are not tested.
- Windows: Command Prompt is the supported shell for the commands BuildOS prints; there is no PowerShell form. The route from PowerShell is `cmd /v:off` (above). It was tested from Windows PowerShell, not from PowerShell 7 (`pwsh`), and a folder name with `$`, a backtick, or `%` was not tested in PowerShell.
- Not tested yet: the Command Prompt forms of the upgrade and rollback steps in the guide (they were tested in `sh` on macOS), and the Command Prompt example in the Dynamics 365 CE adapter of the Azure Boards skill (a test reads it by the Command Prompt rules and runs its words; Command Prompt itself did not run it). A fit-gap workbook from `buildos fitgap` passes the Open XML SDK validation with zero errors; no person has opened one in Microsoft Excel or LibreOffice yet.
- No `buildos update` or `buildos uninstall` yet: the upgrade from `0.1.0` is by hand (above).
- `buildos extract bulk` uses a lock file. A command that crashes or is killed leaves it behind, and the next command stops, also for a single user. The message names the process, the host, and the time, and says how to check that the process is gone before you delete the file (SD-09).
- Windows: the project wrapper estimates the length of its `npx` fallback command line, and the estimate can be too high. A command with very long arguments, near the Command Prompt limit of 8,191 characters, can then be refused (exit `2`) although it would fit (follow-up F-P8-08).
- Each file that a command reads has a size limit, but no limit covers the sum of all the files that one pattern matches, for example `--parts "build/<code>/out_*.json"` over many large files (follow-up F-P9-11).
- `buildos fitgap` can differ from `fitgap.py` in three cases that no test fixture reaches: an integer above 2^53 (BuildOS rounds it for comparing, keys, and sorting), an empty pattern (BuildOS reads it as the project folder) (follow-up F-P9-12), and an option value that starts with a minus (follow-up F-P9-14).
- `buildos capability-matrix` with an output path (`--out`) through a link that leads nowhere, before its last name or with a final `/`, exits `5`. The Python tool stopped there with an input error, or (with a final `/` on macOS) wrote to the place the link names (follow-up F-P9-13).
- The `0.1.0` limits on Make Docs 2.0.9, file ACLs, Windows quoting, and pin-first global installs still apply.

### Check the package

See `SECURITY.md`, "How to Check a Release". In short:

```sh
npm install --ignore-scripts build-os@0.2.0
npm audit signatures
npm pack build-os@0.2.0
shasum -a 256 build-os-0.2.0.tgz
```

Run the first two in an empty folder made with `npm init -y`. `npm audit signatures` must report a verified registry signature and a verified attestation (provenance). The SHA-256 must equal the reviewed digest for the tag `v0.2.0` in `toolkits/buildos/release-candidates.json` and in the SBOM `buildos-0.2.0.cdx.json` on the GitHub Release.

### Roll back

Set `buildos_version` in `.os/manifest.json` to `0.1.0`, and put back the `0.1.0` skills: the guide's "Roll back from 0.2.0 to 0.1.0" lists the steps. See also `SECURITY.md`, "Rollback by Version Pin".

## 0.1.0

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
- Three skills still need Python 3 for their own tools in `0.1.0`: `buildos-bulk-extract`, `fit-gap-analysis` (its workbook step also needs `openpyxl`), and `capability-matrix`. No BuildOS command needs Python. `0.2.0` adds `buildos extract bulk`, `buildos fitgap`, `buildos export azure-boards`, and `buildos capability-matrix`, so that these three skills need only Node.js there.
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
