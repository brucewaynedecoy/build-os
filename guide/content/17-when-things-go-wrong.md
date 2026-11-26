# When things go wrong

A lookup page for the problems you are most likely to hit, arranged by what you are seeing.

## What you need first

You can read this article on its own. It assumes you have a BuildOS repository on your machine and an agent tool you are allowed to run. Every BuildOS word used here is defined in [Glossary](20-glossary.md), and each entry names the document that explains the problem in context.

## How to use this article

Look up the symptom rather than the cause, because when you are stuck you know what you are seeing and not why. Each entry says what is happening, why, and what to do. Where a problem has no fix today, the entry says so rather than sending you looking for one.

## Start here when you are stuck

Work down this list before you read anything else. Most lost time traces back to one of these seven.

1. **Ask your agent, in plain language.** Do not browse the folders. Say what you are looking for the way you would say it to a colleague. Asking the agent to check the data for anything worth testing gets an answer in one exchange, where clicking through the indexes does not.
2. **Check which project and which branch are open.** Your editor and your agent tool hold that state separately, and either can be showing you something else. Run `git branch --show-current`. [Before you start](03-before-you-start.md) explains branches and the other git terms this article uses.
3. **Run `git status`.** A surprising amount of "the files are missing" turns out to be uncommitted work, or work committed somewhere else.
4. **Ask your agent where it wrote the files.** Ask about its own tool's behaviour, not about your files. See "I cannot find the thing I am looking for" below.
5. **Restart your agent tool.** It is the fix for a skill or command that has stopped appearing.
6. **Read the `AGENTS.md` in the folder you are working in.** Every folder in BuildOS has one. It says what belongs there and what does not, and it is written for you as well as for the agent.
7. **Run the configuration validator.** It is the one check that always works, changes no file, and catches a whole class of silent problems:

```
.os/scripts/buildos validate
```

It passes with exit code 0 and the line `OK. No problems found.` It fails with exit code 4 and lists each file with one line per problem: the field, what is wrong, and a code in brackets.

---

## I cannot get access to anything

**The repository invite does nothing, or locks you out.** You accept an invite and lose access, or you add someone by username and nothing happens. An organisation-owned repository uses organisation roles and policies rather than the personal collaborator flow, usually with single sign-on on top, so the personal invite path can silently do nothing. File a ticket with whoever administers the organisation and expect it to take days. The reliable workaround is to keep the project in a repository outside the enterprise account entirely. See [Before you start](03-before-you-start.md).

**You are asked to sign in again every few minutes.** The single sign-on session does not persist across your agent tool, your editor and your browser. **No fix today.** One workaround holds: commit locally and push from a separately authenticated desktop git client. It recurred across four months of sessions without improving.

**You are not allowed to run the agent tool you want.** Which tool you can run is decided by your employer, not by capability. Some licences forbid connecting an enterprise subscription to a third-party harness. **No fix.** BuildOS requires no particular tool: two people can work the same project from two different tools, coordinating through git. See [Harness independence and trust](16-harness-independence-and-trust.md).

**Every AI action shows a corporate warning screen.** Enterprise AI governance, not BuildOS. Accept and continue. Nothing in BuildOS makes a network call, which helps when you have to explain it to someone.

**You cannot pass a file to a teammate.** Chat sharing fails across an organisation boundary and email delivers the wrong thing. Commit, push, pull. Git is the only channel that works reliably.

**You cannot export the meeting recordings you planned to use.** On most platforms the transcript belongs to the organiser and access is granted per recording. **No fix.** Check that you can export them before you plan work around them, and note that no shipped converter reads a transcript anyway. See [Sources the converter cannot read](06-sources-the-converter-cannot-read.md).

---

## My document will not convert

**Your file type is not supported.** `buildos intake convert` handles CSV, DOCX, XLSX, PDF, HTML and a directory of HTML. That is the whole list. Email, slide decks, videos and meeting transcripts are not on it. Export to a supported format first, or copy the content into a Markdown file by hand. [Sources the converter cannot read](06-sources-the-converter-cannot-read.md) covers the manual route and what it costs you.

