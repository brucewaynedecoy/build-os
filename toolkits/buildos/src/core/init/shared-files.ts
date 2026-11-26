/**
 * The three root files that a new BuildOS project shares with the user and
 * with other tools: `AGENTS.md`, `CLAUDE.md`, and `.gitignore` (PRD 20
 * Project Initialization and Adoption; owner decision 2026-11-24). The list
 * is closed: every other path that `buildos init` must add still clashes
 * when it exists.
 *
 * In these files BuildOS owns only its own section. A section is a begin
 * line, an integrity line, the package text, and an end line:
 *
 *     <!-- buildos:begin -->
 *     <!-- buildos:section v1 sha256=<hex> -->
 *     ...package text...
 *     <!-- buildos:end -->
 *
 * (`# buildos:begin`, `# buildos:section v1 sha256=<hex>`, and
 * `# buildos:end` in `.gitignore`). The hash covers the exact bytes after
 * the integrity line up to the end line, with each CRLF read as LF, so a
 * conversion of the whole file to CRLF keeps it valid.
 *
 * The ownership rule (W1 R7 P6 review round 3, orchestrator direction): the
 * proof that a section is BuildOS's is its integrity line, never where it
 * sits. BuildOS replaces a section only when its integrity line is there
 * and the hash matches its text: then BuildOS wrote every byte of it and no
 * one changed one, so the replace loses nothing. A pair of marker lines
 * without a valid integrity line is never replaced and never deleted:
 *
 * - inside a code block, raw HTML block, or HTML comment: it is the user's
 *   example. It stays, and the section is added as usual;
 * - outside every such region: the section was changed by hand, or it is an
 *   example. BuildOS stops before any write (exit 10) and says what to do.
 *
 * More than one valid section, or marker lines outside every region that do
 * not form one pair, also stop the command. The region scan (see
 * `scanMarkers`) is a second line of defense: data safety does not depend on
 * it, because without a valid integrity line BuildOS only ever adds bytes.
 *
 * Adding a section (a file with no valid section):
 *
 * - A missing file is created with only the section.
 * - A file gets the section at its end, after one empty line, with its own
 *   line breaks (CRLF or LF). A file that does not end with a line break gets
 *   one before the empty line, and the section then ends with no line break,
 *   as the file did.
 * - A file that ends inside a code block, raw HTML block, or comment that is
 *   never closed would hide a section added at its end. It gets the section
 *   at its start instead (after a UTF-8 byte order mark), with one empty
 *   line after it. No byte of the file changes.
 *
 * Line breaks are LF and CRLF. A bare CR (one not followed by LF) is
 * ordinary text: never a line break and never marker padding (W1 R7 P6
 * review round 4). A file whose buildos lines BuildOS finds only when it
 * reads a bare CR as a line break (old Mac line endings) stops the command
 * before any write.
 *
 * Encoding: BuildOS changes only UTF-8 text (or any ASCII-compatible text:
 * bytes outside the section are kept as they are). A file that starts with a
 * UTF-16 or UTF-32 byte order mark, or holds a zero byte, stops the command
 * before any write. A UTF-8 byte order mark stays.
 *
 * A link at one of these files is never followed for a write: when the OS
 * resolves it to another of the three files in the same folder (the same
 * entry, for example `CLAUDE.md` -> `AGENTS.md`), it is kept, because that
 * file gets the section; any other link stops the command. Each file is read
 * once per plan, with a bound (`FsPort.readFileLimited`): a file over
 * `SHARED_FILE_MAX_BYTES` stops the command. A file that BuildOS would
 * replace and that has more than one hard link stops the command too: the
 * replace would break the link (W1 R7 P6 review round 3).
 *
 * A rerun in a project that BuildOS already set up (`refresh`) only
 * refreshes a valid section that is there: it creates no file and adds no
 * section. Each file is still decided from its whole scan, so a section
 * changed by hand stops the rerun before any write, and every file that is
 * not refreshed is reported with the reason (`skip`).
 */

import type { FsDirEntry, FsPort } from "../shared/fs-port.ts";
import type { HashPort } from "../shared/hash-port.ts";

export interface SharedFileSpec {
  path: string;
  begin: string;
  end: string;
  /** The integrity line is `<integrityPrefix><64 hex digits><integritySuffix>`. */
  integrityPrefix: string;
  integritySuffix: string;
  /** Markdown files have code and raw regions; `.gitignore` has none. */
  markdown: boolean;
}

const MD_SECTION = { begin: "<!-- buildos:begin -->", end: "<!-- buildos:end -->", integrityPrefix: "<!-- buildos:section v1 sha256=", integritySuffix: " -->", markdown: true };

export const SHARED_FILES: readonly SharedFileSpec[] = [
  { path: "AGENTS.md", ...MD_SECTION },
  { path: "CLAUDE.md", ...MD_SECTION },
  { path: ".gitignore", begin: "# buildos:begin", end: "# buildos:end", integrityPrefix: "# buildos:section v1 sha256=", integritySuffix: "", markdown: false },
];

