/**
 * The plan of `buildos init` (PRD 20 Project Initialization and Adoption).
 *
 * The root is `--root` or the current folder, never a parent folder (see
 * `resolveDefaultRoot`). What the folder holds decides the setup:
 *
 * - No `.os/` folder: a new project. Every `system/` package file,
 *   `.os/manifest.json`, the wrappers (part of the package content), and
 *   `.os/skills/`, plus a BuildOS section in the shared files.
 * - An `.os/` folder with no `.os/manifest.json`: an adoption of a project
 *   set up with the earlier Go tools. Only `.os/manifest.json`, the
 *   wrappers, and `.os/skills/`. Nothing else is ever written, so user data,
 *   runs, findings, indexes, and config keep every byte.
 * - An `.os/manifest.json` that is a valid BuildOS manifest: a rerun in a
 *   project that BuildOS already set up (W1 R7 P6 review round 1; PRD 20
 *   owner decision 1, "re-running init is idempotent"). It writes no file of
 *   its own: it only refreshes a BuildOS section that is already in a shared
 *   file. Every other BuildOS file stays as it is (W2 owns update).
 * - An `.os/manifest.json` that is not a regular file, or not a valid
 *   manifest: a problem that stops the command before any write.
 *
 * A path that the plan must create and that already exists is a clash. Any
 * clash stops the command before it writes (exit code 10). The root
 * `AGENTS.md`, `CLAUDE.md`, and `.gitignore` are the closed exception:
 * BuildOS adds or updates its own marked section in them and never changes
 * another line (`shared-files.ts`). A shared-file problem also stops the
 * command before it writes (exit code 10). In an adoption, an existing
 * wrapper or packaged skill file is replaced (BuildOS owns those files).
 *
 * Names on disk (W1 R7 P6 review round 1): each path is looked up in its
 * folder's listing. When the exact spelling is not listed, the filesystem
 * port is asked whether the volume finds the name anyway (a case- or
 * Unicode-insensitive volume, as on macOS and Windows): then the entry with
 * the same identity is the one meant, and the plan keeps its spelling on
 * disk. On a case-sensitive volume, differently spelled names stay distinct.
 */

import { isCoreError } from "../shared/errors.ts";
import type { FsDirEntry, FsPort } from "../shared/fs-port.ts";
import type { HashPort } from "../shared/hash-port.ts";
import { MANIFEST_PATH, SKILLS_DIR, WRAPPER_FILES, type PackageContent } from "./content.ts";
import { MANIFEST_MAX_BYTES, parseManifest, type ProjectManifest } from "./manifest.ts";
import { hardLinkProblem, hasMakeDocsSection, planSharedFiles, ROUTER_PATHS, SHARED_FILE_MAX_BYTES, SHARED_PATHS, sharedReader, type FoundEntry, type SharedFilePlan, type SharedFileProblem, type SharedRead } from "./shared-files.ts";

export type InitSetup = "new_project" | "adoption" | "rerun";

export interface PlannedEntry {
  /** Project-relative path with `/` separators, spelled as on disk where an entry exists. A folder has no trailing `/` here. */
  path: string;
  kind: "file" | "folder";
  action: "create" | "replace";
  /** File bytes; `undefined` for a folder. */
  data?: Uint8Array;
  /** Permission bits for a file. */
  mode?: number;
  /**
   * For a `replace` (an adoption): what is there now, read once during the
   * plan, before Make Docs runs (W1 R7 P6 review round 2). The write checks
   * it again right before the rename, and the undo puts it back.
   */
  before?: Before;
}

/** What was at a replaced path when the plan read it: a file's bytes, full mode, identity, and hard link count, or a link's text, mode, and identity. */
export type Before = { kind: "file"; data: Uint8Array; mode: number; id: string; links: number } | { kind: "symlink"; target: string; mode: number; id: string; links: number };

export interface Clash {
  path: string;
  /** What is at the path now. */
  found: "file" | "folder" | "link" | "other";
}

/** A problem that stops the command before any write: a shared file, or `.os/manifest.json`. */
export interface InitProblem extends Omit<SharedFileProblem, "problem"> {
  problem: SharedFileProblem["problem"] | "manifest_not_a_file" | "manifest_not_valid" | "replace_too_large";
}

