/**
 * `buildos init` (PRD 20 Project Initialization and Adoption, Make Docs
 * Companion Setup). The CLI runs these steps in order:
 *
 * 1. `prepareInit`: resolve the root (`--root` or the current folder, never a
 *    parent) and plan the writes (a new project, an adoption, or a rerun in
 *    a project BuildOS already set up). Nothing is written.
 * 2. Stop when a planned path clashes or a problem blocks the plan
 *    (`clashResult`, exit 10), or show the plan for `--dry-run`
 *    (`plannedResult`, exit 0).
 * 3. Decide the Make Docs choice. With no TTY and no flag, stop before any
 *    write (`choiceNeededResult`, exit 10).
 * 4. Check that every folder BuildOS writes in allows a new entry
 *    (`notWritableResult`, exit 5), before Make Docs runs.
 * 5. For Yes, `runMakeDocsSetup` first, so Make Docs sees the folder as the
 *    user had it; then `replanInit` reads the folder again (Make Docs may
 *    have added `AGENTS.md` and `CLAUDE.md`). When the second read finds a
 *    different setup (`setupChangedResult`), a clash, or a problem, BuildOS
 *    writes nothing and stops (exit 10). Then `applyInit` writes every
 *    BuildOS file and section as one unit, undone as a whole on a failure
 *    (`failedResult`). A Make Docs failure still counts as a finished
 *    BuildOS setup (`setupResult` with status `partial`, exit 0).
 *
 * After Make Docs ran, every result says what Make Docs did, and no result
 * says "Nothing was changed". Each result carries plain words that the CLI
 * shows as they are, so the human and JSON output say the same thing.
 */

import { InputError, NeedsOperatorReviewError } from "../shared/errors.ts";
import { isInstalledLayout } from "../shared/buildos-layout.ts";
import type { FsPort, FsPortFactory } from "../shared/fs-port.ts";
import type { HashPort } from "../shared/hash-port.ts";
import { resolveDefaultRoot } from "../shared/root.ts";
import { runCommand, SOURCE_RUN, type PrintedRun } from "../shared/run-command.ts";
import { MAKE_DOCS_OWNED, MANIFEST_PATH, type PackageContent } from "./content.ts";
import type { MakeDocsOutcome } from "./make-docs.ts";
import { createManifest, isManifestVersion, serializeManifest, type ProjectManifest } from "./manifest.ts";
import type { NotRestored } from "./apply.ts";
import { planInit, type Before, type Clash, type InitNote, type InitPlan, type InitProblem, type InitSetup, type PlannedEntry } from "./plan.ts";
import { equalBytes, isSafeSectionBody, SHARED_FILES, type SharedAction, type SharedFilePlan, type SharedSkipReason } from "./shared-files.ts";

export interface PrepareInput {
  /** `--root`, when given. */
  root?: string | undefined;
  cwd: string;
  openFs: FsPortFactory;
  /** SHA-256 for the integrity lines of the shared files (W1 R7 P6 review round 4: core loads no crypto module). */
  hash: HashPort;
  content: PackageContent;
  /** The BuildOS package version written to the manifest. */
  version: string;
  now: Date;
  /** How printed commands start (PE-023). Defaults to the source-build form, `buildos`. */
  run?: PrintedRun;
}

export interface PreparedInit {
  /** The root as given (Go `filepath.Abs` form): what every output names. */
  root: string;
  fs: FsPort;
  hash: HashPort;
  plan: InitPlan;
  manifest: ProjectManifest;
  content: PackageContent;
  /** How printed commands start (PE-023). */
  run: PrintedRun;
  /**
   * After `replanInit`: each path BuildOS will write whose state changed
   * while Make Docs ran (W1 R7 P6 review round 3). Any entry stops the run.
   */
  changed?: ChangedPath[];
}

/** A path BuildOS will write that changed while Make Docs ran: it appeared, it went away, or what is there changed. */
export interface ChangedPath {
  path: string;
  change: "appeared" | "removed" | "changed";
}