export const SHARED_PATHS: ReadonlySet<string> = new Set(SHARED_FILES.map((f) => f.path));

/** The root router files whose owner decides whether Make Docs can set up the folder (PRD 20 Make Docs Companion Setup). */
export const ROUTER_PATHS: readonly string[] = ["AGENTS.md", "CLAUDE.md"];

/** The largest shared file BuildOS reads: far above any real router or ignore file. */
export const SHARED_FILE_MAX_BYTES = 4 * 1024 * 1024;

/** `skip`: a rerun does not change this file (see `SharedSkipReason`). */
export type SharedAction = "create" | "add_block" | "update_block" | "unchanged" | "skip";

/** Why a rerun leaves a shared file as it is. */
export type SharedSkipReason = "no_section" | "missing" | "not_a_file" | "link" | "too_large" | "unsupported_encoding" | "unreadable";

export interface SharedFilePlan {
  /** The path as it is spelled on disk (a case-insensitive volume keeps the existing spelling). */
  path: string;
  action: SharedAction;
  /** For `skip`: why. */
  reason?: SharedSkipReason;
  /** For `add_block`: `top` when the section goes at the start of the file, because the file ends inside a region that is never closed. */
  position?: "top";
  /** The bytes that are there now (not for `create`). The write checks them again first. */
  before?: Uint8Array;
  /** The existing file's full permission bits (with setuid, setgid, and sticky), kept by the write and checked again before it. */
  mode?: number;
  /** The existing file's identity, from the same read as `before`: the write checks it again first. */
  id?: string;
  /** The existing file's hard link count, from the same read: the write checks it again first. */
  links?: number;
  /** The new bytes, for `create`, `add_block`, and `update_block`. */
  data?: Uint8Array;
  /** Set when the entry is a link to another shared file, which gets the section. */
  linkTo?: string;
  /** The link's text, checked again before the run reports success. */
  linkTarget?: string;
}

export type SharedProblemCode =
  | "begin_without_end"
  | "end_without_begin"
  | "end_before_begin"
  | "more_than_one_section"
  | "section_changed"
  | "unsupported_encoding"
  | "link"
  | "too_large"
  | "hard_link"
  | "cr_line_endings";

export interface SharedFileProblem {
  path: string;
  problem: SharedProblemCode;
  /** The 1-based line the problem is on, when it is about one line. */
  line?: number;
  /** What is wrong, in plain words. */
  message: string;
  /** What the user can do. */
  fix: string;
}

const MARKER_FIX = "Delete the buildos lines that are not part of one BuildOS section, or delete all of them. Then run `buildos init` again.";
const CHANGED_FIX = "Move your own text outside the buildos lines, or delete the buildos lines. Then run `buildos init` again.";
const ENCODING_FIX = "Save the file as UTF-8 text, or move it away. Then run `buildos init` again.";

/** The stop for a file that BuildOS would replace and that has more than one hard link (W1 R7 P6 review round 3). */
export function hardLinkProblem(path: string, links: number): SharedFileProblem {
  return {
    path,
    problem: "hard_link",
    message: `${path} is shared with ${links === 2 ? "another file name" : `${links - 1} other file names`} through a hard link. BuildOS replaces files and would break that link, so the names would no longer share their text.`,
    fix: "Make it a file with one name: copy it, delete the original, and give the copy the original name. Or move it away. Then run `buildos init` again.",
  };
}

/** One entry as the plan sees it: what it is, and its path as spelled on disk. */
export interface FoundEntry {
  kind: FsDirEntry["kind"] | "missing";
  path: string;
}

/** What one shared file is now, read once (see `readShared`). */
export type SharedRead =
  | { kind: "missing" | "directory" | "other" }
  | { kind: "symlink"; target: string; sibling?: string }
  | { kind: "unreadable"; error: unknown }
  | { kind: "file"; tooLarge: true }
  | { kind: "file"; tooLarge: false; data: Uint8Array; mode: number; id: string; links: number };

/**
 * Reads one root shared file for the plan: a regular file with a bound, or
 * a link's text and the sibling shared file the OS resolves it to (the same
 * entry), if any. A file the OS does not let BuildOS read is `unreadable`:
 * the caller decides whether it needs it (W1 R7 P6 review round 3).
 */
export function readShared(fs: FsPort, found: FoundEntry, look: (path: string) => FoundEntry): SharedRead {
  if (found.kind === "missing" || found.kind === "directory" || found.kind === "other") return { kind: found.kind };
  if (found.kind === "symlink") {
    const target = fs.readLink(found.path)?.target ?? "";
    const resolved = fs.resolvedId(found.path);
    const sibling = SHARED_FILES.map((s) => look(s.path)).find((s) => s.path !== found.path && s.kind === "file" && resolved !== undefined && fs.entryId(s.path)?.id === resolved.id);
    return { kind: "symlink", target, ...(sibling === undefined ? {} : { sibling: sibling.path }) };
  }
  let read;
  try {
    read = fs.readFileLimited(found.path, SHARED_FILE_MAX_BYTES);
  } catch (error) {
    if (isDenied(error)) return { kind: "unreadable", error };
    throw error;
  }
  if (read.tooLarge) return { kind: "file", tooLarge: true };
  return { kind: "file", tooLarge: false, data: read.data, mode: read.mode, id: read.id, links: read.links };
}

