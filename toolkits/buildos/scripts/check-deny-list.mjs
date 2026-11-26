#!/usr/bin/env node
// Client-name deny-list check (PRD 20 Release and Packaged Skills; W1 R7 P7 t8)
// and home-folder path guard (W1 R7 P7 skills review round 1, P7S-R1-01).
//
// The list names clients, so it is never committed, shipped, written to a
// file, or printed. It is read at run time from one of:
//
//   BUILDOS_DENY_LIST   environment variable, one term per line or comma
//                       separated (CI: the environment secret
//                       BUILDOS_DENY_LIST_ENV of the GitHub environment
//                       buildos-deny-list, passed in under this name; no
//                       repository or organization secret has that name);
//   --list-file <path>  a file outside the scanned folder (local use).
//
// Node built-ins only (W1 R7 P8 review round 1, P8-R1-02): it reads ZIP
// members and zlib streams with node:zlib, so the job that holds the real
// list runs it with no node_modules and no npm.
//
// Scan set: every file git tracks or would track under --root (tracked, plus
// untracked files that .gitignore does not exclude; never .git/), or every
// file under --root with --walk, plus either
//   --tarball <file>  every file inside that npm tarball, read from the
//                     tarball as data (nothing in it runs; npm is not used),
//                     labelled [tarball]/<path in the package>; or
//   --pack <folder>   every file `npm pack --dry-run` would ship from that
//                     package folder (the built dist/system/ included). This
//                     runs npm in the folder, so it is for local use only. Test fixtures are tracked files, so they are in the
// set. A package file is opened by its own disk path, never by its printed
// label (P7-F-01; scripts/deny-list-paths.mjs), so a package folder on
// another drive is read too. With --pack, the check fails unless it read
// every listed package file and at least one; the summary says
// `N of M package files read`.
//
// Matching: case-insensitive substring after Unicode NFKC folding, with runs
// of white space read as one space, so a term split across lines or by extra
// spaces still matches, at any file size (a streaming window that overlaps by
// more than the longest term). File, folder, and archive member names are
// checked too.
//
// What is decoded (W1 R7 P7 skills review rounds 1 and 2, final check):
// - Text: UTF-8; UTF-16LE or UTF-16BE with a byte order mark.
// - Encoded forms (P7-F-02): every text the check reads (any file type, XML
//   attribute values and text nodes included) is scanned raw, then once with
//   XML and HTML character references decoded (named amp, lt, gt, quot,
//   apos, nbsp; decimal and hex numeric), then once percent-decoded (`%XX`
//   as UTF-8, `+` as a space). Names and labels are checked the same way.
//   A match in a decoded form is labelled `:decoded <line>` or
//   `:url-decoded <line>`. One pass each: a twice-encoded name is not read.
// - XML (a file or archive member with an XML name, or one that starts with
//   an XML declaration): read in its declared encoding (byte order mark,
//   UTF-16 without one, or the declaration's `encoding`), as full text and
//   as visible text. Visible text joins the actual text nodes of each
//   paragraph, cell, or string item (Office w:t, a:t, t in shared and inline
//   strings; ODF paragraphs) and ignores the formatting white space between
//   elements, so a term split across runs and indentation still matches.
// - ZIP-based files (.docx, .xlsx, .pptx, .zip, and any file that starts
//   with a ZIP header): every member, the archive comment, each member
//   comment, and each central and local extra field (in every raw reading).
//   Office document properties (docProps/*.xml) are members, read as XML.
// - PDF: the raw bytes, every Flate stream inflated (XMP metadata and object
//   streams included), and every string object decoded (literal strings
//   with escapes; hex strings; UTF-16BE with a byte order mark), which is
//   where the Info dictionary keeps Title, Author, and the rest. Text drawn
//   with a font's own encoding in a content stream is not decoded.
// - PNG: tEXt, zTXt (inflated), and iTXt (UTF-8, inflated when compressed).
// - Any other binary file, JPEG included (COM, EXIF, and XMP segments): raw
//   bytes as UTF-8, Latin-1, and UTF-16LE and UTF-16BE at both byte
//   alignments. Compressed data that is not one of the kinds above is not
//   inflated, and a term split across two JPEG segments is not joined.
//
// Home-folder paths: every file is also checked for a path inside a personal
// home folder: `/Users/<name>/`, `/home/<name>/`, `<drive>:\Users\<name>\`,
// or a UNC profile `\\<server>\Users\<name>\`, with the whole name read as
// one path component in any script. A few generic names (CI runner accounts,
// `Shared`, `Public`, and placeholders such as `me`) and placeholders such as
// `<name>` or `$USER` are allowed, and one exact dependency text in the
// bundle (ALLOWED_DEPENDENCY_HOME below). A match fails the check; the folder
// name is never printed.
//
// No silent skips: every file or archive member that is not fully read (too
// large, an archive member over the size limit, an archive nested too deep,
// an archive that cannot be opened, a binary file read as raw bytes only, or
// a path that is not a regular file) is counted in the summary. In system/ or
// in the package file list, such a file fails the check.
//
// Output: on a match, the path and line only (`<path>:<line>`, or
// `<path>!<member>:<line>` inside an archive, `:text <n>` for the nth
// paragraph of visible text, `:name` for a name). Every path part of every
// label, archive members and nested archives included, goes through one
// function that prints a part that matches a term as [name on the deny list]
// and a home folder name as [home folder name]. The matched term, the line
// text, and error messages are never printed; an internal error names its
// kind only.
//
// Exit codes: 0 no match; 1 a match, a home-folder path, a file in system/
// or the package that could not be fully read, or a package file list that
// was empty or not fully read; 2 usage error, or no list.
// With no list the check fails closed. Outside CI, --allow-missing skips the
// check with a notice; in CI (CI or GITHUB_ACTIONS set) a missing list always
// fails.

import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import * as nodePath from "node:path";
import { join, relative, resolve, sep } from "node:path";
import { gunzipSync, inflateRawSync, inflateSync } from "node:zlib";
import { packEntries } from "./deny-list-paths.mjs";
import { readTar, TarError } from "./tar-reader.mjs";

// Never print an error message or a stack: either could hold a term. These
// run before anything else, so no debug option or uncaught error prints one.
const failClosed = (error) => {
  const kind = error && typeof error === "object" && "code" in error ? String(error.code) : error instanceof Error ? error.name : "unknown";
  process.stderr.write(`deny-list: internal error (${kind.replace(/[^A-Za-z0-9_-]/gu, "")}); the check failed closed\n`);
  process.exit(2);
};
process.on("uncaughtException", failClosed);
process.on("unhandledRejection", failClosed);

