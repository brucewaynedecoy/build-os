/**
 * Go 1.24.1 `encoding/csv`, as the Go intake tool uses it: a `Reader` with
 * `FieldsPerRecord = -1` and `ReadAll`, and a `Writer` with the defaults
 * (comma `,`, LF line ends). It works on bytes, as Go does, so a field with
 * bytes that are not UTF-8 is copied through unchanged.
 */

import { goDecodeRune, goIsSpace } from "../../shared/go-json.ts";
import { GoError } from "../../shared/go-fs.ts";

const NL = 0x0a;
const CR = 0x0d;
const QUOTE = 0x22;
const COMMA = 0x2c;

const ERR_BARE_QUOTE = 'bare " in non-quoted-field';
const ERR_QUOTE = 'extraneous or missing " in quoted-field';

/** Go `csv.ParseError.Error`. */
function parseError(startLine: number, line: number, column: number, err: string): GoError {
  if (startLine !== line) return new GoError(`record on line ${startLine}; parse error on line ${line}, column ${column}: ${err}`);
  return new GoError(`parse error on line ${line}, column ${column}: ${err}`);
}

class LineReader {
  private offset = 0;
  numLine = 0;
  private readonly data: Uint8Array;
  constructor(data: Uint8Array) {
    this.data = data;
  }

  /** Go `Reader.readLine`: one line with its `\n`, `\r\n` folded to `\n`; `eof` when nothing is left. */
  readLine(): { line: Uint8Array; eof: boolean } {
    const start = this.offset;
    if (start >= this.data.length) {
      this.numLine++; // Go counts the read that hits EOF too.
      return { line: new Uint8Array(0), eof: true };
    }
    let end = this.data.indexOf(NL, start);
    let atEof = false;
    if (end === -1) {
      end = this.data.length;
      atEof = true;
    } else {
      end += 1;
    }
    this.offset = end;
    let line = this.data.slice(start, end);
    // For backwards compatibility, Go drops a trailing \r before EOF.
    if (atEof && line.length > 0 && line[line.length - 1] === CR) line = line.slice(0, -1);
    this.numLine++;
    const n = line.length;
    if (n >= 2 && line[n - 2] === CR && line[n - 1] === NL) {
      const folded = line.slice(0, n - 1);
      folded[n - 2] = NL;
      line = folded;
    }
    return { line, eof: false };
  }
}

const lengthNL = (b: Uint8Array) => (b.length > 0 && b[b.length - 1] === NL ? 1 : 0);

/** Go `Reader.ReadAll` with `FieldsPerRecord = -1`. Throws a `GoError` with Go's text. */
export function readCsv(data: Uint8Array): Uint8Array[][] {
  const r = new LineReader(data);
  const records: Uint8Array[][] = [];
  for (;;) {
    let line: Uint8Array = new Uint8Array(0);
    let eof = false;
    for (;;) {
      ({ line, eof } = r.readLine());
      if (!eof && line.length === lengthNL(line)) continue; // skip empty lines
      break;
    }
    if (eof) return records;
    const recLine = r.numLine;
    const fields: Uint8Array[] = [];
    let field: number[] = [];
    let pos = { line: r.numLine, col: 1 };
    parse: for (;;) {
      if (line.length === 0 || line[0] !== QUOTE) {
        const i = line.indexOf(COMMA);
        const text = i >= 0 ? line.slice(0, i) : line.slice(0, line.length - lengthNL(line));
        const j = text.indexOf(QUOTE);
        if (j >= 0) throw parseError(recLine, r.numLine, pos.col + j, ERR_BARE_QUOTE);
        fields.push(text);
        if (i >= 0) {
          line = line.slice(i + 1);
          pos = { line: pos.line, col: pos.col + i + 1 };
          continue parse;
        }
        break parse;
      }
      // Quoted field.
      line = line.slice(1);
      pos = { line: pos.line, col: pos.col + 1 };
      field = [];
      for (;;) {
        const i = line.indexOf(QUOTE);
        if (i >= 0) {
          for (let k = 0; k < i; k++) field.push(line[k]!);
          line = line.slice(i + 1);
          pos = { line: pos.line, col: pos.col + i + 1 };
          const next = line.length > 0 ? goDecodeRune(line, 0)[0] : -1;
          if (next === QUOTE) {
            field.push(QUOTE);
            line = line.slice(1);
            pos = { line: pos.line, col: pos.col + 1 };
          } else if (next === COMMA) {
            line = line.slice(1);
            pos = { line: pos.line, col: pos.col + 1 };
            fields.push(Uint8Array.from(field));
            continue parse;
          } else if (lengthNL(line) === line.length) {
            fields.push(Uint8Array.from(field));
            break parse;
          } else {
            throw parseError(recLine, r.numLine, pos.col - 1, ERR_QUOTE);
          }
        } else if (line.length > 0) {
          // The field goes on past the line end: read the next line. At EOF
          // the next read is empty, and the branch below reports the quote.
          for (const b of line) field.push(b);
          pos = { line: pos.line, col: pos.col + line.length };
          line = r.readLine().line;
          if (line.length > 0) pos = { line: pos.line + 1, col: 1 };
        } else {
          throw parseError(recLine, pos.line, pos.col, ERR_QUOTE);
        }
      }
    }
    records.push(fields);
  }
}

/** Go `Writer.fieldNeedsQuotes` for comma `,`. */
function needsQuotes(field: Uint8Array): boolean {
  if (field.length === 0) return false;
  if (field.length === 2 && field[0] === 0x5c && field[1] === 0x2e) return true; // `\.`
  for (const c of field) if (c === NL || c === CR || c === QUOTE || c === COMMA) return true;
  return goIsSpace(goDecodeRune(field, 0)[0]);
}

/** Go `Writer.WriteAll` with the defaults: each record, then `\n`. */
export function writeCsv(records: readonly (readonly Uint8Array[])[]): Uint8Array {
  const w = new CsvWriter();
  for (const record of records) w.write(record);
  return w.bytes();
}

const EMPTY = new Uint8Array(0);

/** Go `csv.Writer`: records written one at a time into a growing byte buffer. */
export class CsvWriter {
  private buf = new Uint8Array(1024);
  private len = 0;
  private readonly maxBytes: number;
  private readonly tooLarge: () => Error;

  /** `maxBytes`: the most bytes the CSV may hold; one more throws `tooLarge()`. */
  constructor(maxBytes = Number.POSITIVE_INFINITY, tooLarge: () => Error = () => new RangeError("CSV too large")) {
    this.maxBytes = maxBytes;
    this.tooLarge = tooLarge;
  }

  private push(b: number): void {
    if (this.len >= this.maxBytes) throw this.tooLarge();
    if (this.len === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.len++] = b;
  }

  /** Go `Writer.Write(record)`. */
  write(record: readonly Uint8Array[]): void {
    record.forEach((field, n) => {
      if (n > 0) this.push(COMMA);
      if (!needsQuotes(field)) {
        for (const b of field) this.push(b);
        return;
      }
      this.push(QUOTE);
      for (const b of field) {
        if (b === QUOTE) {
          this.push(QUOTE);
          this.push(QUOTE);
        } else this.push(b);
      }
      this.push(QUOTE);
    });
    this.push(NL);
  }

  /** Go `Writer.Write` of a record of text fields; an empty field allocates nothing. */
  writeText(record: readonly string[]): void {
    this.write(record.map((field) => (field === "" ? EMPTY : utf8Encoder.encode(field))));
  }

  bytes(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

const utf8Encoder = new TextEncoder();
