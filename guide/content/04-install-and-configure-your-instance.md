# Install and configure your instance

Set up BuildOS in your project folder with one command, name your own systems and environments in one configuration file, and check that the system agrees with you.

## What you need first

Read [Before you start](03-before-you-start.md) first. This page assumes it. You need three things:

- **Node.js 24 or newer** on the machine where your agent runs. It is the only thing BuildOS needs. To check, run `node --version`. It must print `v24` or a higher number.
- **A project folder** on your machine's own hard drive, ideally a git repository. It can be empty, or it can already hold your own files.
- **An agent tool** that can read and write files and run commands in that folder.

Your agent can run every command on this page for you. You make two decisions: whether to set up Make Docs, and what to name your systems, environments, and owners.

This page uses a few words that belong to the terminal rather than to BuildOS: exit code, `PATH`, shell. [Before you start](03-before-you-start.md) defines them under "Terms from outside BuildOS". In any command, text in angle brackets such as `<path>` is a placeholder for your own value.

---

## Set up BuildOS in your project

### The one command

Open your project folder in your agent tool and ask the agent to run this command there:

```sh
npx -y build-os@0.1.0 init
```

`npx` comes with Node.js. It fetches the BuildOS package from the npm registry, keeps a copy in npm's own cache folder on your machine (so the next run of the same version is faster), and runs it. It installs no `buildos` command for the whole machine, and the only files it adds to your project are the ones `buildos init` writes. `0.1.0` is the BuildOS version; use the version your team agreed on.

### The one question: Make Docs

Before `buildos init` writes anything, it needs one answer: **set up Make Docs in this project?**

Make Docs is a separate, optional documentation tool. It adds the folders `docs/designs/`, `docs/plans/`, `docs/prd/` (requirements documents), and `docs/work/` (work backlogs), each with instructions for agents, and keeps its templates, contracts, prompts, and references in `.make-docs/system/`. The later chapters on [designs, plans and PRDs](12-designs-plans-and-prds.md) and [the work backlog](13-build-the-work-backlog.md) use it. BuildOS works without it.

An agent usually runs commands without a terminal you can type into. Then `buildos init` does not guess. It stops, changes nothing, and exits with code `10`. Its output tells the agent what to ask you and the exact command for each answer. Here is the real output in an empty folder on macOS or Linux (the folder path is shortened to `<project folder>`; when the real path holds a space or another special character, the commands show it in single quotes, ready to copy):

```text
Project folder: <project folder>
Stopped. Nothing was changed. BuildOS needs one answer from the user first.

Ask the user: "Set up Make Docs in this project?"

Make Docs is an optional companion tool. It adds docs/ folders for designs, plans, requirements, and work, each with instructions for agents, and keeps its templates, rules, and prompts in .make-docs/, so agents can keep project documents in order.
If the user says no, Make Docs cannot be set up in this folder later with this Make Docs version: it does not set up a folder that has an AGENTS.md or CLAUDE.md file that Make Docs did not write, and BuildOS adds such a file here.

If the user says yes, run:
  npx -y build-os@0.1.0 init --root <project folder> --make-docs
If the user says no, run:
  npx -y build-os@0.1.0 init --root <project folder> --skip-make-docs
```

On Windows, the two commands are written for Command Prompt, and the folder is in double quotes:

```text
If the user says yes, run this in Command Prompt:
  npx -y build-os@0.1.0 init --root "<project folder>" --make-docs
If the user says no, run this in Command Prompt:
  npx -y build-os@0.1.0 init --root "<project folder>" --skip-make-docs
```

Your agent should ask you the question in plain words and then run the one command for your answer. If you type the command yourself in a terminal, `buildos init` asks `Set up Make Docs in this project? [Y/n]` instead.

> **Watch out.** Decide now. With the Make Docs version BuildOS is tested with (2.0.9), Make Docs cannot be set up later in a folder that has an `AGENTS.md` or `CLAUDE.md` that Make Docs did not write. If you answer No in a new project, BuildOS creates those two files, so Make Docs cannot be added there later with that version. If your folder already has your own `AGENTS.md` or `CLAUDE.md`, Make Docs setup will not finish there now or later, and BuildOS setup finishes either way. The output of `buildos init` says which case your folder is in.