**You attached the file in the chat and nothing was brought in.** Attaching a document to your agent conversation is not intake. The two surfaces look equivalent and nothing tells you which one you used. Downstream, the agent will report completing intake on a different document entirely. Save the file into the repository first, then convert it there. Nothing fails visibly, which is why this one is expensive. See [Bring in source material](05-bring-in-source-material.md).

**Conversion broke on a file with an unusual name.** A pipe character or a slash will break a conversion. Rename the source file to plain characters before you convert it.

**A large file jammed your commit.** A 53 MB slide deck blocked the commit someone needed as a rollback point. Filter large exports before you convert them, and commit before an intake session rather than after.

**Your agent read the PDF itself instead of converting it.** For a complex PDF, the deterministic parser produces little usable text, and an agent asked to "bring the file in" may read it directly and write the text out. Nobody is asked, and the provenance stamp on the resulting twin no longer means what it says. PDF intake in BuildOS is deliberately minimal: no optical character recognition, no table reconstruction, no image extraction, no layout fidelity. Treat any diagram-heavy or scanned PDF as a manual job.

**The source document you were given is itself unverified.** Colleagues and vendors increasingly produce source material with AI help, and nothing marks which parts are inferred. Set `status: candidate` on the converted twin, which is the shipped state for exactly this, and spot-check it before anything depends on it. See [Bring in source material](05-bring-in-source-material.md).

**A vendor document seems to be missing whole areas.** Vendor catalogues describe what is new, not what exists. Extracting rows from one will mint false gaps. Establish the baseline first. See [Compare two systems](10-compare-two-systems.md).

---

## I cannot find the thing I am looking for

**You do not know where to start in the tree.** Every folder carries an `AGENTS.md` that says what belongs there and where to go next. These files are written for you as much as for the agent, whatever the filename suggests. See [Install and configure your instance](04-install-and-configure-your-instance.md).

**Everything your agent wrote is invisible in your file explorer.** Some agent tools create a separate git **worktree** per session. A worktree is a second working folder attached to the same git repository, with its own copy of the files. Yours will have a generated name and sit outside the project folder you have open. Ask a specific question about the tool's own behaviour: where does it store its worktrees, and can that be turned off. A vague question about your files leads nowhere. Better still, open the worktree itself through your git desktop client's worktree dropdown and work in it. That removed about fifteen minutes of git plumbing per session.

**The files are missing and you are sure you made them.** Check the branch you are on. This is usually a wrong-branch problem.

**Two folders are both called `assets`.** `assets/` belongs to BuildOS and holds your converted sources. `docs/assets/` belongs to Make Docs and holds guides and shared project material; it appears only when the first such file is written. Make Docs' templates and references are under `.make-docs/system/`. Writing into the wrong one is a real mistake with a guardrail against it. See [How it works](02-how-it-works.md).

**You cannot tell `.os/data/` from `workspace/datasets/`.** Think of a spreadsheet application. It keeps hidden support files it needs in order to run, and you never touch them. Separately, there are the spreadsheets you made. `.os/data/` holds the first kind, and `workspace/datasets/` holds the second, which is yours to fill.

**A `.jsonl` file will not open, or is unreadable when it does.** Line-oriented JSON is not a human reading format and the file can be too large for an editor to open. Do not open it. Ask your agent for a table of what is in it. That worked every time it was tried. See [Pull knowledge out of it](07-pull-knowledge-out-of-it.md).

**You cannot tell what has already been brought in.** The index that would answer this, `.os/indexes/references.json`, does not exist in the shipped tree. Build it:

```
.os/scripts/buildos intake index references
```

Against an empty assets folder it will report zero references, which is correct and not an error. Until you have converted sources, ask your agent to list the converted twins instead. Two people who built the system once spent ten minutes failing to answer "have we already converted this?"