export function prepareInit(input: PrepareInput): PreparedInit {
  const { root, fs } = resolveDefaultRoot({ root: input.root, cwd: input.cwd, openFs: input.openFs });
  const kind = fs.stat(".")?.kind;
  if (kind !== "directory") {
    throw new InputError(`the project folder ${root} ${kind === undefined ? "does not exist" : "is not a folder"}`, {
      code: "root_not_found",
      correction: "Create the project folder first, or pass --root with an existing folder.",
      root,
    });
  }
  for (const file of input.content.files) {
    if (MAKE_DOCS_OWNED.some((owned) => file.path === owned || file.path.startsWith(`${owned}/`))) {
      throw new Error(`the BuildOS package content holds the Make Docs path ${file.path}`);
    }
    const spec = SHARED_FILES.find((s) => s.path === file.path);
    if (spec !== undefined && !isSafeSectionBody(spec, file.data)) throw new Error(`the BuildOS package file ${file.path} holds buildos marker text, or ends inside a code block or comment`);
  }
  const run = input.run ?? SOURCE_RUN;
  checkProjectFolder(fs, root, run);
  // The manifest contract (`manifest.ts`): BuildOS never writes a version that the wrappers refuse.
  if (!isManifestVersion(input.version)) throw new Error(`the BuildOS package version ${JSON.stringify(input.version)} is not an exact version or dev, so the wrappers could not pin it`);
  const fresh = createManifest(input.version, input.now);
  const plan = planInit({ fs, hash: input.hash, content: input.content, manifest: serializeManifest(fresh), again: initAgain(run) });
  // A rerun reports the manifest on disk, not a new one (W1 R7 P6 review round 2).
  return { root, fs, hash: input.hash, plan, manifest: plan.installed ?? fresh, content: input.content, run };
}

/**
 * W1 R7 P7 review round 3 (P7-R3-07): `buildos init` uses the layout rule
 * every domain uses (`isInstalledLayout`, PRD 05 Installed Project Paths)
 * before it plans, and stops (exit 10) with nothing written when the folder
 * is not one it may set up:
 *
 * - The rule reads the folder as the BuildOS source code (`system/.os/` is a
 *   folder, `.os/manifest.json` is not a file, and not all five Go folders
 *   are there): an adoption there would write a root manifest and turn the
 *   source checkout into an "installed" project for every domain.
 * - An `.os/` folder with no manifest that is not a project set up with the
 *   earlier Go tools: adoption needs Go's marker, all five of `.os/`,
 *   `assets/`, `docs/`, `playbooks/`, and `workspace/`, or the `.os/data/`
 *   folder the Go tools shipped (PRD 20 Project Initialization and
 *   Adoption). Any other `.os/` is not adopted.
 */
function checkProjectFolder(fs: FsPort, root: string, run: PrintedRun): void {
  const probe = (rel: string) => {
    try {
      return fs.stat(rel)?.kind;
    } catch {
      return undefined;
    }
  };
  if (!isInstalledLayout(probe) && probe("system/.os") === "directory") {
    throw new NeedsOperatorReviewError(
      `${root} looks like the BuildOS source code, not a project: it has a system/.os/ folder and no .os/manifest.json. BuildOS changed nothing.`,
      { code: "init_source_checkout", correction: `Run ${initAgain(run)} in your project folder, or pass --root with your project folder.`, root },
    );
  }
  if (probe(".os") !== "directory" || probe(MANIFEST_PATH) !== undefined) return;
  const goFolders = [".os", "assets", "docs", "playbooks", "workspace"].every((rel) => probe(rel) === "directory");
  if (goFolders || probe(".os/data") === "directory") return;
  throw new NeedsOperatorReviewError(
    `${root} has an .os/ folder that the earlier BuildOS tools did not set up: it has no .os/data/ folder and not all of .os/, assets/, docs/, playbooks/, and workspace/. BuildOS sets up a new project or adopts a project set up with the earlier BuildOS tools, so it changed nothing.`,
    { code: "init_unknown_os_folder", correction: `If .os/ belongs to another tool, run ${initAgain(run)} in another folder or move .os/ away. If it is an earlier BuildOS project, put back its .os/data/ folder, then run ${initAgain(run)} again.`, root },
  );
}

/**
 * Plans again from the folder as it is now (after Make Docs ran), with the
 * same new manifest. The caller compares the setup. Each replace keeps the
 * snapshot the first plan read before Make Docs ran (W1 R7 P6 review round
 * 2), so a change made while Make Docs ran stops the write.
 *
 * W1 R7 P6 review round 3: the first plan's view of each path BuildOS will
 * write (missing, a folder, or a file or link with its snapshot) is carried
 * through. When the second plan sees any of those paths differently (a
 * wrapper that appeared, a file that went away, a changed file),
 * `changed` lists it, and the caller stops before any write. The three
 * shared files are not compared: Make Docs may create or change them, so
 * BuildOS decides them from what is there after Make Docs ran.
 */
