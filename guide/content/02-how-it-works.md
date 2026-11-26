# How it works

The three flows, the pieces that move through them, the two gates, and the mechanism that lets an agent orient itself.

## Before you start

Read [What BuildOS is](01-what-buildos-is.md) first. This article assumes it. You do not need the repository open, and nothing here asks you to run anything. This article names things. Every procedure lives in a later article, and is linked from here.

## The shape of the whole thing

BuildOS chains three flows. Each one takes something loose and turns it into something with a fixed shape, and the output of one becomes the input of the next.

Every name in the diagram is defined further down this article. If a word means nothing to you yet, read past it and come back.

```
FLOW 1 - INTAKE AND KNOWLEDGE

    your documents  (Word, Excel, CSV, HTML, a folder of HTML, PDF)
          |
          |  convert
          v
    converted twin ........... assets/<source-slug>/
          |
          |  extract
          v
    entity records ........... .os/data/*.jsonl
          |                    requirements, capabilities,
          |                    personas, test cases
          |
          +--- feeds --------------------------+
                                               |
FLOW 2 - DISCOVERY AND EXECUTION               |
                                               |
    playbook ................. playbooks/<category>/
          |                                    |
          |  GATE 1: review-to-activate  (draft -> reviewed -> active)
          v                                    |
    run record ............... workspace/runs/RUN-NNN/
          |                    run.md, evidence/, raw-findings.md
          |
          |  GATE 2: qualification  (a repeatable test that passes)
          v
    qualified finding ........ workspace/findings/FIND-NNN/
          |
          +--- feeds ---+
                        |
FLOW 3 - PLANNING AND ENGINEERING
                        |
    design ............... docs/designs/
          |
          v
    plan ................. docs/plans/
          |
          v
    PRD .................. docs/prd/
          |
          v
    work backlog ......... docs/work/
          |
          v
    (export to your work tracker - outside BuildOS)
```

Two path conventions in that diagram. A **slug** is a lowercase, hyphenated name with no spaces, so `<source-slug>` is the folder named after one source document. A `.jsonl` file is line-oriented JSON: one complete JSON record per line, one line per thing.

Nothing physically moves between the flows. What carries over is knowledge. Flow 1 tells you what the system is supposed to do, flow 2 checks whether it does, and flow 3 turns what you proved into work.

## Instruction lives next to the files it governs

Every directory in BuildOS carries a short file named `AGENTS.md`. It says what belongs in that directory, what does not, and where to go next. Agent harnesses load these files automatically, before any other instruction. There is no central configuration mapping agents to instructions. Each instruction sits in the directory it applies to, which keeps it from drifting away from the files it describes.

These files work as a router for an agent. The root file points into the machinery, and that points into each working area.

Alongside each `AGENTS.md` sits a `CLAUDE.md`. In the BuildOS-owned part of the tree it holds nothing but a pointer back to `AGENTS.md`, so that a harness which only reads `CLAUDE.md` still arrives at the real instruction. There are 30 of each, one pair per directory, with no directory holding one and not the other. [Harness independence and trust](16-harness-independence-and-trust.md) covers why.

Point an agent at the folder and give it an ordinary instruction with no conventions in it. It reads the routers first, then reports the correct next step. Agents also pick up rules nobody put in the prompt, such as keeping new playbooks in `draft`, refusing to write data rows without approval, or proposing a boundary rule the system already enforces.

> **Watch out.** The filename says `AGENTS.md`, so humans assume it is not for them and click around guessing instead. These files are written for you too. Read the router in a folder before you touch anything in it.

The routers repeat each other on purpose. Instructions stay short at the top of the tree and get more specific as you go deeper, so an agent loads only what the current directory needs. If you see the same rule twice, the design is working as intended.

## Contracts

A **contract** is the rule book for one kind of file. It says what fields that file must have and what states it can be in. Contracts win over templates and over routers.

Ten contracts ship, in `.os/contracts/`. They govern the configuration file, playbooks, run records, findings, converted sources, intake translation, extractions, entity records, record consolidation, and persona identity.

You do not have to read them. They are dense, and skipping them is a fair choice. The part that matters is that contracts settle arguments. If a template and a contract disagree, the contract decides. If your agent proposes something the contract forbids, the contract decides again. A human can tell an agent to break a rule, but an agent may not decide to break one on its own.

Contracts are also what keeps the output consistent. An agent pointed at the local playbook contract will keep playbooks in `draft`, rebuild the index, and refuse to write data rows or qualify findings without the approval and evidence the contract requires.

Templates live separately, in `.os/templates/`. There are eight: seven playbook shapes and one starting configuration file. Copy from them. A template is a convenience, and a contract still overrides it.

## Flow 1 · intake and knowledge

Flow 1 works out what the system claims it can do, and what the business needs from it.

**Intake** is taking a file from outside and bringing it into BuildOS as clean text that remembers where it came from. The result is a **converted twin**: a clean text copy of an original file, carrying a header that records the source path, a content hash, what converted it, and when. Twins land in `assets/<source-slug>/`.

