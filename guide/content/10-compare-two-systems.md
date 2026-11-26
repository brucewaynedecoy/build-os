# Compare two systems

This page shows you how to compare what one system does against what another system needs, and how to write down the difference so someone else can trust it.

## What you need first

Read [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) first. This page assumes it. [Qualify what you found](09-qualify-what-you-found.md) is useful here but not required.

You need converted source material for both systems, the records you pulled out of it, and an agent you can hold a long conversation with.

## What BuildOS contributes here

BuildOS holds the material for the comparison. The machinery for the comparison itself does not exist yet.

> **Not available yet.** The shipped system has no gap, delta or comparison artifact type, no contract that governs one, no command that produces one, and no directory that holds one. A person and an agent reading the project's own files can produce a strong comparison. Prompting covers this. What is missing is the machinery that would make the output shape the same every time. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The hard part of comparing two systems is getting material on both sides that is trustworthy, that covers the same ground, and that is shaped the same way. [Bring in source material](05-bring-in-source-material.md) through to [Qualify what you found](09-qualify-what-you-found.md) are what produce that. BuildOS supplies the material and the vocabulary, and the analysis is down to you and your agent.

The comparison can run in a different agent tool from the one that captured the material. Nothing has to be converted, re-recorded, or changed in the project, because the files are ordinary files. See [Harness independence and trust](16-harness-independence-and-trust.md).

## What a fit-gap analysis is

A **fit-gap analysis** compares what one system does against what another one needs, and writes down only the difference. The written difference is sometimes called a **delta document**.

A **gap** is something a system cannot do that somebody needs. It belongs to the wider industry vocabulary rather than to BuildOS. In BuildOS vocabulary a gap becomes either a finding, if you observed it, or a requirement, if somebody demands it.

Two things surprise people who have not done one before.

**The ratio carries more weight than the gap count.** A comparison covering a large requirements set may end with only a handful of true gaps. What matters to a sponsor is the other side of that arithmetic: with evidence attached to every row, almost everything else turns out *not* to be a gap.

**A capability done differently is still a capability.** A verdict list with only "gap" and "no gap" on it will report every difference in approach as a hole. The next sections show what to use instead.

## The method

The method has four steps:

1. Choose the sources for each side, and exclude the ones that answer a different question.
2. Settle the categories and the status words before you extract anything.
3. Extract both sides into the same shape.
4. Produce the difference as its own document, one row per capability.

Step three is one job done twice, once per system, so it gets two sections below. The sections that follow are numbered in the order you will work through them.

Then audit the result. That last part is required, and it gets its own section too.

## Step 1 · Choose the sources for each side

Write down, in one list, which documents describe each side. Do this before you prompt anything.

Two things go wrong here, and neither one announces itself.

> **Watch out.** Material about a system you are not comparing will contaminate the result. A leftover `backup/` folder of superseded documents will be read alongside the live ones, and a file belonging to BuildOS's own build layer will be read as project material. The agent cannot tell that a file is out of scope. Move stale material out of the tree before you start, and recover old versions from git rather than keeping them in a sibling folder.

> **Watch out.** Some vendor documents describe only what is new, not what the product already does. Extracting capability rows from a document like that will mint false gaps, because everything the base platform already handles is missing from the page. Customer records can look like a hole when they are a standard part of the platform underneath and simply were not written down again. Establish what the baseline surface is before you extract, and say so in writing.

Then state the boundary out loud, in the document itself. Something like: this comparison read these sources, it has not seen the vendor roadmap, and where it makes a claim about future releases it is inferring. Saying it out loud is easy, and writing it into the file is the half that gets skipped.

## Step 2 · Settle the categories and the status words

Two products described in their own vocabularies cannot be lined up row against row. So you fix the shared vocabulary first, before either side is extracted.

A good agent will ask you about this rather than start work. Answer the schema questions when it does.

Two decisions come out of this.

**Mirror the categories rather than blending them.** Pick one side's category list and make the other side use it. Do not invent a hybrid list that suits both. The reasoning is practical: the first side's work is already finished and nobody is going to re-categorise it, so a blended list produces categories that nothing on the finished side maps back to. In practice this lands on a short list of shared layers, each with a short code, carried by every row on both sides.

