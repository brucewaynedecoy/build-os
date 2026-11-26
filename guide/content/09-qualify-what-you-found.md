# Qualify what you found

This article shows you how something you noticed during a run becomes a permanent record that somebody else can check, and why that step is what makes the slow run worth doing.

## What you need first

Read [Write and run a playbook](08-write-and-run-a-playbook.md) first. This page assumes you have a run record on disk at `workspace/runs/RUN-NNN/`, and that its `raw-findings.md` holds at least one observation worth pursuing.

Run every command in this article from your project root.

## Two kinds of finding

A **raw finding** is something you noticed during a run that has not been proven yet. It has no ID. It lives as an anchor inside that run's `raw-findings.md`.

A **qualified finding** is a raw finding that passed a repeatable test. It gets a `FIND-NNN` ID and its own folder, holding the finding and the test that proved it.

What separates the two is whether somebody else can run the test and get the same answer. Confidence does not come into it, and neither does the seniority of whoever noticed the problem.

**Qualification** is that test.

## Why this step exists

The test exists to prove the gap to somebody who did not do the work. They do not have to take your word for anything. They run it and see the same result.

It also keeps proving it. The test stays in place while the gap stays open, and when somebody fixes the underlying problem the same test changes its answer, which is how you learn the gap has closed. Nobody has to rewrite anything for that to work.

There is an obvious objection: a test script has no value until the thing exists, and stops being useful once somebody changes it. The answer is the one above. What the script is really for is marking the moment the behaviour changed, and it does that whether or not anyone is watching.

The slow run pays for itself here. An agent working through a system by hand is slow and never exactly repeatable, and you carry that cost once in exchange for a test anyone can re-run in seconds.

There is a quieter reason too. When you actually go and do the thing, a lot of detail appears and the whole question becomes concrete. You run the query and real records come back. Now you can say that this is what you wanted, or that something you needed is missing. Writing the confirmation test forces that moment, because a claim you have not really pinned down is hard to write a passing test for.

## What qualification requires

Both of the following are required.

**A raw-finding anchor.** A pointer to the specific observation inside a specific run's `raw-findings.md`. This is what ties the claim back to the attempt that produced it. The procedure below shows one. See also [Pull knowledge out of it](07-pull-knowledge-out-of-it.md), which explains what an anchor is and how to write one.

**A confirmation test.** A deterministic, repeatable procedure that reaches a pass. The contract is blunt about what does not count. A one-off observation, unrepeatable evidence and intuition all fail it. The test has to be specific enough that somebody else, later, can run it and reach the same conclusion.

A finding also has a **polarity**. `positive` means the test confirms something is there. `negative` means the test confirms something reliably is not there, or reliably fails. A run that produces a negative finding has succeeded.

Negative findings qualify only when the test asserts the negative and passes. "I could not find it" fails that bar. "This procedure, run in this order, reliably produces no result at this step" clears it.

## Procedure · Qualify a finding

1. Open `workspace/runs/RUN-NNN/raw-findings.md` and find the observation you want to pursue. Note its anchor.

   Here is what you are looking at. The run command wrote this file, and it gave every observation you passed it a numbered heading:

   ```
   # Raw Findings for RUN-001

   ## Raw Finding 1 {#raw-finding-1}

   The hold screen showed no pickup notice for any of the three book copies tried.

   ## Raw Finding 2 {#raw-finding-2}

   The copy list was slow to load on the third attempt.
   ```

   The part in curly braces is the **anchor**: the label you use to point at one heading inside a Markdown file. Here the anchors are `#raw-finding-1` and `#raw-finding-2`. The tool numbers them in the order you passed the `--raw-finding` files, so the first file you named is Raw Finding 1. [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) explains anchors in general, including the ones you write by hand.

2. Write the confirmation test. It must reproduce the observation on demand. Nothing in BuildOS writes this for you.

3. Run it yourself and keep what it produces. That output is your confirmation evidence.

4. Build the reference. `--raw-finding-ref` takes a path, then `#`, then the anchor. For Raw Finding 1 in the file above, the path is `workspace/runs/RUN-001/raw-findings.md` and the anchor is `#raw-finding-1`, so the argument is:

   ```
   --raw-finding-ref workspace/runs/RUN-001/raw-findings.md#raw-finding-1
   ```

   Two shorter forms work as well, because the command already knows the run from `--run-id`: `--raw-finding-ref raw-findings.md#raw-finding-1`, and just `--raw-finding-ref '#raw-finding-1'`. The command checks that the anchor exists in the file and stops if it does not.

5. Run the qualify command.

   ```
   .os/scripts/buildos discovery qualify finding --run-id RUN-001 --raw-finding-ref workspace/runs/RUN-001/raw-findings.md#raw-finding-1 --outcome negative --title "No pickup notice appears on a hold" --confirmation-test tests/hold-pickup-notice.spec.ts --confirmation-evidence tests/output/hold-pickup-notice.txt
   ```

   `--outcome` is `positive` or `negative` here. There is no `inconclusive`, because an inconclusive result never becomes a qualified finding. Add `--dry-run` to see what it would write without writing anything.

6. Read what it wrote. Open the new folder under `workspace/findings/` and check that `qualification.md` describes a test you would be happy for a stranger to run.

## What lands on disk

One qualified finding produces one folder plus one line in an index file.

```
workspace/findings/FIND-001/
    finding.md
    qualification.md
```

