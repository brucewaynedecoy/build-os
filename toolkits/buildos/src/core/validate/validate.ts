/**
 * `buildos validate`: checks the adopter config, scoped frontmatter, and
 * entity record hygiene of one initialized project
 * ([PRD 13 buildos validate checks](../../../../../docs/prd/13-adopter-owned-config-surface.md#buildos-validate-checks)).
 *
 * The root is the project folder that holds `.os/`: `--root`, or else the
 * current folder. It never walks up to a parent folder. Every path read is
 * relative to that root (installed paths, no `system/` prefix):
 *
 * - `.os/contracts/config-contract.md`
 * - `.os/config/instance.yaml`
 * - every `.md` file under `playbooks/` (hidden names too, as the legacy
 *   script's `pathlib` glob found them) and every `.os/templates/` file
 *   whose name holds `playbook` and ends in `.md`, when it has frontmatter.
 *   Names match ASCII case-insensitively on every OS (P7-R1-10).
 * - the eight canonical entity files in `.os/data/`
 *
 * Every file is untrusted input. It is read through the filesystem port,
 * once, with a size bound (`VALIDATE_LIMITS`), and only when it is a regular
 * file: a link at a checked name is never followed (a finding says so), a
 * link at any other name is skipped without a word and never followed or
 * looked through (P7-R1-08), and a folder link that leads out of the project
 * is never read. Text must be
 * UTF-8; one byte order mark at the start is ignored. Each of these is a
 * finding, never a crash. The core never writes.
 */

import type { FsPort, FsPortFactory } from "../shared/fs-port.ts";
import { InputError, PathRefusedError, isCoreError } from "../shared/errors.ts";
import { resolveDefaultRoot } from "../shared/root.ts";
import {
  checkConfigText,
  checkContractText,
  checkEntityLines,
  checkFrontmatterText,
  EMPTY_INDEX,
  ENTITY_FILE_SPECS,
  extractFrontmatter,
  Findings,
  type ConfigIndex,
  type ValidateFinding,
} from "./checks.ts";
import { pySplitlines } from "./yaml-subset.ts";

const MiB = 1024 * 1024;

/** Input limits. `SECURITY.md` lists the same values. */
export const VALIDATE_LIMITS = {
  /** Bytes of the config contract or the config file. */
  configMaxBytes: 1 * MiB,
  /** Bytes of one scoped Markdown file. */
  markdownMaxBytes: 4 * MiB,
  /** Bytes of one entity data file. */
  entityFileMaxBytes: 128 * MiB,
  /** Markdown files the frontmatter check reads. */
  markdownMaxFiles: 10_000,
  /** Folder levels below `playbooks/` the frontmatter check walks. */
  folderMaxDepth: 32,
  /** Findings reported. After this many, the check stops and says so. */
  maxFindings: 10_000,
} as const;

export const CONTRACT_PATH = ".os/contracts/config-contract.md";
export const CONFIG_PATH = ".os/config/instance.yaml";
export const DATA_DIR = ".os/data";
export const PLAYBOOKS_DIR = "playbooks";
export const TEMPLATES_DIR = ".os/templates";

export interface ValidateInput {
  /** `--root`, or undefined for the current folder. */
  root?: string | undefined;
  cwd: string;
  openFs: FsPortFactory;
}

export interface ValidateResult {
  status: "passed" | "failed";
  /** A one-line plain summary. */
  summary: string;
  checked: {
    contract: string;
    config: string;
    /** Scoped Markdown files with frontmatter that were checked. */
    frontmatter_files: string[];
    /** Entity data files that were checked (present or not). */
    entity_files: string[];
  };
  finding_count: number;
  /** True when the check stopped at `VALIDATE_LIMITS.maxFindings`. */
  truncated: boolean;
  findings: ValidateFinding[];
}

export interface Validated {
  /** The root as given, folded (never resolved through links). */
  root: string;
  result: ValidateResult;
}