export function replanInit(prepared: PreparedInit, fresh: ProjectManifest = prepared.manifest): PreparedInit {
  const plan = planInit({ fs: prepared.fs, hash: prepared.hash, content: prepared.content, manifest: serializeManifest(fresh), again: initAgain(prepared.run) });
  const first = new Map(prepared.plan.entries.map((e) => [e.path, e] as const));
  const changed: ChangedPath[] = [];
  const seen = new Set<string>();
  const entries = plan.entries.map((now) => {
    seen.add(now.path);
    const was = first.get(now.path);
    if (was === undefined || was.action !== now.action || was.kind !== now.kind) {
      // W1 R7 P6 review round 4: a path the second plan must create was there before (a file to replace, or a folder the first plan did not need to make), so it was removed.
      changed.push({ path: shownPath(now), change: now.action === "replace" ? "appeared" : "removed" });
      return now;
    }
    if (now.action === "replace" && !sameBefore(was.before, now.before)) changed.push({ path: shownPath(now), change: "changed" });
    return now.action === "replace" ? { ...now, before: was.before } : now;
  });
  for (const was of prepared.plan.entries) {
    if (!seen.has(was.path)) changed.push({ path: shownPath(was), change: was.action === "replace" ? "removed" : "appeared" });
  }
  return { ...prepared, plan: { ...plan, entries }, manifest: plan.installed ?? prepared.manifest, changed };
}

function shownPath(entry: PlannedEntry): string {
  return entry.kind === "folder" ? `${entry.path}/` : entry.path;
}

/** True when two snapshots of one path are the same entry with the same content. */
function sameBefore(a: Before | undefined, b: Before | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind === "symlink" || b.kind === "symlink") return a.kind === b.kind && a.id === b.id && a.mode === b.mode && a.kind === "symlink" && b.kind === "symlink" && a.target === b.target && a.links === b.links;
  return a.id === b.id && a.mode === b.mode && a.links === b.links && equalBytes(a.data, b.data);
}

/** One planned write, as the output lists it. A folder path ends in `/`. */
export interface PlannedWrite {
  path: string;
  kind: "file" | "folder";
  action: "create" | "replace";
}

export function plannedWrites(plan: InitPlan): PlannedWrite[] {
  return plan.entries.map((e) => ({ path: e.kind === "folder" ? `${e.path}/` : e.path, kind: e.kind, action: e.action }));
}

/**
 * One planned shared file, as the output lists it. `link_to` is set for a
 * link to another shared file; `position` is `top` for a section added at
 * the start of the file; `reason` says why a rerun skips the file.
 */
export interface PlannedSharedFile {
  path: string;
  action: SharedAction;
  link_to?: string;
  position?: "top";
  reason?: SharedSkipReason;
}

/** One shared file after the write: `created`, `block_added`, `block_updated`, `unchanged`, or `skipped` (a rerun, with the reason). */
export interface WrittenSharedFile {
  path: string;
  result: "created" | "block_added" | "block_updated" | "unchanged" | "skipped";
  link_to?: string;
  position?: "top";
  reason?: SharedSkipReason;
}

const RESULT_OF: Record<SharedAction, WrittenSharedFile["result"]> = { create: "created", add_block: "block_added", update_block: "block_updated", unchanged: "unchanged", skip: "skipped" };

/** The fields a plan row and a result row share. */
function sharedDetails(p: SharedFilePlan): { link_to?: string; position?: "top"; reason?: SharedSkipReason } {
  return { ...(p.linkTo === undefined ? {} : { link_to: p.linkTo }), ...(p.position === undefined ? {} : { position: p.position }), ...(p.reason === undefined ? {} : { reason: p.reason }) };
}

export function plannedSharedFiles(plans: readonly SharedFilePlan[]): PlannedSharedFile[] {
  return plans.map((p) => ({ path: p.path, action: p.action, ...sharedDetails(p) }));
}

export function writtenSharedFiles(plans: readonly SharedFilePlan[]): WrittenSharedFile[] {
  return plans.map((p) => ({ path: p.path, result: RESULT_OF[p.action], ...sharedDetails(p) }));
}

/** W1 R7 P6 review round 4: why a rerun does not change a shared file, in plain words (plan rows, result rows, and the summary). */
export const SKIP_WORDS: Record<SharedSkipReason, string> = {
  no_section: "it has no BuildOS section, and a rerun does not add one",
  missing: "it is not there, and a rerun does not create it",
  not_a_file: "it is not a regular file",
  link: "it is a link that does not lead to another of these shared files",
  too_large: "it is larger than 4 MiB, so BuildOS did not read it",
  unsupported_encoding: "it is not UTF-8 text",
  unreadable: "BuildOS may not read it",
};

