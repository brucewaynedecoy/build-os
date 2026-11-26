/**
 * The `node:fs` implementation of the core filesystem port
 * (`src/core/shared/fs-port.ts`). The CLI layer creates it and passes it to
 * core. Core never loads `fs` itself.
 *
 * Every call checks its path before it touches the disk, and refuses with a
 * `PathRefusedError` (exit code 3). The adapter never resolves `..` or
 * symlinks by hand to decide where a path goes: the operating system does,
 * through `realpath.native`, and the adapter checks the result. The checks
 * run in this order:
 *
 * 1. Type: a target that is not a non-empty string, such as a Buffer or URL
 *    (`not-a-path`); a number or bigint, which `fs` reads as a file
 *    descriptor, such as 0, 1, or 2 (`file-descriptor`).
 * 2. Text, as spelled, with the rules of this platform (an early safety net
 *    only). Both: a `file:` URL, a `\\.\` or `\\?\` device namespace, or a
 *    Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`,
 *    `LPT1`-`LPT9`, `CONIN$`, `CONOUT$`, `CLOCK$`) in any folder, any case,
 *    any extension (`device-path`). POSIX: `/dev/...`, `/proc/...`,
 *    `/sys/...`, also as `//dev/...` or with `..` (`device-path`). Windows: a
 *    path rooted without a drive, such as `/dev/null` or `\proc\x`, under
 *    `\dev`, `\proc`, or `\sys` (`device-path`); a `:` after the drive, such
 *    as an alternate data stream (`special-file`). A UNC path
 *    (`\\server\share\...`) is a normal path on Windows. Its server and
 *    share are not checked for device names, as Windows never reads them as
 *    devices; every component below the share is. A path such as `///dev/stdout` or `//sys` has no UNC share,
 *    so Windows reads it as rooted on the current drive (`C:\dev\stdout`),
 *    an ordinary path that root containment decides.
 * 3. Link targets: every symlink the path goes through, at any depth, whose
 *    target text is a device path (`device-path`), whatever it points at now
 *    (on Linux, `/dev/stdout` can resolve to a pipe, or to a file in the root).
 * 4. Real path: the deepest existing part of the path, resolved by the OS,
 *    with the missing rest appended. A missing part may not be `..`
 *    (`outside-root`), a Windows device name (`device-path`), or have a `:`
 *    on Windows (`special-file`). For the root, the first missing part may
 *    not be a dangling symlink and the path may not loop (`special-file`).
 *    For a target, a dangling symlink is followed to where it points, which
 *    is then missing (a read gets `ENOENT`, as in Go), and a symlink loop is
 *    the OS error `ELOOP`, not a refusal. A real path that is a device path
 *    (`device-path`) or is outside the real root (`outside-root`) is refused.
 *    On Windows the containment check is case-insensitive and needs the same
 *    drive or UNC share.
 * 5. Type on disk: an existing target that is not a regular file or folder,
 *    such as a FIFO, socket, or character or block device (`special-file`).
 *
 * The root goes through the same checks, on its spelling as given first, and
 * then binds to its real path (`realpath.native`: on Windows, the long,
 * on-disk form, never an 8.3 short name such as `RUNNER~1`). That real root
 * is internal: every refusal, of the root itself or of a target, names the
 * root as the Go seed spells it (`rootAsGiven`: Go's `filepath.Abs`, which
 * cleans the text but never resolves a symlink).
 *
 * Any other filesystem error (`EACCES`, `EPERM`, `ENOTDIR`, `ELOOP`,
 * `ENAMETOOLONG`, a missing file, and the rest) also leaves the adapter as a
 * typed error that names the root as given, never a raw `node:fs` error:
 * opening the root or reading a target is an `InputError` (the root or a
 * required input cannot be loaded, exit code 3); a write, rename, or mkdir
 * is a `WriteError` (exit code 5). The message names the path as given, not
 * its real path.
 *
 * Writes act on the target's folder entry, as Go's `os.Rename` and
 * `os.Mkdir` do: the real path of the target's parent folder joined with its
 * last name. A symlink at the target is replaced, never followed, and the
 * file it points at is kept (PRD 20). For the writes that never follow the
 * last name (the atomic write, which renames over the entry; `writeNewFile`,
 * which uses `O_EXCL`; the intake in-place writer, which opens with
 * `O_NOFOLLOW` and replaces a link there; and `symlinkAtomic`),
 * containment checks only that folder: a symlink there may point anywhere,
 * and no byte lands where it points (P5 review round 1; the merge of P4 and
 * P5 aligned the in-place write with it). `mkdir` and `rename` also check
 * the path the symlink resolves to, so a symlink to a file outside the root
 * is refused (`outside-root`).
 *
 * After each write opens or renames, it checks again that its folder is the
 * one it checked (same real path, device, and inode) and that the opened
 * file is the entry at the name (P4 review). `SECURITY.md` states the
 * window that stays.
 *
 * `FsPortOptions.allowOutsideRoot` (parity exceptions PE-010 and PE-012,
 * `--allow-outside-root`) relaxes only the real-path containment check, for a
 * path that is inside the root as spelled (with `..` folded as text): a write
 * through a symlinked folder that leads outside the root then lands where the
 * link points, as in Go. Every other refusal stays, also for a path spelled
 * outside the root. The option covers write destinations and the `stat`
 * metadata a write needs only: `readText`, `readBytes`, `openRead`, `list`,
 * `readDir`, and `readLink` stay inside the root in every mode (P5 review
 * round 2).
 *
 * The atomic write owns its temporary name: `<prefix><random><suffix>` in
 * the target's folder, where the caller's prefix and suffix must each be
 * part of one file name, and `<random>` is a random uint32 in decimal, as
 * Go's `os.CreateTemp`. It creates the file with `O_EXCL` (and `O_NOFOLLOW`
 * where the platform has it), so a symlink planted at the temporary name is
 * never followed, and tries a new name on `EEXIST`, up to 10000 times.
 */

import { randomBytes } from "node:crypto";
import {
  accessSync,
  closeSync,
  constants,
  fchmodSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  fstatSync,
  ftruncateSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import * as nodeFs from "node:fs";
import { posix, win32 } from "node:path";
import {
  EntryChangedError,
  FsReadFailure,
  FsWriteFailure,
  InputError,
  isCoreError,
  PathRefusedError,
  type AtomicWriteStep,
  type FsFailureDetail,
  type PathRefusalReason,
} from "../core/shared/errors.ts";
import type { AtomicWriteOptions, ExpectedEntry, FsDirEntry, FsEntryId, FsLimitedRead, FsPort, FsPortFactory, FsPortOptions, FsReadStream, FsStat, InPlaceWritePort, InPlaceWritePortFactory, WriteLeftovers } from "../core/shared/fs-port.ts";
import { rootAsGiven } from "../core/shared/root.ts";

/** Path rules for a platform. Tests pass `win32` or `posix` to check both. */
export type PathPlatform = "posix" | "win32";

const PLATFORM: PathPlatform = process.platform === "win32" ? "win32" : "posix";
const path = PLATFORM === "win32" ? win32 : posix;

/**
 * Test-only hooks. A test sets `beforeOpen` to change the disk between the
 * checks of a write and its open (or rename), to prove that the checks after
 * the open catch the change. Production code never sets it.
 */
export const writeRaceHooks: {
  /**
   * `read` (W1 R7 P7 review round 1, P7-R1-04): a bounded read
   * (`readFileLimited`), right after its folder check and before it takes
   * the folder's identity, looks at the entry, and opens it.
   */
  beforeOpen?: (step: "in-place" | "temp" | "rename" | "new" | "read", target: string) => void;
  /**
   * W1 R7 P6 review round 2: runs right before a step that a test makes
   * fail by throwing from here: `sync-parent` (the folder flush after the
   * rename of an atomic write) and `unlink` (the removal of an entry a failed
   * write made).
   */
  beforeStep?: (step: "sync-parent" | "unlink", target: string) => void;
} = {};

/**
 * Node's `lchmodSync`, which exists only where the OS can set a symlink's
 * own mode (macOS). Read from the module object, so a platform without it
 * (Linux, where a link's mode is always 0777) gets `undefined`, not a load
 * error. Review round 3: a rollback puts a link's original mode back.
 */
const lchmodSync = (nodeFs as { lchmodSync?: (path: string, mode: number) => void }).lchmodSync;

/** Windows device names, reserved in every folder, with or without an extension. */
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$|clock\$)(?:\..*)?$/i;

/** True when one path component is a Windows device name. Windows drops trailing dots and spaces. */
function isWindowsDeviceName(component: string): boolean {
  return WINDOWS_DEVICE_NAME.test(component.replace(/[ .]+$/, ""));
}

/**
 * Why the path text, as spelled, is refused on `platform`, or `undefined`.
 * This is only the early safety net: the real-path checks still apply.
 */
