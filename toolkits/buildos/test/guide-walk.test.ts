// W1 R7 P8 review round 2 (P8-D-02, P8-D-03): the guide is checked as a
// reader follows it.
//
// P8-D-03, the worked path: a new project, then the guide's own steps and
// commands in order: the chapter 4 config and the renames it asks for, the
// chapter 5 conversion, the chapter 7 records, the chapter 8 playbook
// activation and discovery run, the chapter 9 qualification, and the chapter
// 12 promotion into a design, with the Make Docs 2.0.9 design inputs from the
// committed companion fixture (no test runs the real Make Docs). Every
// `.os/scripts/buildos ...` command is taken from the guide's code blocks and
// run with the CLI from the project folder, on every operating system.
//
// P8-D-02, inline paths: every inline-code path in guide/content/ that starts
// with docs/, .make-docs/, .os/, assets/, playbooks/, or workspace/ must exist
// in one of the two installed layouts: BuildOS alone (`buildos init
// --skip-make-docs`, built here) or BuildOS with Make Docs 2.0.9 (that layout
// plus test/fixtures/make-docs-2.0.9-layout.txt, the file list of a real
// `buildos init --make-docs` with Make Docs 2.0.9, captured on 2026-11-24). A
// path with a placeholder (<...>, *, YYYY, NNN, NN-, {W}) must have its fixed
// part in a layout. A path that a command creates later is on the allow-list
// below, each with its reason.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { strToU8, zipSync } from "fflate";
import { assertNoProblems, assertOutputMatches, shape, tag } from "./helpers.ts";

const PACKAGE = resolve(import.meta.dirname, "..");
const GUIDE = join(PACKAGE, "..", "..", "guide", "content");
const MAIN = join(PACKAGE, "src", "cli", "main.ts");
const COMPANION = join(PACKAGE, "test", "fixtures", "make-docs-companion");
const MAKE_DOCS_LAYOUT = join(PACKAGE, "test", "fixtures", "make-docs-2.0.9-layout.txt");

const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const chapter = (name: string) => readFileSync(join(GUIDE, name), "utf8").replace(/\r\n/g, "\n");

/** Every fenced code block of a chapter, with its language. */
function fences(text: string): { language: string; body: string }[] {
  const out: { language: string; body: string }[] = [];
  let open: string[] | undefined;
  let language = "";
  let indent = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trimStart();
    if (open === undefined && trimmed.startsWith("```")) {
      language = trimmed.slice(3).trim();
      // A fence inside a list item is indented; its lines are indented by the same amount.
      indent = line.length - trimmed.length;
      open = [];
    } else if (open !== undefined && trimmed.startsWith("```")) {
      out.push({ language, body: open.join("\n") });
      open = undefined;
    } else if (open !== undefined) open.push(line.slice(Math.min(indent, line.length - line.trimStart().length)));
  }
  return out;
}

/** The `.os/scripts/buildos ...` command lines in a chapter's code blocks. */
function guideCommands(name: string): string[] {
  return fences(chapter(name))
    .flatMap((f) => f.body.split("\n"))
    .map((l) => l.trim())
    .filter((l) => l.startsWith(".os/scripts/buildos "));
}