/** The skip reasons for which BuildOS could not read a file's text, so it cannot say whether its section is up to date. */
const NOT_CHECKED: ReadonlySet<SharedSkipReason> = new Set(["unreadable", "too_large"]);

/** How the CLI spells a `buildos init` command in the output. */
export interface CommandStyle {
  /** `buildos`, or the `npx -y build-os@<version>` form (`runProgram`, PE-023). */
  program: readonly string[];
  platform: string;
  json: boolean;
}

/** `buildos init --root <root> <flag>`, as a user would type it. */
export function initCommand(style: CommandStyle, root: string, flag: string): string {
  return runCommand(style, ["init", "--root", root, flag, ...(style.json ? ["--json"] : [])]);
}

/** The init command that a stop or failure says to run again: `buildos init`, or the runnable form of a release (PE-023). */
export function initAgain(run: PrintedRun): string {
  return runCommand(run, ["init"]);
}

/** The tip of a stop for paths that exist already. */
export function clashTip(run: PrintedRun): string {
  return `Move or back up these files, then run \`${initAgain(run)}\` again.`;
}

/** What the plan and the output say about the shared files. */
export const SHARED_FILES_NOTE = "BuildOS changes only its own section of these files, between its buildos:begin and buildos:end lines, and only when that section is still exactly as BuildOS wrote it.";

/**
 * What the Make Docs question says Make Docs adds (W1 R7 P8 final check,
 * P8-F-06). True for the pinned range (MAKE_DOCS_RANGE `~2.0.9`, whose lower
 * and upper bounds are both 2.0.9 on 2026-11-24): `docs/designs`,
 * `docs/plans`, `docs/prd`, and `docs/work` with their AGENTS.md and
 * CLAUDE.md routers, and the contracts, prompts, references, and templates
 * under `.make-docs/system/` (test/fixtures/make-docs-2.0.9-layout.txt).
 */
export const MAKE_DOCS_ABOUT =
  "Make Docs is an optional companion tool. It adds docs/ folders for designs, plans, requirements, and work, each with instructions for agents, and keeps its templates, rules, and prompts in .make-docs/, so agents can keep project documents in order.";

/** The limit of the pinned Make Docs version (PRD 20 Make Docs Companion Setup; register Q-010). */
export const MAKE_DOCS_LIMIT = "This Make Docs version does not set up a folder that has an AGENTS.md or CLAUDE.md file that Make Docs did not write.";

/**
 * True when, after this run, the folder has an `AGENTS.md` or `CLAUDE.md`
 * that holds no Make Docs section, so the pinned Make Docs version cannot set
 * it up later (W1 R7 P6 review round 2: from what is on disk, not from the
 * setup kind). Such a file is there now (`foreignRouters`), or a new project
 * creates one with only the BuildOS section (`missingRouters`).
 */
export function makeDocsLaterBlocked(plan: InitPlan): boolean {
  return plan.foreignRouters.length > 0 || (plan.setup === "new_project" && plan.missingRouters.length > 0);
}

/** The answer to "can the user set up Make Docs later?", in plain words, for the no-TTY stop. */
export function makeDocsLaterText(plan: InitPlan): string {
  if (!makeDocsLaterBlocked(plan)) return "The user can also say no now and set up Make Docs later.";
  if (plan.foreignRouters.length === 0) {
    return "If the user says no, Make Docs cannot be set up in this folder later with this Make Docs version: it does not set up a folder that has an AGENTS.md or CLAUDE.md file that Make Docs did not write, and BuildOS adds such a file here.";
  }
  if (plan.setup === "rerun") {
    return "BuildOS is already set up here. If Make Docs is not set up here yet, this Make Docs version cannot set it up, because this folder has an AGENTS.md or CLAUDE.md file that Make Docs did not write. BuildOS finishes either way.";
  }
  return "This folder already has an AGENTS.md or CLAUDE.md file that Make Docs did not write. This Make Docs version does not set up such a folder, so Make Docs setup will not finish here, now or later. BuildOS setup finishes either way.";
}

/** The shell each shown command is written for: `sh` on macOS and Linux, Command Prompt (`cmd`) on Windows. */
export function commandShell(platform: string): "sh" | "cmd" {
  return platform === "win32" ? "cmd" : "sh";
}

export interface StoppedResult {
  status: "stopped";
  reason: "paths_exist" | "shared_file_problem" | "manifest_problem" | "make_docs_choice_needed" | "setup_changed" | "changed_during_setup" | "folder_not_writable";
  summary: string;
  setup: InitSetup;
}

