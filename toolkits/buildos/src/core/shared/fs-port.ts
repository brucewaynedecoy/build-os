/**
 * The filesystem port. Core never loads `fs` or any other module that can
 * write to a file descriptor or a stream (the boundary check in
 * `test/boundary-rules.ts` enforces this). Core still owns every
 * authoritative read and write, but it does them through this port, which
 * the CLI layer passes in. `src/adapters/node-fs.ts` implements it with
 * `node:fs`.
 *
 * A port is bound to one allowed root. Each path is a string, relative to
 * that root or absolute inside it. The implementation refuses, with a
 * `PathRefusedError`, any target that is not a string path, a numeric file
 * descriptor, a device or special path (`/dev/...`, `/proc/...`, `/sys/...`,
 * Windows device names and `\\.\` paths, FIFOs, sockets, and device files),
 * and any path whose real path (after symlinks) is outside the root (unless
 * the port was opened with `FsPortOptions.allowOutsideRoot`, PE-010 and
 * PE-012; a content read stays inside the root in every mode).
 *
 * The port is synchronous: a BuildOS command is one short process, and the
 * Go seed it replaces reads and writes in order. Keep it minimal. Add a
 * method only when a domain port needs it.
 */

/** What a path names. Special files never reach the caller: the port refuses them. */
export type FsEntryKind = "file" | "directory";

export interface FsStat {
  kind: FsEntryKind;
  /** Permission bits (`mode & 0o777`), as Go's `FileMode.Perm`. On Windows, Node's emulated bits. */
  mode: number;
  /**
   * Permission bits with the setuid, setgid, and sticky bits (`mode &
   * 0o7777`). A write that keeps an existing file's mode where Go keeps the
   * file itself (an append in place, a rollback) uses these, so the special
   * bits stay. A replace that Go does with `Chmod(info.Mode().Perm())` uses
   * `mode`, so it drops them as Go does.
   */
  fullMode: number;
  /** Size in bytes. */
  size: number;
  /** Last modification time, in milliseconds since the Unix epoch. */
  mtimeMs: number;
}

