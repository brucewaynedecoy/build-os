# Designs, plans and PRDs

This page takes you from "we know what is missing" to a set of documents an engineering team can build from.

## What you need first

Read [Compare two systems](10-compare-two-systems.md) first. This page assumes it.

You need a project that BuildOS and Make Docs set up, material already brought in, and your agent harness pointed at the project folder. **Your agent harness** is the tool your AI agent runs inside. BuildOS keeps its instructions in plain files on disk, so any capable harness can read them.

You also need time. The runs in this article are long. A requirements set can take most of an hour, and a full plan-and-backlog run can take most of a day.

## The chain

Three documents, in this order.

- A **design** is a dated document that records one decision: what was chosen, what else was considered, and what follows from it. A design says **what we are going to do** about a gap.
- A **plan** is a directory of documents written before work starts. It settles the shape of the output and who does what. A plan says **how the work is sequenced**.
- A **PRD** is a product requirements document. In BuildOS it is a numbered set of documents describing the product, and there is one active set at a time. The set says **what the thing must actually do**.

After those three comes the work backlog, which is [Build the work backlog](13-build-the-work-backlog.md).

Each document points back at the one before it. A plan links its design. A requirements document carries a source-anchors section pointing at the material it came from. That back-pointing is what makes the chain useful. Six months later, someone can ask why a requirement says what it says and follow the links to an answer.

Here is where each one lands.

| Document | Directory | Filename shape |
| --- | --- | --- |
| Design | `docs/designs/` | `YYYY-MM-DD-<slug>.md` |
| Plan | `docs/plans/` | `YYYY-MM-DD-w{W}-r{R}-<slug>/` (a directory) |
| Requirements set | `docs/prd/` | `NN-<slug>.md` |
| Work backlog | `docs/work/` | `YYYY-MM-DD-w{W}-r{R}-<slug>/` (a directory) |

`w{W}-r{R}` is a numbering scheme for where a piece of work sits in the sequence. "Coordinates" below defines it. You do not need it yet.

## There is no tooling in this article

> **Not available yet.** Except for one command described below, nothing in this article is automated. You and your agent write these documents by hand, against written contracts and templates that ship with the system. `docs/designs/`, `docs/plans/`, `docs/prd/` and `docs/work/` all ship empty apart from their router files. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

A full requirements set and a working plan can be produced this way, against the contracts. There is no validator for any of it.

## The design

### What it is and when you write one

A design records one decision, dated, with the alternatives you rejected and what happens if nobody does the work. A feature list or a specification is a different document.

Write one when you know something is missing or wrong and you have decided what to do about it. That decision might come from a comparison you ran in [Compare two systems](10-compare-two-systems.md), or from a proven gap, or from a conversation where a subject-matter expert said the current behaviour is wrong and you agreed.

All three are legitimate starting points.

### Where it lives and what it looks like

A design is one Markdown file at `docs/designs/YYYY-MM-DD-<slug>.md`. The date is today, never backdated. The slug is lowercase with hyphens.

Designs do not carry wave numbers. Plans and backlogs do. The reason is in `.make-docs/system/references/wave-model.md`: a design is an input to a wave, not a product of one, and numbering it would imply one design maps to one plan and one backlog, which often is not true.

Make Docs 2.0.9 keeps its rule files in your project under `.make-docs/system/`: contracts in `contracts/`, references in `references/`, templates in `templates/`, and prompt starters in `prompts/`. Your agent can also read any of them with `make-docs resource read`, for example `make-docs resource read make-docs://system/contract/design-contract.md`.

The rules for a design are in `.make-docs/system/contracts/design-contract.md`, and the starting shape is `.make-docs/system/templates/design.md`. The template starts with a frontmatter block (the `---` header with `title`, `kind`, `status`, and a `follow_on` group for the hand-off to planning), then has eight sections:

- `## Purpose`
- `## Context`
- `## Human Experience Intent`
- `## Performance Evidence Candidates`
- `## Decision`
- `## Alternatives Considered`
- `## Consequences`
- `## Intended Follow-On`

The contract requires seven of them. `## Performance Evidence Candidates` is a short table that the template fills in only when the design has a performance question; leave the row as "none" when it does not.

`## Intended Follow-On` carries the hand-off to planning, which is what makes it the section people most often get wrong. The contract asks for four labelled lines inside it:

