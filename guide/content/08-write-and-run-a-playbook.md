# Write and run a playbook

This page shows you how to write the instruction file that tells a person or an agent to go poke at the system you are studying, how to switch it on, how to run it, and what lands on disk afterwards.

## What you need first

Read [Install and configure your instance](04-install-and-configure-your-instance.md) first. This article assumes your `.os/config/instance.yaml` names your real systems, environments and owners, and that `buildos intake` and `buildos discovery` both answer when you run them.

You also need an agent tool that can drive a browser, and a person who can sign in to the system you are studying. Both are covered below.

Run every command in this article from your project root.

## Exploring and testing use the same loop

Exploring a system and testing it run through one procedure rather than two. You write a playbook, a person switches it on, an agent runs it, and the run leaves a record on disk. The only thing that changes is which of four folders the playbook lives in. The run mechanics, the review gate, the record shape, the evidence capture and the qualification step that follows are identical, so this article covers both.

## What a playbook is

A **playbook** is a short Markdown file that tells a person or an AI agent how to do one job. It has a fixed header block and a fixed set of sections. It lives in the repository at `playbooks/<category>/<slug>.md`.

A playbook describes a test. It is not the test itself. The file holds everything the person or the agent needs to carry out the job: what the job is, what must be true before it starts, what to do, and what a good or bad result looks like.

Playbooks are short on purpose. An agent running one also reads the source material you brought in and the records already in the system, so the playbook only has to supply the guidance and the boundary.

Playbooks are written for both people and agents. Think of the job as something a person could do with a mouse, a keyboard and a browser. If a person could follow it, so can an agent, and the same file serves both.

Playbooks also work as guardrails. A playbook says what you should not do, as well as what you should. That second job gets its own kind of playbook, described further down.

## The four categories

The **category** is which of four folders the playbook lives in, so the folder decides the category. There are exactly four, and you cannot add a fifth.

| Folder | What belongs in it |
| --- | --- |
| `playbooks/administrative/` | Setup, governance rules, loading data, running scripts. |
| `playbooks/build/` | Compiling, packaging, deploying. |
| `playbooks/discovery/` | Exploring: checking schemas, forms, screens, and whether a normal user can find something. |
| `playbooks/testing/` | Unit, integration and end-to-end tests. |

Every folder name here refers to the system you are studying rather than to BuildOS. A capable newcomer read `administrative` as "administering BuildOS" and got the whole folder backwards. Reading each name with "the system" after it fixes that: administering *the system*, building *the system*, discovering *the system*, testing *the system*.

> **Watch out.** The categories are fixed at four. The contract that governs playbooks defines `administrative`, `build`, `discovery` and `testing` and nothing else. If your job does not fit neatly, pick the closest one rather than making a new folder. The run command will not recognise a playbook sitting in a folder it does not know.

## Procedure playbooks and guardrail playbooks

There are two kinds of playbook, and they have different body shapes.

A **procedure playbook** is one you actually run. It produces evidence and it leaves a record.

A **guardrail playbook** is a rule rather than a job. It never runs and it produces nothing. It states what you must and must not do. Two guardrails ship with the system today, and both are switched on: one forbids editing the documentation plug-in's folders directly, the other requires every scoped field to use IDs that appear in your configuration file.

Guardrails are worth writing. An agent that finds a guardrail will cite the rule and change what it was about to do, purely because the file sits next to the work.

Writing a guardrail is covered in its own section near the end of this article.

## The two typing axes

Every procedure playbook declares two things about itself. Both go in the header block.

**`execution_mode`** says how much the playbook spells out.

| Value | What it means for you |
| --- | --- |
| `explicit-steps` | You write the exact steps. The agent does exactly what you wrote and nothing more. Choose this when you already know the click path. |
| `guided-objective` | You write the outcome you want plus some guidance, and the agent works out how to get there like a user would. Choose this when you want to find out whether the path is findable at all. |
| `inferred-actions` | You write the goal and the agent works out the steps from what it can read. Choose this when the steps depend on things you cannot see from here. |
| `n/a` | Guardrails only. |

**`state_nature`** says what the playbook does to the system it touches.

