# BuildOS CLI

BuildOS is a folder of plain-text rules, templates, and records that an agent uses to run discovery, testing, requirements capture, design, and backlog work on a product or system. This package is the `buildos` command: it sets up that folder in a project, converts source documents into clean text with provenance, records discovery runs and findings, promotes a finding to a design, and checks the project's configuration and records. Everything runs on your own machine, and the command makes no network call.

## Requirements

- Node.js 24 or newer, on macOS, Linux, or Windows (x64 or arm64). Nothing else: no build step and no Python.
- Network access to the npm registry the first time a version runs. To install without registry access, see "Install without registry access" below.

## Set up a project

In the project folder, run:

```sh
npx -y @brucewaynedecoy/buildos@0.1.0 init
```

`buildos init` asks one question: set up the optional Make Docs companion too? When there is no terminal to answer in (as with most agents), it stops with exit code `10`, changes nothing, and prints the question and the two exact commands, one for each answer. Run the one the user chose. `buildos init` adds its files next to the files that are there. In a new setup it does not replace a file: a clash stops it with exit code `10` and nothing written. It adds only its own marked section to `AGENTS.md`, `CLAUDE.md`, and `.gitignore`. `buildos init --dry-run` shows the plan and writes nothing. A project set up with the earlier Go tools is adopted: its data files stay byte for byte, and its Go-era wrapper and skill files are replaced. When a step fails, `buildos init` undoes its own writes and lists any path it could not put back (exit `10`); see [SECURITY.md](SECURITY.md), "Write Safety", for the limits.

After setup, run commands through the project wrapper, from the project folder. It always runs the version that `.os/manifest.json` pins (pin first). It uses an installed `buildos` only when it is an npm install of exactly that version, in the project's `node_modules` folder or as the first `buildos` on `PATH`; it reads only the package files and starts no program to check the version. Else it runs the pinned version through `npx`:

```sh
.os/scripts/buildos validate
```

On Windows, use `.os\scripts\buildos.cmd validate` in Command Prompt.

## Install globally

```sh
npm install -g @brucewaynedecoy/buildos@0.1.0
buildos version
```

The pin always decides. A global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version. Acceptance goes by layout, not by tool: a package folder `node_modules/@brucewaynedecoy/buildos` with a matching `package.json` counts whatever tool made it (for example a local pnpm or Yarn link to such a folder). A shim script that only starts the package (as pnpm, Yarn, and Volta make for a global install) does not count, and the wrapper fetches the pinned version through `npx` instead. Any other `buildos` on `PATH` is not used. Every start sets `BUILDOS_REQUIRE_VERSION` to the pin, and BuildOS stops itself (exit code 3) when another version starts. To roll back, change only `buildos_version` in `.os/manifest.json`; you do not need to change or remove a global install.

## Install without registry access

On a machine with registry access, download the tarball and note its SHA-256:

```sh
npm pack @brucewaynedecoy/buildos@0.1.0
shasum -a 256 brucewaynedecoy-buildos-0.1.0.tgz
```

Compare the value with the published digest (see [SECURITY.md](SECURITY.md), "How to Check a Release"). Copy the file to the other machine and install it from the file:

```sh
npm install -g --offline ./brucewaynedecoy-buildos-0.1.0.tgz
```

The package has no dependencies, so nothing else is fetched.

## Commands

| Command | What it does |
| --- | --- |
| `buildos init` | Set up BuildOS in a new or existing project folder |
| `buildos validate` | Check the project config, scoped frontmatter, and entity records; changes no file |
| `buildos intake convert --source <path>` | Convert a CSV, DOCX, XLSX, PDF, HTML file, or folder of HTML into clean text with provenance |
| `buildos intake index references` and `index playbooks` | Rebuild the references and playbooks indexes |
| `buildos discovery run discovery` and `qualify finding` | Record a discovery run and qualify a finding |
| `buildos design promote finding` | Promote a qualified finding into a design file |
| `buildos entities validate`, `resolve`, `consolidate`, `rebuild-index` | Work with entity records; `consolidate` and `rebuild-index` write only with `--apply` |
| `buildos version` | Print the package version and source revision |
| `buildos help [<domain>]` | Print help |

Add `--json` to `version`, `validate`, `init`, or an `entities`, `discovery`, or `design` command for the stable automation envelope. Help prints text, and `intake` has no `--json` form yet. Most writing commands take `--dry-run`. Exit code `0` means success.

## Legacy command names

The names of the earlier Go tools, `buildos-intake`, `buildos-discovery`, and `buildos-design`, are also commands of this package. They still work and give the same output. Each prints one line that names the new command. **They stop working in BuildOS `0.3.0`.** Use `buildos intake`, `buildos discovery`, and `buildos design`. The project scripts with the same names in `.os/scripts/` print the same notice line once, first on stderr, then run `.os/scripts/buildos` with their domain. They go away in `0.3.0` too.

## Security

[SECURITY.md](SECURITY.md) lists every outside package in this package with its version, license, and reason, and explains the bundling, the npm provenance, the SBOM, the release checks, rollback by version pin, and how to report a vulnerability. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) holds the license notices. The package has no runtime dependencies: all code is in one bundle.

## Learn more

The user guide and the source are in the BuildOS repository, `https://github.com/brucewaynedecoy/build-os`.

## License

Apache-2.0. See [LICENSE](LICENSE).
