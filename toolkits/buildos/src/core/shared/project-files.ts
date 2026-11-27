/**
 * File access for the skill-script commands (W1 R7 P9: `buildos extract
 * bulk`, `buildos fitgap`, `buildos export azure-boards`). The scripts read
 * and wrote any path they were given; here:
 *
 * - A path the user names is used as written, relative to the project root
 *   (PRD 20 Output and Exit Contract), or absolute. W1 R7 P9 review round 1
 *   (P9-R1-13): the shared layout rule of every domain applies
 *   (`userPathRel`, `isInstalledLayout`): in an initialized project with no
 *   `system` entry at its root, a leading `system/` is the earlier spelling
 *   of the source package and is dropped; where the project owns a
 *   `system` entry, a `system/...` path names it.
 * - Every read goes through the root port's opened-file-checked reader
 *   (`FsPort.readFileLimited`, review round 1, P9-R1-05): bounded
 *   (`READ_LIMITS`), checked on the opened file and its folder, and inside
 *   the project folder, with or without `--allow-outside-root`. A link at the
 *   name is read only when it leads to a regular file inside the project. A
 *   read outside it fails with a plain message (`ProjectFileError`, exit 3).
 * - Every write is planned first (`WritePlan`): each destination is checked
 *   (inside the root, or `--allow-outside-root`; the size against the bound
 *   its reader uses; not a folder; review round 2, P9-R2-06: a regular file
 *   there is writable, and its mode is kept) before the first change. Review
 *   round 1 (P9-R1-04): no destination is read to write it (the one
 *   destination read is `readDestination`, P9-R2-02). A new file is written whole under a
 *   private temporary name in its folder; an entry that is already at the
 *   destination is moved aside by a same-folder rename to a private backup
 *   name, then the new file is renamed into place. A link at the written
 *   file itself is replaced, never followed (PRD 20; the link is moved aside
 *   as a link, with its identity). When a later step fails, the plan undoes
 *   every step in reverse (the new file removed only when it is still the
 *   one it wrote, each backup renamed back, each new folder removed) and
 *   reports what it could not put back. After the last step it removes the
 *   backups.
 */

import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { isInstalledLayout, userPathRel } from "./buildos-layout.ts";
import { EntryChangedError, FsReadFailure, FsWriteFailure, PathRefusedError, isCoreError, type FsFailureDetail } from "./errors.ts";
import { leftoversOf, type FsEntryId, type FsPort, type FsPortFactory } from "./fs-port.ts";
import { describe, pathsOf, type NotRestored } from "./not-restored.ts";
import { formatLimit } from "./read-limits.ts";
import { rootAsGiven } from "./root.ts";

/** Why a project file operation failed. `input`: a read (exit 3); `refused`: outside the root (exit 3); `io`: a write (exit 5); `size`: too large to read back (exit 4). */
export type ProjectFileFailure = "input" | "refused" | "io" | "size";

/** A failed read or write of a project file, with a plain message and, for a read, the OS error. */
export class ProjectFileError extends Error {
  readonly failure: ProjectFileFailure;
  readonly path: string;
  readonly errno: string | undefined;
  /** What this command changed or made and could not put back or remove, with exact paths (P9-R2-07). */
  readonly notRestored: NotRestored[];
  constructor(failure: ProjectFileFailure, message: string, path: string, errno?: string, notRestored: NotRestored[] = []) {
    super(message);
    this.name = "ProjectFileError";
    this.failure = failure;
    this.path = path;
    this.errno = errno;
    this.notRestored = notRestored;
  }

  /** The paths of `notRestored`. */
  get leftChanged(): string[] {
    return pathsOf(this.notRestored);
  }
}

export interface ProjectFilesInput {
  /** `--root`, or undefined for the current folder. */
  root?: string | undefined;
  cwd: string;
  openFs: FsPortFactory;
  /** `--allow-outside-root`: a write destination may be outside the project folder. */
  allowOutsideRoot?: boolean;
}

/** The project folder of one command, with its contained reads and planned writes. */
export class ProjectFiles {
  /** The root as given, absolute and folded (never resolved through links). */
  readonly root: string;
  readonly fs: FsPort;
  private readonly input: ProjectFilesInput;
  /** One port per volume (each drive on Windows), bound to its root, for typed absolute paths. */
  private readonly volumePorts = new Map<string, FsPort>();
  /** The root's identity (`""` when it has none), and the identities of typed folders (P9-R2-10). */
  private rootId: string | undefined;
  private readonly identities = new Map<string, string>();
  private layout: { installed: boolean; rootHasSystem: boolean } | undefined;