| Value | What it means for you |
| --- | --- |
| `stateful` | The job needs a particular starting state and it changes that state. A `## Preconditions` section is required. |
| `standing` | The job is safe to run at any time and leaves nothing behind. |
| `guardrail` | A rule, not a run. |

Take `stateful` seriously. A change one run makes is still there for the next run. A workaround applied to unblock a test can permanently remove your ability to observe the original problem. The `## Preconditions` section exists to catch that case.

There is a third field, `harness`, which names the kind of tooling the job needs. It has five values: `browser` for driving a web browser, `computer-use` for controlling the screen, keyboard and mouse, `mcp` for reaching an external tool through the connector protocol your agent speaks, `shell` for running commands, and `none`. Each value names a capability rather than a product. See [Harness independence and trust](16-harness-independence-and-trust.md).

## The templates

Seven playbook shapes ship with the system, in `.os/templates/`. Six of them are the combinations of the three execution modes and the two runnable state natures. The seventh is the guardrail.

| Template file | Use it when |
| --- | --- |
| `procedure-playbook-explicit-steps-standing.md` | Ordered steps, safe to run any time. |
| `procedure-playbook-explicit-steps-stateful.md` | Ordered steps, needs and changes a starting state. |
| `procedure-playbook-guided-objective-standing.md` | Outcome plus guidance, safe to run any time. |
| `procedure-playbook-guided-objective-stateful.md` | Outcome plus guidance, needs and changes a starting state. |
| `procedure-playbook-inferred-actions-standing.md` | The agent works out the steps, safe to run any time. |
| `procedure-playbook-inferred-actions-stateful.md` | The agent works out state-changing steps. |
| `guardrail-playbook.md` | A rule, not a job. |

The templates are conveniences. The authority is the contract at `.os/contracts/playbook-contract.md`. When a template and the contract disagree, the contract wins.

## Procedure 1 · Write a playbook

Start from a real problem you actually hit. A playbook written from an obstacle you met yourself tends to ask better questions.

1. Pick the category. Say the folder name out loud with "the system" after it. If you hit a wall doing something and want to prove it, `testing` is usually more accurate than `discovery`. If you want to find out whether something is findable at all, use `discovery`.

2. Pick the two axes. Decide how much you want to spell out (`execution_mode`) and whether the job changes the system (`state_nature`).

3. Copy the matching template into the category folder, renaming it to a slug. The slug is lowercase with hyphens.

   ```
   cp .os/templates/procedure-playbook-guided-objective-stateful.md playbooks/discovery/check-hold-pickup-notice.md
   ```

4. Pick the next free ID. Playbook IDs are `PB-NNN` in a single flat sequence across all categories. Six playbooks ship, numbered `PB-001` to `PB-006`, so a new one starts at `PB-007`. The list is in `.os/indexes/playbooks.json` and in `playbooks/AGENTS.md`.

5. Fill in the header block. The header is **YAML frontmatter**, a block of `field: value` lines fenced by `---` at the very top of the file. The contract requires sixteen fields. The table below covers all sixteen, with `systems`, `environments` and `owners` grouped into one row because you fill them in the same way:

   | Field | What to put in it | | --- | --- | | `id` | The `PB-NNN` you picked in step 4. | | `title` | A short imperative name, such as `Inspect UI discoverability`. | | `category` | Must equal the folder the file is in. | | `execution_mode` | From step 2. | | `state_nature` | From step 2. | | `status` | Leave it as `draft`. See procedure 2. | | `audience` | `human`, `agent` or `both`. All six shipped playbooks use `both`. | | `harness` | A list, such as `[browser, computer-use]` or `[shell]`. | | `systems`, `environments`, `owners` | Lists of IDs from your `instance.yaml`. Nothing else is allowed here. | | `targets` | IDs of records this job is about, such as `[REQ-001, CAP-001]`. May be empty. | | `produces` | What a run leaves behind: `[run-record]`, `[finding]`, `[dataset]`, or a combination. | | `source_anchor` | Where this playbook came from, if source material prompted it. Otherwise the bare word `null`, meaning empty. | | `version` | A three-part version number, `major.minor.patch`. Start at `1.0.0`. | | `related` | Links to the contract and to anything relevant. May be empty. |

