# A worked walkthrough

You can read this article on its own, before or after the rest of the set.

This page follows one project the whole way: a pile of documents at one end, a work backlog inside a work tracker at the other. Seventeen hops, in order, with the file that moves at each one.

## What you need first

You need nothing installed to read this. If you want to follow along in your own project, you need Node.js 24 or newer, a project folder, and an agent that can open it. [Before you start](03-before-you-start.md) covers all three.

Two things up front, so the article below reads cleanly:

- An **agent harness** is the software wrapped around a language model that gives it tools, a working directory and a loop. An **agent** is the two together, working on your files. This documentation never assumes a particular one.
- A **contract** is a Markdown file in `.os/contracts/` that states what one kind of artifact must look like. Contracts are the authority. Ten of them ship.

Every other term is defined in one line where it first appears, and properly in the chapter that owns it. [Glossary](20-glossary.md) has all of them.

## The situation

A team is handed a community library's book-lending system. It runs on top of a general-purpose business platform, and it has been customized. With it comes a pile of documents: a requirements workbook, an architecture deck, a vendor feature list, several meeting recaps and a spreadsheet. The team also has sign-in access to a running instance, and a deadline.

What they owe at the end is a work backlog that an engineering team can pick up, sitting inside the work tracker the organization already uses.

That is what the seventeen hops below do. The chain completes end to end, finishing with a hierarchical backlog imported into a work tracker.

## The whole chain in one table

| # | Hop | What comes out of it | Tooled? | Covered in |
| --- | --- | --- | --- | --- |
| 1 | Get the project and an agent | A project folder on your machine, Node.js 24, and an agent that can open it | No | [Before you start](03-before-you-start.md) |
| 2 | Set up BuildOS | `buildos init` done, `.os/scripts/buildos version` working | Yes | [Install and configure your instance](04-install-and-configure-your-instance.md) |
| 3 | Configure the instance | `.os/config/instance.yaml`, validated | Yes | [Install and configure your instance](04-install-and-configure-your-instance.md) |
| 4 | Convert your sources | `assets/<source-slug>/<asset-slug>.<ext>` | Yes, six formats | [Bring in source material](05-bring-in-source-material.md), [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) |
| 5 | Index what you have | `.os/indexes/references.json` | Yes | [Bring in source material](05-bring-in-source-material.md) |
| 6 | Extract structured records | `EXT-NNN` rows plus `REQ` / `CAP` / `PER` / `TC` rows in `.os/data/` | **No** | [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) |
| 7 | Consolidate duplicates | `redirect` objects and a reviewed manifest | Partly | [Keep the record clean](11-keep-the-record-clean.md) |
| 8 | Build the yardstick and compare | Capability models and a comparison table with verdicts | **Outside BuildOS** | [Compare two systems](10-compare-two-systems.md) |
| 9 | Author and activate a playbook | `playbooks/<category>/<slug>.md` with `status: active` | **No** | [Write and run a playbook](08-write-and-run-a-playbook.md) |
| 10 | Run it and record the run | `workspace/runs/RUN-NNN/` | Yes, once hop 9 is done | [Write and run a playbook](08-write-and-run-a-playbook.md) |
| 11 | Qualify a finding | `workspace/findings/FIND-NNN/` | Yes, once hop 10 is done | [Qualify what you found](09-qualify-what-you-found.md) |
| 12 | Promote to a design | `docs/designs/YYYY-MM-DD-<slug>.md` | Tooled, needs Make Docs | [Designs, plans and PRDs](12-designs-plans-and-prds.md) |
| 13 | Plan | `docs/plans/YYYY-MM-DD-w{W}-r{R}-<slug>/` | **No** | [Designs, plans and PRDs](12-designs-plans-and-prds.md) |
| 14 | PRD | `docs/prd/NN-<slug>.md` | **No** | [Designs, plans and PRDs](12-designs-plans-and-prds.md) |
| 15 | Work backlog | `docs/work/YYYY-MM-DD-w{W}-r{R}-<slug>/` | **No** | [Build the work backlog](13-build-the-work-backlog.md) |
| 16 | Export | A hierarchical import CSV | **Outside BuildOS** | [Export to a work tracker](14-export-to-a-work-tracker.md) |
| 17 | Import and verify | Work items in the tracker, three levels deep | Manual, by design | [Export to a work tracker](14-export-to-a-work-tracker.md) |