/** True for a read the OS refused for permissions (`EACCES`, `EPERM`). */
function isDenied(error: unknown): boolean {
  const fsInfo = (error as { fs?: { errno?: unknown } } | null)?.fs;
  const code = fsInfo?.errno ?? (error as { code?: unknown } | null)?.code;
  return code === "EACCES" || code === "EPERM";
}

/**
 * Reads each root shared file at most once per plan (W1 R7 P6 review round
 * 3): the shared-file plan and the Make Docs ownership lookup use the same
 * snapshot.
 */
export function sharedReader(fs: FsPort, look: (path: string) => FoundEntry): (path: string) => SharedRead {
  const reads = new Map<string, SharedRead>();
  return (path) => {
    const found = look(path);
    let read = reads.get(found.path);
    if (read === undefined) {
      read = readShared(fs, found, look);
      reads.set(found.path, read);
    }
    return read;
  };
}

/**
 * Plans the shared files. `bodies` holds the package text for each shared
 * path the package has. `look` says what each root entry is, from its
 * folder listing (so a link is seen as a link), with its spelling on disk.
 * `read` reads each file once per plan. `refresh` is a rerun in a project
 * that BuildOS already set up.
 */
export function planSharedFiles(
  bodies: ReadonlyMap<string, Uint8Array>,
  look: (path: string) => FoundEntry,
  read: (path: string) => SharedRead,
  hash: HashPort,
  refresh = false,
): { plans: SharedFilePlan[]; problems: SharedFileProblem[]; clashes: { path: string; found: "folder" | "other" }[] } {
  const plans: SharedFilePlan[] = [];
  const problems: SharedFileProblem[] = [];
  const clashes: { path: string; found: "folder" | "other" }[] = [];
  const links: { path: string; target: string; sibling: string }[] = [];
  const skip = (path: string, reason: SharedSkipReason) => plans.push({ path, action: "skip", reason });
  for (const spec of SHARED_FILES) {
    const body = bodies.get(spec.path);
    if (body === undefined) continue;
    const found = look(spec.path);
    const now = read(spec.path);
    if (now.kind === "missing") {
      if (refresh) skip(found.path, "missing");
      else plans.push({ path: found.path, action: "create", data: sectionBytes(spec, body, "\n", "\n", hash) });
    } else if (now.kind !== "file" && now.kind !== "symlink" && now.kind !== "unreadable") {
      if (refresh) skip(found.path, "not_a_file");
      else clashes.push({ path: found.path, found: now.kind === "directory" ? "folder" : "other" });
    } else if (now.kind === "unreadable") {
      // BuildOS needs this file's text to add its section; a rerun only reports it.
      if (refresh) skip(found.path, "unreadable");
      else throw now.error;
    } else if (now.kind === "symlink") {
      const sibling = now.sibling === undefined ? undefined : SHARED_FILES.find((s) => look(s.path).path === now.sibling && bodies.has(s.path));
      if (sibling !== undefined) links.push({ path: found.path, target: now.target, sibling: sibling.path });
      else if (refresh) skip(found.path, "link");
      else {
        problems.push({
          path: found.path,
          problem: "link",
          message: `${found.path} is a link that does not lead to another of these shared files in this folder. BuildOS does not change a file through a link.`,
          fix: "Put a regular file in place of the link, or move the link away. Then run `buildos init` again.",
        });
      }
    } else if (now.tooLarge) {
      if (refresh) skip(found.path, "too_large");
      else {
        problems.push({
          path: found.path,
          problem: "too_large",
          message: `${found.path} is larger than ${SHARED_FILE_MAX_BYTES / (1024 * 1024)} MiB, so BuildOS does not read it.`,
          fix: "Make the file smaller, or move it away. Then run `buildos init` again.",
        });
      }
    } else {
      const before = now.data;
      const encoding = unsupportedEncoding(before);
      if (encoding !== undefined) {
        // BuildOS never writes such a file, so it holds no BuildOS section to refresh.
        if (refresh) skip(found.path, "unsupported_encoding");
        else problems.push({ path: found.path, problem: "unsupported_encoding", message: encodingMessage(found.path, encoding), fix: ENCODING_FIX });
        continue;
      }
      // W1 R7 P6 review round 3: every file is decided from its whole scan, also in a rerun.
      const merged = mergeSection(spec, before, body, hash);
      if ("problem" in merged) {
        problems.push({ path: found.path, problem: merged.problem, line: merged.line, message: problemMessage(spec, found.path, merged), fix: problemFix(merged.problem) });
        continue;
      }
      // A rerun refreshes only a valid section that is there.
      if (refresh && merged.action === "add_block") {
        skip(found.path, "no_section");
        continue;
      }
      // Only a file that BuildOS will write: an unchanged file keeps every byte and every link.
      if (merged.action !== "unchanged" && now.links > 1) {
        problems.push(hardLinkProblem(found.path, now.links));
        continue;
      }
      plans.push({
        path: found.path,
        action: merged.action,
        before,
        mode: now.mode,
        id: now.id,
        links: now.links,
        ...(merged.action === "unchanged" ? {} : { data: merged.data }),
        ...(merged.position === undefined ? {} : { position: merged.position }),
      });
    }
  }
  // A link to another shared file is kept, because that file gets the section; on a rerun, only when it has one.
  for (const link of links) {
    const target = look(link.sibling).path;
    const sibling = plans.find((p) => p.path === target);
    if (sibling !== undefined && sibling.action !== "skip") plans.push({ path: link.path, action: "unchanged", linkTo: target, linkTarget: link.target });
    else if (refresh) skip(link.path, "no_section");
  }
  plans.sort((a, b) => SHARED_FILES.findIndex((s) => look(s.path).path === a.path) - SHARED_FILES.findIndex((s) => look(s.path).path === b.path));
  return { plans, problems, clashes };
}

