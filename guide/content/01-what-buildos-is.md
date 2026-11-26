# What BuildOS is

## Before you start

This is the first real article of the set, so it assumes you have never heard of BuildOS. You do not need the repository, an agent, or any software installed to read it. If you want the mechanism rather than the idea, go to [How it works](02-how-it-works.md).

## What BuildOS is for

Someone hands you a system and asks you to work out what should be built.

The system might be a product your company has bought, or a platform you are being asked to replace. It might be an application nobody has documented in five years. With it comes a pile of documents. There is usually a requirements workbook, an architecture deck, a vendor feature list, some meeting recaps, and a spreadsheet somebody exported last quarter. Parts of it are current and parts of it are wrong, and nobody can tell you which parts are which.

What you owe at the end is a work backlog, meaning a list of items an engineering team can pick up and build.

The distance between those two points is mostly reading, and the reading repeats one shape. First you work out what the system claims it can do, then what it must do. You check which claims are true. Everything you checked gets recorded, so nobody checks it twice. What survives becomes requirements, and the requirements become work.

Most teams do this in documents, spreadsheets and chat threads. The information is real, but it has no fixed shape. Only a person can read it back, and only a person who was in the room. Six weeks later, answering a simple question means another week of reading, because the answer lives in somebody's memory. BuildOS gives that work a fixed shape instead.

## What BuildOS is

BuildOS is a folder of plain text files you copy into your own project. It gives a team a fixed place to put things and a fixed set of rules for what each thing must look like, so that a person or an AI agent can work in it without being told the conventions.

The folder that BuildOS puts in your project holds 163 files, and 95 of them are Markdown. The rest are 20 YAML files, 17 JSON files, 10 line-oriented JSON data files, four CSV examples, eight short command wrappers (one form for macOS and Linux and one for Windows), a small wrapper helper and its message file, five helper scripts that belong to skills, and two housekeeping files. It lives in git alongside your project. One npm package, `build-os`, carries it and the `buildos` command.

This documentation uses three words constantly:

- An **LLM** is a language model: a stateless thing that turns text into text.
- An **agent harness** is the software wrapped around a model that gives it tools, a working directory and a loop.
- An **agent** is the two together, working on your files.

This documentation never assumes you use a particular harness. BuildOS reads its instructions from files on disk, and any capable harness can follow them. Agents from different products can be pointed at the same BuildOS repository without anything in it changing to accommodate them.

Every folder in BuildOS carries a short instruction file saying what belongs there, what does not, and where to go next. Harnesses load those files on their own. That is why you can point an agent at the folder, give it a plain instruction, and watch it do the right thing without being told the layout. [How it works](02-how-it-works.md) explains that mechanism.

Two descriptions help: a system in a folder that steers an agent, and an analyst who has already been told where to put things.

## What BuildOS is not

**BuildOS is not a model.** This is the most common mistake. The folder contains no model and no intelligence of its own. It is text that instructs whatever model you bring. Without an agent, it is a filing system with rules.

**There is no service behind it.** You do not sign into anything, and there is nothing to connect to. The tools that ship with it make no network calls, and conversion for most file types runs entirely on your machine.

> [!NOTE] NOTE
> While BuildOS can convert several common file types including PDF's, it cannot convert PDF files that contain complex tables or are scanned images wrapped in a PDF format.  Therefore, when converting PDF's, BuildOS first attempts a basic conversion with its built-in tools and, if it fails, a second attempt is made by handing the file to your agent to read and convert.

**It is not a test framework.** BuildOS does produce repeatable tests, and browser automation is one of the things a playbook can ask an agent to do. But testing is one part of one of three flows, and most of the system has nothing to do with it.

**Nothing in it runs as an application.** No file in the folder starts a process, opens a port, or needs a running daemon. There is no database and no user interface. The data layer is deliberately plain text, so you can script against it, import it elsewhere, or read it with your own tools.

## What a full pass produces

Each step contributes one thing, in this order:

1. Source documents become clean text copies that record where they came from.
2. Structured records come out of those copies: the capabilities the system claims, the requirements the business has, and the people who use it.
3. The two systems get compared, producing a gap list with a verdict on each row.
4. Those verdicts become a set of numbered requirement documents.
5. A review of that set produces a remediation list, which you work through.
6. A **plan bundle**, meaning a directory of planning documents settling what gets built, in what order, and by whom, is written from the remediated set.
7. The plan becomes a work backlog with phases, stages and tasks.
8. The backlog is exported and imported into your work tracker as a correct three-level tree.

A pile of unstructured documents becomes tracked work items, with every step of the chain between them written down.

Only step 1 is fully tooled. The rest is a person and an agent following written rules. Step 3, the comparison, has no artifact type or command of its own, so a person and an agent produce it by reading the records BuildOS holds. [Compare two systems](10-compare-two-systems.md) covers that gap where you will hit it.

## What you get out of it

At the end of a full pass you have, in git:

- Clean text copies of your source documents, each stamped with its origin, a content hash, what converted it, and when.
- Structured records for the things you learned, such as capabilities, requirements, personas and test cases, each with a stable ID.
- A written record of every check you ran against the live system, with its evidence attached.
- The observations that survived a repeatable test, kept separate from the ones that did not.
- Designs, plans, requirement documents and a work backlog, in fixed shapes.

What pays for the setup is being able to ask an ordinary question six weeks later, such as *do we have anything about this topic in our requirements?*, and get the answer out of the files instead of out of somebody's memory.

## Who it is for, and when it is worth it

BuildOS suits a consultant, product manager, business analyst or engineer who has been handed a system and a document pile and owes somebody a backlog. It assumes you are comfortable with git and a text editor, and that you have an agent harness you are allowed to use on the material.

It is worth the setup when the work will outlive the working session, when more than one person needs the same answers, or when you will have to defend a conclusion later.

It is not worth it for a one-off question you can answer in an afternoon. Before you convert your first document you have to get an agent onto your machine, install Node.js, set up BuildOS in your project, and configure the instance. [Before you start](03-before-you-start.md) and [Install and configure your instance](04-install-and-configure-your-instance.md) cover all of that.

## How finished this is

Of the 163 files that ship, most are rules and instruction, and the tooling is thinner. In a freshly set-up project, two hops run end to end with a command: configuring the instance and converting a source document. One `buildos` command does the deterministic work: converting, indexing, recording runs and findings, promoting a finding to a design, entity checks, and validation.

Most of what this documentation describes is you and your agent following written rules rather than running a program. The rules are what keep the output consistent, and an agent picks them up from the files rather than from your prompt. Each article says which steps are tooled and which are not.

> **Not available yet.** Several steps the method depends on have no tool behind them today: writing extracted records, comparing two systems, moving a playbook through its review gate, and everything from the design onward. Each is flagged where you meet it. [What is not built yet](18-what-is-not-built-yet.md) has the full list in one place.

Read that article before you commit a team to this, though not before the rest of this set.

## What you should have now

- A one-sentence answer to "what is BuildOS" that you could give a colleague.
- Four things it is not: a model, a service, a test framework, an application.
- A concrete idea of the output: converted sources, structured records, findings, and a work backlog you can import into a tracker.
- A clear sense of how much is tooled today, and where to find the full gap list.

## Next

[How it works](02-how-it-works.md), covering the three flows, the artifact types, the two gates, and the mechanism that makes an agent orient itself.