**Keep both status vocabularies, and define both.** The two sides will mean different things by status. One side may describe a design in progress with words like built, designed and sketched. The other may describe a shipping product with words like available, preview and planned. Leave them unreconciled. As long as both vocabularies are written down in a data dictionary next to the output, a reader can follow it, and you can reconcile later because the underlying data is still there.

A **data dictionary** is a short file that lists every column and every allowed value, in plain words. Write it at the same time as the comparison. Without one in front of them, readers guess at column meanings even when a dictionary was generated alongside the table.

> **Not available yet.** The shipped system has nowhere to record a category or layer. A capability record carries `description`, `supports[]` and `limits[]`, and no category field of any kind. The status vocabulary is fixed at four values, `draft`, `active`, `superseded` and `archived`, and `buildos validate` rejects anything else, so none of the status words above is legal in `.os/data/`. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The nearest real home is the optional `tags[]` field on an entity record. An **entity record** is one line of JSON in `.os/data/` describing one thing, with a stable ID. `.os/contracts/entity-records-contract.md` defines `tags` as lowercase slugs used for classification only, and says explicitly that they must not encode status. The validator does not check tag values against any list. If you want your layer codes to survive inside BuildOS, put them there, and keep the layer list in your data dictionary.

## Step 3 · Build the yardstick

The yardstick is the "what we need" side: one dense description of what the target system *should* do. You cannot find gaps without a definition of complete, and that definition has to come from somewhere other than the thing you are measuring.

Build it from a separate source set, in a fresh conversation.

1. Choose sources that describe what you *wanted*, not what you have. Historical backlogs, any specification you already wrote, and notes from sessions with a subject-matter expert.
2. Start a fresh conversation for this. A clean context stops the baseline material you have already loaded from leaking into the yardstick. It does not have to be outside the project.
3. Ask for a comprehensive, detailed breakdown of the capabilities and features that would make an ideal version of the target system, according to those documents.
4. Ask for structure as well as prose. The first pass will return a narrative. Ask for a structured version after that.
5. Keep both. The narrative explains the shape to a person, and the structured version is what the comparison consumes.
6. Bring the result back in as **one source**, using the procedure in [Bring in source material](05-bring-in-source-material.md).

Import the yardstick as one source rather than as hundreds of individual records. Summarising is right for the side you are measuring *against*. The material you already converted holds the real system's behaviour in full detail, and summarising that side as well would throw away the detail the comparison needs.

> **Watch out.** Ask an agent for a structured version and you will often get five formats back: prose, JSON, two flavours of CSV, and something nobody recognises. Decide up front which two you keep, normally the narrative and one structured file, and delete the rest before they get committed and confuse the next reader.

## Step 4 · Establish the baseline

The baseline is the "what we have" side. You have already built it, across [Bring in source material](05-bring-in-source-material.md) through to [Qualify what you found](09-qualify-what-you-found.md).

Your baseline comes from three places:

- The **capability** records in `.os/data/capabilities.jsonl`. A capability is a descriptive record: something the system *can* do. It may be true and it may be false, and proving it is what testing is for.
- The **requirement** records in `.os/data/requirements.jsonl`. A requirement is a normative record: something the system *must* do, that somebody is tracking. Ownership is the test, so anything nobody is tracking has not reached requirement status.
- The **converted twins** under `assets/`, which are the plain-text copies of your source documents, each carrying a header that records where it came from and what converted it.

Capabilities work as a spine, with requirements as a child table hanging off them. That framing works well when you explain the output to somebody.

If you have already tested against a live system, add what you proved. A **playbook** is a written procedure that tells a person or an agent how to do one job, step by step. A **qualified finding** is one that a playbook run proved by a repeatable test against a running system, rather than by reading a document. You will not have many of those rows, and they carry more weight than the rest. Mark them, because the difference matters when someone challenges a verdict.

> **Watch out.** Records that were never re-verified will quietly poison a comparison. A source document may be mid-rename, may contradict its own author's answer, or may itself have been generated by AI and never reviewed. The shipped state for this is `status: candidate` on the converted twin, which means the text is useful but a person should look at it before you trust it. Use it, and re-check any row extracted from a preview build before you put a verdict next to it.

