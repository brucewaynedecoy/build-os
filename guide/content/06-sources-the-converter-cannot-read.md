# Sources the converter cannot read

This page tells you which of your documents `buildos intake` cannot handle, and what to do with each of them.

## What you need first

Read [Bring in source material](05-bring-in-source-material.md) first. This page assumes it.

It also assumes two words from that page. A **converted twin** is a clean text copy of an original file, carrying a header that records where it came from, its hash, what converted it, and when. **Conversion** is the step that produces one, with no model and no network connection involved.

## What the converter takes

The converter reads six kinds of source: CSV, Word, Excel, HTML, a directory of HTML, and PDF. That list is fixed in the tool, and no configuration setting extends it. Most of what a real team holds falls outside it.

| What you have | Supported? | What to do |
| --- | --- | --- |
| Word, Excel, CSV, HTML | Yes | Convert it. See [Bring in source material](05-bring-in-source-material.md). |
| PDF | Yes, minimally | Read the PDF section below before you trust the output. |
| Email (`.msg`, `.eml`) | No | Paste the body into a Word document. Below. |
| Slide decks (`.pptx`) | No | Export to PDF first, then read the PDF section. |
| Meeting recordings, audio, video | No | There is no path. Get a text transcript from elsewhere. |
| Meeting transcripts | Only if they are already a Word document | A transcript saved as `.docx` converts. A transcript sitting in a meeting tool does not. |
| Diagrams and entity-relationship models | No, in any useful sense | Hand-convert it. Below. |
| Very large metadata exports | No practical path | Ask for a filtered export. |

### How to tell quickly

Run two checks, in order.

1. **Look at the extension.** If it is not `.csv`, `.docx`, `.xlsx`, `.html`, `.htm` or `.pdf`, the tool will not take it.
2. **For a PDF, open it and work out where the meaning lives.** In a report the meaning is in the words, and the converter will get it. In a diagram, a screenshot, a scanned page, or a table drawn as boxes, the meaning is in the picture, and the converter reads words only.

There is a third check worth doing before you commit anything to the project. Hand the file to your agent and ask whether it can read it at all, before you copy it into the repository or run the converter on it. A no at that point costs you nothing and keeps the file out of the record.

## Email

Email has never been supported. `.msg` and `.eml` are not among the six.

> **Not available yet.** `buildos intake convert` has no email format. Neither the message file nor its attachments have a conversion path. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The workaround is short:

1. Open the message.
2. Copy the body text.
3. Paste it into a **new Word document**. Give it a plain filename, no pipes and no slashes.
4. Add a first line naming the sender, the recipients and the date. The converter has no way to know any of that, and no other part of the system records it.
5. Save the attachments separately. If one of them is a Word file or a spreadsheet, it is an ordinary supported source. Convert it on its own.
6. Convert the Word document you just wrote.

Use Word rather than Markdown, because **there is no Markdown input type.** The supported list is `csv`, `docx`, `xlsx`, `pdf`, `html` and `html-dir`. A `.md` or `.txt` file you typed yourself has no automatic conversion path. You can still bring one in, but you must write its provenance header by hand under the manual playbook described below. Saving as `.docx` and running the command is less work and produces a better header.

The result is a proper converted twin with a real provenance header. Its `source` field points at the document you typed rather than at the original message, so write that fact into the body where a reader will find it.

## PDFs

PDF is on the supported list, and that support is narrower than it sounds.

> **Not available yet.** PDF intake is deliberately minimal. There is no OCR, no table reconstruction, no embedded-image extraction, and no layout fidelity. The intake contract states this outright and says none of it is planned. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

A text-heavy PDF converts acceptably. You get a `.txt` twin holding the words.

A diagram-heavy PDF fails **quietly**. The output is a `.txt` file with words in it that looks like a successful conversion. What it holds is whatever loose labels happened to be stored as text, such as box names, stray column headings and page furniture. The relationships, the arrows, the grouping and the row-to-column alignment are all gone.

Nothing marks that file as broken. Its header says `converter` and `sha256` and `timestamp`, the same as any other twin. An agent reading it will find field names and answer confident questions about them, and the answers will be wrong.

Two rules follow from that.

