/**
 * File access of `buildos extract bulk` (W1 R7 P9 t4), shaped as `work.py`
 * used Python's `pathlib`: `read_text()` (UTF-8, universal newlines, a byte
 * order mark kept), `is_file()`, `exists()`, `glob("*.jsonl")`, an exclusive
 * create, and a temporary-file replace. Every read and write goes through
 * the root port, so it stays inside the project folder and every read is
 * bounded (`READ_LIMITS`). A failure is a Python `OSError` text with the
 * absolute path, as the script printed it.
 *
 * W1 R7 P9 review round 1:
 *
 * - P9-R1-05: every read goes through the opened-file-checked reader
 *   (`FsPort.readFileLimited`), with the in-root link rule of the other
 *   domains: a link at the name is read only when it leads to a regular file
 *   inside the project.
 * - P9-R1-10, P9-R1-11: the writes of one command are a transaction. While
 *   the command runs, `replace`, `createExclusive`, and `mkdirp` only queue
 *   their change, and later reads in the same command see the queued bytes
 *   (so the command's logic is the script's, step by step). `apply` then
 *   checks every destination before the first change (each size against
 *   the bound its reader uses, each folder can take a new entry, no folder
 *   at a file's name) and makes the changes in the script's order, each one
 *   atomic. When one fails, the changes already made are undone in reverse,
 *   each only while the entry is still the one this command wrote (the
 *   earlier bytes and permission bits, or the earlier link, are put back;
 *   a new file or folder is removed). Undo stops at the first step it cannot
 *   undo, so what stays is what a crash at that point would leave: for
 *   `publish`, the publication intent in the review (written first) still
 *   names the pending files, and the next `publish` resumes it.
 *
 * W1 R7 P9 review round 2:
 *
 * - P9-R2-01: a write that took effect before a later part of it failed
 *   (the folder flush after the rename; the port reports it as
 *   `WriteLeftovers.committed`) is journaled before the undo runs, so it is
 *   undone too. An earlier file put back whose save to disk is not certain
 *   is `unsure`, and the undo stops there: the publication intent stays while
 *   any data file of the publication is not surely back. Each undo of a path
 *   expects the entry the step after it put back, so two writes of one file
 *   (the review's intent, then its final state) undo in order.
 * - P9-R2-07, P9-R2-08: every leftover is reported with its exact path and
 *   reason (`NotRestored`): a temporary file of a failed write, a lock file
 *   that could not be removed.
 *
 * The script locked `extractions/staging/` and `.os/data/` with `flock`
 * (Windows: `msvcrt.locking` on a file in the temporary folder). Node has no
 * file lock, so a lock is an exclusive lock file in `extractions/staging/`
 * that the command removes when it ends (divergence SD-09). It records the
 * process, the host, and the time, so a lock that a crash left behind can be
 * checked and cleared by hand.
 */

import { EntryChangedError, FsReadFailure, FsWriteFailure, PathRefusedError, isCoreError } from "../shared/errors.ts";
import { leftoversOf, type FsPort } from "../shared/fs-port.ts";
import { pathsOf, type NotRestored } from "../shared/not-restored.ts";
import { formatLimit } from "../shared/read-limits.ts";
import { pyUniversalNewlines } from "../shared/py-json.ts";
import { osError, pyDecodeUtf8, PyException, valueError } from "../shared/py-text.ts";

/** Who holds a lock: written into the lock file (SD-09). */
export interface LockOwner {
  pid: number;
  host: string;
}

type Op = { kind: "write"; rel: string; data: Uint8Array; exclusive: boolean } | { kind: "mkdir"; rel: string };

type Snapshot = { kind: "missing" } | { kind: "file"; data: Uint8Array; mode: number } | { kind: "symlink"; target: string; mode: number };

/** What a failed `apply` left: each path it changed and could not put back, with the reason (P9-R2-07). */
export class BulkWriteError extends PyException {
  readonly notRestored: NotRestored[];
  constructor(message: string, notRestored: NotRestored[]) {
    super("OSError", message, true);
    this.notRestored = notRestored;
  }
}

