# Pull knowledge out of it

This page shows you how to turn the text you brought in during intake into typed rows that a person or an agent can query, count, and trace back to their source.

## What you need first

Read [Bring in source material](05-bring-in-source-material.md) first. This page assumes you have at least one converted source in `assets/`. You also need an agent tool of some kind, and you need to have edited `.os/config/instance.yaml` as described in [Install and configure your instance](04-install-and-configure-your-instance.md). Set aside an hour for your first pass.

## What extraction means here

You now have clean text. A person can read it, but you cannot count it, sort it, compare two versions of it, or ask which parts of it nobody has tested. So the next job is to read the text and write down what it contains as rows.

Two words do most of the work on this article.

An **entity record** is one line of JSON describing one thing, with a stable ID. It lives in a file under `.os/data/`. Think of each file as a table and each row as a line in that table: personas is a table, capabilities is a table.

An **extraction** is a record of one reading pass. It says which piece of which converted source was read and which entity records came out of it. The knowledge itself lives in those records, and the extraction row holds the accounting for where they came from.

The distinction that trips everybody, including people who built this system, is between *converting* and *extracting*. Converting turns a Word document into Markdown without reading it. Extracting reads the converted text and decides what it says. The two run at different times, and it is worth keeping the words apart when you talk about them.

> **Not available yet.** The shipped system has no extraction writer and no entity-record writer. `.os/data/extractions.jsonl` is an empty file, and no shipped command appends to it. The same is true for requirements, capabilities, personas, test cases, and results. Nothing writes them. Every row in this article is authored by hand, or by an agent that you have asked to write it. What ships is the contract that says what a correct row looks like, plus a validator that checks your rows against it. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

What keeps your rows consistent, then, is a written contract rather than a program.

## The record types

Four types matter when you are reading source material. A **contract** is the rule book for one artifact type: it says what fields are required and what states the artifact can be in. `.os/contracts/entity-records-contract.md` is the contract for all of these, and it is the authority for the full field list. What follows covers the shape and the reasoning behind it.

| Type | ID prefix | File | What it is |
| --- | --- | --- | --- |
| capability | `CAP` | `capabilities.jsonl` | Something the system *can* do. Descriptive. It may turn out to be false. |
| requirement | `REQ` | `requirements.jsonl` | Something the system *must* do. Normative. Somebody is tracking it. |
| persona | `PER` | `personas.jsonl` | A kind of user or stakeholder: their goals and their needs. |
| test case | `TC` | `test-cases.jsonl` | A repeatable check: what it verifies, its setup, its steps, its expected outcome. |

The capability-versus-requirement line is the one people ask about first. A capability states that a thing can be done, and it may be true or false, which is what testing is for. A requirement demands a capability, and the extra ingredient is ownership: somebody requires it and somebody is tracking whether it exists. Capabilities work as the spine, with requirements as a child table hanging off them.

A test case completes the picture. You have a capability you believe exists and a test that goes to see whether it does. Delivery afterwards tells you whether it really did.

All four record types carry the same envelope: `id`, `type`, `title`, `status`, `summary`, `source_anchor`, `source_refs[]`, `related[]`, `created_at`, `updated_at`.

There is also **`doc_anchor`**. `source_anchor` points back at the converted text a row came *from*. `doc_anchor` points forward at the written document that explains it, meaning a heading inside a file under `docs/`. Leave it out while a row is `draft`. Move the row to any other status and the validator requires it, and requires its path to start with `docs/`.

Three of those fields need more explanation.

**`status`** has exactly four values: `draft`, `active`, `superseded`, `archived`. It describes where the row sits in *your* review, not what the system you are studying thinks about it.

> **Watch out.** Statuses from the source system leak into this field. A vendor document that labels a feature "preview" or "candidate" will tempt an agent to write that word into `status`, and `candidate` in particular looks plausible because BuildOS does use it elsewhere, as a conversion state on a converted source, though never as an entity status. Tell your agent to map the source's own status into `summary` or `tags[]` and leave `status` alone.

**`source_anchor`** is the pointer back to the exact place in the converted text that this row came from. Think of it as the bibliography. Rows without it hold up fine until somebody asks where a number came from, or until the system you are studying renames something and you need to find every row that mentioned it.