/** What makes a file's encoding unsupported, or `undefined` when BuildOS can change it. */
export function unsupportedEncoding(data: Uint8Array): "UTF-32" | "UTF-16" | "zero byte" | undefined {
  const [a, b, c, d] = [data[0], data[1], data[2], data[3]];
  if ((a === 0xff && b === 0xfe && c === 0x00 && d === 0x00) || (a === 0x00 && b === 0x00 && c === 0xfe && d === 0xff)) return "UTF-32";
  if ((a === 0xff && b === 0xfe) || (a === 0xfe && b === 0xff)) return "UTF-16";
  if (data.includes(0)) return "zero byte";
  return undefined;
}

function encodingMessage(path: string, encoding: "UTF-32" | "UTF-16" | "zero byte"): string {
  return encoding === "zero byte"
    ? `${path} holds a zero byte, so it is not plain text that BuildOS can safely change.`
    : `${path} is saved as ${encoding} text. BuildOS changes only UTF-8 text, so it did not change this file.`;
}

const CR_FIX = "Save the file with LF or CRLF line endings. Then run `buildos init` again.";

function problemFix(problem: SharedProblemCode): string {
  if (problem === "section_changed") return CHANGED_FIX;
  if (problem === "cr_line_endings") return CR_FIX;
  return MARKER_FIX;
}

function problemMessage(spec: SharedFileSpec, path: string, merged: { problem: SharedProblemCode; line: number }): string {
  const at = `${path} line ${merged.line}`;
  switch (merged.problem) {
    case "begin_without_end":
      return `${at} is a "${spec.begin}" line, but no "${spec.end}" line comes after it.`;
    case "end_without_begin":
      return `${at} is a "${spec.end}" line, but no "${spec.begin}" line comes before it.`;
    case "end_before_begin":
      return `${at} is a "${spec.end}" line that comes before the "${spec.begin}" line.`;
    case "cr_line_endings":
      return `${path} uses old Mac line endings (CR only) at line ${merged.line}: BuildOS finds a buildos line there only when it reads a CR as a line break, so it cannot tell where that line starts and ends, and it did not change this file.`;
    case "section_changed":
      return `${at} starts a BuildOS section that was changed by hand, or that is an example. BuildOS replaces only a section that it wrote and that no one changed, so it did not change this file.`;
    default:
      return `${at} starts a second BuildOS section: this file has more than one "${spec.begin}" or "${spec.end}" line.`;
  }
}

/**
 * True when a package body is safe to put inside a section: it holds no
 * buildos marker or integrity text anywhere (not even indented or in the
 * middle of a line), and a Markdown body closes every region it opens, so
 * the end line after it is always outside every region.
 */
export function isSafeSectionBody(spec: SharedFileSpec, body: Uint8Array): boolean {
  const text = new TextDecoder("utf-8").decode(body);
  if (text.includes("buildos:begin") || text.includes("buildos:end") || text.includes("buildos:section")) return false;
  return !spec.markdown || scanMarkers(spec, body, lineSpans(body)).unclosed === undefined;
}

/**
 * True when a Markdown file holds one section of Make Docs's own markers
 * (`<!-- make-docs:begin -->` before `<!-- make-docs:end -->`, whole lines at
 * column 0 outside every region): Make Docs wrote that router.
 */
export function hasMakeDocsSection(data: Uint8Array): boolean {
  const { markers } = scanMarkers(MAKE_DOCS_MARKERS, data, lineSpans(data));
  const outside = markers.filter((m) => m.region === undefined);
  return outside.length === 2 && outside[0]!.kind === "begin" && outside[1]!.kind === "end";
}