/** Runs every check and returns the findings. Throws `InputError` (exit 3) only when the root is not a BuildOS project. */
export function validateProject(input: ValidateInput): Validated {
  const { root, hasOsFolder, fs } = resolveDefaultRoot({ root: input.root, cwd: input.cwd, openFs: input.openFs });
  if (!hasOsFolder) {
    throw new InputError(`${root} has no .os/ folder, so it is not a BuildOS project`, {
      code: "root_not_buildos",
      correction: "Run buildos validate in the project folder, or pass --root with the folder that holds .os/.",
      root,
    });
  }
  // P7-R1-07: the collector keeps the budget, so no check builds more than the limit.
  const out = new Findings(VALIDATE_LIMITS.maxFindings);
  const room = (): boolean => out.room();

  const contract = readChecked(fs, out, CONTRACT_PATH, VALIDATE_LIMITS.configMaxBytes, "contract");
  if (contract.text !== undefined) checkContractText(out, CONTRACT_PATH, contract.text);

  let index: ConfigIndex = EMPTY_INDEX;
  const config = readChecked(fs, out, CONFIG_PATH, VALIDATE_LIMITS.configMaxBytes, "config");
  if (config.text !== undefined) index = checkConfigText(out, CONFIG_PATH, config.text);

  const frontmatterFiles: string[] = [];
  for (const path of scopedMarkdownPaths(fs, out)) {
    if (!room()) break;
    const read = readChecked(fs, out, path, VALIDATE_LIMITS.markdownMaxBytes, "frontmatter");
    if (read.text === undefined) continue;
    const frontmatter = extractFrontmatter(pySplitlines(read.text));
    if (frontmatter === undefined) continue;
    frontmatterFiles.push(path);
    checkFrontmatterText(out, path, frontmatter, index);
  }

  const entityFiles: string[] = [];
  for (const [file, type, prefix] of ENTITY_FILE_SPECS) {
    if (!room()) break;
    const path = `${DATA_DIR}/${file}`;
    entityFiles.push(path);
    const read = readChecked(fs, out, path, VALIDATE_LIMITS.entityFileMaxBytes, "file", true);
    if (read.text === undefined) continue;
    checkEntityLines(out, path, jsonlLines(read.text), type, prefix, index);
  }

  const truncated = out.truncated;
  const findings = out.list;
  const count = findings.length;
  const summary =
    count === 0
      ? "No problems found."
      : truncated
        ? `Found at least ${count} problems. BuildOS stopped after ${count}; fix these first, then run buildos validate again.`
        : `Found ${count} ${count === 1 ? "problem" : "problems"}.`;
  return {
    root,
    result: {
      status: count === 0 ? "passed" : "failed",
      summary,
      checked: { contract: CONTRACT_PATH, config: CONFIG_PATH, frontmatter_files: frontmatterFiles, entity_files: entityFiles },
      finding_count: count,
      truncated,
      findings,
    },
  };
}

/**
 * Entity data lines: split at LF, with one CR before it removed, and no
 * final empty line after the last LF (as JSON Lines and the entity commands
 * read them). The legacy script also split at the other line breaks that
 * Python knows (a deliberate divergence, VD-15). The lines are made one at
 * a time from the bounded text (P7-R1-07), never as one array.
 */
export function* jsonlLines(text: string): Generator<string> {
  let start = 0;
  while (start < text.length) {
    const end = text.indexOf("\n", start);
    const stop = end < 0 ? text.length : end;
    const line = text.slice(start, stop);
    yield line.endsWith("\r") ? line.slice(0, -1) : line;
    if (end < 0) return;
    start = end + 1;
  }
}

interface ReadOutcome {
  text?: string;
}

/**
 * Reads one checked file as UTF-8 text, or adds a finding and returns no
 * text. `field` is the subject of a finding about the file itself
 * (`contract`, `config`, `frontmatter`, or `file`). With `dataFile`, the
 * legacy entity-file findings apply (`entity_file_missing`,
 * `entity_file_not_file`); else a missing file is `<field>_missing`.
 */
function readChecked(fs: FsPort, out: Findings, path: string, limit: number, field: string, dataFile = false): ReadOutcome {
  try {
    const entry = fs.entryId(path);
    if (entry === undefined) {
      if (dataFile) out.add("entity_file_missing", path, field, "This canonical data file is missing. Create it (it may be empty).");
      else if (field === "contract") out.add("contract_missing", path, field, "The config contract file is missing.");
      else out.add("config_missing", path, field, "The config file is missing.");
      return {};
    }
    if (entry.kind === "symlink") {
      out.add("not_regular_file", path, field, "This is a link. BuildOS checks only regular files and does not follow links.");
      return {};
    }
    if (entry.kind !== "file") {
      if (dataFile && entry.kind === "directory") out.add("entity_file_not_file", path, field, "This must be a JSONL file, not a folder.");
      else out.add("not_regular_file", path, field, `This must be a regular file, not ${entry.kind === "directory" ? "a folder" : "a special file (such as a pipe, socket, or device)"}. BuildOS did not read it.`);
      return {};
    }
    const read = fs.readFileLimited(path, limit);
    if (read.tooLarge) {
      out.add("file_too_large", path, field, `This file is larger than ${limit / MiB} MiB, so BuildOS did not read it.`);
      return {};
    }
    const text = decodeUtf8(read.data);
    if (text === undefined) {
      out.add("not_utf8", path, field, "This file is not UTF-8 text. Save it as UTF-8.");
      return {};
    }
    return { text };
  } catch (error) {
    if (error instanceof PathRefusedError) {
      out.add("outside_root", path, field, "A link leads this path out of the project folder, so BuildOS did not read it.");
      return {};
    }
    if (isCoreError(error)) {
      out.add("unreadable", path, field, `BuildOS could not read this file (${firstLine(error.message)}).`);
      return {};
    }
    throw error;
  }
}