> **Watch out.** A comparison built on a conversion that failed will look completely normal. The converter never falls back to a model, because it is a program with no model and no network connection. Any substitution happens above it. An agent asked to "bring in" a difficult file may read the file itself and write the text out by hand instead of running the converter, without being asked and without anything recording it. Open the twin's frontmatter and read the `converter` field before you rely on the file. It names whatever produced the text: the tool, or `manual-intake/1.0.0` when a person did the work. If the source is a PDF, a diagram export, or a slide deck, read [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) before you go any further.

## Step 5 · Produce the comparison

Ask for the difference as its own document, with one row per capability rather than as a summary.

The comparison is a table, so ask for it as a spreadsheet file: `.csv`, or `.xlsx` if you want frozen panes and filters already set. Two files travel with it. One is the narrative model you kept in step 3. The other is the data dictionary you wrote in step 2. Keep all three together.

Because BuildOS holds no comparison artifact type, as the callout at the top of this article says, it gives these three files no name and no home either. Choose one yourself and use it for every comparison you run.

A layout that works: make a directory at your project root, beside the BuildOS directories, and put all three files in it.

```
comparisons/2026-03-02-lending-system/
    comparison.csv
    narrative-model.md
    data-dictionary.md
```

Commit all three. Nothing in the BuildOS directories points at them, so version control is the only thing that ties them to the records they were built from.

Each row of the comparison carries:

| Field | What it holds |
| --- | --- |
| `capability` | The thing being compared, named from the shared category list |
| `verdict` | One value from your verdict list |
| `gap detail` | One or two sentences on what is actually different |
| `mapped counterparts` | The capability IDs on the other side that cover this, if any |
| `evidence` | Which source said so, precisely enough to find again |
| `confidence` | How sure the analysis is, and why |
| `effort` | A rough size for closing it |
| `other side status` | That side's own status word, from its own dictionary |
| `migration note` | What to do about it |

A verdict set that works: `native`, `configurable`, `partial gap`, `gap`, `preview gap`, and `<system> only` for something one side has that the other has no need of. A verdict set that wide is what keeps a difference in approach from being filed as a hole.

A short worked example, using a community library's book-lending system as the target and a general-purpose business platform as the other side. Every row is invented:

| Capability | Verdict | Gap detail | Evidence | Effort |
| --- | --- | --- | --- | --- |
| Patron record and contact details | `native` | Standard on the business platform. No lending-specific work. | Platform capability catalogue, § Contacts | none |
| Loan periods by item type | `configurable` | Supported through standard policy setup, no code. | Policy configuration guide, § Lending policies | small |
| Fine cap per loan | `partial gap` | Both sides charge fines. One caps the fine per loan, the other only per patron. | Lending overview § Fines; platform billing reference § Charges | medium |
| Copy transfer between branches | `gap` | No equivalent. Transfers exist for stock, not for individual book copies. | Lending overview § Branches; no counterpart found | large |
| Self-service renewal by text message | `preview gap` | Announced, not generally available. Treat as unavailable until proved. | Platform release notes, preview section | unknown |
| Interlibrary loan requests | `lending system only` | Library-specific. The business platform has no reason to carry it. | Lending overview § Interlibrary loans | none |

> **Watch out.** A raw count difference is not a verdict. If one side lists three times as many capabilities as the other, that is usually a documentation difference, not a capability difference. The larger surface is usually larger because that side documents its configuration options exhaustively, while the other documents a design. Make sure that sentence is in your document, in writing, near the counts.

## Walk one row

Some people will never read the table. A sponsor, or a subject-matter expert giving you an hour, needs something smaller. Walk them through one row, end to end, and leave the table closed.

A format that works:

1. Pick a row that matters to the person in front of you.
2. Read the capability out in plain words.
3. Say what each side does. Two sentences each.
4. Say the verdict and why it is that verdict rather than the next one over.
5. Say where the evidence came from.
6. Say what closing it would take.

It works because it makes the reasoning visible on a case small enough to hold. After watching one row, a subject-matter expert can restate a partial gap correctly and unprompted: both sides have the same idea, done a little differently. That is somebody who has understood the whole document from six sentences about one row.

## Audit the output before anyone else reads it

The comparison is generated prose. It reads as confident, parts of it are wrong, and nobody downstream will re-check it.

### The reading procedure