- **Open every PDF twin and read it** before anything else touches it. A quick look tells you whether the meaning survived.
- **If it did not, set `status: rejected`, or `status: candidate` if part of it is usable.** Both values exist for this case. Do not leave a bad conversion sitting at `converted`.

### Diagrams and data models

A vendor's data model usually arrives as a diagram exported to PDF. In that form the converter produces text nobody can use.

What people actually do is skip the converter for that one step. Point a capable agent at the file, ask it to extract only the diagram on a given page, and have it write the model out as text. Then verify a sample of the field names against the original by eye, and keep the one or two output formats you can actually read. Discard the rest.

Be clear about what you have when you are done. That output has no provenance header, so it cannot be indexed as a reference and nothing downstream can tell how it was made. To turn it into a proper twin, follow the manual path below.

## The manual conversion path

BuildOS ships a playbook for this. A **playbook** is a written procedure that tells a person or an agent how to do one job, step by step, and it lives as a Markdown file in the repository.

The one you want is **PB-003, "Manual intake conversion"**, at:

```
playbooks/administrative/manual-intake-conversion.md
```

It is one of only three playbooks that ship as `active`, and the only active one that produces anything. Its stated purpose is to create trustworthy converted twins when the automated intake is unavailable, fails, or produces output that is not good enough.

It rests on one requirement: **a hand-made conversion must meet the same contract as a machine-made one, so that nothing downstream can tell the difference.** That covers the path, the header, and the rules about what the body may contain.

The procedure, in short:

1. Read the two contracts it names, `.os/contracts/converted-source-contract.md` and `.os/contracts/intake-translation-contract.md`.
2. Create `assets/<source-slug>/` for your source.
3. Write the converted body into that directory.
4. Put full frontmatter on it: `source`, `sha256`, `converter`, `timestamp`, `type`, `status`. The `sha256` is computed from the **original** file, not from the text you wrote. Run one of these against it and copy the 64-character hex string:

   ```
   shasum -a 256 sources/lending-overview.pdf
   ```

   ```
   sha256sum sources/lending-overview.pdf
   ```

   macOS ships `shasum`. Most Linux systems ship `sha256sum`. Either one prints the hash first and the filename second, and you want the hash only.
5. Set `converter: "manual-intake/1.0.0"` when a person did the work. If a local tool or an agent produced the body, name that instead, with its version.
6. Keep the body faithful. Preserve the order, headings, labels and visible text of the original. Do not add headings that were not there. Do not reconstruct a table's structure from what it looked like.
7. Put images, charts and diagrams in the same source directory under `media/`, `diagrams/` or `charts/`, and link to them from the body with relative links.
8. Add nothing interpretive. No requirement language, no capability labels, no IDs, no findings. A converted twin records only what the source said.
9. Mark it honestly. If the conversion is incomplete or you cannot vouch for it, `status: candidate` or `status: rejected`.
10. Rebuild the reference index: `buildos intake index references`.

The playbook lists twelve steps and gives per-format guidance for Word, Excel, HTML, HTML directories, CSV and PDF. Read it before your first hand conversion.

> **Watch out.** The failure this playbook prevents is easy to walk into by accident. A Markdown file you pasted content into and dropped in `assets/` has no `source`, no `sha256`, no `converter` and no `timestamp`. It sits in the right folder and looks exactly like a twin. Without the header it will not appear in the reference index, and nothing can trace a claim back through it.

## What a bad conversion costs you

A converted twin is faithful to whatever the source said, whether or not the source was right, and it carries no signal about how well the conversion went. Downstream, that text becomes the basis for extracted records, and those records become the basis for comparisons, requirements and decisions. Each hop moves further from the original file, and by the fourth hop nobody is going to reopen the PDF.

The failure is quiet at every stage. A diagram PDF converts to plausible-looking text, an agent reads it and produces rows that look like every other row, and a comparison then counts those rows and reports a gap that does not exist. Nothing along the way is marked as suspect, because no part of the system has any way to know.

Two ordinary ways this happens. A transcript can carry hundreds of words of unrelated audio, such as advertising or voiceover, presented as speech. A vendor workbook can lean heavily on AI without saying so on the page. Either one goes in looking clean.

