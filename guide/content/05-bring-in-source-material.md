# Bring in source material

This page shows you how to turn a document you already have into a clean text copy that BuildOS and your agent can work with.

## What you need first

Read [Install and configure your instance](04-install-and-configure-your-instance.md) first. This page assumes it.

You need three things:

- A project that `buildos init` set up, with `.os/config/instance.yaml` filled in for your own project.
- The project wrapper working. Check it with `.os/scripts/buildos intake --help` (`.os\scripts\buildos.cmd intake --help` on Windows). If that prints help text, you are ready.
- One document to convert. A Word file or a spreadsheet is the easiest first try.

Every path in this article is written from your project root.

## What conversion does

**Intake** is taking a file from outside and bringing it into BuildOS as clean text that remembers where it came from. The first half of intake is **conversion**.

Conversion turns a document into raw text. It does this without any AI. No model is involved and no network connection is used. The tool reads the bytes of your file and writes out text.

The output is a format a program or an agent can consume cheaply, rather than something laid out for a person to read.

Conversion does not decide what your document means. It copies the visible content across and stamps a header on it. Interpreting the content is a later job, and it happens elsewhere.

Conversion is **deterministic**. That means the same input always gives the same output. The contract that governs converted text says so as a hard rule: conversion must be deterministic for the same source file, the same hash, and the same converter. So when an agent reads converted text and tells you something, you can go back and confirm that the text it read is the text in your document, with nothing paraphrased on the way in.

The deterministic path exists for a second reason. Handing the original file to a model every time you want to look at it is slow and costs money, while converting once lets you read the text as often as you like.

The result of a conversion is a **converted twin**: a clean text copy of an original file, carrying a header that records where it came from, its hash, what converted it, and when.

## The six formats that work

`buildos intake` converts six kinds of source. Anything else is outside the tool, and [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) is about what to do then.

| Source | What you get | Notes |
| --- | --- | --- |
| CSV file | One `.csv` twin | Read and rewritten through a standard CSV parser, then stamped with the header. |
| Word document (`.docx`) | One `.md` twin | Paragraphs, headings, lists and simple tables are preserved. Link text survives but the address behind it is dropped. Embedded pictures the tool can reach are copied out beside the twin. |
| Excel workbook (`.xlsx`) | One `.csv` twin **per worksheet** | A workbook with four worksheets produces four CSV files in one directory. Row order and column position are preserved. Embedded images are copied out beside them. Native charts are not extracted at all. |
| HTML file | One `.md` twin | Headings, paragraphs, lists, links and clear tables convert to Markdown. Scripts, styles and layout-only containers are ignored. |
| A directory of HTML files | One `.md` twin **per** `.html` or `.htm` file | The file's relative path inside the directory is used to name each twin. |
| PDF | One `.txt` twin | Plain text only. Read the PDF section of [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) before you rely on this. |

The picture files pulled out of a source are called **side artifacts**. A side artifact is an image, chart, or diagram lifted out of a source during conversion and stored next to the converted twin, under `media/` or `diagrams/`. It is a file, not a record. Nothing downstream treats it as data.

Word documents are the format the converter handles best. Choose Word over the other five wherever you have the choice.

## Decide what goes in, and when

Documents arrive faster than anyone processes them, so most teams keep a holding folder. It is somewhere to drop things as they arrive, before deciding whether and when to convert them.

Keep that habit, with one caution.

> **Watch out.** BuildOS does not model a holding folder. The contract has exactly one place for converted material, `assets/<source-slug>/`, and there is no `incoming/`, `intake/` or `converted/` level anywhere in it. A folder on your desktop is outside the repository and outside provenance. Nothing records that a file was ever received, so a document can sit there for weeks while everyone assumes it went in.

Two habits keep it safe:

1. **Convert in rounds, and say what each round is.** If a vendor ships a second version of their material halfway through your work, hold it back and run it as its own later round. Two versions of the same material in one pass leave you unable to tell them apart afterwards.
2. **Pick one copy of each thing.** The same content often arrives as a spreadsheet, a CSV and a JSON export at the same time. Convert the copy that keeps the most meaning, and leave the others out. A spreadsheet with named columns and sheets usually keeps more than the same data flattened into JSON.

## Prepare the file

Do these checks before you run anything.

1. **Rename the file to plain characters.** Letters, digits, hyphens and one full stop before the extension.

> **Watch out.** A pipe character (`|`) or a slash in a source filename will break conversion. The cause is the way the source name is turned into a folder name. Rename the file first, which takes seconds and avoids a failure with no obvious cause.