  constructor(input: ProjectFilesInput) {
    this.input = input;
    const given = input.root === undefined || input.root === "" ? input.cwd : input.root;
    this.fs = input.openFs(given, input.cwd);
    this.root = rootAsGiven(given, input.cwd);
  }

  /** The shared layout rule (`isInstalledLayout`) and whether the root has a `system` entry, read once. */
  private layoutRule(): { installed: boolean; rootHasSystem: boolean } {
    if (this.layout === undefined) {
      const probe = (rel: string): "file" | "directory" | undefined => {
        try {
          return this.fs.stat(rel)?.kind;
        } catch {
          return undefined;
        }
      };
      let rootHasSystem: boolean;
      try {
        rootHasSystem = this.fs.entryId("system") !== undefined;
      } catch {
        // An entry the port cannot look at is still an entry: the path stays as written.
        rootHasSystem = true;
      }
      this.layout = { installed: isInstalledLayout(probe), rootHasSystem };
    }
    return this.layout;
  }

  /**
   * P9-R1-13: the root-relative spelling of a relative path the user named,
   * `/`-separated, by the shared rule `userPathRel` (PRD 20: a leading
   * `system/` is dropped only in an initialized project with no `system`
   * entry at its root).
   */
  userRel(path: string): string {
    const slashed = sep === "\\" ? path.replaceAll("\\", "/") : path;
    if (!slashed.startsWith("system/")) return path;
    const { installed, rootHasSystem } = this.layoutRule();
    const rel = userPathRel(slashed, installed, rootHasSystem);
    return rel === slashed ? path : rel;
  }

  /** The absolute path of `path`: as given when absolute, else relative to the root by the user-path rule. */
  abs(path: string): string {
    return isAbsolute(path) ? resolve(path) : resolve(this.root, this.userRel(path));
  }