/** The markers Make Docs 2.0.9 writes around its own section of `AGENTS.md` and `CLAUDE.md`. */
const MAKE_DOCS_MARKERS: SharedFileSpec = { path: "AGENTS.md", begin: "<!-- make-docs:begin -->", end: "<!-- make-docs:end -->", integrityPrefix: "", integritySuffix: "", markdown: true };

type Merge =
  | { action: "add_block" | "update_block" | "unchanged"; data: Uint8Array; position?: "top" }
  | { problem: Exclude<SharedProblemCode, "link" | "too_large" | "unsupported_encoding" | "hard_link">; line: number };

/** One valid BuildOS section: the 0-based lines of its begin and end markers, and the hash its integrity line names. */
interface OwnedSection {
  begin: number;
  end: number;
  hash: string;
}

/**
 * The new bytes of an existing shared file, or the problem that stops the
 * command (with its 1-based line). See the file comment for the rule.
 */
export function mergeSection(spec: SharedFileSpec, before: Uint8Array, body: Uint8Array, hash: HashPort): Merge {
  const spans = lineSpans(before);
  const { markers, unclosed } = scanMarkers(spec, before, spans);
  // W1 R7 P6 review round 4: buildos lines that only a bare CR makes into lines stop the command before any write.
  const crOnly = crOnlyMarker(spec, before);
  if (crOnly !== undefined) return { problem: "cr_line_endings", line: crOnly + 1 };
  const eol = lineBreak(before);
  const owned = ownedSections(spec, before, spans, markers, hash);
  const ownedLines = new Set(owned.flatMap((s) => [s.begin, s.end]));
  // Marker lines that are not part of a valid section and are outside every region: the user's text where only a section can be.
  const loose = markers.filter((m) => m.region === undefined && !ownedLines.has(m.line));
  if (owned.length > 1) return { problem: "more_than_one_section", line: owned[1]!.begin + 1 };
  if (loose.length > 0) {
    const begins = loose.filter((m) => m.kind === "begin").map((m) => m.line);
    const ends = loose.filter((m) => m.kind === "end").map((m) => m.line);
    if (owned.length === 1) return { problem: "more_than_one_section", line: loose[0]!.line + 1 };
    if (begins.length === 1 && ends.length === 1) {
      if (ends[0]! < begins[0]!) return { problem: "end_before_begin", line: ends[0]! + 1 };
      return { problem: "section_changed", line: begins[0]! + 1 };
    }
    if (begins.length === 1 && ends.length === 0) return { problem: "begin_without_end", line: begins[0]! + 1 };
    if (begins.length === 0 && ends.length === 1) return { problem: "end_without_begin", line: ends[0]! + 1 };
    if (begins.length === 0) return { problem: "end_without_begin", line: ends[0]! + 1 };
    return { problem: "more_than_one_section", line: (begins.length > 1 ? begins[1]! : ends[1]!) + 1 };
  }
  if (owned.length === 1) {
    const { begin: b, end: e } = owned[0]!;
    // W1 R7 P6 review round 4: the verified text (CRLF read as LF) is the package text now, so nothing is written and every byte stays.
    if (owned[0]!.hash === packageHash(body, hash)) return { action: "unchanged", data: before };
    // A UTF-8 byte order mark before a section on the first line stays.
    const start = b === 0 && isBom(before, 0) ? 3 : spans[b]![0];
    const [endStart, endStop] = spans[e]!;
    const endLine = before.subarray(endStart, endStop);
    const term = endLine[endLine.length - 1] === 0x0a ? (endLine.length > 1 && endLine[endLine.length - 2] === 0x0d ? "\r\n" : "\n") : "";
    const data = concat(before.subarray(0, start), sectionBytes(spec, body, eol, term, hash), before.subarray(endStop));
    return { action: equalBytes(data, before) ? "unchanged" : "update_block", data };
  }
  // No valid section: add one. No byte of the file changes.
  if (before.length === 0) return { action: "add_block", data: sectionBytes(spec, body, "\n", "\n", hash) };
  const bom = isBom(before, 0) ? 3 : 0;
  if (before.length === bom) return { action: "add_block", data: concat(before, sectionBytes(spec, body, "\n", "\n", hash)) };
  const enc = new TextEncoder();
  if (unclosed !== undefined) {
    // At the end, the section would be inside the region that is never closed: put it at the start.
    return { action: "add_block", position: "top", data: concat(before.subarray(0, bom), sectionBytes(spec, body, eol, eol, hash), enc.encode(eol), before.subarray(bom)) };
  }
  const endsWithBreak = before[before.length - 1] === 0x0a;
  const gap = enc.encode(endsWithBreak ? eol : eol + eol);
  return { action: "add_block", data: concat(before, gap, sectionBytes(spec, body, eol, endsWithBreak ? eol : "", hash)) };
}

