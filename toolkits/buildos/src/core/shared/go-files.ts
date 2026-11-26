/**
 * Go-shaped file operations for the discovery and design ports. The Go tools
 * (`toolkits/buildos-discovery`, `toolkits/buildos-design`) call `os.Stat`,
 * `os.ReadFile`, `os.MkdirAll`, `os.WriteFile`, `os.OpenFile`, and an atomic
 * replace on paths joined from the repository root. This module does the
 * same through the filesystem port and turns each port failure into the
 * error text Go prints, so output matches byte for byte.
 *
 * Reads of a path a flag names go through a read-only port bound to the
 * volume that holds the path, as the Go tools read it (the P3 manifest
 * rule), each with a size bound (`READ_LIMITS`, W1 R7 P7 review round 2).
 * Project data BuildOS reads for itself (the Make Docs design inputs, and
 * the entity graph since review round 3) go through a port bound to the
 * root, in every mode. Writes go through a port bound to the repository root, which refuses
 * any write outside it, unless `allowOutsideRoot` (`--allow-outside-root`,
 * parity exception PE-012) lets a write follow a link out of the root.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import type { EntityGraph, Location } from "../entities/graph.ts";
import { loadGraph } from "../entities/graph.ts";
import { GoError, mkdirAll } from "../entities/io.ts";
import type { EntityDiagnostic } from "../entities/types.ts";
import { validateGraph } from "../entities/validate.ts";
import { FsReadFailure, FsWriteFailure, PathRefusedError, type FsFailureDetail } from "./errors.ts";
import type { FsLink, FsPort, FsPortFactory, FsStat } from "./fs-port.ts";
import { goIsNotExist, goOsPlatform, goPathError, goReadFileError, goStatOp, type GoOsPlatform } from "./go-os-error.ts";
import { goAbs, goDir, goJoinAll, goVolumeName, type GoPathPlatform } from "./go-path.ts";
import { goRel, goToSlash } from "./go-text.ts";

export { GoError };

export interface GoFilesContext {
  /** The current folder, as Go's `os.Getwd` spells it. */
  cwd: string;
  openFs: FsPortFactory;
  /** Path rules. Defaults to this platform's. */
  platform?: GoPathPlatform;
  /** PE-012 (`--allow-outside-root`): let a write follow a link out of the repository root. Default: false. */
  allowOutsideRoot?: boolean;
}

/** Bytes per read of a streaming copy. */
export const COPY_CHUNK_BYTES = 8 * 1024 * 1024;

/** The outcome of Go's `os.Stat`. `text` is Go's `err.Error()`. */
export type GoStat = { kind: "ok"; stat: FsStat } | { kind: "missing"; text: string; detail: FsFailureDetail } | { kind: "failed"; text: string; detail: FsFailureDetail };

function hostPlatform(): GoPathPlatform {
  return goOsPlatform() === "win32" ? "win32" : "posix";
}

/** Go file operations against one repository root. Every path is spelled as Go joins it. */
export class GoFiles {
  readonly platform: GoPathPlatform;
  readonly osPlatform: GoOsPlatform;
  /** The repository root as Go spells it (`filepath.Abs`, or `.` for an empty `--repo-root`). */
  readonly repoRoot: string;
  readonly #context: GoFilesContext;
  readonly #absRoot: string;
  readonly #readPorts = new Map<string, FsPort>();
  #writePort: FsPort | undefined;
  #rootReadPort: FsPort | undefined;

  constructor(context: GoFilesContext, repoRoot: string) {
    this.#context = context;
    this.platform = context.platform ?? hostPlatform();
    this.osPlatform = goOsPlatform();
    this.repoRoot = repoRoot;
    this.#absRoot = goAbs(repoRoot, context.cwd, this.platform);
  }

  /** Go `filepath.Join(elem...)`. */
  join(...elements: string[]): string {
    return goJoinAll(this.platform, ...elements);
  }