/** Splits a command line as sh does for these simple lines: spaces, and single or double quotes. */
function words(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (let m = re.exec(line); m !== null; m = re.exec(line)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  return out;
}

/** The one guide command that starts with `prefix` (after `.os/scripts/buildos `), as CLI arguments. */
function command(name: string, prefix: string, filter: (line: string) => boolean = () => true): string[] {
  const found = guideCommands(name).filter((l) => l.startsWith(`.os/scripts/buildos ${prefix}`) && filter(l));
  assert.ok(found.length > 0, `${tag(name)} shows a command that starts with ${tag(prefix)}`);
  return words(found[0]!).slice(1);
}

function cli(args: string[], cwd: string) {
  const r = spawnSync(process.execPath, [MAIN, ...args], { cwd, encoding: "utf8", env: { ...process.env, PATH: "" } });
  if (process.env["GUIDE_WALK_DEBUG"] !== undefined && r.status !== 0) process.stderr.write(`\n[${args.join(" ")}] exit ${String(r.status)}\n${r.stdout}${r.stderr}\n`);
  return { exit: r.status, stdout: r.stdout, stderr: r.stderr, all: `${r.stdout}${r.stderr}` };
}

function newProject(): string {
  const root = mkdtempSync(join(tmpdir(), "buildos-guide-walk-"));
  temps.push(root);
  const project = join(root, "project");
  mkdirSync(project);
  const made = cli(["init", "--root", project, "--skip-make-docs"], project);
  assert.equal(made.exit, 0, shape(made.all));
  return project;
}

/** A DOCX with a title and the four headings the chapter 7 anchors name, built with fflate (a test dependency). */
function lendingOverviewDocx(): Uint8Array {
  const p = (style: string, text: string) => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const body = [p("Heading1", "Lending overview"), p("Heading2", "Holds"), p("Normal", "A hold keeps one copy for a patron."), p("Heading2", "Fines"), p("Normal", "Fines are shown at checkout."), p("Heading2", "Roles"), p("Normal", "Clerks check out copies."), p("Heading2", "Loans and holds"), p("Normal", "A loan follows a hold.")].join("");
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
  });
}

/** Replaces the value of one frontmatter line of a playbook. */
function setFrontmatter(file: string, field: string, value: string): void {
  const text = readFileSync(file, "utf8");
  const next = text.replace(new RegExp(`^${field}: .*$`, "m"), `${field}: ${value}`);
  assert.notEqual(next, text, `${tag(field)} is in ${tag(file)}`);
  writeFileSync(file, next);
}