The conversion is deterministic and local. No model reads the file, and nothing goes over the network. Excel becomes one CSV per worksheet, Word becomes Markdown, HTML becomes Markdown, PDF becomes plain text. The content hash means that if somebody edits the original and re-submits it under the same name, the system can tell it is the same document, changed.

An **extraction** is a record of one reading pass. It names the piece of the converted twin that was read and the entity records that came out of it. An **entity record** is one line of JSON in `.os/data/*.jsonl` describing one thing, with a stable ID. Four record types carry most of the weight:

- A **capability** is descriptive. It is something the system *can* do, according to whatever you read. Flow 2 is where you find out whether that is true.
- A **requirement** is normative. It is something the system *must* do.
- A **persona** describes a kind of user or stakeholder, with their goals and needs.
- A **test case** is a repeatable check: what it verifies, its setup, its steps, and the expected outcome.

[Bring in source material](05-bring-in-source-material.md) and [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) cover both halves.

> **Not available yet.** No extraction writer and no entity-record writer exist. The file `.os/data/extractions.jsonl` is empty, and nothing shipped appends to it. Records are hand-authored, or written by your agent against the contract. Conversion works. Everything after it in this flow is you and your agent. See [What is not built yet](18-what-is-not-built-yet.md).

## Flow 2 · discovery and execution

Flow 2 checks whether a claim is actually true, and whether you can prove it again.

A **playbook** is a short written procedure telling a person or an AI agent how to do one job. It lives as a Markdown file with a fixed header block. A playbook is a document. It describes the job, and a separate tool or a person carries the job out. New readers often expect it to be a script instead.

Playbooks live in `playbooks/`, in one of four directories: `administrative`, `build`, `discovery`, `testing`. The directory is the category. There are two kinds:

- A **procedure playbook** is one you run. It produces evidence.
- A **guardrail** is a playbook that states a rule instead of describing a job. It never runs and produces nothing. It says what you must and must not do. Nothing enforces a guardrail except the fact that agents read it, and a capable agent will cite the rule back to you before acting against it.

A **run** is one recorded attempt at doing something. It is a folder, `RUN-NNN/`, in `workspace/runs/`, holding a summary (`run.md`), the raw **evidence** captured during the run, and `raw-findings.md`. Once a run is closed you do not change it.

A **raw finding** is something you noticed during a run that has not been proven yet. It has no ID. It lives as an **anchor** inside that run's `raw-findings.md`. An anchor is a link to one heading in that file, and it is how everything downstream points back at the observation.

A **qualified finding** is a raw finding that passed a repeatable test. It gets a `FIND-NNN` ID and its own folder in `workspace/findings/`, holding the finding and the test that proved it. **Polarity** says whether it proves something *is* there (`positive`) or reliably *is not* there (`negative`). A negative finding still counts as a successful run.

[Write and run a playbook](08-write-and-run-a-playbook.md) and [Qualify what you found](09-qualify-what-you-found.md) cover this flow.

The software that actually drives a browser or controls a screen sits outside BuildOS by design. BuildOS keeps the record of the run: what it did, what it produced and what it proved. The driving itself happens elsewhere.

## Flow 3 · planning and engineering

Flow 3 settles what gets built.

- A **design** is a dated document recording one decision: what was chosen, what else was considered, and what follows from it.
- A **plan** is a directory of documents written before work starts. It settles the shape of the output, the order, and who does what.
- A **PRD** is a numbered set of documents describing the product. There is one active set at a time, and it evolves by adding numbered change documents rather than being rewritten.
- A **work backlog** is a directory of phase files. Each phase has stages, and each stage has checkbox tasks and plain-bullet acceptance criteria.

If you use a work tracker, the mapping is close. The backlog directory becomes an epic, each phase file becomes a feature, each stage becomes a backlog item, and tasks stay tasks.

These four live under `docs/`, which is owned by a separate documentation system called **make-docs**, installed into the repository as a plug-in. BuildOS must never edit those trees directly, so you work through their own routers. That ownership split is why the repository has two directories named `assets`.

> **Watch out.** `assets/` holds converted twins and belongs to BuildOS. `docs/assets/` belongs to Make Docs: it holds guides for each audience (such as `docs/assets/user/`) and shared project material, and it does not exist until the first such file is written. Make Docs keeps its own rule files (contracts, templates, prompts, and references) under `.make-docs/system/`. The two `assets` folders are different things with the same name. An active guardrail exists because people write to the wrong one.

[Designs, plans and PRDs](12-designs-plans-and-prds.md) and [Build the work backlog](13-build-the-work-backlog.md) cover this flow.

> **Not available yet.** One hop in this flow is tooled, the one that turns a qualified finding into a design (`buildos design promote finding`), and it needs a project that Make Docs set up. Plans, PRDs and backlogs are written by you and your agent against contracts and templates. There is no command for them.

## The core artifact types