**How to write one.** An **anchor** is a pointer to one heading inside a Markdown file. You write the path to the file, then `#`, then a label made from the heading text: lowercase it, drop the punctuation, and turn each run of spaces into a single hyphen. So if the converted twin `assets/lending-overview/lending-overview.md` contains this heading:

```markdown
## Loans and holds
```

then the anchor for it is:

```
assets/lending-overview/lending-overview.md#loans-and-holds
```

That lowercase-and-hyphen step is the ordinary Markdown convention rather than a BuildOS rule, and no contract under `.os/contracts/` defines one. The requirement is simply that the text after the `#` names a heading that is really in that file. So derive every anchor from a heading you have opened and looked at, and copy the heading text instead of recalling it.

**This rule is for anchors you write yourself**, pointing into a converted twin whose headings came from the original document. Anchors into a run's `raw-findings.md` work differently, because a tool writes that file and generates its headings. Those anchors are always `#raw-finding-1`, `#raw-finding-2`, and so on, numbered in order. You read them out of the file rather than deriving them. [Qualify what you found](09-qualify-what-you-found.md) covers that case.

> **Watch out.** Nothing checks that an anchor resolves. `buildos validate` checks the shape of the value: a path inside the project, one `#`, and a label after it, and for an extraction row a path that starts with `assets/`. It never opens the file. A row with a misspelt anchor will pass validation, and the next person who tries to follow that anchor is the one who finds out.

**Twins with no headings.** A CSV twin has no headings, and a `.txt` twin converted from a PDF often has none either. No contract says what to anchor to in that case. Pick one convention for your team, such as the worksheet name or the page number, write it down, and use the same one everywhere.

**`systems`, `environments`, and `owners`** are optional lists that scope a row. Every value in them must be an ID you configured in `.os/config/instance.yaml`. Made-up values fail validation.

### What a row actually looks like

The files hold one record per line. The examples below are spread over several lines so you can read them. Assume the subject is a community library's book-lending system.

A capability:

```json
{
  "id": "CAP-014",
  "type": "capability",
  "title": "Place a hold on a book copy for a patron",
  "status": "draft",
  "summary": "The system can hold a book copy for a patron before any loan exists.",
  "source_anchor": "assets/lending-overview/lending-overview.md#holds",
  "source_refs": ["assets/lending-overview/lending-overview.md#holds"],
  "related": ["REQ-021"],
  "created_at": "2026-03-02",
  "updated_at": "2026-03-02",
  "systems": ["lending-system"],
  "environments": ["vendor-baseline"],
  "owners": ["product-team"],
  "description": "A hold keeps one book copy for a named patron until a pickup date, without creating a loan.",
  "supports": ["REQ-021"],
  "limits": ["The source does not say whether a hold blocks a transfer of the copy to another branch."]
}
```

A requirement, which adds `statement`, `rationale`, and `acceptance_refs[]`:

```json
{
  "id": "REQ-021",
  "type": "requirement",
  "title": "Show the fine owed before checkout",
  "status": "draft",
  "summary": "The patron sees any fine owed before a new loan is made.",
  "source_anchor": "assets/lending-overview/lending-overview.md#fines",
  "source_refs": ["assets/lending-overview/lending-overview.md#fines"],
  "related": ["CAP-014", "TC-018"],
  "created_at": "2026-03-02",
  "updated_at": "2026-03-02",
  "statement": "The system must show the total fine a patron owes before a new loan is checked out.",
  "rationale": "Patrons ask what they owe at the desk, and staff need to tell them before they lend more books.",
  "acceptance_refs": ["TC-018"]
}
```

Write the rationale as a business reason. An agent left to itself will produce something like "must remain traceable to the approved task," which is bookkeeping rather than a reason anybody can argue with.

A persona adds `description`, `goals[]`, and `needs[]`:

```json
{
  "id": "PER-002",
  "type": "persona",
  "title": "Circulation desk clerk",
  "status": "draft",
  "summary": "Takes loan and hold requests and checks out book copies.",
  "source_anchor": "assets/lending-overview/lending-overview.md#roles",
  "source_refs": ["assets/lending-overview/lending-overview.md#roles"],
  "related": [],
  "created_at": "2026-03-02",
  "updated_at": "2026-03-02",
  "description": "Takes loan and hold requests at the desk and by phone, then checks out book copies against them.",
  "goals": ["Check out a copy the patron can take home the same day."],
  "needs": ["A live view of which copies are on the shelf at each branch."]
}
```