Those rows group into four hard breaks. Each one is named below at the point you reach it, rather than collected at the end.

---

## 1. Get the project and an agent

Nothing lands in BuildOS at this hop. You end it with two things: a project folder holding the BuildOS files, and an agent tool that can open that folder and write files in it.

Make the project folder and put it under git. Sharing that repository across an organization boundary is the step most likely to stall.

> **Watch out.** An enterprise chat licence is not a coding-agent licence. Confirm what your employer actually licenses before you plan around it. Some agent tools also accept prompts and quietly do nothing until an acceptance agreement is signed, with no error shown.

Keep the project outside a synced cloud folder. [Before you start](03-before-you-start.md) has the access and sharing traps in full.

**Hand-off to the next hop:** the project folder. Every path from here is relative to its root.

## 2. Set up BuildOS

BuildOS is one npm package. In the project folder, your agent runs:

```sh
npx -y build-os@0.2.0 init
```

It stops first with exit code `10` and one question for you: set up Make Docs too? Answer it on purpose, because with the tested Make Docs version a No cannot be undone later in this folder, and the planning hops (12 onwards) use Make Docs. Your agent then runs the one command `buildos init` printed for your answer. BuildOS adds `.os/`, `assets/`, `playbooks/`, `workspace/`, and its section of `AGENTS.md`, `CLAUDE.md`, and `.gitignore`; with Make Docs you also get `docs/`.

Check it:

```sh
.os/scripts/buildos version
```

It prints the version that `.os/manifest.json` pins, and exits 0. On Windows, use `.os\scripts\buildos.cmd`.

> **Watch out.** Use `.os/scripts/buildos <domain>` in everything you write down. The old names `buildos-intake`, `buildos-discovery`, and `buildos-design` still work but stop working in BuildOS `0.3.0`.

**Hand-off to the next hop:** a set-up project and a working `.os/scripts/buildos`.

## 3. Configure the instance

An **instance** is one deployment of BuildOS, with its own configuration file. This is the one place your instance names its real world, and it is one of the few hops in the chain that runs end to end with a command on a fresh copy.

Open `.os/config/instance.yaml`. Fill in four collections:

- `systems[]` names the products or platforms you are studying. Treat a system as a *type* rather than a deployment. Here that is the library lending system, and the business platform under it.
- `environments[]` names the actual deployments. Each one names which systems it belongs to. A team might settle on a baseline vendor environment and one configured sandbox.
- `owners[]` names teams, organizations or vendors, each with a `kind`.
- `defaults` says which of the above apply when an artifact does not say.

IDs are lowercase with hyphens. Then run:

```
.os/scripts/buildos validate
```

Success prints `OK. No problems found.` and exits 0.

> **Watch out.** The shipped `instance.yaml` is the unmodified neutral template. Its example IDs are `primary-system`, `baseline`, `customized`, `adopter-team` and `platform-owner`. If you forget to edit it, the validator passes cleanly against fake IDs and everything downstream quietly scopes itself to a system that does not exist. Edit it before you convert anything.

Every scoped artifact from here on carries three list fields, `systems`, `environments` and `owners`, and every value in them must resolve to an ID in this file. [Install and configure your instance](04-install-and-configure-your-instance.md) has the schema and the validator's full rule set.

**Hand-off to the next hop:** a validated `instance.yaml`. The IDs in it are the vocabulary every later artifact uses.

## 4. Convert your sources

A **converted source**, or twin, is a clean text copy of an original file carrying a header that records where it came from, its checksum, what converted it and when. That header is the provenance, and it is the reason a claim made six weeks from now can be traced back.

Run one source at a time:

```
.os/scripts/buildos intake convert --source "<path>"
```

Add `--dry-run` first. It doubles the wall time and finds the problem before the tool commits anything. Exit code 0 means the conversion is clean.

