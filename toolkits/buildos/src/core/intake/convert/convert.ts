/**
 * `buildos intake convert`, ported from the Go intake tool (`convert.go`,
 * `docx.go`, `xlsx.go`, `html.go`, and `pdf.go`). It keeps Go's order of
 * work: resolve the paths, stat and hash the source, convert (writing
 * embedded media and diagram side artifacts as the converter meets them,
 * unless it is a dry run), and then write each converted twin with its
 * front matter. Every failure is a `GoError` with Go's text.
 */

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { GoError } from "../../shared/go-fs.ts";
import { goIsNotExist, goPathError, goStatOp } from "../../shared/go-os-error.ts";
import { goAbs, goBase, goClean, goDir, goJoinAll, type GoPathPlatform } from "../../shared/go-path.ts";
import { goQuote } from "../../shared/go-quote.ts";
import { isInstalledLayout, userPathRel } from "../../shared/buildos-layout.ts";
import { rootAsGiven } from "../../shared/root.ts";
import { goExt, goFromSlash, goIsAbs, goRel, goToLower, goToSlash, goTrimSpace, normalizeSpace, slugify, utf8Bytes, utf8Text } from "../go-text.ts";
import { IntakeFs, newWritePlan, type IntakeContext } from "../io.ts";
import { readCsv, writeCsv } from "./csv.ts";
import { docxTokens, documentXmlToMarkdown, parseNumbering } from "./docx.ts";
import { htmlAttr, htmlToMarkdown, renderHtml } from "./html.ts";
import type { HtmlNode, XmlElement, ZipEntry } from "./parsers.ts";
import { goXmlParse, goXmlTokens } from "./go-xml.ts";
import { IntakeLimitError } from "../limits.ts";
import { checkReadBack, formatLimit, READ_LIMITS } from "../../shared/read-limits.ts";
import { goPdfOpenError, pdfPagesToText } from "./pdf.ts";
import { resolvePackageRelationshipTarget, sharedStrings, workbookRelationships, workbookSheets, worksheetToCsv } from "./xlsx.ts";

/** The converter ID written into every twin's front matter. */
export const CONVERTER_ID = "buildos-intake/0.1.0";

export interface ConvertOptions {
  repoRoot: string;
  source: string;
  assetsRoot: string;
  type: string;
  force: boolean;
  dryRun: boolean;
}

/** One converted twin: its Go path, the front matter fields, and its body bytes. */
export interface ConvertedOutput {
  path: string;
  source: string;
  sha256: string;
  type: string;
  status: string;
  body: Uint8Array;
}

export interface ConvertResult {
  outputs: ConvertedOutput[];
  /** Side artifact paths, in the order Go reports them. */
  sideArtifacts: string[];
  /**
   * W1 R7 P7 review round 3 (P7-R3-02, P7-R3-06): one plain line per HTML
   * image that BuildOS did not copy for a reason of its own (the file is
   * outside the allowed folders, or over the read bound). The twin keeps
   * Go's `[Uncopied image: ...](...)` link; the CLI prints each line on
   * stderr. An image Go could not read either (missing, unsupported) gets
   * the link only, as in Go.
   */
  warnings: string[];
}

/** Why BuildOS did not copy an image it could name (P7-R3-02, P7-R3-06, P7-R4-03). */
export type ImageRefusal = { reason: "outside" } | { reason: "too-large"; limit: number } | { reason: "invalid-path" };

/**
 * The plain reason for an image BuildOS did not copy. W1 R7 P7 review round 4
 * (P7-R4-03): the converted file keeps Go's `[Uncopied image: <alt>](<src>)`
 * marker, and `<src>` is the address as the document wrote it, relative to
 * the document, not to the converted file; the warning says so instead of
 * promising a working link.
 */