const LIMITS = { fileBytes: 256 * 1024 * 1024, entryBytes: 256 * 1024 * 1024 };
const MAX_ARCHIVE_DEPTH = 3;
const WINDOW_CHARS = 1024 * 1024;
const MIN_TERM_LENGTH = 3;
const REDACTED = "[name on the deny list]";
const REDACTED_HOME = "[home folder name]";
const ZIP_EXTENSIONS = [".zip", ".docx", ".docm", ".dotx", ".xlsx", ".xlsm", ".xltx", ".pptx", ".pptm", ".potx", ".odt", ".ods", ".odp", ".epub", ".jar", ".vsdx"];
// Generic account names that identify no person: GitHub runner accounts,
// shared system folders, and placeholders used in documentation and tests.
const GENERIC_HOMES = new Set(["runner", "runneradmin", "runner~1", "shared", "public", "default", "me", "user", "username", "you", "name", "example", "someone"]);

function usage(message) {
  if (message) process.stderr.write(`deny-list: ${message}\n`);
  process.stderr.write(
    "Usage: node scripts/check-deny-list.mjs [--root <folder>] [--walk] [--pack <package folder> | --tarball <npm tarball>] [--list-file <path>] [--allow-missing] [--max-file-bytes <n>] [--max-entry-bytes <n>]\n" +
      "The list comes from BUILDOS_DENY_LIST (one term per line or comma separated) or --list-file (outside the scanned folder).\n",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const options = { root: process.cwd(), walk: false, pack: undefined, tarball: undefined, listFile: undefined, allowMissing: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) usage(`${arg} needs a value`);
      i += 1;
      return next;
    };
    const size = () => {
      const text = value();
      if (!/^[1-9][0-9]{0,11}$/u.test(text)) usage(`${arg} needs a whole number of bytes above 0`);
      return Number(text);
    };
    if (arg === "--root") options.root = value();
    else if (arg === "--walk") options.walk = true;
    else if (arg === "--pack") options.pack = value();
    else if (arg === "--tarball") options.tarball = value();
    else if (arg === "--list-file") options.listFile = value();
    else if (arg === "--allow-missing") options.allowMissing = true;
    else if (arg === "--max-file-bytes") LIMITS.fileBytes = size();
    else if (arg === "--max-entry-bytes") LIMITS.entryBytes = size();
    else if (arg === "--help" || arg === "-h") usage();
    // The argument is not shown: a list pasted on the command line by mistake must not be printed.
    else usage("unknown argument (not shown)");
  }
  if (options.pack !== undefined && options.tarball !== undefined) usage("give --pack or --tarball, not both");
  return options;
}

/** NFKC, lower case, white space runs as one space, trimmed. */
function fold(text) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

// Encoded forms (W1 R7 P7 final check, P7-F-02). A listed name can be written
// with XML or HTML character references (an ampersand as `&amp;` in an xlsx
// sheet name attribute, or in HTML-escaped text inside a CSV field), or
// percent-encoded in a URL. Text is scanned raw and then once more in each
// decoded form, at the same line numbers: a decoded line break or other
// control character becomes a space, so lines never shift.
const NAMED_REFERENCES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
const lineSafe = (char) => (/[\u0000-\u001f\u007f\u0085\u2028\u2029]/u.test(char) ? " " : char);

/** One pass of character-reference decoding: named (amp, lt, gt, quot, apos, nbsp; any letter case) and numeric (decimal and hex). */
function decodeReferences(text) {
  if (!text.includes("&")) return text;
  return text.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z]{2,4});/gu, (whole, ref) => {
    if (ref.startsWith("#")) {
      const code = ref[1] === "x" || ref[1] === "X" ? Number.parseInt(ref.slice(2), 16) : Number.parseInt(ref.slice(1), 10);
      if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return whole;
      return lineSafe(String.fromCodePoint(code));
    }
    return NAMED_REFERENCES[ref.toLowerCase()] ?? whole;
  });
}

/** One pass of percent-decoding (`%XX` runs read as UTF-8 bytes; `+` as a space, as in a query string). */
function decodePercent(text) {
  if (!/%[0-9A-Fa-f]{2}|\+/u.test(text)) return text;
  return text
    .replace(/(?:%[0-9A-Fa-f]{2})+/gu, (run) => {
      const bytes = Buffer.from(run.replace(/%/gu, ""), "hex");
      return [...bytes.toString("utf8")].map(lineSafe).join("");
    })
    .replace(/\+/gu, " ");
}

/** The text and each decoded form of it that differs from it. */
function decodedForms(text) {
  const out = [];
  const references = decodeReferences(text);
  if (references !== text) out.push({ where: "decoded ", text: references });
  const percent = decodePercent(text);
  if (percent !== text) out.push({ where: "url-decoded ", text: percent });
  return out;
}

/** True when a term appears in the text, raw or in a decoded form. */
function termIn(text, terms) {
  return [text, ...decodedForms(text).map((form) => form.text)].some((form) => {
    const folded = fold(form);
    return terms.some((term) => folded.includes(term));
  });
}

function readList(options, root) {
  let raw;
  if (options.listFile !== undefined) {
    const file = resolve(options.listFile);
    let real;
    try {
      real = realpathSync(file);
    } catch {
      usage("the list file cannot be read");
    }
    const rel = relative(root, real);
    if (rel === "" || !(rel === ".." || rel.startsWith(`..${sep}`) || resolve(rel) === rel)) usage("the list file is inside the scanned folder; keep it outside the repository");
    raw = readFileSync(real, "utf8");
  } else {
    raw = process.env["BUILDOS_DENY_LIST"];
  }
  if (raw === undefined || raw.trim() === "") return undefined;
  const terms = [...new Set(raw.split(/[\n,]/u).map(fold).filter((term) => term !== ""))];
  if (terms.length === 0) return undefined;
  if (terms.some((term) => term.length < MIN_TERM_LENGTH)) usage(`every deny-list term must have at least ${MIN_TERM_LENGTH} characters; one does not (it is not shown)`);
  return terms;
}

function inCi() {
  return (process.env["CI"] ?? "") !== "" || (process.env["GITHUB_ACTIONS"] ?? "") !== "";
}

/** The environment for git and npm: without the list, so no child process can print it. */
function childEnv() {
  const env = { ...process.env };
  delete env["BUILDOS_DENY_LIST"];
  return env;
}

