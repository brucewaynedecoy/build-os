# Guides and stakeholder material

This article is optional. Nothing earlier in the documentation depends on it, and you can run the whole BuildOS chain without ever writing a word of what follows.

It covers what you can do after the work backlog exists: turning proven work into something for the people who will use the system, and something for the people who will fund it.

## What you need first

You need a finished work backlog, or at least one converted source and something you have proved. Read [Build the work backlog](13-build-the-work-backlog.md) if you have not produced a backlog yet.

## Guides for the people who will use the system

A **guide** is current-state documentation aimed at a reader who has to do something. Make Docs 2.0.9 separates two built-in audiences (it calls them Personas) and keeps them in separate directories:

- `docs/assets/user/` holds guides for people or agents who use what the project ships.
- `docs/assets/maintainer/` holds guides for contributors, maintainers, integrators, and operators.

A project can configure more audiences in `.make-docs/config.yaml`; each one gets its own `docs/assets/<persona-slug>/` folder.

Three files in the documentation layer govern this:

| File | What it is for |
| --- | --- |
| `.make-docs/system/contracts/guide-contract.md` | The rules. Required frontmatter, audience rules, and the coverage decision. |
| `.make-docs/system/templates/guide-user.md` | The section skeleton for a user guide. |
| `.make-docs/system/templates/guide-maintainer.md` | The same, for a maintainer guide. |

A **contract** is the rule book for one kind of file. It says what fields that file must have and what states it can be in, and it wins over templates and over routing files. You do not have to read the guide contract yourself. Your agent does, and it will follow it.

There is also a starting prompt at `.make-docs/system/prompts/work-to-guides.prompt.md`. A prompt starter is a convenience rather than an authority. Use it or write your own.

### How to produce one

1. Point your agent at a converted source, or at the completed phases of your work backlog.
2. Ask it to propose which durable document to write, rather than telling it. A good agent will propose a user guide, say why it rejected the alternatives, and confirm it has written nothing yet and is waiting for approval.
3. Approve, or redirect.
4. It creates the audience directory if it does not exist, and writes the file.

That third step is the review gate in miniature. A proposal costs one paragraph and the document costs a great deal more, so the cheap moment is where the decision belongs.

> **Not available yet.** `docs/assets/user/` and `docs/assets/maintainer/` do not exist until you create them. The router says to create them only when the first guide is written, so the first guide you write also creates its directory. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

### What makes a good one

The contract is specific about this, and the advice generalises.

- **Write the current state.** A guide is not a phase log, a release note, or a summary of what was implemented. Use the plan, the PRD and the backlog as evidence, then write about what the reader needs to do next.
- **Decide coverage before you write.** For each thing worth documenting, the verdict is one of `create`, `update-existing`, `link-only`, or `none`, and the audience (`user` or `maintainer`) is chosen separately. Updating a guide that already owns a topic is usually better than adding a new file next to it.
- **Start with the shortest path to a first success**, then go deeper. The user template puts orientation and a first working outcome before advanced usage on purpose.
- **Give it prerequisites, expected results, and troubleshooting.** Without those, a reader who cannot tell whether a step worked has nowhere to go.
- **Say what is not covered yet.** The contract provides a `## Future Coverage` section for exactly this, with what it is blocked by and when to update it. Use it instead of inventing a placeholder document to remember the work.

> **Watch out.** Phrase every instruction so it cannot be read as a command to perform. A plan item reading "customer walkthrough" was interpreted by a later agent as an instruction to walk a customer through something, when what was wanted was a written walkthrough for customers. Say "write a walkthrough for X", not "do the X walkthrough".

The intended future version of this, described but never built, is to prove a requirement with a run that captures screenshots, then let those screenshots flow into the guide.

> **Not available yet.** Nothing connects run evidence to guide generation, and the run directory starts empty, so there are no captured screenshots to use. Illustrate guides by hand for now. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

## Stakeholder material

The people who fund the work will not open a work directory, so somebody has to explain the plan to them.

BuildOS has no artifact type for this, and nothing else either: no template, contract, prompt starter or directory. The shipped documentation flow ends at guides. What follows is improvised work with an ordinary prompt.

An ordinary prompt can produce a slide deck covering every phase of a plan, built from the same PRD and work backlog that produced the backlog export, with no skill written for the task.

### How to do it

1. **Say who the audience is.** Naming the audience is what carries the run without any tooling. Say it in the prompt, in plain words.
2. **Remove the ambiguity from your own prompt before you send it.** Two ambiguities had to be taken out of the first draft. A reference to a review workflow would have been read as an instruction to put those references into the deck. And "explain our backlog" could mean explain how the backlog is structured, explain the product, or explain the plan. It meant the plan.
3. **State the constraint.** In this case: stay non-technical.
4. **Name what it must land.** What are the phases, and what capabilities does each phase address.
5. **Name the output path.** Skip this and the file lands in a cloud folder nobody chose.
6. **Review it and fix the layout by hand.** Expect it to come out cosmetically broken in places.
7. **Keep the prompt.** You will reuse it long after this particular file is obsolete.

The person who ran it uses the structure the deck suggests rather than the deck itself. Treat the output as a draft outline that happens to be in slide form.

> **Watch out.** The agent installed a software package on its own in order to write the file. That is your agent tool's behaviour, not BuildOS. Know your organisation's position on agents installing software before you start, rather than while you are explaining it afterwards.

## Reframing your own material is a review technique

This technique tends to be discovered by accident.

Reviewing a generated deck for slide quality is how you notice that the plan puts security and access work before the personas exist. Weeks of reading the plan itself will not surface that, and the summary surfaces it immediately.

The reason is straightforward. A plan written for the team is read by people who already carry the context, and a missing piece of context is invisible to them. Rewriting the same material for an audience that has none forces every assumption into the open. Ordering problems, missing prerequisites and unstated dependencies are the defects most likely to survive a normal read and fail a plain-language summary.

So use it deliberately:

- After a plan or a PRD set is written, have your agent summarise it for an audience that has never seen it. Name that audience.
- Read the summary looking for what is wrong with the plan, not for what is wrong with the summary.
- Anything you find is a finding about the plan. Write it down where it belongs, either as a design input or as a change to the plan, before the conversation moves on.

That last step is the one that gets skipped. A defect is spotted, discussed, agreed, and never written anywhere. Nothing in BuildOS captures an observation made out loud, so an observation that stays in the conversation is lost.

## Pointing the method at a different engagement

BuildOS is a folder you copy. Reusing the method on a different client, product, or question means copying the tree and editing `.os/config/instance.yaml` for the new subject. Nothing else is required and nothing automates it.

One piece of advice matters most here. Establish the baseline first. Bring in whatever documentation already exists about the *existing* system, then add the new material, so the difference between them can be worked out rather than assumed. Expect it to take several passes.

> **Watch out.** Most of what a new engagement offers you cannot be read directly. Videos, slide decks, screen recordings and wikis are not supported source types, and a link is not a source because there is no network access. See [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) before you promise anyone that their material can go in. Do not promise automatic de-duplication of what arrives, because the shipped system does not do it.

## What you should have now

- The three files that govern guides, and where user and maintainer guides live.
- A repeatable way to ask for a guide: propose, approve, write.
- A working prompt shape for stakeholder material: audience, constraint, what it must land, and where to save it.
- One deliberate review technique: summarise your plan for outsiders, then read the summary for defects in the plan.
- A habit of writing down what that review finds, in a file, the same day.

## Next

Go back to [Start here](00-start-here.md) for the full map, or pick whichever chapter your next task belongs to.