**Your file tree is hard to read.** Install a file-icon extension and a CSV viewer. The change is cosmetic, and it decides whether a newcomer can follow a walkthrough at all.

**Output landed somewhere you did not choose.** A generated file went to a cloud drive nobody named. Say where the output goes, in the prompt, every time. See [Working with your agent](15-working-with-your-agent.md).

**An installed skill or command has disappeared from the list.** Restart your agent tool first. If it is still missing, try invoking it by name rather than looking for it in a menu, which often works when browsing does not.

---

## It refuses to run

**A command prints "BuildOS needs Node.js 24 or newer" and exits 127.** The project wrapper could not find Node.js 24 or newer. Install it from `https://nodejs.org` or your organisation's software portal, check with `node --version`, and run the command again.

**`npx` stops with a network or certificate error.** The npm registry is blocked on your network. Install BuildOS from the package file instead; [Install and configure your instance](04-install-and-configure-your-instance.md) has the steps.

**A command stops with exit code 3 and a message about `.os/manifest.json`.** The wrapper reads the BuildOS version from that file. Run `buildos init` in the project folder again, or put back the exact version the file had.

**A command fails for a reason unrelated to BuildOS.** Node.js 24 is required for every BuildOS command, and Python 3 for three skills' helper tools. Check them before you blame the system. If a direct download is blocked on a managed machine, install through your organisation's approved-software portal.

**Windows asks you to "choose an app" and shows no executable.** You opened the macOS and Linux wrapper, `.os/scripts/buildos`, which has no file extension. On Windows, run `.os\scripts\buildos.cmd` in Command Prompt instead.

**A playbook refuses to run.** Only `active` playbooks run, and a playbook is a written procedure telling a person or an agent how to do one job. Yours is probably still `draft`. Edit the status in the file's header block, then rebuild the index:

```
.os/scripts/buildos intake index playbooks
```

It prints `wrote <path> (<n> playbooks)`. Skipping the rebuild is the usual second failure. See [Write and run a playbook](08-write-and-run-a-playbook.md).

**Discovery will not start at all on a fresh copy.** The discovery command needs an `active` playbook in the `discovery` category, and the only one that ships is `draft`. Activate it or write your own, then rebuild the index as above.

**Your run has no environment address.** `.os/config/instance.yaml` ships as an unmodified template with placeholder identifiers, and the schema has no field for an environment address at all. Edit the file before your first run, then run the validator. Expect to supply the address by hand on every run. See [Install and configure your instance](04-install-and-configure-your-instance.md).

**Your agent edited the configuration file.** Nothing prevents it. Review every change to `instance.yaml` in the git diff and re-run the validator. An agent may silently write template identifiers and a self-referential entry into a live config.

**Your agent says it is not allowed to write to the project.** Harness or enterprise sandbox policy, not BuildOS. Ask it to print the commands instead, and run them yourself in a terminal. That worked immediately.

**An export or a command refuses because of a contract rule.** This is normal behaviour, not an error. A refusal means a rule was checked and did not pass. You have two legitimate answers: supply the parameter it is asking for, or drop to the base contract without the stricter adapter. You can override a rule by instructing it. An agent should not override one on its own. See [Export to a work tracker](14-export-to-a-work-tracker.md).

**Nothing you push works and three different git tools have failed.** Use the desktop git client. It tends to succeed where the command line and the editor integration both fail.

---

## The agent produced something wrong

**It promises work instead of doing it.** Asked to correct rows it had already written, an agent claimed a later step would handle it. That is a bluff, and a non-technical reader spotted it unaided. Reply naming the correction as the required output and give it permission to be approximate: infer the real names as best you can. See [Working with your agent](15-working-with-your-agent.md).

**It agrees with everything you say.** Ask what it recommends rather than telling it what to build. End the prompt by asking for its view. Verify any claim it makes about your own repository before you accept it.