Four things you can do about it, at roughly two minutes per twin:

- Open every twin from a source that was not a straight deterministic read.
- Spot-check distinctive values against the original.
- Use `status: candidate` and `status: rejected`. Each is one word, and it carries forward.
- Say in writing that your check was a sample.

## Writing a source on purpose

Sometimes the best move is to stop fighting a source. Some knowledge exists only in someone's head, or only in a file nothing can read. In both cases, write a clean document yourself and bring that in.

BuildOS asks only that the text is faithful and that the header says where it came from. A document you wrote this morning qualifies as a source in exactly the same way a vendor specification does, with the advantage that you know what is in it.

What works in practice:

1. **Start from something structured you already have.** A matrix, a list, an outline. Let it decide what the document has to cover.
2. **Fix a question set and answer it identically for every item.** One item per page. The same four or five questions each time. Consistency is what makes the document extractable later.
3. **Use an agent for the first draft, and label what it wrote.** A reviewer who knows they are reading a draft will argue with it, which is what you want.
4. **Review it with people who know the domain, before conversion rather than after.** An agent's first structure can be wrong in a way only a domain expert will see. It may invent a general "exceptions" section instead of putting each exception where it actually occurs. Undoing that is a human judgement, and it has to happen before the document goes in.
5. **Save it as Word and convert it.** Word is the format the converter handles best.

Do not withhold a document because it looks rough. Hand-typed, unnumbered and unprioritised is fine. What usually stops people here is embarrassment rather than any technical problem.

## Keep invented names out

One thing does need removing before you convert a document you wrote, and that is any name you guessed at.

Extraction cannot tell an approximate label from a real one. If your document names an entity in the target system and that name is your best guess, it will be read as a fact, extracted into records, and inherited by everything downstream.

Before you convert your own document:

1. Go through it and mark which parts are fact and which are assumption.
2. Take the guessed names out. Describe the thing instead of naming it.
3. Put the hedge **inside the document body** rather than in a message to someone. Write that these are the author's assumptions, that some may already exist under other names, and that the names are approximate. Only text inside the document travels with the document.
4. If a version with the guesses in it has already been converted, convert the corrected version as a new source and mark the old twin `superseded`. Then ask your agent, explicitly, which already-extracted records carry the bad names, and have it correct them.

> **Watch out.** Only one record type in BuildOS protects names deliberately. Personas have an identity contract which says that a name an extractor saw is not an approved name until a person writes it in on purpose. Requirements and capabilities have no such protection. A guessed name inside one of those goes straight through.

## Deciding what to do with a pile of documents

There are four outcomes. Work through them in this order.

**Convert it.** Use the tool when the file is one of the six formats and the meaning is in the words. That covers most Word documents, all spreadsheets, all CSVs, and text-heavy PDFs. It costs one command.

**Hand-convert it under PB-003** when the content matters and the tool cannot get it out faithfully. Diagram PDFs, slide decks whose content matters, and anything an agent had to read for you all belong here. Each one is real work and you write the header yourself, so reserve this for sources you will actually use.

**Rewriting the source** is the right answer when the original is a poor container for knowledge you have anyway. Email threads, notes, and anything where a clean Word document you write would be shorter and truer than a faithful copy. Budget an afternoon. The result is often the best source in the set.

**Leave it out** if it duplicates something already in, if it is a delta document whose baseline you do not have, if it is a very large unfiltered export, or if nobody can vouch for it. That costs nothing. Write down that you excluded it and why, so the question does not get reopened every month.

When two of these seem to apply, ask whether anyone would notice if the conversion came out badly. If nobody would, do not run the converter on it. Hand-convert it or leave it out.

## What you should have now

- A list of your documents split into the four outcomes above.
- The unsupported ones identified before you wasted a command on them.
- Any email you needed pasted into a Word document and converted, with sender, recipients and date recorded in the file.
- Every PDF twin opened and read, with `status` set honestly on each.
- Any hand-made conversion sitting at `assets/<source-slug>/` with full provenance frontmatter and `converter: "manual-intake/1.0.0"`.
- A rebuilt reference index, if you added twins by hand.

## Next

You now have converted text in `assets/`. Read [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) to turn that text into records you can count, compare and trace.