export interface InitPlan {
  setup: InitSetup;
  /** Folders first (parents before children), then files, each group in path order. The shared files are not here. */
  entries: PlannedEntry[];
  /** `AGENTS.md`, `CLAUDE.md`, and `.gitignore`; empty in an adoption. */
  shared: SharedFilePlan[];
  clashes: Clash[];
  /** Problems BuildOS cannot safely work around. Each stops the command, as a clash does. */
  problems: InitProblem[];
  /** True when the root has an `AGENTS.md` or `CLAUDE.md` of any kind now (spelled any way the volume finds). */
  rootRouters: boolean;
  /**
   * The root `AGENTS.md` and `CLAUDE.md` that are there now and hold no Make
   * Docs section (`hasMakeDocsSection`; a link counts as the file it leads
   * to among them, else as not Make Docs's). The pinned Make Docs version
   * does not set up a folder with such a file (PRD 20 Make Docs Companion
   * Setup).
   */
  foreignRouters: string[];
  /** The root `AGENTS.md` and `CLAUDE.md` that are not there now. A new project creates them, with only the BuildOS section. */
  missingRouters: string[];
  /** In a rerun: the manifest on disk, as read. */
  installed?: ProjectManifest;
  /** Plain notes for the result (W1 R7 P7 review round 1, P7-R1-09). They never stop the command. */
  notes?: InitNote[];
}

/** A plain note in the result of `buildos init`. It never changes what BuildOS writes. */
export interface InitNote {
  code: string;
  path: string;
  message: string;
}

/** The legacy Python validator of a Go-era project. Adoption leaves it as it is. */
export const LEGACY_VALIDATOR_PATH = ".os/scripts/validate_config.py";

/**
 * P7-R1-09: the note when adoption finds the legacy validator. It names the
 * project wrapper alone, with no version in it, so it stays true after an
 * upgrade (F-P8-11 review round 1, finding 5): adoption writes the wrapper.
 * The wrapper checks the folder it is run in, so the note names the project
 * folder (F-P8-11 review round 2, finding 1): an adoption with --root from
 * another folder must not send the adopter to validate the wrong folder.
 */
export function legacyValidatorNote(root: string): string {
  return `${LEGACY_VALIDATOR_PATH} is the old Python config check. BuildOS no longer uses it: in the project folder ${root}, run .os/scripts/buildos validate instead (on Windows, .os\\scripts\\buildos.cmd validate). Where .os/scripts/AGENTS.md or your own notes name the old script, use that command instead. BuildOS left the file as it is. You can delete it.`;
}

export interface PlanInput {
  fs: FsPort;
  /** The project folder as the output shows it (`PreparedInit.root`), for the notes. */
  root: string;
  hash: HashPort;
  content: PackageContent;
  /** The `.os/manifest.json` text. */
  manifest: string;
}

type EntryKind = FsDirEntry["kind"] | "missing";