/** Why a temporary file of a failed write is still there. */
const TEMP_LEFT = "a temporary file of a failed write that BuildOS could not remove; delete it";
/** Why an earlier file is back but not certain on disk (the folder flush after the rename failed). */
const UNSURE = "BuildOS put back its earlier content, but could not make sure that the change was saved to disk; check it, then run the command again";
/** Why a change stays: the undo stops at the first step it cannot undo (P9-R1-10), so a pending publication can finish. */
const KEPT = "BuildOS changed this and did not put it back, because its undo stops at the first file it cannot put back";

export class BulkFs {
  readonly fs: FsPort;
  /** The root as the script printed it (`Path.resolve()`; here the root as given, absolute). */
  readonly root: string;
  readonly sep: string;
  /** Folders the lock made (removed again after a failure when empty). */
  private readonly made: string[] = [];
  private readonly ops: Op[] = [];
  /** The bytes a queued write puts at a path (read-your-writes). */
  private readonly pending = new Map<string, Uint8Array>();
  private readonly pendingDirs = new Set<string>();
  /** Paths `apply` changed (for `write_status`). */
  changed = 0;
  /** A lock file this command could not remove after it ended (P9-R2-08). */
  readonly lockLeft: NotRestored[] = [];

  constructor(fs: FsPort, root: string, sep: string) {
    this.fs = fs;
    this.root = root;
    this.sep = sep;
  }

  /** `str(root / rel)`. */
  abs(rel: string): string {
    const native = this.sep === "\\" ? rel.replaceAll("/", "\\") : rel;
    return this.root.endsWith(this.sep) ? `${this.root}${native}` : `${this.root}${this.sep}${native}`;
  }

  /** `str(path.relative_to(root))`, with `/` on every system (divergence SD-07: the script used the system separator). */
  native(rel: string): string {
    return rel;
  }

  private fail(error: unknown, rel: string, forWrite: boolean): never {
    if (error instanceof PathRefusedError) throw new PyException("OSError", `${this.abs(rel)} leads out of the project folder or is not a regular file or folder, so BuildOS did not ${forWrite ? "write" : "read"} it`, forWrite);
    if (error instanceof EntryChangedError) throw new PyException("OSError", `${this.abs(rel)} changed while BuildOS was working, so BuildOS did not ${forWrite ? "change" : "use"} it; run the command again`, forWrite);
    if (error instanceof FsReadFailure && error.fs.errno === "EFBIG") throw new PyException("OSError", `${this.abs(rel)} is larger than ${formatLimit(error.fs.limit ?? 0)}, so BuildOS did not read it`);
    if (error instanceof FsReadFailure || error instanceof FsWriteFailure) throw osError(error.fs.errno, this.abs(rel), forWrite || error instanceof FsWriteFailure);
    if (isCoreError(error)) throw new PyException("OSError", `${this.abs(rel)}: ${error.message}`, forWrite);
    throw error;
  }

  /** Reads a file through the opened-file-checked reader (P9-R1-05), at most `limit` bytes; a queued write is read back. */
  readBytes(rel: string, limit: number): Uint8Array {
    const queued = this.pending.get(rel);
    if (queued !== undefined) return queued;
    let read;
    try {
      read = this.fs.readFileLimited(rel, limit, { followLinkInRoot: true });
    } catch (error) {
      this.fail(error, rel, false);
    }
    if (read.tooLarge) throw new PyException("OSError", `${this.abs(rel)} is larger than ${formatLimit(limit)}, so BuildOS did not read it`);
    return read.data;
  }

  /** `Path.read_text()`. */
  readText(rel: string, limit: number): string {
    return pyUniversalNewlines(pyDecodeUtf8(this.readBytes(rel, limit)));
  }

  /** `Path.is_file()`: false for a missing path, a folder, or a path the port refuses. */
  isFile(rel: string): boolean {
    if (this.pending.has(rel)) return true;
    try {
      return this.fs.stat(rel)?.kind === "file";
    } catch {
      return false;
    }
  }

  /** `Path.exists()`. */
  exists(rel: string): boolean {
    if (this.pending.has(rel) || this.pendingDirs.has(rel)) return true;
    try {
      return this.fs.stat(rel) !== undefined;
    } catch {
      return false;
    }
  }

  private kindNow(rel: string): "file" | "directory" | undefined {
    if (this.pending.has(rel)) return "file";
    if (this.pendingDirs.has(rel)) return "directory";
    return this.fs.stat(rel)?.kind;
  }