export function classifyPathText(text: string, platform: PathPlatform = PLATFORM): PathRefusalReason | undefined {
  const value = text.trim();
  if (/^file:/i.test(value)) return "device-path";
  if (/^[\\/]{2}[.?](?:[\\/]|$)/.test(value)) return "device-path";
  // On Windows, the UNC server and share (`\\server\share\`) are not file
  // names: the Win32 path parser never reads them as device names, so a host
  // such as `aux.example.org` or `nul`, or a share named `CON`, is allowed.
  // Every component below the share gets the device-name rule.
  const below = value.slice(uncAuthority(value, platform).length);
  if (below.split(/[\\/]/).some(isWindowsDeviceName)) return "device-path";
  if (platform === "win32") {
    // Rooted without a drive (`/dev/null`, `\proc\x`), but not UNC (`\\server\share`).
    if (/^[\\/](?![\\/])/.test(value) && /^\\(?:dev|proc|sys)(?:\\|$)/i.test(win32.normalize(value))) return "device-path";
    if (value.replace(/^[a-z]:/i, "").includes(":")) return "special-file";
    return undefined;
  }
  // POSIX: `posix.resolve` folds `..` and repeated leading slashes, so
  // `//dev/stdout` and `/tmp/../dev/stdout` both read as `/dev/stdout`. A
  // backslash is read as a separator here too, which only refuses more.
  const unix = value.replace(/\\/g, "/");
  if (unix.startsWith("/") && /^\/(?:dev|proc|sys)(?:\/|$)/.test(posix.resolve("/", unix))) return "device-path";
  return undefined;
}

/**
 * The UNC server and share at the start of `text` on Windows
 * (`\\server\share\`, as `win32.parse` finds it), or `""`. The `\\.\` and
 * `\\?\` device namespaces are refused before this runs.
 */
function uncAuthority(text: string, platform: PathPlatform): string {
  if (platform !== "win32" || !/^[\\/]{2}[^\\/]/.test(text)) return "";
  const root = win32.parse(text).root;
  return /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+/.test(root) ? root : "";
}

/** True when the path text names a device or special path on `platform`. */
export function isDevicePathText(text: string, platform: PathPlatform = PLATFORM): boolean {
  return classifyPathText(text, platform) === "device-path";
}

/**
 * True when `target` is `root` or inside it, with the rules of `platform`:
 * on Windows, case-insensitive and on the same drive or UNC share.
 */
