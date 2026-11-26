# Start here

## What BuildOS is

BuildOS is a folder of plain text files that you copy into your own project and keep in source control. It gives a team a fixed place to put things and a fixed set of rules for what each thing has to look like. The rules sit in files next to the work, so an AI agent can read them and follow the project's conventions without being told them. You use it to take a system you have been handed, work out what it actually does, compare that against what it needs to do, and end up with a work backlog an engineering team can build from.

## Who this documentation is for

This documentation is for you if you have been handed a system to evaluate, a pile of documents about it, and a deadline to produce a backlog.

It assumes you know nothing about BuildOS. It does not assume you are an engineer. Where an article needs you to have read another one first, it says so in its opening lines.

## How to read it

Readers arrive here for different reasons, so there is more than one sensible route.

To decide whether BuildOS is worth your time, give it twenty minutes. Read [What BuildOS is](01-what-buildos-is.md), then skim [A worked walkthrough](19-a-worked-walkthrough.md). That article works the whole chain through from start to finish, rough steps included.

If you are about to start using it, read [What BuildOS is](01-what-buildos-is.md), [How it works](02-how-it-works.md), [Before you start](03-before-you-start.md) and [Install and configure your instance](04-install-and-configure-your-instance.md) in order, then do the setup before reading further. The last two exist because setup is where most of the delay happens, and almost none of it is BuildOS itself.

Read [Working with your agent](15-working-with-your-agent.md) before you ask an agent to generate anything. It carries the procedure for checking what an agent produced. [Pull knowledge out of it](07-pull-knowledge-out-of-it.md), [Compare two systems](10-compare-two-systems.md) and [Designs, plans and PRDs](12-designs-plans-and-prds.md) all send you there, and reading the set in order puts it eight articles after your first extraction, which is too late to be useful.

If you are already set up and have a job in front of you, find that job in the table below.

When something breaks, go to [When things go wrong](17-when-things-go-wrong.md). It is arranged for lookup. Find the symptom you are seeing, and it points at the likely causes.

When a word makes no sense, check [Glossary](20-glossary.md). It covers all 73 BuildOS terms in plain language, alphabetically. Where a term is badly named, the entry warns you.

## The articles

### Understand it

| | Article | What it gives you |
| --- | --- | --- |
| 01 | [What BuildOS is](01-what-buildos-is.md) | What it is, what it produces, and whether it is worth the setup. |
| 02 | [How it works](02-how-it-works.md) | The three flows, the pieces that move through them, and the two gates. |

### Set it up

| | Article | What it gives you |
| --- | --- | --- |
| 03 | [Before you start](03-before-you-start.md) | What has to be in place on your machine and in your organization first. None of it is BuildOS itself, and any missing piece will block you. |
| 04 | [Install and configure your instance](04-install-and-configure-your-instance.md) | Setting up BuildOS in your project with one command, plus one configuration file that describes your own project. |

### Get material in

| | Article | What it gives you |
| --- | --- | --- |
| 05 | [Bring in source material](05-bring-in-source-material.md) | Turn a document you already have into clean text, with a record of where it came from. |
| 06 | [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) | What to do about email, slide decks, recordings, and diagram-heavy PDFs. |
| 07 | [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) | Turn that text into typed records: requirements, capabilities, personas, test cases. |

### Find out what is true

| | Article | What it gives you |
| --- | --- | --- |
| 08 | [Write and run a playbook](08-write-and-run-a-playbook.md) | Write the instruction that sends a person or an agent to go look, then run it and keep the evidence. |
| 09 | [Qualify what you found](09-qualify-what-you-found.md) | Turn something you noticed into something you can prove, and keep proving. |
| 10 | [Compare two systems](10-compare-two-systems.md) | Line up what one system does against what another needs, and audit the result. |
| 11 | [Keep the record clean](11-keep-the-record-clean.md) | Why your records fill with duplicates, and what to do about them instead of deleting. |

### Turn it into work

| | Article | What it gives you |
| --- | --- | --- |
| 12 | [Designs, plans and PRDs](12-designs-plans-and-prds.md) | Turning a list of gaps into documents an engineering team can build from. |
| 13 | [Build the work backlog](13-build-the-work-backlog.md) | Requirements and a plan become work items someone can pick up. |
| 14 | [Export to a work tracker](14-export-to-a-work-tracker.md) | Turning the backlog into a file your project-tracking tool can import, with the hierarchy preserved. |

### Working with an agent

| | Article | What it gives you |
| --- | --- | --- |
| 15 | [Working with your agent](15-working-with-your-agent.md) | What to hand an agent, how to steer it, and how to check the result. |
| 16 | [Harness independence and trust](16-harness-independence-and-trust.md) | Why BuildOS does not depend on a particular agent product, and who you should share the project with. |

### Reference

| | Article | What it gives you |
| --- | --- | --- |
| 17 | [When things go wrong](17-when-things-go-wrong.md) | A lookup article, organized by symptom. |
| 18 | [What is not built yet](18-what-is-not-built-yet.md) | The complete register of what the shipped system does not do today. |
| 19 | [A worked walkthrough](19-a-worked-walkthrough.md) | The whole chain, from first source document to imported backlog. |
| 20 | [Glossary](20-glossary.md) | Every BuildOS term, alphabetical, in plain language. |
| 21 | [Guides and stakeholder material](21-guides-and-stakeholder-material.md) | Optional. What to produce for the people who will use or fund the work. |

## Before you begin

[What is not built yet](18-what-is-not-built-yet.md) collects everything that's still a work-in-progress in one place. Read it early if you are deciding whether to adopt BuildOS.

However, the system works and the chain does complete. [A worked walkthrough](19-a-worked-walkthrough.md) follows it end to end, from the first source document through to work items imported into a tracker with a three-level hierarchy intact.

**No part of this documentation requires a particular AI product.** BuildOS keeps its instructions in plain files, so any capable agent can follow them. Throughout the documentation you will read "your agent" or "the agent harness" instead of a product name. Two people on the same project can use different tools without changing anything in the project, and [Harness independence and trust](16-harness-independence-and-trust.md) explains why that works and where the limits are.

## What you should have now

- A sense of what BuildOS is and what it produces
- A reading path that fits why you are here
- Two expectations set: some steps are not automated yet, and no particular AI tool is required

## Next

[What BuildOS is](01-what-buildos-is.md)
