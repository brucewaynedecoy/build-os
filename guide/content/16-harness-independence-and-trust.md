# Harness independence and trust

This page explains why BuildOS does not depend on a particular agent product, what genuinely does differ between tools, and what it means to give someone write access to a project that instructs agents.

## What you need first

Read [Working with your agent](15-working-with-your-agent.md) first. This page assumes it.

Two terms from that page are used throughout. An **agent harness** is the software wrapped around a language model that gives it tools, a working directory and a loop. A **router** is a short instruction file named `AGENTS.md` that sits in a directory and says what belongs there, what does not, and where to go next.

## The claim

BuildOS reads its instructions from plain files on disk. Any capable agent tool can follow them.

There is no product you have to buy alongside it, no plug-in to install, and no configuration step that names your tool. You copy a folder into your project and point an agent at it.

## Why that is true

Four properties of the shipped folder, all of which you can check yourself.

**Instructions live next to the files they govern.** Every directory carries its own `AGENTS.md`. There is no central configuration file that maps agents to instructions, so there is nothing to register a tool with and nothing to keep in sync. An agent that opens a directory finds the instruction for that directory in it.

**It is plain text and nothing else.** The folder BuildOS puts in your project holds 158 files: 95 Markdown, 20 YAML, 17 JSON, 10 line-oriented JSON data files, 4 CSV examples, 8 short command wrappers with a small helper and its message file, and two housekeeping files (from BuildOS `0.2.0`; `0.1.0` also had 5 helper scripts that belonged to skills). No binaries, no database, no lock file. The `buildos` command itself comes from one npm package and runs on Node.js.

**There is no runtime and no network requirement.** Nothing in the folder starts a process, opens a port or requires a service to be running. The conversion tool states that all conversion is local-only, and the toolkit rules disallow network calls unless a design approves them and the command requires an explicit flag.

**There are no product names in the operating layer.** Search the BuildOS-owned parts of the tree for the name of any agent product and you get zero hits in file content. That covers the machinery under `.os/`, the playbooks, the workspace, the converted-source folder and the root router. Where the playbook header records what a procedure needs from a harness, the permitted values are capability categories: `browser`, `computer-use`, `mcp`, `shell`, `none`.

### The paired router files

Alongside every `AGENTS.md` there is a `CLAUDE.md`. The pairing is exact: 30 of each, and no directory has one without the other.

They exist because different harnesses look for different filenames. For the 18 directories BuildOS owns, the `CLAUDE.md` file carries no instruction at all. Nine of them are byte-identical 73-byte pointers. The complete content of `.os/contracts/CLAUDE.md` is:

```markdown
# CLAUDE

Read [`AGENTS.md`](AGENTS.md) in this directory and follow it.
```

A tool that only reads `CLAUDE.md` gets bounced to the real file, and one that reads `AGENTS.md` arrives at the complete instruction set directly. Deleting all 18 of the BuildOS-side `CLAUDE.md` files would cost one tool its entry point and nothing else.

> **Watch out.** With Make Docs, the router files in `docs/` and `.make-docs/` belong to Make Docs. It records its own settings, including its harness choices (`harnessIntegrations`), in `.make-docs/config.yaml`; `buildos init` sets those choices to `disable` for Claude Code and Codex. Deleting Make Docs files by hand leaves Make Docs out of step with them. Change them through Make Docs instead.

## What independence looks like in practice

Two people who cannot use each other's agent tools can work the same project for months, sharing nothing but the repository, with nothing in that repository changing to accommodate either tool.

Several things follow from that:

**Two tools, one project, one session, no reconfiguration.** Two different agent products can read the same checkout, the same indexes and the same playbooks inside a single working session. Driving a browser is a common reason to switch mid-session.

**A tool nobody tested against works the first time.** BuildOS run for the first time on an untested agent product will generate a design document from a raw-findings file without special handling.

**Three people, three tools, one project.** The same converted sources, playbooks and entity data can be worked from three different agent products across two operating systems, with no per-tool configuration anywhere.

**The hand-off between tools is git and nothing else.** Chat file sharing gets blocked by identity policy and email delivers the wrong file. Committing and pulling is the channel that works, and it is also where the most time gets lost, because the commits often do not happen.

A tool that appears nowhere in BuildOS's own capability table falls through to the unnamed default without trouble, and can generate design documents, run a browser-driven discovery session, and import a hierarchical backlog into a production tracker.

## The caveats

**Naming a tool is not the same as supporting it.** The Make Docs file `.make-docs/system/references/harness-capability-matrix.md` has rows for three products, Codex, Claude Code and OpenCode, plus an "Unknown" fallback row. That file is a decision table for generating documentation rather than a support list. A tool with no row in it works just as well. Treat an absent name as neutral information.

**The operating layer names no products, and the documentation layer does.** The machinery under `.os/`, the playbooks, the workspace and the converted-source folder name no products. The documentation half (`docs/` and `.make-docs/`) names three, and its planning and execution guidance assumes both a tool-integration protocol and the ability to delegate to sub-agents, with single-agent operation given as the fallback rather than the default. A team on a fourth tool can operate the BuildOS half completely, and will have to reinterpret the documentation half.