export function planInit(input: PlanInput): InitPlan {
  const look = lookup(input.fs);
  // W1 R7 P6 review round 3: each root shared file is read at most once per plan.
  const read = sharedReader(input.fs, look);
  const rootRouters = look("AGENTS.md").kind !== "missing" || look("CLAUDE.md").kind !== "missing";
  const routers = routerOwners(look, read);
  const bodies = new Map(input.content.files.filter((file) => SHARED_PATHS.has(file.path)).map((file) => [file.path, file.data] as const));
  if (look(".os").kind === "directory") {
    const manifest = look(MANIFEST_PATH);
    if (manifest.kind !== "missing") {
      const installed = readManifest(input.fs, manifest);
      if ("problem" in installed) return { setup: "rerun", entries: [], shared: [], clashes: [], problems: [installed], rootRouters, ...routers };
      const planned = planSharedFiles(bodies, look, read, input.hash, true);
      return { setup: "rerun", entries: [], shared: planned.plans, clashes: [], problems: planned.problems, rootRouters, ...routers, installed: installed.manifest };
    }
  }
  const setup: InitSetup = look(".os").kind === "directory" ? "adoption" : "new_project";
  const wrappers = new Set(WRAPPER_FILES);
  const files = input.content.files
    .filter((file) => !SHARED_PATHS.has(file.path))
    .filter((file) => setup === "new_project" || wrappers.has(file.path) || file.path.startsWith(`${SKILLS_DIR}/`))
    .map((file) => ({ path: file.path, data: file.data, mode: file.mode }));
  files.push({ path: MANIFEST_PATH, data: new TextEncoder().encode(input.manifest), mode: 0o644 });

  const folders = new Set<string>([SKILLS_DIR]);
  for (const file of files) {
    for (const parent of parents(file.path)) folders.add(parent);
  }

  const entries: PlannedEntry[] = [];
  const clashes: Clash[] = [];
  const replaceProblems: InitProblem[] = [];
  const clashed = new Set<string>();
  for (const folder of [...folders].sort(compareCodeUnits)) {
    if (parents(folder).some((p) => clashed.has(p))) continue;
    const found = look(folder);
    if (found.kind === "missing") entries.push({ path: found.path, kind: "folder", action: "create" });
    else if (found.kind !== "directory") {
      clashes.push({ path: found.path, found: clashKind(found.kind) });
      clashed.add(folder);
    }
  }
  for (const file of files.sort((a, b) => compareCodeUnits(a.path, b.path))) {
    // A clashing folder hides what is below it: list only the folder.
    if (parents(file.path).some((p) => clashed.has(p))) continue;
    const found = look(file.path);
    const replaceable = setup === "adoption" && file.path !== MANIFEST_PATH && (wrappers.has(file.path) || file.path.startsWith(`${SKILLS_DIR}/`));
    if (found.kind === "missing") entries.push({ path: found.path, kind: "file", action: "create", data: file.data, mode: file.mode });
    else if (replaceable && (found.kind === "file" || found.kind === "symlink")) {
      // W1 R7 P6 review round 2: what the replace acts on is read now, before Make Docs runs.
      const before = snapshot(input.fs, found.path, found.kind);
      if (before === "too_large") {
        replaceProblems.push({
          path: found.path,
          problem: "replace_too_large",
          message: `${found.path} is larger than ${SHARED_FILE_MAX_BYTES / (1024 * 1024)} MiB, so BuildOS cannot keep a copy to put back if setup fails.`,
          fix: "Move the file away, then run the same init command again.",
        });
      } else if (before.links > 1) {
        // W1 R7 P6 review rounds 3 and 4: the replace would break the hard link (of a file, or of a link itself), so it stops before Make Docs runs.
        replaceProblems.push(hardLinkProblem(found.path, before.links));
      } else {
        // W1 R7 P6 review round 3: a replaced file keeps its own permission bits, and its owner can run it (a link gets the package mode).
        const mode = before.kind === "file" ? before.mode | 0o100 : file.mode;
        entries.push({ path: found.path, kind: "file", action: "replace", data: file.data, mode, before });
      }
    } else clashes.push({ path: found.path, found: clashKind(found.kind) });
  }
  let shared: SharedFilePlan[] = [];
  const problems: InitProblem[] = [...replaceProblems];
  if (setup === "new_project") {
    const planned = planSharedFiles(bodies, look, read, input.hash);
    shared = planned.plans;
    problems.push(...planned.problems);
    clashes.push(...planned.clashes);
  }
  // P7-R1-09: an adopted Go-era project may still have the old Python validator. It is not changed; the result says so.
  const notes: InitNote[] = [];
  // P7-R2-07: only a regular file (its folder entry, not followed) is the old validator; a folder or a link at that name is not.
  if (setup === "adoption" && look(LEGACY_VALIDATOR_PATH).kind === "file") notes.push({ code: "legacy_validator_kept", path: LEGACY_VALIDATOR_PATH, message: legacyValidatorNote(input.root) });
  return { setup, entries, shared, clashes, problems, rootRouters, ...routers, ...(notes.length > 0 ? { notes } : {}) };
}

/** The file or link a replace acts on, read once (a file with a bound), or `too_large`. */
function snapshot(fs: FsPort, path: string, kind: "file" | "symlink"): Before | "too_large" {
  if (kind === "symlink") {
    const link = fs.readLink(path);
    const id = fs.entryId(path);
    if (link !== undefined && id !== undefined && id.kind === "symlink") return { kind: "symlink", target: link.target, mode: link.mode, id: id.id, links: id.links };
    // It changed since the listing: read it as what it is now.
    return snapshot(fs, path, "file");
  }
  const read = fs.readFileLimited(path, SHARED_FILE_MAX_BYTES);
  return read.tooLarge ? "too_large" : { kind: "file", data: read.data, mode: read.mode, id: read.id, links: read.links };
}

/**
 * W1 R7 P7 review round 2 (P7-R2-03): the root `AGENTS.md` and `CLAUDE.md` of
 * the folder `fs` is bound to that hold no Make Docs section, by the same rule
 * and reads as `buildos init` (`InitPlan.foreignRouters`). When there is one,
 * the pinned Make Docs version cannot set up that folder (PRD 20 Make Docs
 * Companion Setup). A folder that cannot be listed counts as such a folder,
 * so no output promises a setup that may fail.
 */
export function makeDocsForeignRouters(fs: FsPort): string[] {
  try {
    const look = lookup(fs);
    return routerOwners(look, sharedReader(fs, look)).foreignRouters;
  } catch (error) {
    if (!isCoreError(error)) throw error;
    return [...ROUTER_PATHS];
  }
}

/**
 * Which root routers are there, and which of them hold no Make Docs section
 * (see `InitPlan.foreignRouters`). From the plan's one read of each file. A
 * router BuildOS cannot read (W1 R7 P6 review round 3) has an unknown owner,
 * which never stops the plan: it counts as one Make Docs did not write, so
 * no output promises a Make Docs setup that may not work.
 */