export interface FsPort {
  /**
   * The real, absolute allowed root. Internal: output and error metadata
   * report the root as given, never this value.
   */
  readonly root: string;
  /**
   * Reads a file as UTF-8 text, as `readBytes` reads it: at most `limit`
   * bytes, else `EFBIG`.
   */
  readText(path: string, limit: number): string;
  /**
   * Reads a file as bytes, following links as Go's `os.ReadFile` does (the
   * real path must pass the port's checks). W1 R7 P7 review round 2
   * (P7-R2-02): every read has a size bound. The port opens the file once,
   * checks that the opened file is a regular file of at most `limit` bytes,
   * and reads at most `limit + 1` bytes from that one open. A larger file
   * throws `FsReadFailure` with errno `EFBIG` and `limit` set, and no byte
   * of it is kept. A folder fails as Go's read does (`EISDIR`).
   */
  readBytes(path: string, limit: number): Uint8Array;
  /**
   * Replaces a file atomically: writes a temporary file in the same folder,
   * flushes it, renames it over the target, and then flushes the parent
   * folder so the rename is durable. The parent folder must exist. As Go's
   * `os.Rename`, the rename replaces the target's folder entry: a symlink
   * there is replaced and the file it points at is kept (the path the
   * symlink resolves to need not be inside the root: no byte is written
   * there, P5 review round 1; the folder must be). A failed
   * step throws `FsWriteFailure` with the step and the OS error code; the
   * temporary file never stays behind. On Windows the folder flush is
   * skipped: Windows has no folder flush (`FlushFileBuffers` on a read-only
   * folder handle fails with `Access is denied.`), and NTFS journals the
   * rename (parity exception PE-005).
   */
  writeFileAtomic(path: string, data: string | Uint8Array, options?: AtomicWriteOptions): FsEntryId;
  /**
   * W1 R7 P6 review round 1: the identity of the folder entry at `path`, from
   * `lstat` (a link at the last name is not followed), or `undefined` when
   * nothing is there. Two calls give the same `id` only for the same entry
   * (device and inode; the file ID on Windows). A command that writes an
   * entry takes its identity right after the write, so a later undo acts
   * only on that entry. A content read: its folder stays inside the root in
   * every mode.
   */
  entryId(path: string): FsEntryId | undefined;
  /**
   * W1 R7 P6 review round 2: the identity of the entry that `path` resolves
   * to through every link, as the OS opens it, or `undefined` when it does
   * not resolve (dangling, a loop) or resolves outside the root. Never
   * throws for those cases, so a caller can tell "a link to this sibling"
   * from every other link with the OS's own link rules.
   */
  resolvedId(path: string): FsEntryId | undefined;
  /**
   * W1 R7 P6 review round 2: opens a regular file once, with no link
   * followed at its name, checks that the opened file is the entry at the
   * name (same identity as its `lstat`), and reads at most `limit` bytes
   * from that one open. A file larger than `limit` gives `tooLarge` with its
   * size and no bytes. Anything else at the name (a link, a folder, a
   * special file, a missing entry) throws: `EntryChangedError` when the name
   * no longer names the opened file, else `FsReadFailure`. A content read:
   * its folder stays inside the root in every mode.
   *
   * W1 R7 P7 review round 2 (P7-R2-02): with `followLinkInRoot`, a link at
   * the name is followed only when the path it resolves to (through every
   * link) is a regular file inside the root: that file is read with the same
   * checks, and the link must still resolve to it after the read. A link
   * that resolves outside the root, or to a device, is refused
   * (`PathRefusedError`, `outside-root`); a dangling link is missing
   * (`ENOENT`). Without the option, a link at the name throws `ELOOP`.
   */
  readFileLimited(path: string, limit: number, options?: { followLinkInRoot?: boolean }): FsLimitedRead;
  /**
   * W1 R7 P6 review round 2: can a new entry be made in the existing folder
   * `folder`, and can an entry there be replaced by a rename? The folder
   * must be inside the root and be a folder (no link at the last name is
   * followed to decide where the write lands). On POSIX, `access(W_OK |
   * X_OK)` answers as the create would (`EACCES`, `EROFS`). On Windows, Node
   * has no check of a folder's access rules (ACLs): `access` there only
   * looks at the read-only attribute, which Windows ignores on folders. So
   * on Windows only the existence and type of the folder are checked. A
   * refusal throws `FsWriteFailure` with the OS error code.
   */
  checkCanCreateIn(folder: string): void;
  /**
   * True when the entry at `path` is what `expected` says (see
   * `ExpectedEntry`), with no link followed. A file's bytes are read with a
   * bound: at most one byte more than expected. A content read, contained.
   */
  matchesEntry(path: string, expected: ExpectedEntry): boolean;
  /** Renames a file or folder. Both paths must be inside the root. */
  rename(from: string, to: string): void;
  /**
   * Creates a folder and any missing parents. An existing folder is fine.
   * With `recursive: false`, creates only this folder, and an existing entry
   * is an error (`EEXIST`), as Go's `os.Mkdir`. `mode` is the permission
   * before the umask, as Go's `perm` (default `0o777`, Node's default).
   */
  mkdir(path: string, options?: { recursive?: boolean; mode?: number }): void;
  /** The entry names in a folder, sorted by code unit. */
  list(path: string): string[];
  /** The entry kind, size, and time, or `undefined` when nothing is there. */
  stat(path: string): FsStat | undefined;
  /** True when a file or folder is there. */
  exists(path: string): boolean;
  /**
   * Go's `os.Stat`: follows symlinks. Every failure, a missing path too
   * (`ENOENT`, `ENOTDIR`), throws `FsReadFailure` with the OS error code, so
   * core can tell them apart and spell each as Go does. Metadata, as `stat`:
   * `allowOutsideRoot` applies.
   */
  statStrict(path: string): FsStat;
  /**
   * Go's `os.ReadDir`: the folder's entries sorted by name (code unit order;
   * core re-sorts by UTF-8 bytes where Go order matters), each with the
   * type of the folder entry itself. A symlink is reported as `symlink`,
   * never followed, as Go's `fs.DirEntry.IsDir` sees it. A content read:
   * contained in every mode.
   */
  readDir(path: string): FsDirEntry[];
  /**
   * Go's `os.OpenFile(path, O_CREATE|O_EXCL|O_WRONLY, mode)` and one write:
   * creates a new file, and an existing entry fails with `EEXIST` and is
   * never removed. With `sync`, also flushes the file and, after the close,
   * the parent folder (skipped on Windows, as in `writeFileAtomic`, PE-005).
   * The file is complete only after its close succeeds; any failed step,
   * the close included, removes the new file (P4-P5 merge fix round), but
   * only when its folder and the entry are still the ones it created (else
   * a `PathRefusedError` names what was left). A failed step throws
   * `FsWriteFailure`: the `syscall` is `open`, `write`, `fsync`, or
   * `close`, and the parent folder flush has step `open-parent` or
   * `sync-parent`.
   *
   * `data` may also be an iterable of chunks (a streaming copy, Go's
   * `io.Copy`, with no 2 GiB limit): each chunk is written as it comes, and a
   * failed step, or an error the iterable throws (passed through unchanged),
   * removes the new file. As `O_EXCL`, a symlink at the name is never
   * followed, so only the folder must be inside the root.
   */
  writeNewFile(path: string, data: string | Uint8Array | Iterable<Uint8Array>, options?: NewFileOptions): FsEntryId;
  /**
   * Opens a file for a streaming read (Go's `os.Open`). The path is checked
   * once, at open. A failed open throws `FsReadFailure` with `syscall`
   * `open`; a failed read throws `FsReadFailure` with `syscall` `read`.
   */
  openRead(path: string): FsReadStream;
  /**
   * Removes one entry without following it: a file, a symlink, or an empty
   * folder (`unlink`, else `rmdir`). Never recursive. Core uses it only to
   * remove what the same command created, after a failed step. With
   * `expect`, the entry is checked right before the unlink: when it is not
   * the expected one, nothing is removed and `EntryChangedError` is thrown.
   */
  remove(path: string, options?: { expect?: ExpectedEntry }): void;
  /**
   * The text of the symlink at `path` (Go's `os.Readlink`), or `undefined`
   * when the entry is not a symlink. The last name is never followed; its
   * folder must be inside the root. A missing entry throws `FsReadFailure`
   * (`ENOENT`). P5 review round 2: a rollback restores a symlink as a symlink.
   * Review round 3: also the link's own permission bits (`lstat`), so a
   * rollback can put them back where the OS keeps link modes (macOS).
   */
  readLink(path: string): FsLink | undefined;
  /**
   * Puts a symlink with the text `target` at `path` atomically: creates it at
   * a temporary name in the same folder and renames it over the entry, so a
   * file or link there is replaced, never followed. `target` is stored as
   * given: no byte is written where it points. A failed step throws
   * `FsWriteFailure`, and the temporary link is removed, but only when its
   * folder and the link are still the ones it created (P4-P5 merge fix
   * round); when either changed, nothing is removed and a
   * `PathRefusedError` names the temporary link left in place. P5 review round
   * 2: a rollback restores a symlink the command replaced. Review round 3:
   * with `mode`, the new link gets exactly those permission bits, whatever
   * the umask, where the OS can set a link's mode (macOS `lchmod`); on
   * Linux a link's mode is always 0777 and cannot be set, so it is skipped.
   * With `expect`, as `AtomicWriteOptions.expect`.
   */
  symlinkAtomic(path: string, target: string, options?: { mode?: number; expect?: ExpectedEntry }): FsEntryId;
  /**
   * Review round 3: when the entry at `path` is a regular file, opens it for
   * writing and closes it at once, with no change to its bytes or mode: the
   * permission check of Go's `os.OpenFile(path, O_WRONLY|O_APPEND|O_CREATE)`
   * (a read-only file fails with `EACCES`, or `EPERM` for the Windows
   * read-only attribute; root passes as in Go). A missing entry or a
   * symlink is not checked. The last name is never followed. A failure
   * throws `FsWriteFailure` with `syscall` `open`.
   */
  checkWritable(path: string): void;
}

