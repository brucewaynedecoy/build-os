# Before you start

What has to be in place on your machine and in your organization before BuildOS is worth opening.

## What you need first

This is the first page in the set with work to do on it, and it needs nothing from you in advance. It assumes no BuildOS knowledge and uses no BuildOS vocabulary except where it defines the word first. Reading [What BuildOS is](01-what-buildos-is.md) and [How it works](02-how-it-works.md) helps, but this article does not require them.

---

## Five prerequisites

Before BuildOS does anything for you, five things have to be true.

1. You have **git** installed and working on your machine.
2. You have an **agent tool** you can point at a folder on your own machine.
3. You have **Node.js 24 or newer** on the machine where the agent runs. It is the one program BuildOS needs.
4. Your machine can reach the **npm registry**, the public store that Node.js fetches packages from, or someone can hand you the BuildOS package file. [Install and configure your instance](04-install-and-configure-your-instance.md) covers the second case.
5. You know enough version control to save your work and to throw a change away.

All five sit outside the product. BuildOS installs no agent, leaves your source control to you, and never installs Node.js for you. It assumes all five are already handled.

Budget a day for this article. A slow start here is normal, because none of it is BuildOS work yet.

---

## Terms from outside BuildOS

Six words in this documentation are not BuildOS words at all. They belong to the terminal and to git, and no other document in the set explains them, so they are defined here.

One convention first. In any command in this documentation, text in angle brackets is a placeholder. Replace `<repository-url>`, brackets included, with the real value. Everything outside the brackets you type exactly as written.

### Exit code

Every command you run finishes with a number. Zero means it succeeded. Anything else means it failed, and the number says which kind of failure.

The number is not printed on screen. To see the one from the command you just ran, type:

```
echo $?
```

In Windows Command Prompt, type `echo %ERRORLEVEL%` instead. Run it immediately after the command you care about, because the next command you run replaces it. Five documents in this set use an exit code as the pass-or-fail test, so the habit is worth building now.

### Environment variable

A named value that your shell hands to every command it starts. You set one for the current terminal window like this:

```
export NPM_CONFIG_CACHE=<full-path-to-a-folder>
```

Close the window and it is gone. To keep it, put the same line in your shell's startup file: `~/.zshrc` on macOS, `~/.bashrc` on most Linux systems.

### `PATH`

One particular environment variable: the list of folders your shell searches when you type a program's name. A program that is "on your `PATH`" is one you can run by name alone, from any folder. To add a folder to it:

```
export PATH="$PATH:<full-path-to-the-folder>"
```

The same rule applies. That lasts for one terminal window unless you put it in your startup file.

### Shell

The program that reads the commands you type and runs them. macOS and Linux give you `zsh` or `bash` in the Terminal app. Windows gives you Command Prompt and PowerShell.

BuildOS commands run in any of them. The project wrapper has one form for macOS and Linux, `.os/scripts/buildos`, and one for Windows, `.os\scripts\buildos.cmd`. On Windows, BuildOS writes the commands it shows you for Command Prompt; it shows no PowerShell form. Your agent usually picks the right shell for you.

### Runtime

The program that has to be installed before code written in a given language will run. JavaScript needs Node.js, and Python code needs Python. Two runtimes appear in this documentation.

| Runtime | What needs it | Where you meet it |
| --- | --- | --- |
| Node.js 24 or newer | every BuildOS command, and the work-tracker export skill | [Install and configure your instance](04-install-and-configure-your-instance.md) |
| Python 3 | three skills' own helper tools until BuildOS `0.2.0`: bulk extraction, fit-gap analysis, and the capability matrix. No BuildOS command needs it | [Install and configure your instance](04-install-and-configure-your-instance.md), section Skills |

Install Node.js 24 or newer now, from `https://nodejs.org` or your company's software portal. To check it, run `node --version`: it must print `v24` or a higher number. Install Python 3 only if you plan to use one of those three skills. A missing runtime discovered halfway through a task is an expensive interruption.

### Branch

A named line of work inside a git repository. Every clone starts on one. Changes you commit land on whichever branch you are on, and someone on a different branch will not see them.

If files you expect are missing, check which branch you are on first:

```
git branch --show-current
```

---

## Get an agent tool

> [!TIP] NOTE
> - An **LLM** is the model. It turns text into text and remembers nothing between turns.  
> - A **harness** or **agent harness** is the software wrapped around the model. It gives the model a set of tools, a working directory, and a loop so it can take more than one step.  
> - An **agent** is the two together, working on your tasks and files.
> - **BuildOS** is a system of instructions that agents can follow.

### The capabilities your agent needs

Your agent must be able to do two things inside a folder on your machine:

- **Read and write files in that folder.** It has to open, edit, create, and delete files on disk. A tool that only summarizes files you paste in, or answers questions about a document library, does not qualify.
- **Run commands in that folder.** BuildOS ships command-line tools, and the agent has to be able to call them.

