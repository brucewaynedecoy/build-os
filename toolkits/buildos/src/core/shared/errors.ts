/**
 * Typed errors returned by the core.
 *
 * The core throws these errors and never chooses an exit code. The CLI maps
 * each kind to a code in `src/cli/exit-codes.ts`.
 */

import type { Diagnostic } from "./diagnostics.ts";
import type { WriteStatus } from "./envelope.ts";

export type CoreErrorKind =
  | "input"
  | "contract"
  | "io"
  | "canonical-applied-index-failed"
  | "needs-operator-review";

export interface CoreErrorOptions {
  /** Stable diagnostic code, for example `root_not_found`. */
  code: string;
  /** Plain next step for the operator. */
  correction?: string;
  /** Extra diagnostics. When empty, one diagnostic is built from the error. */
  diagnostics?: Diagnostic[];
  /** Root the command resolved before it failed, when known. */
  root?: string;
  /** Write status at the point of failure. Defaults per kind. */
  writeStatus?: WriteStatus;
  cause?: unknown;
}

/** Base class for every typed core error. */
export class CoreError extends Error {
  readonly kind: CoreErrorKind;
  readonly code: string;
  readonly correction: string | undefined;
  readonly diagnostics: Diagnostic[];
  readonly root: string | undefined;
  readonly writeStatus: WriteStatus;

  constructor(kind: CoreErrorKind, message: string, options: CoreErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "CoreError";
    this.kind = kind;
    this.code = options.code;
    this.correction = options.correction;
    this.root = options.root;
    this.writeStatus =
      options.writeStatus ??
      (kind === "canonical-applied-index-failed" ? "canonical_applied_index_failed" : "not_requested");
    const base: Diagnostic = { code: options.code, severity: "error", message };
    if (options.correction !== undefined) {
      base.correction = options.correction;
    }
    this.diagnostics =
      options.diagnostics !== undefined && options.diagnostics.length > 0 ? options.diagnostics : [base];
  }
}

/** The root or a required input cannot be loaded or parsed. */
export class InputError extends CoreError {
  constructor(message: string, options: CoreErrorOptions) {
    super("input", message, options);
    this.name = "InputError";
  }
}

/** A contract, validation, graph, or reviewed-remap conflict. */
export class ContractError extends CoreError {
  constructor(message: string, options: CoreErrorOptions) {
    super("contract", message, options);
    this.name = "ContractError";
  }
}

/** An I/O or canonical-write failure stopped a valid write from committing. */
export class WriteError extends CoreError {
  constructor(message: string, options: CoreErrorOptions) {
    super("io", message, options);
    this.name = "WriteError";
  }
}

/** A canonical write committed, but the derived index rebuild failed. */
export class IndexRebuildError extends CoreError {
  constructor(message: string, options: CoreErrorOptions) {
    super("canonical-applied-index-failed", message, options);
    this.name = "IndexRebuildError";
  }
}

/** The command needs operator review before it can continue. */
export class NeedsOperatorReviewError extends CoreError {
  constructor(message: string, options: CoreErrorOptions) {
    super("needs-operator-review", message, options);
    this.name = "NeedsOperatorReviewError";
  }
}

/**
 * W1 R7 P6 review round 1: a write or a removal found an entry other than
 * the one it expected (`ExpectedEntry`), so it did nothing. The entry
 * changed while the command ran.
 */
export class EntryChangedError extends NeedsOperatorReviewError {
  readonly path: string;

  constructor(path: string, options: { root?: string } = {}) {
    super(`${path} changed while BuildOS was working, so BuildOS did not change it`, {
      code: "entry_changed",
      correction: "Check the file, then run the command again.",
      ...(options.root === undefined ? {} : { root: options.root }),
    });
    this.name = "EntryChangedError";
    this.path = path;
  }
}

/** Why the filesystem port refused a target. */
export type PathRefusalReason = "not-a-path" | "file-descriptor" | "device-path" | "special-file" | "outside-root";

/**
 * The filesystem port refused a target: not a string path, a file
 * descriptor, a device or special path, or a path outside the allowed root.
 * It is an input error, so the CLI maps it to exit code 3.
 */
export class PathRefusedError extends InputError {
  readonly reason: PathRefusalReason;
  /** W1 R7 P7 review round 2: true when a read (a link at a file BuildOS reads) was refused, not a write. */
  readonly forRead: boolean;

  constructor(reason: PathRefusalReason, message: string, options: { root?: string; forRead?: boolean } = {}) {
    super(message, {
      code: "path_refused",
      correction: "Use a file or folder path inside the BuildOS root.",
      ...(options.root === undefined ? {} : { root: options.root }),
    });
    this.name = "PathRefusedError";
    this.reason = reason;
    this.forRead = options.forRead === true;
  }
}

/**
 * What the filesystem port saw when a read or a write failed: the OS error
 * code, so core can spell the error as the Go seed does (`open <path>: no
 * such file or directory`). Core never sees a raw `node:fs` error.
 */
export interface FsFailureDetail {
  /** The Node error code, for example `ENOENT`, `ENOTDIR`, or `EACCES`. */
  errno: string;
  /** The system call that failed, for example `open` or `read`, when known. */
  syscall?: string;
  /**
   * The step of an atomic write that failed: `create-temp`, `chmod`,
   * `write`, `sync`, `close`, `rename`, `open-parent`, or `sync-parent`.
   */
  step?: AtomicWriteStep;
  /** The file name (not the path) of the atomic write's temporary file: the name it tried to create, for a `create-temp` failure. */
  tempName?: string;
  /** `create-temp` only: every one of Go's 10000 random names already existed (Go: `createtemp <dir>/<prefix>*<suffix>: file already exists`). */
  tempExhausted?: boolean;
  /**
   * Windows only: the folder that holds the target is missing or is not a
   * folder, so Windows reports `ERROR_PATH_NOT_FOUND`, not
   * `ERROR_FILE_NOT_FOUND`. libuv reports both as `ENOENT`.
   */
  parentMissing?: boolean;
  /** `EFBIG` from a bounded read (W1 R7 P7 review round 2): the byte limit the file passed. */
  limit?: number;
}

/** A step of an atomic write, or `open` of an in-place write (`writeFile`, which also uses `write` and `close`). */
export type AtomicWriteStep = "create-temp" | "chmod" | "write" | "sync" | "close" | "rename" | "open-parent" | "sync-parent" | "open";

/** A filesystem read failed (exit code 3). `fs` says how, for Go-style text. */
export class FsReadFailure extends InputError {
  readonly fs: FsFailureDetail;

  constructor(message: string, options: CoreErrorOptions & { fs: FsFailureDetail }) {
    super(message, options);
    this.name = "FsReadFailure";
    this.fs = options.fs;
  }
}

/** A filesystem write failed (exit code 5). `fs` says how, for Go-style text. */
export class FsWriteFailure extends WriteError {
  readonly fs: FsFailureDetail;

  constructor(message: string, options: CoreErrorOptions & { fs: FsFailureDetail }) {
    super(message, options);
    this.name = "FsWriteFailure";
    this.fs = options.fs;
  }
}

export function isCoreError(value: unknown): value is CoreError {
  return value instanceof CoreError;
}