  /** `Path.mkdir(parents=True, exist_ok=True)`, queued. */
  mkdirp(rel: string): void {
    const parts = rel.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const at = parts.slice(0, i).join("/");
      try {
        const kind = this.kindNow(at);
        if (kind === "directory") continue;
        if (kind === "file") throw new PyException("FileExistsError", `[Errno 17] File exists: '${this.abs(at)}'`, true);
        this.ops.push({ kind: "mkdir", rel: at });
        this.pendingDirs.add(at);
      } catch (error) {
        if (error instanceof PyException) throw error;
        this.fail(error, at, true);
      }
    }
  }

  /** `json.dump` to a temporary file and `os.replace` over the target, queued. */
  replace(rel: string, data: Uint8Array): void {
    this.ops.push({ kind: "write", rel, data, exclusive: false });
    this.pending.set(rel, data);
  }

  /** `open(path, "x")`: queues a new file; false when one is there. */
  createExclusive(rel: string, data: Uint8Array): boolean {
    try {
      if (this.pending.has(rel) || this.fs.entryId(rel) !== undefined) return false;
    } catch (error) {
      this.fail(error, rel, true);
    }
    this.ops.push({ kind: "write", rel, data, exclusive: true });
    this.pending.set(rel, data);
    return true;
  }

  /** `sorted(folder.glob(pattern))` names for a `*<suffix>` or `<prefix>*<suffix>` pattern (queued files included). */
  glob(folder: string, prefix: string, suffix: string): string[] {
    let names: string[] = [];
    try {
      if (this.fs.stat(folder)?.kind === "directory") names = this.fs.list(folder);
    } catch {
      names = [];
    }
    for (const rel of this.pending.keys()) {
      const slash = rel.lastIndexOf("/");
      if (rel.slice(0, Math.max(slash, 0)) === folder && !names.includes(rel.slice(slash + 1))) names.push(rel.slice(slash + 1));
    }
    return names.filter((name) => name.length >= prefix.length + suffix.length && name.startsWith(prefix) && name.endsWith(suffix)).sort(compareCodePoints);
  }

  /** True when this command queued a change. */
  get hasChanges(): boolean {
    return this.ops.length > 0;
  }

  /**
   * Makes every queued change, after the checks (P9-R1-10, P9-R1-11). Each
   * written file must be at most `limit` bytes (the bound its reader uses).
   * Throws a `PyException` before any change, or a `BulkWriteError` after a
   * failed change (with `leftChanged` when the undo was not complete).
   */
  apply(limit: number): void {
    const ops = [...this.ops];
    this.ops.length = 0;
    this.pending.clear();
    this.pendingDirs.clear();
    // Sizes first: a file that later commands could not read is never written.
    for (const op of ops) {
      if (op.kind === "write" && op.data.length > limit) {
        throw valueError(`${op.rel} would be ${op.data.length} bytes, more than BuildOS reads from one such file (${formatLimit(limit)}); nothing was written`);
      }
    }
    // Every destination: its folder (the nearest one that exists, or that this command makes) can take a new entry, and no folder is at a file's name.
    const snapshots = new Map<string, Snapshot>();
    const dirs = new Set(ops.filter((op) => op.kind === "mkdir").map((op) => op.rel));
    for (const op of ops) {
      if (op.kind !== "write" || snapshots.has(op.rel)) continue;
      let folder = parentOf(op.rel);
      try {
        while (folder !== "." && dirs.has(folder)) folder = parentOf(folder);
        this.fs.checkCanCreateIn(folder);
        snapshots.set(op.rel, this.snapshot(op.rel, limit));
      } catch (error) {
        if (error instanceof PyException) throw error;
        this.fail(error, op.rel, true);
      }
    }
    const journal: { rel: string; undo: () => void }[] = [];
    const leftBehind: NotRestored[] = [];
    // The entry this command last put at each path: a restore writes a new entry, so an earlier step of the same path expects that one (P9-R2-01).
    const ids = new Map<string, string>();
    const undoWrite = (rel: string, before: Snapshot) => (): void => {
      const next = this.restore(rel, before, ids.get(rel)!);
      if (next === undefined) ids.delete(rel);
      else ids.set(rel, next);
    };
    const tempsOf = (error: unknown): void => {
      for (const path of leftoversOf(error).leftBehind ?? []) leftBehind.push({ path, reason: TEMP_LEFT, state: "left" });
    };
    try {
      for (const op of ops) {
        if (op.kind === "mkdir") {
          try {
            this.fs.mkdir(op.rel, { recursive: false });
          } catch (error) {
            this.fail(error, op.rel, true);
          }
          journal.push({ rel: `${op.rel}/`, undo: () => this.fs.remove(op.rel) });
          this.changed++;
          continue;
        }
        const before = snapshots.get(op.rel)!;
        snapshots.set(op.rel, { kind: "file", data: op.data, mode: 0 });
        let id: string;
        try {
          id = op.exclusive ? this.fs.writeNewFile(op.rel, op.data, { mode: 0o666, sync: true }).id : this.fs.writeFileAtomic(op.rel, op.data).id;
        } catch (error) {
          // P9-R2-01: a write that took effect before a later part of it failed (the folder flush after the rename) is journaled, so the undo puts the earlier file back.
          const committed = leftoversOf(error).committed;
          if (committed !== undefined) {
            ids.set(op.rel, committed.id);
            journal.push({ rel: op.rel, undo: undoWrite(op.rel, before) });
            this.changed++;
          }
          tempsOf(error);
          this.fail(error, op.rel, true);
        }
        ids.set(op.rel, id);
        journal.push({ rel: op.rel, undo: undoWrite(op.rel, before) });
        this.changed++;
      }
    } catch (error) {
      // Undo in reverse; stop at the first step that cannot be undone for sure, so what stays is what a crash there leaves.
      // For publish that keeps the intent in the review (written first) while any data file of the publication is not surely back.
      const left: NotRestored[] = [];
      let i = journal.length - 1;
      for (; i >= 0; i--) {
        const step = journal[i]!;
        try {
          step.undo();
          this.changed--;
        } catch (undoError) {
          tempsOf(undoError);
          if (leftoversOf(undoError).committed !== undefined) left.push({ path: step.rel, reason: UNSURE, state: "unsure" });
          else left.push({ path: step.rel, reason: `BuildOS could not put it back (${undoError instanceof Error ? undoError.message : String(undoError)})`, state: "left" });
          i--;
          break;
        }
      }
      for (; i >= 0; i--) if (!left.some((item) => item.path === journal[i]!.rel)) left.push({ path: journal[i]!.rel, reason: KEPT, state: "left" });
      left.push(...leftBehind);
      const message = error instanceof Error ? error.message : String(error);
      if (left.length === 0) {
        if (error instanceof PyException) throw new BulkWriteError(`${message}; BuildOS put back every file it had changed`, []);
        throw error;
      }
      throw new BulkWriteError(`${message}; BuildOS could not put back: ${pathsOf(left).join(", ")}`, left);
    }
  }

  /** What is at `rel` before the first change: nothing, a file's bytes and mode, or a link's text. */
  private snapshot(rel: string, limit: number): Snapshot {
    const entry = this.fs.entryId(rel);
    if (entry === undefined) return { kind: "missing" };
    if (entry.kind === "symlink") {
      const link = this.fs.readLink(rel);
      if (link !== undefined) return { kind: "symlink", target: link.target, mode: link.mode };
    }
    if (entry.kind !== "file") throw new PyException("IsADirectoryError", `[Errno 21] Is a directory: '${this.abs(rel)}'`, true);
    const read = this.fs.readFileLimited(rel, limit);
    if (read.tooLarge) throw new PyException("OSError", `${this.abs(rel)} is larger than ${formatLimit(limit)}, so BuildOS did not change it`, true);
    return { kind: "file", data: read.data, mode: read.mode };
  }

  /** Puts `before` back at `rel`, only while the entry there is still `id` (the one this command wrote); returns the identity of the entry put back. */
  private restore(rel: string, before: Snapshot, id: string): string | undefined {
    const expect = { kind: "entry" as const, id };
    if (before.kind === "missing") {
      this.fs.remove(rel, { expect });
      return undefined;
    }
    if (before.kind === "symlink") return this.fs.symlinkAtomic(rel, before.target, { mode: before.mode, expect }).id;
    return this.fs.writeFileAtomic(rel, before.data, before.mode === 0 ? { expect } : { mode: before.mode, exactMode: true, expect }).id;
  }

  /** Makes a folder now (for the lock), noting it so a failed command can remove it again. */
  private mkdirNow(rel: string): void {
    const parts = rel.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const at = parts.slice(0, i).join("/");
      try {
        const kind = this.fs.stat(at)?.kind;
        if (kind === "directory") continue;
        if (kind === "file") throw new PyException("FileExistsError", `[Errno 17] File exists: '${this.abs(at)}'`, true);
        this.fs.mkdir(at, { recursive: false });
        this.made.push(at);
      } catch (error) {
        if (error instanceof PyException) throw error;
        this.fail(error, at, true);
      }
    }
  }

  /** Removes, deepest first, the folders the lock made, when they are still empty. */
  removeMadeFolders(): void {
    for (const at of [...this.made].reverse()) {
      try {
        if (this.fs.list(at).length === 0) this.fs.remove(at);
      } catch {
        // Kept: a folder that holds something or cannot be removed stays.
      }
    }
    this.made.length = 0;
  }

  /**
   * Takes a lock file (exclusive create, made at once, not queued);
   * `message` is the script's. The file records who took it (SD-09).
   */
  lock(folder: string, message: string, owner: LockOwner, now: string): string {
    this.mkdirNow(folder);
    if (folder !== "extractions/staging") this.mkdirNow("extractions/staging");
    const lockRel = `extractions/staging/.buildos-extract-bulk-${folder === "extractions/staging" ? "stage" : "publish"}.lock`;
    const record = `${JSON.stringify({ command: "buildos extract bulk", pid: owner.pid, host: owner.host, started_at: now })}\n`;
    try {
      this.fs.writeNewFile(lockRel, new TextEncoder().encode(record));
    } catch (error) {
      // P9-R2-08: only an entry already at the name is another command's lock; any other failure is a write error at the lock path (exit 5).
      if (error instanceof FsWriteFailure && error.fs.errno === "EEXIST") throw valueError(`${message}. ${this.lockHelp(lockRel)}`);
      for (const path of leftoversOf(error).leftBehind ?? []) this.lockLeft.push({ path, reason: "a lock file that BuildOS could not create completely or remove; delete it before the next command", state: "left" });
      this.fail(error, lockRel, true);
    }
    return lockRel;
  }

  /** How to check and clear a lock file that is in place (SD-09; P9-R1-22). */
  private lockHelp(lockRel: string): string {
    let who = "";
    try {
      const read = this.fs.readFileLimited(lockRel, 4096);
      const data = read.tooLarge ? undefined : (JSON.parse(new TextDecoder().decode(read.data)) as { pid?: unknown; host?: unknown; started_at?: unknown });
      if (data !== undefined && typeof data.pid === "number" && typeof data.host === "string" && typeof data.started_at === "string") {
        who = ` It was taken at ${data.started_at} by process ${data.pid} on ${data.host}.`;
        return `The lock file ${this.native(lockRel)} is in place.${who} A command that crashed leaves it behind, also when only one person works in the project. If that process is no longer running (macOS and Linux: ps -p ${data.pid}; Windows: tasklist /FI "PID eq ${data.pid}"), delete ${this.native(lockRel)} and run the command again`;
      }
    } catch {
      // An older or unreadable lock file: the plain steps below.
    }
    return `The lock file ${this.native(lockRel)} is in place. A command that crashed leaves it behind, also when only one person works in the project. If no other buildos extract bulk command is running, delete ${this.native(lockRel)} and run the command again`;
  }

  /**
   * Removes the lock file. P9-R2-08: a lock file that cannot be removed would
   * stop the next command, so it is recorded (`lockLeft`) with its exact path,
   * and the run reports it (exit 10, `partially_applied`), also when the
   * command's own writes completed.
   */
  unlock(lockRel: string): void {
    try {
      this.fs.remove(lockRel);
    } catch (error) {
      const why = error instanceof FsWriteFailure || error instanceof FsReadFailure ? error.fs.errno : error instanceof Error ? error.message : String(error);
      this.lockLeft.push({ path: lockRel, reason: `BuildOS could not remove its lock file (${why}); it stops the next buildos extract bulk command until you delete it`, state: "left" });
    }
  }
}

/** The folder of a `/`-separated relative path: `.` for a top-level name. */
function parentOf(rel: string): string {
  const slash = rel.lastIndexOf("/");
  return slash === -1 ? "." : rel.slice(0, slash);
}

export function compareCodePoints(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const cx = x[i]!.codePointAt(0)!;
    const cy = y[i]!.codePointAt(0)!;
    if (cx !== cy) return cx - cy;
  }
  return x.length - y.length;
}
