# What is not built yet

The complete register of what the shipped system does not do today, and what you do instead.

## What you need first

Read [How it works](02-how-it-works.md) first. This page assumes it. Terms used here are defined in [Glossary](20-glossary.md). Every other document in this set points here rather than carrying its own list of caveats.

## How to read this article

BuildOS is a young system. Its written rules are further along than its tooling, so much of what this documentation describes is a procedure you and your agent follow against a written contract rather than a command you run. Knowing which is which before you start will save you several days. Everything below was verified against the shipped system on 2026-08-23, and the command and installation parts again for BuildOS `0.1.0` on 2026-11-24.

## The four breaks in the chain

The full chain runs from a pile of documents to a hierarchical backlog inside a work tracker. Seventeen hops. Four of them break, in this order of severity.

### 1. Extraction · the chain stops after conversion

**What you expect.** You convert a source document into a clean text copy, then run something that reads that copy and produces structured records: the capabilities a system claims, the requirements the business has, the people who use it.

**What actually happens.** Nothing reads it. There is no extraction writer and no entity-record writer. `.os/data/extractions.jsonl` is zero bytes, and no shipped tool appends to it or to any of the entity files beside it. The system's own user guide says so: "no user-facing extraction writer is available yet."

**What you do instead.** Your agent reads the converted copy and the relevant contract in `.os/contracts/`, writes the rows itself, and you review them. This is how extraction actually gets done, and it scales to thousands of rows. See [Pull knowledge out of it](07-pull-knowledge-out-of-it.md).

### 2. Comparison · there is no subsystem for it

**What you expect.** Having recorded what a system can do and what it must do, you ask BuildOS for the difference.

**What actually happens.** The analysis itself works well, and an agent reading the records produces a strong comparison. The machinery around it is missing. There is no comparison artifact, no contract governing one, no command, no vocabulary term for it, and no skill guiding the process.

**What you do instead.** Run the comparison with your agent against the records BuildOS holds, then write the result back as a document. The comparison is often the outcome a client values most. Prompting is enough to get a good result, though not a repeatable one, because two runs can return different shapes. Agree an output shape with your team and ask for it every time. [Compare two systems](10-compare-two-systems.md) covers it end to end.

### 3. Activation · the discovery half cannot be started on a fresh copy

**What you expect.** You copy the repository, pick a discovery playbook, and run it.

**What actually happens.** The discovery command requires an `active` playbook in the `discovery` category. Exactly one discovery playbook ships and its status is `draft`, so the command has nothing to run. The gate that would change that has no tooling: activation is a hand edit plus an index rebuild, and no approval is recorded anywhere.

**What you do instead.** Edit the status field or write your own discovery playbook, then rebuild the index with `buildos intake index playbooks`. Record who approved the activation somewhere you will find it later, since nothing in the system records it for you. [Write and run a playbook](08-write-and-run-a-playbook.md) has the procedure.

### 4. The planning half · one automated hop, and it needs Make Docs

**What you expect.** A qualified finding becomes a design, the design becomes a plan, the plan becomes a set of requirement documents, and those become a work backlog.

**What actually happens.** One of those hops is automated, `buildos design promote finding`, which turns a qualified finding into a dated design document. It needs a project that Make Docs set up, and in practice designs are mostly not produced this way. No tooling exists for any hop after it. The final hop, export to a work tracker, does have working tooling, and that tooling lives outside the product folder.

**What you do instead.** Follow the Make Docs templates and contracts (in `.make-docs/system/` in a project that Make Docs 2.0.9 set up), with your agent doing the writing. A full requirements set, a plan bundle, a work backlog and an imported hierarchy of work items all come out of this route. See [Designs, plans and PRDs](12-designs-plans-and-prds.md) and [Build the work backlog](13-build-the-work-backlog.md).

## The full gap register

Sorted by how much each one will affect a new adopter rather than by size.

