/**
 * The `buildos init` adapter (W1 R7 P6; PRD 20 Project Initialization and
 * Adoption, Make Docs Companion Setup, Output and Exit Contract). It parses
 * the flags, asks the Make Docs question in an interactive terminal, calls
 * the core, and prints the result. Human output names the project folder
 * first, then the state (done, partly done, stopped, or dry run), then the
 * next action. It goes to stdout; `--json` prints the shared envelope.
 */

import type { PackageContent } from "../../core/init/content.ts";
import {
  changedDuringSetupResult,
  changeWords,
  choiceNeededResult,
  clashResult,
  failedResult,
  SAME_INIT,
  MAKE_DOCS_LIMIT,
  MAKE_DOCS_NOT_RUN,
  makeDocsReport,
  notWritableResult,
  retryAdvice,
  sameInit,
  plannedResult,
  plannedSharedFiles,
  prepareInit,
  replanInit,
  setupChangedResult,
  setupResult,
  SHARED_FILES_NOTE,
  SKIP_WORDS,
  writeTargets,
  type ChangedDuringSetupResult,
  type ChoiceNeededResult,
  type ClashResult,
  type CommandStyle,
  type FailedResult,
  type MakeDocsReport,
  type NotWritableResult,
  type PlannedResult,
  type PlannedSharedFile,
  type PlannedWrite,
  type PreparedInit,
  type SetupChangedResult,
  type SetupResult,
  type WrittenSharedFile,
} from "../../core/init/init.ts";
import { ApplyFailure, applyInit, type NotRestored } from "../../core/init/apply.ts";
import { makeDocsChoice, MAKE_DOCS_QUESTION, parseMakeDocsAnswer } from "../../core/init/make-docs-choice.ts";
import { npxMakeDocsDisplay, runMakeDocsSetup, type MakeDocsOutcome } from "../../core/init/make-docs.ts";
import type { Diagnostic } from "../../core/shared/diagnostics.ts";
import { createEnvelope, serializeEnvelope, type WriteStatus } from "../../core/shared/envelope.ts";
import { FsWriteFailure, isCoreError, WriteError } from "../../core/shared/errors.ts";
import type { ProcessPort } from "../../core/shared/process-port.ts";
import { printedRun, runWords } from "../../core/shared/run-command.ts";
import { nodeHash } from "../../adapters/node-hash.ts";
import { createNodeProcessPort } from "../../adapters/node-process.ts";
import { loadPackageContent } from "../../adapters/package-content.ts";
import type { CommandContext, CommandOutcome, Domain } from "../domain.ts";
import { EXIT_CODES, exitCodeFor, type ExitCode } from "../exit-codes.ts";
import { parseCommandFlags } from "../parse.ts";
import { UsageError } from "../usage-error.ts";

const COMMAND = "buildos init";
const FLAGS = { root: "string", "dry-run": "boolean", json: "boolean", "make-docs": "boolean", "skip-make-docs": "boolean" } as const;

/** Test seams: the process port, the package content, the clock, and the platform. */
export interface InitDomainOptions {
  openProcess?: () => ProcessPort;
  loadContent?: () => PackageContent;
  now?: () => Date;
  platform?: string;
}

export const INIT_HELP = `Usage:
  buildos init [--root <folder>] [--make-docs | --skip-make-docs] [--dry-run] [--json]

Sets up BuildOS in a project folder: --root, or else the current folder. It
never looks in a parent folder.

In a folder with no .os/ folder, it adds the BuildOS files next to the files
that are there. When a file it must add is already there, it changes nothing
and lists the clashing paths (exit code 10).

AGENTS.md, CLAUDE.md, and .gitignore at the top of the folder are shared:
BuildOS adds its own section to them, between a buildos:begin line and a
buildos:end line, and never changes another line. A missing one is created.
BuildOS replaces its section only when the section is exactly as BuildOS
wrote it; a section changed by hand stops init (exit code 10).

In a folder that already has .os/ but no .os/manifest.json (a project set up
with the earlier tools), it adopts the project: it writes only
.os/manifest.json, the .os/scripts/ wrappers, and .os/skills/, and never
changes project data.

In a folder where BuildOS is already set up, running init again only
refreshes the BuildOS section in the shared files. It keeps every other file
as it is (exit code 0).

It can also set up Make Docs, a companion tool for project documents. Make
Docs runs first, before BuildOS writes anything:
  --make-docs        set up Make Docs too
  --skip-make-docs   do not set up Make Docs
With neither flag, it asks in a terminal. With no terminal, it stops before
any change and explains both choices (exit code 10).
${MAKE_DOCS_LIMIT} BuildOS adds its section to these files, so after a no,
Make Docs usually cannot be set up in the folder later with this version.

  --dry-run          show the planned changes and change nothing
  --json             print the stable JSON envelope
`;