export interface ClashResult extends StoppedResult {
  reason: "paths_exist" | "shared_file_problem" | "manifest_problem";
  clashes: Clash[];
  /** Problems BuildOS cannot safely work around, each with its fix. */
  problems: InitProblem[];
  tip: string;
  /** Set when Make Docs ran before the stop (Yes, then the folder changed): what Make Docs did. */
  make_docs?: MakeDocsReport;
}

/** The first words of a stop: "Nothing was changed." only when Make Docs did not run. */
function stopPrefix(makeDocs: MakeDocsReport | undefined): string {
  if (makeDocs === undefined || makeDocs.status === "skipped" || makeDocs.status === "not_started") return "Nothing was changed.";
  return makeDocs.status === "set_up" ? "Make Docs was set up, but BuildOS changed nothing." : "Make Docs ran but did not finish its setup, and BuildOS changed nothing.";
}

/** The retry note after Make Docs ran: it is not run a second time. */
function afterMakeDocs(makeDocs: MakeDocsReport | undefined, run: PrintedRun): string {
  return makeDocs !== undefined && (makeDocs.status === "set_up" || makeDocs.status === "failed") ? ` Make Docs already ran, so add --skip-make-docs when you run ${initAgain(run)} again.` : "";
}

/**
 * The stop for clashes and problems. With `makeDocs`, Make Docs already ran
 * (the second check, after Make Docs, found a clash), so the summary says
 * what changed.
 */
export function clashResult(prepared: PreparedInit, makeDocs?: MakeDocsReport): ClashResult {
  const count = prepared.plan.clashes.length;
  const problems = prepared.plan.problems;
  const manifest = problems.some((p) => p.problem === "manifest_not_a_file" || p.problem === "manifest_not_valid");
  const parts: string[] = [];
  if (count > 0) parts.push(`${count === 1 ? "1 path that BuildOS must add is" : `${count} paths that BuildOS must add are`} already in this folder`);
  if (manifest) parts.push("BuildOS cannot read its manifest, .os/manifest.json");
  else if (problems.length > 0) parts.push(`BuildOS cannot safely add its section to ${problems.length === 1 ? "1 file" : `${problems.length} files`}`);
  return {
    status: "stopped",
    summary: `${stopPrefix(makeDocs)} ${parts.join(", and ")}.`,
    setup: prepared.plan.setup,
    clashes: prepared.plan.clashes,
    problems,
    tip: `${count > 0 ? clashTip(prepared.run) : `Fix each file as shown, then run \`${initAgain(prepared.run)}\` again.`}${afterMakeDocs(makeDocs, prepared.run)}`,
    reason: count > 0 ? "paths_exist" : manifest ? "manifest_problem" : "shared_file_problem",
    ...(makeDocs === undefined ? {} : { make_docs: makeDocs }),
  };
}

const SETUP_WORDS: Record<InitSetup, string> = {
  new_project: "a new project",
  adoption: "a project set up with the earlier BuildOS tools",
  rerun: "a project that BuildOS already set up",
};

export interface SetupChangedResult extends StoppedResult {
  reason: "setup_changed";
  /** What BuildOS planned before Make Docs ran. */
  planned_setup: InitSetup;
  /** What the folder looks like now. */
  found_setup: InitSetup;
  tip: string;
  make_docs: MakeDocsReport;
}

/** The stop when the folder looks different after Make Docs ran (for example, Make Docs added an .os/ folder). */
export function setupChangedResult(prepared: PreparedInit, now: PreparedInit, makeDocs: MakeDocsReport): SetupChangedResult {
  return {
    status: "stopped",
    summary: `${stopPrefix(makeDocs)} BuildOS planned to set up ${SETUP_WORDS[prepared.plan.setup]}, but after Make Docs ran, the folder looks like ${SETUP_WORDS[now.plan.setup]}.`,
    setup: prepared.plan.setup,
    planned_setup: prepared.plan.setup,
    found_setup: now.plan.setup,
    tip: `Check the .os/ folder and what Make Docs added, then run \`${initAgain(prepared.run)}\` again.${afterMakeDocs(makeDocs, prepared.run)}`,
    reason: "setup_changed",
    make_docs: makeDocs,
  };
}

export interface ChangedDuringSetupResult extends StoppedResult {
  reason: "changed_during_setup";
  /** Each path BuildOS will write that changed while Make Docs ran. */
  changed: ChangedPath[];
  tip: string;
  make_docs: MakeDocsReport;
}

