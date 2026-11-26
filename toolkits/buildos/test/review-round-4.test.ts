// W1 R7 P7 review round 4, the closing check of Stages 4 to 6 (P7-R4-01 to
// P7-R4-05). Each test failed before its fix, except the ones that say they
// pin a behavior that was already right.

import assert from "node:assert/strict";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { after, describe, it } from "node:test";
import { createDesignDomain } from "../src/cli/commands/design.ts";
import { run } from "../src/cli/run.ts";
import { headingText, neutralizeBlocks, readYamlInside, REQUIRED_HEADINGS_209, yamlInside } from "../src/core/design/make-docs-form.ts";
import { decodeImagePath } from "../src/core/intake/convert/convert.ts";
import { checkRowsReadBack, JSONL_ROW_LIMITS, jsonlRowLimit } from "../src/core/shared/read-limits.ts";
import { goLocalDate } from "../src/core/shared/go-text.ts";
import { parseYamlSubset } from "../src/core/validate/yaml-subset.ts";
import { assertSameTree, captureIo } from "./helpers.ts";

const scratch = mkdtempSync(join(tmpdir(), "buildos-review-4-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const GOLDEN = join(import.meta.dirname, "fixtures", "golden");
const COMPANION = join(import.meta.dirname, "fixtures", "make-docs-companion");
const NOW = new Date("2026-11-24T12:00:00Z");
let counter = 0;

function copy(fixture: string): string {
  const root = join(scratch, `p${++counter}`);
  cpSync(join(GOLDEN, fixture), root, { recursive: true });
  return root;
}

async function buildos(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const code = await run(args, io);
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

async function design(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const code = await run(["design", ...args], io, { domains: [createDesignDomain({ now: () => NOW })] });
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

function tree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const rel = relative(root, path).split(sep).join("/");
      if (lstatSync(path).isDirectory()) {
        out.set(`${rel}/`, "dir");
        walk(path);
      } else out.set(rel, readFileSync(path, "base64"));
    }
  };
  walk(root);
  return out;
}

const lastRow = (path: string) => JSON.parse(readFileSync(path, "utf8").trim().split("\n").at(-1)!) as Record<string, unknown>;

describe("P7-R4-01: discovery records the raw finding it read", () => {
  it("in a project that owns system/, the run names system/notes/raw.md as resolved, and the playbook path keeps the layout rule", async () => {
    const root = copy("discovery-installed");
    mkdirSync(join(root, "system", ".os"), { recursive: true });
    mkdirSync(join(root, "system", "notes"), { recursive: true });
    mkdirSync(join(root, "notes"), { recursive: true });
    writeFileSync(join(root, "system", "notes", "raw.md"), "the system raw finding\n");
    writeFileSync(join(root, "notes", "raw.md"), "the root raw finding\n");
    const out = await buildos(["discovery", "run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", "--raw-finding", "system/notes/raw.md"], root);
    assert.equal(out.code, 0, out.stderr);
    const raw = readFileSync(join(root, "workspace", "runs", "RUN-003", "raw-findings.md"), "utf8");
    assert.match(raw, /the system raw finding/);
    assert.doesNotMatch(raw, /the root raw finding/);
    const row = lastRow(join(root, ".os", "data", "runs.jsonl"));
    const refs = row["source_refs"] as string[];
    assert.ok(refs.includes("system/notes/raw.md"), "the run names the file it read");
    assert.ok(!refs.includes("notes/raw.md"), "the run does not name the other file");
    assert.ok(refs.some((ref) => ref.startsWith("playbooks/")) && !refs.some((ref) => ref.startsWith("system/playbooks/")), "the BuildOS-owned playbook path keeps the layout rule");
  });
});

describe("P7-R4-02: a JSONL row its reader could not read is never written", () => {
  it("the shared check: a line of the limit or more is refused with exit 4 wording, and each governed dataset has its reader's limit", () => {
    assert.equal(jsonlRowLimit("findings.jsonl"), 64 * 1024);
    assert.equal(jsonlRowLimit("runs.jsonl"), 64 * 1024);
    assert.equal(jsonlRowLimit("requirements.jsonl"), 16 * 1024 * 1024);
    const ok = new Uint8Array(JSONL_ROW_LIMITS.scanner - 1).fill(0x61);
    checkRowsReadBack("x.jsonl", ok, JSONL_ROW_LIMITS.scanner);
    assert.throws(() => checkRowsReadBack("x.jsonl", new Uint8Array([0x7b, 0x0a, ...new Uint8Array(JSONL_ROW_LIMITS.scanner).fill(0x61)]), JSONL_ROW_LIMITS.scanner), (error: Error & { code?: string }) => {
      assert.match(error.message, /x\.jsonl: line 2 would be 65536 bytes, and BuildOS reads at most 65535 bytes in one line of this file/);
      return true;
    });
  });

  /** The installed design fixture with FIND-001's row grown to `size` bytes (readable: under 64 KiB). */
  function promotionWithRow(size: number): string {
    const root = copy("design-installed");
    const index = join(root, ".os", "data", "findings.jsonl");
    const rows = readFileSync(index, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    const row = rows.find((r) => r["id"] === "FIND-001")!;
    row["observed"] = "";
    const base = JSON.stringify(row).length;
    row["observed"] = "o".repeat(size - base);
    assert.equal(JSON.stringify(row).length, size);
    writeFileSync(index, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
    return root;
  }

  it("design promote: a readable 65,520-byte row that promotion would grow past the line limit stops with exit 4, the dry run too, and nothing is written", async () => {
    const root = promotionWithRow(65_520);
    const before = tree(root);
    for (const extra of [["--dry-run"], []]) {
      const out = await design(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "long-row", ...extra], root);
      assert.equal(out.code, 4, `${extra.join(" ")}: ${out.stderr}`);
      assert.match(out.stderr, /findings\.jsonl: line \d+ would be \d+ bytes, and BuildOS reads at most 65535 bytes in one line of this file/);
    }
    assertSameTree(tree(root), before, "project tree");
  });

  it("design promote: a row that stays under the limit is still promoted (the check does not refuse a fitting row)", async () => {
    const root = promotionWithRow(60_000);
    const out = await design(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "fits"], root);
    assert.equal(out.code, 0, out.stderr);
    const again = await design(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "change-plan", "--slug", "fits-again"], root);
    assert.equal(again.code, 0, again.stderr);
  });

  it("discovery run: a new runs.jsonl row over the line limit stops with exit 4, the dry run too, and nothing is written", async () => {
    const root = copy("discovery-installed");
    const before = tree(root);
    for (const extra of [["--dry-run"], []]) {
      const out = await buildos(["discovery", "run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", "--title", "t".repeat(70_000), ...extra], root);
      assert.equal(out.code, 4, out.stderr);
      assert.match(out.stderr, /runs\.jsonl: the new row would be \d+ bytes, and BuildOS reads at most 65535 bytes/);
    }
    assertSameTree(tree(root), before, "project tree");
  });
});