6. Fill in the body. A procedure playbook needs these sections, in this order:

   - `## Objective`. The one job, in a sentence or two.
   - `## Preconditions`. Required when `state_nature` is `stateful`. What must be true before this starts, and what must not be present.
   - `## Steps & Guidance`. The steps, or the outcome plus guidance, depending on your `execution_mode`.
   - `## Expected Signals`. Three groups: positive, negative and inconclusive. What each result would look like.
   - `## Produces`. What a run of this leaves behind.
   - `## Notes / Links`. Optional.

7. Write `## Expected Signals` before anyone runs it. In one session a step in the target system appeared to succeed and silently did not do the second half of its job. There was no error message, and only someone who already knew to go and check afterwards would have caught it. Writing down what success looks like beforehand is what stops a run passing quietly.

8. Keep it short, and do not restate the source material, because the agent reads that too.

You can ask your agent to draft the playbook. An agent pointed at the contract will produce a correctly shaped file with the right sections without being told what they are. Give it the real problem in plain language: what you are trying to do, what is happening, and what the finish line looks like. Then read what it wrote.

> **Watch out.** Do not write a playbook for something an agent cannot do. Agents drive browsers, not phone apps, so a playbook aimed at a native mobile application with no web equivalent has nothing to run against. Check that the job can be done with a mouse, a keyboard and a browser before you write it.

> **Watch out.** A playbook does not produce a repeatable test script. The script goes the other way round, as an input to the step *after* the run. See [Qualify what you found](09-qualify-what-you-found.md).

## Procedure 2 · Activate it

A new playbook starts at `draft`, and a `draft` playbook refuses to run. Nothing happens until a person moves it to `active`.

This gate is called **review-to-activate**. The full sequence of states is `draft` → `reviewed` → `active` → `archived`. Only `active` playbooks run, and only `active` guardrails apply.

The system never states the reason for the gate. It is that your agent is about to drive a browser against a real system on your behalf, and a person should read the instructions before that happens.

1. Open the playbook file.
2. Change `status: draft` to `status: active`. It is the sixth line in the header block.
3. Save the file.
4. Rebuild the playbook index.

   ```
   .os/scripts/buildos intake index playbooks
   ```

   You should see a line like `wrote .os/indexes/playbooks.json (6 playbooks)`. The number is the total count of playbooks, not the count of active ones.

5. Check that the tool can see it. Open `.os/indexes/playbooks.json` and look at the `runnable_playbooks` list. Your `PB-NNN` must be in it.

An **index** is a generated lookup file. It is never the source of truth. You can delete it and rebuild it at any time. The run command reads the index rather than the folder, which is why step 4 matters.

> **Watch out.** Step 4 is the one people skip. The playbook then looks `active` when you open the file and stays invisible to the tool, which produces a confusing "not active" error on a file that plainly says `active`. If a run refuses a playbook you activated a moment ago, rebuild the index.

> **Watch out.** An agent can flip `status` for you. An agent told to run a playbook may edit the field and rebuild the index itself, with no human reading anything. That defeats the gate. If you want the gate to mean something, do steps 1 to 3 yourself.

> **Not available yet.** The review-to-activate gate has no tooling. Activation is a hand edit of the header block plus an index rebuild, and no approval is recorded anywhere. There is no way to tell later who reviewed a playbook or when. If your team needs an audit trail, record the review in your own commit message or work tracker. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The `reviewed` state exists in the contract and is rarely used. Going straight from `draft` to `active` is fine, provided a person does the reading.

## The stock-checkout problem

You cannot start the discovery loop on a fresh copy of the system.

> **Not available yet.** No discovery playbook is switched on out of the box. Six playbooks ship and only three are `active`, and all three of those are administrative. The one discovery playbook, `PB-005` at `playbooks/discovery/inspect-ui-discoverability.md`, is `draft`. The run command requires an `active` playbook whose category is `discovery`, so nothing will run until you either activate `PB-005` or write and activate your own. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The fix is procedure 2, applied to `PB-005` or to a playbook you wrote. Do it once, before your first run rather than partway through one.