2. **Check the size.** Very large exports cause trouble downstream, in git rather than in the converter. Nothing in BuildOS warns you about source size. If a vendor offers you an unfiltered metadata dump, ask for a filtered one before you convert it.

3. **Read it once yourself.** Generated documents carry whatever the generator saw, and that can include the author's local file paths and folder names that should never leave their machine. Conversion and commit put all of it into the record permanently.

> **Watch out.** Attaching a document to a chat with your agent is **not** intake, though the two look equivalent from the outside. An agent may go on to report that it completed intake for an entirely different document. Save the file into your project folder, convert it there, and then tell your agent where the twin is. The worked example below shows the whole sequence.

## Run the conversion

The command is one line, and you should dry-run it first.

A **dry run** checks whether a command would work before it changes anything. It roughly doubles the wall time and it finds problems before the tool commits to writing files.

1. Dry-run the conversion.

```
.os/scripts/buildos intake convert --source <path> --dry-run
```

2. Read what it says it will do. Exit code zero means everything is green.

3. Run it for real.

```
.os/scripts/buildos intake convert --source <path>
```

Useful flags:

- `--type auto|csv|docx|xlsx|pdf|html|html-dir` forces the source type. The default is `auto`.
- `--force` overwrites output that is already there.
- `--assets-root assets` writes somewhere other than the default.
- `--repo-root <path>` runs the tool from outside the repository.

### A worked example, start to finish

Say the file you were sent is called `Lending Overview.docx` and it is sitting in your Downloads folder.

1. Rename it to plain characters: `lending-overview.docx`.

2. Move it inside your project folder. BuildOS ships no folder for original files, so make one and use it every time. A `sources/` directory at your project root works:

   ```
   sources/lending-overview.docx
   ```

3. From your project root, dry-run the conversion:

   ```
   .os/scripts/buildos intake convert --source sources/lending-overview.docx --dry-run
   ```

4. Run it for real:

   ```
   .os/scripts/buildos intake convert --source sources/lending-overview.docx
   ```

5. Open what appeared:

   ```
   assets/lending-overview/lending-overview.md
   ```

The directory name and the file name both come from your filename, lowercased and hyphenated.

**Does the original belong inside the repository?** Yes, and commit it with the twin. The `source` field in the twin's header records the path you gave the command, written relative to your project root. When the original sits outside the repository there is no relative path to write, so the tool records the full path from your own machine instead, which nobody else can follow and which leaves the provenance header useless to a second person. The one exception is size: filter a large export rather than committing it, as in the size check above.

### What lands on disk

Output goes to:

```
assets/<source-slug>/<asset-slug>.<ext>
```

A **slug** is a lowercase, hyphenated version of a name, safe to use in a filename. The `<source-slug>` is derived from your original file, and it names the directory. The `<asset-slug>` is derived from the file stem, plus the worksheet, page or part name when a source produces more than one twin.

So one source always produces one directory. A Word document produces a directory with one Markdown file in it. A workbook with three worksheets produces a directory with three CSV files in it. Side artifacts sit in the same directory, under `media/` for images and `diagrams/` for SVG and diagram-as-code. The contract also allows `charts/`, but no shipped tool writes there.

Go and look at what appeared. Open the directory, open at least one converted file, and read the first eight or so lines of it.

> **Not available yet.** `assets/` ships empty. There is not one example converted twin anywhere in the product, so you have nothing to compare your first output against. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

## The provenance header

The first block of every converted twin is YAML **frontmatter**, a small block of labelled values between two lines of three dashes, before the content starts. Here it holds the provenance: the record of where this text came from.

```yaml
---
source: "<the original file, as a repo-relative path or a URI>"
sha256: "<64 lowercase hex characters>"
converter: "<the tool or agent that produced this text, with its version>"
timestamp: "<ISO 8601 UTC, for example 2026-03-02T14:02:11Z>"
type: "markdown"
status: "converted"
---
```

The tool writes every value in double quotes, as shown. Six fields, and each one answers a question.

| Field | The question it answers |
| --- | --- |
| `source` | Which original file is this a copy of. |
| `sha256` | What exactly was in that file at the moment it was read. |
| `converter` | What produced this text, and what version of it. |
| `timestamp` | When this copy was made. |
| `type` | What kind of body this is: `markdown`, `csv`, `text`, `html`, `image` or `other`. |
| `status` | How far this copy has got: `candidate`, `converted`, `superseded` or `rejected`. |

Two of those fields need more explanation.

**The hash.** `sha256` is a code calculated from the content of the file itself. Most systems understand the same code. Change one character in the original and the code comes out completely different, which gives you identity based on content instead of on filename. If someone edits a PDF, keeps its name, and hands it back to you, the hash shows it as the same document in a changed state.