Output lands in `assets/<source-slug>/<asset-slug>.<ext>`. Spreadsheets produce one CSV per worksheet. Word documents and HTML produce Markdown. PDFs produce plain text. Images and diagrams pulled out of a source land beside the twin as side artifacts.

The team's pile converted cleanly for the requirements workbook, the vendor feature list and the HTML documentation. The architecture deck and the meeting recordings did not.

> **Watch out.** PDF conversion is deliberately minimal: plain text only, no OCR, no table reconstruction, no layout. Presentation decks, email and audio have no converter at all. [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) covers the hand path, which is a shipped, active playbook: PB-003, twelve steps.

> **Watch out.** Attaching a file to an agent chat is not intake. It produces a record with the wrong source name and no provenance, and the work has to be redone. Save the file where the tool can reach it, then convert it.

**Hand-off to the next hop:** a directory of twins under `assets/`, each with a provenance header. Everything after this reads the twins, not the originals.

## 5. Index what you have

An **index** is a generated lookup file. It is never the source of truth, and you can delete and rebuild it at any time.

```
.os/scripts/buildos intake index references
```

This reads the frontmatter of every twin under `assets/` and writes `.os/indexes/references.json`. It answers "have we already converted this?" without opening files.

> **Not available yet.** `references.json` does not exist in the shipped tree, and rebuilding it against an empty `assets/` produces `{"version": 1, "references": null}`. It only becomes useful after hop 4 has run for real. Contracts, routers and guides all refer to the file as though it were present. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

**Hand-off to the next hop:** a catalog of what you hold. It tells you what to extract from.

## 6. Extract structured records

This is where the tooling stops.

An **extraction** is a record saying: I read this piece of this twin, and these records came out of it. An **entity record** is one line of JSON in `.os/data/*.jsonl` describing one thing with a stable ID. Four types matter here. A **capability** is what a system can do. A **requirement** is what it must do. A **persona** is a kind of user, with goals and needs. A **test case** is a repeatable check.

The extraction row goes in `.os/data/extractions.jsonl` with an `EXT-NNN` ID, an anchor into the twin it read, and a `minted[]` list naming every record it created. The records go in `requirements.jsonl`, `capabilities.jsonl`, `personas.jsonl` and `test-cases.jsonl`.

> **Not available yet.** No extraction writer exists. No entity-record writer exists either. `extractions.jsonl` is an empty file and no shipped tool appends to it. Everything from here to hop 8 is you and your agent writing JSONL by hand against a contract the agent has read. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The contracts ship, the ID registry ships, and the validator ships, so the rules are enforceable even though nothing writes for you. What the team did was prompt the agent with the rules explicitly:

- Do not invent a loader.
- If a safe data file and a contract exist, propose exact rows for review.
- State for each output whether the workspace has deterministic tooling, or the step is manual.
- Read the contract.
- Proceed only with the outputs I approve.
- Cite the applicable contract.

The agent came back with a plan and a set of scoped options. It also reported, unprompted, that row writing is manual and gated because no tool does it. Then it proposed rows. A person approved them. They were appended.

Hundreds of rows can come out of a single pass. Nine ID prefixes are valid, those being `REQ`, `CAP`, `PER`, `TC`, `RES`, `RUN`, `FIND`, `EXT` and `PB`, and anything else the agent invents is wrong.

> **Watch out.** Statuses from the source system leak in. The entity status vocabulary is exactly `draft`, `active`, `superseded`, `archived`. `candidate` is a converted-source status only, and the validator rejects it on an entity row.

Run the validator again after each batch. It checks one JSON object per line, the ID prefix and format, the status, the source anchor, and that every scoped value resolves. [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) carries the prompt and the rules in full.

**Hand-off to the next hop:** rows. Every later hop counts them, which is something prose does not allow.

## 7. Consolidate duplicates

Two source documents describing the same thing produce two records. Folding them together is a separate, explicit step: you write a **consolidation manifest** listing which record folds into which, a person reviews it, and only then do you apply it. The losing record keeps its ID and gains a `redirect` pointing at the winner, so old references still resolve.