There is a second step for `PB-005`. Its header says `targets: [REQ-001, CAP-001]`: two seeded BuildOS records that are `draft`. A discovery run looks up every ID in `targets`, and each one must lead to an `active` record. A `draft` target stops the run with `redirect_inactive_terminal`, and nothing is written. So when you activate `PB-005`, also set its targets to an empty list, and then rebuild the playbook index (procedure 2, step 4), because the run reads the targets from the index:

```
targets: []
```

Later, when records of your own are `active`, put their IDs there. A record becomes `active` only after a person reviewed it; the records you wrote in [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) are still `draft`, so they cannot be targets yet.

A second limit shapes how you plan the rest of the work.

> **Not available yet.** The shipped command is `buildos discovery run discovery`, and it accepts only a playbook whose category is `discovery`. There is no matching command for a `testing`, `build` or `administrative` playbook. Record those runs by hand, following the shape in `.os/contracts/run-record-contract.md`. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

Playbooks in the other three categories still work as playbooks. You write them, a person activates them, and a person or an agent follows them. The missing piece is a tool to write the run record at the end.

## Procedure 3 · Run it

A **run** is one recorded attempt at doing something. A **run record** is the folder it leaves behind.

Three things have to be in place before you start. Only the first of them is inside BuildOS.

- An `active` discovery playbook, visible in `runnable_playbooks`.
- A real browser, already signed in to the environment you are studying.
- The address of that environment, which you supply by hand.

The steps:

1. Check which branch you are on and commit anything outstanding. A **branch** is one line of history in your version control. A repository can hold several at once, and you are always working on one of them. Run:

   ```
   git branch --show-current
   ```

   Your editor will happily show you one branch while your agent works on another. Committing first also gives you a point to roll back to.

2. Tell your agent which playbook to run, which environment, and which browser to use. Give it the environment address, either pasted in or by pointing the agent at the file where you keep addresses. Name the playbook by its ID.

3. Let it work. It reads `## Steps & Guidance` and works through the job, clicking like a user. Expect this to be slow. An agent may take several times as long as a person would, and what that time buys you is the evidence.

4. Answer its questions. It will stop and ask, which is correct behaviour. When it asks which data to use, tell it to pick something that already exists rather than inventing a record. In one session an agent was about to create a test record that did not exist, and was told to use one that was already there.

5. When the job is done, record the run.

   Two of the arguments point at files you make yourself, before you run the command. `--evidence` takes something captured during the run: a screenshot, a log, an export. `--raw-finding` takes a plain text or Markdown file holding one observation, written in your own words. Neither has a defined home in BuildOS, so keep them outside the BuildOS directories. This example uses a `captures/` directory at your project root.

   ```
   .os/scripts/buildos discovery run discovery --playbook-id PB-005 --outcome inconclusive --title "Hold pickup notice" --evidence captures/screenshot-01.png --raw-finding captures/observed.md
   ```

   The command copies each evidence file into the run's `evidence/` folder, with a number in front of its name (here `001-screenshot-01.png`), and copies the text of each raw-finding file into `raw-findings.md` as its own numbered section.

   `--outcome` is required and must be `positive`, `negative` or `inconclusive`. `--evidence` and `--raw-finding` can each be repeated. Add `--dry-run` to see what it would write without writing anything.

6. Read what it wrote. Open the new folder under `workspace/runs/` and check it says what you think happened.

If the playbook is not activated and indexed, step 5 stops with `buildos-discovery: error: playbook PB-005 is not active/runnable`. If you name a playbook from the wrong folder, it stops with `playbook PB-003 is "administrative"; run discovery requires category discovery`. If a target is not `active`, it stops with `resolve discovery target CAP-001: ... redirect_inactive_terminal` (see "The stock-checkout problem" above). Each is the gate refusing, rather than a fault.

> **Not available yet.** Your configuration file has no field for an environment address. The `environments` section holds an ID, a name, the systems it belongs to and a description, and nothing else. You supply the address on every single run. Keep the addresses in a file in your repository and point your agent at it, or paste from it. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

The file to keep them in is your **standing orientation note**. That is an ordinary Markdown file, in the repository, holding the facts about your work that BuildOS has nowhere to store and your agent has no way to guess: what you are trying to achieve, which environment is which and at what address, who the people named in `owners` actually are, and any assumption your whole record set rests on. Nothing reads it automatically. You paste it, or point your agent at it, at the start of a session.

