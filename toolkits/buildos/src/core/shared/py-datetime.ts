/**
 * Python's `datetime.fromisoformat` (the C `_datetime` module, Python 3.11
 * and later), as a yes or no: does the text parse? `work.py` calls it in
 * `is_date` (with `Z` read as `+00:00`). Forms: `YYYY-MM-DD`, `YYYYMMDD`,
 * ISO week dates (`YYYY-Www`, `YYYY-Www-D`, `YYYYWww`, `YYYYWwwD`), then any
 * one character and a time: `HH`, `HH:MM`, `HH:MM:SS`, a fraction after `.`
 * or `,`, the compact `HHMMSS`, and an offset `Z`, `+HH`, `+HH:MM`,
 * `+HHMM`, `+HH:MM:SS[.f]`. `24:00` is midnight of the next day. The values
 * must be in range (year 1 to 9999). `test/golden/skills/py-tables.json`
 * holds Python's answers for the parity test.
 */

function digits(s: string, at: number, n: number): number | undefined {
  if (at + n > s.length) return undefined;
  let v = 0;
  for (let i = at; i < at + n; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x30 || c > 0x39) return undefined;
    v = v * 10 + (c - 0x30);
  }
  return v;
}

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= "0" && ch <= "9";

/** `_find_isoformat_datetime_separator`, on the UTF-8 bytes as a binary string. */
function separatorAt(s: string): number {
  const n = s.length;
  if (n === 7) return 7;
  if (s[4] === "-") {
    if (s[5] === "W") {
      if (n < 8) return -1;
      if (n > 8 && s[8] === "-") {
        if (n === 9) return -1;
        if (n > 10 && isDigit(s[10])) return 8;
        return 10;
      }
      return 8;
    }
    return 10;
  }
  if (s[4] === "W") {
    let idx = 7;
    while (idx < n && isDigit(s[idx])) idx++;
    if (idx < 9) return idx;
    return idx % 2 === 0 ? 7 : 8;
  }
  return 8;
}

function daysInMonth(y: number, m: number): number {
  return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

function isoToYmd(year: number, week: number, day: number): [number, number, number] | undefined {
  if (week <= 0 || week >= 53) {
    let outOfRange = true;
    if (week === 53) {
      const first = new Date(Date.UTC(year, 0, 1)).getUTCDay();
      const isoFirst = first === 0 ? 7 : first;
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      if (isoFirst === 4 || (isoFirst === 3 && leap)) outOfRange = false;
    }
    if (outOfRange) return undefined;
  }
  if (day <= 0 || day >= 8) return undefined;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  if (year < 100) jan4.setUTCFullYear(year);
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const ms = jan4.getTime() + ((week - 1) * 7 + (day - 1) - (jan4Day - 1)) * 86_400_000;
  const d = new Date(ms);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function parseDate(s: string, len: number): [number, number, number] | undefined {
  let p = 0;
  const year = digits(s, p, 4);
  if (year === undefined) return undefined;
  p = 4;
  const sep = s[p] === "-";
  if (sep) p++;
  if (s[p] === "W") {
    p++;
    const week = digits(s, p, 2);
    if (week === undefined) return undefined;
    p += 2;
    let day = 1;
    if (p < len) {
      if (sep && s[p++] !== "-") return undefined;
      const d = digits(s, p, 1);
      if (d === undefined) return undefined;
      day = d;
    }
    return isoToYmd(year, week, day);
  }
  const month = digits(s, p, 2);
  if (month === undefined) return undefined;
  p += 2;
  if (sep && s[p++] !== "-") return undefined;
  const day = digits(s, p, 2);
  if (day === undefined) return undefined;
  return [year, month, day];
}

/** `parse_hh_mm_ss_ff`: the fields, or undefined. */
function parseHms(s: string): [number, number, number, number] | undefined {
  const parts = [0, 0, 0];
  let p = 0;
  let hasSep: boolean | undefined;
  for (let i = 0; i < 3; i++) {
    const v = digits(s, p, 2);
    if (v === undefined) return undefined;
    parts[i] = v;
    p += 2;
    if (p >= s.length) return [parts[0]!, parts[1]!, parts[2]!, 0];
    const c = s[p];
    if (c === ":") {
      if (hasSep === false) return undefined;
      hasSep = true;
      p++;
    } else if (hasSep === true) {
      if (i < 2) return undefined;
      break;
    } else {
      hasSep = false;
    }
    if (i === 2) break;
    if (c === "." || c === ",") {
      if (i < 2) return undefined;
    }
  }
  if (p >= s.length) return [parts[0]!, parts[1]!, parts[2]!, 0];
  const c = s[p];
  if (c !== "." && c !== ",") return undefined;
  p++;
  let n = 0;
  let us = 0;
  while (p < s.length && isDigit(s[p])) {
    if (n < 6) us = us * 10 + (s.charCodeAt(p) - 0x30);
    n++;
    p++;
  }
  if (n === 0 || p !== s.length) return undefined;
  for (let k = n; k < 6; k++) us *= 10;
  return [parts[0]!, parts[1]!, parts[2]!, us];
}

function parseTime(s: string): { h: number; m: number; sec: number; us: number } | undefined {
  let end = s.length;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "+" || s[i] === "-" || s[i] === "Z") {
      end = i;
      break;
    }
  }
  const time = parseHms(s.slice(0, end));
  if (time === undefined) return undefined;
  if (end < s.length) {
    const tz = s.slice(end);
    if (tz === "Z") {
      // UTC
    } else {
      const off = parseHms(tz.slice(1));
      if (off === undefined || tz.length === 1) return undefined;
      const [oh, om, os, ous] = off;
      if (oh * 3600 + om * 60 + os + ous / 1e6 >= 86_400) return undefined;
    }
  }
  return { h: time[0], m: time[1], sec: time[2], us: time[3] };
}

/** True when `datetime.fromisoformat(text)` returns a value. */
export function pyIsoformatParses(text: string): boolean {
  let s = "";
  for (const byte of new TextEncoder().encode(text)) s += String.fromCharCode(byte);
  if (s.length < 7) return false;
  const at = separatorAt(s);
  if (at < 0) return false;
  const date = parseDate(s, Math.min(at, s.length));
  if (date === undefined) return false;
  let [year, month, day] = date;
  let p = at;
  if (p < s.length) {
    const lead = s.charCodeAt(p);
    p += (lead & 0x80) === 0 ? 1 : (lead & 0xf0) === 0xe0 ? 3 : (lead & 0xf0) === 0xf0 ? 4 : 2;
    const time = parseTime(s.slice(p));
    if (time === undefined) return false;
    let { h } = time;
    if (h === 24) {
      if (time.m !== 0 || time.sec !== 0 || time.us !== 0) return false;
      h = 0;
      if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
        day++;
        if (day > daysInMonth(year, month)) {
          day = 1;
          month++;
          if (month > 12) {
            month = 1;
            year++;
          }
        }
      }
    }
    if (h > 23 || time.m > 59 || time.sec > 59) return false;
  }
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}