| What is missing | What it affects | What you do instead today | Where |
| --- | --- | --- | --- |
| Make Docs 2.0.9 cannot be set up later in a folder with an `AGENTS.md` or `CLAUDE.md` it did not write, so a No answer in `buildos init` is final for that version. | Designs, plans, requirements documents, and backlogs under `docs/`. | Decide on Make Docs during `buildos init`. | [Install and configure your instance](04-install-and-configure-your-instance.md) |
| No `buildos update` or `buildos uninstall`. A new version does not refresh the files `buildos init` copied. | Taking new contracts, templates, or skills. | Change the version in `.os/manifest.json` for the command itself; refresh copied files by hand. From `0.1.0` to `0.2.0`, change the version and the skills together ([Install and configure your instance](04-install-and-configure-your-instance.md), "From 0.1.0 to 0.2.0"). | [Install and configure your instance](04-install-and-configure-your-instance.md) |
| One skill still needs Python 3 for its own tool; a BuildOS command for it is planned for `0.2.0`. With BuildOS `0.1.0`, two more do. | The capability matrix; with `0.1.0`, also bulk extraction and fit-gap analysis. | Install Python 3 before you use one of them, or use BuildOS `0.2.0`, where bulk extraction and fit-gap analysis run BuildOS commands. | [Pull knowledge out of it](07-pull-knowledge-out-of-it.md), [Compare two systems](10-compare-two-systems.md) |
| The old command names `buildos-intake`, `buildos-discovery`, and `buildos-design` stop working in BuildOS `0.3.0`. | Notes, scripts, and playbooks that still use them. | Use `buildos intake`, `buildos discovery`, and `buildos design` now. | [Install and configure your instance](04-install-and-configure-your-instance.md) |
| No extraction writer and no entity-record writer in BuildOS `0.1.0`. `extractions.jsonl` is empty. | Everything downstream of conversion. | Your agent writes the rows against the contracts, and you review them. From `0.2.0`, `buildos extract bulk` stages the rows your agent drafts and publishes the approved ones with their extraction record. | [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) |
| No discovery playbook is active, and the activation gate has no tooling. | The whole discovery half on a fresh copy. | Edit the status field, rebuild the index, record the approval yourself. | [Write and run a playbook](08-write-and-run-a-playbook.md) |
| `instance.yaml` ships as the unmodified neutral template. | Everything scoped to a system, environment or owner. Placeholder identifiers validate silently. | Edit it before your first run, then validate. | [Install and configure your instance](04-install-and-configure-your-instance.md) |
| Three seeded entity records describe BuildOS's own review gate and point at a path that does not exist. | Your data, and any backlog built from it. | Delete or relabel them before adding your own rows. | [Keep the record clean](11-keep-the-record-clean.md) |
| No comparison subsystem: no artifact, contract, or vocabulary term in `.os/`. | Fit-gap analysis. | Use the `capability-matrix` and `fit-gap-analysis` skills with your agent, or run the comparison against the project's files and write the result back as a document. From BuildOS `0.2.0`, `buildos fitgap` computes the fit-gap scores and writes the workbook, outside `.os/data/`. | [Compare two systems](10-compare-two-systems.md) |
| BuildOS `0.1.0` has no command that exports to a work tracker. | Delivery. | Use the `buildos-export-azure-boards` skill, which runs its own Node.js script in `0.1.0` and the `buildos export azure-boards` command from `0.2.0`. | [Export to a work tracker](14-export-to-a-work-tracker.md) |
| `references.json` does not exist, although contracts, routers and guides name it. | Knowing what you have already brought in. | Build it with `buildos intake index references`, or ask your agent to list the converted twins. | [Bring in source material](05-bring-in-source-material.md) |
| Strict entity validation fails on a fresh copy, because `entity-resolution.json` has never been built. | Any validation run in strict mode. | Use compat mode, or build the index once with `.os/scripts/buildos entities rebuild-index --root . --mode strict --apply`. From `0.2.0`, the rebuild command that the warning prints starts with `npx -y build-os@<version>` and runs as printed. In `0.1.0` it starts with a bare `buildos`, which runs only with a global install, so use the `.os/scripts/buildos` form above. | [Keep the record clean](11-keep-the-record-clean.md) |
| Persona is the only record type with an identity contract. | Duplicates in every other record type. No automatic matching exists. | Review before you extract, and consolidate deliberately rather than by prompt. | [Keep the record clean](11-keep-the-record-clean.md) |
| PDF intake has no optical character recognition, table reconstruction, image extraction or layout fidelity. | Scans, diagrams, anything where layout carries meaning. | Export to a supported format, or use the manual conversion playbook. | [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) |
| Six supported source types. Email, slide decks, transcripts and recordings are not among them. | A large share of most teams' material. | Convert to a supported format, or bring the content in by hand. | [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) |
| `convert` takes one source. There is no folder sweep and no change detection. | Bringing in a batch. | Your agent loops over the folder. | [Bring in source material](05-bring-in-source-material.md) |
| No duplicate-source detection. The checksum finds an identical file, not a similar one. | Revised documents brought in twice. | Ask your agent to check first, then register the new one as superseding the old. | [Bring in source material](05-bring-in-source-material.md), [Keep the record clean](11-keep-the-record-clean.md) |
| Nothing generates a repeatable confirmation test from a run. | Qualifying a finding, since the tool takes such a test as input. | Write it yourself. The tool asks for one technology, while the contract accepts any deterministic method. | [Qualify what you found](09-qualify-what-you-found.md) |
| The configuration schema has no field for an environment address, or for what the instance is trying to achieve. | Every run against a live system. | Supply the address by hand each run, and keep a standing orientation note as an ordinary file. | [Install and configure your instance](04-install-and-configure-your-instance.md), [Write and run a playbook](08-write-and-run-a-playbook.md) |
| Playbook categories are fixed at four by the contract. The folder is the category. | Organising playbooks your own way. | Use the four that exist. | [Write and run a playbook](08-write-and-run-a-playbook.md) |
| `workspace/` and `assets/` ship empty. No example run, finding or converted copy exists anywhere. | Learning by example. | Read the contracts and the fixtures in `.os/contracts/examples/`. | [Pull knowledge out of it](07-pull-knowledge-out-of-it.md), [A worked walkthrough](19-a-worked-walkthrough.md) |
| `docs/` exists only with Make Docs and holds no finished example. | Seeing a finished design, plan or requirement set. | Use the Make Docs templates. | [Designs, plans and PRDs](12-designs-plans-and-prds.md) |
| No interface over the data. Nothing starts a process or opens a port. | Reading the record files. | Ask your agent for a table. Never open a `.jsonl` file directly. | [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) |