/**
 * The valid sections: a begin marker line at column 0, the integrity line
 * right after it, the next end marker line at column 0 after that, and a
 * hash that matches the text between. Wherever they sit: the hash, not the
 * region scan, proves that BuildOS wrote them.
 */
function ownedSections(spec: SharedFileSpec, data: Uint8Array, spans: readonly [number, number][], markers: readonly MarkerLine[], hasher: HashPort): OwnedSection[] {
  const out: OwnedSection[] = [];
  for (const m of markers) {
    if (m.kind !== "begin") continue;
    const hash = integrityHash(spec, data, spans[m.line + 1]);
    if (hash === undefined) continue;
    const end = markers.find((n) => n.kind === "end" && n.line > m.line + 1);
    if (end === undefined) continue;
    const from = spans[m.line + 2]?.[0] ?? data.length;
    const to = spans[end.line]![0];
    if (from > to) continue;
    if (hasher.sha256Hex(lfOnly(data.subarray(from, to))) === hash) out.push({ begin: m.line, end: end.line, hash });
  }
  return out;
}

/** The hash an integrity line names, or `undefined` when the line is not one (same whole-line rule as the markers). */
function integrityHash(spec: SharedFileSpec, data: Uint8Array, span: [number, number] | undefined): string | undefined {
  if (span === undefined || spec.integrityPrefix === "") return undefined;
  const [from, stop] = span;
  const line = asciiText(data, from, contentEnd(data, from, stop));
  if (!line.startsWith(spec.integrityPrefix) || !line.endsWith(spec.integritySuffix)) return undefined;
  const hex = line.slice(spec.integrityPrefix.length, line.length - spec.integritySuffix.length);
  return /^[0-9a-f]{64}$/.test(hex) ? hex : undefined;
}

/** The package text as lines, each without its line break (CRLF and LF both end a line). */
function packageLines(body: Uint8Array): string[] {
  const lines = new TextDecoder("utf-8").decode(body).split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** The hash of the package text, as an integrity line names it. */
function packageHash(body: Uint8Array, hash: HashPort): string {
  return hash.sha256Hex(new TextEncoder().encode(packageLines(body).map((l) => `${l}\n`).join("")));
}

/** The bytes with each CRLF read as LF: what the integrity hash covers. */
function lfOnly(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  let n = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0x0d && data[i + 1] === 0x0a) continue;
    out[n++] = data[i]!;
  }
  return out.subarray(0, n);
}

/** The section: the begin line, the integrity line, the package text, and the end line, joined with `eol`, ending in `last`. */
export function sectionBytes(spec: SharedFileSpec, body: Uint8Array, eol: string, last: string, hash: HashPort): Uint8Array {
  const lines = packageLines(body);
  const digest = packageHash(body, hash);
  return new TextEncoder().encode([spec.begin, `${spec.integrityPrefix}${digest}${spec.integritySuffix}`, ...lines, spec.end].join(eol) + last);
}

/** Each line as `[start, stop)`, the stop after its `\n` (the last line may have none). */
function lineSpans(data: Uint8Array): [number, number][] {
  const out: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0x0a) {
      out.push([start, i + 1]);
      start = i + 1;
    }
  }
  if (start < data.length) out.push([start, data.length]);
  return out;
}

const SPACE = 0x20;
const TAB = 0x09;

/** What kind of region hides a line from the marker rule. */
export type RegionKind = "code" | "html" | "comment";

/** An open region: where it started, and how it ends. */
type Region = { kind: "code"; line: number; char: string; length: number; quotes: number } | { kind: "html"; line: number; tag: string } | { kind: "comment"; line: number };

/** A marker line at column 0, and the region it is inside, if any. */
interface MarkerLine {
  line: number;
  kind: "begin" | "end";
  region?: RegionKind;
}

/**
 * The marker scan. A line is a marker line only when, without its line
 * break and its trailing spaces and tabs, it is exactly the marker, starting
 * at column 0 (after a UTF-8 byte order mark on the first line). In
 * Markdown, the scan also tracks regions, and records for each marker line
 * whether it is inside one (W1 R7 P6 review rounds 2 and 3):
 *
 * - fenced code, opened by three or more backticks or tildes at any
 *   indentation, also inside list items and block quotes, and closed by a
 *   line of the same character, at least as long, after the same number of
 *   block quote markers;
 * - raw HTML `<pre>`, `<script>`, `<style>`, and `<textarea>`, opened
 *   anywhere in a line outside code spans, and closed only by its own
 *   closing tag;
 * - HTML comments, opened by `<!--` anywhere in a line outside code spans,
 *   and closed only by `-->`. A marker line inside an open comment is
 *   that comment's text: its own `-->` does not end the comment.
 *
 * A begin line inside a region starts the user's example: every line
 * through the next end line is that example, whatever comment closers or
 * fences its lines hold (an integrity line ends in `-->` too), and the
 * region open at the begin line is still open after the end line (W1 R7 P6
 * review round 4). Its marker lines are recorded as inside that region.
 *
 * A comment or raw block does not open a fence, and a fence line inside one
 * is not a fence. After a region closes, the rest of its line is scanned
 * again. The scan errs toward "inside a region". It is a second line of
 * defense: the integrity line decides ownership (see `mergeSection`).
 */
