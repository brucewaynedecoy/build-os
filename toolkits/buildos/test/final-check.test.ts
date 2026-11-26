// W1 R7 P7 final check (P7-F-04 to P7-F-07). Each test failed before its fix.
// P7-F-01 and P7-F-02 are in deny-list.test.ts; P7-F-03 is in
// test-output-safety.test.ts.

import assert from "node:assert/strict";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { after, describe, it } from "node:test";
import { createDesignDomain } from "../src/cli/commands/design.ts";
import { run } from "../src/cli/run.ts";
import { neutralizeBlocks } from "../src/core/design/make-docs-form.ts";
import { appendedIndex } from "../src/core/discovery/discovery.ts";
import { goLocalDate } from "../src/core/shared/go-text.ts";
import { JSONL_ROW_LIMITS } from "../src/core/shared/read-limits.ts";
import { assertSame, assertSameTree, captureIo, shape } from "./helpers.ts";

const scratch = mkdtempSync(join(tmpdir(), "buildos-final-check-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const GOLDEN = join(import.meta.dirname, "fixtures", "golden");
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

const enc = (text: string) => new TextEncoder().encode(text);

describe("P7-F-04: a JSONL append never joins the new row to a last row with no line feed", () => {
  it("the shared helper adds a line feed only when the bytes are not empty and do not end in one", () => {
    const row = { id: "RUN-009" };
    const line = '{"id":"RUN-009"}\n';
    const text = (existing: string | undefined) => new TextDecoder().decode(appendedIndex(existing === undefined ? undefined : enc(existing), row));
    assert.equal(text(undefined), line);
    assert.equal(text(""), line);
    assert.equal(text('{"a":1}'), `{"a":1}\n${line}`);
    assert.equal(text('{"a":1}\n'), `{"a":1}\n${line}`);
    assert.equal(text('{"a":1}\r\n'), `{"a":1}\r\n${line}`);
    assert.equal(text('{"a":1}\n\n\n'), `{"a":1}\n\n\n${line}`);
  });

  const runArgs = (root: string, extra: string[] = []) => ["discovery", "run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", ...extra];
  const runsIndex = (root: string) => join(root, ".os", "data", "runs.jsonl");
  /** Every line of the index is one JSON object (blank lines allowed) and under the line limit. */
  function assertReadable(path: string): number {
    const lines = readFileSync(path, "utf8").split("\n");
    assert.equal(lines.at(-1), "", "the index ends in a line feed");
    let rows = 0;
    for (const [index, line] of lines.slice(0, -1).entries()) {
      if (line.trim() === "") continue;
      assert.ok(Buffer.byteLength(line) < JSONL_ROW_LIMITS.scanner, `line ${index + 1} is under the line limit`);
      assert.doesNotThrow(() => JSON.parse(line), `line ${index + 1} is one JSON object`);
      rows += 1;
    }
    return rows;
  }

  for (const [name, edit] of [
    ["a small last row with no line feed", (text: string) => text.replace(/\n$/, "")],
    ["a CRLF-terminated index", (text: string) => text.replace(/\n/g, "\r\n")],
  ] as const) {
    it(`discovery run: ${name}: the dry run and the apply exit 0, the new row is its own line, and the next run reads the index`, async () => {
      const root = copy("discovery-installed");
      writeFileSync(runsIndex(root), edit(readFileSync(runsIndex(root), "utf8")));
      const before = readFileSync(runsIndex(root));
      const dry = await buildos(runArgs(root, ["--dry-run"]), root);
      assert.equal(dry.code, 0, shape(dry.stderr));
      assertSame(readFileSync(runsIndex(root)), before, "the dry run writes nothing");
      const out = await buildos(runArgs(root), root);
      assert.equal(out.code, 0, shape(out.stderr));
      const after = readFileSync(runsIndex(root));
      assertSame(after.subarray(0, before.length), before, "the old bytes are kept");
      assert.equal(assertReadable(runsIndex(root)), 3);
      const next = await buildos(runArgs(root), root);
      assert.equal(next.code, 0, shape(next.stderr));
      assert.equal(assertReadable(runsIndex(root)), 4);
    });
  }

  it("discovery run: an index that ends in several line feeds stops before any write, as before (blank rows are refused), and the helper adds no line feed", async () => {
    const root = copy("discovery-installed");
    writeFileSync(runsIndex(root), `${readFileSync(runsIndex(root), "utf8")}\n\n`);
    const before = readFileSync(runsIndex(root));
    for (const extra of [["--dry-run"], []]) {
      const out = await buildos(runArgs(root, extra), root);
      assert.equal(out.code, 1, shape(out.stderr));
      assert.ok(out.stderr.includes("blank JSONL row"), "the error names the blank row");
    }
    assertSame(readFileSync(runsIndex(root)), before, "nothing is written");
  });

  it("discovery run: an empty index gets the row and its line feed only", async () => {
    const root = copy("discovery-installed");
    writeFileSync(runsIndex(root), "");
    rmSync(join(root, "workspace", "runs"), { recursive: true });
    const out = await buildos(runArgs(root), root);
    assert.equal(out.code, 0, shape(out.stderr));
    assert.equal(assertReadable(runsIndex(root)), 1);
    assert.ok(readFileSync(runsIndex(root), "utf8").startsWith('{"id":"RUN-001"'), "the only row is the new run");
  });

  it("discovery run: a valid 65,000-byte last row with no line feed stays its own line; the next run still reads the index", async () => {
    const root = copy("discovery-installed");
    const rows = readFileSync(runsIndex(root), "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    const last = rows.at(-1)!;
    last["notes"] = "";
    last["notes"] = "n".repeat(65_000 - JSON.stringify(last).length);
    assert.equal(JSON.stringify(last).length, 65_000);
    writeFileSync(runsIndex(root), rows.map((r) => JSON.stringify(r)).join("\n"));
    const dry = await buildos(runArgs(root, ["--dry-run"]), root);
    assert.equal(dry.code, 0, shape(dry.stderr));
    const out = await buildos(runArgs(root), root);
    assert.equal(out.code, 0, shape(out.stderr));
    assert.equal(assertReadable(runsIndex(root)), 3);
    const next = await buildos(runArgs(root), root);
    assert.equal(next.code, 0, shape(next.stderr));
  });

  it("discovery qualify finding: a findings index with no final line feed gets a separate row, and the next qualification reads it", async () => {
    const root = copy("discovery-installed");
    mkdirSync(join(root, "inputs"), { recursive: true });
    writeFileSync(join(root, "inputs", "raw.md"), "raw finding\n");
    writeFileSync(join(root, "inputs", "confirm.spec.ts"), "test('negative assertion', async () => {})\n");
    writeFileSync(join(root, "inputs", "confirmation.txt"), "passed\n");
    assert.equal((await buildos(runArgs(root, ["--raw-finding", "inputs/raw.md"]), root)).code, 0);
    const qualify = ["discovery", "qualify", "finding", "--repo-root", root, "--run-id", "RUN-003", "--raw-finding-ref", "#raw-finding-1", "--outcome", "negative", "--confirmation-test", "inputs/confirm.spec.ts", "--confirmation-evidence", "inputs/confirmation.txt"];
    const first = await buildos(qualify, root);
    assert.equal(first.code, 0, shape(first.stderr));
    const findings = join(root, ".os", "data", "findings.jsonl");
    writeFileSync(findings, readFileSync(findings, "utf8").replace(/\n$/, ""));
    const dry = await buildos([...qualify, "--dry-run"], root);
    assert.equal(dry.code, 0, shape(dry.stderr));
    const second = await buildos(qualify, root);
    assert.equal(second.code, 0, shape(second.stderr));
    assert.equal(assertReadable(findings), 2);
    const third = await buildos(qualify, root);
    assert.equal(third.code, 0, shape(third.stderr));
    assert.equal(assertReadable(findings), 3);
  });
});

// P7-F-05 and P7-F-06: promotion in the Make Docs 2.0.9 form.
const COMPANION = join(import.meta.dirname, "fixtures", "make-docs-companion");
const NOW = new Date("2026-11-24T12:00:00Z");

async function design(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const code = await run(["design", ...args], io, { domains: [createDesignDomain({ now: () => NOW })] });
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

function companionProject(): string {
  const root = copy("design-installed");
  rmSync(join(root, "docs", "assets"), { recursive: true });
  rmSync(join(root, "docs", "designs", "AGENTS.md"));
  cpSync(COMPANION, root, { recursive: true });
  return root;
}
const TEMPLATE = (root: string) => join(root, ".make-docs", "system", "templates", "design.md");
const designFile = (root: string, slug: string) => join(root, "docs", "designs", `${goLocalDate(NOW)}-${slug}.md`);
const promote = (root: string, slug: string, extra: string[] = []) => design(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", slug, ...extra], root);

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

const NEXT_PROMPT = "- Next Prompt: [designs-to-plan.prompt.md](../../.make-docs/system/prompts/designs-to-plan.prompt.md). Read `make-docs://system/prompt/designs-to-plan.prompt.md` with `make-docs resource read`.";

describe("P7-F-05: an edited design template is checked against the 2.0.9 placeholder positions before anything is written", () => {
  it("the real 2.0.9 template (the companion fixture) is accepted in LF, CRLF, and with a byte order mark, and gives the relative Next Prompt link", async () => {
    for (const [form, edit] of [
      ["LF", (t: string) => t],
      ["CRLF", (t: string) => t.replace(/\n/g, "\r\n")],
      ["BOM", (t: string) => `\ufeff${t}`],
      ["BOM and CRLF", (t: string) => `\ufeff${t.replace(/\n/g, "\r\n")}`],
    ] as const) {
      const root = companionProject();
      writeFileSync(TEMPLATE(root), edit(readFileSync(TEMPLATE(root), "utf8")));
      const out = await promote(root, "stock");
      assert.equal(out.code, 0, `${form}: ${shape(out.stderr)}`);
      const lines = readFileSync(designFile(root, "stock"), "utf8").split("\n");
      assert.equal(lines.filter((line) => line.startsWith("- Next Prompt:")).length, 1, `${form}: one Next Prompt line`);
      assert.ok(lines.includes(NEXT_PROMPT), `${form}: the Next Prompt line is the relative link`);
    }
  });

  for (const [name, change] of [
    ["the Next Prompt placeholder inside inline code", (t: string) => t.replace("- Next Prompt: {{NEXT_PROMPT_LINK}}.", "- Next Prompt: `{{NEXT_PROMPT_LINK}}`.")],
    ["an unknown placeholder on the Why line", (t: string) => t.replace("- Why: Explain why", "- Why: {{FOLLOW_ON_EXTRA}} Explain why")],
    ["an unknown placeholder on the Route line", (t: string) => t.replace("- Route: `baseline-plan`", "- Route: {{ROUTE_NOTE}} `baseline-plan`")],
    ["an unknown placeholder in a filled section", (t: string) => t.replace("Explain what decision this document captures", "{{PURPOSE_NOTE}} Explain what decision this document captures")],
    ["an unknown placeholder in a kept section", (t: string) => t.replace("Affected humans: {{AFFECTED_HUMANS}}", "Affected humans: {{AFFECTED_HUMANS}} {{TEAM_NOTE}}")],
    ["a known placeholder in another section", (t: string) => t.replace("Explain what decision this document captures", "{{IMPACT}} Explain what decision this document captures")],
    ["a second Next Prompt line", (t: string) => t.replace(/^(- Next Prompt:.*\n)/m, "$1$1")],
    ["{{TITLE}} outside the title line", (t: string) => t.replace("Describe the chosen approach", "For {{TITLE}}, describe the chosen approach")],
  ] as const) {
    it(`${name}: exit 3, nothing written, the dry run too`, async () => {
      const root = companionProject();
      writeFileSync(TEMPLATE(root), change(readFileSync(TEMPLATE(root), "utf8")));
      const before = tree(root);
      for (const extra of [["--dry-run"], []]) {
        const out = await promote(root, "edited", extra);
        assert.equal(out.code, 3, shape(out.stderr));
        assert.ok(out.stderr.includes("has a form this BuildOS version does not know"), "the error says the form is unknown");
      }
      assertSameTree(tree(root), before, "project tree");
    });
  }
});

describe("P7-F-06: fenced code in a finding keeps its meaning in the 2.0.9 form", () => {
  it("the helper keeps balanced fences byte for byte and neutralizes only headings and unmatched fences outside them", () => {
    const yaml = "```yaml\nfollow_on:\n  route: \"x\"\n  # a comment\n---\n```";
    assert.equal(neutralizeBlocks(`Before\n${yaml}\nAfter`), `Before\n${yaml}\nAfter`);
    const json = '~~~json\n{\n  "a": [1, 2]\n}\n~~~';
    assert.equal(neutralizeBlocks(json), json);
    const shell = "```sh\n$ buildos validate --root .\n<output>\n## not a heading\n```";
    assert.equal(neutralizeBlocks(shell), shell);
    const nested = "````md\n```js\nconst a = 1;\n```\n## inside\n````";
    assert.equal(neutralizeBlocks(nested), nested);
    assert.equal(neutralizeBlocks("```\nunclosed\n## Decision"), "\\```\nunclosed\n\\## Decision");
    assert.equal(neutralizeBlocks("~~~\nshort close\n```"), "\\~~~\nshort close\n\\```");
    assert.equal(neutralizeBlocks("````\nfour\n```\n## after"), "\\````\nfour\n\\```\n\\## after");
    assert.equal(neutralizeBlocks("## Outside\n```\n## Inside\n```\n# Also outside"), "\\## Outside\n```\n## Inside\n```\n\\# Also outside");
    assert.equal(neutralizeBlocks("a\r\n```\r\nx\r\n```"), "a\n```\nx\n```");
  });

  it("promotion keeps a fenced YAML example (fence, rows, indentation), escapes a heading outside it, closes no section early, and passes the section self-check", async () => {
    const root = companionProject();
    const index = join(root, ".os", "data", "findings.jsonl");
    const rows = readFileSync(index, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    const row = rows.find((r) => r["id"] === "FIND-001")!;
    const example = "```yaml\nfollow_on:\n  route: \"change-plan\"\n  items:\n    - one\n    - two\n## not a section\n```";
    row["summary"] = `The config is read as:\n\n${example}\n\n## Decision\nfake decision\n\`\`\`\nunbalanced`;
    writeFileSync(index, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
    const out = await promote(root, "fenced");
    assert.equal(out.code, 0, shape(out.stderr));
    const text = readFileSync(designFile(root, "fenced"), "utf8");
    assert.ok(text.includes(`\n${example}\n`), "the fenced example is kept byte for byte");
    assert.ok(/^\\## Decision$/m.test(text), "a heading outside the fence is escaped");
    assert.ok(/^\\```$/m.test(text), "the unbalanced fence is escaped");
    // The example's own "## not a section" line is code; outside it, the headings are the template's.
    const sections = text.replace(example, "").split("\n").filter((line) => line.startsWith("## "));
    assertSame(sections.map((line) => line.slice(3)), ["Purpose", "Context", "Human Experience Intent", "Performance Evidence Candidates", "Decision", "Alternatives Considered", "Consequences", "Intended Follow-On"], "the template's sections, once each");
    assert.ok(text.split("\n").includes(NEXT_PROMPT), "the Next Prompt line is the relative link");
  });
});