When you answer Yes, Make Docs runs first, then BuildOS adds its files. If Make Docs fails, BuildOS is still set up: the output says that Make Docs is not set up and shows the exact command to try it again.

### What `buildos init` does

After your answer, `buildos init` lists every file it will add, then adds them. The end of the output for a No answer looks like this:

```text
Shared files. BuildOS changes only its own section of these files, between its buildos:begin and buildos:end lines, and only when that section is still exactly as BuildOS wrote it.
  AGENTS.md: created, with only the BuildOS section
  CLAUDE.md: created, with only the BuildOS section
  .gitignore: created, with only the BuildOS section

Done. BuildOS is set up in this folder.
Make Docs: not set up, as chosen. With this Make Docs version, Make Docs cannot be set up in this folder later. This Make Docs version does not set up a folder that has an AGENTS.md or CLAUDE.md file that Make Docs did not write.
```

Exit code `0` means it worked. How it treats your files:

- **In a new setup, it does not replace your files.** It adds the BuildOS folders (`.os/`, `assets/`, `playbooks/`, `workspace/`) next to what is already there. If a file it must add already exists, it changes nothing, lists the clashing files, and exits with code `10`. Move or back up those files, then run it again.
- **It shares three files.** In `AGENTS.md`, `CLAUDE.md`, and `.gitignore`, BuildOS adds only its own marked section and never changes another line.
- **It tries to undo everything when a step fails.** It removes what it created and puts back what it replaced. When it cannot put a path back (for example, you changed that file while it ran), it lists each such path, exits with code `10`, and the JSON result says `partially_applied`. Then look at each listed path: keep your own version or delete the leftover, and run `buildos init` again. Make Docs makes its own writes when you answer Yes, and BuildOS does not undo those. A crash or a power cut in the middle of a run is not undone either: what was already written stays (each single file is either the old one or the new one).
- **You can look first.** Add `--dry-run` to see the plan without writing anything.
- **Running it again is safe.** In a folder that is already set up, it changes nothing except a BuildOS section that is out of date.

It also writes `.os/manifest.json`, which records the BuildOS version this project uses:

```json
{
  "schema_version": 1,
  "buildos_version": "0.1.0",
  "initialized_at": "2026-11-24T22:15:17.018Z"
}
```

### A project set up with the earlier tools

If your project was set up with the earlier BuildOS tools (it has an `.os/` folder but no `.os/manifest.json`), the same command adopts it. It adopts only a folder that looks like such a project: one with an `.os/data/` folder, or with all five of `.os/`, `assets/`, `docs/`, `playbooks/`, and `workspace/`. Any other `.os/` folder, an empty one too, stops it with exit code `10` and nothing written.

