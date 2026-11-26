# Build the work backlog

This page turns your requirements set and your plan into work items a delivery team can pick up.

## What you need first

Read [Designs, plans and PRDs](12-designs-plans-and-prds.md) first. This page assumes it.

You need an active requirements set in `docs/prd/` and a plan directory in `docs/plans/`. The backlog is generated from the two together.

## What the backlog is, and how it differs from the plan

A **work backlog** is a directory of phase files. Each phase holds stages, and each stage holds checkbox tasks with acceptance criteria.

The plan and the backlog look similar and people confuse them constantly. A useful way to hold the difference: **the plan is the charter, and the backlog has a lot of phases that simply do not exist in the plan.**

Make that concrete. A plan phase might read "build the renewal fine recalculation in the library lending system, validate it against the business platform underneath, then release it to every branch." That is one line of a charter, and nobody can start work from it on Monday morning.

The backlog takes that line and produces phases the plan never named: a data migration phase, a test-fixture phase, a permissions phase for the tester's role, a phase for the reporting change nobody thought about until the fine calculation moved. Where the plan gives you the shape of the work, the backlog gives you the work itself.

Audience is the other way to hold the difference. A plan is written for people who need to agree that the shape is right, and a backlog is written for whoever picks up the next task, human or otherwise. That is why the plan's entry point is called an overview and the backlog's is called an index. You read one and you search the other.

## Where it lives

```
docs/work/YYYY-MM-DD-w{W}-r{R}-<slug>/
├── 00-index.md
├── 01-<phase>.md
├── 02-<phase>.md
└── ...
```

`w{W}-r{R}` is the wave and revision coordinate from [Designs, plans and PRDs](12-designs-plans-and-prds.md), which backlogs carry and requirements sets and designs do not.

`00-index.md` holds three sections: `## Purpose`, `## Phase Map`, `## Usage Notes`. The phase map is a table linking each phase file with one line about it.

Each `0N-<phase>.md` file holds `## Purpose`, `## Overview`, `## Source PRD Docs`, and then one or more `## Stage N - Name` sections. Every phase file must carry `## Source PRD Docs`, linking back to the requirements documents it implements, which is the link that keeps the backlog traceable.

Order the phases by dependency rather than by whatever is convenient to build first.

When you are adding to a requirements set that is already in use rather than building a whole set, leave the earlier backlog alone and write a dated delta backlog with a distinguishing slug, such as `2026-03-02-w2-r0-renewal-fine-recalculation-delta`.

## The shape of a work item

Inside each stage:

```markdown
## Stage 2 - Recalculate charge at return

### Tasks

- [ ] t4: Add a recalculation step to the return handler
- [ ] t5: Write the superseded charge line rather than overwriting the original

### Acceptance criteria

- Returning a contract early produces a new charge line and leaves the original visible
- The invoice total matches the recalculated charge on the same day the return is recorded

### Dependencies

- Stage 1 complete
```

The rules that govern that block:

- Tasks are Markdown task-list items with a phase-local ID: `- [ ] t1:` for open work, `- [x] t1:` for done.
- Task IDs start at `t1` in each phase file and keep counting across every stage in that file. Do not restart the numbering in a later stage.
- Never renumber an existing task ID, even when you insert or complete work around it.
- Acceptance criteria are always plain bullets, with no checkboxes and no `t` labels.

Because the IDs are phase-local, a single task has a full address anywhere in the system: `w2 r0 p2 t4`. That is how something outside the backlog points at one specific piece of work.

Adopt one extra convention and prefix every task that carries a capability with its capability ID. It keeps the backlog searchable when you come back to it in three months and want to know where `CAP-042` ended up.

A good work item has a task line that names an outcome and acceptance criteria that could be handed to the tester without further explanation. Every dependency it has appears under `### Dependencies`.

> **Watch out.** Agents skip the checkbox convention. Plain bullets instead of `- [ ] t1:` will import as tasks that nothing can tick off and that nothing can address by ID. Open one phase file and look at the raw Markdown before you accept the backlog.

## The hierarchy, and how it maps to a work tracker

Four levels, and they line up with what most work trackers expect.

| BuildOS level | Where it lives | Typical tracker level |
| --- | --- | --- |
| The work directory | `docs/work/YYYY-MM-DD-w{W}-r{R}-<slug>/` | Epic |
| A phase file | `0N-<phase>.md` | Feature |
| A stage | `## Stage N - Name` | Product backlog item |
| A task | `- [ ] t1: ...` | Task |

That mapping is the reason the folder structure looks the way it does. Treat `docs/` as a document-based version of a work tracker. The directory is the epic, the files in it are the features, the stages inside each file are the backlog items, and the tasks are what somebody does to deliver each one.

The export covered in [Export to a work tracker](14-export-to-a-work-tracker.md) emits the first three levels by default and holds the fourth in reserve.