/** The identity of one folder entry (see `FsPort.entryId`). */
export interface FsEntryId {
  kind: FsDirEntry["kind"];
  /** Opaque: equal text means the same entry. */
  id: string;
  /** Permission bits with setuid, setgid, and sticky (`mode & 0o7777`), from the same `lstat`. On Windows, Node's emulated bits. */
  mode: number;
  /**
   * W1 R7 P6 review round 3: the entry's hard link count (`nlink`) from the
   * same `lstat`. On Windows, Node reports the NTFS link count; a file system
   * without hard links (FAT, exFAT) and some network shares report 1.
   */
  links: number;
}

/** What `FsPort.readFileLimited` read. */
export type FsLimitedRead = { tooLarge: false; data: Uint8Array; id: string; mode: number; links: number } | { tooLarge: true; size: number };

/**
 * What a write or a removal expects at its destination right before it acts:
 * a regular file with exactly `data` (and, when given, exactly this identity,
 * these permission bits, `mode & 0o7777`, and this hard link count), a
 * symlink with exactly `target` (and, when given, this identity, the
 * link's own permission bits, where the OS keeps them, and the link's own
 * hard link count), or the exact entry
 * with this identity (`FsPort.entryId`). A missing entry never matches. An
 * entry whose identity the OS does not report (an inode number of 0) gets an
 * identity that never matches another (W1 R7 P6 review round 3), so a check
 * by identity declines instead of guessing.
 */