**`finding.md`** is the record itself. It carries the `FIND-NNN` ID, a title, `status`, `polarity`, the `origin_run` it came from, the `raw_anchor` pointing back into that run's raw findings, a link to the qualification test, the three scoped lists (`systems`, `environments`, `owners`), the timestamp it qualified at, and two lists of links: designs and related records.

`status` is `qualified`, `designed` or `archived`. `qualified` is where every finding starts.

**`qualification.md`** is the test. It must record five things:

| Field | What it holds |
| --- | --- |
| `test_type` | What kind of test this is. |
| `procedure` | The exact repeatable path: the steps or the command. |
| `assertion` | What must be true for the finding to qualify. |
| `result` | Must be `pass`. A qualified finding requires a passing confirmation. |
| `evidence` | Links to the run's frozen evidence, or to the confirmation evidence. |

**One row in `.os/data/findings.jsonl`.** This is the structured index of findings. The same command writes both the folder and the row, with `status: "qualified"`.

The qualification links back to the run's evidence and leaves the run itself untouched. Run records are immutable once closed, and qualifying a finding does not change that.

Read `finding.md` and `qualification.md` directly. Do not try to read `findings.jsonl` by opening it. It holds one record per line with no line breaks inside a record, which suits a program and defeats a person. An editor may refuse to open one because the line is too long. When you want to see what is in there, ask your agent for a table.

Moving a finding into a design is a separate step that a person decides. See [Designs, plans and PRDs](12-designs-plans-and-prds.md).

## A mismatch between the contract and the tool

The contract and the shipped tool disagree about what a confirmation test may be, and you should know which one you are dealing with.

The contract at `.os/contracts/finding-contract.md` is deliberately open. It defines `test_type` as a command, a manual procedure, a harness, a script, or any other deterministic method. By that definition a written procedure that anyone can follow and get the same answer is a legitimate confirmation test.

The shipped tool is stricter. The `--confirmation-test` flag on `buildos discovery qualify finding` describes its argument as a deterministic browser-test file in one specific test technology. That is narrower than the contract allows.

If your confirmation test is a browser test in the technology the tool expects, the command works as written. If your test is a command, a script in another language, or a written manual procedure, the contract is on your side. Use the command anyway, pass the file that holds your procedure, and describe the real `test_type` accurately in `qualification.md`. Do not misrepresent a manual procedure as an automated one to satisfy a flag.

> **Not available yet.** Nothing in BuildOS generates a confirmation test for you. There is no command, no template, and no defined place for test files to live. The three folders under `workspace/` are `runs/`, `findings/` and `datasets/`. There is no `tests/`. You write the test, you choose where it lives, and you pass its path to the qualify command as an argument. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

In practice teams have done this two ways. In the first, a person performs the job by hand, writes down each step as they confirm it, and then writes the script from those confirmed steps. In the second, the agent writes the script while it performs the run, capturing a screenshot at each screen change. That one is faster and needs more checking, and both of them produce usable tests.

> **Watch out.** Confirmation tests need maintenance. Browser tests identify elements on a screen, and those identifiers change when the screen changes. The identifiers are not always captured reliably, and there comes a point where fixing the test costs more than testing by hand. Treat a confirmation test as something you own and maintain over time.

## What happens to a finding you cannot prove

Some findings cannot be qualified at all, and the contract does not acknowledge this.

Consider a mismatch between the way a library lending system assumes copies are shared between branches and the way the library actually shelves them. Nothing in the software is broken. No repeatable test can prove a mismatch of that kind, because there is nothing to reproduce.

An observation like that can matter more than anything else you found, and it still cannot pass the gate.

Three things to do with one.

**Leave it where it is.** A raw finding that cannot be qualified stays as an anchor in its run's `raw-findings.md`. That file is part of an immutable run record. The observation is on disk, dated, attributed to a run, and readable by anyone who opens the folder.

**Do not force it through.** Do not write a test that proves something adjacent and attach it to a claim it does not support. A qualified finding whose test does not actually prove the claim carries an ID that makes it look settled, which is the opposite of what you want.

**Carry it forward as its own thing.** An observation about how a system is shaped, rather than how it behaves, usually belongs in a design document as a stated constraint, or in a comparison against a model of how the business works. See [Compare two systems](10-compare-two-systems.md).

Be aware of the consequence when your findings come from reading rather than from running. A gap list produced by comparing documents is a list of raw findings, all the way down. Under this contract none of them qualifies until somebody goes and proves it against a running system. Keep producing gap lists, and be precise about what a gap list actually is.

> **Watch out.** Skipping the gate produces documents that look finished and say nothing. A design generated straight from a run's raw findings comes out with perfect structure and empty content, because the only thing the run proved was that the environment was reachable. If a design reads as hollow, check whether anything underneath it was ever qualified.

## What you should have now

- A folder at `workspace/findings/FIND-NNN/` holding `finding.md` and `qualification.md`.
- One row in `.os/data/findings.jsonl` with `status: "qualified"`.
- A confirmation test you can hand to somebody else, that passes today and will change its answer when the underlying problem is fixed.
- A `finding.md` whose `polarity` correctly says whether the test proves presence or proves repeatable absence.
- A clear list of the observations from your run that could not be qualified, still sitting in that run's `raw-findings.md`, and a decision about what happens to each.

## Next

[Compare two systems](10-compare-two-systems.md), covering how to put two systems side by side and produce a gap list you can defend.