  /**
   * `path` relative to the root (with this system's separator), or undefined
   * when it is outside the project folder.
   *
   * W1 R7 P9 review round 2 (P9-R2-10): an absolute path the user typed may
   * spell the project folder differently from the root (another letter case
   * on a case-insensitive volume, or `/var` for `/private/var` on macOS). When
   * it is not inside the root as spelled, the folders it names are compared
   * by identity instead: from the path upward, the first existing folder that
   * is the root itself (the same device and inode, through every link, as the
   * operating system resolves it) makes the rest of the path, as typed, the
   * path inside the project. The root port then reads or writes that rest
   * with its own checks (a link at a name, the opened file, the folder).
   */
  inside(path: string): string | undefined {
    const absolute = this.abs(path);
    const rel = relative(this.root, absolute);
    if (rel === "") return "";
    if (!(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))) return rel;
    return isAbsolute(path) ? this.insideByIdentity(absolute) : undefined;
  }

  /** The identity of the root, through every link (cached), or undefined when it has none. */
  private rootIdentity(): string | undefined {
    if (this.rootId === undefined) {
      try {
        this.rootId = this.fs.resolvedId(".")?.id ?? "";
      } catch {
        this.rootId = "";
      }
    }
    return this.rootId === "" ? undefined : this.rootId;
  }

  /** P9-R2-10: the rest of `absolute` below its first ancestor that is the root folder itself, or undefined. */
  private insideByIdentity(absolute: string): string | undefined {
    const rootId = this.rootIdentity();
    if (rootId === undefined) return undefined;
    const port = this.volumeOf(absolute);
    const tail: string[] = [];
    let at = absolute;
    for (;;) {
      let id = this.identities.get(at);
      if (id === undefined) {
        try {
          id = port.resolvedId(at)?.id ?? "";
        } catch {
          id = "";
        }
        this.identities.set(at, id);
      }
      if (id === rootId) return tail.reverse().join(sep);
      const parent = dirname(at);
      if (parent === at) return undefined;
      tail.push(at.slice(parent.length).replace(/^[\\/]+/, ""));
      at = parent;
    }
  }

  /** A port bound to the volume of `absolute`, for metadata of a path the user typed and for authorized writes outside the root. */
  private volumeOf(absolute: string): FsPort {
    const volume = absolute.slice(0, absolute.indexOf(sep) + 1) || sep;
    let port = this.volumePorts.get(volume);
    if (port === undefined) {
      port = this.input.openFs(volume, this.input.cwd, { allowOutsideRoot: true });
      this.volumePorts.set(volume, port);
    }
    return port;
  }

  /** The refusal of a path outside the project folder. */
  refusal(path: string, forWrite: boolean): ProjectFileError {
    return new ProjectFileError(
      "refused",
      forWrite
        ? `${path} is outside the project folder ${this.root}, so BuildOS did not write it. Pass --allow-outside-root to write there.`
        : `${path} is outside the project folder ${this.root}, so BuildOS did not read it. Move the file into the project folder.`,
      path,
    );
  }

  /** The path to hand the root port: relative to the root, with `/`. */
  private portPath(path: string, forWrite: boolean): { port: FsPort; path: string } {
    const rel = this.inside(path);
    if (rel !== undefined) {
      const portRel = rel === "" ? "." : rel.split(sep).join("/");
      // Review round 3 (P9-F-08): with --allow-outside-root, a destination whose folder is inside the project as
      // spelled but resolves outside it through a folder link is written as if its outside path had been named:
      // through the port of its volume. The link rule at the written file itself (PE-012) and the contained
      // reads stay; without the switch the root port refuses it with the message that names the switch.
      if (forWrite && this.input.allowOutsideRoot === true && this.folderLeavesRoot(portRel)) {
        const absolute = this.abs(path);
        return { port: this.volumeOf(absolute), path: absolute };
      }
      return { port: this.fs, path: portRel };
    }
    if (forWrite && this.input.allowOutsideRoot === true) {
      const absolute = this.abs(path);
      return { port: this.volumeOf(absolute), path: absolute };
    }
    throw this.refusal(path, forWrite);
  }

  /**
   * P9-F-08: true when the folder that holds `rel` (a root-relative `/` path),
   * or its nearest existing ancestor inside the project, resolves outside
   * the root through a link (or does not resolve at all).
   */
  private folderLeavesRoot(rel: string): boolean {
    let at = rel === "." ? "." : rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : ".";
    while (at !== ".") {
      let entry: FsEntryId | undefined;
      try {
        entry = this.fs.entryId(at);
      } catch (error) {
        if (error instanceof PathRefusedError) return true;
        return false;
      }
      if (entry !== undefined) {
        try {
          return this.fs.resolvedId(at) === undefined;
        } catch (error) {
          return error instanceof PathRefusedError;
        }
      }
      at = at.includes("/") ? at.slice(0, at.lastIndexOf("/")) : ".";
    }
    return false;
  }

  /**
   * Reads a file, at most `limit` bytes, through the opened-file-checked
   * reader (P9-R1-05): one open, checked against the entry at the name and
   * its folder; a link at the name is read only when it leads to a regular
   * file inside the project.
   */
  readBytes(path: string, limit: number): Uint8Array {
    const target = this.portPath(path, false);
    let read;
    try {
      read = target.port.readFileLimited(target.path, limit, { followLinkInRoot: true });
    } catch (error) {
      throw readError(error, path, limit);
    }
    if (read.tooLarge) throw new ProjectFileError("input", `${path} is larger than ${formatLimit(limit)}, so BuildOS did not read it.`, path, "EFBIG");
    return read.data;
  }

  /** What is at `path` (links followed), inside the root, or undefined. Never throws for a missing or refused path. */
  kind(path: string): "file" | "directory" | undefined {
    try {
      return this.kindStrict(path);
    } catch {
      return undefined;
    }
  }

  /** `kind`, but a path outside the project folder throws its refusal (P9-R1-02: a containment error is never an empty match). */
  kindStrict(path: string): "file" | "directory" | undefined {
    const target = this.portPath(path, false);
    try {
      return target.port.stat(target.path)?.kind;
    } catch (error) {
      if (error instanceof PathRefusedError) throw this.refusal(path, false);
      return undefined;
    }
  }

  /** The names in a folder, sorted by code unit, or [] when it is not a folder. Never throws. */
  list(path: string): string[] {
    try {
      return this.listStrict(path);
    } catch {
      return [];
    }
  }

  /** `list`, but a folder outside the project folder throws its refusal (P9-R1-02). */
  listStrict(path: string): string[] {
    const target = this.portPath(path, false);
    try {
      if (target.port.stat(target.path)?.kind !== "directory") return [];
      return target.port.list(target.path);
    } catch (error) {
      if (error instanceof PathRefusedError) throw this.refusal(path, false);
      return [];
    }
  }

  /**
   * P9-R1-06: the entries of a write destination folder (inside the root, or
   * outside it with `--allow-outside-root`), each with its own kind (a link
   * is not followed), sorted by name; [] when the folder does not exist.
   * Only names: no file in it is read.
   */
  listDestination(path: string): { name: string; kind: "file" | "directory" | "symlink" | "other" }[] {
    const target = this.portPath(path, true);
    try {
      if (target.port.stat(target.path)?.kind !== "directory") return [];
      return target.port.readDir(target.path);
    } catch (error) {
      if (error instanceof PathRefusedError) throw new ProjectFileError("refused", `${path} leads out of the project folder ${this.root}, so BuildOS did not write there. Pass --allow-outside-root to write there.`, path);
      const errno = error instanceof FsReadFailure || error instanceof FsWriteFailure ? error.fs.errno : undefined;
      throw new ProjectFileError("io", `BuildOS cannot read the folder ${path} (${errnoText(errno)}). BuildOS wrote nothing.`, path, errno);
    }
  }

  /**
   * W1 R7 P9 review round 2 (P9-R2-02): reads a file in a write destination
   * folder (inside the root, or an authorized folder outside it), at most
   * `limit` bytes, with no link followed at its name, through the port the
   * write uses. Only `fitgap packages` calls it, on a numbered `pkg-NN.json`
   * it would delete, to confirm that the file is its own earlier output.
   */
  readDestination(path: string, limit: number): Uint8Array {
    const target = this.portPath(path, true);
    let read;
    try {
      read = target.port.readFileLimited(target.path, limit);
    } catch (error) {
      throw readError(error, path, limit);
    }
    if (read.tooLarge) throw new ProjectFileError("input", `${path} is larger than ${formatLimit(limit)}, so BuildOS did not read it.`, path, "EFBIG");
    return read.data;
  }

  /** A new write plan for this project. */
  plan(): WritePlan {
    return new WritePlan(this);
  }

  /** @internal */
  writeTarget(path: string): { port: FsPort; path: string } {
    return this.portPath(path, true);
  }
}