| Artifact | What it is for | Where it lives | Governed by |
| --- | --- | --- | --- |
| Configuration | Names your real systems, environments and owners | `.os/config/instance.yaml` | `config-contract.md` |
| Converted twin | A clean, provenance-stamped text copy of a source | `assets/<source-slug>/` | `converted-source-contract.md` |
| Extraction | A record of what was read and what came out of it | `.os/data/extractions.jsonl` | `extraction-contract.md` |
| Entity record | One thing, one line of JSON, one stable ID | `.os/data/*.jsonl` | `entity-records-contract.md` |
| Playbook | How to do one job, or a rule you must follow | `playbooks/<category>/` | `playbook-contract.md` |
| Run record | One recorded attempt, with its evidence | `workspace/runs/RUN-NNN/` | `run-record-contract.md` |
| Qualified finding | Something proved, with the test that proved it | `workspace/findings/FIND-NNN/` | `finding-contract.md` |
| Design, plan, PRD, backlog | The deliverables | `docs/` | make-docs contracts |

The contracts are in `.os/contracts/`. You can work without reading them, as long as you remember that they decide arguments.

## The two gates

Two places in the chain stop and wait for a person.

**Gate 1 · review-to-activate, for playbooks.** A playbook goes `draft → reviewed → active`. Only `active` playbooks run or apply. The gate exists because a procedure playbook sends an agent to go poke at a real system. Somebody should read it before that happens. A person moves it by editing the status field in the playbook's header and then rebuilding the playbook index.

> **Not available yet.** There is no tooling for this gate and no approval is recorded anywhere. Activation is a hand edit plus an index rebuild. Your agent is technically able to do both. Keep this review with a person. [Write and run a playbook](08-write-and-run-a-playbook.md) has the procedure.

**Gate 2 · qualification, for findings.** A raw finding becomes a qualified finding only by passing a deterministic, repeatable test. Neither intuition nor a single observation is enough. Whoever writes and runs the confirmation test moves it through.

The test earns its keep by proving the gap now and proving the fix later, with nobody writing the test a second time. Speed is not the reason for it. Some real and important observations cannot pass this gate, because a mismatch between two models is not a behaviour a script can check. [Qualify what you found](09-qualify-what-you-found.md) says what happens to those.

Promotion from a qualified finding to a design is never automatic, and a person always decides it.

## Lifecycle states

Most things in BuildOS carry a status. The one that will affect you first is the playbook lifecycle: `draft` → `reviewed` → `active` → `archived`.

> **Watch out.** A `draft` playbook refuses to run. That is the gate working correctly, and it is the most likely thing to stop your first run. On a fresh copy of the repository the only discovery playbook ships as `draft`, so the discovery flow cannot start until you activate it or write your own. Fix: set the status to `active`, then rebuild the index. If you skip the rebuild you get the same failure again, with nothing to explain it.

Going straight from `draft` to `active` without ever using `reviewed` is common. The contract allows all three. Use `reviewed` if more than one person is involved.

Other artifact types use their own vocabulary.

| Type | States |
| --- | --- |
| Entity record | `draft`, `active`, `superseded`, `archived` |
| Run | `running`, `closed`, `aborted` |
| Converted twin | `candidate`, `converted`, `superseded`, `rejected` |

Each contract lists its own. Do not assume a status word means the same thing across two types.

## What you touch and what you leave alone

| Area | What it is | You |
| --- | --- | --- |
| `.os/config/` | Your instance configuration | **Write** |
| `playbooks/` | Your playbooks and guardrails | **Write** |
| `assets/` | Converted twins | **Write**, through the intake tool |
| `workspace/` | Runs, findings, local datasets | **Write.** Runs and findings through the tools, datasets by hand |
| `.os/data/` | Entity records | **Write**, but see below |
| `docs/` | Your designs, plans, PRDs, backlogs | **Write**, through its own routers |
| `.os/contracts/` | The rule books | **Read.** Do not modify unless asked |
| `.os/templates/` | Starting shapes | **Read**, and copy from |
| `.os/scripts/` | The command wrappers: `.os/scripts/buildos` runs every BuildOS command | **Read**, and run from |
| `.os/indexes/` | Generated lookup files | **Leave alone.** Rebuild, never hand-edit |
| `.make-docs/` | Documentation plug-in state | **Leave alone** |

**The data layer is the one you never edit by hand.** The entity records under `.os/data/` are stored as plain text on purpose. You can script against them, import them into another system, or map them somewhere else, and nothing is hidden from you in a format you cannot open. That openness is a commitment to you rather than an engineering convenience. Line-oriented JSON still makes poor reading for a person.

If you ever need to review the data layer, ask your agent to retrieve what you are looking for and display it as a table.

## What you should have now

- The three flows by name, and what moves between them: intake and knowledge, discovery and execution, planning and engineering.
- The artifact types, what each is for, and which contract governs it.
- The routing idea: instruction lives in a file next to the files it governs, and your agent reads it before it does anything.
- The two gates, review-to-activate for playbooks and qualification for findings, and who moves things through each.
- The lifecycle states `draft`, `reviewed`, `active`, and the fact that a `draft` playbook will refuse to run.
- A map of what you write, what you read, and what you leave alone.

## Next

[Before you start](03-before-you-start.md), covering Node.js, getting an agent onto your machine, and the git moves you will need.