1. Open the narrative model first. It explains the shape of what you are about to read.
2. Find the data dictionary **before** you start interpreting columns. Do not guess at a verdict value.
3. Open the table. Freeze the first column, widen the long text columns, turn on text wrap, and filter by verdict so you read one class at a time.
4. Walk whole rows, because skimming a comparison table turns up nothing.
5. Challenge rows out loud as you go, and say when you are assuming the worst reading rather than the best one.
6. Restate the boundary of the source material. What did this analysis actually see?
7. **Record every correction as you find it.** An audit reliably turns up real corrections, and they are just as reliably left unrecorded.

Look for two defects in particular. One is a column that is subtly wrong in a way only a domain expert can see. A persona column may tag a configuration setting with the people who *use* the resulting behaviour rather than the people who *configure* it. The other is invented compound words and foreign spellings, which are cosmetic until you remember the document is going to executives.

### When you find one bad row, sweep for the class

1. **Spot-check.** Open one substantive document and read a single row carefully, all the way through, instead of skimming ten of them.
2. **Find the contradiction.** Two columns may say one system owns a capability while the evidence column says the other one does.
3. **Refuse the one-row fix.** Changing one row only tells you whether that row was load-bearing, and says nothing about whether the same mistake is elsewhere.
4. **Start from the governing document.** Check whether the assumption behind the bad row is stated in the document that governs the whole set. If it is not stated, or is stated wrongly, fix that first. Everything below it inherited the error.
5. **Ask for a plan, not an answer.** Your agent will explain rather than act unless you tell it to produce a remediation plan you can approve.
6. **Constrain the shape of the fix.** Correct rows in place. Add a revision section inside each document that changed. Do not accept a new parallel set of documents or a standalone revision file, unless you asked for one.

A spot-check like that can turn up one bad row while the sweep it triggers finds dozens, and accepting the one-row patch would send all the others to a delivery team.

The same rule applies to everything an agent produces for you. When you find one defect, sweep for every row that could carry the same mistake instead of patching the row in front of you. See [Working with your agent](15-working-with-your-agent.md).

> **Watch out.** Check the remediation report's numbers against its own inventory. A report may give one total for the rows that need correction while its completion list adds up to a different number. Numbers get re-narrated by a model at every step and nothing checks them against each other.

## What you can do with the result

Every gap in that document is a **raw finding**: something somebody noticed that no repeatable test has proved yet. It rests on reading documents rather than on a repeatable test against a running system, so under `.os/contracts/finding-contract.md` none of them qualifies. That is the analysis working as intended, because what a comparison gives you is a list of things to go and prove.

Those gaps stay where they are, in the comparison document, with their row IDs. They do not go into a run's `raw-findings.md`, because that file belongs to a run and a comparison never produces one.

> **Not available yet.** BuildOS has no place to record a raw finding that did not come from a playbook run. Keep the gaps in your comparison directory. When you decide to prove one, write a playbook and run it. That run produces its own `raw-findings.md`, and the anchor in that file is what the qualify command needs. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

From here:

- Take the rows that matter and prove them. Write a playbook, run it against the live system, and qualify what it finds. See [Write and run a playbook](08-write-and-run-a-playbook.md) and [Qualify what you found](09-qualify-what-you-found.md).
- Feed the confirmed gaps into designs and PRDs. See [Designs, plans and PRDs](12-designs-plans-and-prds.md).

> **Watch out.** Record the gap count in a file, with an ID on every row. A count quoted from memory in the morning turns into a different number by the afternoon. An ID on every row is what keeps two people from quoting two different totals.

## What you should have now

- A written list of which sources describe each side, and a written statement of what the analysis could not see.
- One shared category list used by both sides, and a data dictionary defining every column and every status word on both sides.
- A yardstick document describing what the target system should do, imported as one source.
- A baseline drawn from your capability records, requirement records and converted twins.
- A comparison document with one row per capability, carrying a verdict, gap detail, evidence, confidence, effort and a migration note. It sits in a directory of your own, committed alongside its narrative model and its data dictionary.
- A walked-row explanation you can give to somebody who will not read the table.
- A record of every correction the audit found, and a sweep for any defect that looked systemic.

## Next

[Keep the record clean](11-keep-the-record-clean.md).