export function isInsideRoot(root: string, target: string, platform: PathPlatform = PLATFORM): boolean {
  const api = platform === "win32" ? win32 : posix;
  const rel = api.relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${api.sep}`) && !api.isAbsolute(rel));
}

/** Most symlinks followed in one path, as in Linux `MAXSYMLINKS`. */
const MAX_LINK_HOPS = 40;

const SEPARATORS = PLATFORM === "win32" ? /[\\/]+/ : /\/+/;

function components(text: string): string[] {
  return text.split(SEPARATORS).filter((part) => part !== "" && part !== ".");
}

function joinRaw(parent: string, child: string): string {
  return parent.endsWith(path.sep) ? parent + child : parent + path.sep + child;
}

/**
 * The absolute path the OS will open for `target`, without folding `..`.
 * POSIX folds `..` only after it follows each symlink, so the spelling is
 * kept and `realpath` decides. Win32 folds `..` as text before it touches the
 * disk (and stops at a drive or UNC share root), so `win32.resolve` is what
 * Windows does.
 */
function osPath(base: string, target: string): string {
  if (PLATFORM === "win32") return win32.resolve(base, target);
  return posix.isAbsolute(target) ? target : joinRaw(base, target);
}

function errorCode(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code;
}

/** `permission denied (EACCES)`: the OS reason and code, without the real path `node:fs` puts in its message. */
function describeFsError(error: unknown): string {
  const code = errorCode(error);
  const text = error instanceof Error ? error.message : String(error);
  if (typeof code === "string") {
    // `node:fs` messages read `EACCES: permission denied, realpath '<real path>'`.
    const reason = text.startsWith(`${code}: `) ? text.slice(code.length + 2).split(",", 1)[0]?.trim() : undefined;
    return reason === undefined || reason === "" ? code : `${reason} (${code})`;
  }
  const line = (text.split(/\r?\n/, 1)[0] ?? "").trim();
  return line === "" ? "unexpected failure" : line;
}

function isMissing(error: unknown): boolean {
  const code = errorCode(error);
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * Follows every symlink in `absolute`, one component at a time, and returns
 * the first link target or real folder that is a device or special path, or
 * `undefined`. Each step starts from a folder that has no symlink left, so
 * `..` there is that folder's parent, as the OS reads it. (On Windows,
 * `absolute` and each link target are folded as text first, as Windows does.)
 *
 * `realpath` alone cannot classify a link to `/dev/stdout`: on Linux, when
 * stdout is a pipe, `/dev/stdout` leads through `/proc/self/fd/1` to
 * `pipe:[n]`, which is not a path, and when stdout is a file the real path is
 * that file. A missing or unreadable component ends the walk; the real-path
 * and file-type checks that follow still apply.
 */
function deviceLinkTarget(absolute: string): string | undefined {
  const start = path.parse(absolute).root;
  const pending = components(absolute.slice(start.length));
  let current = start;
  let hops = 0;
  while (pending.length > 0) {
    const part = pending.shift()!;
    if (part === "..") {
      current = path.dirname(current);
      continue;
    }
    const next = joinRaw(current, part);
    let target: string;
    try {
      if (!lstatSync(next).isSymbolicLink()) {
        current = next;
        if (isDevicePathText(current)) return current;
        continue;
      }
      target = readlinkSync(next);
    } catch {
      return undefined;
    }
    if (isDevicePathText(target)) return target;
    if (++hops > MAX_LINK_HOPS) return undefined;
    if (PLATFORM === "win32" || path.isAbsolute(target)) {
      const resolved = PLATFORM === "win32" ? win32.resolve(current, target) : target;
      current = path.parse(resolved).root;
      pending.unshift(...components(resolved.slice(current.length)));
    } else {
      pending.unshift(...components(target));
    }
  }
  return undefined;
}

type Refuse = (reason: PathRefusalReason, message: string) => PathRefusedError;

/** W1 R7 P6 review round 3: a folder entry's device and inode, kept as bigint so a 64-bit Windows file ID is never narrowed. */
type EntryKey = { dev: bigint; ino: bigint };

/**
 * W1 R7 P6 review round 4: true when two bigint `stat` results name the same
 * entry. An inode of 0 means the OS reports no identity, so it never
 * matches, not even another 0 (the same rule as `identityOf`).
 */
export function sameKey(a: { dev: bigint; ino: bigint }, b: { dev: bigint; ino: bigint }): boolean {
  return a.ino !== 0n && a.dev === b.dev && a.ino === b.ino;
}
type FolderKey = { dir: string } & EntryKey;

/**
 * The real path of `absolute`: the OS resolves its deepest existing part
 * (symlinks and `..` in the order the OS follows them), and the missing rest
 * is appended after checks. Returns whether the full path exists.
 *
 * For the root (`kind` `root`), a dangling symlink and a symlink loop are
 * refused. For a target inside the root, they are what the OS sees, as in
 * Go: a dangling symlink is followed to where it points (which does not
 * exist, so a read is `ENOENT`; the caller still checks containment), and a
 * loop leaves as the raw `ELOOP` error.
 *
 * A missing part that another command creates during the walk (a folder or
 * file, not a symlink) restarts the walk, so the caller sees the path as it
 * is now, as Go's single system call would (P5 review round 2).
 */
function realPathOf(absolute: string, label: string, refuse: Refuse, kind: "root" | "target" = "root"): { real: string; exists: boolean } {
  let missing: string[] = [];
  let current = absolute;
  let hops = 0;
  let retries = 0;
  for (;;) {
    try {
      const real = realpathSync.native(current);
      if (missing.length === 0) return { real, exists: true };
      missing.reverse();
      const rest = PLATFORM === "win32" ? missing : missing.filter((part) => part !== "" && part !== ".");
      for (const part of rest) {
        if (part === "..") throw refuse("outside-root", `${label} climbs out of a missing folder with ..`);
        if (isWindowsDeviceName(part)) throw refuse("device-path", `${label} names the device ${part}`);
        if (PLATFORM === "win32" && part.includes(":")) throw refuse("special-file", `${label} names a stream or device with :`);
      }
      if (rest.length === 0) return { real, exists: true };
      // A dangling symlink (or anything else `realpath` could not follow) is not a missing folder.
      const first = joinRaw(real, rest[0]!);
      let link: string | undefined;
      let appeared = false;
      try {
        const stats = lstatSync(first);
        if (stats.isSymbolicLink()) link = readlinkSync(first);
        else appeared = true;
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      if (appeared) {
        // The part was missing for `realpath` and is there now, not a
        // symlink: another command created it during the walk (P5 review
        // round 2). Resolve the whole path again.
        if (++retries > MAX_LINK_HOPS) throw refuse("special-file", `${label} keeps changing while it is resolved`);
        current = absolute;
        missing = [];
        continue;
      }
      if (link !== undefined && kind === "root") throw refuse("special-file", `${label} goes through a symlink that does not resolve`);
      if (link === undefined) return { real: rest.reduce(joinRaw, real), exists: false };
      if (++hops > MAX_LINK_HOPS) throw Object.assign(new Error(`ELOOP: too many symbolic links, realpath '${absolute}'`), { code: "ELOOP", syscall: "realpath" });
      // Follow the dangling link from the folder that holds it, as the OS does.
      const base = PLATFORM === "win32" ? win32.resolve(real, link) : path.isAbsolute(link) ? link : joinRaw(real, link);
      current = rest.slice(1).reduce(joinRaw, base);
      missing = [];
    } catch (error) {
      if (error instanceof PathRefusedError) throw error;
      if (errorCode(error) === "ELOOP") {
        if (kind === "target") throw error;
        throw refuse("special-file", `${label} goes through a symlink loop`);
      }
      if (!isMissing(error)) throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

/** Refuses an existing entry that is not a regular file or folder. */
function checkKind(real: string, label: string, refuse: Refuse): void {
  const stats = lstatSync(real);
  if (!stats.isFile() && !stats.isDirectory()) throw refuse("special-file", `${label} is not a regular file or folder`);
}

/**
 * The OS error code, system call, and atomic-write step of a raw `node:fs`
 * error, for core to spell as Go does. On Windows, libuv reports both
 * `ERROR_FILE_NOT_FOUND` and `ERROR_PATH_NOT_FOUND` as `ENOENT`; Go prints
 * them differently, so `parentMissing` says which one it was.
 */
function failureDetail(error: unknown): FsFailureDetail {
  const code = errorCode(error);
  const detail: FsFailureDetail = { errno: typeof code === "string" ? code : "EUNKNOWN" };
  const tagged = error as { syscall?: unknown; path?: unknown; buildosStep?: AtomicWriteStep; buildosTemp?: string; buildosTempExhausted?: boolean } | null;
  if (typeof tagged?.syscall === "string") detail.syscall = tagged.syscall;
  if (tagged?.buildosStep !== undefined) detail.step = tagged.buildosStep;
  if (tagged?.buildosTemp !== undefined) detail.tempName = tagged.buildosTemp;
  if (tagged?.buildosTempExhausted === true) detail.tempExhausted = true;
  const limit = (error as { buildosLimit?: unknown } | null)?.buildosLimit;
  if (typeof limit === "number") detail.limit = limit;
  if (PLATFORM === "win32" && (code === "ENOENT" || code === "ENOTDIR") && typeof tagged?.path === "string") {
    try {
      detail.parentMissing = !statSync(path.dirname(tagged.path)).isDirectory();
    } catch {
      detail.parentMissing = true;
    }
  }
  return detail;
}

/** Most tries for a free temporary name, as Go's `os.CreateTemp`. */
const CREATE_TEMP_TRIES = 10000;

/**
 * The temporary-name pattern of an atomic write: `<prefix><random><suffix>`,
 * where `<random>` is Go's `nextRandom` (a random uint32 in decimal). The
 * adapter owns the name: the prefix and suffix must each be part of one
 * file name, with no folder separator (`/` or `\\` on any platform), no NUL,
 * no `..`, no `:` (a Windows stream), and no control character, and the
 * whole name must not be a Windows device name. So the temporary file is
 * always created in the target's own folder.
 */
function checkTempPattern(options: AtomicWriteOptions, targetName: string, refuse: Refuse): { name: () => string } {
  const prefix = options.tempPrefix ?? `.${targetName}.`;
  const suffix = options.tempSuffix ?? ".tmp";
  for (const [label, part] of [["prefix", prefix], ["suffix", suffix]] as const) {
    if (typeof part !== "string" || /[\\/:\u0000-\u001f]/.test(part) || part.includes("..")) {
      throw refuse("not-a-path", `the temporary file ${label} ${JSON.stringify(part)} must be part of one file name`);
    }
  }
  // A digit run in the middle never makes a device name, but `CON` + "" could.
  if (isWindowsDeviceName(`${prefix}0${suffix}`) || isWindowsDeviceName(prefix)) {
    throw refuse("device-path", `the temporary file name ${JSON.stringify(`${prefix}*${suffix}`)} names a Windows device`);
  }
  return { name: () => `${prefix}${randomBytes(4).readUInt32BE(0)}${suffix}` };
}

/** Writes every byte of `data` to `fd`. */
function writeAll(fd: number, data: string | Uint8Array): void {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  let offset = 0;
  while (offset < bytes.byteLength) offset += writeSync(fd, bytes, offset, bytes.byteLength - offset);
}

/**
 * Flushes a folder, as Go's `syncDirectory` (open read-only, `Sync`), with
 * the step tagged. Skipped on Windows: Windows has no folder flush, and NTFS
 * journals the change (PE-005).
 */
function syncFolder(dir: string): void {
  if (PLATFORM === "win32") return;
  const tag = (step: AtomicWriteStep, error: unknown): never => {
    (error as { buildosStep?: AtomicWriteStep }).buildosStep = step;
    throw error;
  };
  let dirFd: number;
  try {
    dirFd = openSync(dir, constants.O_RDONLY);
  } catch (error) {
    return tag("open-parent", error);
  }
  try {
    fsyncSync(dirFd);
  } catch (error) {
    tag("sync-parent", error);
  } finally {
    closeSync(dirFd);
  }
}

/**
 * Go's `os.Getwd` on POSIX: `$PWD` when it is absolute and names the same
 * folder as `.` (same device and inode), else the OS current folder. So a
 * relative `--root` folds against the folder as the shell spells it, also
 * when it is reached through a symlink, as Go's `filepath.Abs` does. On
 * Windows, Go never reads `$PWD`.
 */
export function goGetwd(): string {
  const cwd = process.cwd();
  if (PLATFORM === "win32") return cwd;
  const pwd = process.env["PWD"];
  if (pwd === undefined || !pwd.startsWith("/")) return cwd;
  try {
    const dot = statSync(".");
    const named = statSync(pwd);
    if (dot.dev === named.dev && dot.ino === named.ino) return pwd;
  } catch {
    // Go falls back to getcwd when $PWD cannot be read.
  }
  return cwd;
}

/**
 * Opens a port bound to `root`, spelled as the user gave it, relative to
 * `cwd` (default: the process folder). The root itself need not exist yet.
 */
/** An identity that never matches another: for an entry whose identity the OS does not report, or a write that could not read its own entry back. */
function unknownIdentity(kind: FsDirEntry["kind"]): string {
  return `${kind}:unknown:${randomBytes(8).toString("hex")}`;
}

/**
 * W1 R7 P6 review round 3: the kind, identity text, permission bits, and
 * hard link count of an `lstat` or `stat` result with bigint fields
 * (`FsPort.entryId`). The device and inode stay bigint, so a 64-bit Windows
 * file ID is never narrowed. A file system that reports an inode of 0 gives
 * no identity: the entry gets one that never matches another, so a check by
 * identity declines instead of taking two entries for one.
 */
export function identityOf(stats: nodeFs.BigIntStats): FsEntryId {
  const kind: FsDirEntry["kind"] = stats.isSymbolicLink() ? "symlink" : stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other";
  const id = stats.ino === 0n ? unknownIdentity(kind) : `${kind}:${stats.dev}:${stats.ino}`;
  return { kind, id, mode: Number(stats.mode & 0o7777n), links: Number(stats.nlink) };
}

export const createNodeFsPort: FsPortFactory = (root: string, cwd: string = process.cwd(), options: FsPortOptions = {}): FsPort => openNodeFs(root, cwd, options).port;

/**
 * Opens the in-place writer bound to `root` (see `InPlaceWritePort`). Only
 * the intake domain's output code gets one; every other domain writes
 * through `writeFileAtomic`.
 */
export const createNodeInPlaceWriter: InPlaceWritePortFactory = (root: string, cwd: string = process.cwd(), options: FsPortOptions = {}): InPlaceWritePort => {
  const { writeInPlace, checkInPlace, checkMkdir } = openNodeFs(root, cwd, options);
  return { writeFileInPlace: writeInPlace, checkInPlaceTarget: checkInPlace, checkMkdir };
};

function openNodeFs(root: string, cwd: string, options: FsPortOptions): { port: FsPort; writeInPlace: InPlaceWritePort["writeFileInPlace"]; checkInPlace: InPlaceWritePort["checkInPlaceTarget"]; checkMkdir: InPlaceWritePort["checkMkdir"] } {
  if (typeof root !== "string" || root === "" || root.includes("\0")) {
    throw new PathRefusedError("not-a-path", "the filesystem root must be a non-empty string path");
  }
  /**
   * The root as the Go seed spells it: Go's `filepath.Abs`, a text fold with
   * no symlink followed. Every refusal, of the root or of a target, reports
   * this, never `realRoot`. Containment checks use `realRoot`.
   */
  const givenRoot = rootAsGiven(root, cwd, PLATFORM);
  const refuse: Refuse = (reason, message) => new PathRefusedError(reason, message, { root: givenRoot });
  const rootLabel = `the filesystem root ${givenRoot}`;
  const rootText = classifyPathText(root);
  if (rootText !== undefined) throw refuse(rootText, `${rootLabel} is a device or special path`);
  /**
   * Runs `action`; a raw filesystem error leaves as a typed error that names
   * the given root. A typed error (a refusal) passes through unchanged.
   */
  const guard = <T>(kind: "read" | "write", label: string, action: () => T): T => {
    try {
      return action();
    } catch (error) {
      if (isCoreError(error)) throw error;
      const message = `${label} failed: ${describeFsError(error)}`;
      const fs = failureDetail(error);
      if (kind === "write") {
        // W1 R7 P6 review round 2: what the failed write left on disk stays visible to the caller.
        const typed = new FsWriteFailure(message, { code: "write_failed", correction: "Check the permissions and free space under the BuildOS root, then retry.", root: givenRoot, cause: error, fs });
        const leftovers = (error as { buildosLeftovers?: WriteLeftovers } | null)?.buildosLeftovers;
        if (leftovers !== undefined) (typed as { buildosLeftovers?: WriteLeftovers }).buildosLeftovers = leftovers;
        throw typed;
      }
      throw new FsReadFailure(message, { code: "path_unreadable", correction: "Check that the path exists and that you can read it, then retry.", root: givenRoot, cause: error, fs });
    }
  };
  const rootPath = osPath(cwd, root);
  const realRoot = ((): string => {
    try {
      const rootLink = deviceLinkTarget(rootPath);
      if (rootLink !== undefined) throw refuse("device-path", `${rootLabel} links to the device or special path ${rootLink}`);
      const { real, exists } = realPathOf(rootPath, rootLabel, refuse);
      if (isDevicePathText(real)) throw refuse("device-path", `${rootLabel} resolves to a device or special path`);
      if (exists) checkKind(real, rootLabel, refuse);
      return real;
    } catch (error) {
      if (isCoreError(error)) throw error;
      throw new InputError(`${rootLabel} cannot be opened: ${describeFsError(error)}`, {
        code: "root_unreadable",
        correction: "Pass --root with a project folder you can open and read.",
        root: givenRoot,
        cause: error,
      });
    }
  })();


  /** The type, text, and link-target checks of a target; returns its absolute path as the OS opens it. */
  const checkText = (target: unknown): string => {
    if (typeof target === "number" || typeof target === "bigint") {
      throw refuse("file-descriptor", `the filesystem port refuses file descriptor ${String(target)}; pass a path inside the root`);
    }
    if (typeof target !== "string" || target === "" || target.includes("\0")) {
      throw refuse("not-a-path", "the filesystem port accepts only a non-empty string path");
    }
    const text = classifyPathText(target);
    if (text !== undefined) throw refuse(text, `${target} is a device or special path`);
    const absolute = osPath(realRoot, target);
    // Windows folds `..` as text, so a path that is outside both spellings of
    // the root as text is outside on disk too. This also keeps a UNC path
    // on another host off the network.
    if (PLATFORM === "win32" && !isInsideRoot(realRoot, absolute) && !isInsideRoot(givenRoot, absolute)) {
      throw refuse("outside-root", `${target} is outside the root ${givenRoot}`);
    }
    const link = deviceLinkTarget(absolute);
    if (link !== undefined) throw refuse("device-path", `${target} links to the device or special path ${link}`);
    return absolute;
  };

  /**
   * Checks a target and returns its real absolute path. `forWrite` is true
   * only for a write destination and the metadata checks a write needs
   * (`stat`): only then does `allowOutsideRoot` apply. A content read is
   * always contained (P5 review round 2: the owner approved PE-012 for writes
   * only).
   */
  const check = (target: unknown, forWrite = false): string => {
    const absolute = checkText(target);
    const label = target as string;
    const { real, exists } = realPathOf(absolute, label, refuse, "target");
    if (isDevicePathText(real)) throw refuse("device-path", `${label} resolves to the device or special path ${real}`);
    if (!isInsideRoot(realRoot, real)) {
      // --allow-outside-root (PE-010, PE-012) lets a write destination that
      // is inside the root as spelled (`..` folded as text) resolve outside it
      // through a symlink. A path spelled outside the root is still refused.
      const spelled = path.resolve(realRoot, label);
      const throughLink = isInsideRoot(realRoot, spelled) || isInsideRoot(givenRoot, path.resolve(givenRoot, label));
      // W1 R7 P7 review round 3 (P7-R3-03): a refused content read is marked as a read, so its message never offers the write switch.
      if (!forWrite) throw new PathRefusedError("outside-root", `${label} resolves outside the root ${givenRoot}`, { root: givenRoot, forRead: true });
      if (options.allowOutsideRoot !== true || !throughLink) throw refuse("outside-root", `${label} resolves outside the root ${givenRoot}`);
    }
    if (exists) checkKind(real, label, refuse);
    return real;
  };

  /**
   * The directory entry a write acts on, as Go's `os.Rename` and `os.Mkdir`
   * do: the real path of the target's parent folder joined with its last
   * name, so a symlink at the target is replaced, never followed. The
   * entry's folder must be inside the root. With `followsName` (a write that
   * opens the last name, and so follows a symlink there), the path the target
   * resolves to (through every symlink) must be inside the root too. Without
   * it (a rename over the entry, or `O_EXCL`), a symlink at the last name is
   * never followed, so it may point anywhere: no byte lands there. A FIFO,
   * socket, or device at the entry is still refused.
   */
  const entryOf = (target: string, followsName = true): { entry: string; dir: string } => {
    const absolute = checkText(target);
    const name = path.basename(absolute);
    const bare = name === "" || name === "." || name === ".." || /[\\/]$/.test(absolute);
    if (followsName || bare) {
      const real = check(target, true);
      if (bare) return { entry: real, dir: path.dirname(real) };
      const dir = check(path.dirname(absolute), true);
      return { entry: joinRaw(dir, name), dir };
    }
    const dir = check(path.dirname(absolute), true);
    const entry = joinRaw(dir, name);
    let stats;
    try {
      stats = lstatSync(entry);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    if (stats !== undefined && !stats.isFile() && !stats.isDirectory() && !stats.isSymbolicLink()) throw refuse("special-file", `${target} is not a regular file or folder`);
    return { entry, dir };
  };

  /**
   * Node has no `openat`, so a write cannot open a file relative to a
   * folder descriptor. Instead, each write takes the folder's identity
   * (device and inode) before it opens or renames, and checks after it that
   * the folder's real path is still the same text, the same folder, and
   * allowed (inside the root, or reached through a link with
   * `allowOutsideRoot`). A folder swapped for a symlink or another folder
   * between the check and the open fails this. `SECURITY.md` states the
   * window that stays.
   */
  const folderId = (dir: string): FolderKey => {
    const stats = statSync(dir, { bigint: true });
    return { dir, dev: stats.dev, ino: stats.ino };
  };
  const sameFolder = (id: FolderKey): boolean => folderUnchanged(id, false);
  /** `sameFolder` for a read (P7-R1-04): `forRead` ignores `allowOutsideRoot`, so the folder must be inside the root. */
  const folderUnchanged = (id: FolderKey, forRead: boolean): boolean => {
    try {
      const real = realpathSync.native(id.dir);
      if (PLATFORM === "win32" ? real.toLowerCase() !== id.dir.toLowerCase() : real !== id.dir) return false;
      const stats = statSync(real, { bigint: true });
      if (!sameKey(stats, id)) return false;
      // A read is always contained: `allowOutsideRoot` applies to writes only.
      return isInsideRoot(realRoot, real) || (!forRead && options.allowOutsideRoot === true);
    } catch {
      return false;
    }
  };
  /** True when the folder entry at `entry` is the file open as `fd` (same device and inode, not a symlink), or, with `link`, the symlink made as `opened`. */
  const sameEntry = (entry: string, opened: EntryKey, link = false): boolean => {
    try {
      const named = lstatSync(entry, { bigint: true });
      return named.isSymbolicLink() === link && sameKey(named, opened);
    } catch {
      return false;
    }
  };
  /**
   * The identity (device and inode) of the folder that `dir` names now,
   * through any link. A write takes it right after it creates an entry
   * there, so a cleanup can check that `dir` still names the folder that
   * holds the entry (P4-P5 merge fix round). `undefined` when it cannot be
   * read.
   */
  const parentId = (dir: string): EntryKey | undefined => {
    try {
      const stats = statSync(dir, { bigint: true });
      return { dev: stats.dev, ino: stats.ino };
    } catch {
      return undefined;
    }
  };
  /**
   * Removes `entry`, an entry this write created, only when both checks
   * pass: `path.dirname(entry)` still names the folder it was created in
   * (`createdIn`), and the entry is still the one this write made
   * (`opened`: a file, or with `link` a symlink). Returns `mismatch` when a
   * check fails, so nothing is removed and the caller reports what is left;
   * `done` otherwise (also when the entry is gone from the unchanged folder,
   * or the unlink fails: a best effort, and the caller's own failure is what
   * it reports). The folder is checked before the entry.
   */
  const removeOwn = (entry: string, opened: EntryKey | undefined, createdIn: EntryKey | undefined, link = false): "done" | "mismatch" | "failed" => {
    // The folder first (P4-P5 merge fix round 2): a name that is missing in
    // a replaced folder says nothing about the original folder, which can
    // still hold the entry. A changed folder removes nothing.
    const now = parentId(path.dirname(entry));
    if (createdIn === undefined || now === undefined || !sameKey(now, createdIn)) return "mismatch";
    let named;
    try {
      named = lstatSync(entry, { bigint: true });
    } catch (error) {
      if (isMissing(error)) return "done";
      return "mismatch";
    }
    if (opened === undefined) return "mismatch";
    if (named.isSymbolicLink() !== link || !sameKey(named, opened)) return "mismatch";
    try {
      writeRaceHooks.beforeStep?.("unlink", entry);
      unlinkSync(entry);
    } catch (error) {
      // W1 R7 P6 review round 2: the caller's own failure is what it
      // reports, and it lists this entry as left behind.
      return isMissing(error) ? "done" : "failed";
    }
    return "done";
  };
  /**
   * W1 R7 P6 review round 2: adds what a failed write left on disk to its
   * error (`WriteLeftovers`), so the caller's undo and report see it.
   */
  const withLeftovers = (error: unknown, add: WriteLeftovers): unknown => {
    if (typeof error !== "object" || error === null) return error;
    const tagged = error as { buildosLeftovers?: WriteLeftovers };
    const leftBehind = [...(tagged.buildosLeftovers?.leftBehind ?? []), ...(add.leftBehind ?? [])];
    tagged.buildosLeftovers = { ...tagged.buildosLeftovers, ...(add.committed === undefined ? {} : { committed: add.committed }), ...(leftBehind.length > 0 ? { leftBehind } : {}) };
    return error;
  };
  /**
   * The identity of the entry a write just put at `entry`: from its `lstat`
   * when it is still the file or link the write made (`opened`), else from
   * the write's own open (`made`), which is what the write put there.
   */
  const committedId = (entry: string, opened: EntryKey | undefined, made: nodeFs.BigIntStats | undefined, link = false): FsEntryId => {
    try {
      const now = lstatSync(entry, { bigint: true });
      if (opened !== undefined && now.isSymbolicLink() === link && sameKey(now, opened)) return idOf(now);
    } catch {
      // Fall back to what the write made.
    }
    if (made !== undefined) return idOf(made);
    return { kind: link ? "symlink" : "file", id: unknownIdentity(link ? "symlink" : "file"), mode: 0, links: 0 };
  };
  /** The path of `entry`'s sibling `name` as the caller spelled `target` (with `/`), for a leftover report. */
  const besideTarget = (target: string, name: string): string => {
    const folder = posix.dirname(String(target).replace(/\\/g, "/"));
    return folder === "." ? name : `${folder}/${name}`;
  };
  /**
   * The refusal for a failed write whose cleanup was skipped because the
   * entry or its folder is no longer the one the write made: the original
   * text, plus the entry left in place.
   */
  const leftInPlace = (error: unknown, entry: string, what: string): PathRefusedError => {
    const base = error instanceof PathRefusedError ? error.message : `${describeFsError(error)}`;
    return refuse(error instanceof PathRefusedError ? error.reason : "outside-root", `${base}; the ${what} ${path.basename(entry)} was left in place because its folder or the entry changed`);
  };

  /** The kind and identity text of an `lstat` result (`FsPort.entryId`). */
  const idOf = identityOf;
  /** `lstat` of an entry with bigint fields (the Windows file ID needs more than 53 bits), or `undefined` when it is missing. */
  const lstatEntry = (entry: string): nodeFs.BigIntStats | undefined => {
    try {
      return lstatSync(entry, { bigint: true });
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  };
  /**
   * W1 R7 P6 review round 1: true when the entry at `entry` (a real folder
   * joined with its last name) is `expected`. No link is followed: a file
   * is opened with `O_NOFOLLOW`, checked to be the entry that was
   * `lstat`ed, and read with a bound of one byte more than expected.
   */
  const matchesAt = (entry: string, expected: ExpectedEntry): boolean => {
    const stats = lstatEntry(entry);
    if (stats === undefined) return false;
    if (expected.kind === "entry") return idOf(stats).id === expected.id;
    // W1 R7 P6 review round 2: the identity and the permission bits too, when given.
    if (expected.id !== undefined && idOf(stats).id !== expected.id) return false;
    // W1 R7 P6 review round 3: a link's own mode too, where the OS keeps one (macOS); elsewhere it is always the same value.
    if (expected.kind === "symlink") {
      // W1 R7 P6 review round 4: a link's own hard link count too.
      if (expected.links !== undefined && Number(stats.nlink) !== expected.links) return false;
      return stats.isSymbolicLink() && (expected.mode === undefined || idOf(stats).mode === expected.mode) && readlinkSync(entry) === expected.target;
    }
    if (expected.mode !== undefined && idOf(stats).mode !== expected.mode) return false;
    if (expected.links !== undefined && Number(stats.nlink) !== expected.links) return false;
    if (!stats.isFile() || stats.size !== BigInt(expected.data.byteLength)) return false;
    const fd = openSync(entry, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fstatSync(fd, { bigint: true });
      if (!sameKey(opened, stats)) return false;
      const want = expected.data.byteLength;
      const buffer = Buffer.alloc(want + 1);
      let got = 0;
      while (got < buffer.length) {
        const n = readSync(fd, buffer, got, buffer.length - got, null);
        if (n === 0) break;
        got += n;
      }
      return got === want && buffer.subarray(0, want).equals(expected.data);
    } finally {
      closeSync(fd);
    }
  };
  /** The entry a content read names: its folder inside the root in every mode, its last name not followed. */
  const containedEntry = (target: string): string => {
    const absolute = checkText(target);
    return joinRaw(check(path.dirname(absolute)), path.basename(absolute));
  };

  /**
   * W1 R7 P7 review round 2 (P7-R2-02): Go's `os.ReadFile` with a size
   * bound. One open of the checked real path; the opened file must be a
   * regular file of at most `limit` bytes, and at most `limit + 1` bytes are
   * read from that open (a file that grows past the limit while it is read
   * is refused too). A folder is read with `readFileSync`, which fails at
   * once (`EISDIR`) as before, so its error text stays Go's.
   */
  const readBounded = (target: unknown, limit: number): Uint8Array => {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new TypeError("a read limit must be a whole number of bytes");
    const real = check(target);
    const tooLarge = () => Object.assign(new Error(`EFBIG: file too large, read '${real}'`), { code: "EFBIG", syscall: "read", buildosLimit: limit });
    const fd = openSync(real, constants.O_RDONLY);
    try {
      const opened = fstatSync(fd);
      if (opened.isFile()) {
        if (opened.size > limit) throw tooLarge();
        // Not from the shared pool: the caller gets a view of its own memory only.
        let buffer = Buffer.allocUnsafeSlow(Math.min(opened.size, limit) + 1);
        let got = 0;
        for (;;) {
          if (got === buffer.length) {
            if (buffer.length > limit) throw tooLarge();
            const bigger = Buffer.allocUnsafeSlow(Math.min(buffer.length * 2, limit + 1));
            buffer.copy(bigger, 0, 0, got);
            buffer = bigger;
          }
          const n = readSync(fd, buffer, got, buffer.length - got, null);
          if (n === 0) break;
          got += n;
        }
        return new Uint8Array(buffer.buffer, buffer.byteOffset, got);
      }
      if (!opened.isDirectory()) throw refuse("special-file", `${String(target)} is not a regular file`);
    } finally {
      closeSync(fd);
    }
    return new Uint8Array(readFileSync(real));
  };

  /**
   * `readFileLimited` (see the port). `followLinkInRoot` (P7-R2-02): a link at
   * the name is read as the regular file it resolves to, only inside the root.
   */
  const readLimited = (target: unknown, limit: number, followLinkInRoot: boolean): FsLimitedRead => {
    // W1 R7 P6 review round 2: one open, checked against the entry at the
    // name, and a hard bound on the bytes read from that open.
    // W1 R7 P7 review round 1 (P7-R1-04): the folder too. Its identity is
    // taken after the containment check, and after the open the folder
    // must still have the same real path (inside the root), the same
    // identity, and the opened file at the name; else the read is
    // refused. A folder swapped for a link out of the root between the
    // check and the open fails this, as it does for a write.
    const absolute = checkText(target);
    // The folder as the caller spelled it, so a refusal names the path the caller gave (P7-R2-02).
    const dir = check(path.isAbsolute(target as string) ? path.dirname(absolute) : path.dirname(target as string));
    const entry = joinRaw(dir, path.basename(absolute));
    writeRaceHooks.beforeOpen?.("read", entry);
    const folder = folderId(dir);
    const named = lstatEntry(entry);
    if (named === undefined) throw Object.assign(new Error(`ENOENT: no such file or directory, open '${entry}'`), { code: "ENOENT", syscall: "open", path: entry });
    if (named.isSymbolicLink()) {
      if (!followLinkInRoot) throw Object.assign(new Error(`ELOOP: too many symbolic links encountered, open '${entry}'`), { code: "ELOOP", syscall: "open" });
      const real = realpathSync.native(entry);
      if (isDevicePathText(real) || !isInsideRoot(realRoot, real)) throw new PathRefusedError("outside-root", `${String(target)} is a link that leads outside the root ${givenRoot}`, { root: givenRoot, forRead: true });
      // The real path has no link left, so the same checks apply to the file itself.
      const read = readLimited(real, limit, false);
      if (realpathSync.native(entry) !== real) throw new EntryChangedError(String(target), { root: givenRoot });
      return read;
    }
    if (named.isDirectory()) throw Object.assign(new Error(`EISDIR: illegal operation on a directory, read '${entry}'`), { code: "EISDIR", syscall: "read" });
    if (!named.isFile()) throw refuse("special-file", `${String(target)} is not a regular file`);
    const fd = openSync(entry, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fstatSync(fd, { bigint: true });
      if (!folderUnchanged(folder, true)) throw refuse("outside-root", `the folder of ${String(target)} changed while it was read`);
      if (!opened.isFile() || !sameKey(opened, named) || !sameEntry(entry, opened)) throw new EntryChangedError(String(target), { root: givenRoot });
      if (opened.size > BigInt(limit)) return { tooLarge: true, size: Number(opened.size) };
      const buffer = Buffer.alloc(limit + 1);
      let got = 0;
      while (got < buffer.length) {
        const n = readSync(fd, buffer, got, buffer.length - got, null);
        if (n === 0) break;
        got += n;
      }
      if (got > limit) return { tooLarge: true, size: got };
      const { id, mode, links } = idOf(named);
      return { tooLarge: false, data: new Uint8Array(buffer.subarray(0, got)), id, mode, links };
    } finally {
      closeSync(fd);
    }
  };

  const port: FsPort = {
    root: realRoot,
    readText: (target, limit) => guard("read", `read ${String(target)}`, () => Buffer.from(readBounded(target, limit)).toString("utf8")),
    readBytes: (target, limit) => guard("read", `read ${String(target)}`, () => readBounded(target, limit)),
    writeFileAtomic: (target, data, options: AtomicWriteOptions = {}) => guard("write", `write ${String(target)}`, () => {
      // The name Go's os.CreateTemp would have tried, for the message of a
      // failure before the pattern is checked; replaced right after.
      let tempName = `${options.tempPrefix ?? "."}${randomBytes(4).readUInt32BE(0)}${options.tempSuffix ?? ".tmp"}`;
      /** Runs one step; a raw error leaves tagged with the step and the temporary file name. */
      const step = <T>(name: AtomicWriteStep, action: () => T, extra: { exhausted?: boolean } = {}): T => {
        try {
          return action();
        } catch (error) {
          if (isCoreError(error)) throw error;
          (error as { buildosStep?: AtomicWriteStep; buildosTemp?: string }).buildosStep = name;
          (error as { buildosTemp?: string }).buildosTemp = tempName;
          if (extra.exhausted === true) (error as { buildosTempExhausted?: boolean }).buildosTempExhausted = true;
          throw error;
        }
      };
      // Go's os.CreateTemp creates the temporary file in the folder of the
      // path as given (filepath.Dir), and os.Rename replaces that entry: a
      // symlink at the target is replaced, and the file it points at is kept.
      const { entry, dir } = step("create-temp", () => entryOf(target, false));
      const folder = step("create-temp", () => folderId(dir));
      const tempPattern = checkTempPattern(options, path.basename(entry), refuse);
      tempName = tempPattern.name();
      // Go's os.CreateTemp: O_RDWR|O_CREATE|O_EXCL, mode 0600, a new random
      // name on EEXIST, up to 10000 tries. O_EXCL never follows a symlink.
      const flags = constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0);
      let temp = joinRaw(dir, tempName);
      let fd: number | undefined;
      for (let attempt = 1; fd === undefined; attempt++) {
        try {
          writeRaceHooks.beforeOpen?.("temp", temp);
          fd = openSync(temp, flags, options.mode === undefined ? (options.createMode ?? 0o666) : 0o600);
        } catch (error) {
          if (errorCode(error) !== "EEXIST") step("create-temp", () => { throw error; });
          if (attempt >= CREATE_TEMP_TRIES) step("create-temp", () => { throw error; }, { exhausted: true });
          tempName = tempPattern.name();
          temp = joinRaw(dir, tempName);
        }
      }
      let open = true;
      let renamed = false;
      let opened: EntryKey | undefined;
      let made: nodeFs.BigIntStats | undefined;
      let committed: FsEntryId | undefined;
      const createdIn = parentId(dir);
      try {
        // After the open: the temporary file is a new regular file with one
        // link, still the entry at its name, in the same folder as checked.
        const tempStats = step("create-temp", () => fstatSync(fd, { bigint: true }));
        opened = { dev: tempStats.dev, ino: tempStats.ino };
        made = step("create-temp", () => fstatSync(fd, { bigint: true }));
        if (!tempStats.isFile() || tempStats.nlink !== 1n || !sameEntry(temp, opened) || !sameFolder(folder)) {
          throw refuse("outside-root", `the folder of ${target} changed while the temporary file was created`);
        }
        if (options.mode !== undefined) step("chmod", () => fchmodSync(fd, options.mode!));
        const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
        step("write", () => {
          let offset = 0;
          while (offset < bytes.byteLength) offset += writeSync(fd, bytes, offset, bytes.byteLength - offset);
        });
        // The write cleared any setuid and setgid bits: a rollback sets the old mode again.
        if (options.mode !== undefined && options.exactMode === true) step("chmod", () => fchmodSync(fd, options.mode!));
        step("sync", () => fsyncSync(fd));
        open = false;
        step("close", () => closeSync(fd));
        if (!sameEntry(temp, opened) || !sameFolder(folder)) throw refuse("outside-root", `the folder of ${target} changed before the rename`);
        writeRaceHooks.beforeOpen?.("rename", entry);
        // W1 R7 P6 review round 1: the destination check, as the last step before the rename.
        if (options.expect !== undefined && !matchesAt(entry, options.expect)) throw new EntryChangedError(target, { root: givenRoot });
        step("rename", () => renameSync(temp, entry));
        renamed = true;
        // W1 R7 P6 review round 2: from here on, the destination is the new
        // file, and every later failure says so (`WriteLeftovers.committed`).
        committed = committedId(entry, opened, made);
        // After the rename: the target entry is the file this write made,
        // in the same folder. A swap here cannot be undone, but it is reported.
        if (!sameEntry(entry, opened) || !sameFolder(folder)) throw refuse("outside-root", `the folder of ${target} changed during the rename`);
      } catch (error) {
        if (open) {
          open = false;
          try {
            closeSync(fd);
          } catch {
            // The first failure is the one to report.
          }
        }
        if (renamed) throw withLeftovers(error, { committed });
        const removed = removeOwn(temp, opened, createdIn);
        if (removed === "mismatch") throw withLeftovers(leftInPlace(error, temp, "temporary file"), { leftBehind: [besideTarget(target, path.basename(temp))] });
        if (removed === "failed") throw withLeftovers(error, { leftBehind: [besideTarget(target, path.basename(temp))] });
        throw error;
      }
      // Make the rename durable. Windows has no folder flush: Go 1.24.1
      // opens the folder read-only and its Sync fails there with "Access is
      // denied." after the rename has committed (parity exception PE-005).
      // NTFS journals the rename, so the flush is skipped on Windows.
      if (options.syncParent !== false && PLATFORM !== "win32") {
        try {
          const dirFd = step("open-parent", () => openSync(dir, constants.O_RDONLY));
          try {
            step("sync-parent", () => {
              writeRaceHooks.beforeStep?.("sync-parent", entry);
              fsyncSync(dirFd);
            });
          } finally {
            closeSync(dirFd);
          }
        } catch (error) {
          throw withLeftovers(error, { committed });
        }
      }
      return committed;
    }),
    rename: (from, to) =>
      guard("write", `rename ${String(from)} to ${String(to)}`, () => {
        const source = entryOf(from);
        const destination = entryOf(to);
        const folders = [folderId(source.dir), folderId(destination.dir)];
        writeRaceHooks.beforeOpen?.("rename", destination.entry);
        if (!folders.every(sameFolder)) throw refuse("outside-root", `the folder of ${String(from)} or ${String(to)} changed before the rename`);
        renameSync(source.entry, destination.entry);
        if (!folders.every(sameFolder)) throw refuse("outside-root", `the folder of ${String(from)} or ${String(to)} changed during the rename`);
      }),
    mkdir: (target, options = {}) =>
      guard("write", `mkdir ${String(target)}`, () => {
        mkdirSync(entryOf(target).entry, { recursive: options.recursive !== false, ...(options.mode === undefined ? {} : { mode: options.mode }) });
      }),
    list: (target) => guard("read", `list ${String(target)}`, () => readdirSync(check(target)).sort()),
    stat: (target): FsStat | undefined =>
      guard("read", `stat ${String(target)}`, () => {
        // Metadata only, as Go's MkdirAll checks each folder of a write: PE-012 applies.
        const real = check(target, true);
        let stats;
        try {
          stats = statSync(real);
        } catch (error) {
          if (isMissing(error)) return undefined;
          throw error;
        }
        return { kind: stats.isDirectory() ? "directory" : "file", mode: stats.mode & 0o777, fullMode: stats.mode & 0o7777, size: stats.size, mtimeMs: stats.mtimeMs };
      }),
    exists: (target) => port.stat(target) !== undefined,
    statStrict: (target): FsStat =>
      guard("read", `stat ${String(target)}`, () => {
        // Metadata, as `stat`: PE-010 and PE-012 apply.
        const stats = statSync(check(target, true));
        return { kind: stats.isDirectory() ? "directory" : "file", mode: stats.mode & 0o777, fullMode: stats.mode & 0o7777, size: stats.size, mtimeMs: stats.mtimeMs };
      }),
    readDir: (target): FsDirEntry[] =>
      guard("read", `list ${String(target)}`, () =>
        readdirSync(check(target), { withFileTypes: true })
          .map((entry): FsDirEntry => ({
            name: entry.name,
            kind: entry.isSymbolicLink() ? "symlink" : entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
          }))
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
      ),
    writeNewFile: (target, data, options = {}) =>
      guard("write", `create ${String(target)}`, () => {
        const { entry, dir } = entryOf(target, false);
        const folder = folderId(dir);
        writeRaceHooks.beforeOpen?.("new", entry);
        // O_EXCL never follows a symlink at the name: an existing entry fails with EEXIST.
        const fd = openSync(entry, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), options.mode ?? 0o644);
        const createdIn = parentId(dir);
        let open = true;
        const streamed = typeof data !== "string" && !(data instanceof Uint8Array);
        let opened: EntryKey | undefined;
        let made: nodeFs.BigIntStats | undefined;
        try {
          // After the open (P4 rule): a new regular file with one link, still
          // the entry at its name, in the same folder as checked.
          const openedStats = fstatSync(fd, { bigint: true });
          opened = { dev: openedStats.dev, ino: openedStats.ino };
          made = openedStats;
          if (!openedStats.isFile() || openedStats.nlink !== 1n || !sameEntry(entry, opened) || !sameFolder(folder)) {
            throw refuse("outside-root", `the folder of ${String(target)} changed while the file was created`);
          }
          if (streamed) {
            for (const chunk of data) writeAll(fd, chunk);
          } else {
            writeAll(fd, data);
          }
          if (options.sync === true) fsyncSync(fd);
          // P4-P5 merge fix round: the file is complete only after its close
          // succeeds. A close error is a failed step: the new file is removed
          // (identity checked), so a retry can create it again.
          open = false;
          closeSync(fd);
          if (options.sync === true) syncFolder(dir);
        } catch (error) {
          // Any failed step removes the new file this call created, never another entry.
          if (open) {
            open = false;
            try {
              closeSync(fd);
            } catch {
              // The first failure is the one to report.
            }
          }
          // W1 R7 P6 review round 2: a new file that could not be removed is reported as left behind.
          const removed = removeOwn(entry, opened, createdIn);
          if (removed === "mismatch") throw withLeftovers(leftInPlace(error, entry, "new file"), { leftBehind: [String(target).replace(/\\/g, "/")] });
          if (removed === "failed") throw withLeftovers(error, { leftBehind: [String(target).replace(/\\/g, "/")] });
          throw error;
        }
        return committedId(entry, opened, made);
      }),
    openRead: (target): FsReadStream => {
      const fd = guard("read", `open ${String(target)}`, () => openSync(check(target), constants.O_RDONLY));
      let closed = false;
      return {
        read: (length) =>
          guard("read", `read ${String(target)}`, () => {
            if (closed) throw Object.assign(new Error("EBADF: bad file descriptor, read"), { code: "EBADF", syscall: "read" });
            const buffer = Buffer.allocUnsafe(length);
            const n = readSync(fd, buffer, 0, length, null);
            return new Uint8Array(buffer.buffer, buffer.byteOffset, n);
          }),
        close: () => {
          if (closed) return;
          closed = true;
          closeSync(fd);
        },
      };
    },
    remove: (target, removeOptions = {}) =>
      guard("write", `remove ${String(target)}`, () => {
        const { entry, dir } = entryOf(target, false);
        const folder = folderId(dir);
        if (!sameFolder(folder)) throw refuse("outside-root", `the folder of ${String(target)} changed before the remove`);
        // W1 R7 P6 review round 1: the last check before the unlink.
        if (removeOptions.expect !== undefined && !matchesAt(entry, removeOptions.expect)) throw new EntryChangedError(String(target), { root: givenRoot });
        // Never recursive, never through a symlink: unlink a file or link, else rmdir an empty folder.
        if (lstatSync(entry).isDirectory()) rmdirSync(entry);
        else unlinkSync(entry);
      }),
    entryId: (target) =>
      guard("read", `lstat ${String(target)}`, () => {
        const stats = lstatEntry(containedEntry(target));
        return stats === undefined ? undefined : idOf(stats);
      }),
    matchesEntry: (target, expected) => guard("read", `read ${String(target)}`, () => matchesAt(containedEntry(target), expected)),
    resolvedId: (target) =>
      guard("read", `resolve ${String(target)}`, () => {
        // W1 R7 P6 review round 2: the OS follows every link with its own
        // rules (on POSIX a backslash is part of a name; on Windows it is a
        // separator). A target that does not resolve, or resolves outside
        // the root or to a device, has no identity here.
        const absolute = checkText(target);
        let real: string;
        try {
          real = realpathSync.native(absolute);
        } catch {
          return undefined;
        }
        if (isDevicePathText(real) || !isInsideRoot(realRoot, real)) return undefined;
        try {
          return idOf(statSync(real, { bigint: true }));
        } catch {
          return undefined;
        }
      }),
    readFileLimited: (target, limit, readOptions = {}): FsLimitedRead => guard("read", `read ${String(target)}`, () => readLimited(target, limit, readOptions.followLinkInRoot === true)),
    checkCanCreateIn: (folder) =>
      guard("write", `check the folder ${String(folder)}`, () => {
        // W1 R7 P6 review round 2: the folder itself, as the write's rename
        // or create acts in it. A link inside it is never followed here.
        const real = check(folder === "" ? "." : folder);
        if (!statSync(real).isDirectory()) throw Object.assign(new Error(`ENOTDIR: not a directory, access '${real}'`), { code: "ENOTDIR", syscall: "access" });
        // Windows: Node cannot check a folder's access rules (see the port).
        if (PLATFORM !== "win32") accessSync(real, constants.W_OK | constants.X_OK);
      }),
    readLink: (target) =>
      guard("read", `readlink ${String(target)}`, () => {
        // A content read: contained in every mode. The last name is not followed.
        const absolute = checkText(target);
        const entry = joinRaw(check(path.dirname(absolute)), path.basename(absolute));
        const stats = lstatSync(entry);
        if (stats.isSymbolicLink()) return { target: readlinkSync(entry), mode: stats.mode & 0o7777 };
        if (!stats.isFile() && !stats.isDirectory()) throw refuse("special-file", `${String(target)} is not a regular file or folder`);
        return undefined;
      }),
    checkWritable: (target) =>
      guard("write", `open ${String(target)}`, () => {
        const { entry } = entryOf(target, false);
        let stats;
        try {
          stats = lstatSync(entry);
        } catch (error) {
          if (isMissing(error)) return;
          throw error;
        }
        if (!stats.isFile()) return;
        // The open Go's append makes, with no write: the OS checks the
        // permission (mode bits, root, the Windows read-only attribute).
        closeSync(openSync(entry, constants.O_WRONLY | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0)));
      }),
    symlinkAtomic: (target, linkText, linkOptions = {}) =>
      guard("write", `symlink ${String(target)}`, () => {
        if (typeof linkText !== "string" || linkText === "" || linkText.includes("\0")) throw refuse("not-a-path", "a symlink needs a non-empty target text");
        const { entry, dir } = entryOf(target, false);
        const folder = folderId(dir);
        const pattern = checkTempPattern({ tempPrefix: `.${path.basename(entry)}.link-`, tempSuffix: "" }, path.basename(entry), refuse);
        let temp = joinRaw(dir, pattern.name());
        for (let attempt = 1; ; attempt++) {
          try {
            symlinkSync(linkText, temp);
            break;
          } catch (error) {
            if (errorCode(error) !== "EEXIST" || attempt >= CREATE_TEMP_TRIES) throw error;
            temp = joinRaw(dir, pattern.name());
          }
        }
        // P4-P5 merge fix round: the folder that holds the new link and the
        // link itself, so a cleanup removes only this link in that folder.
        const createdIn = parentId(dir);
        let made: EntryKey | undefined;
        let madeBig: nodeFs.BigIntStats | undefined;
        try {
          const stats = lstatSync(temp, { bigint: true });
          if (stats.isSymbolicLink()) made = { dev: stats.dev, ino: stats.ino };
          madeBig = stats;
        } catch {
          made = undefined;
        }
        try {
          // Review round 3: a new link's mode is 0777 minus the umask; put the
          // original bits back where the OS keeps link modes (macOS).
          if (linkOptions.mode !== undefined && lchmodSync !== undefined) lchmodSync(temp, linkOptions.mode);
          writeRaceHooks.beforeOpen?.("rename", entry);
          // P4 rule: the folder is checked again before the rename.
          if (!sameFolder(folder)) throw refuse("outside-root", `the folder of ${String(target)} changed before the rename`);
          // W1 R7 P6 review round 1: the destination check, as the last step before the rename.
          if (linkOptions.expect !== undefined && !matchesAt(entry, linkOptions.expect)) throw new EntryChangedError(String(target), { root: givenRoot });
          renameSync(temp, entry);
        } catch (error) {
          // Only the link this call made, in the folder it made it in: a
          // changed folder may hold an unrelated entry with the same name.
          const removed = removeOwn(temp, made, createdIn, true);
          if (removed === "mismatch") throw withLeftovers(leftInPlace(error, temp, "temporary link"), { leftBehind: [besideTarget(String(target), path.basename(temp))] });
          if (removed === "failed") throw withLeftovers(error, { leftBehind: [besideTarget(String(target), path.basename(temp))] });
          throw error;
        }
        // W1 R7 P6 review round 2: from here on, the destination is the new link.
        const committed = committedId(entry, made, madeBig, true);
        try {
          if (!sameFolder(folder)) throw refuse("outside-root", `the folder of ${String(target)} changed during the rename`);
          syncFolder(dir);
        } catch (error) {
          throw withLeftovers(error, { committed });
        }
        return committed;
      }),
  };

  /**
   * The checks of an in-place write that need no open: the target text, its
   * folder's real path (inside the root), and the entry at its name. A
   * symlink to a device or special file is refused; another symlink is
   * reported so the write replaces it. A FIFO, socket, or device is refused,
   * and so is a regular file with more than one hard link. `bare` is a
   * target that names a folder (`.`, `..`, or a trailing separator).
   */
  /**
   * Windows: Node opens a folder for writing (libuv asks for backup
   * semantics), so the probe and the write would succeed in opening it.
   * Go 1.24.1's `syscall.Open` gets `ERROR_ACCESS_DENIED` there and returns
   * its own `EISDIR` ("is a directory"). The in-place writer fails the same
   * way before the open (W1 R7 P4-5 Windows CI fix).
   */
  const isWindowsFolder = (entry: string): boolean => {
    if (PLATFORM !== "win32") return false;
    try {
      return statSync(entry).isDirectory();
    } catch {
      return false;
    }
  };
  const goWindowsIsDir = (entry: string): Error => Object.assign(new Error(`EISDIR: illegal operation on a directory, open '${entry}'`), { code: "EISDIR", syscall: "open" });
  const inspectInPlace = (
    target: string,
    tag: <T>(step: AtomicWriteStep, action: () => T) => T,
  ): { bare: true; entry: string } | { bare: false; entry: string; dir: string; stats: nodeFs.BigIntStats | undefined } => {
    if (typeof target === "number" || typeof target === "bigint") {
      throw refuse("file-descriptor", `the filesystem port refuses file descriptor ${String(target)}; pass a path inside the root`);
    }
    if (typeof target !== "string" || target === "" || target.includes("\0")) {
      throw refuse("not-a-path", "the filesystem port accepts only a non-empty string path");
    }
    // The text checks of the whole target (device names, streams) still apply.
    const text = classifyPathText(target);
    if (text !== undefined) throw refuse(text, `${target} is a device or special path`);
    const absolute = osPath(realRoot, target);
    const name = path.basename(absolute);
    // A bare `.`, `..`, or trailing separator names a folder: check it as
    // a whole, and let the open fail as Go's does (`is a directory`).
    if (name === "" || name === "." || name === ".." || /[\\/]$/.test(absolute)) {
      const whole = tag("open", () => check(target, true));
      if (isWindowsFolder(whole)) tag("open", () => { throw goWindowsIsDir(whole); });
      return { bare: true, entry: whole };
    }
    const dir = tag("open", () => check(path.dirname(absolute), true));
    const entry = joinRaw(dir, name);
    let stats: nodeFs.BigIntStats | undefined;
    try {
      stats = lstatSync(entry, { bigint: true });
    } catch (error) {
      if (!isMissing(error)) tag("open", () => { throw error; });
    }
    if (stats !== undefined && stats.isSymbolicLink()) {
      // A link to a device or special file is still refused, as every
      // other port call refuses it.
      try {
        check(target, true);
      } catch (error) {
        if (isCoreError(error) && !(error instanceof PathRefusedError && error.reason === "outside-root")) throw error;
      }
    } else if (stats !== undefined && !stats.isFile() && !stats.isDirectory()) {
      throw refuse("special-file", `${target} is not a regular file`);
    } else if (stats !== undefined && stats.isFile() && stats.nlink !== 1n) {
      throw refuse("special-file", `${target} has ${stats.nlink} hard links; the port writes in place only to a file with one link`);
    } else if (stats !== undefined && stats.isDirectory() && PLATFORM === "win32") {
      tag("open", () => { throw goWindowsIsDir(entry); });
    }
    return { bare: false, entry, dir, stats };
  };

  /**
   * Go's `os.WriteFile`, made safe for a target that may change under it.
   * The write acts on the target's folder entry: the real path of its
   * folder (which must be inside the root) joined with its last name. A
   * symlink at that entry is replaced by a new regular file, never followed
   * (PRD 20), so the file it points at keeps its bytes. A FIFO, socket, or
   * device there is refused.
   *
   * The open never truncates and never follows a symlink at the name
   * (`O_NOFOLLOW`): an existing file is opened without `O_CREAT`, and a new
   * one with `O_CREAT | O_EXCL`. After the open, the opened file must be a
   * regular file with one link (a hard link could name a file outside the
   * root), the folder must still resolve to the same real path and the same
   * folder (device and inode) as checked, and the name must still be the
   * opened file. Only then is it truncated and written. A refused write
   * removes a file it created. `SECURITY.md` states the window that stays.
   */
  const writeInPlace = (target: string, data: Uint8Array, mode: number): void =>
    guard("write", `write ${String(target)}`, () => {
      const tag = <T>(step: AtomicWriteStep, action: () => T): T => {
        try {
          return action();
        } catch (error) {
          if (isCoreError(error)) throw error;
          (error as { buildosStep?: AtomicWriteStep }).buildosStep = step;
          throw error;
        }
      };
      const inspected = inspectInPlace(target, tag);
      if (inspected.bare) {
        const fd = tag("open", () => openSync(inspected.entry, constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0)));
        closeSync(fd);
        throw refuse("special-file", `${target} is not a regular file`);
      }
      const { entry } = inspected;
      const folder = tag("open", () => folderId(inspected.dir));
      let stats = inspected.stats;
      if (stats !== undefined && stats.isSymbolicLink()) {
        // A link anywhere but a device (outside the root, dangling, or a
        // loop) is replaced, never followed. P4-P5 merge fix round: only the
        // link the inspection saw, in the folder it checked.
        const seen = { dev: stats.dev, ino: stats.ino };
        if (!sameFolder(folder) || !sameEntry(entry, seen, true)) throw refuse("outside-root", `${target} changed while it was opened`);
        tag("open", () => unlinkSync(entry));
        stats = undefined;
      }
      const nofollow = constants.O_NOFOLLOW ?? 0;
      let fd: number | undefined;
      let created = false;
      // An existing file is opened as it is; a new one is created with
      // O_EXCL. A file that appears or goes away between the two is tried
      // once more the other way.
      for (let attempt = 0, exists = stats !== undefined; fd === undefined; attempt++, exists = !exists) {
        writeRaceHooks.beforeOpen?.("in-place", entry);
        try {
          fd = exists ? openSync(entry, constants.O_WRONLY | nofollow) : openSync(entry, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | nofollow, mode);
          created = !exists;
        } catch (error) {
          const retry = attempt === 0 && errorCode(error) === (exists ? "ENOENT" : "EEXIST");
          if (!retry) tag("open", () => { throw error; });
        }
      }
      let closed = false;
      let opened: EntryKey | undefined;
      const createdIn = created ? parentId(inspected.dir) : undefined;
      try {
        const openedStats = fstatSync(fd, { bigint: true });
        opened = { dev: openedStats.dev, ino: openedStats.ino };
        if (!openedStats.isFile()) throw refuse("special-file", `${target} is not a regular file`);
        if (openedStats.nlink !== 1n) throw refuse("special-file", `${target} has ${openedStats.nlink} hard links; the port writes in place only to a file with one link`);
        if (!sameFolder(folder) || !sameEntry(entry, opened)) throw refuse("outside-root", `${target} changed while it was opened`);
        tag("open", () => ftruncateSync(fd, 0));
        tag("write", () => {
          let offset = 0;
          while (offset < data.byteLength) offset += writeSync(fd, data, offset, data.byteLength - offset);
        });
        closed = true;
        tag("close", () => closeSync(fd));
      } catch (error) {
        if (!closed) {
          closed = true;
          closeSync(fd);
        }
        if (created && error instanceof PathRefusedError && removeOwn(entry, opened, createdIn) === "mismatch") throw leftInPlace(error, entry, "new file");
        throw error;
      }
    });
  /**
   * Can a new entry be made in the existing folder `dir` now? On POSIX,
   * `access(W_OK | X_OK)` answers as the create would (`EACCES`, `EROFS`).
   * Windows ignores the read-only attribute on a folder, so `access` there
   * would refuse a folder that allows the create; it is not asked. A missing
   * folder is made by the command first.
   */
  const checkCreateIn = (dir: string, tag: <T>(step: AtomicWriteStep, action: () => T) => T): void => {
    if (PLATFORM === "win32") return;
    let isDir = false;
    try {
      isDir = statSync(dir).isDirectory();
    } catch (error) {
      if (isMissing(error)) return;
      tag("open", () => { throw error; });
    }
    if (isDir) tag("open", () => accessSync(dir, constants.W_OK | constants.X_OK));
  };
  /**
   * The checks of `writeInPlace`, without writing, for a preflight before a
   * command's first write: the same inspection, then the same open as a
   * probe. An existing file or folder is opened for writing (no `O_TRUNC`,
   * no `O_CREAT`, `O_NOFOLLOW`) and closed at once, so a folder fails with
   * `EISDIR` and a read-only file with `EACCES`, as the write would. A new
   * name, or a link the write replaces, needs a folder that allows a new
   * entry.
   */
  const checkInPlace = (target: string): void =>
    guard("write", `write ${String(target)}`, () => {
      const tag = <T>(step: AtomicWriteStep, action: () => T): T => {
        try {
          return action();
        } catch (error) {
          if (isCoreError(error)) throw error;
          (error as { buildosStep?: AtomicWriteStep }).buildosStep = step;
          throw error;
        }
      };
      const inspected = inspectInPlace(target, tag);
      const nofollow = constants.O_NOFOLLOW ?? 0;
      if (inspected.bare) {
        const fd = tag("open", () => openSync(inspected.entry, constants.O_WRONLY | nofollow));
        closeSync(fd);
        throw refuse("special-file", `${target} is not a regular file`);
      }
      const { entry, dir, stats } = inspected;
      if (stats !== undefined && !stats.isSymbolicLink()) {
        const fd = tag("open", () => openSync(entry, constants.O_WRONLY | nofollow));
        closeSync(fd);
        return;
      }
      checkCreateIn(dir, tag);
    });
  /** The checks of `port.mkdir(target)` that need not make it (see `InPlaceWritePort.checkMkdir`). */
  const checkMkdir = (target: string): void =>
    guard("write", `mkdir ${String(target)}`, () => {
      const { dir } = entryOf(target);
      checkCreateIn(dir, (_step, action) => action());
    });
  return { port, writeInPlace, checkInPlace, checkMkdir };
}