describe("P8-D-03: the guide's worked path runs end to end from a new project", () => {
  let project: string;
  before(() => {
    project = newProject();
  });

  it("chapter 4: the worked config, with the six renamed files the chapter names, passes buildos validate", () => {
    const yaml = fences(chapter("04-install-and-configure-your-instance.md")).find((f) => f.language === "yaml" && f.body.includes("id: lending-programme"));
    assert.ok(yaml !== undefined, "chapter 4 has the worked config");
    writeFileSync(join(project, ".os", "config", "instance.yaml"), `${yaml.body}\n`);
    // "Renaming the shipped IDs breaks six files": three playbooks and three seeded record files, updated to your IDs.
    const renamed: Record<string, string> = { "primary-system": "lending-system", baseline: "vendor-baseline", customized: "configured-sandbox", "adopter-team": "product-team", "platform-owner": "platform-vendor" };
    const swap = (list: string) => list.split(",").map((id) => renamed[id.trim()] ?? id.trim());
    for (const playbook of ["playbooks/discovery/inspect-ui-discoverability.md", "playbooks/testing/run-core-validation.md", "playbooks/build/package-build-artifact.md"]) {
      const full = join(project, ...playbook.split("/"));
      const text = readFileSync(full, "utf8");
      const end = text.indexOf("\n---", 4);
      writeFileSync(full, text.slice(0, end).replace(/^(systems|environments|owners): \[(.*)\]$/gm, (_l, field: string, list: string) => `${field}: [${swap(list).join(", ")}]`) + text.slice(end));
    }
    for (const data of [".os/data/requirements.jsonl", ".os/data/capabilities.jsonl", ".os/data/test-cases.jsonl"]) {
      const full = join(project, ...data.split("/"));
      const rows = readFileSync(full, "utf8").split("\n").filter((l) => l !== "").map((l) => JSON.parse(l) as Record<string, unknown>);
      for (const row of rows) for (const field of ["systems", "environments", "owners"]) if (Array.isArray(row[field])) row[field] = (row[field] as string[]).map((id) => renamed[id] ?? id);
      writeFileSync(full, rows.map((r) => `${JSON.stringify(r)}\n`).join(""));
    }
    const result = cli(command("04-install-and-configure-your-instance.md", "validate"), project);
    assert.equal(result.exit, 0, shape(result.all));
    assertOutputMatches(result.stdout, /OK\. No problems found\./);
  });

  it("chapter 5: the worked conversion (dry run, then for real) writes assets/lending-overview/lending-overview.md", () => {
    mkdirSync(join(project, "sources"));
    writeFileSync(join(project, "sources", "lending-overview.docx"), lendingOverviewDocx());
    const dry = cli(command("05-bring-in-source-material.md", "intake convert --source sources/lending-overview.docx", (l) => l.includes("--dry-run")), project);
    assert.equal(dry.exit, 0, shape(dry.all));
    assert.equal(existsSync(join(project, "assets", "lending-overview")), false, "a dry run writes nothing");
    const real = cli(command("05-bring-in-source-material.md", "intake convert --source sources/lending-overview.docx", (l) => !l.includes("--dry-run")), project);
    assert.equal(real.exit, 0, shape(real.all));
    const twin = readFileSync(join(project, "assets", "lending-overview", "lending-overview.md"), "utf8");
    for (const heading of ["## Holds", "## Fines", "## Roles", "## Loans and holds"]) assert.ok(twin.includes(`\n${heading}\n`), `the twin has ${tag(heading)}`);
  });

  it("chapter 7: the worked records load and pass buildos validate", () => {
    const blocks = fences(chapter("07-pull-knowledge-out-of-it.md")).filter((f) => f.language === "json");
    const targets: Record<string, string> = { capability: "capabilities", requirement: "requirements", persona: "personas", "test-case": "test-cases", extraction: "extractions" };
    let loaded = 0;
    for (const block of blocks) {
      const row = JSON.parse(block.body) as Record<string, unknown>;
      const file = targets[String(row["type"])];
      if (file === undefined) continue;
      const full = join(project, ".os", "data", `${file}.jsonl`);
      writeFileSync(full, `${readFileSync(full, "utf8")}${JSON.stringify(row)}\n`);
      loaded++;
    }
    assert.equal(loaded, 5);
    const result = cli(command("07-pull-knowledge-out-of-it.md", "validate"), project);
    assert.equal(result.exit, 0, shape(result.all));
  });

  it("chapter 8: the gate refuses as the chapter says, then the activated PB-005 with its targets cleared records RUN-001", () => {
    const run = command("08-write-and-run-a-playbook.md", "discovery run discovery");
    mkdirSync(join(project, "captures"));
    writeFileSync(join(project, "captures", "screenshot-01.png"), new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const observed = fences(chapter("08-write-and-run-a-playbook.md")).find((f) => f.body.startsWith("# Raw Findings for RUN-001"))!.body.split("\n").filter((l) => l.trim() !== "").slice(-1)[0]!;
    writeFileSync(join(project, "captures", "observed.md"), `${observed}\n`);
    // Not activated: "playbook PB-005 is not active/runnable".
    assertOutputMatches(cli(run, project).stderr, /buildos-discovery: error: playbook PB-005 is not active\/runnable/);
    // The wrong folder: PB-003 is administrative.
    const wrong = run.map((a) => (a === "PB-005" ? "PB-003" : a));
    assertOutputMatches(cli(wrong, project).stderr, /playbook PB-003 is "administrative"; run discovery requires category discovery/);
    // Procedure 2: status active, then the index rebuild the chapter shows.
    const playbook = join(project, "playbooks", "discovery", "inspect-ui-discoverability.md");
    const reindex = () => {
      const index = cli(command("08-write-and-run-a-playbook.md", "intake index playbooks"), project);
      assert.equal(index.exit, 0, shape(index.all));
      assertOutputMatches(index.stdout, /wrote .*playbooks\.json \(6 playbooks\)/);
    };
    setFrontmatter(playbook, "status", "active");
    reindex();
    // With the shipped draft targets, the run stops as the chapter says, and nothing is written.
    const blocked = cli(run, project);
    assert.notEqual(blocked.exit, 0);
    assertOutputMatches(blocked.stderr, /resolve discovery target CAP-001: .*redirect_inactive_terminal/);
    assert.deepEqual(readdirSync(join(project, "workspace", "runs")).filter((n) => n.startsWith("RUN-")), []);
    // "The stock-checkout problem": set its targets to an empty list, then rebuild the index again.
    assert.ok(fences(chapter("08-write-and-run-a-playbook.md")).some((f) => f.body.trim() === "targets: []"), "chapter 8 shows targets: []");
    setFrontmatter(playbook, "targets", "[]");
    reindex();
    const recorded = cli(run, project);
    assert.equal(recorded.exit, 0, shape(recorded.all));
    const raw = readFileSync(join(project, "workspace", "runs", "RUN-001", "raw-findings.md"), "utf8");
    assert.ok(raw.includes("## Raw Finding 1 {#raw-finding-1}") && raw.includes(observed), shape(raw));
    // "with a number in front of its name (here `001-screenshot-01.png`)".
    assert.ok(chapter("08-write-and-run-a-playbook.md").includes("(here `001-screenshot-01.png`)"));
    assert.ok(existsSync(join(project, "workspace", "runs", "RUN-001", "evidence", "001-screenshot-01.png")));
  });

  it("chapter 9: the qualify command from the chapter writes FIND-001", () => {
    const args = command("09-qualify-what-you-found.md", "discovery qualify finding");
    const at = (flag: string) => args[args.indexOf(flag) + 1]!;
    for (const file of [at("--confirmation-test"), at("--confirmation-evidence")]) {
      mkdirSync(join(project, ...file.split("/").slice(0, -1)), { recursive: true });
      writeFileSync(join(project, ...file.split("/")), "the confirmation, run by hand\n");
    }
    const result = cli(args, project);
    assert.equal(result.exit, 0, shape(result.all));
    for (const file of ["finding.md", "qualification.md"]) assert.ok(existsSync(join(project, "workspace", "findings", "FIND-001", file)), file);
  });

  it("chapter 12: with the Make Docs 2.0.9 design inputs, the promote command (dry run first) writes the design in the 2.0.9 form", () => {
    cpSync(COMPANION, project, { recursive: true });
    const args = command("12-designs-plans-and-prds.md", "design promote finding").map((a) => (a === "<FIND-NNN>" ? "FIND-001" : a));
    const dry = cli([...args, "--dry-run"], project);
    assert.equal(dry.exit, 0, shape(dry.all));
    const result = cli(args, project);
    assert.equal(result.exit, 0, shape(result.all));
    const designs = readdirSync(join(project, "docs", "designs")).filter((n) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(n));
    assert.equal(designs.length, 1, designs.join(", "));
    const design = readFileSync(join(project, "docs", "designs", designs[0]!), "utf8");
    assert.ok(design.startsWith('---\ntitle: "'), "the 2.0.9 frontmatter");
    for (const heading of ["## Purpose", "## Context", "## Human Experience Intent", "## Decision", "## Alternatives Considered", "## Consequences", "## Intended Follow-On"]) assert.ok(design.includes(`\n${heading}\n`), heading);
    const validate = cli(["validate"], project);
    assert.equal(validate.exit, 0, shape(validate.all));
  });
});

// ---------------------------------------------------------------- P8-D-02

/** Paths a command creates later, or that a chapter names as not existing. Each has its reason. */
const ALLOWED: { path: RegExp; reason: string }[] = [
  { path: /^\.make-docs\/archive(\/|$)/, reason: "Make Docs creates it when something is archived (make-docs project surface ensure archive)" },
  { path: /^\.os\/indexes\/references\.json$/, reason: "written by buildos intake index references (chapter 5)" },
  { path: /^\.os\/indexes\/entity-resolution\.json$/, reason: "written by buildos entities rebuild-index --apply (chapter 11)" },
  { path: /^assets\/converted$/, reason: "chapter 18 names it as a path that does not exist" },
  { path: /^assets\/lending-overview\/lending-overview\.md$/, reason: "written by buildos intake convert in the chapter 5 worked example (the walk above checks it)" },
  { path: /^workspace\/runs\/RUN-001\/raw-findings\.md$/, reason: "written by buildos discovery run discovery (the walk above checks it)" },
  { path: /^docs\/assets(\/(user|maintainer))?$/, reason: "Make Docs creates docs/assets/<persona-slug>/ with the first guide or shared project material" },
  { path: /^docs\/designs\/2026-03-02-renewal-fine-recalculation\.md$/, reason: "the chapter 12 worked design, written by the reader's agent" },
  { path: /^docs\/plans\/2026-03-02-w2-r0-renewal-fine-recalculation$/, reason: "the chapter 12 worked plan, written by the reader's agent" },
];

const PREFIXES = /^(docs\/|\.make-docs\/|\.os\/|assets\/|playbooks\/|workspace\/)/;
const PLACEHOLDER = /[<*{]|YYYY|NNN|^NN-/;

/** Inline-code paths of the guide (outside fenced blocks), with the chapter they are in. A command's first word is its path. */
function inlinePaths(): { path: string; chapter: string }[] {
  const out: { path: string; chapter: string }[] = [];
  for (const name of readdirSync(GUIDE).filter((n) => n.endsWith(".md"))) {
    const text = chapter(name).replace(/```[\s\S]*?```/g, "");
    for (const m of text.matchAll(/`([^`\n]+)`/g)) {
      const first = (m[1] ?? "").trim().split(/\s+/)[0] ?? "";
      if (PREFIXES.test(first)) out.push({ path: first, chapter: name });
    }
  }
  return out;
}

function layoutOf(root: string): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      out.add(relative(root, full).split("\\").join("/"));
      if (statSync(full).isDirectory()) walk(full);
    }
  };
  walk(root);
  return out;
}

describe("P8-D-02: every inline-code path in the guide exists in an installed layout or is allowed with a reason", () => {
  it("the Make Docs 2.0.9 layout fixture holds the companion fixture's files (one real capture)", () => {
    const layout = new Set(readFileSync(MAKE_DOCS_LAYOUT, "utf8").split("\n").filter((l) => l !== ""));
    for (const file of [".make-docs/system/contracts/design-contract.md", ".make-docs/system/templates/design.md", ".make-docs/system/prompts/designs-to-plan.prompt.md", ".make-docs/system/references/design-workflow.md", "docs/designs/AGENTS.md"]) {
      assert.ok(layout.has(file), file);
      assert.ok(existsSync(join(COMPANION, ...file.split("/"))), file);
    }
    assert.equal(layout.has("docs/assets"), false, "Make Docs 2.0.9 creates no docs/assets/ at setup");
  });

  it("finds no path that is in neither layout", () => {
    const buildos = layoutOf(newProject());
    const makeDocs = new Set(readFileSync(MAKE_DOCS_LAYOUT, "utf8").split("\n").filter((l) => l !== ""));
    const known = (p: string) => buildos.has(p) || makeDocs.has(p);
    const problems: string[] = [];
    const paths = inlinePaths();
    assert.ok(paths.length > 50, `the guide has inline paths (${paths.length})`);
    for (const { path, chapter: name } of paths) {
      const clean = path.replace(/#.*$/, "").replace(/[.,;:]+$/, "").replace(/\/+$/, "");
      if (clean === "") continue;
      const parts = clean.split("/");
      const cut = parts.findIndex((part) => PLACEHOLDER.test(part));
      const fixed = cut < 0 ? clean : parts.slice(0, cut).join("/");
      if (cut >= 0 && (fixed === "" || known(fixed))) continue;
      if (cut < 0 && known(clean)) continue;
      if (ALLOWED.some((a) => a.path.test(fixed))) continue;
      problems.push(`${tag(name)}: ${tag(path)}`);
    }
    assertNoProblems(problems, "guide paths that exist in no installed layout (fix the path, or add it to ALLOWED with a reason)");
  });

  it("the check finds a planted wrong path (the old docs/assets/ layout of Make Docs)", () => {
    const makeDocs = new Set(readFileSync(MAKE_DOCS_LAYOUT, "utf8").split("\n").filter((l) => l !== ""));
    for (const old of ["docs/assets/references/design-contract.md", "docs/assets/templates/design.md", "docs/assets/prompts"]) {
      assert.equal(makeDocs.has(old), false, old);
      assert.equal(ALLOWED.some((a) => a.path.test(old)), false, old);
    }
  });
});