A persona is a described record, and it enforces nothing. There is no different security for a clerk versus a manager, because a persona carries no security at all.

A test case adds `verifies[]`, `preconditions[]`, `steps[]`, and `expected`:

```json
{
  "id": "TC-018",
  "type": "test-case",
  "title": "Checkout shows the fine owed",
  "status": "draft",
  "summary": "Check that checkout displays the full fine owed.",
  "source_anchor": "assets/lending-overview/lending-overview.md#fines",
  "source_refs": ["assets/lending-overview/lending-overview.md#fines"],
  "related": ["REQ-021"],
  "created_at": "2026-03-02",
  "updated_at": "2026-03-02",
  "verifies": ["REQ-021"],
  "preconditions": ["A patron exists with at least one overdue loan."],
  "steps": ["Open the patron's checkout screen.", "Read the fine presented to the patron."],
  "expected": "The checkout screen shows the total fine owed before the loan is made."
}
```

### The extraction row

Alongside those, one more row records the reading itself. It goes in `.os/data/extractions.jsonl` and its contract is `.os/contracts/extraction-contract.md`.

```json
{
  "id": "EXT-004",
  "type": "extraction",
  "status": "draft",
  "source_anchor": "assets/lending-overview/lending-overview.md#holds",
  "outcome_contract": "extraction-outcomes-v1",
  "minted": ["CAP-014", "REQ-021", "TC-018"],
  "referenced": ["PER-002"],
  "updated": [],
  "extracted_by": "product-owner",
  "extracted_at": "2026-03-02T14:02:00Z"
}
```

Those three lists are the point of the row. **Minted** means this reading created new records. **Referenced** means it reused records without changing them. **Updated** means it deliberately changed records.

**`outcome_contract`** names which version of the outcome rules the row follows. It has exactly one valid value today, `extraction-outcomes-v1`, and you write that string literally. Write it on every new extraction row. Its presence is what makes `minted`, `referenced` and `updated` required, all three of them even when a list is empty, and it is why one ID may appear in at most one of them. The contract calls the field optional only so that rows written before the rules existed stay valid.

That row answers the question people ask after a second pass over overlapping material, which is whether the re-run quietly re-scoped things they had already agreed. Anything listed in `updated` was changed, and anything listed in `referenced` was left as it was.

The nine ID prefixes in the registry are `REQ`, `CAP`, `PER`, `TC`, `RES`, `RUN`, `FIND`, `EXT`, and `PB`. Nothing else is valid. Agents do invent others, such as `REF`, `INT`, `GO` or a bare `Q`, and the validator rejects them.

## Where the records live

Eight files, one per row type, all in `.os/data/`:

`requirements.jsonl` · `capabilities.jsonl` · `personas.jsonl` · `test-cases.jsonl` · `results.jsonl` · `runs.jsonl` · `findings.jsonl` · `extractions.jsonl`

`runs.jsonl` and `findings.jsonl` are written by commands you will meet in [Write and run a playbook](08-write-and-run-a-playbook.md) and [Qualify what you found](09-qualify-what-you-found.md). The other six are yours, `extractions.jsonl` included.

Four of those eight files hold the record types above. One more needs naming here. A **result** is a row saying what happened when something was checked: which `TC`, `REQ`, `CAP`, `RUN` or `FIND` it targets, whether the outcome was `pass`, `fail`, `blocked` or `inconclusive`, and what evidence backs that. Results come out of running playbooks, so 08 is where you will write your first one.

That directory takes NDJSON, JSONL, or CSV and nothing else. Your own datasets go in `workspace/datasets/` instead, which covers spreadsheets a playbook consumes and exports you are keeping.

## How you do it today

The procedure below is what the work actually looks like today. You direct an agent, review what it proposes, and approve the rows that get appended.

1. **Decide the scope and say it out loud.** Name the converted sources you are treating as one extraction, and name what you are looking for. Thin results almost always trace back to a scope nobody stated. If you have four spreadsheets of prior backlog items and you did not mention them, they will not appear.
2. **Point the agent at the text and at the contract in the same instruction.** Give it the paths under `assets/` and the paths to `.os/contracts/entity-records-contract.md` and `.os/contracts/extraction-contract.md`. Naming the contract is what keeps the output consistent.
3. **Give it the rules before it starts.** A set of rules that works:

   - Do not invent a loader.
   - Where a safe data file and a contract exist, propose exact rows for review.
   - For each output, state whether there is deterministic tooling or the step is manual.
   - Read the applicable contract and cite it.
   - Proceed only with the outputs I approve.
