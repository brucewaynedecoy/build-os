/**
 * Go `strconv.Quote` (`%q`) and `strconv.IsPrint`, ported so that every
 * quoted value in output and errors matches the Go seed byte for byte. Core
 * and the CLI both use it. It reads no disk and writes nothing.
 */

import { GO_ISPRINT_TABLES } from "./go-isprint.ts";

let goTables: { print16: number[]; notPrint16: number[]; print32: number[]; notPrint32: number[] } | undefined;

/** Decodes one base-36 delta table from go-isprint.ts. */
function decodeGoTable(encoded: string): number[] {
  let value = 0;
  return encoded.split(",").map((delta) => (value += parseInt(delta, 36)));
}

/** The first index whose entry is at least `x`, as Go's strconv bsearch. */
function lowerBound(table: readonly number[], x: number): number {
  let low = 0;
  let high = table.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (table[mid]! < x) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Go `strconv.IsPrint`, with the tables of the Go release the seed was built
 * with (see go-isprint.ts), so a character newer than that Unicode version is
 * escaped as Go escapes it. Ported from `IsPrint` and `bsearch` in Go 1.24.1
 * `src/strconv/quote.go`, Copyright 2009 The Go Authors, BSD-3-Clause; see
 * THIRD_PARTY_NOTICES.md.
 */
export function goIsPrint(code: number): boolean {
  if (code <= 0xff) {
    if (code >= 0x20 && code <= 0x7e) return true;
    if (code >= 0xa1 && code <= 0xff) return code !== 0xad;
    return false;
  }
  goTables ??= {
    print16: decodeGoTable(GO_ISPRINT_TABLES.isPrint16),
    notPrint16: decodeGoTable(GO_ISPRINT_TABLES.isNotPrint16),
    print32: decodeGoTable(GO_ISPRINT_TABLES.isPrint32),
    notPrint32: decodeGoTable(GO_ISPRINT_TABLES.isNotPrint32),
  };
  const inRange = (table: readonly number[], x: number) => {
    const i = lowerBound(table, x);
    return i < table.length && x >= table[i & ~1]! && x <= table[i | 1]!;
  };
  const listed = (table: readonly number[], x: number) => table[lowerBound(table, x)] === x;
  if (code < 0x10000) return inRange(goTables.print16, code) && !listed(goTables.notPrint16, code);
  if (!inRange(goTables.print32, code)) return false;
  if (code >= 0x20000) return true;
  return !listed(goTables.notPrint32, code - 0x10000);
}

/** Go `%q` (`strconv.Quote`) for a string. */
export function goQuote(text: string): string {
  let out = '"';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    switch (char) {
      case '"':
        out += '\\"';
        continue;
      case "\\":
        out += "\\\\";
        continue;
      case "\x07":
        out += "\\a";
        continue;
      case "\b":
        out += "\\b";
        continue;
      case "\f":
        out += "\\f";
        continue;
      case "\n":
        out += "\\n";
        continue;
      case "\r":
        out += "\\r";
        continue;
      case "\t":
        out += "\\t";
        continue;
      case "\v":
        out += "\\v";
        continue;
    }
    if (goIsPrint(code)) {
      out += char;
    } else if (code < 0x20 || code === 0x7f) {
      out += `\\x${code.toString(16).padStart(2, "0")}`;
    } else if (code >= 0xd800 && code <= 0xdfff) {
      // A lone surrogate cannot come from valid UTF-8 argv; Go prints U+FFFD.
      out += "\\ufffd";
    } else if (code < 0x10000) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
    } else {
      out += `\\U${code.toString(16).padStart(8, "0")}`;
    }
  }
  return `${out}"`;
}