```
.os/scripts/buildos entities consolidate --root . --mode compat --manifest "<path>" --apply
.os/scripts/buildos entities rebuild-index --root . --mode strict --apply
```

> **Watch out.** A freshly set-up project fails strict validation, because `entity-resolution.json` has never been built, so `.os/scripts/buildos entities validate --root . --mode strict` exits 4. Run the `rebuild-index` command above once. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

Personas are the exception: they are the only entity type with an identity contract, so they are the only type with a deterministic way to decide that two records are the same person-shape. [Keep the record clean](11-keep-the-record-clean.md) covers both.

**Hand-off to the next hop:** one record per thing, and a redirect trail explaining every fold.

## 8. Build the yardstick and compare

The comparison is the outcome the team was hired to produce, and it went well. An agent working from the records produced a genuinely strong analysis. What is missing is the machinery.

> **Not available yet.** BuildOS has no comparison artifact, contract, command or vocabulary term, and no skill that guides the process. You run the analysis with your agent against the project's own files and write the result back yourself. Prompting covers the gap, without guaranteeing the same output shape from one run to the next. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The method is four steps.

1. Pick the sources for each side, and deliberately exclude sources belonging to a different version of the question.
2. Extract both sides into the same shape: a narrative capability model, a structured model, a capabilities table, a requirements table and a data dictionary.
3. Settle the taxonomy and the status vocabulary *before* extracting, because two products described in their own words cannot be lined up against each other.
4. Produce the delta as its own document, one row per capability, each carrying a verdict, the gap detail, mapped counterparts, evidence, confidence, effort and a migration note.

The verdicts used were `gap`, `partial gap`, `configurable`, `<system> only`, `preview gap` and `native`.

What made this run smoothly was hop 6. The comparison had clean structured rows on both sides, in one taxonomy, so it had very little to work out for itself. That is the return on the manual extraction work, and it arrives here.

The headline result is not the number of gaps. It is the ratio: a handful of true gaps against a large requirements set. The value of the exercise was proving with evidence that almost everything was *not* a gap.

> **Watch out.** Each of those gaps is a raw observation from reading documents, not a test against a running system. Under the finding contract, none of them qualifies as evidence yet. That is not a defect in the analysis. It is the bridge to the next three hops: the comparison tells you what to go and prove.

[Compare two systems](10-compare-two-systems.md) has the method and the traps.

**Hand-off to the next hop:** a shortlist of claims worth testing against the live system.

## 9. Author and activate a playbook

A **playbook** is a short Markdown file that tells a person or an agent how to do one job. It lives in `playbooks/<category>/`, and the directory name is the category: `administrative`, `build`, `discovery` or `testing`.

Copy one of the seven playbook shapes from `.os/templates/` into `playbooks/discovery/`, and write the steps for the thing you want proved.

Then comes the gate. A playbook ships as `draft`. The **review-to-activate gate** is a person reading it and moving it to `active`, and only `active` playbooks run. The reason is plain: the agent is about to drive a browser against a real system, and somebody should read the instructions first.

1. Open the playbook file.
2. Change `status` from `draft` to `active`. It is the sixth field in the frontmatter.
3. Rebuild the index:

```
.os/scripts/buildos intake index playbooks
```

It prints `wrote <path> (<n> playbooks)`.

> **Not available yet.** The review-to-activate gate has no tooling. Activation is a hand edit of the frontmatter plus an index rebuild, and no approval is recorded anywhere. On a stock checkout no discovery playbook is active, because the only one, PB-005, is a draft. The whole discovery half cannot be started until you do this by hand. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

> **Watch out.** Forgetting the index rebuild leaves the playbook active on disk and invisible to the run command. It gets skipped constantly. Also: an agent can flip the status for you, and it will if you let it. That defeats the gate. The point of the gate is that a person read the steps.

[Write and run a playbook](08-write-and-run-a-playbook.md) covers the shapes and the frontmatter.

**Hand-off to the next hop:** an active discovery playbook that appears in the `runnable_playbooks` list inside `.os/indexes/playbooks.json`.