export function uncopiedImageWarning(src: string, document: string, read: ImageRefusal): string {
  const why =
    read.reason === "outside"
      ? "the file is outside the folder that holds the document and outside the project, so BuildOS did not read it"
      : read.reason === "invalid-path"
        ? "the image address holds an encoded zero byte, which no file name can hold, so BuildOS did not read it"
        : `the file is larger than ${formatLimit(read.limit)}, the most BuildOS reads from one file`;
  return `did not copy image ${src} from ${document}: ${why}. The converted file has an "Uncopied image" marker with the address as the document gives it; that address is relative to the document, not to the converted file.`;
}

/**
 * W1 R7 P7 review round 4 (P7-R4-03): the file path of a local image URL,
 * percent-decoded once (`my%20image.png` names `my image.png`), as a browser
 * reads it. `undefined` when the text has an invalid escape or does not
 * decode to UTF-8: such a path is used as written, as Go did. `"nul"` when it
 * decodes to a zero byte.
 */
export function decodeImagePath(path: string): string | "nul" | undefined {
  if (!path.includes("%")) return path;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return undefined;
  }
  return decoded.includes("\0") ? "nul" : decoded;
}

/** The path rules of the running system. */
export function hostPlatform(): GoPathPlatform {
  return rootAsGiven("a", "/") === "/a" ? "posix" : "win32";
}

/** Go `cleanRoot`. */
export function cleanRoot(root: string, cwd: string, platform: GoPathPlatform): string {
  return goClean(goAbs(root === "" ? "." : root, cwd, platform), platform);
}

/** Go `isInstalledSystemRoot`, with the one shared rule (`isInstalledLayout`, P7-R2-01). */
function isInstalledSystemRoot(fs: IntakeFs): boolean {
  return isInstalledLayout((rel) => {
    const result = fs.stat(goJoinAll(fs.platform, fs.repoRoot, ...rel.split("/")));
    return result.ok ? result.stat.kind : undefined;
  });
}

/** The BuildOS-owned default spellings of the intake path flags (the usage text). In an installed project each one names the path without `system/`. */
export const INTAKE_DEFAULT_PATHS = {
  assetsRoot: "system/assets",
  playbooksRoot: "system/playbooks",
  referencesOutput: "system/.os/indexes/references.json",
  playbooksOutput: "system/.os/indexes/playbooks.json",
} as const;

/**
 * Go `resolvePath`. W1 R7 P7 review round 3 (P7-R3-01): Go dropped a
 * leading `system/` from every relative path in an installed project, also
 * from a path the user named. Now only a BuildOS-owned default spelling
 * (`defaultSpelling`, the flag's documented default, given or not) gets
 * that translation; any other path the user names (`--source`, or an
 * `--assets-root`, `--output`, or `--playbooks-root` value that is not the
 * default spelling) follows `userPathRel`: as written, except that a legacy
 * `system/` spelling is dropped in an installed project that has no
 * `system` entry at its root (as in Go: the path as written cannot exist
 * there).
 */
export function resolvePath(fs: IntakeFs, path: string, defaultSpelling?: string): string {
  if (goIsAbs(path, fs.platform)) return goClean(path, fs.platform);
  let rel = goToSlash(path, fs.platform);
  const installed = isInstalledSystemRoot(fs);
  if (defaultSpelling !== undefined && rel === defaultSpelling) {
    if (installed && rel.startsWith("system/")) rel = rel.slice("system/".length);
  } else {
    rel = userPathRel(rel, installed, installed && fs.stat(goJoinAll(fs.platform, fs.repoRoot, "system")).ok);
  }
  return goClean(goJoinAll(fs.platform, fs.repoRoot, rel), fs.platform);
}

/** Go `repoRelative`. */
export function repoRelative(repoRoot: string, path: string, platform: GoPathPlatform): string {
  const rel = goRel(repoRoot, path, platform);
  if (rel === undefined || rel.startsWith("..")) return path;
  return rel;
}