> **Not available yet.** The hash only makes that possible. `buildos intake convert` takes one source and converts it, with no change detection, no delta step, and no update-in-place behaviour anywhere in the intake flow. Re-running a conversion needs `--force` and overwrites. Noticing that a source is a revised version of one you already hold is work you or your agent do by reading, and the tool never reports it. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

**The `type` field is not the `--type` flag.** The flag says what kind of *source* you handed in (`docx`, `xlsx`, `pdf`). The frontmatter field says what kind of *body* came out (`markdown`, `csv`, `text`). A `.docx` source produces `type: markdown`.

## Check it before you trust it

`status` has four values, and the first one needs explaining. **`candidate`** means "this converted text is useful, but a person should look at it before we trust it." `buildos intake` always writes `converted`. `candidate` is a value you set yourself, by editing the twin's header.

Use it whenever the conversion was not a straight deterministic read, such as a difficult PDF, an agent's output, or anything hand-made. Then run the check below, which takes about two minutes.

1. Pick several distinctive values out of the converted text. Choose the ones a model would be most likely to invent: unusual field names, specific numbers, proper nouns.
2. Open the original document and search for each one.
3. If they are all there, change `status` to `converted`.
4. Write down, somewhere a reader will see it, that the check was a sample and not a proof.

> **Not available yet.** Step 4 has nowhere to go. The `candidate` and `converted` states exist, but no field records who checked the twin, what they checked, or that only a sample was checked. Put it in your commit message or in a note beside the work. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

> **Watch out.** Nothing in the record says whether a source's *content* was written by a model. The `converter` field records what converted the file, not who wrote it. Vendors increasingly hand over material they generated with AI and have not reviewed, and some of them will tell you so if you ask. The converted twin will be perfectly faithful to a document that is wrong. Ask where a document came from before you convert it, and set `status: candidate` when the answer is uncomfortable.

> **Watch out.** A vendor's capability list is usually a *delta*. It describes what is new in a release, and leaves out everything the product already did. Treating one as a full surface will make whole areas look missing when they are standard and therefore unmentioned. Establish what the baseline is before you build anything on top of the converted text.

## One source per run

`buildos intake convert` takes `--source <path>`, and that path is one source. There is no folder sweep. The tool will not walk a directory for you.

So a folder of 40 documents is 40 invocations. In practice teams ask their agent to work through the folder and run the command once per file, and that is how most real intake happens.

**Nothing in the product knows the folder as a unit.** No record says that a batch happened, duplicates inside it go undetected, and nothing tells you which files have not been done yet. If the loop stops halfway, the only way to find out is to look.

**Ground yourself before you start.** Write down which directories you expect to change, then compare before and after. Without that, you have no way to check what a bulk run actually did.

> **Watch out.** It is tempting to tell the agent to read difficult files itself and write the text out, and it will do it. That breaks the guarantee this whole page rests on. The twin's `converter` stamp is no longer true, the hash stops implying that anyone can reproduce the text, and the content becomes a model's reading of the document. Sometimes it is the only option. [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) covers when, and what to do so the result is still honest.

## Find out what is already in the system

There are two derived catalogs. An **index** is a generated lookup file. It is never the source of truth, and you can delete and rebuild it any time.

Rebuild the playbook catalog:

```
.os/scripts/buildos intake index playbooks
```

It prints `wrote <path> (<n> playbooks)` and writes `.os/indexes/playbooks.json`. In a freshly set-up project it finds six.

Rebuild the converted-source catalog:

```
.os/scripts/buildos intake index references
```

It writes `.os/indexes/references.json`, built from the frontmatter of every converted twin under `assets/`.

> **Not available yet.** `references.json` does not exist in the shipped tree, even though contracts, routers and guides all refer to it. The command runs, but against an empty `assets/` it produces `{"version": 1, "references": null}`, which catalogs nothing. Until you have converted some sources, there is nothing for it to catalog. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

Until then, look in `assets/` yourself, or ask your agent to list the converted twins and their `source` fields. Build the reference index after each round of conversion so the answer gets cheaper over time.

## What you should have now

- A source file with a plain filename, of one of the six supported types.
- At least one directory under `assets/`, holding one or more converted twins.
- A provenance header on each twin, and you have read one.
- A `status` value you chose deliberately: `converted` if the conversion was a straight deterministic read, `candidate` if it needs a person's eye.
- A clear idea of which of your documents the converter cannot read at all.

## Next

[Sources the converter cannot read](06-sources-the-converter-cannot-read.md), which covers your email, your slide decks and your meeting recordings, none of which the converter takes.