function gitFiles(root) {
  const result = spawnSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "buffer", maxBuffer: 512 * 1024 * 1024, env: childEnv() });
  if (result.status !== 0) return undefined;
  return result.stdout.toString("utf8").split("\0").filter((p) => p !== "");
}

function walkFiles(root) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir).sort()) {
      if (name === ".git" || name === "node_modules") continue;
      const full = join(dir, name);
      const path = prefix === "" ? name : `${prefix}/${name}`;
      const stat = lstatSync(full);
      if (stat.isDirectory()) walk(full, path);
      else out.push(path);
    }
  };
  walk(root, "");
  return out;
}

function packFiles(root, packageDir) {
  // The real path, as for --root, so a package inside the root gets the same paths as the tree scan.
  const dir = realpathSync(resolve(packageDir));
  const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024, env: childEnv() });
  if (result.status !== 0) {
    process.stderr.write("deny-list: `npm pack --dry-run` failed in the package folder; build the package first\n");
    process.exit(2);
  }
  const files = JSON.parse(result.stdout)[0]?.files ?? [];
  // Each file keeps its disk path apart from its printable label (P7-F-01): see scripts/deny-list-paths.mjs.
  return packEntries(root, dir, files.map((file) => file.path), nodePath);
}

/**
 * The files of an npm tarball, read as data with the strict tar reader
 * (scripts/tar-reader.mjs; W1 R7 P8 review round 2, P8-R2-06): label
 * `[tarball]/<path in the package>`, the bytes, and the package path. A
 * malformed or truncated archive fails the check (exit 2). Every entry is
 * returned, a repeated path too; the caller reads each one and counts a
 * repeated path as not fully scanned.
 */