export type ExpectedEntry =
  | { kind: "file"; data: Uint8Array; id?: string; mode?: number; links?: number }
  | { kind: "symlink"; target: string; id?: string; mode?: number; links?: number }
  | { kind: "entry"; id: string };

/**
 * W1 R7 P6 review round 2: what a write that failed still left on disk.
 * A thrown error of `writeFileAtomic`, `writeNewFile`, or `symlinkAtomic`
 * can carry these, so the caller's undo and report see them:
 *
 * - `committed`: the write did put its entry at the destination (the
 *   rename or the create took effect) before a later step failed, such as
 *   the parent folder flush. The destination is now this entry.
 * - `leftBehind`: paths (as given to the port, with `/`) of entries the
 *   write made and could not remove, such as its temporary file.
 */
export interface WriteLeftovers {
  committed?: FsEntryId;
  leftBehind?: string[];
}

/** The leftovers a failed write attached to `error` (see `WriteLeftovers`). */
export function leftoversOf(error: unknown): WriteLeftovers {
  const tagged = error as { buildosLeftovers?: WriteLeftovers } | null;
  return typeof tagged === "object" && tagged !== null && tagged.buildosLeftovers !== undefined ? tagged.buildosLeftovers : {};
}

/** A symlink as `readLink` reports it: its text and its own permission bits. */
export interface FsLink {
  target: string;
  mode: number;
}

export interface FsReadStream {
  /** Reads up to `length` bytes; an empty array at the end of the file. */
  read(length: number): Uint8Array;
  /** Closes the file. Safe to call twice. */
  close(): void;
}

export interface NewFileOptions {
  /** Permission bits before the umask, as Go's `OpenFile` mode. Default: `0o644`. */
  mode?: number;
  /** Flush the file and its parent folder. Default: false. A failed step removes the new file either way. */
  sync?: boolean;
}

/** One folder entry, as Go's `fs.DirEntry` types it (from the entry, not its target). */
export interface FsDirEntry {
  name: string;
  kind: "file" | "directory" | "symlink" | "other";
}

export interface AtomicWriteOptions {
  /**
   * Permission bits for the new file, set with `fchmod` so the umask does
   * not apply, as Go's `File.Chmod`. When unset, the file is created with
   * `0o666` and the umask applies.
   */
  mode?: number;
  /**
   * With `mode`, set it again after the write. A write clears the setuid and
   * setgid bits (macOS, Linux), so a rollback that puts an old mode back
   * exactly sets it after the bytes are written. Default: false, so a write
   * clears them as Go's write in place does.
   */
  exactMode?: boolean;
  /**
   * The temporary file name is `<tempPrefix><random><tempSuffix>`, where
   * `<random>` is a random uint32 in decimal, as Go's `os.CreateTemp`.
   * Default: `.<name>.` and `.tmp`. The adapter creates it in the target's
   * own folder only: each part must be part of one file name (no `/`, `\`,
   * `:`, NUL, control character, or `..`), or the adapter refuses the write.
   */
  tempPrefix?: string;
  tempSuffix?: string;
  /**
   * W1 R7 P6 review round 1: what must be at the destination right before
   * the rename. The check runs after the temporary file is written and
   * closed, as the last step before the rename, so a change made earlier
   * (an editor save) stops the write. When the entry does not match, the
   * temporary file is removed, the destination is not touched, and
   * `EntryChangedError` is thrown. Node has no compare-and-rename, so a
   * change in the short time between the check and the rename is not seen
   * (`SECURITY.md`).
   */
  expect?: ExpectedEntry;
  /** Flush the parent folder after the rename (POSIX only). Default: true. */
  syncParent?: boolean;
  /**
   * When `mode` is unset: the permission bits of the new file before the
   * umask, as Go's `OpenFile` mode. Default: `0o666`.
   */
  createMode?: number;
}