function scanMarkers(spec: SharedFileSpec, data: Uint8Array, spans: readonly [number, number][]): { markers: MarkerLine[]; unclosed?: { line: number; kind: RegionKind } } {
  const markers: MarkerLine[] = [];
  const kinds = spans.map((span, index) => markerKind(spec, data, span, index));
  let region: Region | undefined;
  for (let index = 0; index < spans.length; index++) {
    const kind = kinds[index];
    if (!spec.markdown) {
      if (kind !== undefined) markers.push({ line: index, kind });
      continue;
    }
    const [start, stop] = spans[index]!;
    const from = index === 0 && isBom(data, 0) ? start + 3 : start;
    const line = asciiText(data, from, contentEnd(data, from, stop));
    const inside = region;
    if (kind !== undefined) markers.push({ line: index, kind, ...(inside === undefined ? {} : { region: inside.kind }) });
    if (kind === "begin" && inside !== undefined) {
      // The user's example: everything through its end line, with the region kept as it was at the begin line.
      const endAt = kinds.findIndex((k, i) => i > index && k === "end");
      if (endAt >= 0) {
        for (let i = index + 1; i <= endAt; i++) if (kinds[i] !== undefined) markers.push({ line: i, kind: kinds[i]!, region: inside.kind });
        index = endAt;
        continue;
      }
    }
    // A marker line is a whole comment of its own: inside an open comment it is that comment's text, and does not end it (errs toward "inside").
    if (kind !== undefined && inside?.kind === "comment") continue;
    if (inside?.kind === "code") {
      if (fenceCloses(inside, line)) region = undefined;
      continue;
    }
    if (inside === undefined) {
      const fence = fenceOpens(line, index);
      if (fence !== undefined) {
        region = fence;
        continue;
      }
    }
    region = htmlRegions(line, index, inside);
  }
  return { markers, ...(region === undefined ? {} : { unclosed: { line: region.line, kind: region.kind } }) };
}

/** Whether a line is a begin or end marker line: exactly the marker at column 0 (after a BOM on the first line), then only spaces and tabs. */
function markerKind(spec: SharedFileSpec, data: Uint8Array, [start, stop]: [number, number], index: number): "begin" | "end" | undefined {
  const from = index === 0 && isBom(data, 0) ? start + 3 : start;
  const to = contentEnd(data, from, stop);
  const enc = new TextEncoder();
  if (sameBytes(data, from, to, enc.encode(spec.begin))) return "begin";
  if (sameBytes(data, from, to, enc.encode(spec.end))) return "end";
  return undefined;
}

/**
 * Where a line's text ends: before its line break (LF, or CRLF) and the
 * spaces and tabs before it. A bare CR is text, not padding (W1 R7 P6 review
 * round 4).
 */
function contentEnd(data: Uint8Array, from: number, stop: number): number {
  let to = stop;
  if (to > from && data[to - 1] === 0x0a) {
    to--;
    if (to > from && data[to - 1] === 0x0d) to--;
  }
  while (to > from && (data[to - 1] === SPACE || data[to - 1] === TAB)) to--;
  return to;
}

/**
 * W1 R7 P6 review round 4: the 0-based line (LF or CRLF lines) of a buildos
 * line that is one only when a bare CR is read as a line break, or
 * `undefined`. Such a file (old Mac line endings) stops the command before
 * any write: reading a CR as text would miss its section, and reading it as
 * a line break could drop bytes.
 */
function crOnlyMarker(spec: SharedFileSpec, data: Uint8Array): number | undefined {
  if (!data.includes(0x0d)) return undefined;
  const words = [spec.begin, spec.end].map((w) => new TextEncoder().encode(w));
  let line = 0;
  let start = 0;
  let afterBareCr = false;
  for (let i = 0; i <= data.length; i++) {
    if (i < data.length && data[i] !== 0x0a && data[i] !== 0x0d) continue;
    // A piece ends at an LF, a CRLF, a bare CR, or the end of the file.
    const bareCr = i < data.length && data[i] === 0x0d && data[i + 1] !== 0x0a;
    if (bareCr || afterBareCr) {
      const from = start === 0 && isBom(data, 0) ? 3 : start;
      let to = i;
      while (to > from && (data[to - 1] === SPACE || data[to - 1] === TAB)) to--;
      if (words.some((w) => sameBytes(data, from, to, w))) return line;
    }
    if (i === data.length) break;
    if (data[i] === 0x0d && data[i + 1] === 0x0a) i++;
    if (data[i] === 0x0a) line++;
    afterBareCr = bareCr;
    start = i + 1;
  }
  return undefined;
}