- `Route:` takes `baseline-plan` for a fresh build, or `change-plan` for a change to an active requirements set.
- `Next Prompt:` takes a link to the matching prompt starter. Pair `designs-to-plan.prompt.md` with `baseline-plan`, and `designs-to-plan-change.prompt.md` with `change-plan`. The template also names the prompt by its stable address, such as `make-docs://system/prompt/designs-to-plan.prompt.md`, which `make-docs resource read` opens from anywhere.
- `Why:` takes one sentence explaining why that route is the right one.
- `Coordinate Handoff:` takes the earlier position in the sequence, where the work continues earlier work. If the coordinate cannot be worked out, the contract says to write `Coordinate Handoff: unresolved; planner must resolve before writing.`

> **Watch out.** The contract requires that the `Next Prompt` link resolves. Open it after the design is written. A link to `.make-docs/system/prompts/<file>` written relative to `docs/designs/` starts with `../../`.

There is one optional section, `## Design Lineage`, for when a new design materially changes what an earlier design said. It records whether you updated the old document or wrote a related new one, links the earlier designs, and says why.

### A worked example

Suppose you have compared a community library's book-lending system against the general-purpose business platform underneath it, and you have established that renewing a loan does not recalculate the fine. You decide to add a recalculation step at renewal.

You write `docs/designs/2026-03-02-renewal-fine-recalculation.md`. Under `## Decision` you say you will recalculate at renewal and hold the original fine as a superseded line rather than overwrite it. Under `## Alternatives Considered` you say you rejected a nightly correction job and you say why: it leaves the patron with a wrong fine for up to a day. Under `## Consequences` you say that without this, every renewal is manually corrected at the circulation desk. Under `## Intended Follow-On` you write `Route: change-plan`, because the requirements set already exists and this changes it.

That is a complete design, and it fits on a page.

> **Watch out.** A well-formed design is not the same as a good design. A design can come back with every required section present and nothing inside them, because the input did not actually contain a decision. An agent gets the structure right long before it gets the content right. Read what came back before you build on it.

### Promotion from a finding

BuildOS has one command in this whole chapter. It turns a **qualified finding**, meaning an observation that passed a repeatable test and earned an ID as described in [Qualify what you found](09-qualify-what-you-found.md), into a dated design:

```
.os/scripts/buildos design promote finding --finding-id <FIND-NNN> --route baseline-plan
```

It reads the finding, writes one dated design into `docs/designs/`, and records the design path back on the finding. It does not draft a plan, and it only runs when a person runs it.

Two facts about that command need saying plainly.

> **Watch out.** The command needs Make Docs. It reads the Make Docs design workflow, contract, template, and prompt from the project, and in a project that Make Docs 2.0.9 set up it writes the design in the Make Docs 2.0.9 form. In a project without Make Docs (you answered No in `buildos init`), it stops with exit code 3 and says what is missing. When Make Docs can still be set up there, it also shows the setup command; when it cannot (a folder with an `AGENTS.md` or `CLAUDE.md` that Make Docs did not write), it says so and shows none. Use `--dry-run` first to see what it would write.

This hop is the one automated step in the planning half of BuildOS, and in practice designs are written by prompt instead. You describe the problem to your agent, or paste raw text into a file and ask the agent to turn it into a design, or point the agent at the analysis and the converted source material and ask for a design from that.

Both routes end up with the same document, because the shape comes from the contract and the template rather than from the tool.

If you have a qualified finding and Make Docs in the project, promote it. Otherwise write the design by prompt. No syntax rules apply, because you are writing prose into a Markdown file and your agent applies the contract. Point your agent at the Make Docs prompt `request-to-design.prompt.md` (in `.make-docs/system/prompts/` in a project that Make Docs 2.0.9 set up) as a starting shape.

> **Watch out.** Feeding an unqualified observation to a design produces an empty document with perfect structure. Before you ask for a design, be able to say in one sentence what you have decided to do. If you cannot say it, go back to [Qualify what you found](09-qualify-what-you-found.md) first.

## The plan

### What it is and what it holds

A plan is written before the work starts. It settles the order, the dependencies, and who owns which piece.

A plan is always a directory, never a single file. It lives at `docs/plans/YYYY-MM-DD-w{W}-r{R}-<slug>/` and holds:

- `00-overview.md`, the entry point, carrying the scope statement and the links back to everything
- `0N-<phase>.md`, one file per phase