BuildOS reads its instructions from plain text files, so any tool that meets those two conditions can operate it. This documentation never names an agent harness and never assumes one. See [Harness independence and trust](16-harness-independence-and-trust.md) for the limits.

### Driving a browser is a separate capability

Later in this documentation you will write a **playbook**: a short Markdown file that tells a person or an agent how to do one job. Some playbooks ask the agent to go and poke at the system you are studying, such as opening a page or filling in a form to see what happens. That attempt is a **run**: one recorded attempt at doing something.

Runs against a web application need the agent to control a browser. That is a separate capability from reading and writing files, and plenty of capable agent tools do not have it.

Check two things before you commit to a tool:

- Browser and screen control tends to belong to desktop agent applications rather than editor extensions. The same vendor may offer it in one product and not in another.
- A built-in browser inside an agent tool may not be able to hold a login session.

You do not need this capability for [Bring in source material](05-bring-in-source-material.md) or for the configuration work in [Install and configure your instance](04-install-and-configure-your-instance.md). You do need it, or a person willing to do the clicking, before [Write and run a playbook](08-write-and-run-a-playbook.md).

### Prove your tool works before you go further

Do these three checks. They take about two minutes.

1. Point the agent at an empty folder and ask it to create a file with one line in it.
2. Look for that file on disk yourself, in a file browser or a terminal. Do not take the agent's word for it.
3. Ask the agent to run a command that prints something, and check the output appears.

If any of those fails, stop and fix the tool before you go further.

> **Watch out.** An agent can accept your prompts and silently do nothing before a licence agreement has been signed inside the tool. No error appears. The conversation looks normal and the disk never changes. Check 2 above is what catches this.

---

## Get BuildOS into your project

### How you get it

BuildOS is one npm package, `build-os`. You do not download, copy, or build anything by hand. In [Install and configure your instance](04-install-and-configure-your-instance.md), your agent runs one command in your project folder, `npx -y build-os@0.1.0 init`, and BuildOS puts its files there.

### Choose your project folder

1. Choose a folder on your machine's own hard drive for your project. Not a cloud-synced folder, and not your Documents folder if that folder syncs.
2. Make it a git repository, or use your team's existing project repository. If the repository lives on a hosting service, ask whoever holds it to give your account access, accept the invitation, and confirm you can actually open it in a browser. Accepting is not the same as having access.
3. The folder can be empty, or it can already hold your own files. BuildOS adds its files next to them. In a new setup, it stops and changes nothing when one of its files would replace one of yours; in your `AGENTS.md`, `CLAUDE.md`, and `.gitignore` it adds only its own marked section.

### If you cannot get access

Access to your team's project repository fails in more than one way, and it is the most likely thing to stop you on day one.

> **Watch out.** On a repository owned by an organization, the personal invite-a-collaborator flow may do nothing at all. Access on those repositories is controlled by organization roles and policies instead. The hosting platform's own help text says so. If you sent an invite and the other person still cannot see anything, this is the most likely cause. Ask an organization administrator to grant access through the organization, not through the repository.

> **Watch out.** Adding a person by username can fail silently. If a username lookup appears to succeed and nothing arrives, try the email address instead.

> **Watch out.** An accepted invitation that immediately locks you out looks like success. If the account is governed by single sign-on that has not been provisioned for you, you will see a message along the lines of "user is not assigned to the application." That is an identity problem, not a repository problem, and only your identity administrators can clear it.

> **Watch out.** Forking a repository from outside your organization into your enterprise organization may be blocked by policy, with the Fork control disabled. There is no workaround from your side.

> **Watch out.** Two people can create two repositories with the same name and then clone different ones. Confirm the full owner-and-name of the repository, not the name on its own.

If none of the sanctioned routes are open to you, the practical answer is to work in a repository that everyone involved can actually reach. Nothing in BuildOS depends on where the project lives, because the whole system is files in a folder.

---

## Learn enough git to be safe

This section covers the small set of git habits that made the difference for people who had never used version control. Anything past that, look up elsewhere.

**Git** is version control: a record of every change to every file in the project. BuildOS is git-native, and git provides the only undo you get.

### The diff view

Most people learn version control for backup. In BuildOS the more useful reason is review.

An agent makes changes to your documents. The diff view is the side-by-side display of a file before and after, and it shows you **where the agent touched it**. Treat reading a diff as reviewing somebody else's work rather than as disaster recovery. That framing is what worked on real newcomers.

### Three habits

1. **Commit before you bring in new material.** Then the only uncommitted changes in the folder are the ones the import produced, and you can throw the whole import away in one action if it went badly.
2. **Commit before a long agent run.** Same reason. From a clean starting point you can throw a bad run away instead of picking it apart afterwards.
3. **Read the diff before you commit anything an agent wrote.** Open each changed file and look at what changed. Nothing else reviews the agent's output for you.

### The mechanics