## 10. Run it and record the run

A **run** is one recorded attempt at doing something. It is a folder, `RUN-NNN/`, holding a summary, the raw evidence and the rough notes. Once closed, you do not change it.

Two things are true at once here. The live browser work is external to BuildOS by design, with the agent driving a real signed-in browser through your harness. BuildOS records what happened:

```
.os/scripts/buildos discovery run discovery --playbook-id <PB-NNN> --outcome positive|negative|inconclusive --evidence "<path>" --raw-finding "<path>"
```

That writes `workspace/runs/RUN-NNN/` containing `run.md`, an `evidence/` directory and `raw-findings.md`, and appends one row to `.os/data/runs.jsonl`.

A **raw finding** is something you noticed that has not been proved. It has no ID. It lives as an anchor inside that run's `raw-findings.md`.

> **Watch out.** Nothing supplies the environment URL. The environment record in `instance.yaml` has no URL field, so a person pastes it in on every run. This was named as a gap early and is still open.

> **Watch out.** A blocked run is still a run. So is an inconclusive one. `inconclusive` means the run could not confirm the claim either way, which is a legitimate result with a stated reason rather than a failure to be deleted. Write down the signal you expect to see *before* the run starts, or you will read a step that quietly did nothing as a success.

**Hand-off to the next hop:** a run folder with frozen evidence, and one or more raw-finding anchors inside it.

## 11. Qualify a finding

A **qualified finding** is a raw finding that passed a repeatable test. It gets a `FIND-NNN` ID and its own folder. **Qualification** is the test itself. Intuition and a one-off observation do not qualify.

```
.os/scripts/buildos discovery qualify finding --run-id <RUN-NNN> --raw-finding-ref "<path#anchor>" --outcome positive|negative --confirmation-test "<path>" --confirmation-evidence "<path>"
```

This writes `workspace/findings/FIND-NNN/` with `finding.md` and `qualification.md`, and appends a `status: "qualified"` row to `findings.jsonl`. The qualification file records the test type, the procedure, the assertion, the result, which must be `pass`, and the evidence.

The discipline behind it: for everything you manually test that does not work or exposes a gap, write a script that reliably and repeatably proves that gap. It also proves when the gap is fixed.

> **Watch out.** Nothing generates the confirmation test for you. And the shipped tool is stricter than the contract it implements: the contract accepts any deterministic method, and the tool requires a browser test file.

> **Watch out.** Some real findings cannot be qualified at all. An important observation can be that the product assumes a branch structure the library does not have. No repeatable test proves that. It is still true and it still needs recording somewhere, though not as a finding under this contract.

[Qualify what you found](09-qualify-what-you-found.md) covers the gate and what to do with the observations that cannot pass it.

**Hand-off to the next hop:** findings with IDs, and tests anyone can run again.

## 12. Promote to a design

A **design** is a dated document recording one decision: what was chosen, what else was considered, and what follows. It ends with an `## Intended Follow-On` section naming the route to a plan.

```
.os/scripts/buildos design promote finding --finding-id <FIND-NNN> --route baseline-plan|change-plan
```

This is the only automated hop in the entire planning half, and the only place where the discovery half connects to the planning half through tooling.

> **Watch out.** This command needs Make Docs in the project; without it, it stops with exit code 3 and says why. In practice designs are mostly not produced this way. They are written by describing the concern to the agent and asking it to draft the design. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The prompt path is legitimate and it is what happened. It is also ungated, and it has a failure mode: feeding an unqualified observation to a design produces a document that is structurally perfect and substantively empty, because there was nothing proved to write about.

**Hand-off to the next hop:** a design in `docs/designs/`, with a named route.

## 13, 14, 15. Plan, PRD, work backlog

From here to the end of BuildOS, there are no commands. These three hops are documents written by your agent against contracts that ship as reference material and templates.

> **Not available yet.** Hops 13, 14 and 15 have no tooling of any kind. Make Docs keeps its templates and prompt starters under `.make-docs/system/`, and `docs/plans/`, `docs/prd/` and `docs/work/` all start empty apart from their router files. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

