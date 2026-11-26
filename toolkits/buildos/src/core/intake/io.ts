/**
 * The intake domain's file access, Go-shaped. The Go intake tool reads any
 * path it is given (`os.Stat`, `os.ReadFile`, `os.ReadDir`) and writes with
 * `os.MkdirAll` and `os.WriteFile`. Here every read goes through a read-only
 * port bound to the volume that holds the path (as the entity manifest is
 * read), and every write goes through a port bound to the repository root,
 * which refuses a target outside that root (PRD 20, exit 3). With
 * `allowOutsideRoot` (`--allow-outside-root`, parity exception PE-010), a
 * write through a link out of the root lands where the link points, and a
 * write target the user named outside the root goes through a port bound
 * to that target's volume, as Go writes it. Device, special-file, and
 * file-descriptor refusals stay. Failures become `GoError`s with Go's text.
 */

import { FsReadFailure, FsWriteFailure, PathRefusedError, type FsFailureDetail } from "../shared/errors.ts";
import type { FsDirEntry, FsPort, FsPortFactory, FsStat, InPlaceWritePort, InPlaceWritePortFactory } from "../shared/fs-port.ts";
import { GoError, mkdirAll, parentOf, readFileErrorText, type Location } from "../shared/go-fs.ts";
import { goCompare } from "../shared/go-json.ts";
import { goIsNotExist, goNotDirText, goPathError } from "../shared/go-os-error.ts";
import { goClean, goDir, goVolumeName, type GoPathPlatform } from "../shared/go-path.ts";
import { READ_LIMITS } from "../shared/read-limits.ts";
import { goRel, goToSlash } from "./go-text.ts";
import type { IntakeParsers } from "./convert/parsers.ts";

export { GoError };

/** What the intake commands need from the CLI: the current folder, the port factory, and the parsers. */
export interface IntakeContext {
  /** The current folder, as Go's `os.Getwd` spells it. */
  cwd: string;
  openFs: FsPortFactory;
  /** Opens the in-place writer for converted twins, side artifacts, and indexes. Only the intake domain gets one. */
  openWriter: InPlaceWritePortFactory;
  parsers: IntakeParsers;
  /** Path rules. Defaults to this platform's. */
  platform?: GoPathPlatform;
  /** The clock for front matter time stamps. Defaults to the system clock. */
  now?: () => Date;
  /** `--allow-outside-root` (PE-010): allow a write target outside the repository root. Default: false. */
  allowOutsideRoot?: boolean;
}

/** A write port and the location of a path in it. */
interface WriteBinding {
  port: FsPort;
  inPlace: () => InPlaceWritePort;
  location: (path: string) => Location;
}

/**
 * The folders and files that the earlier writes of one command make, for
 * `IntakeFs.checkWrite` (Go spellings). Start each command with a new one.
 */
export interface WritePlan {
  dirs: Set<string>;
  files: Set<string>;
}

/** A new, empty write plan. */
export function newWritePlan(): WritePlan {
  return { dirs: new Set(), files: new Set() };
}

/**
 * W1 R7 P7 review round 3 (P7-R3-02): the outcome of a dependent read (an
 * image an HTML document names). `outside`: the file is not inside any
 * allowed folder (as spelled, or through a link), so nothing was read.
 * `too-large`: the file is larger than `limit`. `unreadable`: any other
 * failure (missing, a folder, no permission), as Go's read failure.
 */
export type DependentRead = { ok: true; data: Uint8Array } | { ok: false; reason: "outside" } | { ok: false; reason: "too-large"; limit: number } | { ok: false; reason: "unreadable" };

/** Go `os.Stat`: the entry, or the OS error. */
export type StatResult = { ok: true; stat: FsStat } | { ok: false; detail: FsFailureDetail };

/** Go's file system calls for one command, bound to one repository root. */
export class IntakeFs {
  readonly platform: GoPathPlatform;
  readonly repoRoot: string;
  private readonly context: IntakeContext;
  private readonly volumes = new Map<string, FsPort>();
  private readonly contained = new Map<string, FsPort | undefined>();
  private readonly writers = new Map<string, WriteBinding>();

  constructor(context: IntakeContext, repoRoot: string, platform: GoPathPlatform) {
    this.context = context;
    this.repoRoot = repoRoot;
    this.platform = platform;
  }

  /** The root folder of the volume that holds `path` (an absolute Go path). */
  private volumeOf(path: string): string {
    return this.platform === "win32" ? `${goVolumeName(path, "win32")}\\` : "/";
  }

