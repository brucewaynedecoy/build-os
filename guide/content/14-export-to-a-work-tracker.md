# Export to a work tracker

This page turns your finished work backlog into a file your team's project-tracking tool can import, with the three-level hierarchy intact.

## What you need first

Read [Build the work backlog](13-build-the-work-backlog.md) first. This page assumes it. You need one finished work backlog under `docs/work/`, an agent tool you can install a skill into, and Node.js 24 or newer on the machine that runs the export, which every BuildOS command needs.

## Where the exporter lives

A **skill** is a packaged instruction set your agent tool can use. The exporter is a skill named `buildos-export-azure-boards`. It ships in the BuildOS package, and `buildos init` copies it into your project at `.os/skills/buildos-export-azure-boards/`, with every other BuildOS skill.

The exporter is a companion piece. The BuildOS flow ends at the work backlog directory, and the export is a separate step. From BuildOS `0.2.0`, the skill runs the command `buildos export azure-boards` through the project wrapper, and you can run the same command yourself to check a file. In a project that pins BuildOS `0.1.0`, the skill runs its own Node.js script instead, with the same subcommands; its `SKILL.md` names it.

Run every command in this article from your project root.

## What it does

The exporter reads one work backlog and writes one CSV file that a tracker can import. It preserves the shape of the backlog as a parent-child tree of work items. A **work item** is one row in a tracker: an epic, a feature, or a backlog item.

The default mapping is fixed:

| BuildOS source | Tracker work item | Title column |
| --- | --- | --- |
| The work backlog directory | Epic | `Title 1` |
| One phase file | Feature | `Title 2` |
| One stage inside a phase file | Product Backlog Item | `Title 3` |
| Reserved, not written | Task | `Title 4` |

Rows are written in tree order: the epic first, then a feature, then that feature's backlog items, then the next feature. Each row fills exactly one title column and leaves the others blank. The tracker builds the parent-child links from that indentation. There is no parent column and there are no identifiers to match up.

Tasks inside a stage are not written as their own rows. They are folded into the backlog item's `TECHNICAL DETAILS` section, keeping their short `tN` identifiers so you can trace a tracker item back to the exact line in the source file.

A single backlog directory can produce well over a hundred work items, arriving as a correct three-level tree.

## Before you export

- One work backlog directory under `docs/work/`, containing `00-index.md` and every phase file its index lists.
- The skill installed into your agent tool.
- Node.js 24 or newer. **Node.js** is a runtime that runs JavaScript programs outside a browser, and BuildOS is one. Install it from `nodejs.org`, then confirm it with `node --version`. Nothing else is needed: no Python.
- The column list your tracker expects. See step 3 below for the fastest way to get it.
- A tracker project you are allowed to import into, and a decision about which tracker that is.

> **Watch out.** Confirm which tracker your organisation actually uses before you export. Ask first, because the answer changes which columns you need.

## Run the export

1. **Let your agent find the skill.** Ask your agent to use the `buildos-export-azure-boards` skill. The router `.os/skills/AGENTS.md` tells it how to install one skill into the place its own app keeps skills, so you do not need to know where that is.