**A plan** is a directory of documents written before work starts. It settles the shape of the output and who does what. It lands at `docs/plans/YYYY-MM-DD-w{W}-r{R}-<slug>/` as `00-overview.md` plus one file per phase.

The `w{W}-r{R}` in that path is the wave model. A **wave** is one full design-plan-work loop, a **revision** is a redo inside that wave, and a **phase** is a chunk inside a plan or a backlog. Give the agent those coordinates explicitly, because it handles them well and it will invent them if you leave them out.

**A PRD** is the numbered set of documents that is the authority on what the product is. One active set at a time, at `docs/prd/NN-<slug>.md`. The fixed core is always `00-index.md`, `01-product-overview.md`, `02-architecture-overview.md`, `03-open-questions-and-risk-register.md` and `04-glossary.md`. Numbers `05` to `99` are yours.

A team may run the PRD *before* the plan, which inverts the canonical order, for a stated reason: many capabilities already exist from hop 6, and generating the plan first would orphan them. That is a supported case, and a decompose template exists for exactly it. One generation can produce a full baseline set in under an hour.

Then spot-check, which is the step worth copying.

Open the glossary first to see whether the vocabulary survived. Then open one substantive document and read one table row carefully. Look for a contradiction, such as two columns saying one system owns a capability while the evidence column says the other does. Refuse the one-row fix, on the grounds that patching a row you do not understand leaves you no wiser about how many more are wrong.

The sweep that follows will typically turn up dozens.

> **Watch out.** A defect in a generated document usually runs through the whole set. Never accept a one-row patch for a generated set. Ask for the class of error, then constrain the shape of the remediation: correct rows in place, add a revision section inside each document, and create no new plan bundle for a correction.

**A work backlog** is a directory of phase files at `docs/work/YYYY-MM-DD-w{W}-r{R}-<slug>/`. It holds `00-index.md` plus one file per phase. Each phase has stages, and each stage has checkbox tasks written as `- [ ] t1: ...` alongside plain-bullet acceptance criteria.

Generate it from the PRD *and* the plan together, and state the completeness constraint out loud. Say, in effect: do not leave any of the existing capabilities orphaned. Prefix every capability-bearing task with its capability ID, so the backlog stays searchable back to the row it came from.

Each phase that comes out should carry prerequisites, owned capabilities and persona assignments.

> **Watch out.** Agents skip the checkbox convention. Check for it. Also check that BuildOS's own governance language has not leaked into your product backlog. A task reading "confirm the operating register and the traceability guardrails" belongs to BuildOS rather than to a lending system.

> **Watch out.** Long runs outlast working sessions. A PRD generation can take most of an hour, a full plan-and-backlog run can take most of a day, and even a small plan takes minutes. Kick long runs off well ahead of the discussion where you want the result.

[Designs, plans and PRDs](12-designs-plans-and-prds.md) and [Build the work backlog](13-build-the-work-backlog.md) carry these three hops properly.

**Hand-off to the next hop:** `docs/work/<backlog>/`, with `00-index.md` and every phase file. That directory is the whole input to the export.

## 16. Export

The backlog is only useful when it reaches the tool the delivery team already uses.

> **A skill, not a command.** BuildOS has no export command. The exporter that produced the real CSV is the skill `buildos-export-azure-boards`, which `buildos init` copies into `.os/skills/`. [Export to a work tracker](14-export-to-a-work-tracker.md) shows how to run it.

One step that makes this work appears in no documentation: derive the format from the destination. Run a saved export query in your target tracker, open it, delete the columns you do not want, save it as CSV, and hand that file to the agent as the format specification. That is how the column template was produced.

Then run the exporter. It reads the work directory and every phase file, and it stops to ask before it writes: which backlog, which adapter, and any parameter the adapter needs.

> **Watch out.** Never let it guess a parameter. The adapter's own rule forbids inferring one from the project name, the repository, an example in the skill, or a previous export. When the answer would be inconsistent it refuses outright. It may hit several consecutive stop-and-ask gates, ending in a hard refusal. A first-time reader takes that refusal for a crash, when it is the rule doing its job.