  /** The read-only port for the volume that holds `path` (an absolute Go path). */
  private reader(path: string): { readBytes(path: string): Uint8Array } & Pick<FsPort, "statStrict" | "readDir"> {
    const volume = this.volumeOf(path);
    let port = this.volumes.get(volume);
    if (port === undefined) {
      port = this.context.openFs(volume, this.context.cwd);
      this.volumes.set(volume, port);
    }
    // W1 R7 P7 review round 2 (P7-R2-02): every intake read is bounded (`READ_LIMITS.intake`).
    return { readBytes: (p) => port.readBytes(p, READ_LIMITS.intake), statStrict: (p) => port.statStrict(p), readDir: (p) => port.readDir(p) };
  }

  /** `path` relative to `root` with `/` when it is inside `root` as spelled, else undefined. */
  private relInside(root: string, path: string): string | undefined {
    const rel = goRel(root, path, this.platform);
    const inside = rel !== undefined && rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\");
    return inside ? goToSlash(rel, this.platform) : undefined;
  }

  /** The write port bound to `root`, opened once. */
  private binding(root: string): WriteBinding {
    let binding = this.writers.get(root);
    if (binding === undefined) {
      const options = this.context.allowOutsideRoot === true ? { allowOutsideRoot: true } : undefined;
      const port = this.context.openFs(root, this.context.cwd, options);
      let inPlace: InPlaceWritePort | undefined;
      binding = {
        port,
        inPlace: () => (inPlace ??= this.context.openWriter(root, this.context.cwd, options)),
        // A path outside `root` keeps its spelling, so the port refuses it (`outside-root`).
        location: (p) => ({ port: this.relInside(root, p) ?? goToSlash(p, this.platform), go: p, platform: this.platform }),
      };
      this.writers.set(root, binding);
    }
    return binding;
  }

  /**
   * The write port for `path`: the repository root's, or, with
   * `allowOutsideRoot`, the volume's for a path the user named outside it.
   */
  private writer(path: string): WriteBinding {
    if (this.context.allowOutsideRoot === true && this.relInside(this.repoRoot, path) === undefined) return this.binding(this.volumeOf(path));
    return this.binding(this.repoRoot);
  }

  /**
   * A preflight of one write, in the command's write order, before its
   * first write: Go's `os.MkdirAll(filepath.Dir(path))` then
   * `os.WriteFile(path)`, checked and not done. Each folder the
   * `MkdirAll` would make is checked as Go's would meet it (a file in the
   * way, a parent folder that refuses a new entry, containment), then the
   * entry at `path` (containment unless `allowOutsideRoot`; a symlink to a
   * device, a FIFO, socket, or device, or a file with more than one hard
   * link is refused; an existing file or folder is opened for writing as a
   * probe, so a folder or read-only file fails as the write would). A
   * refusal throws the port's `PathRefusedError`; a condition Go reports
   * throws a `GoError` with the text Go's write gives, so a command that
   * would fail leaves no new file. `plan` records the folders and files
   * the earlier writes of the same command make.
   */
  checkWrite(plan: WritePlan, path: string): void {
    const binding = this.writer(path);
    const dir = binding.location(goDir(path, this.platform));
    this.checkMkdirAll(binding, dir, plan);
    if (!plan.dirs.has(dir.go)) {
      try {
        binding.inPlace().checkInPlaceTarget(binding.location(path).port);
      } catch (error) {
        if (!(error instanceof FsWriteFailure)) throw error;
        throw new GoError(goPathError("open", path, error.fs));
      }
    }
    plan.files.add(path);
  }

  /** Go `os.Stat(path)` of a write target, with the files the earlier writes in `plan` make. */
  plannedStat(plan: WritePlan, path: string): StatResult {
    if (plan.files.has(path)) return { ok: true, stat: { kind: "file", mode: 0o644, fullMode: 0o644, size: 0, mtimeMs: 0 } };
    return this.statTarget(path);
  }

  /** `mkdirAll` (Go `os.MkdirAll`), checked and not done. See `checkWrite`. */
  private checkMkdirAll(binding: WriteBinding, dir: Location, plan: WritePlan): void {
    if (plan.dirs.has(dir.go)) return;
    let kind: "file" | "directory" | undefined;
    try {
      kind = binding.port.stat(dir.port)?.kind;
    } catch (error) {
      if (!(error instanceof FsReadFailure)) throw error;
      kind = undefined;
    }
    if (kind === "directory") return;
    if (kind === "file") throw new GoError(`mkdir ${dir.go}: ${goNotDirText()}`);
    if (dir.port !== "." && dir.port !== "") this.checkMkdirAll(binding, parentOf(dir), plan);
    try {
      binding.inPlace().checkMkdir(dir.port);
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      throw new GoError(goPathError("mkdir", dir.go, error.fs));
    }
    plan.dirs.add(dir.go);
  }