const TARBALL_LABEL = "[tarball]";
function tarballFiles(tarball) {
  let tar;
  try {
    tar = gunzipSync(readFileSync(resolve(tarball)));
  } catch {
    process.stderr.write("deny-list: the --tarball file cannot be read as a gzipped tar\n");
    process.exit(2);
  }
  let entries;
  try {
    entries = readTar(new Uint8Array(tar.buffer, tar.byteOffset, tar.byteLength));
  } catch (error) {
    const kind = error instanceof TarError ? error.kind : "unreadable";
    process.stderr.write(`deny-list: the --tarball file is not a valid tar archive (${kind}); the check failed closed\n`);
    process.exit(2);
  }
  const out = [];
  for (const e of entries) {
    if (e.type === "dir") continue;
    const packagePath = e.path.replace(/^package\//u, "");
    out.push({ path: `${TARBALL_LABEL}/${packagePath}`, packagePath, data: e.body, link: e.body === undefined ? e.linkName : undefined });
  }
  return out;
}

/**
 * The members of a ZIP archive, from its central directory, read with
 * node:zlib (stored and deflated members), as a list of [name, bytes] in
 * directory order: a name that occurs twice gives two items (W1 R7 P8 review
 * round 2, P8-R2-06), never one that replaces the other. Members for which
 * `filter` returns false are left out. Throws on anything it cannot read (encrypted members,
 * ZIP64, other compression methods, a broken directory), so the caller counts
 * the archive as not fully read.
 */
function unzipMembers(data, filter) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = -1;
  for (let at = data.length - 22; at >= Math.max(0, data.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new Error("no end of central directory");
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  if (count === 0xffff || at === 0xffffffff) throw new Error("ZIP64 is not read");
  const out = [];
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > data.length || view.getUint32(at, true) !== 0x02014b50) throw new Error("broken central directory");
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const originalSize = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder("utf-8").decode(data.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (compressedSize === 0xffffffff || originalSize === 0xffffffff || local === 0xffffffff) throw new Error("ZIP64 is not read");
    if ((flags & 1) !== 0) throw new Error("encrypted member");
    if (!filter({ name, originalSize })) continue;
    if (local + 30 > data.length || view.getUint32(local, true) !== 0x04034b50) throw new Error("broken local header");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const body = data.subarray(start, start + compressedSize);
    if (body.length !== compressedSize) throw new Error("member data out of range");
    if (method === 0) out.push([name, body]);
    else if (method === 8) out.push([name, new Uint8Array(inflateRawSync(body, { maxOutputLength: Math.max(1, LIMITS.entryBytes) }))]);
    else throw new Error("unknown compression method");
  }
  return out;
}

/** A zlib stream (PDF Flate streams, PNG zTXt and iTXt), inflated with node:zlib. */
function unzlib(data) {
  return new Uint8Array(inflateSync(data, { maxOutputLength: Math.max(1, LIMITS.entryBytes) }));
}

// A path inside a personal home folder (W1 R7 P7 skills review rounds 1 and
// 2). Each pattern finds the part before the profile folder name; the name is
// then read as one complete path component (Unicode letters and digits
// included), so a name that only starts with a placeholder such as `me` is
// never read as that placeholder.
//   POSIX: /Users/<name> (macOS) or /home/<name>, not preceded by a name
//          character (so `example.com/home/x` and `/srv/home/x` are not home
//          folders).
//   Drive: <drive>:\Users\<name>, with any number of backslashes (escaped in
//          JSON or source) or a slash; any letter case.
//   UNC:   \\<server>\Users\<name> or \\<server>\<drive>$\Users\<name>, also
//          with escaped backslashes or as //<server>/Users/<name> (not a URL).
const NAME_START = /^[\p{L}\p{N}_]/u;
const COMPONENT_STOP = /[\s\\/"'`<>|:;,()[\]{}*?=&#!]/u;
const HOME_PREFIXES = [
  /(?<![\p{L}\p{N}\p{M}_.~-])\/(?:Users|home)\//gu,
  /(?<![\p{L}\p{N}\p{M}])[A-Za-z]:(?:\\+|\/)Users(?:\\+|\/)/giu,
  /(?:\\{2,}|(?<![:\p{L}\p{N}\p{M}/])\/\/)[^\\/\s"'<>|]+(?:(?:\\+|\/)[A-Za-z]\$)?(?:\\+|\/)Users(?:\\+|\/)/giu,
];

/**
 * The profile folder name that starts at `at`, or undefined for a
 * placeholder (`<name>`, `$USER`, `%USERNAME%`, `{user}`, `...`) or nothing.
 * The name ends at a path separator, white space, or a delimiter; a name with
 * spaces (a Windows profile such as `First Last`) is read up to the next
 * separator when one follows on the same line.
 */
function profileName(text, at) {
  const first = String.fromCodePoint(text.codePointAt(at) ?? 0x20);
  if (!NAME_START.test(first)) return undefined;
  let end = at;
  while (end < text.length && !COMPONENT_STOP.test(text[end])) end += 1;
  const spaced = /^((?: [^\s\\/"'`<>|:;,()[\]{}*?=&#!]+)+)(?=[\\/])/u.exec(text.slice(end, end + 256));
  if (spaced) end += spaced[1].length;
  return text.slice(at, end);
}

// The one dependency path the check allows (W1 R7 P7 skills review round 2,
// P7S-R2-04). The PDF reader BuildOS bundles (unpdf 2.1.0's pdf.js build,
// inside dist/buildos.js) runs a WebAssembly image decoder whose generated
// runtime defines a simulated environment with this fixed HOME value. It is
// the same string in every build and names no person. It is allowed only as
// this exact text, only in the package file dist/buildos.js; the same text in
// any other file, or a changed text in that file, still fails.
// test/deny-list.test.ts fails when the dependency changes or drops the text.
// The text is built here at run time, so this file holds no such path itself.
const ALLOWED_DEPENDENCY_HOME = { packagePath: "dist/buildos.js", repoPath: "toolkits/buildos/dist/buildos.js", text: `HOME: \`${["", "home", "web_user"].join("/")}\`` };

function hasHomePath(text) {
  for (const pattern of HOME_PREFIXES) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const name = profileName(text, m.index + m[0].length);
      if (name !== undefined && !GENERIC_HOMES.has(name.normalize("NFKC").toLowerCase())) return true;
      pattern.lastIndex = m.index + 1;
    }
  }
  return false;
}

/**
 * The one function that turns a location into printable text. `parts` is the
 * outer path followed by each archive member name, nested archives included.
 * Every path part of every one of them is shown as is only when it matches no
 * term and is not a home folder name.
 */
function labelOf(parts, terms) {
  return parts
    .map((part) => {
      const pieces = part.split(/([\\/]+)/u);
      const tokens = pieces.filter((_, index) => index % 2 === 0);
      // The token after a leading `Users` or `home` (after a drive letter on Windows) is a home folder name.
      const homeAt = (() => {
        const start = tokens[0] === "" || /^[A-Za-z]:$/u.test(tokens[0] ?? "") ? 1 : 0;
        return /^(users|home)$/iu.test(tokens[start] ?? "") ? start + 1 : -1;
      })();
      return pieces
        .map((piece, index) => {
          if (index % 2 === 1 || piece === "") return piece;
          if (termIn(piece, terms)) return REDACTED;
          return index / 2 === homeAt && !GENERIC_HOMES.has(piece.toLowerCase()) ? REDACTED_HOME : piece;
        })
        .join("");
    })
    .join("!");
}

/** A name (a path or an archive member name) that starts inside a home folder. */
function nameHasHomePath(name) {
  return hasHomePath(/^(Users|home)[\\/]/u.test(name) ? `/${name}` : name);
}

function nameMatches(name, terms) {
  return termIn(name, terms);
}

function isBinary(data) {
  const head = data.subarray(0, Math.min(data.length, 8192));
  if (head.includes(0)) return true;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return false;
  } catch {
    return true;
  }
}

/** The text of a file with a UTF-16 byte order mark, or undefined. */
function utf16Text(data) {
  try {
    if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le", { fatal: true }).decode(data.subarray(2));
    if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be", { fatal: true }).decode(data.subarray(2));
  } catch {
    return undefined;
  }
  return undefined;
}

function isPdf(name, data) {
  return name.toLowerCase().endsWith(".pdf") || latin1(data.subarray(0, 5)) === "%PDF-";
}

function isZip(name, data) {
  const lower = name.toLowerCase();
  return (data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04) || ZIP_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * 1-based line numbers of every term match in `text`: per line, and across
 * lines for a term with a space. The cross-line pass folds the text in
 * windows of WINDOW_CHARS folded characters and keeps more than the longest
 * term at each window edge, so a match that crosses an edge is found, at any
 * text size.
 */
function matchLines(text, terms) {
  const found = new Set();
  let lineNumber = 0;
  for (const line of text.split("\n")) {
    lineNumber += 1;
    const folded = fold(line);
    if (terms.some((term) => folded.includes(term))) found.add(lineNumber);
  }
  if (!terms.some((term) => term.includes(" "))) return [...found].sort((a, b) => a - b);
  const keep = Math.max(...terms.map((term) => term.length)) + 2;
  let window = "";
  let lineOf = [];
  const search = () => {
    for (const term of terms) {
      let at = window.indexOf(term);
      while (at !== -1) {
        found.add(lineOf[at] ?? 1);
        at = window.indexOf(term, at + 1);
      }
    }
  };
  let line = 1;
  let started = false;
  let pendingSpace = false;
  const space = /\s/u;
  for (const char of text.normalize("NFKC")) {
    if (space.test(char)) {
      if (char === "\n") line += 1;
      pendingSpace = started;
      continue;
    }
    if (pendingSpace) {
      window += " ";
      lineOf.push(line);
      pendingSpace = false;
    }
    started = true;
    const lower = char.toLowerCase();
    window += lower;
    for (let k = 0; k < lower.length; k += 1) lineOf.push(line);
    if (window.length >= WINDOW_CHARS + keep) {
      search();
      window = window.slice(-keep);
      lineOf = lineOf.slice(-keep);
    }
  }
  search();
  return [...found].sort((a, b) => a - b);
}

/** 1-based line numbers that hold a home-folder path. */
function homeLines(text) {
  const out = [];
  let lineNumber = 0;
  for (const line of text.split("\n")) {
    lineNumber += 1;
    if (hasHomePath(line)) out.push(lineNumber);
  }
  return out;
}

const decodeEntities = decodeReferences;

const XML_NAMES = /\.(?:xml|rels|vml|svg|xhtml|xsd|xsl|xslt|kml|gpx|opf|ncx|xlf|xliff|resx)$/iu;

/** A member or file that is XML by name, or by its first bytes in UTF-8 or UTF-16. */
function looksLikeXml(name, data) {
  const head = decodeXmlBytes(data.subarray(0, 64));
  // A binary file with an XML name is not XML: it keeps the raw reading.
  if (head.includes("\0")) return false;
  return XML_NAMES.test(name) || head.replace(/^\s+/u, "").startsWith("<?xml");
}

/**
 * The text of an XML part, read in the encoding it declares (W1 R7 P7 skills
 * review round 2, P7S-R2-01): a byte order mark (UTF-8, UTF-16LE, UTF-16BE)
 * first, then UTF-16 found from a leading `<` with a zero byte, then the
 * `encoding` of the XML declaration (any encoding Node's TextDecoder knows),
 * else UTF-8.
 */
function decodeXmlBytes(data) {
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return new TextDecoder("utf-8").decode(data.subarray(3));
  if (data[0] === 0xff && data[1] === 0xfe) return utf16le(data.subarray(2));
  if (data[0] === 0xfe && data[1] === 0xff) return utf16be(data.subarray(2));
  if (data[0] === 0x3c && data[1] === 0x00) return utf16le(data);
  if (data[0] === 0x00 && data[1] === 0x3c) return utf16be(data);
  const declared = /^\s*<\?xml[^>]*?\bencoding\s*=\s*["']([A-Za-z0-9._:-]+)["']/u.exec(latin1(data.subarray(0, 512)))?.[1];
  if (declared !== undefined) {
    try {
      return new TextDecoder(declared.toLowerCase()).decode(data);
    } catch {
      // An encoding Node does not know: read as UTF-8 below.
    }
  }
  return new TextDecoder("utf-8").decode(data);
}

// Office and OpenDocument visible text (P7S-R1-04, P7S-R2-01). Element local
// names: TEXT_RUNS hold the visible characters (WordprocessingML w:t,
// DrawingML a:t, SpreadsheetML t in shared strings and inline strings, Math
// m:t, deleted and field text); ODF_TEXT elements hold visible characters
// directly; BLOCKS end a paragraph, cell, row, or string item; BREAKS are a
// line break, tab, or ODF space inside one.
const TEXT_RUNS = new Set(["t", "delText", "instrText"]);
const ODF_TEXT = new Set(["text:p", "text:h"]);
const BLOCKS = new Set(["p", "h", "si", "c", "is", "row", "tc", "table-cell", "txBody"]);
const BREAKS = new Set(["br", "tab", "cr", "line-break", "s"]);
const XML_TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<(\/?)([^\s/>]+)[^>]*?(\/?)>|([^<]+)/gu;
const localName = (name) => name.slice(name.indexOf(":") + 1);

/**
 * The visible text of an XML part, one line per paragraph, cell, or string
 * item (P7S-R2-01). It joins the actual text nodes and ignores the markup and
 * the formatting white space between elements, so a term split across runs
 * and across indentation still reads as one string.
 *
 * Office and OpenDocument parts (any w:t, a:t, t, or text:p element): only
 * the characters inside text runs (or inside ODF paragraphs and headings)
 * count; white space inside a run is kept, as Office shows it.
 *
 * Any other XML: every text node that is not only white space counts. A text
 * node continues the line of the text before it when one of the two elements
 * holds the other (mixed content such as `Quor<b>vex</b>` or `<b>Quor</b>vex`),
 * or when both are children of an element that has text of its own;
 * otherwise it starts a new line. Text split across two sibling elements
 * whose parent has no text of its own (`<i>Quor</i><b>vex</b>`) is read as
 * two lines; the full-text pass reads each part.
 */
function visibleText(xml) {
  const office = /<(?:[A-Za-z][\w.-]*:)?t[\s>]|<text:[ph][\s>]/u.test(xml);
  const lines = [];
  let line = "";
  const endLine = () => {
    if (line.trim() !== "") lines.push(line);
    line = "";
  };
  let inRun = 0;
  let nextId = 0;
  const stack = [{ id: nextId++, hasText: false }];
  let last; // { frame, ancestors } of the previous text node
  XML_TOKEN.lastIndex = 0;
  let m;
  while ((m = XML_TOKEN.exec(xml)) !== null) {
    const [whole, cdata, slash, name, selfClose, chars] = m;
    const empty = selfClose === "/" || whole.endsWith("/>");
    if (name !== undefined) {
      const local = localName(name);
      if (office) {
        const counts = TEXT_RUNS.has(local) || ODF_TEXT.has(name);
        if (slash === "/") {
          if (counts) inRun = Math.max(0, inRun - 1);
          if (BLOCKS.has(local) || ODF_TEXT.has(name)) endLine();
        } else if (BREAKS.has(local) && empty) {
          if (inRun > 0 || local !== "s") line += " ";
        } else if (counts && !empty) inRun += 1;
        continue;
      }
      if (slash === "/") {
        if (stack.length > 1) stack.pop();
      } else if (!empty) stack.push({ id: nextId++, hasText: false });
      continue;
    }
    const text = cdata !== undefined ? cdata : chars !== undefined ? decodeEntities(chars) : undefined;
    if (text === undefined) continue;
    if (office) {
      if (inRun > 0) line += text;
      continue;
    }
    if (text.trim() === "") continue;
    const frame = stack[stack.length - 1];
    const parent = stack[stack.length - 2];
    const ids = stack.map((f) => f.id);
    const related =
      last !== undefined &&
      (ids.includes(last.frame.id) || last.ancestors.includes(frame.id) || (parent !== undefined && parent.hasText && last.ancestors[last.ancestors.length - 2] === parent.id));
    if (!related) endLine();
    line += text;
    frame.hasText = true;
    last = { frame, ancestors: ids };
  }
  endLine();
  return lines.join("\n");
}

function latin1(data) {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("latin1");
}

function utf16le(data) {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength - (data.byteLength % 2)).toString("utf16le");
}

function utf16be(data) {
  const even = data.byteLength - (data.byteLength % 2);
  const swapped = Buffer.from(data.subarray(0, even));
  swapped.swap16();
  return swapped.toString("utf16le");
}

function pdfStreams(data, inflate) {
  const text = latin1(data);
  const out = [];
  const re = /stream\r?\n/gu;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[0].length;
    const end = text.indexOf("endstream", start);
    if (end === -1) break;
    try {
      out.push(inflate(data.subarray(start, end)));
    } catch {
      // Not a Flate stream; its raw bytes are already checked.
    }
    re.lastIndex = end;
  }
  return out;
}

/** Bytes of a PDF string: UTF-16BE with a byte order mark, else PDFDocEncoding read as Latin-1. */
function pdfStringText(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return utf16be(bytes.subarray(2));
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  return latin1(bytes);
}

/**
 * The decoded PDF string objects in `text` (Latin-1 view of PDF bytes), one
 * per line (P7S-R2-02): literal strings `( ... )` with their escapes and
 * nesting, and hex strings `< ... >`. The Info dictionary (Title, Author,
 * Subject, Keywords, Creator, Producer) is made of these, often as UTF-16BE
 * hex, which the raw scan cannot read.
 */
function pdfStrings(text) {
  const out = [];
  const ESC = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") {
      const bytes = [];
      let depth = 1;
      let j = i + 1;
      for (; j < text.length && depth > 0; j += 1) {
        const c = text[j];
        if (c === "\\") {
          const n = text[j + 1];
          if (n === undefined) break;
          if (n in ESC) {
            bytes.push(ESC[n]);
            j += 1;
          } else if (/[0-7]/u.test(n)) {
            const oct = /^[0-7]{1,3}/u.exec(text.slice(j + 1, j + 4))[0];
            bytes.push(Number.parseInt(oct, 8) & 0xff);
            j += oct.length;
          } else if (n === "\r" || n === "\n") {
            j += n === "\r" && text[j + 2] === "\n" ? 2 : 1;
          } else {
            bytes.push(n.charCodeAt(0) & 0xff);
            j += 1;
          }
          continue;
        }
        if (c === "(") depth += 1;
        else if (c === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
        bytes.push(c.charCodeAt(0) & 0xff);
      }
      if (bytes.length > 0) out.push(pdfStringText(Uint8Array.from(bytes)));
      i = j;
    } else if (ch === "<" && text[i + 1] !== "<") {
      const end = text.indexOf(">", i + 1);
      if (end === -1) break;
      const hex = text.slice(i + 1, end).replace(/\s+/gu, "");
      if (hex.length > 0 && /^[0-9A-Fa-f]+$/u.test(hex)) {
        const padded = hex.length % 2 === 0 ? hex : `${hex}0`;
        out.push(pdfStringText(Uint8Array.from(Buffer.from(padded, "hex"))));
        i = end;
      }
    } else if (ch === "<") i += 1;
  }
  return out.join("\n");
}

/**
 * The text chunks of a PNG file (P7S-R2-02): tEXt (Latin-1), zTXt (inflated,
 * Latin-1), and iTXt (UTF-8, inflated when compressed), keyword and text.
 * eXIf is EXIF bytes, which the raw scan reads. Undefined when the file is
 * not a PNG.
 */
function pngTexts(data, inflate) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length < 8 || SIG.some((b, i) => data[i] !== b)) return undefined;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out = [];
  let unread = 0;
  for (let at = 8; at + 12 <= data.length; ) {
    const length = view.getUint32(at);
    const type = latin1(data.subarray(at + 4, at + 8));
    const body = data.subarray(at + 8, Math.min(data.length, at + 8 + length));
    at += 12 + length;
    const zero = body.indexOf(0);
    try {
      if (type === "tEXt") out.push(latin1(body).replace(/\0/gu, " "));
      else if (type === "zTXt" && zero !== -1) out.push(`${latin1(body.subarray(0, zero))} ${latin1(inflate(body.subarray(zero + 2)))}`);
      else if (type === "iTXt" && zero !== -1) {
        const compressed = body[zero + 1] === 1;
        let rest = body.subarray(zero + 3);
        const lang = rest.indexOf(0);
        const translated = lang === -1 ? -1 : rest.indexOf(0, lang + 1);
        if (translated === -1) {
          unread += 1;
          continue;
        }
        const head = new TextDecoder("utf-8").decode(rest.subarray(0, translated)).replace(/\0/gu, " ");
        rest = rest.subarray(translated + 1);
        out.push(`${latin1(body.subarray(0, zero))} ${head} ${new TextDecoder("utf-8").decode(compressed ? inflate(rest) : rest)}`);
      }
    } catch {
      unread += 1; // a compressed text chunk that does not inflate: its raw bytes are still read
    }
  }
  return { text: out.join("\n"), unread };
}