/**
 * Opens a port bound to `root`, spelled as the user gave it, relative to
 * `cwd` when it is not absolute. The CLI passes one to core, so core can
 * bind a port to the root it resolves. Core passes the spelling as given, not
 * a resolved path, so the adapter checks the text before it resolves it.
 */
export type FsPortFactory = (root: string, cwd?: string, options?: FsPortOptions) => FsPort;

/** Options for the root a port is bound to. */
export interface FsPortOptions {
  /**
   * `--allow-outside-root` (parity exceptions PE-010 for intake and PE-012
   * for discovery and design): allow a path that is inside the root as
   * spelled (`..` folded as text) but whose real path (after symlinks) is
   * outside the root. Every other refusal stays (device and special paths,
   * file descriptors, a path spelled outside the root, `..` out of a
   * missing folder). A command that lets the user name a write target
   * outside the root opens a second port bound to that target's volume.
   * Default: false, so such a path is refused with `outside-root` (exit 3).
   * The option applies to write destinations and the metadata checks a
   * write needs (`stat`, `exists`, `statStrict`, as Go's `MkdirAll` does),
   * never to a content read: `readText`, `readBytes`, `openRead`, `list`,
   * `readDir`, and `readLink` stay inside the root in every mode (P5 review
   * round 2). A link at the written file itself is replaced, never followed
   * (PRD 20), so it may point anywhere.
   */
  allowOutsideRoot?: boolean;
}

/**
 * The in-place writer, a separate narrow port. Only the intake domain's
 * output code gets one (Go's `os.WriteFile` writes converted twins, side
 * artifacts, and indexes in place); canonical data keeps
 * `FsPort.writeFileAtomic`. It applies the same target checks as `FsPort`.
 */
export interface InPlaceWritePort {
  /**
   * Go's `os.WriteFile(path, data, mode)`: a new file gets `mode` less the
   * umask, and an existing regular file keeps its mode. A symlink at the
   * file itself is replaced by a new regular file, never followed (PRD 20;
   * Go follows it, PE-010), so the link's target keeps its bytes. The
   * target's folder must be inside the root (see `FsPortOptions`). The
   * adapter opens the file with `O_NOFOLLOW` and without truncating it
   * (an existing file without `O_CREAT`, a new one with `O_EXCL`), checks
   * the opened file (a regular file, one hard link, and still the entry in
   * that folder) and the folder (the same real path, device, and inode as
   * checked before the open), and only then truncates and writes. Not atomic.
   * A failed step throws
   * `FsWriteFailure` with the step (`open`, `write`, or `close`) and the OS
   * error code; a failed check throws `PathRefusedError`.
   */
  writeFileInPlace(path: string, data: Uint8Array, mode: number): void;
  /**
   * The checks `writeFileInPlace` makes, without writing: the target text,
   * its folder's real path, and the entry at its name (a symlink to a
   * device, a FIFO, socket, or device, or a regular file with more than one
   * hard link is refused). Then the open the write would do, as a probe: an
   * existing file or folder at the name is opened for writing without
   * truncating it and closed at once (a folder fails with `EISDIR`, a
   * read-only file with `EACCES`); for a new name in an existing folder, the
   * folder must allow a new entry (POSIX `access(W_OK | X_OK)`). A missing
   * folder is fine: `checkMkdir` checks the folders a command makes. The
   * intake command runs it on every destination before its first write, so
   * a command that would fail leaves no new file. Throws `PathRefusedError`
   * on a refusal, and `FsWriteFailure` (step `open`) with the OS error the
   * write's open would get.
   */
  checkInPlaceTarget(path: string): void;
  /**
   * The checks of a `mkdir(path)` that need not make it, for the same
   * preflight: the target's containment (as every port call checks it), and
   * on POSIX that its parent folder, when it exists, allows a new entry.
   * Throws `PathRefusedError` on a refusal and `FsWriteFailure` with the OS
   * error the `mkdir` would get.
   */
  checkMkdir(path: string): void;
}

/** Opens an in-place writer bound to `root`, as `FsPortFactory` does. */
export type InPlaceWritePortFactory = (root: string, cwd?: string, options?: FsPortOptions) => InPlaceWritePort;