2. **Check the command runs.** Open a terminal in your project root, and run:

   ```sh
   .os/scripts/buildos export azure-boards adapters
   ```

   It prints a short JSON block listing the registered adapters and the parameters each one requires. One adapter is registered today. On Windows, run `.os\scripts\buildos.cmd` with the same arguments. Each command below is one line, and a path with a space goes in double quotes: Command Prompt reads neither a `\` line break nor single quotes.

   In a project that pins BuildOS `0.1.0`, the command does not exist yet. In each command on this page, write `node .os/skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs` in place of `.os/scripts/buildos export azure-boards`. The subcommands (`adapters`, `emit`, `validate`) and their options are the same.

3. **Get the column list from the destination, not from documentation.** Open your tracker, run a saved query that returns some work items, export it, delete the columns you do not want, and save the result as a CSV. Hand that file to your agent as the format it must produce. The column template shipped with the skill was produced exactly this way, because a file from the destination reflects what the tracker will actually accept.

4. **Smoke-test the exporter before you trust it with your own backlog.** The skill ships a synthetic example. From that same directory:

   ```sh
   .os/scripts/buildos export azure-boards emit --input .os/skills/buildos-export-azure-boards/assets/synthetic-manifest.json --output workspace/azure-boards.csv --profile target17-new
   ```

   You should see:

   ```json
   {
     "operation": "emit",
     "output": "<project>/workspace/azure-boards.csv",
     "valid": true,
     "profile": "target17-new",
     "rowCount": 6,
     "counts": {
       "Epic": 1,
       "Feature": 2,
       "Product Backlog Item": 3
     },
     "errors": [],
     "warnings": [
       "Run an Azure Boards import preview because this compatibility profile retains blank ID, State, and Assigned To columns."
     ]
   }
   ```

   `<project>` stands for your project folder. The command writes only inside the project; an `--output` outside it needs `--allow-outside-root`. The file it writes is byte-for-byte identical to `.os/skills/buildos-export-azure-boards/assets/synthetic-golden-example.csv`. If it is not, stop and fix your install before going further.

5. **Ask your agent to run the export**, naming the backlog directory you want. The skill reads the routing files in the tree, the backlog's `00-index.md`, and every phase file listed in its phase map.

6. **Answer its questions.** It will stop and ask you several things before it writes anything. The next section explains each one. Answer them yourself rather than letting the agent guess, because a guessed answer produces work items that look correct and cannot be built.

7. **Let it write the manifest and emit the file.** The agent turns the backlog into a JSON **manifest**, meaning a plain description of every row with no formatting in it, and then runs the emit command against that manifest. BuildOS builds the CSV from the manifest, so the formatting is produced by the command rather than written by the agent.

8. **Validate the file.** From that same directory again:

   ```sh
   .os/scripts/buildos export azure-boards validate --input "<your-export.csv>" --profile target17-new
   ```

   A passing run prints `"valid": true` with an empty `errors` list and your row counts by type. A failing run prints the reason and exits with status 4.

9. **Open the CSV and read it.** Check the headers, the row count, the title columns, and two or three descriptions in full. The command cannot do this part for you. See "What the command can and cannot verify" below.

   > **Watch out.** The CSV keeps a field that starts with `=`, `+`, `-`, or `@` as it is, so the file imports into Azure Boards unchanged. A spreadsheet program may read such a field as a formula and run it. Import the file with Azure Boards' CSV import. To look inside it, read it as plain text or with a CSV reader that treats every cell as text. Open it in a spreadsheet program only when you trust every text in the manifest.

10. **Review the writing before you import.** Generated titles and descriptions need a human read. See [Build the work backlog](13-build-the-work-backlog.md) and the section below.

## The questions it asks you

The skill is written to stop and ask rather than to assume. It may stop several times in a row, which is the tool behaving as designed even though a newcomer reads it as failure.

**Which backlog?** It wants one work backlog directory, not several. It will not combine backlogs from different waves or revisions, and it will not run against a backlog whose index marks it as a candidate, superseded, blocked, or planning-only. Name the directory. If you are offered a list, pick by what the index says the backlog is for, not by date.

**Which adapter?** An adapter adds rules for one target platform. The next section explains what that means. Answer with the name of an adapter or with none, and expect the skill to wait for you rather than choosing on its own.

**What are the adapter's parameters?** Each adapter declares required values. The one shipped adapter requires a **publisher prefix**, the short string that the adapter's target platform puts in front of every custom component name so the customer's components are distinguishable from the vendor's. Get the real value from whoever administers that platform.

> **Watch out.** Never let the agent infer a parameter. The skill's own rule forbids inferring a prefix from the project name, from the repository, from an example inside the skill, or from a previous export. If you do not know the value, stop and find out. A wrong prefix produces work items that look correct and cannot be built.

**Which profile?** A profile is the exact column list and column order. `target17-new` is the default: seventeen columns, with the identifier, state and assigned-user columns present but always blank. Use `new` if your tracker rejects those blank columns. Use `update` only when you are changing work items that already exist and you have their real identifiers.

New items carry no identifier, no state and no assigned user on purpose, because the tracker assigns those on import. You fill in the rest at that point.

## What an adapter is

The base skill decides which part of your backlog becomes which kind of row. An **adapter** decides how the text inside those rows has to be written for one particular target platform: how deep each section must go, what properties each item must carry, and what its title has to look like.

An adapter is running code, not a note to the agent. Its checks are part of the `buildos export azure-boards` command, alongside a Markdown file under `.os/skills/buildos-export-azure-boards/adapters/` that states its authoring rules for you and your agent to read.

One adapter is registered today. It targets one business platform and the low-code components built on it. It sets a fixed title pattern, a fixed set of work-type codes, naming and quoting conventions, and a depth requirement for the technical section. Its code runs during `emit`, and its errors stop the file being written. Run the `adapters` command from step 2 to see its id and the one parameter it requires.

You do not have to use an adapter. If your backlog describes ordinary software work, or work across more than one platform, choose none. The base contract still gives you the full hierarchy, the three description sections, acceptance criteria, and the source trace. What you give up is the platform-specific title grammar and the platform-specific depth checks. The skill documents that fallback as a supported route.

## What the command can and cannot verify

This split matters, so read it before you trust a green result.

**Structure is what the command checks.**

- The header row matches the profile exactly.
- The file is UTF-8 with a byte-order mark. A **byte-order mark** is a few invisible bytes at the start of a file that tell a spreadsheet program which text encoding it is reading.
- There are between 1 and 1,000 work item rows.
- Each row fills exactly one title level.
- Every child follows a valid parent.
- The work item type matches the title level.
- Every backlog item has all three description sections and at least one acceptance criterion.
- The HTML uses only the supported tags and is balanced.
- No `TODO`, `TBD`, template marker or Markdown checkbox survives.
- New-item profiles carry no identifier, state or assigned user.
- Every backlog item carries its source trace.
- If an adapter is selected, its own deterministic rules run too.

**Meaning is beyond it.**

- Whether the description, the acceptance criteria and the title describe the same outcome.
- Whether the adapter you picked was the right one.
- Whether every stage in your backlog actually made it into the file.
- Whether the prose reads well enough to hand to a delivery team.

Those four fall to you and your agent, and the skill says so in as many words.

The split shows plainly in practice. A file can pass every structural check and import cleanly while the writing is still wrong. The use-case section describes traceability to the source task instead of a business need, and the description says to deliver the task exactly as bounded by the source backlog, which sends the reader back to the file they were trying to avoid opening. The item ends up hung up on governance instead of explaining what the work is for.

> **Watch out.** A green validation result does not mean the items are ready to work on. Read at least three backlog items in full before you import. When a whole column is wrong, ask your agent to rewrite it rather than editing rows by hand. On phrasing the titles, see [Build the work backlog](13-build-the-work-backlog.md).

## Import it and check the hierarchy

The export stops at the file, and a person carries out the import. The skill is explicitly told not to save work items in a tracker without separate approval, so that hand-off is deliberate.

1. **Find the import screen.** In at least one common tracker it sits under Queries rather than under Work Items, for historical reasons.
2. **Fill in what the export deliberately left blank** before you import: tags, states, and the iteration path. An **iteration path** is the tracker's name for the sprint or time box a work item belongs to. An **area path** is its name for the part of the product the item belongs to.
3. **Run the import**, and use the tracker's preview step if it offers one.
4. **Count what arrived.** Search the work items and compare the count with the row count the validator reported. If they differ, find out why before doing anything else.
5. **Open one epic and inspect its children.** Confirm the features hang off the epic and the backlog items hang off the features. A flat list and a correct tree of the same items look identical in a count.
6. **Open one backlog item** and confirm the description sections and acceptance criteria survived the import as readable text.

> **Watch out.** The area path may be wrong, and fixing it can need a tracker administrator you do not have direct access to, which will stall you. Find out who owns area paths in your project before import day.

## Known limitations

**One prefix per file.** The adapter permits exactly one publisher prefix across every item in the export, and it enforces that as a hard error. A backlog that spans one vendor's out-of-the-box components and one customer's own customisations therefore cannot use the adapter. The validator stops with a message of this shape:

```text
CSV declares more than one publisher prefix: <first>, <second>. One export uses one prefix.
```

This blocked a legitimate mixed export in practice. It was raised at the time and it has not been changed. The documented fallback is the one that was used: run the export with no adapter, on the base contract, and accept one complete mixed file. That keeps the hierarchy and the trace at the cost of the platform-specific rules.

**The generated prose needs review.** Covered above and in [Build the work backlog](13-build-the-work-backlog.md). Do not promise anyone ready-to-work items straight out of the export.

**The output can land somewhere nobody chose.** Agent tools have saved generated files to a desktop or a cloud folder without being asked. Name the destination path in your prompt every time, then check that the file is where you said.

**The skill can change between sessions.** A newer version may be installed without a changelog, so if the questions it asks change, that is usually the reason.

> **Not available yet.** Nothing syncs the tracker back to your work backlog. The export is one direction only. When work is completed in the tracker, the source files do not learn about it. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

## One important warning about the examples

The example files inside the skill use one invented publisher prefix, `ex_`, throughout, in the adapter documentation, the pin-file example, the manifest schema, and the worked example CSV. The skill's own rule says never to take an identifier from an example into a real export.

Confirm your own organisation's value with the person who administers the platform, and use only that. Do not infer it from an example, from the repository, or from a project name. The example value sits in the files in front of you and looks exactly like a default, which is how it ends up in real exports.

## What you should have now

- The exporter skill installed, and the `adapters` command printing its registered adapters.
- A successful smoke test whose output matches the shipped golden example.
- One export CSV built from your own work backlog.
- A validator run reporting `"valid": true`, with row counts by work item type.
- A record of which adapter you chose, or a note that you chose none and why.
- Work items in your tracker, counted, with one epic opened and its children checked.
- A short list of the descriptions and titles you had to send back for rewriting.

## Next

Read [Working with your agent](15-working-with-your-agent.md). Most of what went wrong in this article came down to how the work was asked for, reviewed, and corrected, rather than to the exporter itself.
