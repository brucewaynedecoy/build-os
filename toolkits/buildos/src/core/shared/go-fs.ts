/**
 * Go-shaped reads and writes through the filesystem port, shared by the
 * entity and intake domains. Every call goes through the port; these helpers
 * only turn a port failure into the error text the Go tools print, so output
 * matches them byte for byte.
 */

import { FsReadFailure, FsWriteFailure, type FsFailureDetail } from "./errors.ts";
import type { AtomicWriteOptions, FsPort } from "./fs-port.ts";
import { goIsNotExist, goNotDirText, goPathError, goReadFileError } from "./go-os-error.ts";
import { goDir, goJoinAll, type GoPathPlatform } from "./go-path.ts";

/** A path as the port sees it and as Go spells it. */
export interface Location {
  /** Path relative to the port root, with `/`. */
  port: string;
  /** Absolute path as Go's `filepath.Join` spells it on this platform. */
  go: string;
  platform: GoPathPlatform;
}

/** A Go `error` value: its text. Core turns it into a typed error at the command boundary. */
export class GoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoError";
  }
}

/** The result of Go's `os.ReadFile`: the bytes, missing (`fs.ErrNotExist`), or another failure. */
export type ReadOutcome = { kind: "data"; data: Uint8Array } | { kind: "missing"; detail: FsFailureDetail } | { kind: "failed"; detail: FsFailureDetail };

/** Go `os.ReadFile(path)` through the port. A port refusal passes through. */
export function readFile(fs: Pick<FsPort, "readBytes">, location: Location, limit: number): ReadOutcome {
  try {
    return { kind: "data", data: fs.readBytes(location.port, limit) };
  } catch (error) {
    if (!(error instanceof FsReadFailure)) throw error;
    return goIsNotExist(error.fs) ? { kind: "missing", detail: error.fs } : { kind: "failed", detail: error.fs };
  }
}

/** Go's text of a failed `os.ReadFile`: `open <path>: ...`, or `read <path>: ...` once the file opened. */
export function readFileErrorText(location: Location, detail: FsFailureDetail): string {
  return goReadFileError(location.go, detail);
}

/** The parent folder of a location. */
export function parentOf(location: Location): Location {
  const cut = location.port.lastIndexOf("/");
  return { port: cut === -1 ? "." : location.port.slice(0, cut), go: goDir(location.go, location.platform), platform: location.platform };
}

/**
 * Go `os.MkdirAll(dir, 0o755)` through the port, inside the root: stop at a
 * folder that exists, refuse a file in the way (`syscall.ENOTDIR`), else make
 * the parent and then this folder. Throws a `GoError` with Go's text.
 */
export function mkdirAll(fs: FsPort, dir: Location): void {
  let kind: "file" | "directory" | undefined;
  try {
    kind = fs.stat(dir.port)?.kind;
  } catch (error) {
    if (!(error instanceof FsReadFailure)) throw error;
    kind = undefined;
  }
  if (kind === "directory") return;
  if (kind === "file") throw new GoError(`mkdir ${dir.go}: ${goNotDirText()}`);
  if (dir.port !== "." && dir.port !== "") mkdirAll(fs, parentOf(dir));
  try {
    // Go's MkdirAll(dir, 0o755): the umask applies to 0o755, not to 0o777.
    fs.mkdir(dir.port, { recursive: false, mode: 0o755 });
  } catch (error) {
    if (!(error instanceof FsWriteFailure)) throw error;
    // Go: "foo/." and a race both end here; an existing folder is fine.
    try {
      if (fs.stat(dir.port)?.kind === "directory") return;
    } catch {
      // Fall through to the mkdir error, as Go does.
    }
    throw new GoError(goPathError("mkdir", dir.go, error.fs));
  }
}

/** Go's wrappers for each failed step of an atomic write. */
export interface AtomicWriteWords {
  createTemp: string;
  chmod: string;
  write: string;
  sync: string;
  close: string;
  /** Gets the target path (Go `%q`) after the words. */
  rename: (target: string) => string;
  openParent: string;
  syncParent: string;
}

/**
 * Go's `CreateTemp`, `Chmod`, `Write`, `Sync`, `Close`, `Rename`, folder
 * `Open`, and folder `Sync`, in that order, through the port's atomic write,
 * with Go's error text for the step that failed. The temporary file never
 * stays behind.
 *
 * Go's `os.CreateTemp` reports the `OpenFile` error of the name it tried
 * (`open <dir>/<prefix><random><suffix>: permission denied`); only when all
 * 10000 random names exist does it report `createtemp <dir>/<prefix>*<suffix>:
 * file already exists`. The port tells which, and the name it tried.
 */
export function writeAtomic(fs: FsPort, target: Location, data: Uint8Array, mode: number, temp: { prefix: string; suffix: string }, words: AtomicWriteWords): void {
  const options: AtomicWriteOptions = { mode, tempPrefix: temp.prefix, tempSuffix: temp.suffix, syncParent: true };
  try {
    fs.writeFileAtomic(target.port, data, options);
  } catch (error) {
    if (!(error instanceof FsWriteFailure)) throw error;
    const detail = error.fs;
    const dir = goDir(target.go, target.platform);
    const pattern = goJoinAll(target.platform, dir, `${temp.prefix}*${temp.suffix}`);
    const tempPath = detail.tempName === undefined ? pattern : goJoinAll(target.platform, dir, detail.tempName);
    switch (detail.step) {
      case "create-temp":
        if (detail.tempExhausted === true) {
          throw new GoError(`${words.createTemp}: createtemp ${pattern}: file already exists`);
        }
        throw new GoError(`${words.createTemp}: ${goPathError("open", tempPath, detail)}`);
      case "chmod":
        throw new GoError(`${words.chmod}: ${goPathError("chmod", tempPath, detail)}`);
      case "write":
        throw new GoError(`${words.write}: ${goPathError("write", tempPath, detail)}`);
      case "sync":
        throw new GoError(`${words.sync}: ${goPathError("sync", tempPath, detail)}`);
      case "close":
        throw new GoError(`${words.close}: ${goPathError("close", tempPath, detail)}`);
      case "rename":
        throw new GoError(`${words.rename(target.go)}: ${goPathError("rename", `${tempPath} ${target.go}`, detail)}`);
      case "open-parent":
        throw new GoError(`${words.openParent}: ${goPathError("open", dir, detail)}`);
      case "sync-parent":
        throw new GoError(`${words.syncParent}: ${goPathError("sync", dir, detail)}`);
      default:
        // Every raw failure of the port's atomic write is tagged with its step.
        throw new GoError(`${words.createTemp}: ${goPathError("open", tempPath, detail)}`);
    }
  }
}