const CHANGE_WORDS: Record<ChangedPath["change"], string> = {
  appeared: "it was not there before Make Docs ran, and now it is",
  removed: "it was there before Make Docs ran, and now it is gone",
  changed: "it changed while Make Docs ran",
};

/** The words for one changed path, as the human output lists it. */
export function changeWords(change: ChangedPath["change"]): string {
  return CHANGE_WORDS[change];
}

/** The stop when a path BuildOS will write changed while Make Docs ran (W1 R7 P6 review round 3). */
export function changedDuringSetupResult(prepared: PreparedInit, changed: ChangedPath[], makeDocs: MakeDocsReport): ChangedDuringSetupResult {
  const count = changed.length;
  return {
    status: "stopped",
    summary: `${stopPrefix(makeDocs)} While Make Docs ran, ${count === 1 ? "1 path that BuildOS must write" : `${count} paths that BuildOS must write`} changed, so BuildOS did not write over ${count === 1 ? "it" : "them"}.`,
    setup: prepared.plan.setup,
    changed,
    tip: `Check ${count === 1 ? "this path" : "these paths"}, then run \`${initAgain(prepared.run)}\` again.${afterMakeDocs(makeDocs, prepared.run)}`,
    reason: "changed_during_setup",
    make_docs: makeDocs,
  };
}

export interface NotWritableResult extends StoppedResult {
  reason: "folder_not_writable";
  /** Each folder BuildOS must write in that does not allow it, with the error. */
  folders: { path: string; error: string }[];
  tip: string;
}

export function notWritableResult(prepared: PreparedInit, folders: { path: string; error: string }[]): NotWritableResult {
  return {
    status: "stopped",
    summary: `Nothing was changed. BuildOS cannot write in ${folders.length === 1 ? "1 folder" : `${folders.length} folders`} that it must add files to.`,
    setup: prepared.plan.setup,
    folders,
    tip: `Allow your user to write in these folders, then run \`${initAgain(prepared.run)}\` again.`,
    reason: "folder_not_writable",
  };
}

/** The folders a plan writes in that exist already (each checked before any write), with one path to write there. */
export function writeTargets(plan: InitPlan): { folder: string; path: string }[] {
  const created = new Set(plan.entries.filter((e) => e.kind === "folder").map((e) => e.path));
  const paths = [...plan.entries.map((e) => e.path), ...plan.shared.filter((s) => s.action !== "unchanged" && s.action !== "skip").map((s) => s.path)];
  const out = new Map<string, string>();
  for (const path of paths) {
    const slash = path.lastIndexOf("/");
    const folder = slash < 0 ? "" : path.slice(0, slash);
    if (!created.has(folder) && !out.has(folder)) out.set(folder, path);
  }
  return [...out].map(([folder, path]) => ({ folder: folder === "" ? "./" : `${folder}/`, path }));
}

export interface ChoiceNeededResult extends StoppedResult {
  reason: "make_docs_choice_needed";
  question: string;
  about_make_docs: string;
  later: string;
  /** The shell the commands are written for: `sh` (macOS, Linux) or `cmd` (Windows Command Prompt, default settings). */
  shell: "sh" | "cmd";
  choices: { answer: "yes" | "no"; meaning: string; command: string }[];
}

export function choiceNeededResult(prepared: PreparedInit, style: CommandStyle): ChoiceNeededResult {
  // The plain words and both commands come first; the reason code last (A53).
  return {
    status: "stopped",
    summary: "Nothing was changed. BuildOS needs one answer from the user first.",
    question: "Set up Make Docs in this project?",
    about_make_docs: MAKE_DOCS_ABOUT,
    later: makeDocsLaterText(prepared.plan),
    shell: commandShell(style.platform),
    choices: [
      { answer: "yes", meaning: "Set up BuildOS and Make Docs.", command: initCommand(style, prepared.root, "--make-docs") },
      { answer: "no", meaning: "Set up BuildOS only.", command: initCommand(style, prepared.root, "--skip-make-docs") },
    ],
    setup: prepared.plan.setup,
    reason: "make_docs_choice_needed",
  };
}

export type MakeDocsReport =
  | { choice: "not_decided"; status: "not_started"; note: string }
  | { choice: "yes"; status: "not_started" | "set_up"; command: string }
  | { choice: "no"; status: "skipped"; later: string; later_command?: string }
  | { choice: "yes"; status: "failed"; reason: string; detail?: string; tip?: string; retry_note?: string; retry_command: string };

/**
 * Shown when Make Docs failed and the folder already had its own root
 * `AGENTS.md` or `CLAUDE.md` (with no Make Docs section) before Make Docs
 * ran. `changed`: the router files BuildOS actually added its section to
 * (W1 R7 P6 review round 2: from the write results, never assumed).
 */