**Driving a browser is the capability that genuinely differs.** It is the most common reason to switch tools, and it tracks the kind of application rather than the vendor. A desktop agent application has some level of computer control and an editor extension does not. BuildOS treats this as external on purpose, and `workspace/runs/AGENTS.md` states that the live computer-use or browser harness remains external. Budget for it separately. Building a substitute out of a browser extension and a bridge can consume most of a working session, none of it BuildOS work.

**Small syntax differences exist.** Two kinds turn up. In one harness the `@` symbol addresses tools rather than files, so a file reference written that way silently fails, and the fix was to write the bare filename with its extension and name the destination folder. The way you invoke an installed skill also differs enough that you may have to ask the agent what the syntax is in its own tool, which is a reasonable first move when something small does not behave.

**One runtime is required, and Windows uses its own wrapper.** Every BuildOS command needs Node.js 24 or newer and nothing else. One skill, `capability-matrix`, still needs Python 3 for its own tool; a BuildOS command for that tool is planned for `0.2.0`. With `0.1.0`, bulk extraction and fit-gap analysis need Python too; from `0.2.0`, they run BuildOS commands. The wrappers under `.os/scripts/` come in two forms: `buildos` for macOS and Linux shells, and `buildos.cmd` for Windows Command Prompt. BuildOS shows no PowerShell form of its commands. These portability limits have nothing to do with which agent you use. [Install and configure your instance](04-install-and-configure-your-instance.md) covers what you actually need installed.

**The confirmation-test tooling is stricter than the contract it implements.** The finding contract accepts any deterministic method, including a command, a manual procedure, a harness or a script. The shipped `buildos discovery` tool requires a Playwright test file. Where the two disagree, the implementation is what you have to satisfy.

**Self-orientation usually works.** Agents read the routers unprompted almost every time. One exception is a voice-driven mode, which may refuse to explore and index the wrong project until you name the project explicitly.

**Model and effort settings live in your tool and they change the output.** The best output often comes from one specific model at one specific effort level, which is the hardest thing to reproduce elsewhere. [Working with your agent](15-working-with-your-agent.md) covers what to do about that.

## Trust

Everything above covers what BuildOS does not require of you. This half covers what it leaves unprotected.

### Write access to the project is the ability to change what agents do

A BuildOS project is a set of instructions that agents read and act on before they do anything else. Anyone who can commit to it can change those instructions. Editing one router file changes what every agent on the project does next, for everybody.

This rarely gets discussed in those terms, and the shipped system contains no control for it. There is no signing, no ownership marking on the routers, and no mechanism that tells an agent an instruction file has changed. An agent can silently edit the configuration file and add entries nobody asked for, and nothing will stop it.

The stated design goal was the opposite of this concern: anyone should be able to clone the project and edit things without breaking the agent. That covers honest mistakes and leaves deliberate ones entirely open.

Two people on one branch with no branch protection is defensible while the team is small. It stops being defensible as soon as many people are working in the repository, and a system can spread through an organisation by word of mouth faster than anyone notices.

**What to do about it.** Share the project only with people you trust to change what your agents do. Treat a change to a router file or a contract file the way you would treat a change to code: someone other than the author reads it before it lands.

### What your project will end up holding

Two things, both easy to forget.

**Captured material about your systems.** Conversion writes a readable copy of every source you bring in. Whatever was in the original workbook, export or document is now in the project as plain text, and everyone with access can read it.

**Generated documents nobody has read.** Long runs produce document sets faster than anyone reads them. A generated set can be committed and reviewed later, with the review turning up dozens of wrong rows.

### What provenance covers, and what it does not

BuildOS does not prevent confidential material from entering it. There is no scrubbing step, no review gate, and nothing that checks.

What the system gives you is provenance. A converted source carries fields recording where it came from, a checksum, which converter produced it and when. Scoped metadata has to draw its values from the identifiers in your configuration file rather than from invented ones. Both of those are useful, and neither one acts as a confidentiality control. Knowing where something came from tells you nothing about whether it should be in the project.

Two habits follow directly:

- **Read generated documents before you commit them.** The commit is the moment the material becomes shared and permanent.
- **Check example values before you copy them into anything real.** Example identifiers in documentation get reused. Use only values your own organisation confirms, and never copy an example identifier into a real export.

### The concrete minimum

Three practices, each costing a few minutes:

1. **Review the diff before you commit anything an agent wrote.** It is how you see which lines of which document changed, and it is the only supervision most teams manage to sustain.
2. **Have a second agent review a plan before you run it.** Wrap the plan, ask what running it would do and whether it is safe, and fold the reviewer's own recommendations back in.
3. **Wrap any pasted instruction block** so the receiving agent treats it as content to analyse rather than commands to obey.

[Working with your agent](15-working-with-your-agent.md) has the steps for all three.

## What you should have now

- A one-sentence version of the independence claim, and the four properties that make it true.
- An understanding of why the paired `CLAUDE.md` files exist and what deleting them costs.
- The list of things that genuinely do differ between agent tools, so you can plan around them.
- The knowledge that a name in the capability table is not a support statement, in either direction.
- A plain statement that write access to the project is the ability to change what agents do, and that nothing in the system controls it.
- Three review practices you can start using today.

## Next

[When things go wrong](17-when-things-go-wrong.md) covers the failures you will actually hit and what to do about each one.