function routerOwners(look: (path: string) => FoundEntry, read: (path: string) => SharedRead): { foreignRouters: string[]; missingRouters: string[] } {
  const foreignRouters: string[] = [];
  const missingRouters: string[] = [];
  const makeDocs = (path: string): boolean => {
    const now = read(path);
    if (now.kind === "symlink") return now.sibling !== undefined && ROUTER_PATHS.some((r) => look(r).path === now.sibling) && makeDocs(now.sibling);
    return now.kind === "file" && !now.tooLarge && hasMakeDocsSection(now.data);
  };
  for (const router of ROUTER_PATHS) {
    const found = look(router);
    if (found.kind === "missing") missingRouters.push(found.path);
    else if (!makeDocs(router)) foreignRouters.push(found.path);
  }
  return { foreignRouters, missingRouters };
}

const MANIFEST_FIX_VALID = "Put back a good copy of .os/manifest.json. To have BuildOS adopt this folder again instead, move .os/manifest.json away. Then run the same init command again.";

/** `.os/manifest.json` read once with a bound, under the manifest contract (`parseManifest`), or why it cannot be. */
function readManifest(fs: FsPort, found: FoundEntry): { manifest: ProjectManifest } | InitProblem {
  if (found.kind !== "file") {
    const what = found.kind === "directory" ? "a folder" : found.kind === "symlink" ? "a link" : "not a regular file";
    return {
      path: found.path,
      problem: "manifest_not_a_file",
      message: `${found.path} is ${what}, so BuildOS cannot tell how this folder was set up.`,
      fix: "Move it away, then run the same init command again.",
    };
  }
  const read = fs.readFileLimited(found.path, MANIFEST_MAX_BYTES);
  const manifest = read.tooLarge ? undefined : parseManifest(read.data);
  if (manifest !== undefined) return { manifest };
  return {
    path: found.path,
    problem: "manifest_not_valid",
    message: `${found.path} is not a valid BuildOS manifest, so BuildOS cannot tell how this folder was set up.`,
    fix: MANIFEST_FIX_VALID,
  };
}

/** Each parent folder of `path`, outermost first. */
function parents(path: string): string[] {
  const parts = path.split("/");
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}

function clashKind(kind: EntryKind): Clash["found"] {
  if (kind === "directory") return "folder";
  if (kind === "symlink") return "link";
  if (kind === "file") return "file";
  return "other";
}

/** Folds a name the way a case- and Unicode-insensitive volume may. Only to pick candidates: identity decides. */
function fold(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

/**
 * What each path is, from its folder's entries, so a symlink is seen as a
 * link and never followed, and its spelling on disk (see the file comment).
 * A path below a missing folder or below something that is not a folder is
 * `missing` (its own parent is planned or clashes).
 */
export function lookup(fs: FsPort): (path: string) => FoundEntry {
  const listings = new Map<string, Map<string, FsDirEntry["kind"]>>();
  const found = new Map<string, FoundEntry>();
  const listing = (folder: string): Map<string, FsDirEntry["kind"]> => {
    let entries = listings.get(folder);
    if (entries === undefined) {
      entries = new Map(fs.readDir(folder === "" ? "." : folder).map((e) => [e.name, e.kind]));
      listings.set(folder, entries);
    }
    return entries;
  };
  const resolve = (path: string): FoundEntry => {
    const cached = found.get(path);
    if (cached !== undefined) return cached;
    const slash = path.lastIndexOf("/");
    const parent = slash < 0 ? { kind: "directory" as const, path: "" } : resolve(path.slice(0, slash));
    const name = path.slice(slash + 1);
    const at = (n: string) => (parent.path === "" ? n : `${parent.path}/${n}`);
    let result: FoundEntry;
    if (parent.kind !== "directory") {
      result = { kind: "missing", path: at(name) };
    } else {
      const names = listing(parent.path);
      const exact = names.get(name);
      if (exact !== undefined) result = { kind: exact, path: at(name) };
      else {
        // Not listed under this spelling: does the volume find it anyway?
        const probe = fs.entryId(at(name));
        if (probe === undefined) result = { kind: "missing", path: at(name) };
        else {
          const candidates = [...names.keys()].filter((n) => fold(n) === fold(name));
          const same = [...candidates, ...[...names.keys()].filter((n) => !candidates.includes(n))].find((n) => fs.entryId(at(n))?.id === probe.id);
          result = same === undefined ? { kind: probe.kind, path: at(name) } : { kind: names.get(same)!, path: at(same) };
        }
      }
    }
    found.set(path, result);
    return result;
  };
  return resolve;
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
