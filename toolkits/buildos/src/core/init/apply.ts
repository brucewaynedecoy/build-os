/**
 * Writes an `init` plan through the filesystem port, as one unit.
 *
 * - A new folder or file is created with `mkdir` or `O_EXCL`, so an entry
 *   that appeared after the plan is never overwritten.
 * - A replaced wrapper or skill file (adoption) and a shared file that gets a
 *   BuildOS section are replaced atomically. The plan read each of them once,
 *   before Make Docs ran (W1 R7 P6 review round 2): the write passes that
 *   snapshot as what it expects at the destination (`ExpectedEntry`: the
 *   bytes, the permission bits, and the identity, or the link text and
 *   identity), and the port checks it as the last step before the rename.
 *   So a file changed since the plan (an editor save, a `chmod`) stops the
 *   run, and a link stays a link until the check.
 * - A shared file keeps its full permission bits (setuid, setgid, sticky).
 * - A shared file that the plan keeps as it is (`unchanged`, or a link to
 *   another shared file) is checked again after the writes, with a bounded
 *   read. When it changed, the run stops and is undone.
 *
 * The journal (W1 R7 P6 review rounds 1 and 2): each step records the
 * identity of the entry it made, and for a file also the state it wrote
 * (its bytes and permission bits, compared with a bounded read), and for a
 * replaced entry what was there before. A write that committed its entry
 * and then failed (the folder flush after the rename) still reports the
 * entry (`WriteLeftovers.committed`), so it is journaled too. When any step
 * fails, the undo runs in reverse order: a replaced entry gets its earlier
 * file or link back, and a created entry is removed, each only when the
 * entry is still exactly what this run wrote (the port checks identity,
 * bytes, and mode right before it acts). A later edit by the user, also one
 * in place that keeps the identity, is kept and listed. Each path that
 * cannot be put back, and each entry a failed write could not remove (its
 * temporary file), is reported, never skipped in silence: `ApplyFailure`
 * carries the first error and the list.
 */

import { CoreError, NeedsOperatorReviewError } from "../shared/errors.ts";
import { leftoversOf, type ExpectedEntry, type FsEntryId, type FsPort } from "../shared/fs-port.ts";
import type { Before, InitPlan } from "./plan.ts";

/** The temporary file name of an atomic write: `.gitignore` would give the refused default `..gitignore.`. */
const TEMP_NAME = { tempPrefix: ".buildos-init-", tempSuffix: ".tmp" };

/** One journaled step: the entry this run made (its identity and what it wrote), and for a replace what was there before. */
interface Step {
  path: string;
  made: "folder" | "file" | "replaced";
  /** The entry this run made: identity and permission bits. */
  id: FsEntryId;
  /** For a file: the bytes this run wrote there. */
  data?: Uint8Array;
  before?: Before;
}

/**
 * A path the undo could not put back for sure, and why, in plain words
 * (W1 R7 P6 review round 3): `left` is a real leftover (a changed entry, a
 * temporary file, a folder that is not empty); `unsure` is an entry whose
 * earlier content BuildOS did put back, but could not make sure was saved to
 * disk (the folder flush after the rename failed).
 */
export interface NotRestored {
  path: string;
  reason: string;
  state: "left" | "unsure";
}

/**
 * The run failed. `cause` is the first error; `notRestored` lists every path
 * the undo could not put back (empty when the undo was complete).
 */
export class ApplyFailure extends Error {
  readonly notRestored: NotRestored[];

  constructor(cause: unknown, notRestored: NotRestored[]) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "ApplyFailure";
    this.notRestored = notRestored;
  }
}

/** Why a failed write left an entry that this run could not remove. */
const LEFT_BEHIND = "BuildOS could not remove this file after a failed write, so it is still there";