/** The bytes of a line as text, one character per byte (only ASCII patterns are matched). */
function asciiText(data: Uint8Array, from: number, to: number): string {
  let out = "";
  for (let i = from; i < to; i++) out += String.fromCharCode(data[i]!);
  return out;
}

/** The line without its container prefix: spaces and tabs, block quote markers, and list markers. Returns the text and the number of `>` markers. */
function blockContent(line: string): { text: string; quotes: number } {
  let rest = line;
  let quotes = 0;
  for (;;) {
    const trimmed = rest.replace(/^[ \t]+/, "");
    if (trimmed.startsWith(">")) {
      quotes++;
      rest = trimmed.slice(1);
      continue;
    }
    const list = /^(?:[-*+]|[0-9]{1,9}[.)])(?=[ \t]|$)/.exec(trimmed);
    if (list !== null) {
      rest = trimmed.slice(list[0].length);
      continue;
    }
    return { text: trimmed, quotes };
  }
}

/** The fence a line opens, or `undefined`. */
function fenceOpens(line: string, index: number): Region | undefined {
  const { text, quotes } = blockContent(line);
  const fence = /^(`{3,}|~{3,})(.*)$/.exec(text);
  if (fence === null || (fence[1]!.startsWith("`") && fence[2]!.includes("`"))) return undefined;
  return { kind: "code", line: index, char: fence[1]![0]!, length: fence[1]!.length, quotes };
}

/** True when `line` closes the open fence (the line itself is still inside it). */
function fenceCloses(region: Extract<Region, { kind: "code" }>, line: string): boolean {
  // The same number of block quote markers, then only the fence characters.
  let rest = line;
  for (let q = 0; q < region.quotes; q++) {
    const trimmed = rest.replace(/^[ \t]+/, "");
    if (!trimmed.startsWith(">")) return false;
    rest = trimmed.slice(1);
  }
  const text = rest.replace(/^[ \t]+/, "");
  if (text.startsWith(">")) return false;
  const run = /^(`+|~+)$/.exec(text);
  return run !== null && run[1]![0] === region.char && run[1]!.length >= region.length;
}

const RAW_OPEN = /<(pre|script|style|textarea)(?=[\s>/]|$)/iy;

/**
 * Follows HTML comments and raw HTML blocks through one line: from the
 * region open at its start (`inside`), returns the region open at its end.
 * A region closes only at its own closer, and the rest of the line is
 * scanned again. Outside a region, a code span (a run of backticks up to
 * the same run) is skipped, so `` `<pre>` `` opens nothing.
 */
function htmlRegions(line: string, index: number, inside: Region | undefined): Region | undefined {
  let region = inside;
  let at = 0;
  while (at <= line.length) {
    if (region !== undefined) {
      const closer = region.kind === "comment" ? /-->/g : new RegExp(`</${region.kind === "html" ? region.tag : ""}\\s*>`, "gi");
      closer.lastIndex = at;
      const found = closer.exec(line);
      if (found === null) return region;
      at = found.index + found[0].length;
      region = undefined;
      continue;
    }
    const next = nextOpener(line, at);
    if (next === undefined) return undefined;
    if (next.kind === "comment") region = { kind: "comment", line: index };
    else region = { kind: "html", line: index, tag: next.tag };
    at = next.after;
  }
  return region;
}

/** The next comment or raw HTML opener at or after `from`, outside code spans. */
function nextOpener(line: string, from: number): { kind: "comment"; after: number } | { kind: "html"; tag: string; after: number } | undefined {
  let i = from;
  while (i < line.length) {
    const c = line[i];
    if (c === "`") {
      let run = 1;
      while (line[i + run] === "`") run++;
      const ticks = "`".repeat(run);
      let close = line.indexOf(ticks, i + run);
      // A closing run must be exactly as long.
      while (close >= 0 && line[close + run] === "`") {
        let more = close;
        while (line[more] === "`") more++;
        close = line.indexOf(ticks, more);
      }
      i = close < 0 ? i + run : close + run;
      continue;
    }
    if (c === "<") {
      if (line.startsWith("<!--", i)) return { kind: "comment", after: i + 4 };
      RAW_OPEN.lastIndex = i;
      const raw = RAW_OPEN.exec(line);
      if (raw !== null) return { kind: "html", tag: raw[1]!.toLowerCase(), after: i + raw[0].length };
    }
    i++;
  }
  return undefined;
}

function sameBytes(data: Uint8Array, from: number, to: number, want: Uint8Array): boolean {
  if (to - from !== want.length) return false;
  for (let i = 0; i < want.length; i++) if (data[from + i] !== want[i]) return false;
  return true;
}

/** The file's own line break: that of its first line, else LF. */
function lineBreak(data: Uint8Array): string {
  const i = data.indexOf(0x0a);
  return i > 0 && data[i - 1] === 0x0d ? "\r\n" : "\n";
}

function isBom(data: Uint8Array, at: number): boolean {
  return data[at] === 0xef && data[at + 1] === 0xbb && data[at + 2] === 0xbf;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