export function createInitDomain(options: InitDomainOptions = {}): Domain {
  return {
    name: "init",
    summary: "Set up BuildOS in a new or existing project folder",
    help: INIT_HELP,
    run: (args, context) => runInit(args, context, options),
  };
}

export const initDomain: Domain = createInitDomain();

async function runInit(args: readonly string[], context: CommandContext, options: InitDomainOptions): Promise<CommandOutcome> {
  const { values, positionals } = parseCommandFlags(COMMAND, FLAGS, args, (partial) => partial.json === true);
  const json = values.json === true;
  context.setCommand("init");
  if (positionals.length !== 0) throw new UsageError(`init takes no arguments; got ${positionals[0] ?? ""}`, { command: COMMAND, json });
  const wantsMakeDocs = values["make-docs"] === true;
  const skipsMakeDocs = values["skip-make-docs"] === true;
  if (wantsMakeDocs && skipsMakeDocs) throw new UsageError("use either --make-docs or --skip-make-docs, not both", { command: COMMAND, json });
  const platform = options.platform ?? process.platform;
  const run = printedRun(context.buildInfo.version, platform);
  const style: CommandStyle = { program: run.program, platform, json };

  const prepared = prepareInit({
    root: values.root,
    cwd: context.io.cwd,
    openFs: context.openFs,
    hash: nodeHash,
    content: (options.loadContent ?? loadPackageContent)(),
    version: context.buildInfo.version,
    now: (options.now ?? (() => new Date()))(),
    run,
  });
  const out = new Output(context, prepared, json, platform);

  if (prepared.plan.clashes.length > 0 || prepared.plan.problems.length > 0) {
    const clash = clashResult(prepared);
    return out.stopped(clash, clashDiagnostic(prepared, clash));
  }

  const choice = makeDocsChoice({ makeDocs: wantsMakeDocs, skipMakeDocs: skipsMakeDocs, interactive: context.io.interactive === true && context.io.prompt !== undefined });
  const laterCommand = npxMakeDocsDisplay(prepared.root, platform);
  if (values["dry-run"] === true) {
    const report: MakeDocsReport =
      choice === "yes"
        ? { choice: "yes", status: "not_started", command: laterCommand }
        : choice === "no"
          ? makeDocsReport("skipped", laterCommand, prepared.plan)
          : { choice: "not_decided", status: "not_started", note: "Without --make-docs or --skip-make-docs, buildos init asks the user before it changes anything." };
    return out.planned(plannedResult(prepared, report));
  }
  if (choice === "stop") return out.stopped(choiceNeededResult(prepared, style), choiceDiagnostic());

  // Every folder BuildOS writes in must allow a new entry, checked before Make Docs runs.
  const notWritable = unwritableFolders(prepared);
  if (notWritable.length > 0) return out.stopped(notWritableResult(prepared, notWritable), notWritableDiagnostic(notWritable), EXIT_CODES.io);

  // With a question, the plan shows the shared files before the answer; with a flag, only the result lists them.
  out.showPlan(choice === "ask");
  let answer: "yes" | "no" | undefined = choice === "ask" ? undefined : choice;
  for (let tries = 0; answer === undefined && tries < 3; tries++) {
    const text = await context.io.prompt!(MAKE_DOCS_QUESTION);
    if (text === undefined) break;
    answer = parseMakeDocsAnswer(text);
    if (answer === undefined) context.io.writeStderr("Please answer y (yes) or n (no).\n");
  }
  if (answer === undefined) return out.stopped(choiceNeededResult(prepared, style), choiceDiagnostic());

  // Make Docs runs before BuildOS writes anything, so it sees the folder as
  // the user had it. Then the folder is read again: Make Docs may have added
  // AGENTS.md and CLAUDE.md, which then get the BuildOS section. From here
  // on, every result carries what Make Docs did.
  let report: MakeDocsReport | undefined;
  let ready = prepared;
  // The user's own router files before Make Docs ran (no Make Docs section), for the failure tip.
  const userRouters = prepared.plan.setup === "rerun" ? [] : prepared.plan.foreignRouters;
  try {
    if (answer === "yes") {
      if (!json) context.io.writeStderr("Setting up Make Docs. This can take a minute.\n");
      // W1 R7 P6 review round 2: the Make Docs result is kept the moment the
      // process returns, before any other filesystem step, so every later
      // exit path reports it.
      const outcome: MakeDocsOutcome = runMakeDocsSetup((options.openProcess ?? createNodeProcessPort)(), prepared.root, platform);
      report = makeDocsReport(outcome, "", prepared.plan);
      ready = replanInit(prepared);
      report = makeDocsReport(outcome, "", ready.plan);
      out.use(ready);
      if (ready.plan.setup !== prepared.plan.setup) {
        const changed = setupChangedResult(prepared, ready, report);
        return out.stopped(changed, { code: "init_setup_changed", severity: "error", message: changed.summary, correction: changed.tip });
      }
      if (ready.plan.clashes.length > 0 || ready.plan.problems.length > 0) {
        const clash = clashResult(ready, report);
        return out.stopped(clash, clashDiagnostic(ready, clash));
      }
      // W1 R7 P6 review round 3: a path BuildOS will write that changed while Make Docs ran stops the run before any write.
      if (ready.changed !== undefined && ready.changed.length > 0) {
        const changed = changedDuringSetupResult(ready, ready.changed, report);
        return out.stopped(changed, { code: "init_changed_during_setup", severity: "error", message: `${changed.summary} ${changed.changed.map((c) => c.path).join(", ")}`, correction: changed.tip });
      }
      const late = unwritableFolders(ready);
      if (late.length > 0) throw new WriteError(`buildos init cannot write in ${late.map((f) => f.path).join(", ")}: ${late[0]!.error}`, { code: "init_folder_not_writable", correction: `Allow your user to write in these folders, then ${sameInit(report)}.` });
    } else {
      report = makeDocsReport("skipped", laterCommand, prepared.plan);
    }
    applyInit(ready.plan, ready.fs);
  } catch (error) {
    return out.failed(ready, error, report);
  }
  return out.done(setupResult(ready, report, userRouters));
}

