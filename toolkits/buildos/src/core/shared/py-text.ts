/**
 * Python text reading and error texts for the skill-script ports (W1 R7
 * P9): strict UTF-8 decoding with Python's `UnicodeDecodeError` text, and
 * the `OSError` text (`[Errno 2] No such file or directory: '<path>'`) that
 * the scripts print. Errno numbers are the POSIX ones the goldens were
 * captured with (macOS); `ELOOP` differs by system, so it uses this one.
 */

import { pyStrRepr } from "./py-json.ts";

/** A Python exception the scripts catch or let through: its class and `str(exc)`. */
export class PyException extends Error {
  readonly pyClass: string;
  /** For an `OSError`: the failed operation was a write. */
  readonly forWrite: boolean;
  constructor(pyClass: string, message: string, forWrite = false) {
    super(message);
    this.name = pyClass;
    this.pyClass = pyClass;
    this.forWrite = forWrite;
  }
}

/** `ValueError(message)`. */
export function valueError(message: string): PyException {
  return new PyException("ValueError", message);
}

/** `KeyError(key)`: `str()` is the key's repr. */
export function keyError(key: string): PyException {
  return new PyException("KeyError", pyStrRepr(key));
}

/** `TypeError(message)`. */
export function typeError(message: string): PyException {
  return new PyException("TypeError", message);
}

const ERRNO: Record<string, [number, string, string]> = {
  ENOENT: [2, "FileNotFoundError", "No such file or directory"],
  EACCES: [13, "PermissionError", "Permission denied"],
  EPERM: [1, "PermissionError", "Operation not permitted"],
  EEXIST: [17, "FileExistsError", "File exists"],
  ENOTDIR: [20, "NotADirectoryError", "Not a directory"],
  EISDIR: [21, "IsADirectoryError", "Is a directory"],
  ENOSPC: [28, "OSError", "No space left on device"],
  EROFS: [30, "OSError", "Read-only file system"],
  ELOOP: [process.platform === "linux" ? 40 : 62, "OSError", "Too many levels of symbolic links"],
};

/** Python's `OSError` for `errno` on `path`: `[Errno 2] No such file or directory: '<path>'`. */
export function osError(errno: string | undefined, path: string, forWrite = false): PyException {
  const known = errno === undefined ? undefined : ERRNO[errno];
  if (known === undefined) return new PyException("OSError", `[Errno ?] ${errno ?? "unknown error"}: ${pyStrRepr(path)}`, forWrite);
  return new PyException(known[1], `[Errno ${known[0]}] ${known[2]}: ${pyStrRepr(path)}`, forWrite);
}

/**
 * `bytes.decode("utf-8")`, strict: the text, or Python's `UnicodeDecodeError`
 * (`'utf-8' codec can't decode byte 0xff in position 0: invalid start byte`).
 * A byte order mark is kept as U+FEFF, as the `utf-8` codec keeps it.
 */
export function pyDecodeUtf8(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data);
  } catch {
    throw new PyException("UnicodeDecodeError", utf8ErrorText(data));
  }
}

function utf8ErrorText(data: Uint8Array): string {
  let i = 0;
  while (i < data.length) {
    const b = data[i]!;
    if (b < 0x80) {
      i++;
      continue;
    }
    let need: number;
    let lo = 0x80;
    let hi = 0xbf;
    if (b >= 0xc2 && b <= 0xdf) need = 1;
    else if (b >= 0xe0 && b <= 0xef) {
      need = 2;
      if (b === 0xe0) lo = 0xa0;
      if (b === 0xed) hi = 0x9f;
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3;
      if (b === 0xf0) lo = 0x90;
      if (b === 0xf4) hi = 0x8f;
    } else return decodeError(data, i, i + 1, "invalid start byte");
    let j = 1;
    for (; j <= need; j++) {
      if (i + j >= data.length) return decodeError(data, i, data.length, "unexpected end of data");
      const c = data[i + j]!;
      const min = j === 1 ? lo : 0x80;
      const max = j === 1 ? hi : 0xbf;
      if (c < min || c > max) return decodeError(data, i, i + j, "invalid continuation byte");
    }
    i += need + 1;
  }
  return "'utf-8' codec can't decode the data";
}

function decodeError(data: Uint8Array, start: number, end: number, reason: string): string {
  if (end - start === 1) return `'utf-8' codec can't decode byte 0x${data[start]!.toString(16).padStart(2, "0")} in position ${start}: ${reason}`;
  return `'utf-8' codec can't decode bytes in position ${start}-${end - 1}: ${reason}`;
}