BuildOS defines no name and no location for it, so pick one and keep it. A file called `ORIENTATION.md` at your project root works. Write the facts down as you learn them. When a generated set of documents turns out to be built on a wrong assumption, this is the file you correct first, before you regenerate anything. See [Working with your agent](15-working-with-your-agent.md).

## Browser and computer use

The command in step 5 records a run. It does not drive a browser. The system says so about itself, in the router at `workspace/runs/AGENTS.md`: the live computer-use or browser harness remains external, and this directory records the inputs, evidence, raw findings and outcomes after the run.

That split is deliberate. BuildOS is files on disk, and your agent tool does the clicking.

Be ready for this to take time. Connecting an agent to a real browser can cost you an afternoon.

It is also the one capability where agent tools genuinely differ. Most of BuildOS works the same whatever tool you use, because it is plain text and the instructions live next to the files. Browser and computer control varies instead. Some tools have it and some do not, some organisations block the tools that have it, and quality varies a lot. It is the most likely reason to switch tools.

> **Watch out.** Do not use your agent tool's built-in browser if it has one. A built-in browser often cannot hold a login, producing repeated sign-in prompts, an application that never loads, and bounces back to the home page. Drive a real desktop browser instead, one that already has your session in it.

> **Watch out.** Check which browser profile you are driving. Using the wrong one fails in ways that are easy to miss.

For what differs between tools and what does not, see [Harness independence and trust](16-harness-independence-and-trust.md).

## Credentials

You sign in yourself, and the agent never sees your credentials.

The agent gets no access to authentication. A person signs in to the browser, including whatever second factor is required, and the agent then drives a browser session that is already authenticated. You run it, you receive the second factor, and you pass the session through.

Two things follow from that.

The agent works as you. Everything it does in the target system is done by your account, under your permissions, and it will appear in that system's audit log as your activity. Run against a test environment where you can afford that.

Nothing here bypasses a security control. The session is an ordinary authenticated browser session belonging to a real user who signed in normally.

> **Watch out.** Everyone tests as a highly privileged user, because that is who is sitting at the keyboard. That means behaviour that only shows up for a restricted user is not being exercised at all. BuildOS records a persona as a description, not as a set of permissions, so nothing in the system will flag this for you. If a finding depends on what a limited user can see, sign in as one.

## What lands on disk

One run produces one folder plus one line in an index file.

```
workspace/runs/RUN-001/
    run.md
    raw-findings.md
    evidence/
```

**`run.md`** is the human-readable summary. It carries the run ID, a title, `status`, the `outcome`, the `playbook_id` it came from, the three scoped lists (`systems`, `environments`, `owners`), start and end timestamps, and three lists of links: evidence, raw findings, and qualified findings.

`status` is `running`, `closed` or `aborted`. `outcome` is `positive`, `negative` or `inconclusive`, and is required when the run closes.

**`evidence/`** holds the raw material captured during the run: screenshots, logs, command output, transcripts, exported data. Once the run closes, these files are frozen.

**`raw-findings.md`** holds the things somebody noticed but has not proved. They have no ID. The command writes one numbered heading per `--raw-finding` file you gave it:

```
# Raw Findings for RUN-001

## Raw Finding 1 {#raw-finding-1}

The hold screen showed no pickup notice for any of the three book copies tried.
```

The label in curly braces is the **anchor**: how you point at one heading inside a Markdown file. Qualification asks you for one of these.

**One row in `.os/data/runs.jsonl`.** This is the structured index of runs. It mirrors the fields in `run.md` and adds the path, the evidence count and the raw-finding count. The same command writes both the folder and the row.

Closed and aborted run records are immutable. Do not go back and edit one to make a finding look better. Anything you learn afterwards belongs in a new run.

`inconclusive` is one of the three legitimate outcomes. It means the run could not confirm one way or the other whether the assertion was true, so no qualified finding came out of it.

> **Watch out.** No example run ships with the system. `workspace/runs/` and `workspace/findings/` contain nothing but their router files. Your first run will be the first thing in there, and you will have nothing to compare it against. Read `.os/contracts/run-record-contract.md` before you decide your run record looks wrong.

## What a raw finding is