The overview's sections come from `.make-docs/system/templates/plan-overview.md`: `## Purpose`, `## Objective`, `## Human Experience Propagation`, `## Performance Evidence Plan`, `## Coordinate Decision`, `## Phase Map`, `## Dependencies`, `## Validation`, `## Intended Follow-On`, and `## Change History`.

`.make-docs/system/references/planning-workflow.md` lists what a plan has to settle: the document tree it will produce, whether execution replaces an existing set or evolves it, the validation pass, and where the backlog will land. Leave any of those open and the plan is not finished.

### Coordinates

The `w{W}-r{R}` in the directory name is BuildOS's numbering scheme.

A **wave** is one full loop from design to plan to work. A **revision** is a redo inside that wave. A **phase** is a chunk of work inside a plan or a backlog. Written together they read `w1-r0-p3`.

Think of it as coordinates. The agent needs to know where this piece of work sits in the sequence of events, and it applies the answer well once you give it. The notation itself is only a convention, so if your organisation already numbers work differently, use your own names and be consistent.

Plans and backlogs carry wave numbering. Requirements sets and designs are exempt from it.

### Writing one

1. Tell your agent to generate a plan from the design. Name the design file.
2. Give it coordinates. Say which wave and revision this is, or say what it continues.
3. Say whether this is a fresh build or a change to something that already exists. The distinction matters and the agent honours it. Three templates exist for three real starting points: `plan-prd.md` for a new idea or design, `plan-prd-decompose.md` for reverse-engineering an existing codebase into a fresh set, and `plan-prd-change.md` for a change inside an active set.
4. Read the plan before anything is written. The workflow reference tells the agent to present the plan first and write only after you approve it.
5. Approve the write. Approving the plan is not the same as approving execution, and the workflow separates those two questions deliberately. If you only say yes to the plan, you should get a saved plan and a stop.

> **Watch out.** The word "plan" collides with the planning mode built into many agent harnesses. Once real plan documents exist in `docs/plans/`, "write a plan" becomes ambiguous and your agent may answer you instead of acting. The working habit that solved it is to name the mode explicitly, saying "plan mode" when you mean the harness feature and "a plan document" when you mean the file. If the agent replies with a description and asks "does this look good?", it has not written anything yet.

> **Watch out.** These runs are long and they will outlast your meeting. A plan for a small piece of work can take several minutes. A full plan-and-backlog run can take most of a day. Kick one off well ahead of the discussion where you want to talk about the result.

### A worked example

Continuing the renewal decision, you ask for a change plan and you give it coordinates: wave 2, revision 0.

You get `docs/plans/2026-03-02-w2-r0-renewal-fine-recalculation/` holding `00-overview.md` and three phase files. The overview's `## Coordinate Decision` says `Coordinate: W2 R0`, `Classification: new-wave`, and gives the evidence for that choice. `## Phase Map` is a table of the three phase files with a line each. `## Dependencies` names the fine calculation work that has to land first. `## Validation` says the plan is complete when the owning requirements documents say what renewal now does and the delta backlog exists.

> **Watch out.** A generated plan will happily open a brand-new wave directory for what is actually a correction to work you already planned. Send it back. A correction belongs inside the existing plan directory as a revision. Nothing enforces this, so you have to catch it yourself.

> **Watch out.** The agent invents column names. A generated plan can use a heading such as "Owned IDs" that stops a reader cold and turns out to mean capability IDs. When a heading in generated output does not mean anything to you, ask what it means before you accept the document. Usually it is a fresh name for something you already had a name for.

## Requirements documents

### The set shape

There is one active requirements set at a time. It lives flat in `docs/prd/` as `NN-<slug>.md` files.

The set has a **fixed core** that is always the same five documents, and an **adaptive middle** that grows with the product.

| Number | File | What it is for |
| --- | --- | --- |
| `00` | `00-index.md` | The map. Reading order, a document map, and the paths for different audiences. |
| `01` | `01-product-overview.md` | Users, key capabilities, system boundaries, current limitations. |
| `02` | `02-architecture-overview.md` | Topology, module map, runtime boundaries, data flow, configuration surfaces. |
| `03` | `03-open-questions-and-risk-register.md` | The living register: confirmed drift, open questions, rebuild risks. |
| `04` | `04-glossary.md` | The vocabulary of the product being described. |
| `05`–`99` | your own | Subsystem documents and reference documents, each named for a part of the product. |

Numbers `05` through `99` are yours. Keep the tree flat by default: the `NN-` numbers carry the reading order, and a flat directory shows all of them in one listing. Move a subsystem into a numbered subfolder only when one document is genuinely too big to read.