/** Go `detectType`. */
function detectType(path: string, isDir: boolean, explicit: string, platform: GoPathPlatform): string {
  if (explicit === "") explicit = "auto";
  if (explicit !== "auto") return explicit;
  if (isDir) return "html-dir";
  switch (goToLower(goExt(path, platform))) {
    case ".csv":
      return "csv";
    case ".docx":
      return "docx";
    case ".xlsx":
      return "xlsx";
    case ".pdf":
      return "pdf";
    case ".html":
    case ".htm":
      return "html";
    default:
      throw new GoError(`cannot infer source type for ${path}; use --type`);
  }
}

const sha256Hex = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/**
 * Go `filepath.WalkDir(root, fn)` over a folder the caller has stat'd: the
 * root, then each entry in name order, depth first. `fn` gets each path and
 * whether its folder entry is a folder (a symlink is not).
 */
function walkDir(fs: IntakeFs, root: string, fn: (path: string, isDir: boolean) => void): void {
  const walk = (path: string, isDir: boolean) => {
    fn(path, isDir);
    if (!isDir) return;
    for (const entry of fs.readDir(path)) walk(goJoinAll(fs.platform, path, entry.name), entry.kind === "directory");
  };
  walk(root, true);
}

/** Go `sourceSHA256`. */
function sourceSha256(fs: IntakeFs, path: string, isDir: boolean): string {
  if (!isDir) return sha256Hex(fs.readFile(path));
  const rows: string[] = [];
  walkDir(fs, path, (p, dir) => {
    if (dir) return;
    const rel = goRel(path, p, fs.platform) ?? p;
    rows.push(`${goToSlash(rel, fs.platform)} ${sha256Hex(fs.readFile(p))}`);
  });
  rows.sort(byteOrder);
  return sha256Hex(utf8Bytes(rows.map((row) => `${row}\n`).join("")));
}