  /** Go `filepath.Dir`. */
  dir(path: string): string {
    return goDir(path, this.platform);
  }

  /** Go `filepath.ToSlash`. */
  toSlash(path: string): string {
    return goToSlash(path, this.platform);
  }

  /** Go `filepath.Abs(path)` against the current folder. */
  absolute(path: string): string {
    return goAbs(path, this.#context.cwd, this.platform);
  }

  /** The read-only port for the volume that holds `abs`. */
  #readPort(abs: string): FsPort {
    const volume = this.platform === "win32" ? `${goVolumeName(abs, "win32")}\\` : "/";
    let port = this.#readPorts.get(volume);
    if (port === undefined) {
      port = this.#context.openFs(volume, this.#context.cwd);
      this.#readPorts.set(volume, port);
    }
    return port;
  }

  /** A location for the read port: the absolute path, with Go's spelling for messages. */
  readLocation(path: string): { fs: FsPort; location: Location } {
    const abs = this.absolute(path);
    return { fs: this.#readPort(abs), location: { port: abs, go: path, platform: this.platform } };
  }

  /** A location for the root write port: relative to the root when inside it. */
  writeLocation(path: string): { fs: FsPort; location: Location } {
    this.#writePort ??= this.#context.openFs(this.#absRoot, this.#context.cwd, this.#context.allowOutsideRoot === true ? { allowOutsideRoot: true } : undefined);
    const abs = this.absolute(path);
    const rel = goRel(this.#absRoot, abs, this.platform);
    const inside = rel !== undefined && rel !== ".." && !rel.startsWith(`..${this.platform === "win32" ? "\\" : "/"}`);
    const port = inside ? (rel === "." ? "." : goToSlash(rel, this.platform)) : abs;
    return { fs: this.#writePort, location: { port, go: path, platform: this.platform } };
  }

  /** Go `os.Stat(path)`. A port refusal passes through. */
  stat(path: string): GoStat {
    const { fs, location } = this.readLocation(path);
    try {
      return { kind: "ok", stat: fs.statStrict(location.port) };
    } catch (error) {
      if (!(error instanceof FsReadFailure)) throw error;
      // Go on Windows reports a failed Stat from its CreateFile call.
      const text = goPathError(goStatOp(false, this.osPlatform), path, error.fs, this.osPlatform);
      return goIsNotExist(error.fs) ? { kind: "missing", text, detail: error.fs } : { kind: "failed", text, detail: error.fs };
    }
  }

  /**
   * Go `os.ReadFile(path)`: the bytes, or `{ error, notExist }` with Go's
   * text. W1 R7 P7 review round 2 (P7-R2-02): at most `limit` bytes
   * (`READ_LIMITS`); a larger file is an error that names the bound.
   */
  readFile(path: string, limit: number): { data: Uint8Array } | { error: string; notExist: boolean } {
    const { fs, location } = this.readLocation(path);
    try {
      return { data: fs.readBytes(location.port, limit) };
    } catch (error) {
      if (!(error instanceof FsReadFailure)) throw error;
      return { error: goReadFileError(path, error.fs), notExist: goIsNotExist(error.fs) };
    }
  }

  /** Go `os.ReadFile(path)` with a bound, throwing a `GoError` with Go's text. */
  mustReadFile(path: string, limit: number): Uint8Array {
    const read = this.readFile(path, limit);
    if ("error" in read) throw new GoError(read.error);
    return read.data;
  }

  /**
   * W1 R7 P7 review round 2 (P7-R2-02): a content read held inside the
   * repository root, for files BuildOS reads from the project itself (the
   * Make Docs design inputs). Unlike `readFile`, it goes through a port bound
   * to the root, never the volume: the entry at the name is looked at without
   * following it; a link there is read only when it resolves to a regular
   * file inside the root (`readFileLimited` with `followLinkInRoot`); a link
   * that leads out of the root is refused (`PathRefusedError`, exit 3,
   * passed through). At most `limit` bytes are read from one open.
   * Other failures give Go's `os.ReadFile` text, as `readFile`.
   *
   * W1 R7 P7 review round 3 (P7-R3-03): `--allow-outside-root` does not
   * change this read. The switch is for write destinations only (PE-012).
   */
  readContained(path: string, limit: number): { data: Uint8Array } | { tooLarge: true; error: string } | { error: string; notExist: boolean; errno?: string } {
    const port = this.#rootPath(path);
    try {
      const read = this.#rootPort().readFileLimited(port, limit, { followLinkInRoot: true });
      if (read.tooLarge) return { tooLarge: true, error: goReadFileError(path, { errno: "EFBIG", limit }) };
      return { data: read.data };
    } catch (error) {
      if (!(error instanceof FsReadFailure)) throw error;
      return { error: goReadFileError(path, error.fs), notExist: goIsNotExist(error.fs), errno: error.fs.errno };
    }
  }

  /**
   * W1 R7 P7 review round 3 (P7-R3-03): the one read that follows a write
   * destination out of the root. With `--allow-outside-root`, a design file
   * is written through a designs folder that is a link out of the root
   * (PE-012, edge golden `design-designs-link-outside-allowed`), and Go read
   * the design router `AGENTS.md` in that same folder. So, only with the
   * switch, only when `folder` (the write destination) is itself a link, and
   * only for the regular file `name` in it (no link at the name), the file is
   * read through that link, bounded. Every other case is `readContained`.
   */
  readInWriteFolder(folder: string, name: string, limit: number): ReturnType<GoFiles["readContained"]> {
    const path = this.join(folder, name);
    const folderLink = this.link(folder) !== undefined;
    if (this.#context.allowOutsideRoot !== true || !folderLink || this.link(path) !== undefined) {
      try {
        return this.readContained(path, limit);
      } catch (error) {
        // The folder is the write destination, so its refusal names the write switch (PE-012, edge golden `design-designs-link-outside`).
        if (folderLink && error instanceof PathRefusedError && error.forRead) throw new PathRefusedError(error.reason, error.message, error.root === undefined ? {} : { root: error.root });
        throw error;
      }
    }
    const read = this.readFile(path, limit);
    if ("data" in read) return read;
    return read.error.includes("file too large") ? { tooLarge: true, error: read.error } : read;
  }

  /** The port bound to the root, for content reads (opened once). */
  #rootPort(): FsPort {
    this.#rootReadPort ??= this.#context.openFs(this.#absRoot, this.#context.cwd);
    return this.#rootReadPort;
  }

  /** `path` for the root port: relative to the root when inside it, else absolute (which the port refuses). */
  #rootPath(path: string): string {
    const abs = this.absolute(path);
    const rel = goRel(this.#absRoot, abs, this.platform);
    const inside = rel !== undefined && rel !== ".." && !rel.startsWith(`..${this.platform === "win32" ? "\\" : "/"}`);
    return inside ? (rel === "." ? "." : goToSlash(rel, this.platform)) : abs;
  }

  /** A port bound to `path` (a folder), for a core check that needs a contained port of its own. Opening it may throw a port refusal. */
  openPortAt(path: string): FsPort {
    return this.#context.openFs(this.absolute(path), this.#context.cwd);
  }

  /** Go `os.MkdirAll(path, 0o755)`. Throws a `GoError`. */
  mkdirAll(path: string): void {
    const { fs, location } = this.writeLocation(path);
    mkdirAll(fs, location);
  }

  /**
   * Go `os.OpenFile(path, O_CREATE|O_EXCL|O_WRONLY, mode)` and `Write`; with
   * `sync`, also `Sync`, `Close`, and the parent folder flush, removing the
   * file when a step fails. Throws a `GoError`.
   */
  writeNewFile(path: string, data: Uint8Array, options: { mode?: number; sync?: boolean } = {}): void {
    const { fs, location } = this.writeLocation(path);
    this.#write(path, () => fs.writeNewFile(location.port, data, { mode: options.mode ?? 0o644, sync: options.sync ?? false }));
  }

  /**
   * Go `copyFile`'s `os.Open(source)`, `os.OpenFile(target,
   * O_CREATE|O_EXCL|O_WRONLY, 0o644)`, and `io.Copy`, as a streaming copy
   * (no 2 GiB limit). A failed copy removes the new file. Throws a `GoError`
   * with Go's text: `open <source>`, `read <source>`, or the target step.
   */
  copyNewFile(source: string, target: string): void {
    const { fs: readFs, location: from } = this.readLocation(source);
    let stream;
    try {
      stream = readFs.openRead(from.port);
    } catch (error) {
      if (!(error instanceof FsReadFailure)) throw error;
      throw new GoError(goPathError("open", source, error.fs));
    }
    const input = stream;
    function* chunks(): Generator<Uint8Array> {
      for (;;) {
        const chunk = input.read(COPY_CHUNK_BYTES);
        if (chunk.length === 0) return;
        yield chunk;
      }
    }
    const { fs, location } = this.writeLocation(target);
    try {
      this.#write(target, () => fs.writeNewFile(location.port, chunks(), { mode: 0o644 }));
    } catch (error) {
      if (!(error instanceof FsReadFailure)) throw error;
      throw new GoError(goPathError("read", source, error.fs));
    } finally {
      input.close();
    }
  }

  /**
   * Creates one folder with `O_EXCL` semantics (Go `os.Mkdir(path, 0o755)`),
   * to reserve it against a concurrent command. Returns `undefined` when it
   * was created, else the OS error code (`EEXIST` when anything is there). A
   * port refusal passes through.
   */
  mkdirExclusive(path: string): string | undefined {
    const { fs, location } = this.writeLocation(path);
    try {
      fs.mkdir(location.port, { recursive: false, mode: 0o755 });
      return undefined;
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      return error.fs.errno;
    }
  }

  /** Removes entries this command created, last first, after a failed step. Best effort: a failure here is ignored. */
  removeCreated(paths: readonly string[]): void {
    for (const path of [...paths].reverse()) {
      const { fs, location } = this.writeLocation(path);
      try {
        fs.remove(location.port);
      } catch {
        // Keep the original failure; what stays is reported by the next run.
      }
    }
  }

  /**
   * Checks, before the first write, that the folder of each path is one the
   * root write port accepts, so a refusal (exit 3, `PathRefusedError`) comes
   * before any change. Other failures are left to the write itself, which
   * reports them with Go's text.
   */
  preflightWrites(paths: readonly string[]): void {
    for (const path of paths) {
      const { fs, location } = this.writeLocation(this.dir(path));
      try {
        fs.stat(location.port);
      } catch (error) {
        if (error instanceof PathRefusedError) throw error;
      }
    }
  }

  /** Runs a port write and spells a failure as Go's `*PathError` for the step that failed. */
  #write(path: string, action: () => void): void {
    try {
      action();
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      throw new GoError(this.writeErrorText(path, error.fs));
    }
  }

  /** Go's text for a failed non-atomic write step on `path`. */
  writeErrorText(path: string, detail: FsFailureDetail): string {
    const dir = this.dir(path);
    if (detail.step === "open-parent") return goPathError("open", dir, detail);
    if (detail.step === "sync-parent") return goPathError("sync", dir, detail);
    switch (detail.syscall) {
      case "write":
        return goPathError("write", path, detail);
      case "fsync":
        return goPathError("sync", path, detail);
      case "close":
        return goPathError("close", path, detail);
      default:
        return goPathError("open", path, detail);
    }
  }

  /**
   * The design tool's `atomicReplaceFile(path, data)`: `os.Stat`, then
   * `os.CreateTemp(dir, "."+base+".tmp-*")`, `Chmod` to the old mode,
   * `Write`, `Sync`, `Close`, `os.Rename`, and the parent folder flush (not
   * on Windows, PE-005). Throws a `GoError` with the bare Go error text.
   *
   * Go's `Chmod(info.Mode().Perm())` drops the setuid, setgid, and sticky
   * bits, and so does this. A rollback passes `restoreMode`, the full mode
   * (`mode & 0o7777`) the file had before the command: the temporary file
   * gets it before and again after the write (a write clears setuid and
   * setgid), so the file ends as it was.
   */
  atomicReplace(path: string, data: Uint8Array, restoreMode?: number): void {
    const stat = this.stat(path);
    if (stat.kind !== "ok") throw new GoError(stat.text);
    const { fs, location } = this.writeLocation(path);
    const base = path.slice(this.dir(path).length).replace(/^[\\/]+/, "");
    const prefix = `.${base}.tmp-`;
    try {
      fs.writeFileAtomic(location.port, data, { mode: restoreMode ?? stat.stat.mode, exactMode: restoreMode !== undefined, tempPrefix: prefix, tempSuffix: "", syncParent: true });
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      const detail = error.fs;
      const dir = this.dir(path);
      const temp = detail.tempName === undefined ? this.join(dir, `${prefix}*`) : this.join(dir, detail.tempName);
      switch (detail.step) {
        case "create-temp":
          if (detail.tempExhausted === true) throw new GoError(`createtemp ${this.join(dir, `${prefix}*`)}: file already exists`);
          throw new GoError(goPathError("open", temp, detail));
        case "chmod":
          throw new GoError(goPathError("chmod", temp, detail));
        case "write":
          throw new GoError(goPathError("write", temp, detail));
        case "sync":
          throw new GoError(goPathError("sync", temp, detail));
        case "close":
          throw new GoError(goPathError("close", temp, detail));
        case "rename":
          throw new GoError(goPathError("rename", `${temp} ${path}`, detail));
        case "open-parent":
          throw new GoError(goPathError("open", dir, detail));
        case "sync-parent":
          throw new GoError(goPathError("sync", dir, detail));
        default:
          throw new GoError(goPathError("open", temp, detail));
      }
    }
  }

  /**
   * The shared Go entity seed's `OpenRoot(systemRoot, ModeStrict)`:
   * `Load(<root>/.os/data)` and, because Go's graph is never nil, `Validate`
   * in strict mode. The diagnostics are the load diagnostics, then the
   * validation diagnostics, in Go's order. Resolves in this process, through
   * the P3 core.
   *
   * W1 R7 P7 review round 3 (P7-R3-03): the graph is project data, so it is
   * read through a port bound to the root (the same rule as `entities`,
   * PE-007): a data folder or dataset that leads out of the root is refused
   * (exit 3), with or without `--allow-outside-root`. One narrow case keeps
   * Go's read: a dataset in `replaced` (the index this command replaces
   * with a regular file, never writing through a link there: PE-014) may be
   * a link at its own name to a file outside the root, as the approved edge
   * goldens `discovery-runs-index-link-outside` and `design-index-link-outside`
   * pin. Its folder must still be inside the root.
   */
  openEntityRoot(systemRoot: string, replaced: readonly string[] = []): { graph: EntityGraph; diagnostics: EntityDiagnostic[] } {
    const dataDir = this.join(systemRoot, ".os", "data");
    const root = this.#rootPort();
    const location: Location = { port: this.#rootPath(dataDir), go: dataDir, platform: this.platform };
    const names = new Set(replaced);
    const port: FsPort = Object.create(root) as FsPort;
    port.readBytes = (target: string, limit: number): Uint8Array => {
      try {
        return root.readBytes(target, limit);
      } catch (error) {
        const name = target.slice(target.lastIndexOf("/") + 1);
        if (!(error instanceof PathRefusedError) || !names.has(name)) throw error;
        const folder = target.slice(0, target.lastIndexOf("/"));
        // The folder must be inside the root, and the link must be at the name itself.
        root.statStrict(folder === "" ? "." : folder);
        if (root.readLink(target) === undefined) throw error;
        const { fs, location: outside } = this.readLocation(this.join(dataDir, name));
        return fs.readBytes(outside.port, limit);
      }
    };
    const loaded = loadGraph(port, location);
    return { graph: loaded.graph, diagnostics: [...loaded.diagnostics, ...validateGraph(loaded.graph, "strict")] };
  }

  /**
   * The text of the symlink at `path` (Go's `os.Readlink`), or `undefined`
   * when the entry is not a symlink or cannot be read. The last name is never
   * followed. P5 review round 2.
   */
  linkText(path: string): string | undefined {
    return this.link(path)?.target;
  }

  /**
   * The symlink at `path`, its text and its own mode, or `undefined` as for
   * `linkText`. Review round 3: a rollback puts the link's mode back.
   */
  link(path: string): FsLink | undefined {
    const { fs, location } = this.readLocation(path);
    try {
      return fs.readLink(location.port);
    } catch (error) {
      if (error instanceof FsReadFailure) return undefined;
      throw error;
    }
  }

  /**
   * Puts the symlink `target` back at `path`, replacing the entry there
   * atomically (a rollback of a replaced symlink). With `mode`, the link gets
   * exactly that mode where the OS keeps link modes (macOS; review round 3).
   * Throws a `GoError` with Go's `*LinkError` text, `symlink <target>
   * <path>: <reason>`. P5 review round 2.
   */
  restoreLink(path: string, target: string, mode?: number): void {
    const { fs, location } = this.writeLocation(path);
    try {
      fs.symlinkAtomic(location.port, target, mode === undefined ? {} : { mode });
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      throw new GoError(goPathError("symlink", `${target} ${path}`, error.fs));
    }
  }

  /**
   * Replaces the JSONL index at `path` with `data` atomically: a temporary
   * file in the same folder, renamed over the entry, so a failed step leaves
   * the old bytes, and a symlink at `path` is replaced, never followed. An
   * existing file keeps its permission bits with the sticky bit (`mode`, the
   * full `mode & 0o7777`, as Go's append in place; the write clears setuid
   * and setgid there and here); a new one gets `0o644`
   * before the umask, as Go's `OpenFile(path, O_CREATE|O_WRONLY|O_APPEND,
   * 0o644)`. Go's `appendJSONL` never flushes the folder, so neither does
   * this, and nothing can fail after the rename. Throws a `GoError` with the
   * text of Go's `OpenFile` (`open <path>`) or `Write` (`write <path>`).
   * P5 review round 2.
   *
   * Review round 3: Go opens an existing index for writing in place, so a
   * regular file the user cannot write (mode 0444, or the Windows read-only
   * attribute) fails with `open <path>: permission denied` (Windows: `Access
   * is denied.`), exit 1, and keeps its bytes and mode, even in a writable
   * folder. The replace makes the same permission check first
   * (`checkWritable`), so it fails the same way and changes nothing.
   */
  replaceJsonl(path: string, data: Uint8Array, mode: number | undefined): void {
    const { fs, location } = this.writeLocation(path);
    const base = path.slice(this.dir(path).length).replace(/^[\\/]+/, "");
    try {
      fs.checkWritable(location.port);
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      throw new GoError(goPathError("open", path, error.fs));
    }
    try {
      fs.writeFileAtomic(location.port, data, { ...(mode === undefined ? { createMode: 0o644 } : { mode }), tempPrefix: `.${base}.tmp-`, tempSuffix: "", syncParent: false });
    } catch (error) {
      if (!(error instanceof FsWriteFailure)) throw error;
      throw new GoError(goPathError(error.fs.step === "create-temp" ? "open" : "write", path, error.fs));
    }
  }
}