## Where the shipped documentation disagrees with the shipped system

Documentation inside the repository describes things that are no longer true, and following one into a path that does not exist will cost you an afternoon. Where the two disagree, what is actually in your project is correct.

| A document says | What is actually there |
| --- | --- |
| Converted output goes to `assets/converted/`. | The path is `assets/<source-slug>/<asset-slug>.<ext>`. No `converted/` subdirectory exists anywhere. |
| Structured rows load into `data/`. | The path is `.os/data/`. `data/` does not exist. |
| Artifacts carry `env:` and `for:` fields, with a value meaning "both". | Both fields are explicitly rejected as legacy, and the "both" value is banned. Scoping uses `systems`, `environments` and `owners`. Named customers and vendors are banned from reusable contracts. |
| There are two gates: verify-to-promote for findings, review-to-activate for instruments. | Only review-to-activate exists. The finding-side step is called qualification, and the contract term is `qualified`, not `verified`. |
| `references.json` and `entity-resolution.json` are listed in the index table as if they exist. | Neither file exists. Both must be built first. |
| If a discovery playbook cannot run, confirm it appears in `runnable_playbooks`. | Correct as written, but no discovery playbook is active, so the implied path is unreachable on a fresh copy. |
| Qualifying a finding requires a confirmation test written in one specific browser-testing technology. | The contract defines the test neutrally: any command, manual procedure, harness, script or other deterministic method. The tool is stricter than the contract. |
| `workspace/` is planned, and `buildos intake` is a scaffold for a planned toolkit. | Both are built. `workspace/` has its directories, routers and two contracts, and is simply empty. `buildos intake` is implemented and was verified working. |

## What is missing but does not matter much

None of these should change what you do.

- `runnable_playbooks` in the playbook index is a misleading name. It includes guardrail playbooks, which by contract never run.
- `workspace/datasets/` contains only a placeholder file, with no example dataset and no format guidance beyond which file types belong where.

## What this means practically

Of the 58 distinct things this documentation describes people doing with BuildOS, only a small share run as one command. Most are defined by a written contract and produced by you and your agent, some are part command and part procedure, and some are described here but absent from the shipped system. (The 2026-08-23 count was 7 commands in 58; `0.1.0` added the entity, design, setup, and validation commands, and the count was not redone.)

So most of the work is a procedure against a written contract. The contracts are what keep the output consistent, and an agent will obey rules it was never shown in the prompt. That proportion changes how you plan the work. You are budgeting review time rather than run time, and you need somebody who will read what the agent wrote.

[A worked walkthrough](19-a-worked-walkthrough.md) runs the whole chain once with real paths, and names each of the four breaks at the exact point you meet it.

## What you should have now

- The four breaks in the chain, in order of severity, and what you do at each one.
- A register of every verified gap, with the workaround and the document that covers it.
- The places where documentation inside the repository points somewhere that does not exist.
- The proportion of this documentation that is commands rather than procedures: a small share.

## Next

[A worked walkthrough](19-a-worked-walkthrough.md), the whole chain end to end, with the breaks named where they occur.