4. **Read the plan it returns.** A capable agent will come back with a plan and a set of scoped options rather than a pile of rows. Pick one. Watch for the contract's own vocabulary coming back at you, such as "append one extraction row and mint draft capability rows", which is a good sign it read the contract instead of guessing.
5. **Review the proposed rows.** The next section covers how, and it is not a step to skip.
6. **Approve, and let it append.** Rows go on the end of the matching `.jsonl` file. New rows start at `status: draft`.
7. **Validate.** Run:

   ```
   .os/scripts/buildos validate
   ```

   When it passes you get exit code 0 and the line `OK. No problems found.` When it fails you get exit code 4 and, for each file, one line per problem with the field, what is wrong, and a code in brackets. It checks the envelope, the ID prefixes, the status values, the scope IDs against your `instance.yaml`, and `source_anchor`.

Commit before and after. No command in BuildOS undoes any of this, so version control is your only way back.

## What the contract does for you

Two people on your team, using two different agent tools, on two different days, can extract from the same document and produce rows that match. What makes that happen is that both of them point their agent at the same contract file and tell it to obey it. The contract is a written artifact in your repository, and any agent can read it.

So the quality of your data comes down to one habit, which is naming the contract in the instruction. An agent that has not read `entity-records-contract.md` will produce something that looks like a record and fails validation, or worse, passes validation and means something slightly different from every other row in the file.

## Reading your records back

Do not open these files. They are not written for people, and opening one may fail outright.

Ask your agent for a table instead:

> Give me a table in chat of all our capabilities, with ID, title, and status.

Then ask for the same table for requirements and compare the two. Seeing the two tables side by side is how the capability-versus-requirement distinction usually lands.

This is also the point of having a data layer at all. The records are plain text, in fixed shapes, so you can script against them, import them somewhere else, or map them to another system, with nothing hidden inside a database you cannot open. Because the shapes are fixed, the same files are what your agent reads when you ask it a question about the whole corpus, which keeps its answers anchored to what you actually collected.

> **Watch out.** The first table you ask for will include three rows about BuildOS itself. `REQ-001`, `CAP-001`, and `TC-001` ship as a seed and describe BuildOS's own playbook gate, not your system. They are easy to recognise and just as easy to leave in place, where they end up in a delivery backlog as a task nobody can explain. Delete or relabel them before you add your own. [Keep the record clean](11-keep-the-record-clean.md) covers this properly.

## Reviewing what the agent wrote

Checking a sample tells you very little about the batch it came from. Extraction produces many rows at once from one reading, so a single misunderstanding spreads through all of them.

A generated set that contradicts itself in one place usually contradicts itself in many. Patching the single row you found teaches you nothing about how many more are wrong, so ask for a sweep of the whole class instead.

Run these three checks, a few minutes each:

- **Count against the file, not against the summary.** Ask how many rows were written, then verify. Numbers get recomputed and re-narrated at each step and nothing reconciles them.
- **Spot-check the source anchors.** Pick three rows, open the converted text at the anchor, and confirm the row says what the text says.
- **Check for names nobody approved.** If a source document contains a guessed or placeholder name for something in the target system, extraction will have promoted that guess into a fact. Only personas have any protection against this, and even that requires a deliberate human write.

The full review procedure lives in [The review sweep](15-working-with-your-agent.md#the-review-sweep). Read it before your first large extraction.

> **Watch out.** Expect the volume to surprise you. A single pass can produce hundreds of capabilities, while a stock checkout holds one requirement, one capability, and one test case. Four rows from a forty-page document usually means the scope was never stated. Twelve hundred rows means nobody has reviewed them yet, which is a review problem rather than a data problem.

## What you should have now

- A clear line in your own head between converting a document and extracting from it
- At least one `EXT-NNN` row in `.os/data/extractions.jsonl` naming what it read and what it produced
- Capability, requirement, persona, or test case rows in their own files, all at `status: draft`
- A passing run of `buildos validate`
- The three seeded BuildOS rows deleted or relabelled
- A way to read your data that does not involve opening a `.jsonl` file

## Next

[Write and run a playbook](08-write-and-run-a-playbook.md), which turns what you now know about the system into a procedure that goes and checks it.