export function makeDocsUserFilesTip(changed: readonly string[]): string {
  const kept = "This folder already had its own AGENTS.md or CLAUDE.md. Your files were kept";
  return changed.length === 0 ? `${kept}.` : `${kept}, and BuildOS added its section to ${changed.join(" and ")}.`;
}

/** Shown with the retry command when the pinned Make Docs version cannot set up this folder after the run. */
export const MAKE_DOCS_RETRY_NOTE = `${MAKE_DOCS_LIMIT} So with this version, the command below stops the same way in this folder. It can work with a newer Make Docs version.`;

/** The No result of a rerun. */
export const MAKE_DOCS_NOT_RUN = "BuildOS did not run Make Docs, as chosen.";

/** The No result's words: how, or whether, Make Docs can be set up later. */
export const MAKE_DOCS_NO_LATER_BLOCKED = `With this Make Docs version, Make Docs cannot be set up in this folder later. ${MAKE_DOCS_LIMIT}`;

export interface PlannedResult {
  status: "planned";
  summary: string;
  setup: InitSetup;
  planned: PlannedWrite[];
  shared_files: PlannedSharedFile[];
  manifest: ProjectManifest;
  make_docs: MakeDocsReport;
  /** Plain notes (P7-R1-09). Present only when there is one. */
  notes?: InitNote[];
}

export function plannedResult(prepared: PreparedInit, makeDocs: MakeDocsReport): PlannedResult {
  const what = { new_project: "add to this folder", adoption: "add to this existing BuildOS project", rerun: "change in this folder, where BuildOS is already set up" }[prepared.plan.setup];
  return {
    status: "planned",
    summary: `Nothing was changed. This is what buildos init would ${what}.`,
    setup: prepared.plan.setup,
    planned: plannedWrites(prepared.plan),
    shared_files: plannedSharedFiles(prepared.plan.shared),
    manifest: prepared.manifest,
    make_docs: makeDocs,
    ...(prepared.plan.notes === undefined ? {} : { notes: prepared.plan.notes }),
  };
}

export interface SetupResult {
  status: "complete" | "partial";
  summary: string;
  setup: InitSetup;
  written: PlannedWrite[];
  shared_files: WrittenSharedFile[];
  manifest: ProjectManifest;
  make_docs: MakeDocsReport;
  /** Plain notes (P7-R1-09). Present only when there is one. */
  notes?: InitNote[];
}

/**
 * The Make Docs part of a result. `plan` is the plan BuildOS writes (or
 * would write): it says whether the pinned Make Docs version can set up the
 * folder after the run. The tip about the user's own router files is added
 * by `setupResult`, from what BuildOS wrote.
 */
export function makeDocsReport(outcome: MakeDocsOutcome | "skipped", command: string, plan: InitPlan): MakeDocsReport {
  const blocked = makeDocsLaterBlocked(plan);
  // A rerun cannot tell whether Make Docs is set up already (BuildOS does not read Make Docs state), so it says only that it did not run it.
  if (outcome === "skipped" && plan.setup === "rerun") return { choice: "no", status: "skipped", later: MAKE_DOCS_NOT_RUN };
  if (outcome === "skipped") return blocked ? { choice: "no", status: "skipped", later: MAKE_DOCS_NO_LATER_BLOCKED } : { choice: "no", status: "skipped", later: "To set up Make Docs later, run the command in later_command.", later_command: command };
  if (outcome.status === "set_up") return { choice: "yes", status: "set_up", command: outcome.command };
  return {
    choice: "yes",
    status: "failed",
    reason: outcome.reason,
    ...(outcome.detail === undefined ? {} : { detail: outcome.detail }),
    ...(blocked ? { retry_note: MAKE_DOCS_RETRY_NOTE } : {}),
    retry_command: outcome.command,
  };
}

/**
 * The finished setup. `userRouters`: the root `AGENTS.md` and `CLAUDE.md`
 * that the user had before Make Docs ran, with no Make Docs section (from
 * the first plan). With a Make Docs failure, the result says they were
 * kept, and names those that BuildOS added its section to.
 */