function readError(error: unknown, path: string, limit: number): ProjectFileError {
  if (error instanceof PathRefusedError) {
    return new ProjectFileError("refused", `${path} leads out of the project folder or is not a regular file, so BuildOS did not read it.`, path);
  }
  if (error instanceof EntryChangedError) return new ProjectFileError("input", `${path} changed while BuildOS read it, so BuildOS did not use it. Run the command again.`, path);
  if (error instanceof FsReadFailure) {
    const detail: FsFailureDetail = error.fs;
    if (detail.errno === "EFBIG") return new ProjectFileError("input", `${path} is larger than ${formatLimit(detail.limit ?? limit)}, so BuildOS did not read it.`, path, "EFBIG");
    return new ProjectFileError("input", `BuildOS could not read ${path} (${errnoText(detail.errno)}).`, path, detail.errno);
  }
  if (isCoreError(error)) return new ProjectFileError("input", `BuildOS could not read ${path}: ${error.message}`, path);
  throw error;
}

/** A plain description of an OS error code. */
export function errnoText(errno: string | undefined): string {
  switch (errno) {
    case "ENOENT":
      return "no such file or folder";
    case "EISDIR":
      return "it is a folder, not a file";
    case "ENOTDIR":
      return "a part of the path is not a folder";
    case "EACCES":
    case "EPERM":
      return "permission denied";
    case "ELOOP":
      return "too many links";
    case "EROFS":
      return "the file system is read-only";
    default:
      return errno ?? "unknown error";
  }
}