/** Each existing folder of the plan that does not allow a new entry, with the error the write would get. */
function unwritableFolders(prepared: PreparedInit): { path: string; error: string }[] {
  const out: { path: string; error: string }[] = [];
  for (const target of writeTargets(prepared.plan)) {
    try {
      // W1 R7 P6 review round 2: the folder the create or rename acts in, never the entry in it.
      prepared.fs.checkCanCreateIn(target.folder === "./" ? "" : target.folder.slice(0, -1));
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      out.push({ path: target.folder, error: osWords(error.fs.errno) });
    }
  }
  return out;
}

function osWords(code: string): string {
  if (code === "EACCES" || code === "EPERM") return "permission denied";
  if (code === "EROFS") return "the disk is read-only";
  return code;
}

function notWritableDiagnostic(folders: readonly { path: string; error: string }[]): Diagnostic {
  return {
    code: "init_folder_not_writable",
    severity: "error",
    message: `buildos init cannot write in ${folders.map((f) => `${f.path} (${f.error})`).join(", ")}`,
    correction: `Allow your user to write in these folders, then ${SAME_INIT}.`,
  };
}


function clashDiagnostic(prepared: PreparedInit, result: ClashResult): Diagnostic {
  if (result.reason === "shared_file_problem" || result.reason === "manifest_problem") {
    return {
      code: result.reason === "manifest_problem" ? "init_manifest_problem" : "init_shared_file_problem",
      severity: "error",
      message: `buildos init cannot safely add its section to ${result.problems.map((p) => p.path).join(", ")}: ${result.problems.map((p) => p.message).join(" ")}`,
      correction: result.problems.map((p) => p.fix).join(" "),
    };
  }
  return {
    code: "init_paths_exist",
    severity: "error",
    message: `${prepared.plan.clashes.length} path(s) that buildos init must add already exist: ${prepared.plan.clashes.map((c) => c.path).join(", ")}`,
    correction: result.tip,
  };
}

function choiceDiagnostic(): Diagnostic {
  return {
    code: "make_docs_choice_needed",
    severity: "error",
    message: "buildos init needs the user's answer to the Make Docs question, and no terminal can ask it",
    correction: "Ask the user, then run one of the two commands in result.choices.",
  };
}

