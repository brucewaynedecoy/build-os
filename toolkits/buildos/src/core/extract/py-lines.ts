/**
 * How `work.py` counted the lines and rows of a converted file, opened with
 * `encoding="utf-8", newline=""` (W1 R7 P9 t4): a text file counts its
 * lines (a line ends at `\n`, `\r\n`, or `\r`); a CSV file counts the
 * records of Python's `csv.reader` (the excel dialect, not strict), where a
 * quoted field may hold line breaks and a field longer than 131,072
 * characters is `csv.Error`. Also `PurePath.suffix`, as Python 3.14 reads it.
 */

import { PyException } from "../shared/py-text.ts";

/** The number of lines Python's text stream gives. */
export function pyLineCount(text: string): number {
  let count = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const next = text.slice(i).search(/\r\n|\r|\n/);
    if (next === -1) {
      count++;
      break;
    }
    i += next + (text.startsWith("\r\n", i + next) ? 2 : 1);
    count++;
  }
  return count;
}

const FIELD_LIMIT = 131072;

type State = "startRecord" | "startField" | "inField" | "inQuoted" | "quoteInQuoted" | "eatCrnl";

/** The number of records `csv.reader` gives. Throws `PyException("Error", ...)` as `csv.Error`. */
export function pyCsvRowCount(text: string): number {
  return pyCsvRows(text).length;
}

/** The records of Python's `csv.reader` (excel dialect, not strict) over a text opened with `newline=""`. */
export function pyCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let state: State = "startRecord";
  let field: string[] = [];
  let fields: string[] = [];
  let pending = false;
  const add = (c: string): void => {
    if (field.length >= FIELD_LIMIT) throw new PyException("Error", `field larger than field limit (${FIELD_LIMIT})`);
    field.push(c);
  };
  const save = (): void => {
    fields.push(field.join(""));
    field = [];
  };
  const EOL = "";
  const startField = (c: string): void => {
    if (c === "\n" || c === "\r" || c === EOL) {
      save();
      state = c === EOL ? "startRecord" : "eatCrnl";
    } else if (c === '"') state = "inQuoted";
    else if (c === ",") save();
    else {
      add(c);
      state = "inField";
    }
  };
  const step = (c: string): void => {
    switch (state) {
      case "startRecord":
        if (c === EOL) return;
        if (c === "\n" || c === "\r") {
          state = "eatCrnl";
          return;
        }
        state = "startField";
        startField(c);
        return;
      case "startField":
        startField(c);
        return;
      case "inField":
        if (c === "\n" || c === "\r" || c === EOL) {
          save();
          state = c === EOL ? "startRecord" : "eatCrnl";
        } else if (c === ",") {
          save();
          state = "startField";
        } else add(c);
        return;
      case "inQuoted":
        if (c === EOL) return;
        if (c === '"') state = "quoteInQuoted";
        else add(c);
        return;
      case "quoteInQuoted":
        if (c === '"') {
          add(c);
          state = "inQuoted";
        } else if (c === ",") {
          save();
          state = "startField";
        } else if (c === "\n" || c === "\r" || c === EOL) {
          save();
          state = c === EOL ? "startRecord" : "eatCrnl";
        } else {
          add(c);
          state = "inField";
        }
        return;
      case "eatCrnl":
        if (c === "\n" || c === "\r") return;
        if (c === EOL) {
          state = "startRecord";
          return;
        }
        throw new PyException("Error", "new-line character seen in unquoted field - do you need to open the file with newline=''?");
    }
  };
  for (const line of splitKeepEnds(text)) {
    pending = true;
    for (const c of line) step(c);
    step(EOL);
    if (state === "startRecord") {
      rows.push(fields);
      fields = [];
      pending = false;
    }
  }
  const last = state as State;
  if (pending && (field.length !== 0 || last === "inQuoted")) {
    save();
    rows.push(fields);
  }
  return rows;
}

function splitKeepEnds(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    } else if (c === "\r") {
      const end = text[i + 1] === "\n" ? i + 2 : i + 1;
      out.push(text.slice(start, end));
      start = end;
      i = end - 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

/** `PurePosixPath(path).name`. */
export function pyName(path: string): string {
  const parts = path.split("/").filter((part) => part !== "" && part !== ".");
  return parts.length === 0 ? "" : parts[parts.length - 1]!;
}

/** `PurePath.suffix` (Python 3.14). */
export function pySuffix(path: string): string {
  const name = pyName(path);
  const i = name.lastIndexOf(".");
  if (i === -1) return "";
  const stem = name.slice(0, i);
  return stem.replace(/^\.+/, "") === "" ? "" : name.slice(i);
}

/** `PurePath.stem` (Python 3.14). */
export function pyStem(path: string): string {
  const name = pyName(path);
  const suffix = pySuffix(path);
  return suffix === "" ? name : name.slice(0, name.length - suffix.length);
}