- **See what changed.** In most editors, a source-control panel lists changed files. New files, modified files, and deleted files are marked differently.
- **Open a changed file to see the diff.** The old version and the new version, side by side.
- **Stage deliberately.** Choose which changes go into this commit. Do not let the editor decide for you.
- **Write a message that says what you did.** "Edited agent instructions" is a good message.
- **Commit, then push.** A commit is local and reversible. Pushing is what makes it visible to anyone else.
- **Discard a change you do not want.** This is the undo.

> **Watch out.** Some editors will commit unstaged changes if you type a message and click commit with nothing staged. You can end up committing work you meant to leave alone. Stage first, then check what is staged, then commit.

> **Watch out.** Do not discard a file only because you do not recognize it. As a rule of thumb, anything named after a BuildOS artifact is probably real work, and that includes `run.md`, `raw-findings.md` and `finding.md`. Ask before you discard it.

> **Watch out.** Do not commit large binary files. A large file committed by accident can stall a sync and block a planned working session. If a file is large, keep it outside the repository and reference it instead.

---

## Working inside a restrictive corporate environment

A tightly controlled environment rarely blocks BuildOS itself. BuildOS is plain text files plus git and one command-line program, with no server to start, no port to open, no database, and no network calls of its own. It needs Node.js 24 or newer and, once per version, the npm registry. Restrictions in a managed environment land on your **agent's** privileges instead: what it may install, what it may write, and where it may reach.

Expect the agent to need help at specific moments on a locked-down machine. If it is denied write access to the project and refuses to act, ask it to print the git commands it wants to run, then run them yourself in a terminal.

### Environment problems to expect

These are the environment problems most likely to stop work.

| Problem | What it looks like | What to do |
| --- | --- | --- |
| No corporate identity for an external collaborator | Both routes to request access need a corporate laptop or VPN the collaborator does not have | Move the project to a repository everyone can reach. |
| Chat file sharing blocked by identity | One party cannot attach a file in the corporate chat tool because they have no client identity | Fall back to email, and expect it to be slow and error-prone. |
| Direct download of a language runtime blocked | The download stops mid-transfer with a malware warning | Use the employer's approved-software portal. Ask whether one exists. |
| npm registry blocked | `npx` stops with a network or certificate error and BuildOS never starts | Install BuildOS from the package file instead. [Install and configure your instance](04-install-and-configure-your-instance.md) has the steps. |
| AI policy gate | A redirect page and an acceptance agreement before reaching a non-approved AI site, then a warning on every invocation of the approved one | Accept and continue. There is no fix. |
| Licence terms | A vendor's terms forbid plugging an enterprise subscription into a third-party agent tool | Run different tools and coordinate through git. |
| Repeated forced sign-ins | Sign-in prompts several times an hour, interrupting whatever the agent is doing | Commit locally, and push from a separately authenticated desktop git client. |
| Meeting transcripts locked to the organizer | Only the person who booked the meeting can get the transcript | There is no fix. Check this before you plan to feed meeting recordings into BuildOS. |

---

## What will go wrong here

A short list of the failures most likely to hit you on day one, with what to do about each.

**The agent accepts prompts and nothing happens on disk.** A licence agreement inside the tool has probably not been signed. No error is shown. Check the disk yourself, then look for an agreement prompt in the tool's settings.

**You installed the wrong product.** Vendors ship several similarly named applications, and one of them is not an agent tool. Confirm the exact product name before you spend a session on it.

**The command-line installer for your agent tool hangs.** If the command-line route stalls, switch to the desktop application instead of debugging it.

**Your agent tool cannot control a browser.** No extension may exist for it. Building a substitute can take most of a working call, and a common root cause of the failed attempts is a required runtime that was never installed. Plan for a person to do the clicking instead, or choose a tool with the capability.

**Git tooling fails on your machine.** If git is fighting you, try the desktop client before you try anything else. It tends to succeed where an editor integration or a command-line client does not.

**You cannot tell folders from files in your editor.** This blocked a newcomer through an entire walkthrough until a file-icon extension fixed it.

**Your agent tool asks to restart constantly.** This is normal harness behaviour. It is also the correct first fix when a newly installed capability does not appear.

**Access does not arrive.** Requests through IT can take days. Plan for that, and start the request before you need it.

[When things go wrong](17-when-things-go-wrong.md) collects the recovery steps for problems that appear later, once you are actually using the system.

---

## What you should have now

- An agent tool that can read files, write files, and run commands in a folder on your machine, proven by a file you found on disk yourself.
- A clear answer to whether that tool can drive a browser, and a plan if it cannot.
- A project folder on your machine's own hard drive, outside any synced folder, under git.
- The ability to see what changed, stage it, commit it, push it, and discard a change.
- The three git habits written down: commit before you bring in material, commit before a long run, read the diff before you commit agent work.
- Node.js 24 or newer installed, checked with `node --version`.
- A plain-language answer for each of six terms this documentation assumes: exit code, environment variable, `PATH`, shell, runtime, and branch.

## Next

[Install and configure your instance](04-install-and-configure-your-instance.md), which sets up BuildOS in your project with one command and names your own systems, environments, and owners.