## Building it

1. **Commit first.** This is a large write and you want a clean point to return to.
2. Make sure the plan directory exists for the requirements documents you are about to work from. The backlog is generated from the requirements set **and** the plan together.
3. Ask your agent to generate the work backlog from both. Name the requirements documents and name the plan directory.
4. **State the completeness constraint out loud.** Include a sentence like "do not leave any of the existing capability records orphaned." Leave it out and records go missing without anything reporting it.
5. Say you want the capability ID prefixed on every capability-bearing task. That prefix is what lets you search the backlog months later and find where a given capability ended up.
6. Read one phase file when it comes back. It should carry its prerequisites, the capabilities it owns, and who the work is for.

`.make-docs/system/prompts/` holds prompt starters for this step: `prd-to-work-full-prd.prompt.md` for a whole set, `prd-to-work-prd-feature.prompt.md` for one feature, and `prd-change-to-work.prompt.md` for a delta backlog against an active set. The templates are `.make-docs/system/templates/work-index.md` and `.make-docs/system/templates/work-phase.md`. Both are starting shapes. The authority is `.make-docs/system/contracts/output-contract.md`, in the section `## Work Phase Structure Rules`.

> **Not available yet.** Nothing in this article is automated. `docs/work/` ships empty apart from its router files, no command generates a backlog, and no validator checks one. This is you and your agent writing Markdown against a written contract. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

> **Watch out.** BuildOS's own governance leaks into your backlog. A generated task may read "confirm the operating register, the BuildOS traceability guardrails", which has nothing to do with the product being built. Delete tasks about BuildOS from a backlog about your product.

> **Watch out.** Test coverage will be thinner than the backlog implies. If relatively little test discovery has been done, the test tasks will overstate the evidence behind them. You can back-fill test cases later, but do not read a confident-looking test phase as proof that anyone examined the testing.

## Where the writing goes wrong

A generated backlog arrives structurally correct well before the wording is any good. Expect the same in your own output.

Two defects turn up repeatedly.

**Titles and descriptions that restate the task ID instead of the outcome.** A generated backlog item may carry a description that only says to deliver a numbered task as the source backlog bounds it, which forces the reader to go and find the source backlog to learn what the item is. A description that points at another document has not yet said what the work is.

**Traceability boilerplate where a description belongs.** A use-case field reading "Must remain traceable to the approved BuildOS task" records governance instead of content, and leaves the item hung up on governance rather than explaining the work.

Titles fail the same way. They come back long, carrying phase and task coordinates that belong in a trace field, and sometimes carrying an abbreviation the agent invented, such as `PRC`, that nobody can decode.

One rule covers all of this. **The title, the description and the acceptance criteria must all refer to the same outcome.** If the title says one thing, the description points at another document, and the acceptance criteria describe a third thing, nobody can work from the item however well-formed it is.

Nothing checks this. No validator, script or contract rule can, because it is a judgement about meaning that belongs to you and your agent. Fixing it is cheap, and you do it by prompt rather than by hand. Ask for shorter titles that lose the structural noise, and ask for descriptions that explain the work rather than trace it.

Prefer a qualitative instruction to a hard character limit. "These need to be short, because the detail belongs in the item, not the title" works better than "120 characters", because occasionally an item genuinely needs the room.

> **Watch out.** If the backlog is organised wrong for its audience, ask for a rewrite. Do not reorganise it by hand. Work for two different platforms interleaved across every phase makes a platform-by-platform roadmap impossible to present, and a backlog that size is too many phases to restructure manually without introducing errors.

## Archiving finished work

When a backlog is done, the intent is to move it out of the working tree, optionally along with its plan and design, so the tree shows only what is in flight.

> **Not available yet.** There is no command for this. Make Docs keeps archives under `.make-docs/archive/`, which it creates only when something is archived (`make-docs project surface ensure archive`), and its output contract says never to archive designs, plans, or work unless you ask. It writes down the rules for archiving a replaced requirements set, but no archive structure for finished backlogs. If you want it, describe the structure you want to your agent and check what it did. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

Whatever you do, do not solve this with a `backup/` folder inside the repository. That trap and the correct archive path are covered in [Designs, plans and PRDs](12-designs-plans-and-prds.md).

## What you should have now

- A work directory at `docs/work/YYYY-MM-DD-w{W}-r{R}-<slug>/` holding `00-index.md` and one file per phase
- Phase files that each carry `## Source PRD Docs` linking back to the requirements set
- Stages containing `- [ ] t1:` style tasks, numbered per phase file and never restarted, with plain-bullet acceptance criteria beside them
- A backlog you have read, in which every item's title, description and acceptance criteria describe the same outcome
- No tasks about BuildOS itself in a backlog about your product

## Next

[Export to a work tracker](14-export-to-a-work-tracker.md) turns this directory into a file your delivery team's tracker can import.