  /** Go `os.Stat(path)`. */
  stat(path: string): StatResult {
    try {
      return { ok: true, stat: this.reader(path).statStrict(path) };
    } catch (error) {
      if (error instanceof FsReadFailure) return { ok: false, detail: error.fs };
      throw error;
    }
  }

  /**
   * Go `os.Stat(path)` of a write target (it follows a symlink, as Go's
   * existence check for `--force` does). A read, so it may look outside the
   * root; the write itself is checked by the write port.
   */
  statTarget(path: string): StatResult {
    try {
      return { ok: true, stat: this.reader(path).statStrict(path) };
    } catch (error) {
      if (error instanceof FsReadFailure) return { ok: false, detail: error.fs };
      throw error;
    }
  }

  /** Go `os.ReadFile(path)`. Throws a `GoError` with Go's text. */
  readFile(path: string): Uint8Array {
    const result = this.tryReadFile(path);
    if (!result.ok) throw result.error;
    return result.data;
  }

  /** Go `os.ReadFile(path)`, with `os.IsNotExist` of a failure. */
  tryReadFile(path: string): { ok: true; data: Uint8Array } | { ok: false; notExist: boolean; error: GoError } {
    try {
      return { ok: true, data: this.reader(path).readBytes(path) };
    } catch (error) {
      if (!(error instanceof FsReadFailure)) throw error;
      return { ok: false, notExist: goIsNotExist(error.fs), error: new GoError(readFileErrorText({ port: path, go: path, platform: this.platform }, error.fs)) };
    }
  }

  /**
   * W1 R7 P7 review round 3 (P7-R3-02): reads `path` (an absolute Go path)
   * only when it is inside one of `allowed` (absolute Go folders), tried in
   * order: as spelled (`..` folded), and through a port bound to that folder,
   * so the real path after every link must be inside it too. A link that
   * leads out of a folder is never followed out of it; the next folder may
   * still hold the real path. At most `READ_LIMITS.intake` bytes. The
   * `--allow-outside-root` switch does not widen this.
   */
  readDependent(path: string, allowed: readonly string[]): DependentRead {
    const target = goClean(path, this.platform);
    for (const folder of allowed) {
      const rel = this.relInside(goClean(folder, this.platform), target);
      if (rel === undefined) continue;
      let port = this.contained.get(folder);
      if (!this.contained.has(folder)) {
        try {
          port = this.context.openFs(folder, this.context.cwd);
        } catch (error) {
          if (!(error instanceof PathRefusedError) && !(error instanceof FsReadFailure)) throw error;
          port = undefined;
        }
        this.contained.set(folder, port);
      }
      if (port === undefined) continue;
      try {
        return { ok: true, data: port.readBytes(rel, READ_LIMITS.intake) };
      } catch (error) {
        if (error instanceof PathRefusedError) continue;
        if (!(error instanceof FsReadFailure)) throw error;
        if (error.fs.errno === "EFBIG") return { ok: false, reason: "too-large", limit: READ_LIMITS.intake };
        return { ok: false, reason: "unreadable" };
      }
    }
    return { ok: false, reason: "outside" };
  }

  /** Go `os.ReadDir(path)`: entries in Go's name order. Throws a `GoError` with Go's text. */
  readDir(path: string): FsDirEntry[] {
    try {
      return this.reader(path)
        .readDir(path)
        .sort((a, b) => goCompare(a.name, b.name));
    } catch (error) {
      if (error instanceof FsReadFailure) throw new GoError(goPathError("open", path, error.fs));
      throw error;
    }
  }

  /** Go `os.MkdirAll(filepath.Dir(path), 0o755)` then `os.WriteFile(path, data, 0o644)`. */
  writeFileWithParents(path: string, data: Uint8Array): void {
    const binding = this.writer(path);
    mkdirAll(binding.port, binding.location(goDir(path, this.platform)));
    try {
      binding.inPlace().writeFileInPlace(binding.location(path).port, data, 0o644);
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      const op = error.fs.step === "write" ? "write" : error.fs.step === "close" ? "close" : "open";
      throw new GoError(goPathError(op, path, error.fs));
    }
  }
}
