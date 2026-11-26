/**
 * Go's text for an operating system error, so core can spell a failed read
 * or write as the Go seed does (`open <path>: no such file or directory`).
 * The filesystem port reports the Node error code; this maps it to the
 * message Go 1.24.1 prints on the running system: the `syscall` errors table
 * for darwin and linux, and the `FormatMessage` text of the Win32 error that
 * Go sees on Windows.
 */

import { formatLimit } from "./read-limits.ts";
import type { FsFailureDetail } from "./errors.ts";

export type GoOsPlatform = "darwin" | "linux" | "win32";

/** The platform whose Go error text applies here. Other POSIX systems use the linux text. */
export function goOsPlatform(): GoOsPlatform {
  const platform = process.platform;
  return platform === "darwin" || platform === "win32" ? platform : "linux";
}

/** Go 1.24.1 `syscall` errors (zerrors_darwin_arm64.go and zerrors_linux_amd64.go), by errno name. */
const POSIX_TEXT: Readonly<Record<string, readonly [darwin: string, linux: string]>> = {
  EPERM: ["operation not permitted", "operation not permitted"],
  ENOENT: ["no such file or directory", "no such file or directory"],
  EIO: ["input/output error", "input/output error"],
  EACCES: ["permission denied", "permission denied"],
  EBUSY: ["resource busy", "device or resource busy"],
  EEXIST: ["file exists", "file exists"],
  EXDEV: ["cross-device link", "invalid cross-device link"],
  ENOTDIR: ["not a directory", "not a directory"],
  EISDIR: ["is a directory", "is a directory"],
  EINVAL: ["invalid argument", "invalid argument"],
  EMFILE: ["too many open files", "too many open files"],
  ETXTBSY: ["text file busy", "text file busy"],
  EFBIG: ["file too large", "file too large"],
  ENOSPC: ["no space left on device", "no space left on device"],
  EROFS: ["read-only file system", "read-only file system"],
  ELOOP: ["too many levels of symbolic links", "too many levels of symbolic links"],
  ENAMETOOLONG: ["file name too long", "file name too long"],
  ENOTEMPTY: ["directory not empty", "directory not empty"],
  EDQUOT: ["disc quota exceeded", "disk quota exceeded"],
};

/** Win32 `FormatMessage` text of the error Go sees for each libuv code. */
const WIN32_TEXT: Readonly<Record<string, string>> = {
  ENOENT: "The system cannot find the file specified.",
  EACCES: "Access is denied.",
  EPERM: "Access is denied.",
  EBUSY: "The process cannot access the file because it is being used by another process.",
  EEXIST: "Cannot create a file when that file already exists.",
  ENOSPC: "There is not enough space on the disk.",
  ENAMETOOLONG: "The filename or extension is too long.",
  ENOTEMPTY: "The directory is not empty.",
  EISDIR: "Incorrect function.",
  EINVAL: "The parameter is incorrect.",
  EMFILE: "The system cannot open the file.",
  EXDEV: "The system cannot move the file to a different disk drive.",
};

/** `ERROR_PATH_NOT_FOUND`. Go 1.24.1 on Windows defines `syscall.ENOTDIR` as this error. */
const WIN32_PATH_NOT_FOUND = "The system cannot find the path specified.";

/** Go's `err.Error()` for the OS error behind `detail`. */
export function goErrnoText(detail: FsFailureDetail, platform: GoOsPlatform = goOsPlatform()): string {
  const code = detail.errno;
  if (platform === "win32") {
    if (code === "ENOTDIR" || (code === "ENOENT" && detail.parentMissing === true)) return WIN32_PATH_NOT_FOUND;
    return WIN32_TEXT[code] ?? code;
  }
  const text = Object.hasOwn(POSIX_TEXT, code) ? POSIX_TEXT[code] : undefined;
  if (text === undefined) return code;
  return platform === "darwin" ? text[0] : text[1];
}

/** Go's text for `syscall.ENOTDIR` on `platform`, as `os.MkdirAll` returns it for a file in the way. */
export function goNotDirText(platform: GoOsPlatform = goOsPlatform()): string {
  return platform === "win32" ? WIN32_PATH_NOT_FOUND : "not a directory";
}

/**
 * Go's `errors.Is(err, fs.ErrNotExist)`: `ENOENT`; on Windows also
 * `ERROR_PATH_NOT_FOUND` (Go's `ENOTDIR` there). On POSIX, `ENOTDIR` (a file
 * in the path) is not "does not exist".
 */
export function goIsNotExist(detail: FsFailureDetail, platform: GoOsPlatform = goOsPlatform()): boolean {
  if (detail.errno === "ENOENT") return true;
  return platform === "win32" && detail.errno === "ENOTDIR";
}

/**
 * The `Op` of the `*PathError` that a failed `os.Stat` or `os.Lstat` gives
 * in Go 1.24.1. POSIX: `stat` or `lstat`. Windows (`os/stat_windows.go`):
 * `stat` tries `GetFileAttributesEx`, and on any error other than
 * `ERROR_SHARING_VIOLATION` it calls `CreateFile`, whose failure is the one
 * reported (`CreateFile <path>: ...`). The port never stats an empty name,
 * so the `Stat`/`Lstat` op of that case does not occur.
 */
export function goStatOp(lstat = false, platform: GoOsPlatform = goOsPlatform()): string {
  if (platform === "win32") return "CreateFile";
  return lstat ? "lstat" : "stat";
}

/**
 * Go 1.24.1's own `syscall.EISDIR` text on Windows (zerrors_windows.go).
 * `syscall.Open` returns it for a folder opened for writing: CreateFile
 * gives `ERROR_ACCESS_DENIED`, and Go checks the folder attribute.
 */
const WIN32_GO_EISDIR = "is a directory";

/**
 * Go's `*PathError` text: `<op> <path>: <error>`. On Windows an `EISDIR`
 * of an `open` is Go's own `EISDIR` (a folder opened for writing); of a
 * `read` it stays the Win32 `ERROR_INVALID_FUNCTION` text.
 */
export function goPathError(op: string, path: string, detail: FsFailureDetail, platform: GoOsPlatform = goOsPlatform()): string {
  if (platform === "win32" && op === "open" && detail.errno === "EISDIR") return `${op} ${path}: ${WIN32_GO_EISDIR}`;
  return `${op} ${path}: ${goErrnoText(detail, platform)}`;
}

/**
 * Go's text of a failed `os.ReadFile`: `open <path>: ...`, or `read <path>:
 * ...` once the file opened (a folder). W1 R7 P7 review round 2 (P7-R2-02):
 * a file over its read bound (`EFBIG` with `limit`, which Go never reports)
 * names the bound in plain words.
 */
export function goReadFileError(path: string, detail: FsFailureDetail, platform: GoOsPlatform = goOsPlatform()): string {
  if (detail.errno === "EFBIG" && detail.limit !== undefined) return `read ${path}: file too large: BuildOS reads at most ${formatLimit(detail.limit)} from one such file`;
  return goPathError(detail.errno === "EISDIR" ? "read" : "open", path, detail, platform);
}