/** Go `sort.Strings`: byte order of UTF-8. */
function byteOrder(a: string, b: string): number {
  const x = utf8Bytes(a);
  const y = utf8Bytes(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return x.length - y.length;
}

/** Go `strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))`. */
function stem(path: string, platform: GoPathPlatform): string {
  const base = goBase(path, platform);
  const ext = goExt(path, platform);
  return ext !== "" && base.endsWith(ext) ? base.slice(0, base.length - ext.length) : base;
}

/** Go `sourceSlug`. */
function sourceSlug(path: string, isDir: boolean, platform: GoPathPlatform): string {
  return isDir ? slugify(goBase(path, platform), "source") : slugify(stem(path, platform), "source");
}

/** Go `assetSlug`. */
function assetSlug(path: string, suffix: string, platform: GoPathPlatform): string {
  const base = slugify(stem(path, platform), "asset");
  return suffix === "" ? base : `${base}-${slugify(suffix, "part")}`;
}

/** Go `outputFor`. */
function outputFor(platform: GoPathPlatform, assetsRoot: string, srcSlug: string, slug: string, ext: string, sourceRel: string, sum: string, type: string, body: Uint8Array): ConvertedOutput {
  return { path: goJoinAll(platform, assetsRoot, srcSlug, slug + ext), source: goToSlash(sourceRel, platform), sha256: sum, type, status: "converted", body };
}

/** Go `yamlQuote`. */
function yamlQuote(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

/** Go `time.Now().UTC().Format(time.RFC3339)`. */
function rfc3339(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Go `frontmatter`. */
function frontmatter(output: ConvertedOutput, now: Date): string {
  return [
    "---",
    `source: "${yamlQuote(output.source)}"`,
    `sha256: "${output.sha256}"`,
    `converter: "${CONVERTER_ID}"`,
    `timestamp: "${rfc3339(now)}"`,
    `type: "${output.type}"`,
    `status: "${output.status}"`,
    "---",
    "",
  ].join("\n");
}

/** Go `writeSideArtifact`. */
function writeSideArtifact(fs: IntakeFs, out: string, data: Uint8Array, force: boolean): void {
  if (!force && fs.statTarget(out).ok) throw new GoError(`side artifact exists, use --force to overwrite: ${out}`);
  fs.writeFileWithParents(out, data);
}

/**
 * The checks of `writeSideArtifact` for each side artifact, then of
 * `writeConvertedOutput` for each twin, in Go's order, with nothing
 * written: the first one that would fail throws Go's error for it.
 */
function preflightWrites(fs: IntakeFs, pending: readonly { out: string }[], outputs: readonly ConvertedOutput[], force: boolean, now: Date): void {
  // W1 R7 P7 review round 3 (P7-R3-04): `intake index references` reads each twin back (READ_LIMITS.intake).
  for (const output of outputs) {
    const size = utf8Bytes(frontmatter(output, now)).length + output.body.length;
    checkReadBack(goToSlash(repoRelative(fs.repoRoot, output.path, fs.platform), fs.platform), size, READ_LIMITS.intake, fs.repoRoot);
  }
  const plan = newWritePlan();
  for (const item of pending) {
    if (!force && fs.plannedStat(plan, item.out).ok) throw new GoError(`side artifact exists, use --force to overwrite: ${item.out}`);
    fs.checkWrite(plan, item.out);
  }
  for (const output of outputs) {
    if (!force) {
      const existing = fs.plannedStat(plan, output.path);
      if (existing.ok) throw new GoError(`output exists, use --force to overwrite: ${output.path}`);
      if (!goIsNotExist(existing.detail)) throw new GoError(goPathError(goStatOp(), output.path, existing.detail));
    }
    fs.checkWrite(plan, output.path);
  }
}

/** Go `writeConvertedOutput`. */
function writeConvertedOutput(fs: IntakeFs, output: ConvertedOutput, force: boolean, now: Date): void {
  if (!force) {
    const existing = fs.statTarget(output.path);
    if (existing.ok) throw new GoError(`output exists, use --force to overwrite: ${output.path}`);
    if (!goIsNotExist(existing.detail)) throw new GoError(goPathError(goStatOp(), output.path, existing.detail));
  }
  const head = utf8Bytes(frontmatter(output, now));
  const data = new Uint8Array(head.length + output.body.length);
  data.set(head, 0);
  data.set(output.body, head.length);
  fs.writeFileWithParents(output.path, data);
}

interface Job {
  fs: IntakeFs;
  context: IntakeContext;
  assetsRoot: string;
  sourceSlug: string;
  dryRun: boolean;
  force: boolean;
  sideArtifacts: string[];
  /** Plain lines for images BuildOS did not copy (`ConvertResult.warnings`). */
  warnings: string[];
  /**
   * Side artifacts to write, in Go's order. Go writes each one as the
   * converter meets it; the port writes them only after the whole source
   * has been read and checked (every limit included), so an invalid or
   * hostile source never leaves a file behind. A valid source writes the
   * same files in the same order, with the same `--force` checks.
   */
  pending: { out: string; data: Uint8Array }[];
}

/** Records a side artifact (Go `writeSideArtifact`, deferred: see `Job.pending`). */
function sideArtifact(job: Job, out: string, data: Uint8Array): void {
  job.sideArtifacts.push(out);
  if (!job.dryRun) job.pending.push({ out, data });
}

/** Go `xml.Unmarshal` where Go ignores a parse error (numbering). A limit failure is never ignored. */
function unmarshalOrUndefined(data: Uint8Array): XmlElement | undefined {
  try {
    return goXmlParse(data, "unmarshal");
  } catch (error) {
    if (error instanceof IntakeLimitError || !(error instanceof GoError)) throw error;
    return undefined;
  }
}

/** Go `zip.OpenReader(path)`. Entries are inflated only when read. */
function openZip(job: Job, path: string): ZipEntry[] {
  return job.context.parsers.readZip(job.fs.readFile(path));
}

/** Go `convertDOCX`: reads `word/document.xml`, `word/numbering.xml`, and `word/media/*` only. */
function convertDocx(job: Job, path: string): string {
  const { fs } = job;
  let document: Uint8Array | undefined;
  let numbering: Uint8Array | undefined;
  const media: { out: string; data: Uint8Array }[] = [];
  for (const entry of openZip(job, path)) {
    if (entry.name === "word/document.xml") {
      document = entry.read();
      continue;
    }
    if (entry.name === "word/numbering.xml") {
      numbering = entry.read();
      continue;
    }
    if (entry.name.startsWith("word/media/") && !entry.name.endsWith("/")) {
      media.push({ out: goJoinAll(fs.platform, job.assetsRoot, job.sourceSlug, "media", goBase(entry.name, fs.platform)), data: entry.read() });
    }
  }
  if (document === undefined || document.length === 0) throw new GoError("docx missing word/document.xml");
  const parsedNumbering = numbering !== undefined && numbering.length > 0 ? unmarshalOrUndefined(numbering) : undefined;
  let body = documentXmlToMarkdown(docxTokens(goXmlTokens(document, "stream")), parseNumbering(parsedNumbering));
  for (const item of media) sideArtifact(job, item.out, item.data);
  if (media.length > 0) {
    body += "\n\n## Embedded Assets\n\n";
    for (const item of media) body += `- ${goToSlash(goJoinAll(fs.platform, "media", goBase(item.out, fs.platform)), fs.platform)}\n`;
  }
  return body;
}

/**
 * Go `convertXLSX`. Go reads every entry; the port inflates only the parts
 * the conversion uses: the workbook, its relationships, the shared strings,
 * each listed worksheet, and `xl/media/*`. For a repeated name the last
 * entry wins, as in Go's map.
 */
function convertXlsx(job: Job, path: string, sourceRel: string, sum: string): ConvertedOutput[] {
  const { fs } = job;
  const entries = new Map<string, ZipEntry>();
  for (const entry of openZip(job, path)) {
    if (entry.name.endsWith("/")) continue;
    if (entry.name.startsWith("xl/media/")) {
      sideArtifact(job, goJoinAll(fs.platform, job.assetsRoot, job.sourceSlug, "media", goBase(entry.name, fs.platform)), entry.read());
      continue;
    }
    entries.set(entry.name, entry);
  }
  const readZipXml = (name: string): XmlElement => {
    const entry = entries.get(name);
    if (entry === undefined) throw new GoError(`missing ${name}`);
    return goXmlParse(entry.read(), "unmarshal");
  };
  const workbookPart = "xl/workbook.xml";
  const workbook = readZipXml(workbookPart);
  const rels = readZipXml("xl/_rels/workbook.xml.rels");
  const relTargets = new Map<string, string>();
  for (const rel of workbookRelationships(rels)) {
    try {
      relTargets.set(rel.id, resolvePackageRelationshipTarget(workbookPart, rel.target));
    } catch (error) {
      if (!(error instanceof GoError)) throw error;
      throw new GoError(`invalid worksheet relationship ${rel.id} target ${goQuote(rel.target)}: ${error.message}`);
    }
  }
  let shared: string[] = [];
  const sharedData = entries.get("xl/sharedStrings.xml")?.read();
  if (sharedData !== undefined && sharedData.length > 0) {
    // Go ignores a shared strings part that fails to parse (no shared strings); a limit failure is never ignored.
    try {
      shared = sharedStrings(goXmlTokens(sharedData, "unmarshal"));
    } catch (error) {
      if (error instanceof IntakeLimitError || !(error instanceof GoError)) throw error;
      shared = [];
    }
  }
  const outputs: ConvertedOutput[] = [];
  workbookSheets(workbook).forEach((sheet, i) => {
    let target = relTargets.get(sheet.rid) ?? "";
    if (target === "") target = `xl/worksheets/sheet${i + 1}.xml`;
    const entry = entries.get(target);
    if (entry === undefined) throw new GoError(`missing worksheet ${target}`);
    const body = worksheetToCsv(goXmlTokens(entry.read(), "unmarshal"), shared);
    outputs.push(outputFor(fs.platform, job.assetsRoot, job.sourceSlug, assetSlug(path, sheet.name, fs.platform), ".csv", sourceRel, sum, "csv", body));
  });
  return outputs;
}

/** Go `base64.StdEncoding.DecodeString`, which skips `\r` and `\n`. */
function decodeStdBase64(text: string): Uint8Array | undefined {
  const clean = text.replace(/[\r\n]/g, "");
  if (clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean)) return undefined;
  return new Uint8Array(Buffer.from(clean, "base64"));
}

/** Go `imageExtensionFromDataURI`. */
function imageExtensionFromDataUri(meta: string): string {
  if (meta.startsWith("data:image/svg+xml")) return ".svg";
  if (meta.startsWith("data:image/png")) return ".png";
  if (meta.startsWith("data:image/jpeg") || meta.startsWith("data:image/jpg")) return ".jpg";
  if (meta.startsWith("data:image/gif")) return ".gif";
  if (meta.startsWith("data:image/webp")) return ".webp";
  return ".bin";
}

/**
 * Go `htmlConvertContext.readImageSource`: the image bytes and extension, or
 * undefined for Go's error, or the reason BuildOS did not read it.
 *
 * W1 R7 P7 review round 3 (P7-R3-02): Go read any path the HTML named
 * (absolute, or `../` out of every folder) and copied its bytes into the
 * project. A local image is now read only when its real path is inside
 * `allowed` (the folder that holds the HTML file, or the selected HTML
 * folder, and the project root), through `IntakeFs.readDependent`.
 */
function readImageSource(fs: IntakeFs, sourcePath: string, src: string, allowed: readonly string[]): { data: Uint8Array; ext: string } | { refused: ImageRefusal } | undefined {
  if (src.startsWith("data:image/")) {
    const comma = src.indexOf(",");
    if (comma === -1) return undefined;
    const meta = src.slice(0, comma);
    if (!meta.includes(";base64")) return undefined;
    const data = decodeStdBase64(src.slice(comma + 1));
    return data === undefined ? undefined : { data, ext: imageExtensionFromDataUri(meta) };
  }
  let path = src;
  const cut = path.search(/[?#]/);
  if (cut >= 0) path = path.slice(0, cut);
  if (path === "" || path.includes("://")) return undefined;
  const at = (p: string) => (goIsAbs(p, fs.platform) ? p : goJoinAll(fs.platform, goDir(sourcePath, fs.platform), p));
  // P7-R4-03: the decoded path comes first and goes through the same containment check; when no file has the
  // decoded name, the path as written is tried, as Go read it, so every image Go copied is still copied.
  const decoded = decodeImagePath(path);
  if (decoded === "nul") return { refused: { reason: "invalid-path" } };
  const candidates = decoded === undefined || decoded === path ? [path] : [decoded, path];
  for (const [i, candidate] of candidates.entries()) {
    const source = at(candidate);
    const read = fs.readDependent(source, allowed);
    if (read.ok) {
      const ext = goExt(source, fs.platform);
      return { data: read.data, ext: ext === "" ? ".bin" : ext };
    }
    // Go turns any read failure into an uncopied-image link; a refusal and the bound also say why (P7-R3-02, P7-R3-06).
    if (read.reason === "outside" || read.reason === "too-large") return { refused: read };
    if (i === candidates.length - 1) return undefined;
  }
  return undefined;
}

/** Go `convertHTMLFile`. `documentRoot` is the folder a local image may come from besides the project root (P7-R3-02). */
function convertHtmlFile(job: Job, path: string, slug: string, documentRoot: string): string {
  const { fs } = job;
  const root = job.context.parsers.parseHtml(fs.readFile(path));
  const counters = { mermaid: 0, svg: 0, image: 0 };
  const side = (rel: string, data: Uint8Array): void => sideArtifact(job, goJoinAll(fs.platform, job.assetsRoot, job.sourceSlug, goFromSlash(rel, fs.platform)), data);
  const pad = (n: number) => String(n).padStart(3, "0");
  return htmlToMarkdown(root, {
    mermaid(code) {
      counters.mermaid++;
      const rel = goToSlash(goJoinAll(fs.platform, "diagrams", `${slug}-mermaid-${pad(counters.mermaid)}.mmd`), fs.platform);
      side(rel, utf8Bytes(`${code}\n`));
      return `[Mermaid diagram source](${rel})\n\n\`\`\`mermaid\n${code}\n\`\`\``;
    },
    svg(node: HtmlNode) {
      const rendered = renderHtml(node);
      if (rendered.error !== undefined) throw new GoError(rendered.error);
      counters.svg++;
      const rel = goToSlash(goJoinAll(fs.platform, "diagrams", `${slug}-svg-${pad(counters.svg)}.svg`), fs.platform);
      side(rel, utf8Bytes(rendered.text));
      return `![SVG diagram](${rel})`;
    },
    image(node) {
      const src = goTrimSpace(htmlAttr(node, "src"));
      if (src === "") return "";
      let alt = normalizeSpace(htmlAttr(node, "alt"));
      if (alt === "") alt = "Embedded image";
      if (src.startsWith("http://") || src.startsWith("https://")) return `![${alt}](${src})`;
      const image = readImageSource(fs, path, src, [documentRoot, fs.repoRoot]);
      if (image === undefined) return `[Uncopied image: ${alt}](${src})`;
      if ("refused" in image) {
        job.warnings.push(uncopiedImageWarning(src, goToSlash(repoRelative(fs.repoRoot, path, fs.platform), fs.platform), image.refused));
        return `[Uncopied image: ${alt}](${src})`;
      }
      counters.image++;
      const rel = goToSlash(goJoinAll(fs.platform, "media", `${slug}-image-${pad(counters.image)}${image.ext}`), fs.platform);
      side(rel, image.data);
      return `![${alt}](${rel})`;
    },
  });
}

/** Go `convertHTMLDir`. */
function convertHtmlDir(job: Job, path: string, sourceRel: string, sum: string): ConvertedOutput[] {
  const { fs } = job;
  const files: string[] = [];
  walkDir(fs, path, (p, dir) => {
    if (dir) return;
    const ext = goToLower(goExt(p, fs.platform));
    if (ext === ".html" || ext === ".htm") files.push(p);
  });
  files.sort(byteOrder);
  if (files.length === 0) throw new GoError("html directory contains no .html or .htm files");
  const outputs: ConvertedOutput[] = [];
  for (const file of files) {
    const rel = goRel(path, file, fs.platform) ?? file;
    const slashed = goToSlash(rel, fs.platform);
    const ext = goExt(rel, fs.platform);
    const slug = slugify(ext !== "" && slashed.endsWith(ext) ? slashed.slice(0, slashed.length - ext.length) : slashed, "html");
    const body = convertHtmlFile(job, file, slug, path);
    outputs.push(outputFor(fs.platform, job.assetsRoot, job.sourceSlug, slug, ".md", sourceRel, sum, "markdown", utf8Bytes(body)));
  }
  return outputs;
}

/** Go `convertPDF`. */
async function convertPdf(job: Job, path: string): Promise<string> {
  let data: Uint8Array;
  try {
    data = job.fs.readFile(path);
  } catch (error) {
    if (error instanceof GoError) throw new GoError(`open pdf: ${error.message}`);
    throw error;
  }
  const openError = goPdfOpenError(data);
  if (openError !== undefined) throw new GoError(`open pdf: ${openError}`);
  let pages;
  try {
    pages = await job.context.parsers.pdfText(data);
  } catch (error) {
    if (error instanceof IntakeLimitError) throw error;
    if (error instanceof GoError) throw new GoError(`open pdf: ${error.message}`);
    throw error;
  }
  return pdfPagesToText(pages);
}

/** Go `intake.Convert`. */
export async function convert(context: IntakeContext, opts: ConvertOptions): Promise<ConvertResult> {
  const platform = context.platform ?? hostPlatform();
  const now = context.now ?? (() => new Date());
  const repoRoot = cleanRoot(opts.repoRoot, context.cwd, platform);
  const fs = new IntakeFs(context, repoRoot, platform);
  const assetsRoot = resolvePath(fs, opts.assetsRoot, INTAKE_DEFAULT_PATHS.assetsRoot);
  const sourcePath = resolvePath(fs, opts.source);
  const info = fs.stat(sourcePath);
  if (!info.ok) throw new GoError(`read source: ${goPathError(goStatOp(), sourcePath, info.detail)}`);
  const isDir = info.stat.kind === "directory";
  const sourceType = detectType(sourcePath, isDir, opts.type, platform);
  const sourceRel = repoRelative(repoRoot, sourcePath, platform);
  const sum = sourceSha256(fs, sourcePath, isDir);
  const srcSlug = sourceSlug(sourcePath, isDir, platform);
  const job: Job = { fs, context, assetsRoot, sourceSlug: srcSlug, dryRun: opts.dryRun, force: opts.force, sideArtifacts: [], warnings: [], pending: [] };
  const single = (ext: string, type: string, body: Uint8Array) => [outputFor(platform, assetsRoot, srcSlug, assetSlug(sourcePath, "", platform), ext, sourceRel, sum, type, body)];

  let outputs: ConvertedOutput[];
  switch (sourceType) {
    case "csv":
      outputs = single(".csv", "csv", writeCsv(readCsv(fs.readFile(sourcePath))));
      break;
    case "docx":
      outputs = single(".md", "markdown", utf8Bytes(convertDocx(job, sourcePath)));
      break;
    case "xlsx":
      outputs = convertXlsx(job, sourcePath, sourceRel, sum);
      break;
    case "html":
      outputs = single(".md", "markdown", utf8Bytes(convertHtmlFile(job, sourcePath, assetSlug(sourcePath, "", platform), goDir(sourcePath, platform))));
      break;
    case "html-dir":
      outputs = convertHtmlDir(job, sourcePath, sourceRel, sum);
      break;
    case "pdf": {
      const body = await convertPdf(job, sourcePath);
      if (goTrimSpace(body) === "") throw new GoError("pdf text extraction produced no usable text");
      outputs = single(".txt", "text", utf8Bytes(body));
      break;
    }
    default:
      throw new GoError(`unsupported source type ${goQuote(sourceType)}`);
  }
  const result: ConvertResult = { outputs, sideArtifacts: job.sideArtifacts, warnings: job.warnings };
  if (opts.dryRun) return result;
  // Every write is checked, in Go's order, before the first one (PE-013):
  // a target the port refuses (outside the repository root without
  // --allow-outside-root, PE-010; a device; a special file) and every
  // condition Go's write would report (an existing file without --force, a
  // folder or a read-only file at the name, a file in the way of a folder,
  // a folder that refuses a new entry) stop the command with Go's text and
  // exit code, and no file is written.
  preflightWrites(fs, job.pending, outputs, opts.force, now());
  for (const item of job.pending) writeSideArtifact(fs, item.out, item.data, opts.force);
  for (const output of outputs) writeConvertedOutput(fs, output, opts.force, now());
  return result;
}

/** The body text of a twin, for tests and the eval runner. */
export function bodyText(output: ConvertedOutput): string {
  return utf8Text(output.body);
}
