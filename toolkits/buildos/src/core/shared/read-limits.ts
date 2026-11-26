import { ContractError } from "./errors.ts";

/**
 * W1 R7 P7 review round 2 (P7-R2-02): the size bound of every file read in
 * core. Each read names one of these; the port refuses a larger file with
 * `EFBIG` before it keeps a byte of it (`FsPort.readBytes`). Each bound is far
 * above what a real project file needs. `SECURITY.md` (Read Safety) lists
 * them with the read sites.
 */

const MiB = 1024 * 1024;

export const READ_LIMITS = {
  /** A canonical JSONL dataset, a JSON index, or an entity consolidation manifest (the same bound as `buildos validate`). */
  data: 128 * MiB,
  /** A Markdown record or document that discovery and design read whole: a finding record, a qualification file, evidence, a raw finding source. */
  document: 64 * MiB,
  /** A Make Docs design input (router, workflow, contract, template, prompt): the bound `buildos validate` uses for one Markdown file. */
  makeDocsInput: 4 * MiB,
  /** One intake source file, a file of an HTML folder, a converted twin, or an intake index. Each format's own limits apply after the read (`SECURITY.md` Intake Input Limits). */
  intake: 512 * MiB,
} as const;

/** A byte count in plain words: `128 MiB`, else bytes. */
export function formatLimit(bytes: number): string {
  return bytes % MiB === 0 ? `${bytes / MiB} MiB` : `${bytes} bytes`;
}

/**
 * W1 R7 P7 review round 3 (P7-R3-04): a file BuildOS writes and must read
 * back later (an index, a dataset, a record) may not be larger than the
 * bound its reader uses, or the next command could not read it. Each writer
 * checks the size of what it would write before its first write and, when
 * it is too large, stops with this error (exit 4, `file_too_large_to_read_back`)
 * and writes nothing.
 */
export function readBackRefusal(displayPath: string, size: number, limit: number, root?: string): ContractError {
  return new ContractError(
    `${displayPath} would be ${size} bytes, more than the ${formatLimit(limit)} BuildOS reads from one such file, so later commands could not read it. BuildOS wrote nothing.`,
    {
      code: "file_too_large_to_read_back",
      correction: `Make ${displayPath} smaller first (for example, move old entries to a file of their own), then run this command again.`,
      ...(root === undefined ? {} : { root }),
    },
  );
}

/** Throws `readBackRefusal` when `size` is over `limit`. */
export function checkReadBack(displayPath: string, size: number, limit: number, root?: string): void {
  if (size > limit) throw readBackRefusal(displayPath, size, limit, root);
}

/**
 * W1 R7 P7 review round 4 (P7-R4-02): the most bytes one JSONL row may have,
 * per reader. A reader that scans lines (Go's `bufio.Scanner` parity) cannot
 * read a line of `limit` bytes or more (the bytes before the line feed,
 * a carriage return included).
 *
 * - `scanner`: `discovery run discovery` and `discovery qualify finding` read
 *   `.os/data/runs.jsonl` and `.os/data/findings.jsonl` this way (the next
 *   ID, the run's scope), and `design promote finding` reads
 *   `.os/data/findings.jsonl` this way: 64 KiB, Go's default token size.
 * - `entityGraph`: every `entities` command and the entity graph that
 *   discovery and design load read each governed dataset with a 16 MiB
 *   token.
 */
export const JSONL_ROW_LIMITS = { scanner: 64 * 1024, entityGraph: 16 * MiB } as const;

/** The row limit of a governed dataset: the scanner limit for the two files discovery and design scan, else the entity graph's. */
export function jsonlRowLimit(filename: string): number {
  return filename === "runs.jsonl" || filename === "findings.jsonl" ? JSONL_ROW_LIMITS.scanner : JSONL_ROW_LIMITS.entityGraph;
}

/** The refusal for a row its reader could not read (exit 4, `row_too_long_to_read_back`); nothing is written. */
export function rowTooLongRefusal(displayPath: string, where: string, size: number, limit: number, root?: string): ContractError {
  return new ContractError(
    `${displayPath}: ${where} would be ${size} bytes, and BuildOS reads at most ${limit - 1} bytes in one line of this file, so later commands could not read it. BuildOS wrote nothing.`,
    {
      code: "row_too_long_to_read_back",
      correction: `Make the record shorter first (for example, a shorter title or fewer references), then run this command again.`,
      ...(root === undefined ? {} : { root }),
    },
  );
}

/** Throws `rowTooLongRefusal` when one row (its bytes before the line feed) is `limit` bytes or more. */
export function checkRowReadBack(displayPath: string, where: string, rowBytes: number, limit: number, root?: string): void {
  if (rowBytes >= limit) throw rowTooLongRefusal(displayPath, where, rowBytes, limit, root);
}

/** Checks every line of a whole JSONL file BuildOS is about to write; the first line that is too long throws. */
export function checkRowsReadBack(displayPath: string, data: Uint8Array, limit: number, root?: string): void {
  let at = 0;
  let line = 0;
  while (at < data.length) {
    let end = data.indexOf(0x0a, at);
    if (end === -1) end = data.length;
    line += 1;
    checkRowReadBack(displayPath, `line ${line}`, end - at, limit, root);
    at = end + 1;
  }
}