The default mapping is work directory to Epic, phase file to Feature, stage to backlog item. The fourth level is reserved and not emitted. New items carry no ID, no state and no assigned user, because the tracker assigns those.

> **Watch out.** The hierarchy, the columns and the import were all correct on the first run, and the descriptions read as governance boilerplate rather than an explanation of the work. Review the titles and the prose before you import, and fix them by prompt rather than by hand.

**Hand-off to the next hop:** one hierarchical CSV.

## 17. Import and verify

A human does this, and that is deliberate. The exporter's own instruction is not to import or save work items without separate approval for that external change.

1. Find the import screen in your tracker. In some trackers it sits under a menu you would not guess, such as Queries.
2. Before importing, fill in what the export deliberately leaves blank: tags, states and the iteration path.
3. Import.
4. Search the work items and count them.
5. Open one epic and inspect its children.

Do not skip the last step. An import nobody opened has proved nothing.

Confirm the count, the three-level tree, and one epic spot-checked one level deep.

> **Watch out.** A wrong area path on a first import can need a tracker administrator to fix. Confirm which tracker and which project you are importing into before you build the export, not after.

**Hand-off:** none. That is the end of the chain.

---

## What the chain produces

Read hops 4, 6, 8, 13, 14, 15, 16 and 17 together and you have one complete traverse:

source documents → converted twins → extracted rows → a comparison → a numbered PRD set → a remediation pass → a plan bundle → a work backlog → work items in your own tracker.

All seventeen hops happened, and only hop 4 was tooled.

That is the shape of BuildOS today: thin tooling on top of fixed places and fixed rules. The comparison runs cleanly because the rows on both sides share one taxonomy. Every task in the backlog carries the capability ID of the row it came from, which is what keeps it traceable. And the remediation finds wrong rows because there is a defined shape to check them against.

The part of the chain that did not run end to end here is the discovery half, meaning hops 9 through 11 and the gated route into hop 12. The tooling for hops 10 and 11 exists and works, the gate in front of it does not, and nothing generates the confirmation test that hop 11 requires. If your value is in proving claims against a running system rather than reorganizing documents, read [Write and run a playbook](08-write-and-run-a-playbook.md) and [What is not built yet](18-what-is-not-built-yet.md) before you commit.

## What it costs

**What is fast.** Conversion is seconds to minutes per source. Configuration is one sitting. Index rebuilds are immediate. The export runs in minutes from the first question to a written CSV, and the import and verification take about as long again. Extraction produces hundreds of rows in a single pass, and a full PRD set generates in well under an hour.

**What is slow.** Long generations. A plan-and-backlog run can take most of a day. Review is slower than generation and cannot be skipped, and a remediation sweep takes a full working session after the spot-check that found it.

**Where a first-time team loses time.** Setup and access, rather than BuildOS itself. Between them they can consume most of several working sessions before any BuildOS work starts.

- Getting a coding agent onto a single laptop can take a whole session on its own.
- Sharing one repository across an organization boundary can fail outright, with an external party unable even to file the access request, because both request systems need a corporate laptop or a VPN.
- A toolchain install can be blocked mid-download by network security and have to be re-obtained through the employer's software portal.

**Giving the agent a real browser costs more than everything else put together.** Expect to lose time to a browser extension, a connector and a missing runtime, where a runtime that was never installed is a common root cause. A harness's built-in browser will not hold a login. A failed sign-in has two likely causes, the network blocking the agent's browser or the vendor blocking agent browsers from the application, and neither is easy to confirm.

If you are budgeting: assume the first week is access, licensing and installation, and assume the browser is its own project. The BuildOS work starts after that, and it runs at the speed of reading and review.

## What you should have now

- The seventeen hops in order, and which document covers each one.
- The four places the chain is broken: extraction, comparison, playbook activation, and the whole planning half.
- A concrete idea of what moves between hops, meaning twins, rows, findings, PRD documents, phase files and a CSV, and how each one becomes the input to the next.
- A realistic picture of what adoption costs, and where the time actually goes.

## Next

[Glossary](20-glossary.md), which defines every term used in this set.