/** Strict UTF-8, with one byte order mark at the start removed. `undefined` for bytes that are not UTF-8. */
function decodeUtf8(data: Uint8Array): string | undefined {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data);
  } catch {
    return undefined;
  }
  return text.startsWith("\ufeff") ? text.slice(1) : text;
}

/** ASCII lowercase: `A` to `Z` only, so no other letter can turn into an ASCII one. */
function asciiLower(name: string): string {
  return name.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/** P7-R1-10: a checked Markdown name ends in `.md`, ASCII case-insensitively, on every OS. */
export function isMarkdownName(name: string): boolean {
  return asciiLower(name).endsWith(".md");
}

/** P7-R1-10: a playbook template name holds `playbook` and ends in `.md`, ASCII case-insensitively. */
export function isPlaybookTemplateName(name: string): boolean {
  const lower = asciiLower(name);
  return lower.includes("playbook") && lower.endsWith(".md");
}

/**
 * The scoped Markdown files, in path order: every `.md` file under
 * `playbooks/` and every `.os/templates/*playbook*.md`, names matched ASCII
 * case-insensitively (P7-R1-10). An entry at a checked name is always
 * listed, so a link or a special file there (FIFO, socket, device) gets a
 * finding from `readChecked` and is never read through. A link at any other
 * name, also one to a folder, is skipped without a word: BuildOS never
 * follows or looks through it to decide (P7-R1-08). `playbooks/` or
 * `.os/templates/` itself as a link is reported (`folder_link`), because
 * then none of its files can be checked.
 */
function scopedMarkdownPaths(fs: FsPort, out: Findings): string[] {
  const paths: string[] = [];
  const add = (path: string): boolean => {
    if (paths.length >= VALIDATE_LIMITS.markdownMaxFiles) {
      out.add("too_many_files", path, "frontmatter", `There are more than ${VALIDATE_LIMITS.markdownMaxFiles} Markdown files to check, so BuildOS stopped here.`);
      return false;
    }
    paths.push(path);
    return true;
  };
  const walk = (folder: string, depth: number): boolean => {
    const entries = listFolder(fs, out, folder);
    for (const entry of entries) {
      // P7-R1-07: no more folder walking once the findings budget is spent.
      if (!out.room()) return false;
      const path = `${folder}/${entry.name}`;
      if (entry.kind === "directory") {
        if (depth >= VALIDATE_LIMITS.folderMaxDepth) {
          out.add("too_deep", path, "frontmatter", `Folders nest more than ${VALIDATE_LIMITS.folderMaxDepth} levels below playbooks/, so BuildOS did not look inside this one.`);
          continue;
        }
        if (!walk(path, depth + 1)) return false;
      } else if (isMarkdownName(entry.name)) {
        if (!add(path)) return false;
      }
    }
    return true;
  };
  if (walk(PLAYBOOKS_DIR, 0)) {
    for (const entry of listFolder(fs, out, TEMPLATES_DIR)) {
      if (entry.kind === "directory") continue;
      if (isPlaybookTemplateName(entry.name) && !add(`${TEMPLATES_DIR}/${entry.name}`)) break;
    }
  }
  return paths.sort(comparePaths);
}

function listFolder(fs: FsPort, out: Findings, folder: string): { name: string; kind: string }[] {
  try {
    const kind = fs.entryId(folder)?.kind;
    if (kind === "symlink") {
      out.add("folder_link", folder, "frontmatter", "This folder is a link. BuildOS does not follow links, so it did not check the files behind it.");
      return [];
    }
    if (kind !== "directory") return [];
    return fs.readDir(folder);
  } catch (error) {
    if (error instanceof PathRefusedError) {
      out.add("outside_root", folder, "frontmatter", "A link leads this folder out of the project folder, so BuildOS did not look inside it.");
      return [];
    }
    if (isCoreError(error)) {
      out.add("unreadable", folder, "frontmatter", `BuildOS could not list this folder (${firstLine(error.message)}).`);
      return [];
    }
    throw error;
  }
}

/** Path order by segment, so `a/b.md` sorts before `a-b.md`, as the legacy script's `sorted(Path)` did. */
function comparePaths(a: string, b: string): number {
  const pa = a.split("/");
  const pb = b.split("/");
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] !== pb[i]) return pa[i]! < pb[i]! ? -1 : 1;
  }
  return pa.length - pb.length;
}

function firstLine(text: string): string {
  return (text.split(/\r?\n/, 1)[0] ?? "").trim();
}
