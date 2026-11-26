# Glossary

Every BuildOS word used in this set, defined in plain language, in one alphabetical list.

## How to use this article

You arrived here because one word stopped you. Find that word, read the two or three lines under it, and go back to what you were doing. Where a definition needs another word from this article, it links to it. Paths under **Where it lives** are real, written from the root of the copied folder.

---

## The words

### active-set evolution

Changing a numbered set of documents by adding new numbered change documents, rather than rewriting the ones already there.

**In practice.** You meet this when a [PRD](#prd) that people are already working from needs to change.

---

### adapter

A component of the companion export skill that adds one target platform's authoring rules on top of the base export contract: the title grammar, the property set, and how deep each description section has to go. An adapter is running code rather than a note to the agent. It runs its own checks when the file is written, and its errors stop the write.

**Not to be confused with.** Anything in your BuildOS project. Adapters belong to the exporter skill that ships beside BuildOS, not to BuildOS itself. See [Export to a work tracker](14-export-to-a-work-tracker.md).

---

### agent

A language model plus the software wrapped around it, working on the files in your folder. The model supplies the reading and writing. The software supplies the tools, the folder, and the loop that keeps it going.

**Not to be confused with.** BuildOS. BuildOS is a folder of files that steers an agent. It is not a model and it does not run one.

---

### agent harness

The software wrapped around a language model that gives it tools, a working folder, and a loop.

**In practice.** This set says "your agent" rather than naming a product, because BuildOS keeps its instructions in files and any capable tool can read them. See [Harness independence and trust](16-harness-independence-and-trust.md).

**Not to be confused with.** The intelligence. People say the harness writes the code, when the writing comes from the model and the harness only supplies the hands.

---

### AGENTS.md

See [router](#router).

---

### alias

Another approved spelling of the phrase that names a [persona](#persona). A person has to approve it. An agent that reads a name in a document cannot add one on its own.

**Where it lives.** The `aliases[]` field on a persona row.

---

### anchor

The `#` fragment on the end of a path, naming one place inside a Markdown file. It is normally a heading: take the heading text, lowercase it, and replace each space with a hyphen. A file with the heading `## Reservation rules` gives you the anchor `#reservation-rules`.

**In practice.** You write anchors into a [source anchor](#source-anchor) field, and you read them out of a run's `raw-findings.md` when you qualify a [raw finding](#raw-finding). [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) shows one worked example.

---

### backlog

A folder of phase files describing work to be done. Each phase holds stages, and each stage holds checkbox tasks with plain-bullet acceptance criteria under them.

**Where it lives.** `docs/work/YYYY-MM-DD-w{W}-r{R}-<slug>/`

---

### candidate

A status on a [converted twin](#converted-twin) meaning the text is useful but a person should read it before anyone relies on it.

**Not to be confused with.** The same word on an [entity record](#entity-record). It is not legal there, and the validator rejects it. The equivalent for a record is `draft`.

---

### canonical ID

See [terminal ID](#terminal-id).

---

### capability

A record of something a system can do. It is a description rather than a demand, and it may turn out to be false, which is what testing is for.

**Not to be confused with.** A feature. See [feature](#feature).

---

### category

Which of four folders a [playbook](#playbook) sits in: `administrative`, `build`, `discovery`, `testing`. The folder decides the category, so there is no separate setting to get wrong.

Read the four names with "the system" after them: administer the system, build the system, run discovery about the system, test the system. "The system" means the thing you are studying, not BuildOS. `administrative` is the name that misleads. A careful newcomer read it as "administering BuildOS" and used the folder backwards for weeks. Nothing in the name corrects that, so correct it yourself each time you read it.

**Where it lives.** `playbooks/<category>/<slug>.md`

---

### compat mode and strict mode

Two levels of strictness when checking entity data. `compat` reports an old record with no forwarding pointer, and a missing lookup file, as warnings. `strict` treats both as failures.

**In practice.** A fresh copy of the folder fails `strict`, because the entity lookup file has never been built. That is expected, not a defect in your setup.

---

### computer use

An agent driving the mouse and keyboard as if it were a person sitting at the machine, instead of calling a programming interface. It is one of the tool kinds a playbook can declare.

**In practice.** The tool that drives sits outside BuildOS. The folder records what happened afterwards.

---

### consolidation manifest

A reviewed file listing which records fold into which. Planning one changes nothing. Applying it is a separate, deliberate step that you have to ask for.

---

### contract

The rule book for one kind of file. It says which fields that file must carry and which states it may be in. A contract beats a template and beats a [router](#router).

**In practice.** You do not have to read them. Know that they are the authority, and your agent will follow them without being told.

**Where it lives.** `.os/contracts/`, holding ten contracts plus the two router files.

---

### convert

Turning a file from outside into clean text inside BuildOS, using code rather than a model. The same input gives the same output every time.

**Not to be confused with.** [Extraction](#extraction). Converting produces text. Extraction reads that text and writes records. The two get mixed up constantly, including by people who know better.

**Where it lives.** `.os/scripts/buildos intake convert --source <path>`

---

### converted twin

The clean text copy of an original file, carrying a header that records where it came from, a fingerprint of the original, what produced it, and when. Also called a converted source.

**Not to be confused with.** Something true. The copy is faithful to the original file, which is a different claim. If the original was wrong, so is the copy.

**Where it lives.** `assets/<source-slug>/`

---

### design

A dated document recording one decision: what was chosen, what else was considered, and what follows from it.

**Where it lives.** `docs/designs/YYYY-MM-DD-<slug>.md`

---

### entity record

One line of JSON describing one thing, with a stable ID that nothing else uses.

**In practice.** You do not open these files. Ask your agent to show you the rows as a table.

> **Not available yet.** No tool writes requirements, capabilities, personas, test cases, or results. They are written by hand. See [What is not built yet](18-what-is-not-built-yet.md).

**Where it lives.** `.os/data/*.jsonl`, across eight files.

---

### environment

One deployment, tenant, sandbox, or configuration of a configured [system](#system). What you prove is only true of the environment you proved it in.

**In practice.** The configuration has no field for a web address and none for whether the environment works today. Keep those somewhere else.

**Where it lives.** The `environments` list in `.os/config/instance.yaml`.

---

### epic

Not a BuildOS word. It comes from work trackers, and it is the fastest way to explain the shape of a [backlog](#backlog): the backlog folder behaves like an epic, each phase file like a feature, each stage like a work item, and each checkbox like a task.

None of those four words appears in a file.

---

### evidence

The raw material captured during a [run](#run): screenshots, logs, command output, transcripts. It freezes when the run closes.

**Not to be confused with.** Somebody saying what happened. A description of a defect is not evidence, and a vendor who cannot reproduce it from your description will ask you to show it.

**Where it lives.** The `evidence/` folder inside the run folder.

---

### execution mode

How much a playbook spells out. `explicit-steps` means do exactly this. `guided-objective` means reach this outcome, your call how. `inferred-actions` means work out the steps. `n/a` is for [guardrails](#guardrail), which are not run at all. Spelled `execution_mode` in the file.

---

### extraction

A record saying: I read this part of this [converted twin](#converted-twin), and these entity records came out of it.

> **Not available yet.** No tool writes these rows. The file is empty and stays empty unless somebody writes to it by hand. See [What is not built yet](18-what-is-not-built-yet.md).

**Where it lives.** Rows in `.os/data/extractions.jsonl`.

---

### feature

Not a record type in the shipped system. People reach for it when they mean [capability](#capability), and there is nowhere to put it if they insist.

---

### finding

See [raw finding](#raw-finding) for one nobody has proved, and [qualified finding](#qualified-finding) for one that passed a test.

---

### front matter

A block of structured data at the top of a Markdown file, fenced above and below by a line of three hyphens. It is how a file states its ID, its status, and its scope. The format is YAML, which reads like a list of labelled values.

---

### guardrail

A [playbook](#playbook) that states a rule instead of a job. It never runs and produces nothing. It says what you must and must not do.

**In practice.** It works by being read. No tool enforces it. Two of the three playbooks switched on in a fresh copy are guardrails.

---

### harness (the playbook field)

On a playbook, the kind of tooling the job needs: `browser`, `computer-use`, `mcp`, `shell`, or `none`. It names a capability rather than a product.

**Not to be confused with.** The [agent harness](#agent-harness), which is the software you are running. Same word, two meanings.

---

### identity key

The approved phrase that names a [persona](#persona). Only personas have one, and a person has to approve it.

---

### index

A generated lookup file. It is never the source of truth. Delete it and rebuild it whenever you like.

One index ships, and it holds a list named `runnable_playbooks`. The name is wrong. The list holds every playbook that is switched on, including guardrails, and a guardrail never runs. Read it as "switched on", not "things you can execute."

> **Not available yet.** Two other index files are named in the contracts and do not exist until you build them: the converted-source index and the entity lookup file. See [What is not built yet](18-what-is-not-built-yet.md).

**Where it lives.** `.os/indexes/`

---

### instance

One deployment of BuildOS: one copy of the folder, with its own configuration file naming the real systems, environments, and owners it points at.

> **Watch out.** The configuration file that ships is the neutral example. If you do not edit it, everything validates against invented names and nothing warns you. See [Install and configure your instance](04-install-and-configure-your-instance.md).

**Where it lives.** `.os/config/instance.yaml`

---

### intake

Taking a file from outside and bringing it in as clean text that remembers where it came from.

> **Watch out.** Attaching a file in your agent's chat window is not intake. Nothing lands on disk, nothing is recorded, and the next session knows nothing about it. See [Bring in source material](05-bring-in-source-material.md).

---

### lifecycle state

The stage an artifact has reached, written in its own fields. The words differ by artifact type:

| Artifact | States |
| --- | --- |
| Playbook | `draft` → `reviewed` → `active` → `archived` |
| Entity record | `draft`, `active`, `superseded`, `archived` |
| Converted twin | `candidate` → `converted` → `superseded` or `rejected` |
| Run | `running` → `closed` or `aborted` |
| Finding | `qualified`, `designed`, `archived` |

Only an `active` playbook runs or applies. See [review-to-activate](#review-to-activate).

---

### load plan

The running list of extraction rows.

**In practice.** You will not meet it. The file it names is empty.

---

### make-docs

A separate documentation system installed into the repository as a plug-in. It owns four folders, and BuildOS must not write into them directly.

**In practice.** It owns `docs/`, where designs, plans, PRDs, backlogs, and guides go. The outputs you care about most live in its folders, reached through its own routers.

**Not to be confused with.** The two folders named `assets`. `assets/` holds converted twins and belongs to BuildOS. `docs/assets/` belongs to Make Docs and holds guides and shared project material. Make Docs' own rule files are under `.make-docs/system/`.

---

### minted, referenced, updated

Three lists on an [extraction](#extraction) row. **Minted** means it created new records. **Referenced** means it reused records without changing them. **Updated** means it deliberately changed records.

**In practice.** Read them after a second pass over material you already processed. A second pass does not only add.

---

### owner

A team, organisation, vendor, or group accountable for something. Named once in the configuration file, then referenced by ID everywhere else.

---

### persona

A record describing a kind of user or stakeholder: what they are trying to get done, and what they need in order to do it.

**Not to be confused with.** A permission set. It grants nothing, restricts nothing, and no part of the target system knows it exists.

---

### phase

A chunk inside a [plan](#plan) or a [backlog](#backlog). Each phase is its own file, `0N-<phase>.md`. `p{P}` never appears in the directory name, and exists so you can refer to a phase from outside, as in `w2 r0 p3`.

---

### plan

A folder of documents written before work starts. It settles the shape of the output, the order, and who does what.

**Not to be confused with.** Your agent tool's own planning mode. See [plan-mode plan](#plan-mode-plan) below.

**Where it lives.** `docs/plans/YYYY-MM-DD-w{W}-r{R}-<slug>/`

---

### playbook

A short written procedure telling a person or an agent how to do one job. It is a Markdown file with a fixed header block and fixed sections.

**Not to be confused with.** The script that does the work. Two separate things exist: an agent clicking around like a user, and a script that repeats a check the same way every time. The playbook is the written instruction behind either one. This is the confusion people hit most often.

**Where it lives.** `playbooks/<category>/<slug>.md`

---

### polarity

Whether a finding proves something is there (`positive`) or reliably is not there or fails (`negative`). A negative result is a successful run with a useful answer.

---

### PRD

Product requirements: a numbered set of documents describing the product, kept deliberately short and pointing at the records behind them rather than repeating those records. One set is active at a time.

**Where it lives.** `docs/prd/NN-<slug>.md`

---

### procedure playbook

A [playbook](#playbook) you run, as opposed to one that states a rule. It produces evidence. The other kind is a [guardrail](#guardrail), and every playbook is one or the other.

---

### provenance

The record of where a piece of text came from: the original path, a fingerprint of the original file, what produced the copy, and when.

**In practice.** It is the header at the top of every [converted twin](#converted-twin). The fingerprint is what makes it *possible* to tell that a file with the same name has changed, though no shipped tool does that comparison for you. See [Bring in source material](05-bring-in-source-material.md).

---

### qualification

The repeatable test that proves an observation. A hunch does not count and a single sighting does not count. Somebody else has to be able to run it and get the same answer.

**Where it lives.** `qualification.md` inside the finding folder.

---

### qualified finding

An observation that passed a repeatable test. It gets an ID of the form `FIND-NNN` and its own folder holding the statement and the test that proved it.

**In practice.** Some important observations cannot pass. A mismatch between how a platform models the world and how your business works is a conclusion, not a behaviour a test can trigger. See [Qualify what you found](09-qualify-what-you-found.md).

**Where it lives.** `workspace/findings/FIND-NNN/`

---

### raw finding

Something you noticed during a [run](#run) that nobody has proved. It has no ID.

**Where it lives.** An [anchor](#anchor) inside that run's `raw-findings.md`.

---

### redirect

A pointer on a losing record saying which record replaced it, who decided, when, and why. Nothing is deleted, and the losing record keeps everything that was recorded about it.

**In practice.** It only folds one record into another. Splitting one record into two is manual re-authoring, and no tool does it.

---

### requirement

A record of something a system must do.

**Not to be confused with.** A [capability](#capability). The difference is ownership: somebody requires a requirement and is tracking whether it is met. A capability is only a description of what the system can do.

---

### result

The outcome of running a check: `pass`, `fail`, `blocked`, or `inconclusive`. The last one means the check could not settle the question either way.

**In practice.** `blocked` is the one people write down without checking. Confirm it is blocked before you record it.

---

### review-to-activate

The gate a [playbook](#playbook) passes before it counts. A person moves it from `draft` to `reviewed` to `active`, and only an `active` playbook runs or applies.

The point of the gate is that a human decides before an agent starts operating a real system.

> **Not available yet.** No tool performs this. Activation is a hand edit of the header block followed by an [index](#index) rebuild, and nothing anywhere records who approved it. An agent that edits the header for you has not reviewed anything. See [What is not built yet](18-what-is-not-built-yet.md).

---

### revision

A redo inside one [wave](#wave). Written `r{R}` in a folder name. Redoing a wave is the ordinary way a change gets absorbed, rather than a signal that something went wrong.

---

### router

A short instruction file that sits in a folder and says what belongs there, what does not, and where to go next. It is named `AGENTS.md`. Agent tools load it on their own before anything else.

**In practice.** People skip these files because the name suggests they are not for humans. They are the fastest way to understand any folder in the tree, so read them.

**Not to be confused with.** The second file beside it, `CLAUDE.md`. It carries the same pointer so that a tool which only looks for that filename still gets sent to the real instructions. In the BuildOS-owned folders it contains nothing else.

---

### run

One recorded attempt at doing something. It is a folder holding a summary, the raw material captured, and the rough notes. Once it is closed, you leave it alone. The folder is also called the run record.

**In practice.** No example ships. The runs folder in a fresh copy holds routers and nothing else.

**Where it lives.** `workspace/runs/RUN-NNN/`

---

### scoped metadata

The three list fields `systems`, `environments`, and `owners` that sit on artifacts. Every value must be an ID that exists in the configuration file.

> **Watch out.** The catch-all values `both`, `all`, `any`, and `default` are rejected, and so are the older field names `env`, `envs`, `for`, and `target_systems`. Write out the list.

---

### side artifact

An image, chart, or diagram pulled out of a source during conversion and stored beside the [converted twin](#converted-twin). It is not a record and it carries no ID.

**In practice.** You will see few of these. PDF conversion does not pull images out at all.

---

### slug

A lowercase, hyphenated version of a name, safe to use in a filename. `Lending Policies` becomes `lending-policies`.

---

### source

The original file, before anything touches it. It lives outside BuildOS and stays there.

---

### source anchor

The field on a record that holds an [anchor](#anchor) pointing back to the exact place in a [converted twin](#converted-twin) the record came from. It behaves like an entry in a bibliography.

**In practice.** It is what lets you answer "who said this, and where" months later, when the person who wrote it has left.

**Where it lives.** The `source_anchor` field, written as `<path-to-twin>#<anchor>`.

---

### state nature

Whether a [playbook](#playbook) needs a starting state and changes it (`stateful`), is safe to run at any time (`standing`), or is a rule rather than a run (`guardrail`). Spelled `state_nature` in the file.

---

### system

A thing you are studying: a product, a platform, an application. Named once in the configuration file, then referenced by ID.

**Not to be confused with.** Two things. It does not mean BuildOS itself, which trips people up in the playbook folder names. And it is not an [environment](#environment): the system is the type of thing, the environment is one running copy of it.

**Where it lives.** The `systems` list in `.os/config/instance.yaml`.

---

### task

The smallest line in a [backlog](#backlog): one checkbox item under a stage.

---

### terminal ID

The ID you arrive at after following every [redirect](#redirect) in the chain. It is the record that is current.

---

### test case

A record of a repeatable check: what it verifies, what has to be true before it starts, its steps, and the expected outcome.

---

### wave

One full pass around design, plan, and work. Written `w{W}` in a folder name.

**In practice.** Treat the numbering as coordinates for where a piece of work sits in the sequence. The words are loose on purpose, and you can rename them.

---

### work item

One unit of work in a [backlog](#backlog). Which level of the file that means depends on where you export to, so say which level you mean.

---

## Words your agent will hand back to you

None of the four below is BuildOS vocabulary. Your agent will write them into a generated document anyway, and each has brought a competent reader to a halt. When a generated word means nothing to you, ask the agent what it means in that document, then write the answer down.

### owned IDs

A column header an agent may put on a generated table. When it appeared, it held capability IDs.

The name is misleading: they would better be called capability IDs. There is no such thing in BuildOS. An agent naming a column is not the system naming a thing, and both arrive in the same document.

### hydration rules

A section heading an agent invented for a rule about keeping BuildOS's own example records out of counts of your product.

The heading is not shipped vocabulary, though the problem behind it is: three example records ship in the data files, and they describe BuildOS itself rather than anything you are studying. Delete or relabel them before you add your own. See [Keep the record clean](11-keep-the-record-clean.md).

### plan-mode plan

Some agent tools have a mode where they describe an approach and wait for you rather than acting. The proposal they produce is a plan in the tool's sense.

A [plan](#plan) in BuildOS is a folder of documents on disk. The two collide often enough that saying which one you mean is worth the extra three words.

### index versus overview

The overview is the document you read. The [index](#index) is the file your agent uses to find things quickly. If you are wondering which of the two to open, open the overview.

---

## What you should have now

- A definition for every BuildOS word used in this set.
- The three badly named things, and what each really means: `administrative`, `runnable_playbooks`, owned IDs.
- The pairs people mix up: convert and extraction, system and environment, capability and requirement, playbook and script, the two `assets` folders, the two meanings of harness.
- A habit for the next unexplained word: ask the agent, then write the answer here.

## Next

[Guides and stakeholder material](21-guides-and-stakeholder-material.md), which turns what you proved into something for the people who will use it.