/** Builds the human or JSON output for one run. */
class Output {
  private planShown = false;
  private readonly context: CommandContext;
  private prepared: PreparedInit;
  private readonly json: boolean;
  /**
   * The words before a shown command: "run", or on Windows the shell label
   * of that command (`runWords`: `COMMAND_PROMPT_LABEL`, plus the delayed
   * expansion words when the command holds a `!`; F-P8-11 review round 2,
   * finding 3).
   */
  private readonly run: (command: string) => string;

  constructor(context: CommandContext, prepared: PreparedInit, json: boolean, platform: string) {
    this.context = context;
    this.prepared = prepared;
    this.json = json;
    this.run = (command) => runWords(platform, command);
  }

  /** The plan after Make Docs ran: what the result reports. */
  use(prepared: PreparedInit): void {
    this.prepared = prepared;
  }

  /** Human mode: the folder and the planned changes, before anything is written. With `shared`, the planned shared-file rows too. */
  showPlan(shared: boolean): void {
    if (this.json || this.planShown) return;
    this.planShown = true;
    this.context.io.writeStdout(`Project folder: ${this.prepared.root}\n\n${planBlock(this.prepared, "Planned changes", shared)}\n`);
  }

  stopped(result: ClashResult | ChoiceNeededResult | SetupChangedResult | ChangedDuringSetupResult | NotWritableResult, diagnostic: Diagnostic, exitCode: ExitCode = EXIT_CODES.needsOperatorReview): CommandOutcome {
    // BuildOS wrote nothing; `result.make_docs`, when set, says what Make Docs did.
    if (this.json) return this.envelope(false, "not_requested", result, [diagnostic], exitCode);
    const lines = [...this.header(), `Stopped. ${result.summary}`, ""];
    if ("choices" in result) {
      lines.push(`Ask the user: "${result.question}"`, "", result.about_make_docs, result.later, "");
      for (const c of result.choices) lines.push(`If the user says ${c.answer}, ${this.run(c.command)}:`, `  ${c.command}`);
    } else if (result.reason === "folder_not_writable") {
      lines.push("BuildOS cannot write in these folders:");
      for (const f of result.folders) lines.push(`  ${f.path} (${f.error})`);
      lines.push("", result.tip);
    } else if (result.reason === "setup_changed") {
      lines.push(...makeDocsLines(result.make_docs, true, this.run), "", result.tip);
    } else if (result.reason === "changed_during_setup") {
      lines.push(result.changed.length === 1 ? "This path changed while Make Docs ran:" : "These paths changed while Make Docs ran:");
      for (const c of result.changed) lines.push(`  ${c.path} (${changeWords(c.change)})`);
      lines.push("", ...makeDocsLines(result.make_docs, true, this.run), "", result.tip);
    } else {
      if (result.clashes.length > 0) {
        lines.push("These paths are already here:");
        for (const clash of result.clashes) lines.push(`  ${clash.path}${clash.found === "folder" ? "/" : ""}`);
        lines.push("", result.tip);
      }
      for (const problem of result.problems) {
        if (lines[lines.length - 1] !== "") lines.push("");
        lines.push(problem.message, `To fix it: ${problem.fix}`);
      }
      if (result.make_docs !== undefined) lines.push("", ...makeDocsLines(result.make_docs, true, this.run));
    }
    return this.text(`${lines.join("\n")}\n`, exitCode);
  }

  planned(result: PlannedResult): CommandOutcome {
    if (this.json) return this.envelope(true, "planned", result, [], EXIT_CODES.ok);
    const lines = [`Project folder: ${this.prepared.root}`, `Dry run. ${result.summary}`, "", planBlock(this.prepared, "Planned changes", true), "", ...makeDocsLines(result.make_docs, true, this.run), ...noteLines(result.notes)];
    return this.text(`${lines.join("\n")}\n`, EXIT_CODES.ok);
  }

  done(result: SetupResult): CommandOutcome {
    if (this.json) return this.envelope(true, "applied", result, [], EXIT_CODES.ok);
    const lines: string[] = [];
    if (!this.planShown) lines.push(`Project folder: ${this.prepared.root}`, "", planBlock(this.prepared, "Changes", false));
    if (result.shared_files.length > 0) lines.push("", `Shared files. ${SHARED_FILES_NOTE}`, ...sharedResultRows(result.shared_files));
    lines.push("", `${result.status === "partial" ? "Partly done" : "Done"}. ${result.summary}`);
    if (result.setup === "adoption") lines.push("Your project data was not changed. Only .os/manifest.json, the .os/scripts/ wrappers, and .os/skills/ were written.");
    if (result.setup === "rerun") lines.push("BuildOS was already set up here, so it kept its other files as they are.");
    // The summary already says that Make Docs is not set up, so a failure starts with its reason.
    lines.push(...makeDocsLines(result.make_docs, false, this.run));
    lines.push(...noteLines(result.notes));
    return this.text(`${lines.join("\n")}\n`, EXIT_CODES.ok);
  }