export function setupResult(prepared: PreparedInit, report: MakeDocsReport, userRouters: readonly string[] = []): SetupResult {
  let makeDocs = report;
  if (report.status === "failed" && userRouters.length > 0 && prepared.plan.setup !== "rerun") {
    const mine = new Set(userRouters);
    const changed = prepared.plan.shared.filter((s) => (s.action === "add_block" || s.action === "update_block") && mine.has(s.path)).map((s) => s.path);
    makeDocs = { ...report, tip: makeDocsUserFilesTip(changed) };
  }
  const partial = makeDocs.status === "failed";
  const plan = prepared.plan;
  let what: string;
  if (plan.setup === "rerun") {
    const refreshed = plan.shared.filter((s) => s.action === "update_block").length;
    // W1 R7 P6 review round 4: "up to date" only for sections BuildOS checked; each file it could not check is named, with why.
    const notChecked = plan.shared.filter((s) => s.action === "skip" && s.reason !== undefined && NOT_CHECKED.has(s.reason));
    const current = plan.shared.filter((s) => s.action === "unchanged" && s.linkTo === undefined).map((s) => s.path);
    if (refreshed > 0) what = `BuildOS was already set up in this folder. It refreshed its section in ${refreshed === 1 ? "1 shared file" : `${refreshed} shared files`}`;
    else if (notChecked.length === 0) what = "BuildOS is already set up in this folder, and its sections are up to date";
    else what = `BuildOS is already set up in this folder${current.length > 0 ? `. Its section is up to date in ${current.join(", ")}` : ""}`;
    if (notChecked.length > 0) what += `. BuildOS could not check ${notChecked.map((s) => `${s.path}, because ${SKIP_WORDS[s.reason!]}`).join("; or ")}`;
  } else {
    what = plan.setup === "adoption" ? "BuildOS adopted this existing project" : "BuildOS is set up in this folder";
  }
  const unchangedRerun = plan.setup === "rerun" && !plan.shared.some((s) => s.action === "update_block");
  let summary: string;
  if (partial) summary = `${what}, but Make Docs is not set up.`;
  else if (makeDocs.status === "set_up") summary = plan.setup === "rerun" ? `${what}. Make Docs was set up.` : `${what}, with Make Docs.`;
  else summary = unchangedRerun ? `${what}. Nothing was changed.` : `${what}.`;
  return {
    status: partial ? "partial" : "complete",
    summary,
    setup: plan.setup,
    written: plannedWrites(plan),
    shared_files: writtenSharedFiles(plan.shared),
    manifest: prepared.manifest,
    make_docs: makeDocs,
    ...(plan.notes === undefined ? {} : { notes: plan.notes }),
  };
}

export interface FailedResult {
  status: "failed";
  summary: string;
  setup: InitSetup;
  /** The error that stopped the run, in plain words. */
  why: string;
  /** Each path BuildOS could not put back as it was, with the reason. Empty when the undo was complete. */
  not_restored: NotRestored[];
  tip: string;
  /** Set when Make Docs ran before the failure: what Make Docs did. */
  make_docs?: MakeDocsReport;
}

/**
 * A failure after the checks: BuildOS undid its writes (`notRestored` lists
 * what it could not put back for sure: real leftovers, and content put back
 * whose save to disk is not certain).
 */
export function failedResult(prepared: PreparedInit, why: string, notRestored: NotRestored[], makeDocs?: MakeDocsReport): FailedResult {
  const undone = notRestored.length === 0;
  const onlyUnsure = !undone && notRestored.every((n) => n.state === "unsure");
  let summary = undone
    ? "BuildOS could not finish its setup, so it undid its own changes."
    : onlyUnsure
      ? "BuildOS could not finish its setup. It undid its own changes, but it could not make sure that every undo was saved to disk."
      : "BuildOS could not finish its setup, and it could not undo all of its own changes.";
  if (makeDocs?.status === "set_up") summary += " Make Docs was set up before this, and it stays set up.";
  else if (makeDocs?.status === "failed") summary += " Make Docs ran before this, but it did not finish its setup.";
  const tip = undone
    ? `Fix the problem shown in "Why", then run \`${initAgain(prepared.run)}\` again.${afterMakeDocs(makeDocs, prepared.run)}`
    : onlyUnsure
      ? `Check that each path listed holds what it held before, fix the problem shown in "Why", then run \`${initAgain(prepared.run)}\` again.${afterMakeDocs(makeDocs, prepared.run)}`
      : `Look at each path listed. Move away what BuildOS left there, fix the problem shown in "Why", then run \`${initAgain(prepared.run)}\` again.${afterMakeDocs(makeDocs, prepared.run)}`;
  return {
    status: "failed",
    summary,
    setup: prepared.plan.setup,
    why,
    not_restored: notRestored,
    tip,
    ...(makeDocs === undefined ? {} : { make_docs: makeDocs }),
  };
}