People miss the risk register at `03`, which is where gaps, open questions and decisions all live. Items are numbered `D-001` for confirmed drift, `Q-001` for open questions and `R-001` for rebuild risks, each with a status of `Open`, `Confirming`, `Deferred` or `Closed`. You never renumber an item, even when it closes. Use that register rather than creating a separate questions file or decisions file next to it.

### Why the documents are short

Every requirements document is deliberately thin, and every one carries a `## Source Anchors` section pointing outward at the material it came from.

The reason is practical. The set is meant to be the authority on what the product is, but it also has to fit in an agent's working memory. Keeping each document lean means the agent can hold it in context and pull the exact reference out of another document when its attention lands there. A dense, self-contained specification would defeat that.

A human reader gets the same benefit a bibliography gives, with short claims and the evidence one link away.

### Generating the set

1. Commit first. Everything about to happen is a large write.
2. Tell your agent to generate the requirements set from the accumulated material, meaning the extracted records, the designs, and the plan if you have one.
3. Watch it work, and interrupt if you need to. Interrupting halfway through to ask it to call out what is already implemented works.
4. Spot-check the result before you build anything on it. Open the glossary first to see whether the vocabulary was captured at all, then open one substantive document and read one table row carefully. Read [The review sweep](15-working-with-your-agent.md#the-review-sweep) in [Working with your agent](15-working-with-your-agent.md) before you start this step.

### A worked example

For the library lending system, the adaptive middle might open with `05-loans-and-renewals.md`, `06-copy-availability.md`, `07-fines-and-payments.md`. Each uses `.make-docs/system/templates/prd-subsystem.md` and so carries `## Purpose`, `## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, `## Rebuild Notes`, an optional `## Requirement History`, and `## Source Anchors`.

Then the renewal decision arrives. `07-fines-and-payments.md` owns fines, so its current text changes to say that renewal recalculates the fine, and a dated entry under its `## Requirement History` keeps what it said before. No new document is named for the change.

The next section describes this properly.

## You can work in either order

The canonical order is design, then plan, then requirements set.

Running it the other way round is sometimes the right call. If a substantial body of capability records already exists from earlier extraction work, generating a plan first would orphan them, so the requirements set comes first and the plans are derived from it.

Deriving a plan from an existing requirements set is a supported case. The `plan-prd-decompose.md` template exists for exactly this shape of work.

Use these criteria to choose.

**Go design → plan → requirements set when** you are starting from a decision and little else, or the product is new, or the material you have is thin. The design gives the plan its scope and the plan gives the requirements set its structure.

**Go requirements set → plan when** you already hold a substantial body of extracted records that a fresh start would strand, or the product already exists and you are documenting what is there before you change it. State the completeness constraint out loud when you ask, along the lines of "do not leave any of the existing capability records unaccounted for", because that is the sentence that stops records being silently dropped.

Either way, the ordering is your judgement call. Nothing in BuildOS checks the order you worked in.

## Changing a set that is already in use

Once other people are working from a requirements set, editing it casually breaks things. Somebody is reading document `07` while you edit it, and a backlog task points at a row you are about to delete.

Make Docs 2.0.9 has one rule for this, in `.make-docs/system/references/prd-change-management.md`: `docs/prd/` describes the current shape of the product, and never the editing operation that changed it. So a change goes into the document that owns the subject, and the old wording is kept in that document's history.

### The rules

From `.make-docs/system/references/prd-change-management.md`:

- Give every candidate change one decision: `update-existing` (a document already owns the subject: change its current text), `create` (a new part of the product with no owner yet: a new numbered document named for that part), `link-only` (the text is right, but a link or the index needs a pointer), or `none` (the set already covers it: record why in the plan or a history record).
- Put the current requirement in the owning section. A reader must not have to follow a history link to learn what the product requires now.
- Keep the text, anchors, and links that the change does not touch. Do not renumber documents.
- Never name a document for an editing action. Names such as `08-revise-renewal-fines.md` or "Addition: ..." are not allowed.
- When the old requirement matters for later readers, add a dated entry under `## Requirement History` in the same document, after the current sections and before `## Source Anchors`. Each entry records the date, the coordinate, the affected section, the previous contract, the replacement contract, the reason, and a source link.
- Update `03-open-questions-and-risk-register.md` directly for anything the change discovered or resolved.

### Where superseded sets go

When you replace a whole set rather than evolve it, the old set moves to `.make-docs/archive/prds/YYYY-MM-DD/`. If that dated directory already exists, add a zero-padded increment: `.make-docs/archive/prds/YYYY-MM-DD-01/`. The `.make-docs/archive/` folder does not exist until something is archived; Make Docs creates it (`make-docs project surface ensure archive`), and its own router there holds the archive rules.

The archive rules also say the agent must summarise the existing set and ask for your explicit approval before moving anything. Give that approval consciously.

> **Watch out.** Do not copy the old set into a `backup/` folder inside the repository, however natural the instinct feels. A sibling `backup/` directory silently breaks the one-active-set rule, and your agent will search it and reason over dead documents. Archive the set to the path above, or delete it and recover it from git.

### Deciding what an incoming document is

One more judgement call lives here. When a subject-matter expert hands you a requirements document, you have to decide whether it is new source material for extraction or a change request against what you already know.

Routing such a document to the change-management side is often right, because planning against the existing set beats minting a pile of new requirements from it.

> **Watch out.** No router, contract or tool makes this decision for you. It is a human judgement and it is written down nowhere in the shipped system. Make it consciously and say which choice you made, because the two paths produce very different work.

## The templates and the prompt starters

Everything above is governed by files that ship with the system. Knowing where they are makes the rest of the chapter usable.

**The authority** is in `.make-docs/system/contracts/` (rules) and `.make-docs/system/references/` (workflows). The ones that matter here:

- `contracts/design-contract.md` and `references/design-workflow.md`, the design's required shape and how to write it
- `references/planning-workflow.md`, what a plan must settle before it is finished
- `contracts/output-contract.md`, the requirements tree, the fixed core, the section contracts, and the required paths
- `references/prd-change-management.md`, the change rules above
- `references/wave-model.md`, what wave, revision and phase mean

**The starting shapes** live in `.make-docs/system/templates/`. Nineteen templates ship, plus the folder's router files. The ones this article uses: `design.md`, `plan-overview.md`, `plan-prd.md`, `plan-prd-decompose.md`, `plan-prd-change.md`, `prd-index.md`, `prd-overview.md`, `prd-architecture.md`, `prd-risk-register.md`, `prd-glossary.md`, `prd-subsystem.md`, `prd-reference.md`.

**The prompt starters** live in `.make-docs/system/prompts/`. Twenty ship, plus the folder's router files. The ones this article uses: `request-to-design.prompt.md`, `designs-to-plan.prompt.md`, `designs-to-plan-change.prompt.md`, `plan-to-prd-green-field.prompt.md`, `plan-to-prd-change.prompt.md`.

Be clear about the difference in authority. Prompts are optional starters rather than authority. A template is a convenience in the same way. **A contract is the rule book for one document type: what sections are required and what states the document can be in.** When a template and a contract disagree, the contract wins. And when your organisation genuinely does not want a section, change the convention. The repository belongs to you.

> **Watch out.** These files name each other by their path from your project root, such as `.make-docs/system/references/wave-model.md`, or by a `make-docs://` address. A path from the project root is correct as written. Do not edit these files to fix a link: Make Docs manages them.

## Reviewing what came back

Everything in this article is generated prose. Expect it to come back structurally right and substantively wrong, with errors that run through the whole set rather than sitting in one place.

The sweep described in [Compare two systems](10-compare-two-systems.md) starts from a single contradictory row in a generated requirements set, which is the same material this article produces.

The full review procedure is the section called *The review sweep* in [Working with your agent](15-working-with-your-agent.md#the-review-sweep). Read it before you accept a generated set.

## What you should have now

- A dated design at `docs/designs/YYYY-MM-DD-<slug>.md` with its frontmatter and every required section, including a route in `## Intended Follow-On`
- A plan directory at `docs/plans/YYYY-MM-DD-w{W}-r{R}-<slug>/` holding `00-overview.md` and one file per phase
- An active requirements set in `docs/prd/` with the five fixed-core documents present and numbered correctly
- A decision, made consciously, about which order you worked in and why
- A way to change the set later in the document that owns each subject, with its history kept, and a place to put a set you replace
- Knowledge of which of the above is tooled (one command, `buildos design promote finding`, which needs Make Docs) and which is you and your agent writing against contracts (all the rest)

## Next

[Build the work backlog](13-build-the-work-backlog.md) turns the requirements set and the plan into work items a delivery team can pick up.