/** The folder of a port path: `.` for a top-level relative name. */
function parentOf(path: string): string {
  if (isAbsolute(path)) return dirname(path);
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

/** The last name of a port path. */
function nameOf(path: string): string {
  if (isAbsolute(path)) return path.slice(dirname(path).length).replace(/^[\\/]/, "");
  return path.slice(path.lastIndexOf("/") + 1);
}

/** A sibling of `path` with a private name (`.<name>.buildos-<random>.<kind>`). */
function siblingName(path: string, kind: "new" | "backup"): string {
  const folder = parentOf(path);
  const name = `.${nameOf(path)}.buildos-${Math.floor(Math.random() * 0x1_0000_0000)
    .toString(16)
    .padStart(8, "0")}.${kind}`;
  if (folder === ".") return name;
  return isAbsolute(path) ? `${folder}${folder.endsWith(sep) ? "" : sep}${name}` : `${folder}/${name}`;
}

interface PlannedWrite {
  kind: "write";
  path: string;
  data: Uint8Array;
}
interface PlannedRemove {
  kind: "remove";
  path: string;
}

/** What `WritePlan.commit` left behind after every change took effect: backups it could not remove (harmless: a private hidden name), with exact paths. */
export interface CommitResult {
  leftBehind: NotRestored[];
}

/** `name` in the folder of `label` (the path as the user spelled it), for a report. */
function besideLabel(label: string, name: string): string {
  const slash = Math.max(label.lastIndexOf("/"), sep === "\\" ? label.lastIndexOf("\\") : -1);
  return slash < 0 ? name : `${label.slice(0, slash + 1)}${name}`;
}

/** True when the entry at `path` is the one with identity `id` (a rename that took effect). Never throws. */
function movedTo(port: FsPort, path: string, id: string): boolean {
  try {
    return port.entryId(path)?.id === id;
  } catch {
    return false;
  }
}

/** One step of a commit's undo, and what stays when it fails. */
interface UndoStep {
  run: () => void;
  /** What stays when `run` fails. */
  stays: (error: unknown) => NotRestored;
}

/**
 * Writes that are checked together before the first one runs, then made in
 * order, and undone when a later one fails.
 *
 * W1 R7 P9 review round 2:
 *
 * - P9-R2-06: a regular file that a write replaces keeps its permission
 *   bits (the new file gets exactly them, as the scripts' write in place
 *   kept them), and a destination that cannot be opened for writing (a
 *   read-only file, as `open(path, "w")` and `fs.writeFile` refused it) stops
 *   the plan before the first change (exit 5). A link at the destination is
 *   replaced, never followed (PE-012), and the new file gets the default
 *   mode.
 * - P9-R2-07: every leftover is reported with its exact path: a temporary
 *   file a failed write could not remove, an earlier file still under its
 *   backup name (and how to put it back), a new file that could not be
 *   removed, a folder that could not be removed. A backup that cannot be
 *   deleted after every change took effect is returned (`leftBehind`): the
 *   outputs are complete, and the command names it.
 */
export class WritePlan {
  private readonly files: ProjectFiles;
  private readonly steps: (PlannedWrite | PlannedRemove)[] = [];
  private readonly limits = new Map<string, { limit: number; label: string }>();
  private readonly folders: string[] = [];

  constructor(files: ProjectFiles) {
    this.files = files;
  }

  /** Writes `data` to `path`. With `readBack`, the file may not be larger than `limit` (the bound its reader uses). */
  write(path: string, data: string | Uint8Array, readBack?: { limit: number }): void {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    this.steps.push({ kind: "write", path, data: bytes });
    if (readBack !== undefined) this.limits.set(path, { limit: readBack.limit, label: path });
  }

  /** Removes the file or link at `path` (never a folder). */
  remove(path: string): void {
    this.steps.push({ kind: "remove", path });
  }

  /** Makes `path` and any missing parent folder (as `mkdir -p`), also when nothing is written there. */
  folder(path: string): void {
    this.folders.push(path);
  }

  /** The paths this plan writes. */
  get written(): string[] {
    return this.steps.filter((s) => s.kind === "write").map((s) => s.path);
  }

  /** The paths this plan removes. */
  get removed(): string[] {
    return this.steps.filter((s) => s.kind === "remove").map((s) => s.path);
  }

  /**
   * Checks every destination, then makes every change. Throws
   * `ProjectFileError`: `size`, `refused`, or `io` before any change; `io`
   * after a failed change, with `notRestored` naming exactly what could not
   * be put back or removed. Returns the backups it could not remove after
   * every change took effect (the outputs are complete; the command names
   * them).
   */
  commit(): CommitResult {
    for (const step of this.steps) {
      const limit = this.limits.get(step.path);
      if (step.kind === "write" && limit !== undefined && step.data.length > limit.limit) {
        throw new ProjectFileError(
          "size",
          `${step.path} would be ${step.data.length} bytes, more than the ${formatLimit(limit.limit)} BuildOS reads from one such file, so later commands could not read it. BuildOS wrote nothing.`,
          step.path,
        );
      }
    }
    const targets = this.steps.map((step) => ({ step, target: this.files.writeTarget(step.path) }));
    const folderTargets = this.folders.map((path) => ({ path, target: this.files.writeTarget(path) }));
    const ioFailure = (label: string, error: unknown, why?: string): ProjectFileError => {
      if (error instanceof PathRefusedError) {
        return new ProjectFileError("refused", `${label} leads out of the project folder ${this.files.root}, so BuildOS did not write it. Pass --allow-outside-root to write there.`, label);
      }
      const detail = error instanceof FsWriteFailure || error instanceof FsReadFailure ? error.fs.errno : undefined;
      return new ProjectFileError("io", `BuildOS cannot write ${label} (${why ?? errnoText(detail)}). BuildOS wrote nothing.`, label, detail);
    };
    // Every destination folder (the nearest one that exists) is checked before the first change.
    for (const { label, target } of [...targets.map((t) => ({ label: t.step.path, target: t.target })), ...folderTargets.map((t) => ({ label: t.path, target: t.target }))]) {
      let at = parentOf(target.path);
      try {
        while (at !== "." && target.port.stat(at) === undefined) at = parentOf(at);
        target.port.checkCanCreateIn(at);
      } catch (error) {
        throw ioFailure(label, error);
      }
    }
    // A folder (or a special file) at a destination is refused before the first change; a regular file must be writable (P9-R2-06), and its mode is kept.
    const modes = new Map<string, number>();
    for (const { step, target } of targets) {
      let entry: FsEntryId | undefined;
      try {
        entry = target.port.entryId(target.path);
      } catch (error) {
        throw ioFailure(step.path, error);
      }
      if (entry !== undefined && entry.kind !== "file" && entry.kind !== "symlink") {
        throw new ProjectFileError("io", `BuildOS cannot write ${step.path} (${entry.kind === "directory" ? "it is a folder, not a file" : "it is not a regular file"}). BuildOS wrote nothing.`, step.path);
      }
      if (step.kind === "write" && entry?.kind === "file") {
        try {
          target.port.checkWritable(target.path);
        } catch (error) {
          const errno = error instanceof FsWriteFailure ? error.fs.errno : undefined;
          throw ioFailure(step.path, error, errno === "EACCES" || errno === "EPERM" ? "the file is read-only or permission is denied" : undefined);
        }
        modes.set(step.path, entry.mode);
      }
    }
    const undo: UndoStep[] = [];
    const leftovers: NotRestored[] = [];
    const backups: { port: FsPort; path: string; id: string; label: string; shown: string }[] = [];
    const made = new Set<string>();
    const tempsOf = (error: unknown, label: string): void => {
      for (const path of leftoversOf(error).leftBehind ?? []) leftovers.push({ path: besideLabel(label, nameOf(path)), reason: "a temporary file of a failed write that BuildOS could not remove; delete it", state: "left" });
    };
    const mkdirs = (port: FsPort, folder: string, label: string): void => {
      const missing: string[] = [];
      let at = folder;
      while (at !== "." && at !== "" && port.stat(at) === undefined) {
        missing.unshift(at);
        const parent = parentOf(at);
        if (parent === at) break;
        at = parent;
      }
      for (const dir of missing) {
        if (made.has(`${port.root}\0${dir}`)) continue;
        port.mkdir(dir, { recursive: false });
        made.add(`${port.root}\0${dir}`);
        undo.push({ run: () => port.remove(dir), stays: () => ({ path: isAbsolute(dir) ? dir : `${dir}/`, reason: `a folder BuildOS made for ${label} and could not remove (it is not empty or cannot be removed)`, state: "left" }) });
      }
    };
    /** Moves the entry at `path` aside (a same-folder rename, no link followed); the undo renames it back. Returns the backup as shown, or undefined when nothing was there. */
    const moveAside = (port: FsPort, path: string, label: string): string | undefined => {
      const entry = port.entryId(path);
      if (entry === undefined) return undefined;
      const backup = siblingName(path, "backup");
      const shown = besideLabel(label, nameOf(backup));
      const register = (): void => {
        backups.push({ port, path: backup, id: entry.id, label, shown });
        undo.push({
        run: () => {
          if (port.entryId(path) !== undefined) throw new Error(`${label} is taken`);
          port.rename(backup, path, { entries: true });
          backups.splice(
            backups.findIndex((b) => b.path === backup),
            1,
          );
        },
        stays: () => ({ path: label, reason: `BuildOS could not put the earlier file back; it is kept as ${shown}: rename it back to ${label}`, state: "left" }),
        });
      };
      try {
        port.rename(path, backup, { entries: true });
      } catch (error) {
        // A rename that took effect before it reported a failure (a check after it) still moved the entry: it is undone too.
        if (movedTo(port, backup, entry.id)) register();
        throw error;
      }
      register();
      return shown;
    };
    try {
      for (const { path, target } of folderTargets) mkdirs(target.port, target.path, path);
      for (const { step, target } of targets) {
        const { port, path } = target;
        mkdirs(port, parentOf(path), step.path);
        if (step.kind === "remove") {
          moveAside(port, path, step.path);
          continue;
        }
        // The new file, whole and flushed, under a private name next to the destination; a replaced regular file's mode is kept (P9-R2-06).
        const temp = siblingName(path, "new");
        const shownTemp = besideLabel(step.path, nameOf(temp));
        const mode = modes.get(step.path);
        let written: FsEntryId | undefined;
        let placed = false;
        const removeTemp = (): void => {
          undo.push({
            run: () => {
              if (!placed) port.remove(temp, { expect: { kind: "entry", id: written!.id } });
            },
            stays: () => ({ path: shownTemp, reason: "a temporary file BuildOS wrote and could not remove; delete it", state: "left" }),
          });
        };
        try {
          written = port.writeNewFile(temp, step.data, mode === undefined ? { mode: 0o666, sync: true } : { mode, exactMode: true, sync: true });
        } catch (error) {
          tempsOf(error, step.path);
          // A new file that was created before a later part of the write failed is removed by the undo.
          written = leftoversOf(error).committed;
          if (written !== undefined) removeTemp();
          throw error;
        }
        removeTemp();
        const backup = moveAside(port, path, step.path);
        const removeNew = (): void => {
          placed = true;
          undo.push({
            run: () => port.remove(path, { expect: { kind: "entry", id: written!.id } }),
            stays: () => ({ path: step.path, reason: `BuildOS wrote a new file here and could not remove it${backup === undefined ? "" : `; the earlier file is kept as ${backup}`}`, state: "left" }),
          });
        };
        try {
          port.rename(temp, path, { entries: true });
        } catch (error) {
          if (movedTo(port, path, written.id)) removeNew();
          throw error;
        }
        removeNew();
      }
    } catch (error) {
      const left: NotRestored[] = [...leftovers];
      for (let i = undo.length - 1; i >= 0; i--) {
        try {
          undo[i]!.run();
        } catch (undoError) {
          left.push(undo[i]!.stays(undoError));
        }
      }
      if (error instanceof ProjectFileError) throw new ProjectFileError(error.failure, error.message, error.path, error.errno, [...error.notRestored, ...left]);
      const detail = error instanceof FsWriteFailure || error instanceof FsReadFailure ? error.fs.errno : undefined;
      const where = error instanceof Error ? error.message : String(error);
      const tail = left.length === 0 ? " BuildOS put back every file it had changed." : ` BuildOS could not put back everything: ${describe(left)}.`;
      throw new ProjectFileError("io", `BuildOS could not write the output (${detail === undefined ? where : errnoText(detail)}).${tail}`, "", detail, left);
    }
    const leftBehind: NotRestored[] = [];
    for (const backup of backups) {
      try {
        backup.port.remove(backup.path, { expect: { kind: "entry", id: backup.id } });
      } catch {
        leftBehind.push({ path: backup.shown, reason: `the earlier ${backup.label}, kept under this backup name, which BuildOS could not delete; the output is complete, so delete this file`, state: "left" });
      }
    }
    return { leftBehind };
  }
}
