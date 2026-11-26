// A strict reader of an uncompressed tar archive (the inside of an npm
// tarball), with Node built-ins only (W1 R7 P8 review round 2, P8-R2-06).
// The deny-list scanner (scripts/check-deny-list.mjs) and the release checks
// (scripts/release-ledger.ts) both read a tarball as data through this one
// reader, so the bytes they check are the bytes a real tar reader sees.
//
// It fails closed. It throws a TarError, whose message names the kind of
// problem only (never a path or any content, so a deny-list term is never
// printed), for:
// - a header whose checksum does not match;
// - a header without the ustar magic (npm writes ustar);
// - a size field that is not plain octal (base-256 sizes are not read);
// - a body or its padding past the end of the archive (truncated input);
// - no end-of-archive block, or bytes other than zero after it;
// - a pax header with a `size` record, or a malformed pax record;
// - a GNU long name or pax header that no entry follows.
//
// It returns every entry in archive order, duplicates included: a caller
// that keys entries by path must look for duplicates itself (a later entry
// with the same path replaces an earlier one when a tar is extracted).

export class TarError extends Error {
  constructor(kind) {
    super(`the tar archive is not valid: ${kind}`);
    this.name = "TarError";
    this.kind = kind;
  }
}

const BLOCK = 512;
const decoder = new TextDecoder("utf-8");

function text(header, start, length) {
  const bytes = header.subarray(start, start + length);
  const end = bytes.indexOf(0);
  return decoder.decode(end < 0 ? bytes : bytes.subarray(0, end));
}

function octal(header, start, length, kind) {
  const bytes = header.subarray(start, start + length);
  if ((bytes[0] ?? 0) & 0x80) throw new TarError(`${kind} uses base-256 encoding`);
  const raw = decoder.decode(bytes).replace(/[\0 ]+$/u, "").replace(/^ +/u, "");
  if (raw === "") return 0;
  if (!/^[0-7]+$/u.test(raw)) throw new TarError(`${kind} is not an octal number`);
  return Number.parseInt(raw, 8);
}

function checksumOk(header) {
  const stored = octal(header, 148, 8, "header checksum");
  let sum = 0;
  for (let i = 0; i < BLOCK; i += 1) sum += i >= 148 && i < 156 ? 0x20 : header[i];
  return sum === stored;
}

/** The records of a pax extended header (`<length> <key>=<value>\n`, length counting the whole record). */
function paxRecords(body) {
  const out = new Map();
  let at = 0;
  while (at < body.length) {
    if (body[at] === 0) {
      // Padding inside the declared size is not allowed: a pax body is records only.
      throw new TarError("pax header holds bytes that are not records");
    }
    const space = body.indexOf(0x20, at);
    if (space < 0) throw new TarError("pax record has no length");
    const lengthText = decoder.decode(body.subarray(at, space));
    if (!/^[1-9][0-9]*$/u.test(lengthText)) throw new TarError("pax record length is not a number");
    const length = Number(lengthText);
    if (at + length > body.length || body[at + length - 1] !== 0x0a) throw new TarError("pax record length does not match");
    const record = decoder.decode(body.subarray(space + 1, at + length - 1));
    const eq = record.indexOf("=");
    if (eq <= 0) throw new TarError("pax record has no key");
    out.set(record.slice(0, eq), record.slice(eq + 1));
    at += length;
  }
  return out;
}

/**
 * Reads every entry of a tar archive. Each entry: `path`, `type` (`file`,
 * `dir`, `symlink`, `hardlink`, or `other`), `typeFlag`, `mode`, `size`,
 * `linkName`, and `body` (the bytes of a regular file, else undefined).
 */
export function readTar(tar) {
  const entries = [];
  let offset = 0;
  let longName;
  let longLink;
  let pax;
  let ended = false;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) {
      ended = true;
      break;
    }
    if (!checksumOk(header)) throw new TarError("a header checksum does not match");
    const magic = decoder.decode(header.subarray(257, 263));
    if (magic !== "ustar\0" && magic !== "ustar ") throw new TarError("a header has no ustar magic");
    const size = octal(header, 124, 12, "size field");
    const mode = octal(header, 100, 8, "mode field");
    const typeFlag = String.fromCharCode(header[156] ?? 0);
    const bodyStart = offset + BLOCK;
    const padded = Math.ceil(size / BLOCK) * BLOCK;
    if (bodyStart + size > tar.length || bodyStart + padded > tar.length) throw new TarError("an entry is truncated");
    const body = tar.subarray(bodyStart, bodyStart + size);
    offset = bodyStart + padded;
    if (typeFlag === "L") {
      if (longName !== undefined) throw new TarError("two long names in a row");
      longName = text(body, 0, body.length);
      continue;
    }
    if (typeFlag === "K") {
      if (longLink !== undefined) throw new TarError("two long link names in a row");
      longLink = text(body, 0, body.length);
      continue;
    }
    if (typeFlag === "x" || typeFlag === "g") {
      const records = paxRecords(body);
      if (records.has("size")) throw new TarError("a pax header sets the size");
      if (typeFlag === "g") {
        if (records.has("path") || records.has("linkpath")) throw new TarError("a global pax header sets a path");
        continue;
      }
      if (pax !== undefined) throw new TarError("two pax headers in a row");
      pax = records;
      continue;
    }
    const prefix = text(header, 345, 155);
    const name = text(header, 0, 100);
    let path = prefix === "" ? name : `${prefix}/${name}`;
    let linkName = text(header, 157, 100);
    if (longName !== undefined) path = longName;
    if (longLink !== undefined) linkName = longLink;
    if (pax?.has("path")) path = pax.get("path");
    if (pax?.has("linkpath")) linkName = pax.get("linkpath");
    longName = undefined;
    longLink = undefined;
    pax = undefined;
    const type = typeFlag === "0" || typeFlag === "\0" ? "file" : typeFlag === "5" ? "dir" : typeFlag === "2" ? "symlink" : typeFlag === "1" ? "hardlink" : "other";
    entries.push({ path, type, typeFlag, mode, size, linkName, body: type === "file" ? body : undefined });
  }
  if (!ended) throw new TarError("the archive has no end-of-archive block (truncated)");
  if (longName !== undefined || longLink !== undefined || pax !== undefined) throw new TarError("a long name or pax header has no entry");
  for (let i = offset; i < tar.length; i += 1) if (tar[i] !== 0) throw new TarError("bytes follow the end-of-archive block");
  return entries;
}

/** The paths that occur more than once, in first-occurrence order. */
export function duplicatePaths(entries) {
  const seen = new Set();
  const dup = new Set();
  for (const e of entries) {
    if (seen.has(e.path)) dup.add(e.path);
    seen.add(e.path);
  }
  return [...dup];
}