**The output is wrong in shape rather than in detail.** Missing context is almost always the cause. The material usually lacks a statement everyone assumed was obvious, such as that an existing product was being enhanced rather than built new. Write the deliverable early and read what it gets wrong. When the shape is wrong, ask for a rewrite rather than editing by hand.

**One row is wrong and you want to patch it.** Sweep instead. Generated sets propagate a single misunderstanding everywhere, so start from the document the set was generated from and work down. One contradictory row can indicate dozens more, and a one-row patch ships every one of them.

**You do not know what a word in the output means.** Ask the agent what the column means, then write the answer into your own glossary. Generated text is not proofread and its column headers are defined nowhere. One competent reader was stopped by five invented terms in a single hour.

**It did work you did not ask for.** Agents renumber references, run git commands to stay in sync, and occasionally install software. Read the git diff after every run, which is where you see what the agent actually touched.

**It invented data.** Plausible-looking system names written into a source document by a human were extracted as facts into several records. Mark your assumptions inside the source document before you convert it, in plain hedging language. Nothing in the shipped system would catch this.

**The output is much thinner than you expected.** The input scope was probably never stated. If you have spreadsheets of prior requirements you did not mention, the agent did not know they counted. Say what you mean by the thing you asked for.

**The run is still going and your meeting has ended.** Large runs are slow: minutes for a small plan, most of an hour for a set of requirement documents, and most of a day for a full plan-and-backlog run. Kick them off well ahead of the discussion where you want the result.

**Counts do not match between the summary and the file.** Numbers are recomputed and re-narrated at each step, and nothing checks them against each other. Check counts against the file, and do not quote a number from memory.

**Your agent activated a playbook on your behalf.** It can, the gate is a plain text field, and no approval is recorded anywhere. Keep the review with a person, because the run that follows will act on a real system.

---

## My records are a mess

**You have twenty-four of something you should have five of.** Extraction mints a new record for every mentioned job title, with no automatic matching. Personas are the only record type with an identity contract. Do not run a prompt-driven cleanup, because it leaves dangling references behind. Consolidate deliberately, under the governing principle that nothing gets deleted, where losing records keep a pointer to the record that replaced them. See [Keep the record clean](11-keep-the-record-clean.md).

**There are records about BuildOS itself in your data.** Three seed rows ship with the system, they describe BuildOS's own review gate, and they point at a path that does not exist. They have reached a real generated backlog as a work item nobody could explain. Delete or relabel them before you add your own, which takes a line each.

**Everything is stuck in `draft` and nothing downstream will happen.** There is no promotion step and no tooling for one. Decide who moves records forward and write it down, because nothing enforces it.

**You copied the old set into a `backup/` folder and the agent got worse.** It now reasons over dead documents, and the copy silently breaks the one-active-set rule. Delete the folder. Superseded sets are recovered from git history. See [Designs, plans and PRDs](12-designs-plans-and-prds.md).

**You brought the same source in twice.** This is recoverable. A revised document counts as a new version rather than a duplicate, so register the new one as superseding the old and retire the earlier twin.

**Nobody can remember what was already done.** Work done outside the repository, or inside it and never committed, leaves no record of intent. Write what you were trying to do into the run record, and commit at the end of every session.

**Your work has been uncommitted for days.** One motivated adopter was blocked for twelve days on their first commit, mostly through fear of breaking something. Every change here is a change to a file under git, and you can undo any of them. Adopt two rules: commit before you bring material in, and commit before a long agent run. See [Before you start](03-before-you-start.md).

## What you should have now

- A triage list to work down before reading anything else, led by asking your agent in plain language.
- Six symptom groups, so you can find an entry by what you are seeing.
- A separation between problems in your environment, in your agent tool, and in BuildOS.
- The things that have no fix today: repeated corporate sign-ins, the tool your employer will not let you run, and locked meeting transcripts.

## Next

[What is not built yet](18-what-is-not-built-yet.md), the full register of what the shipped system does not do, what you do instead, and where each workaround is written down.