Adoption writes only `.os/manifest.json`, the command wrappers in `.os/scripts/`, and the skills in `.os/skills/`. Where the earlier tools left a wrapper or a skill file at one of those paths, adoption replaces that file with the new one (it keeps the file's permission bits). If you changed one of those files yourself, copy your change somewhere else first. Your data, runs, findings, indexes, and configuration stay exactly as they were, and adoption never writes `AGENTS.md`, `CLAUDE.md`, or `.gitignore`. The old Python validator script in `.os/scripts/` stays in place; `buildos init` names it in a note. BuildOS no longer uses it, and you can delete it.

---

## Run BuildOS commands

### The project wrapper

After setup, every BuildOS command runs through one small script in your project, the **wrapper**. From the project folder:

```sh
.os/scripts/buildos <command>
```

On Windows, in Command Prompt:

```bat
.os\scripts\buildos.cmd <command>
```

The wrapper always runs the version in `.os/manifest.json` (pin first). It reads that version first. Then it looks for an npm install of exactly that version: in the `node_modules` folder of the project folder or of a folder above it (as Node.js looks, so an install in the root folder of an npm workspace counts), or the first `buildos` program on `PATH`, for example one installed for the whole machine with `npm install -g`. It reads only the package files and starts no program to check the version. A global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version through `npx`. Acceptance goes by layout, not by tool: a package folder `node_modules/build-os` with a matching `package.json` counts whatever tool made it (for example a local pnpm or Yarn link to such a folder). A shim script that only starts the package (as pnpm, Yarn, and Volta make for a global install) does not count, and the wrapper fetches the pinned version through `npx` instead. Every start also tells BuildOS the pinned version, and BuildOS stops with a plain message (exit code 3) if another version starts. So the project keeps the same version until you change it on purpose, also with a machine-wide `buildos`. BuildOS also checks its own Node.js version when it starts. If an older Node.js starts it (for example an old `node` in the project's `node_modules/.bin` folder), it stops with a plain message that names both versions (exit code 3).

If Node.js is missing or too old, the wrapper prints one plain line and stops:

```text
BuildOS needs Node.js 24 or newer on this computer. Install it from https://nodejs.org, then try again.
```

Commands come in groups called **domains**: `intake`, `discovery`, `design`, `entities`, `validate`, `init`, `version`, and `help`. For example, `.os/scripts/buildos intake convert --source <path>` converts a document. The later chapters use these commands.

### Check that it works

```sh
.os/scripts/buildos version
```

The output names the version:

```text
version: ok
root: not_applicable
mode: not_applicable
version: 0.1.0
source revision: <commit>
write status: not_requested
{
  "version": "0.1.0",
  "source_revision": "<commit>"
}
```

`.os/scripts/buildos help` lists every domain, and `.os/scripts/buildos help <domain>` explains one. These help forms always print text, also with `--json` after them. For an `intake`, `discovery`, or `design` command, `--help` after the subcommand (for example `intake convert --help`) lists its flags as an error (exit code `1`). The order of the flags is important. `intake convert --json --help` prints a JSON error result. `intake convert --help --json` prints the text error, because the command stops reading its flags at `--help`. When an agent needs a stable, machine-readable result, add `--json` to `version`, `validate`, `init`, or an `entities`, `intake`, `discovery`, or `design` command: they print one JSON result. The `intake` commands print it from BuildOS `0.2.0`; `0.1.0` refuses the flag there.

> **Note.** Some help text shows default paths that start with `system/`, such as `--assets-root system/assets`. That is the layout of the BuildOS source code. In your project, BuildOS uses your project's own folders (`assets/`, `.os/`) without the `system/` part.

### The old command names end in 0.3.0

The earlier tools were called `buildos-intake`, `buildos-discovery`, and `buildos-design`. When the BuildOS package is installed (with `npm install -g`, or run through `npx` under one of those names), those command names still work and give the same output, and each run prints one line first:

```text
Note: the command name "buildos-intake" goes away in BuildOS 0.3.0. Use "buildos intake" instead.
```

**The old names stop working in BuildOS `0.3.0`.** Use `buildos intake`, `buildos discovery`, and `buildos design` (in a project: `.os/scripts/buildos intake` and so on) in your notes, scripts, and playbooks now.

The project also has three small scripts with the old names: `.os/scripts/buildos-intake`, `.os/scripts/buildos-discovery`, and `.os/scripts/buildos-design` (each with a `.cmd` file on Windows). Each one prints the same note first, then runs `.os/scripts/buildos` with its domain, for example `buildos intake`. The note goes to the error stream (stderr), so the normal output and the exit code stay the same. These scripts are removed in BuildOS `0.3.0` together with the old command names. Use `.os/scripts/buildos <domain>` in anything new.

---

## Configure the instance

### What an instance is

An **instance** is one deployment of BuildOS: one project folder, with its own configuration file naming the real things it is pointed at.

That file is `.os/config/instance.yaml`, and it is the only file in the whole system where your own systems, environments and owners are named. Contracts, templates, and playbooks all stay generic. This one file holds the specifics, and everything else refers back to it by ID.

### The four blocks

**`systems`** names the things you are studying. A **system** is a product, a platform, or an application, described as a *type* rather than as a particular deployment. "The library lending system" is a system. "The library lending system in the sandbox" is an environment instead.

**`environments`** names the actual deployments. An **environment** is one deployment, tenant, sandbox, or configuration of a configured system, and each environment names which systems it contains. Anything you observe is only true of the environment you observed it in, so these IDs affect every record you write later. This is a different word from an *environment variable* in a terminal. The two are unrelated.

**`owners`** names who is accountable. An **owner** is a team, organization, vendor, or group. Each one carries a `kind`, which is a lowercase word such as `team`, `organization`, `vendor`, or `group`.

**`defaults`** is a convenience. It names the systems, environments, and owners to reach for when nothing more specific is stated. A default is not automatic scope, because each artifact type decides for itself whether defaults apply.

Every `id` is a **slug**: lowercase, hyphens, no spaces. Display names in `name` can be as loose as you like.

### A worked example

Here is a filled-in file for a team studying a community library's book-lending system that runs on a general-purpose business platform, across one vendor baseline and one configured sandbox. This example validates.

```yaml
version: 1

instance:
  id: lending-programme
  name: Library Lending Programme

systems:
  - id: lending-system
    name: Library Lending System
    description: The book-lending application this instance studies.
  - id: business-platform
    name: Business Platform
    description: The general-purpose business platform underneath it.

environments:
  - id: vendor-baseline
    name: Vendor Baseline
    systems:
      - lending-system
      - business-platform
    description: The unmodified vendor environment, used as the reference.
  - id: configured-sandbox
    name: Configured Sandbox
    systems:
      - lending-system
    description: The configured environment used for experiments.

owners:
  - id: product-team
    name: Product Team
    kind: team
  - id: platform-vendor
    name: Platform Vendor
    kind: vendor

defaults:
  systems:
    - lending-system
  environments:
    - vendor-baseline
  owners:
    - product-team
```

### How the rest of the system uses it

Artifacts across BuildOS carry three list fields: `systems`, `environments`, and `owners`. Together these are called **scoped metadata**. Every value in them must be an ID that exists in `instance.yaml`.

A playbook, meaning a short Markdown file telling a person or an agent how to do one job, carries them in its header. So does every structured record in `.os/data/`.

> **Watch out.** `owners` is for teams and organizations, not for kinds of user. A **persona** is a separate record type with its own rules and its own file. Do not model people as owners.

> **Watch out.** The validator ignores collections it does not know about. You can add extra top-level keys such as `customer_scopes` or `target_releases` and they will validate cleanly, because nothing rejects them. Nothing reads them either. Extra collections are inert.

---

## The shipped config is still the template

**The `.os/config/instance.yaml` that `buildos init` writes is byte-for-byte identical to the neutral template** at `.os/templates/instance-config.yaml`. It is an example sitting in the place your configuration goes.

Its values are `instance.id: example-instance`, one system `primary-system`, two environments `baseline` and `customized`, and two owners `adopter-team` and `platform-owner`.

Nothing warns you about this. An adopter who never opens the file gets a clean validation pass against entirely fictional IDs, and every artifact written afterwards is scoped to a system that does not exist.

There is no write protection on this file.

Open it and edit it before you do anything else in BuildOS.

Use a plain text editor, your agent tool, or anything else that saves plain text. Do not open it in a word processor. YAML uses indentation to mean structure, so keep the existing spacing exactly: the same number of leading spaces, and spaces rather than tabs. If you are unsure, copy the worked example above and change the values instead of the layout.

### Renaming the shipped IDs breaks six files

When you replace `primary-system` with your own ID, six files that ship with BuildOS still point at the old one, and validation fails until you fix them.

Three playbooks:

- `playbooks/discovery/inspect-ui-discoverability.md`
- `playbooks/testing/run-core-validation.md`
- `playbooks/build/package-build-artifact.md`

Three seeded record files, one line each:

- `.os/data/requirements.jsonl`
- `.os/data/capabilities.jsonl`
- `.os/data/test-cases.jsonl`

Each carries `systems`, `environments`, and `owners` values drawn from the template. Update them to your own IDs and validation passes again. The failure is loud and the fix is mechanical, so this costs you a few minutes rather than a session.

---

## Validate it

Run this from your project root:

```sh
.os/scripts/buildos validate
```

On Windows: `.os\scripts\buildos.cmd validate`. It changes no file.

**A pass** ends with this line, and exit code 0:

```text
OK. No problems found.
```

**A failure** gives a count, then each file with one line per problem: the field, what is wrong, and a code in brackets. Here is the start of the real output after the worked example above replaced the shipped config, before the six files were updated (21 problems in all; the rest follow the same pattern):

```text
Found 21 problems.

playbooks/build/package-build-artifact.md
  systems[0]: "primary-system" is not a configured ID in .os/config/instance.yaml. [unknown_id]
  environments[0]: "baseline" is not a configured ID in .os/config/instance.yaml. [unknown_id]
  owners[0]: "platform-owner" is not a configured ID in .os/config/instance.yaml. [unknown_id]
```

It ends with:

```text
Fix each problem, then run buildos validate again.
```

Exit code 4. Fix the named field in the named file and run it again.

### What the validator covers

It runs four passes:

1. The configuration contract still uses the expected vocabulary.
2. The configuration file itself is well-formed, and every cross-reference resolves.
3. Every playbook and playbook template carries valid scoped metadata.
4. Every line of every file in `.os/data/` is a well-formed record with a valid ID, status, and scope.

It leaves other things alone: the body of a playbook, the **frontmatter** of converted source material (the header block of `key: value` lines at the top of a Markdown file), the shape of a run record or a finding directory, and the redirect graph between records. A pass tells you your configuration and your scoping are sound, and says nothing about whether your content is right.

> **Note.** `buildos validate` replaces the Python validator script that earlier BuildOS projects used. It needs no Python. It reads only files inside the project, and it reads each one with a size limit.

> **Watch out.** Editing the file and not validating is the common failure. Run the command, which takes a second and is the only confirmation available.

---

## Words the system rejects

Older material and some early drafts use vocabulary the shipped system refuses. The validator will fail on these by name.

| Rejected | Use instead |
| --- | --- |
| `env` | `environments` |
| `envs` | `environments` |
| `for` | `owners`, or `systems` |
| `target_systems` | `systems` |
| The values `both`, `all`, `any`, `default` | An explicit list of configured IDs |

One rule explains all of them: every scoped field is a **plural list of configured IDs**. A field named `env` implies a single value, and a value like `both` implies the system can work out what you meant. Neither is allowed, because a record scoped to `both` cannot be filtered or compared later.

Here is what a legacy field produces. This is the real output after `environments:` was renamed to `env:` in one shipped playbook:

```text
Found 2 problems.

playbooks/testing/run-core-validation.md
  env: `env` is an old scoped field and is not allowed. Use systems, environments, and owners. [legacy_scoped_field]
  environments: `environments` is required in scoped frontmatter. Use an empty list ([]) when it does not apply. [scoped_field_required]

Fix each problem, then run buildos validate again.
```

One mistake produces two errors: the banned field, and the required field that is now missing.

---

## Find your way around

[How it works](02-how-it-works.md) gave you the model. This is the physical map, sorted by what you do in each place.

Most folders hold an `AGENTS.md` file, a short note saying what belongs there and what does not. These are **routers**, and they are written for people as well as for agents. If you are unsure about a folder, read its router first.

Beside each one sits a `CLAUDE.md`. In the BuildOS-owned folders it contains a heading and one line with a link to `AGENTS.md`, so that an agent tool which reads only that filename still finds the real instructions. Leave them in place.

**Write here.**

| Folder | What goes in it |
| --- | --- |
| `.os/config/` | `instance.yaml`. The work you did on this page. |
| `playbooks/` | Your playbooks, in one of four category folders: `administrative/`, `build/`, `discovery/`, `testing/`. |
| `.os/data/` | Structured records, one JSON object per line, in eight files. |
| `assets/` | Clean text copies of source material you bring in. Written by `buildos intake`. |
| `workspace/runs/` | One folder per recorded run. Written by `buildos discovery`. |
| `workspace/findings/` | One folder per proven observation. Written by `buildos discovery`. |
| `workspace/datasets/` | Local data your playbooks consume. |
| `docs/` | Only with Make Docs: your own deliverables, such as designs, plans, requirements documents, work backlogs, and guides. |

**Read here.**

| Folder | Why |
| --- | --- |
| `.os/contracts/` | The **contracts**, the rule book for each artifact type, saying what fields are required and what states are allowed. Contracts win over templates and over routers. You do not modify them and you do not need to read them cover to cover, as long as you know they are the final word. |
| `.os/templates/` | Eight starting shapes to copy from. Conveniences, not rules. |
| `.os/scripts/` | The command wrappers: `buildos` and `buildos.cmd`, and the older names `buildos-intake`, `buildos-discovery`, and `buildos-design`, which call `buildos` with their domain. |
| `.os/skills/` | The BuildOS skills, with a router. See below. |

**Leave alone.**

| Folder | Why |
| --- | --- |
| `.os/indexes/` | An **index** is a generated lookup file, never the source of truth. Rebuild it with the tool rather than hand-editing it. |
| `.os/manifest.json` | The BuildOS version this project uses. Change it only to update or roll back (below). |
| `.make-docs/` | Only with Make Docs: its own settings and resources. |

> **Watch out.** With Make Docs, there can be two folders called `assets`, and they belong to different systems. `assets/` is BuildOS-owned and holds your converted source material. `docs/assets/` belongs to Make Docs: it appears only when the first guide or shared project document is written there. Make Docs keeps its own rule files (contracts, templates, prompts, and references) in `.make-docs/system/`, and an agent can read any of them with `make-docs resource read`. Writing into the wrong `assets` folder is a boundary violation that an active rule in `playbooks/administrative/` exists to prevent.

> **Watch out.** The playbook category names read as though they describe administering BuildOS. They describe the system you are studying instead. Append "the system" to each one and they come out right: administer *the system*, build *the system*, discover *the system*, test *the system*.

> **Watch out.** `workspace/` is easy to overlook, and it is a quarter of the system. Runs and findings both live there. Do not treat it as scratch space.

---

## Skills

A **skill** is a packaged set of instructions an agent can follow for one kind of job, such as converting a batch of files or drafting a playbook. `buildos init` copies 21 BuildOS skills into `.os/skills/`, with a router, `.os/skills/AGENTS.md`, that lists each one and what it is for. Start with `buildos-workflow` when you know the outcome you want but not the skill.

BuildOS never installs a skill into your agent tool by itself. When you want one, ask your agent to install it. The router tells the agent how: copy that one skill folder, unchanged, into the project's skill folder of its own app (it names the folders for Claude Code, Codex, and GitHub Copilot), or, for another app, read the skill from `.os/skills/` and follow it. Some apps find a new skill only after a restart.

> **Not available yet.** Three skills still need Python 3 for their own helper tools until BuildOS `0.2.0`: `buildos-bulk-extract`, `fit-gap-analysis` (its spreadsheet step also needs the `openpyxl` package), and `capability-matrix`. No BuildOS command needs Python. `0.2.0` plans to move these tools into the `buildos` command. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

---

## Install without access to the npm registry

Some company networks block the npm registry. You can still use BuildOS: fetch the package once on a machine that has access, check it, and install it from the file.

1. On a machine with registry access, download the package file and compute its SHA-256 digest:

   ```sh
   npm pack build-os@0.1.0
   shasum -a 256 build-os-0.1.0.tgz
   ```

   On Windows, use `certutil -hashfile build-os-0.1.0.tgz SHA256` instead of `shasum`.

2. Compare the digest with the published one. `SECURITY.md` in the package, section "How to Check a Release", says where it is and how to check the provenance too. Do not use a file whose digest differs.
3. Copy the file to the machine without registry access and install it from the file:

   ```sh
   npm install -g --offline ./build-os-0.1.0.tgz
   ```

   The package has no dependencies, so nothing else is needed.
4. Set up the project with the installed command instead of `npx`:

   ```sh
   buildos init
   ```

When a `buildos` command is installed like this and its version is the one in `.os/manifest.json`, the project wrappers run it, without the registry (see "Update and roll back" below). When the versions differ, the wrappers run the pinned version through `npx`, which needs the registry or the npm cache. To run one command straight from the file instead, without installing: `npx -y --offline --package ./build-os-0.1.0.tgz -- buildos <command>`.

---

## Update and roll back

The version in `.os/manifest.json` always decides which BuildOS the project wrapper runs. A global install (as in the offline steps above) is used only when it is an npm install of exactly that version; see the last item.

- **To update**, change `"buildos_version"` to the new version, for example `"0.1.1"`, and run `.os/scripts/buildos version` to check. Read the release notes first.
- **To roll back**, set it back to the earlier exact version, for example `"0.1.0"`. That is the only step: you do not need to change or remove a global install. The wrapper accepts only an exact version, never `latest` or a range.
- **With a global install** (`npm install -g`, as in the offline steps), the wrapper runs that installed `buildos` only when it is an npm install of the version in the manifest. On a machine without registry access, after you change the manifest, install the same version, `npm install -g build-os@<version>` (or the file), so the wrapper can run it without the registry. Until then, the wrapper runs the pinned version through `npx`.

Commit `.os/manifest.json` with the change, so everyone on the project runs the same version.

> **Not available yet.** There is no `buildos update` command yet. A new version does not refresh the files that `buildos init` already copied (contracts, templates, skills). [What is not built yet](18-what-is-not-built-yet.md) has the full list.

---

## Environment URLs are not in the config

The `environments` block names your deployments and says which systems they contain. It does not record how to reach them. There is no URL field, and there is no readiness field either.

In practice, whoever runs a playbook against a live environment supplies the target address by hand, every time. Nothing carries it forward from the configuration, and nothing checks that the address matches the environment named in the run.

[Write and run a playbook](08-write-and-run-a-playbook.md) assumes you know this.

> **Not available yet.** The `environments` schema has no URL field and no readiness state. Record the address in the playbook that needs it, or in a note beside it, and expect to supply it by hand on every run. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

---

## Commit what you did

You have set up BuildOS, changed one configuration file and, if you renamed the shipped IDs, six more. Save that work now.

1. Open your editor's source-control panel and look at every changed file.
2. Read the diff on each one. You are checking that nothing changed except what you meant to change.
3. Stage those files, write a message that says what you did, such as "Set up BuildOS and configure the lending programme", and commit.
4. Push.

[Before you start](03-before-you-start.md) covers each of these git moves in full. Commit before you go on to 05, so that the next document's changes arrive on a clean starting point.

---

## What you should have now

- Node.js 24 or newer, checked with `node --version`.
- BuildOS set up in your project folder by `buildos init`, with your Make Docs choice made on purpose.
- `.os/scripts/buildos version` printing the version in `.os/manifest.json`.
- `.os/config/instance.yaml` edited to name your own instance, systems, environments and owners, and confirmed to be no longer the shipped template.
- The three shipped playbooks and three seeded record files updated to your IDs, if you renamed the shipped ones.
- `.os/scripts/buildos validate` printing `OK. No problems found.`
- A commit containing all of it, with the diff read before you made it.
- A working idea of where you write, where you read, and what to leave alone.
- The old command names replaced by `buildos <domain>` in anything you write, because they stop working in `0.3.0`.

## Next

[Bring in source material](05-bring-in-source-material.md), which turns documents from outside into clean text copies that remember where they came from.