  /** A failure after the checks: BuildOS undid its writes, or lists what it could not put back. */
  failed(prepared: PreparedInit, error: unknown, makeDocs: MakeDocsReport | undefined): CommandOutcome {
    this.prepared = prepared;
    const cause = error instanceof ApplyFailure ? error.cause : error;
    const notRestored: NotRestored[] = error instanceof ApplyFailure ? error.notRestored : [];
    const why = sentence(cause instanceof Error ? cause.message : String(cause));
    const result: FailedResult = failedResult(prepared, why, notRestored, makeDocs);
    // F-P8-11 review round 2 (finding 2): an error's own retry advice carries the flag change after Make Docs ran, as the tip does.
    const diagnostics: Diagnostic[] = isCoreError(cause)
      ? cause.diagnostics.map((d) => (d.correction === undefined ? d : { ...d, correction: retryAdvice(d.correction, makeDocs) }))
      : [{ code: "internal_error", severity: "error", message: why }];
    if (notRestored.length > 0) {
      diagnostics.push({
        code: "init_undo_incomplete",
        severity: "error",
        message: `buildos init could not put back ${notRestored.map((n) => n.path).join(", ")}`,
        correction: result.tip,
      });
    }
    // A complete undo keeps the error's own exit code; an incomplete one needs a person to look (exit 10).
    const exitCode = notRestored.length > 0 ? EXIT_CODES.needsOperatorReview : exitCodeFor(cause);
    // PRD 20: `applied` means every write completed. An undo that could not put everything back leaves a partial write.
    if (this.json) return this.envelope(false, notRestored.length > 0 ? "partially_applied" : "not_requested", result, diagnostics, exitCode);
    const lines = [...this.header(), `Failed. ${result.summary}`, `Why: ${result.why}`];
    const left = notRestored.filter((n) => n.state === "left");
    const unsure = notRestored.filter((n) => n.state === "unsure");
    if (left.length > 0) {
      lines.push("", "BuildOS could not put these paths back as they were:");
      for (const n of left) lines.push(`  ${n.path} (${n.reason})`);
    }
    if (unsure.length > 0) {
      lines.push("", "BuildOS put these paths back, but could not make sure the change was saved to disk:");
      for (const n of unsure) lines.push(`  ${n.path}`);
    }
    if (makeDocs !== undefined && makeDocs.status !== "skipped") lines.push("", ...makeDocsLines(makeDocs, true, this.run));
    lines.push("", result.tip);
    return this.text(`${lines.join("\n")}\n`, exitCode);
  }

  /** The first line: the project folder, or an empty line when the plan above already named it. */
  private header(): string[] {
    return this.planShown ? [""] : [`Project folder: ${this.prepared.root}`];
  }

  private text(stdout: string, exitCode: ExitCode): CommandOutcome {
    return { rendered: { stdout, stderr: "", exitCode }, command: "init", json: false };
  }

  private envelope(ok: boolean, writeStatus: WriteStatus, result: unknown, diagnostics: Diagnostic[], exitCode: ExitCode): CommandOutcome {
    const envelope = createEnvelope({
      ok,
      command: "init",
      version: this.context.buildInfo.version,
      sourceRevision: this.context.buildInfo.sourceRevision,
      root: this.prepared.root,
      mode: "not_applicable",
      writeStatus,
      result,
      diagnostics,
    });
    return { rendered: { stdout: serializeEnvelope(envelope), stderr: "", exitCode }, command: "init", json: true };
  }
}