A **raw finding** is something you noticed during a run that has not been proven yet. It has no ID. It lives as an anchor inside that run's `raw-findings.md` and nowhere else.

Its anchor is the numbered one the run command wrote: `#raw-finding-1`, `#raw-finding-2`, and so on. [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) explains anchors in general, including the ones you write yourself.

Noticing is not enough on its own. Observations arrive in different states of confidence: a suspected bug, a status written down with doubt, or a sense that several problems are tangled together. Each one is worth writing down, and none of them is yet something you could hand to somebody else and expect them to act on.

The same idea shows up as a colour-coded spreadsheet: green means it looks fine, yellow means I need to talk to you about it, red means it is broken. The yellow rows are the raw findings.

A raw finding becomes trustworthy when a repeatable test proves it. That step is [Qualify what you found](09-qualify-what-you-found.md), and it is the next thing you should read.

## Procedure 4 · Write a guardrail

A guardrail is a playbook that states a rule. It never runs.

1. Copy the guardrail template.

   ```
   cp .os/templates/guardrail-playbook.md playbooks/administrative/never-edit-generated-indexes.md
   ```

2. Set the header fields that make it a guardrail. All four are required and none is optional: `state_nature: guardrail`, `execution_mode: n/a`, `harness: [none]`, `produces: []`.

3. Write the body. A guardrail has a different shape from a procedure:

   - `## Scope`. When it applies and to whom. Say if it is always in force.
   - `## Rules`. A **MUST NOT** list and a **MUST** list.
   - `## Rationale`. Why the rule exists and what breaks without it.

4. Activate it with procedure 2. Only `active` guardrails apply.

The two shipped guardrails are the model. `PB-001` forbids editing the documentation plug-in's folders directly. `PB-002` requires every `systems`, `environments` and `owners` field to use an ID from the configuration file, with no legacy field names and no catch-all values like `both`, `all`, `any` or `default`.

> **Watch out.** A guardrail works by being read, and no program enforces it. There is one validator you run by hand, and beyond that an agent obeys a guardrail because it found the file and chose to. Do not write a guardrail and assume the rule is now impossible to break.

> **Watch out.** The `runnable_playbooks` list in `.os/indexes/playbooks.json` contains guardrails, which by contract never run. The list really means "active playbooks". Do not read a guardrail's presence there as a sign that something will execute it.

## Traps

Collected here because they cut across the whole page.

**You will not be able to find your own playbook.** This happens to everyone. Stop browsing folders and indexes, and ask your agent in plain language instead. Ask for a table if the answer is a list.

**The gate will stop you and you will not expect it.** A `draft` status is what usually interrupts a first run. When a run refuses, check `status` first and the index second.

**Signing in will stall.** Budget for it. If the sign-in fails repeatedly and you are driving a real browser with a working profile, consider that something outside your control may be blocking it. Two likely causes are an organisation blocking agent-driven browsers, and a vendor blocking them at the application. Neither is something BuildOS can fix.

**The agent stops for approval on every action.** That is your tool's default setting, not BuildOS. Most tools have a mode that reduces the interruptions. Know where that setting is before you start a long run, and understand what you are agreeing to when you change it.

**The agent may do work you did not ask for.** Agents renumber references, run version-control commands to stay in sync, and install packages mid-run. Read the differences in version control after a run, which is where you see what it actually touched.

**Long runs outlast the meeting.** A run can take minutes or hours. Start long work well before you need the answer.

More of these, with what to do about each, are in [When things go wrong](17-when-things-go-wrong.md).

## What you should have now

- A playbook file in one of the four category folders, with all sixteen header fields filled in and a body that matches its `execution_mode` and `state_nature`.
- That playbook showing `status: active` and appearing in the `runnable_playbooks` list in `.os/indexes/playbooks.json`.
- A folder at `workspace/runs/RUN-NNN/` holding `run.md`, an `evidence/` directory and `raw-findings.md`, plus one matching row in `.os/data/runs.jsonl`.
- A clear sense of which of your observations are raw findings, and therefore not yet something anyone else should act on.
- If you wrote one, an `active` guardrail with `## Scope`, `## Rules` and `## Rationale`.

## Next

[Qualify what you found](09-qualify-what-you-found.md), covering how a raw finding becomes a permanent record that somebody else can check.