describe("P7-R4-03: HTML image addresses are decoded once before the containment check", () => {
  it("decodes once and keeps the Go spelling for an invalid escape", () => {
    assert.equal(decodeImagePath("my%20image.png"), "my image.png");
    assert.equal(decodeImagePath("a%2520b.png"), "a%20b.png", "decoded once");
    assert.equal(decodeImagePath("plain.png"), "plain.png");
    assert.equal(decodeImagePath("bad%zz.png"), undefined);
    assert.equal(decodeImagePath("bad%C3.png"), undefined, "not UTF-8");
    assert.equal(decodeImagePath("nul%00.png"), "nul");
  });

  function htmlProject(images: Record<string, string>, srcs: string[]): string {
    const root = copy("intake-installed");
    mkdirSync(join(root, "inputs", "page"), { recursive: true });
    for (const [name, data] of Object.entries(images)) writeFileSync(join(root, "inputs", "page", name), data);
    writeFileSync(join(scratch, `outside-${counter}.png`), "OUTSIDE");
    writeFileSync(join(root, "inputs", "page", "page.html"), `<html><body><h1>Page</h1>\n${srcs.map((s, i) => `<img src="${s}" alt="Image ${i + 1}">`).join("\n")}\n</body></html>`);
    return root;
  }
  const media = (root: string) => {
    const dir = join(root, "assets", "page", "media");
    return existsSync(dir) ? readdirSync(dir).sort().map((name) => readFileSync(join(dir, name), "utf8")) : [];
  };

  it("copies a sibling image whose address encodes a space, and still copies a file Go read by its literal name", async () => {
    const root = htmlProject({ "my image.png": "SPACED", "lit%41.png": "LITERAL" }, ["my%20image.png", "lit%41.png"]);
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/page/page.html"], root);
    assert.equal(out.code, 0, out.stderr);
    assert.deepEqual(media(root), ["SPACED", "LITERAL"]);
    assert.doesNotMatch(readFileSync(join(root, "assets", "page", "page.md"), "utf8"), /Uncopied image/);
  });

  it("an encoded parent path is refused like a plain one, and the warning says what the marker holds", async () => {
    const root = htmlProject({}, [`..%2F..%2F..%2Foutside-${counter + 1}.png`, "nul%00.png"]);
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/page/page.html"], root);
    assert.equal(out.code, 0, out.stderr);
    assert.deepEqual(media(root), []);
    const twin = readFileSync(join(root, "assets", "page", "page.md"), "utf8");
    assert.match(twin, /\[Uncopied image: Image 1\]\(\.\.%2F/);
    assert.match(twin, /\[Uncopied image: Image 2\]\(nul%00\.png\)/);
    assert.match(out.stderr, /the file is outside the folder that holds the document and outside the project, so BuildOS did not read it\. The converted file has an "Uncopied image" marker with the address as the document gives it; that address is relative to the document, not to the converted file\./);
    assert.match(out.stderr, /did not copy image nul%00\.png .*encoded zero byte/);
    assert.doesNotMatch(out.stderr, /links to the image instead/);
  });
});

describe("P7-R4-04 and P7-R4-05: the Make Docs 2.0.9 design form", () => {
  function companionProject(): string {
    const root = copy("design-installed");
    rmSync(join(root, "docs", "assets"), { recursive: true });
    rmSync(join(root, "docs", "designs", "AGENTS.md"));
    cpSync(COMPANION, root, { recursive: true });
    return root;
  }
  const designText = (root: string, slug: string) => readFileSync(join(root, "docs", "designs", `${goLocalDate(NOW)}-${slug}.md`), "utf8");
  const TEMPLATE = (root: string) => join(root, ".make-docs", "system", "templates", "design.md");
  const frontmatterOf = (text: string) => text.slice(4, text.indexOf("\n---\n", 4) + 1);
  const headings = (text: string) => text.split("\n").filter((line) => /^#{1,2} /.test(line));

  it("a template whose title is single-quoted is an unknown form: exit 3, nothing written, even for a title with an apostrophe", async () => {
    const root = companionProject();
    writeFileSync(TEMPLATE(root), readFileSync(TEMPLATE(root), "utf8").replace('title: "{{TITLE}}"', "title: '{{TITLE}}'"));
    const before = tree(root);
    const out = await design(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "quoted", "--title", "Tax isn't added"], root);
    assert.equal(out.code, 3, out.stderr);
    assert.match(out.stderr, /frontmatter value for title is not a double-quoted "\{\{\.\.\.\}\}" value|frontmatter line for title is not the Make Docs 2\.0\.9 line/);
    assertSameTree(tree(root), before, "project tree");
  });

  it("a template that moves Human Experience Intent out of its contract position is an unknown form: exit 3, nothing written", async () => {
    const root = companionProject();
    const text = readFileSync(TEMPLATE(root), "utf8");
    const start = text.indexOf("## Human Experience Intent");
    const end = text.indexOf("\n## ", start + 1) + 1;
    const section = text.slice(start, end);
    const moved = text.slice(0, start) + text.slice(end);
    const at = moved.indexOf("## Alternatives Considered");
    writeFileSync(TEMPLATE(root), moved.slice(0, at) + section + moved.slice(at));
    const before = tree(root);
    const out = await design(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "moved"], root);
    assert.equal(out.code, 3, out.stderr);
    assert.match(out.stderr, /are not in the order the design contract gives/);
    assertSameTree(tree(root), before, "project tree");
  });

  const TITLES: [string, string][] = [
    ["apostrophe", "Tax isn't added"],
    ["colon", "Tax: missing from total"],
    ["placeholder", "Keep {{x}} and {{TITLE}} as text"],
    ["multi-line", "First line\n## Decision\n# Second heading"],
    ["unicode", "Café tax ✓ — ünïcode   end"],
    ["quotes", 'Say "tax" \\ backslash'],
  ];
  for (const [slug, title] of TITLES) {
    it(`a ${slug} title: valid frontmatter that reads back exactly, one title line, and the template's sections once each`, async () => {
      const root = companionProject();
      const out = await design(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", slug, "--title", title], root);
      assert.equal(out.code, 0, out.stderr);
      const text = designText(root, slug);
      const front = frontmatterOf(text);
      const parsed = parseYamlSubset(front, "design") as Map<string, unknown>;
      assert.equal(readYamlInside(parsed.get("title") as string), title, "the title reads back exactly");
      for (const line of front.split("\n").filter((l) => l.includes('"'))) assert.ok(readYamlInside(/: "(.*)"$/.exec(line)![1]!) !== undefined, "each value is a valid double-quoted scalar");
      const top = headings(text);
      assert.equal(top.filter((h) => h.startsWith("# ")).length, 1, "one title line");
      assert.equal(top[0], `# ${headingText(title)}`);
      assert.deepEqual(top.filter((h) => h.startsWith("## ")).map((h) => h.slice(3)), ["Purpose", "Context", "Human Experience Intent", "Performance Evidence Candidates", "Decision", "Alternatives Considered", "Consequences", "Intended Follow-On"]);
    });
  }

  it("user text in the finding (summary, observed text) cannot add or hide a section", async () => {
    const root = companionProject();
    const index = join(root, ".os", "data", "findings.jsonl");
    const rows = readFileSync(index, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    const row = rows.find((r) => r["id"] === "FIND-001")!;
    row["summary"] = "Summary line\n## Decision\nfake decision\n```\nopen fence";
    row["observed"] = "Observed\n===\n<!-- open comment\n# Title two";
    writeFileSync(index, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
    const out = await design(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "user-text"], root);
    assert.equal(out.code, 0, out.stderr);
    const text = designText(root, "user-text");
    assert.deepEqual(headings(text).filter((h) => h.startsWith("## ")).length, 8);
    assert.match(text, /^\\## Decision$/m);
    assert.match(text, /^\\```$/m);
    assert.match(text, /^\\===$/m);
    assert.match(text, /^\\<!-- open comment$/m);
    assert.match(text, /^\\# Title two$/m);
  });

  it("the helpers: escaping, reading back, and the 2.0.9 required headings", () => {
    for (const value of ["plain", "it's", 'a "b"', "back\\slash", "line\nbreak", "tab\tx", "nul\u0000", "del\u007f", "sep x", "ünï ✓ 😀"]) assert.equal(readYamlInside(yamlInside(value)), value, JSON.stringify(value));
    assert.equal(readYamlInside('bad"quote'), undefined);
    assert.equal(readYamlInside("bad\\q"), undefined);
    assert.equal(neutralizeBlocks("a\r\n# b\r   ## c\n    # code\n---\n- item"), "a\n\\# b\n   \\## c\n    # code\n\\---\n- item");
    assert.equal(headingText("# a\nb"), "\\# a b");
    assert.deepEqual([...REQUIRED_HEADINGS_209], ["Purpose", "Context", "Human Experience Intent", "Decision", "Alternatives Considered", "Consequences", "Intended Follow-On"]);
  });
});