/** Ends `text` with one period. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** The planned writes; with `shared`, then the planned shared-file rows. */
function planBlock(prepared: PreparedInit, title: string, shared: boolean): string {
  const writes: PlannedWrite[] = prepared.plan.entries.map((e) => ({ path: e.kind === "folder" ? `${e.path}/` : e.path, kind: e.kind, action: e.action }));
  const out: string[] = [];
  if (prepared.plan.setup === "rerun") {
    out.push(`${title} (BuildOS is already set up here: only its section in the shared files can change; its other files stay as they are)`);
  } else {
    const what = prepared.plan.setup === "adoption" ? "adopt an existing BuildOS project" : "new BuildOS project";
    out.push(`${title} (${what}, ${writes.length} ${writes.length === 1 ? "path" : "paths"}):`, ...writes.map((w) => `  ${w.action === "create" ? "add    " : "replace"}  ${w.path}`));
  }
  if (shared && prepared.plan.shared.length > 0) out.push("", `Shared files. ${SHARED_FILES_NOTE}`, ...sharedPlanRows(plannedSharedFiles(prepared.plan.shared)));
  return out.join("\n");
}

const PLAN_WORDS: Record<PlannedSharedFile["action"], string> = {
  create: "add      {path} (a new file with only the BuildOS section)",
  add_block: "update   {path} (add the BuildOS section; the other lines stay as they are)",
  update_block: "update   {path} (refresh the BuildOS section; the other lines stay as they are)",
  unchanged: "keep     {path} (the BuildOS section is already up to date)",
  skip: "keep     {path} (not refreshed: {reason})",
};

/** The words for a section added at the start of a file (W1 R7 P6 review round 3). */
const TOP_WORDS = "at the top, because the file ends inside an unclosed code block or comment";

function sharedPlanRows(files: readonly PlannedSharedFile[]): string[] {
  return files.map((f) => {
    if (f.link_to !== undefined) return `  keep     ${f.path} (a link to ${f.link_to}, which gets the BuildOS section)`;
    if (f.position === "top") return `  update   ${f.path} (add the BuildOS section ${TOP_WORDS}; the other lines stay as they are)`;
    return `  ${PLAN_WORDS[f.action].replace("{path}", f.path).replace("{reason}", f.reason === undefined ? "" : SKIP_WORDS[f.reason])}`;
  });
}

const RESULT_WORDS: Record<WrittenSharedFile["result"], string> = {
  created: "created, with only the BuildOS section",
  block_added: "BuildOS section added; the other lines were not changed",
  block_updated: "BuildOS section updated; the other lines were not changed",
  unchanged: "no change; the BuildOS section was already up to date",
  skipped: "no change; {reason}",
};

function sharedResultRows(files: readonly WrittenSharedFile[]): string[] {
  return files.map((f) => {
    if (f.link_to !== undefined) return `  ${f.path}: no change; it is a link to ${f.link_to}, which has the BuildOS section`;
    if (f.position === "top") return `  ${f.path}: BuildOS section added ${TOP_WORDS}; the other lines were not changed`;
    return `  ${f.path}: ${RESULT_WORDS[f.result].replace("{reason}", f.reason === undefined ? "" : SKIP_WORDS[f.reason])}`;
  });
}

/** The Make Docs lines of a human result. `named`: a failure starts with "Make Docs: not set up." */
/** P7-R1-09: each plain note on its own line, after a blank line. */
function noteLines(notes: readonly { message: string }[] | undefined): string[] {
  if (notes === undefined || notes.length === 0) return [];
  return ["", ...notes.map((note) => `Note: ${note.message}`)];
}

function makeDocsLines(report: MakeDocsReport, named = true, run: (command: string) => string = () => "run"): string[] {
  switch (report.status) {
    case "set_up":
      return ["Make Docs: set up."];
    case "skipped":
      if (report.later === MAKE_DOCS_NOT_RUN) return ["Make Docs: not run, as chosen."];
      return report.later_command === undefined ? [`Make Docs: not set up, as chosen. ${report.later}`] : [`Make Docs: not set up, as chosen. To set it up later, ${run(report.later_command)}:`, `  ${report.later_command}`];
    case "not_started":
      return [report.choice === "yes" ? "Make Docs: would be set up first, before BuildOS writes its files." : "Make Docs: the user is asked before anything changes."];
    case "failed": {
      const lines = [`${named ? "Make Docs: not set up. " : ""}Why: ${sentence(`${report.reason}${report.detail === undefined ? "" : `: ${report.detail}`}`)}`];
      if (report.tip !== undefined) lines.push(report.tip);
      if (report.retry_note !== undefined) lines.push(report.retry_note);
      lines.push(`To try Make Docs again, ${run(report.retry_command)}:`, `  ${report.retry_command}`);
      return lines;
    }
  }
}