/**
 * The metadata channels of a ZIP file that no member holds (P7S-R2-02): the
 * archive comment, each central directory entry's comment and extra field,
 * and each local header's extra field. Headers are found by their
 * signatures, so ZIP64 archives and data before the first member are
 * covered. `known` is the set of member names the archive reader returned: a
 * header whose name is not in it is labelled by its byte offset, so bytes
 * that only look like a header never print as a name.
 */
function zipMetadata(data, known) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const out = [];
  const nameAt = (start, length, offset) => {
    const name = new TextDecoder("utf-8").decode(data.subarray(start, start + length));
    return known.has(name) ? name : `[header at byte ${offset}]`;
  };
  for (let at = buffer.indexOf("PK\x01\x02", 0, "latin1"); at !== -1; at = buffer.indexOf("PK\x01\x02", at + 1, "latin1")) {
    if (at + 46 > data.length) break;
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const nameStart = at + 46;
    const extraStart = nameStart + nameLength;
    const commentStart = extraStart + extraLength;
    if (commentStart + commentLength > data.length) continue;
    const member = nameAt(nameStart, nameLength, at);
    if (extraLength > 0) out.push({ member, where: "extra field", bytes: data.subarray(extraStart, commentStart) });
    if (commentLength > 0) out.push({ member, where: "member comment", bytes: data.subarray(commentStart, commentStart + commentLength) });
  }
  for (let at = buffer.indexOf("PK\x03\x04", 0, "latin1"); at !== -1; at = buffer.indexOf("PK\x03\x04", at + 1, "latin1")) {
    if (at + 30 > data.length) break;
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const extraStart = at + 30 + nameLength;
    if (extraLength === 0 || extraStart + extraLength > data.length) continue;
    out.push({ member: nameAt(at + 30, nameLength, at), where: "local extra field", bytes: data.subarray(extraStart, extraStart + extraLength) });
  }
  for (let at = buffer.lastIndexOf("PK\x05\x06", data.length - 22, "latin1"); at !== -1; at = at === 0 ? -1 : buffer.lastIndexOf("PK\x05\x06", at - 1, "latin1")) {
    const length = view.getUint16(at + 20, true);
    if (at + 22 + length > data.length) continue;
    if (length > 0) out.push({ member: undefined, where: "archive comment", bytes: data.subarray(at + 22, at + 22 + length) });
    break;
  }
  return out;
}