export function applyInit(plan: InitPlan, fs: FsPort): void {
  const journal: Step[] = [];
  const leftBehind: NotRestored[] = [];
  /** Runs one write; a failed write that still committed its entry is journaled, and what it left behind is listed. */
  const write = (path: string, step: Omit<Step, "id" | "path">, action: () => FsEntryId): void => {
    try {
      journal.push({ path, ...step, id: action() });
    } catch (error) {
      const leftovers = leftoversOf(error);
      if (leftovers.committed !== undefined) journal.push({ path, ...step, id: leftovers.committed });
      for (const left of leftovers.leftBehind ?? []) leftBehind.push({ path: left, reason: LEFT_BEHIND, state: "left" });
      throw error;
    }
  };
  try {
    for (const entry of plan.entries) {
      if (entry.kind === "folder") {
        fs.mkdir(entry.path, { recursive: false, mode: 0o755 });
        // W1 R7 P6 review round 3: the folder is journaled the moment it exists, also when reading it back fails.
        let id: FsEntryId | undefined;
        try {
          id = fs.entryId(entry.path);
        } finally {
          journal.push({ path: entry.path, made: "folder", id: id ?? UNKNOWN_FOLDER });
        }
        if (id === undefined) throw new Error(`${entry.path} was not there right after BuildOS made it`);
      } else if (entry.action === "create") {
        const data = entry.data ?? new Uint8Array();
        write(entry.path, { made: "file", data }, () => fs.writeNewFile(entry.path, data, { mode: entry.mode ?? 0o644 }));
      } else {
        const before = entry.before;
        if (before === undefined) throw new Error(`the plan did not read ${entry.path} before replacing it`);
        // W1 R7 P6 review round 3: the link count and a link's own mode are part of what the plan read.
        const expect: ExpectedEntry =
          before.kind === "file" ? { kind: "file", data: before.data, mode: before.mode, id: before.id, links: before.links } : { kind: "symlink", target: before.target, id: before.id, mode: before.mode, links: before.links };
        const data = entry.data ?? new Uint8Array();
        write(entry.path, { made: "replaced", data, before }, () => fs.writeFileAtomic(entry.path, data, { mode: entry.mode ?? 0o644, exactMode: true, expect, ...TEMP_NAME }));
      }
    }
    for (const shared of plan.shared) {
      if (shared.action === "unchanged" || shared.action === "skip") continue;
      const data = shared.data ?? new Uint8Array();
      if (shared.action === "create") {
        write(shared.path, { made: "file", data }, () => fs.writeNewFile(shared.path, data, { mode: 0o644 }));
        continue;
      }
      const old = shared.before ?? new Uint8Array();
      const mode = shared.mode ?? 0o644;
      const before: Before = { kind: "file", data: old, mode, id: shared.id ?? "", links: shared.links ?? 1 };
      // The port checks the planned bytes, mode, identity, and link count again as the last step before the rename.
      const expect: ExpectedEntry = { kind: "file", data: old, mode, links: shared.links ?? 1, ...(shared.id === undefined ? {} : { id: shared.id }) };
      write(shared.path, { made: "replaced", data, before }, () => fs.writeFileAtomic(shared.path, data, { mode, exactMode: true, expect, ...TEMP_NAME }));
    }
    // The entries the plan keeps must still be as planned when the run reports success.
    for (const shared of plan.shared) {
      if (shared.action !== "unchanged") continue;
      const still =
        shared.linkTo !== undefined
          ? fs.matchesEntry(shared.path, { kind: "symlink", target: shared.linkTarget ?? "" }) && sameEntry(fs.resolvedId(shared.path), fs.entryId(shared.linkTo))
          : fs.matchesEntry(shared.path, { kind: "file", data: shared.before ?? new Uint8Array(), ...(shared.mode === undefined ? {} : { mode: shared.mode }), ...(shared.id === undefined ? {} : { id: shared.id }) });
      if (!still) {
        throw new NeedsOperatorReviewError(`${shared.path} changed while buildos init was running`, { code: "init_shared_file_changed", correction: "Run `buildos init` again." });
      }
    }
  } catch (error) {
    throw new ApplyFailure(error, [...leftBehind, ...undo(fs, journal)]);
  }
}

function sameEntry(a: FsEntryId | undefined, b: FsEntryId | undefined): boolean {
  return a !== undefined && b !== undefined && b.kind === "file" && a.id === b.id;
}

/**
 * What the undo expects at a path: exactly what this run wrote there. A
 * folder: its identity (the removal of a folder that is not empty fails on
 * its own). A file: its identity, permission bits, and bytes.
 */
function written(step: Step): ExpectedEntry {
  if (step.made === "folder" || step.data === undefined) return { kind: "entry", id: step.id.id };
  return { kind: "file", data: step.data, mode: step.id.mode, id: step.id.id };
}

/** The identity of a folder this run made but could not read back: it never matches, so the undo leaves the folder and says why. */
const UNKNOWN_FOLDER: FsEntryId = { kind: "directory", id: "", mode: 0, links: 0 };

/**
 * Undoes the journal in reverse order; returns each path it could not put
 * back for sure. A created entry that is already gone is not listed: the
 * path is as it was before the run (W1 R7 P6 review round 3).
 */
function undo(fs: FsPort, journal: readonly Step[]): NotRestored[] {
  const left: NotRestored[] = [];
  for (const step of [...journal].reverse()) {
    const shown = step.made === "folder" ? `${step.path}/` : step.path;
    if (step.made === "folder" && step.id.id === "") {
      left.push({ path: shown, reason: "BuildOS made this folder but could not check it afterwards, so it left it there", state: "left" });
      continue;
    }
    try {
      const expect = written(step);
      if (step.made !== "replaced") {
        if (gone(fs, step.path)) continue;
        fs.remove(step.path, { expect });
      } else if (step.before?.kind === "symlink") fs.symlinkAtomic(step.path, step.before.target, { mode: step.before.mode, expect });
      else if (step.before !== undefined) fs.writeFileAtomic(step.path, step.before.data, { mode: step.before.mode, exactMode: true, expect, ...TEMP_NAME });
    } catch (error) {
      const leftovers = leftoversOf(error);
      // The earlier entry is back in place; only the folder flush after it failed.
      if (step.made === "replaced" && leftovers.committed !== undefined) left.push({ path: shown, reason: UNSURE, state: "unsure" });
      else left.push({ path: shown, reason: reasonOf(error), state: "left" });
      for (const extra of leftovers.leftBehind ?? []) left.push({ path: extra, reason: LEFT_BEHIND, state: "left" });
    }
  }
  return left;
}

const UNSURE = "BuildOS put back its earlier content, but could not make sure that the change was saved to disk";

/** True when nothing is at `path` now (a created entry that someone already removed). */
function gone(fs: FsPort, path: string): boolean {
  try {
    return fs.entryId(path) === undefined;
  } catch {
    return false;
  }
}

function reasonOf(error: unknown): string {
  if (error instanceof CoreError && error.code === "entry_changed") return "it changed after BuildOS wrote it, so BuildOS left it as it is";
  const message = error instanceof Error ? error.message : String(error);
  return /ENOTEMPTY|EEXIST|not empty/i.test(message) ? "the folder is not empty, so BuildOS left it" : message;
}