/** Every reading of raw bytes the check uses: UTF-8, Latin-1, and UTF-16LE and UTF-16BE at both byte alignments. */
function rawReadings(data) {
  return [new TextDecoder("utf-8").decode(data), latin1(data), utf16le(data), utf16le(data.subarray(1)), utf16be(data), utf16be(data.subarray(1))];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = realpathSync(resolve(options.root));
  const terms = readList(options, root);
  if (terms === undefined) {
    if (options.allowMissing && !inCi()) {
      process.stdout.write("deny-list: SKIPPED. No deny list was provided, and --allow-missing was given outside CI. Nothing was checked.\n");
      return 0;
    }
    process.stderr.write(
      "deny-list: deny list not provided. Set BUILDOS_DENY_LIST or pass --list-file. In CI the list is the environment secret BUILDOS_DENY_LIST_ENV of the GitHub environment buildos-deny-list (never a repository or organization secret); add it there. The check fails closed without a list.\n",
    );
    return 2;
  }

  const counts = { files: 0, entries: 0, binary: 0, pdf: 0, pdfStrings: 0, png: 0, xml: 0, visible: 0, zipMeta: 0, missing: 0, links: 0, allowedHome: 0, decoded: 0, packageFiles: 0, packageRead: 0 };
  // Every file to read: its printable label (`path`) and its disk path (`full`), kept apart (P7-F-01).
  const scan = new Map();
  for (const path of (options.walk ? undefined : gitFiles(root)) ?? walkFiles(root)) scan.set(path, { path, full: join(root, ...path.split("/")), isPackage: false });
  const strict = new Set();
  // Labels of the one file that may hold the allowed dependency text (P7S-R2-04).
  const allowedHomeFiles = new Set([ALLOWED_DEPENDENCY_HOME.repoPath]);
  if (options.pack !== undefined) {
    for (const { path, full, packagePath } of packFiles(root, options.pack)) {
      strict.add(path);
      scan.set(path, { path, full, isPackage: true });
      counts.packageFiles += 1;
      if (packagePath === ALLOWED_DEPENDENCY_HOME.packagePath) allowedHomeFiles.add(path);
    }
  }
  // Tarball paths that occur more than once: each copy is read (a later copy replaces an earlier one when the
  // tarball is extracted), and the path counts as not fully scanned, so the check fails (P8-R2-06).
  const repeatedTarballPaths = new Set();
  if (options.tarball !== undefined) {
    const occurrences = new Map();
    for (const { path, packagePath, data, link } of tarballFiles(options.tarball)) {
      strict.add(path);
      const n = (occurrences.get(path) ?? 0) + 1;
      occurrences.set(path, n);
      if (n > 1) repeatedTarballPaths.add(path);
      scan.set(n === 1 ? path : `${path}\0${n}`, { path, full: undefined, data, link, isPackage: true });
      counts.packageFiles += 1;
      if (packagePath === ALLOWED_DEPENDENCY_HOME.packagePath) allowedHomeFiles.add(path);
    }
  }
  const packageScan = options.pack !== undefined || options.tarball !== undefined;
  const files = [...scan.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const matches = new Set();
  const homes = new Set();
  const unread = [...repeatedTarballPaths].map((path) => ({ parts: [path], isStrict: true, why: "path occurs more than once in the tarball" }));
  const label = (parts) => labelOf(parts, terms);
  const addMatch = (parts, where) => matches.add(`${label(parts)}:${where}`);
  const addHome = (parts, where) => homes.add(`${label(parts)}:${where}`);
  const checkName = (parts, name) => {
    if (nameMatches(name, terms)) addMatch(parts, "name");
    if (nameHasHomePath(name)) addHome(parts, "name");
  };
  const checkText = (parts, text, prefix = "") => {
    const rawLines = new Set(matchLines(text, terms));
    for (const line of rawLines) addMatch(parts, `${prefix}${line}`);
    // The same text with character references decoded, and percent-decoded (P7-F-02), at the same line
    // numbers; a line the raw pass already reported is not reported again.
    for (const form of decodedForms(text)) {
      counts.decoded += 1;
      for (const line of matchLines(form.text, terms)) if (!rawLines.has(line)) addMatch(parts, `${prefix}${form.where}${line}`);
    }
    let homeText = text;
    if (parts.length === 1 && prefix === "" && allowedHomeFiles.has(parts[0])) {
      // Only the exact allowed text, only in the bundle file; the same number of characters keeps line numbers.
      const pieces = text.split(ALLOWED_DEPENDENCY_HOME.text);
      counts.allowedHome = Math.max(counts.allowedHome, pieces.length - 1);
      homeText = pieces.join(" ".repeat(ALLOWED_DEPENDENCY_HOME.text.length));
    }
    for (const line of homeLines(homeText)) addHome(parts, `${prefix}${line}`);
  };
  const checkReadings = (parts, data, prefix = "") => {
    for (const text of rawReadings(data)) checkText(parts, text, prefix);
  };

  const checkData = (parts, name, data, depth, isStrict) => {
    if (isZip(name, data)) {
      if (depth >= MAX_ARCHIVE_DEPTH) {
        unread.push({ parts, isStrict, why: "archive nested too deep, read as raw bytes only" });
        checkRaw(parts, name, data, false);
        return;
      }
      const omitted = [];
      let entries;
      try {
        entries = unzipMembers(data, (entry) => {
          if (entry.originalSize <= LIMITS.entryBytes) return true;
          omitted.push(entry.name);
          return false;
        });
      } catch {
        unread.push({ parts, isStrict, why: "archive could not be opened, read as raw bytes only" });
        checkRaw(parts, name, data, false);
        return;
      }
      // Comments and extra fields: never printed, read in every raw reading (P7S-R2-02).
      for (const meta of zipMetadata(data, new Set([...omitted, ...entries.map(([memberName]) => memberName)]))) {
        counts.zipMeta += 1;
        checkReadings(meta.member === undefined ? parts : [...parts, meta.member], meta.bytes, `${meta.where} `);
      }
      for (const memberName of omitted) {
        counts.entries += 1;
        const memberParts = [...parts, memberName];
        checkName(memberParts, memberName);
        unread.push({ parts: memberParts, isStrict, why: "archive member too large to read" });
      }
      // Every occurrence of a member name is read. A name that occurs twice is also counted as not fully
      // scanned: an unzip tool keeps one of them, so what a reader sees is not certain (P8-R2-06).
      const seenMembers = new Set();
      const repeated = new Set();
      for (const [memberName] of [...omitted.map((n) => [n]), ...entries]) {
        if (seenMembers.has(memberName)) repeated.add(memberName);
        seenMembers.add(memberName);
      }
      for (const memberName of repeated) unread.push({ parts: [...parts, memberName], isStrict, why: "archive member name occurs more than once" });
      for (const [memberName, memberData] of entries) {
        counts.entries += 1;
        const memberParts = [...parts, memberName];
        checkName(memberParts, memberName);
        checkData(memberParts, memberName, memberData, depth + 1, isStrict);
      }
      return;
    }
    if (isPdf(name, data)) {
      // Raw readings, inflated streams, and decoded strings, also for a PDF that is all text.
      checkRaw(parts, name, data, isBinary(data));
      if (isBinary(data)) unread.push({ parts, isStrict, why: "binary file: read as raw bytes only" });
      return;
    }
    if (looksLikeXml(name, data)) {
      // XML in its declared encoding (UTF-8, UTF-16LE, UTF-16BE, or another), as full text and as visible text (P7S-R2-01).
      counts.xml += 1;
      const xml = decodeXmlBytes(data);
      checkText(parts, xml);
      counts.visible += 1;
      checkText(parts, visibleText(xml), "text ");
      return;
    }
    const bomText = utf16Text(data);
    if (bomText !== undefined) {
      checkText(parts, bomText);
      return;
    }
    if (!isBinary(data)) {
      checkText(parts, new TextDecoder("utf-8").decode(data));
      return;
    }
    checkRaw(parts, name, data, true);
    unread.push({ parts, isStrict, why: "binary file: read as raw bytes only" });
  };

  const checkRaw = (parts, name, data, countBinary) => {
    if (countBinary) counts.binary += 1;
    checkReadings(parts, data);
    const png = pngTexts(data, unzlib);
    if (png !== undefined) {
      counts.png += 1;
      checkText(parts, png.text, "png text ");
      if (png.unread > 0) unread.push({ parts, isStrict: false, why: "PNG text chunk that could not be decoded, read as raw bytes only" });
    }
    if (isPdf(name, data)) {
      counts.pdf += 1;
      const strings = [pdfStrings(latin1(data))];
      for (const stream of pdfStreams(data, unzlib)) {
        checkReadings(parts, stream);
        strings.push(pdfStrings(latin1(stream)));
      }
      counts.pdfStrings += 1;
      checkText(parts, strings.join("\n"), "pdf string ");
    }
  };

  for (const { path, full, isPackage, data: memberData, link } of files) {
    const isStrict = strict.has(path) || path.startsWith("system/");
    checkName([path], path);
    if (full === undefined) {
      // A tarball member, read from the tarball as data.
      if (memberData === undefined) {
        counts.links += 1;
        checkText([path], link ?? "", "link ");
        unread.push({ parts: [path], isStrict: true, why: "package file is a link, not a regular file" });
        continue;
      }
      counts.files += 1;
      if (memberData.length > LIMITS.fileBytes) {
        unread.push({ parts: [path], isStrict: true, why: "file too large to read" });
        continue;
      }
      counts.packageRead += 1;
      checkData([path], path, memberData, 0, true);
      continue;
    }
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      // A package file must be on disk (P7-F-01); a file git lists but the working tree deleted has nothing to read.
      if (isPackage) unread.push({ parts: [path], isStrict: true, why: "package file could not be opened" });
      else counts.missing += 1;
      continue;
    }
    if (stat.isSymbolicLink()) {
      counts.links += 1;
      checkText([path], readlinkText(full), "link ");
      if (isPackage) unread.push({ parts: [path], isStrict: true, why: "package file is a link, not a regular file" });
      continue;
    }
    if (!stat.isFile()) {
      unread.push({ parts: [path], isStrict, why: "not a regular file" });
      continue;
    }
    counts.files += 1;
    if (stat.size > LIMITS.fileBytes) {
      unread.push({ parts: [path], isStrict, why: "file too large to read" });
      continue;
    }
    let data;
    try {
      data = new Uint8Array(readFileSync(full));
    } catch {
      unread.push({ parts: [path], isStrict: isStrict || isPackage, why: "file could not be opened" });
      continue;
    }
    if (isPackage) counts.packageRead += 1;
    checkData([path], path, data, 0, isStrict);
  }
  // The package scan read every listed file (P7-F-01): none missing, and at least one.
  const packageShort = packageScan && (counts.packageFiles === 0 || counts.packageRead !== counts.packageFiles);
  if (packageScan && counts.packageFiles === 0) process.stdout.write(`deny-list: ${options.tarball !== undefined ? "the tarball holds" : "`npm pack --dry-run` listed"} no package files, so nothing in the package was checked\n`);
  else if (packageShort) process.stdout.write(`deny-list: only ${counts.packageRead} of ${counts.packageFiles} package files could be read\n`);

  for (const match of matches) process.stdout.write(`deny-list: match in ${match}\n`);
  for (const home of homes) process.stdout.write(`deny-list: home folder path in ${home}\n`);
  const strictUnread = unread.filter((u) => u.isStrict);
  for (const u of strictUnread) process.stdout.write(`deny-list: not fully scanned (${u.why}) in a shipped path: ${label(u.parts)}\n`);
  const why = {};
  for (const u of unread) why[u.why] = (why[u.why] ?? 0) + 1;
  const reasons = Object.entries(why)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reason, n]) => `${n} ${reason}`)
    .join("; ");
  process.stdout.write(
    `deny-list: checked ${counts.files} files, ${counts.links} links, and ${counts.entries} archive members` +
      ` (${counts.binary} binary files read as raw bytes, ${counts.pdf} PDF files with inflated streams and decoded strings, ${counts.png} PNG files with decoded text chunks,` +
      ` ${counts.xml} XML files or members read in their declared encoding and as visible text, ${counts.zipMeta} ZIP comments and extra fields,` +
      ` ${counts.allowedHome} allowed dependency home path(s), ${counts.decoded} decoded text form(s) (character references, percent-encoding);` +
      ` ${counts.missing} listed path(s) missing from the working tree);` +
      ` ${matches.size} match(es); ${homes.size} home folder path(s);` +
      ` ${unread.length} not fully scanned${reasons === "" ? "" : ` (${reasons})`};` +
      ` ${strictUnread.length} shipped file(s) not fully scanned;` +
      ` ${counts.packageRead} of ${counts.packageFiles} package files read.\n`,
  );
  return matches.size > 0 || homes.size > 0 || strictUnread.length > 0 || packageShort ? 1 : 0;
}

function readlinkText(path) {
  try {
    return readlinkSync(path);
  } catch {
    return "";
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  failClosed(error);
}
