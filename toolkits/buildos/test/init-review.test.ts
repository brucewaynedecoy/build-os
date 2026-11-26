// W1 R7 P6 review round 1: one or more tests per finding (P6-R1-01 to
// P6-R1-18). Each test fails without its fix. Most run `buildos init` in
// process through `run`, so a test can inject a Make Docs stub, a write
// failure, or a change in the middle of a run. Tests that need a feature of
// the running system (a symbolic link, POSIX permissions, a case-insensitive
// volume) check for it first and say so when they skip.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, sep } from "node:path";
import { after, before, describe, it } from "node:test";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { run } from "../src/cli/run.ts";
import { createNodeFsPort, writeRaceHooks } from "../src/adapters/node-fs.ts";
import { nodeHash } from "../src/adapters/node-hash.ts";
import { findOnPath } from "../src/adapters/node-process.ts";
import { loadSourceContent } from "../src/adapters/package-content.ts";
import { commandLine } from "../src/core/init/make-docs.ts";
import { mergeSection, SHARED_FILES } from "../src/core/init/shared-files.ts";
import type { FsPortFactory } from "../src/core/shared/fs-port.ts";
import type { ProcessPort } from "../src/core/shared/process-port.ts";
import { assertOutputDoesNotMatch, assertOutputMatches, assertSame, buildosSection, captureIo, shape, tag } from "./helpers.ts";

const windows = process.platform === "win32";
const SYSTEM = join(import.meta.dirname, "..", "..", "..", "system");
const content = loadSourceContent(SYSTEM);
const AGENTS = SHARED_FILES[0]!;
const GITIGNORE = SHARED_FILES[2]!;
const enc = (text: string) => new TextEncoder().encode(text);
const dec = (data: Uint8Array) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(data);

let scratch: string;
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-init-review-"));
});
after(() => {
  // A test may leave a read-only folder: make it writable so it can go.
  for (const name of readdirSync(scratch)) {
    try {
      chmodSync(join(scratch, name, "project", "assets"), 0o755);
    } catch {
      // Not there.
    }
  }
  rmSync(scratch, { recursive: true, force: true });
});

let counter = 0;
function folder(): string {
  const dir = join(scratch, `case-${++counter}`, "project");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The package section of `path`, as `buildos init` writes it. */
function section(path: string, eol = "\n", last = eol): string {
  return buildosSection(readFileSync(join(SYSTEM, path), "utf8"), { gitignore: path === ".gitignore", eol, last });
}

/** A Make Docs stub as a process port: `action` runs in the target folder, then it reports success. */
function makeDocs(action: (target: string) => void = () => {}, code = 0): { port: ProcessPort; runs: number } {
  const state = { runs: 0 };
  return {
    get runs() {
      return state.runs;
    },
    port: {
      find: (name) => (name === "make-docs" ? "/stub/make-docs" : undefined),
      run: (_program, _args, options) => {
        state.runs++;
        action(options.cwd);
        return code === 0 ? { exitCode: 0, stdout: '{"status":"complete"}', stderr: "" } : { exitCode: code, stdout: "", stderr: "boom" };
      },
    },
  };
}

async function init(dir: string, args: string[], options: { openFs?: FsPortFactory; process?: ProcessPort } = {}) {
  const io = captureIo(dir);
  const domain = createInitDomain({
    loadContent: () => content,
    now: () => new Date("2026-11-24T00:00:00Z"),
    openProcess: () => options.process ?? makeDocs().port,
  });
  const exit = await run(["init", ...args], io, { domains: [domain], ...(options.openFs === undefined ? {} : { openFs: options.openFs }) });
  const stdout = io.stdout();
  return { exit, stdout, stderr: io.stderr(), json: args.includes("--json") ? JSON.parse(stdout) : undefined };
}

function trySymlink(target: string, path: string): boolean {
  try {
    symlinkSync(target, path);
    return true;
  } catch {
    return false;
  }
}

/** True when this user can be refused by POSIX permissions (not Windows, not root). */
const permissionsApply = !windows && process.getuid?.() !== 0;

describe("P6-R1-01, P6-R2-01, and P6-R3-01: marker lines without a valid integrity line are the user's text", () => {
  const sample = "```md\n<!-- buildos:begin -->\nsample text\n<!-- buildos:end -->\n```\n";

  it("updates only the real section when the file also holds a sample section in a fenced code block", async () => {
    const dir = folder();
    const user = `# Mine\n\nExample:\n\n${sample}\n${buildosSection("old\n")}`;
    writeFileSync(join(dir, "AGENTS.md"), user);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `# Mine\n\nExample:\n\n${sample}\n${section("AGENTS.md")}`);
    assertSame(result.json.result.shared_files[0].result, "block_updated");
  });

  // P6-R3-01 replaces the P6-R2-01 stop: a column-0 pair in a code block without a valid integrity line is an example.
  it("keeps a column-0 sample pair in a code block as the user's example, and adds the section after it", async () => {
    const dir = folder();
    const user = `# Mine\n\n${sample}`;
    writeFileSync(join(dir, "AGENTS.md"), user);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(result.json.result.shared_files[0].result, "block_added");
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `${user}\n${section("AGENTS.md")}`);
  });

  it("adds the section after an indented example, and keeps the example byte for byte", async () => {
    const dir = folder();
    const user = "# Mine\n\n```md\n  <!-- buildos:begin -->\n  sample text\n  <!-- buildos:end -->\n```\n";
    writeFileSync(join(dir, "AGENTS.md"), user);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `${user}\n${section("AGENTS.md")}`);
  });

  // P6-R3-04 replaces the P6-R2-01 stop: a file with no marker lines never stops for a region.
  for (const [what, user] of [
    ["an open code block", "# Mine\n```\ncode that never closes\n"],
    ["an unfinished HTML comment", "# Mine\n<!-- notes that never close\nmore\n"],
  ] as const) {
    it(`adds the section at the top of a file that ends inside ${what}, and changes no byte of the file`, async () => {
      const dir = folder();
      writeFileSync(join(dir, "AGENTS.md"), user);
      const result = await init(dir, ["--skip-make-docs", "--json"]);
      assert.equal(result.exit, 0, shape(result.stdout));
      assertSame(result.json.result.shared_files[0], { path: "AGENTS.md", result: "block_added", position: "top" });
      assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `${section("AGENTS.md")}\n${user}`);
      // A rerun finds the section as BuildOS wrote it.
      const again = await init(dir, ["--skip-make-docs", "--json"]);
      assertSame(again.json.result.shared_files[0].result, "unchanged");
    });
  }

  it("says where the section went, in the plan and in the result", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n```\nopen\n");
    const dry = await init(dir, ["--skip-make-docs", "--dry-run"]);
    assertOutputMatches(dry.stdout, /\n {2}update {3}AGENTS\.md \(add the BuildOS section at the top, because the file ends inside an unclosed code block or comment; the other lines stay as they are\)\n/);
    const human = await init(dir, ["--skip-make-docs"]);
    assertOutputMatches(human.stdout, /\n {2}AGENTS\.md: BuildOS section added at the top, because the file ends inside an unclosed code block or comment; the other lines were not changed\n/);
  });

  // P6-R2-01: the reviewer's two cases, through the CLI.
  it("a CRLF list item that opens a ~~~md fence with two-space-indented example markers: the example stays, and the section is added", async () => {
    const dir = folder();
    const user = "# Mine\r\n\r\n- Example:\r\n  ~~~md\r\n  <!-- buildos:begin -->\r\n  sample text\r\n  <!-- buildos:end -->\r\n  ~~~\r\n";
    writeFileSync(join(dir, "AGENTS.md"), user);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(result.json.result.shared_files[0].result, "block_added");
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `${user}\r\n${section("AGENTS.md", "\r\n")}`);
  });

  it("~~~ inside an HTML comment does not hide a real section (no second section)", async () => {
    const dir = folder();
    const user = `# Mine\n<!--\n~~~\nnotes\n-->\n${buildosSection("old\n")}`;
    writeFileSync(join(dir, "AGENTS.md"), user);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(result.json.result.shared_files[0].result, "block_updated");
    const text = readFileSync(join(dir, "AGENTS.md"), "utf8");
    assertSame(text, `# Mine\n<!--\n~~~\nnotes\n-->\n${section("AGENTS.md")}`);
    assert.equal(text.split("<!-- buildos:begin -->").length, 2);
  });

  // P6-R3-01: the reviewer's three cases. Before round 3, each exited 0 and deleted the team instruction.
  for (const [what, before, after] of [
    ["a <pre> opened after other tags on one line", "<details><summary>Router example</summary><pre>\n", "</pre></details>\n"],
    ["a <script> block that holds the text '</pre>' before the pair", '<script type="text/plain">\nconst s = \'</pre>\';\n', "</script>\n"],
    ["a comment opened in the middle of a line", "Some text <!-- a note\n", "-->\n"],
  ] as const) {
    it(`keeps a team instruction between column-0 marker lines inside ${what} (exit 0, every byte kept)`, async () => {
      const dir = folder();
      const user = `# Team\n\n${before}<!-- buildos:begin -->\nTeam instruction: never push to main.\n<!-- buildos:end -->\n${after}`;
      writeFileSync(join(dir, "AGENTS.md"), user);
      const result = await init(dir, ["--skip-make-docs", "--json"]);
      assert.equal(result.exit, 0, shape(result.stdout));
      const text = readFileSync(join(dir, "AGENTS.md"), "utf8");
      assert.ok(text.startsWith(user), tag(String(text)));
      assertSame(text, `${user}\n${section("AGENTS.md")}`);
    });
  }

  it("stops (exit 10), names the line, and changes nothing for a section changed by hand, outside every region", async () => {
    const dir = folder();
    const changed = section("AGENTS.md").replace("# Agent Instructions\n", "# Agent Instructions\nTeam instruction: never push to main.\n");
    const user = `# Team\n\n${changed}`;
    writeFileSync(join(dir, "AGENTS.md"), user);
    const human = await init(dir, ["--skip-make-docs"]);
    assert.equal(human.exit, 10);
    assert.ok(human.stdout.endsWith(
        "AGENTS.md line 3 starts a BuildOS section that was changed by hand, or that is an example. BuildOS replaces only a section that it wrote and that no one changed, so it did not change this file.\nTo fix it: Move your own text outside the buildos lines, or delete the buildos lines. Then run `buildos init` again.\n",
      ), shape(human.stdout));
    const json = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(json.exit, 10);
    assertSame([json.json.result.problems[0].problem, json.json.result.problems[0].line], ["section_changed", 3]);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), user);
    assert.deepEqual(readdirSync(dir), ["AGENTS.md"]);
  });
});

describe("P6-R3-01: the ownership rule, table-driven", () => {
  const body = enc("current text\n");
  /** A section BuildOS wrote with an earlier text: its integrity line matches. */
  const OWNED = buildosSection("old\n");
  /** A pair with no integrity line: never BuildOS's. */
  const HAND = "<!-- buildos:begin -->\nold\n<!-- buildos:end -->\n";
  /** A pair whose integrity line does not match its text. */
  const EDITED = `<!-- buildos:begin -->\n<!-- buildos:section v1 sha256=${"0".repeat(64)} -->\nold\n<!-- buildos:end -->\n`;
  type Want = "add_block" | "add_top" | "update_block" | `problem:${string}`;
  const cases: [string, string, Want][] = [
    ["owned only", `# Mine\n${OWNED}`, "update_block"],
    ["a pair with no integrity line, outside every region", `# Mine\n${HAND}`, "problem:section_changed"],
    ["a pair whose integrity line does not match", `# Mine\n${EDITED}`, "problem:section_changed"],
    ["a hand pair at column 0 in a ``` fence", `# Mine\n\`\`\`\n${HAND}\`\`\`\n`, "add_block"],
    ["a hand pair indented in a ``` fence", "# Mine\n```\n  <!-- buildos:begin -->\n  <!-- buildos:end -->\n```\n", "add_block"],
    ["a sample in a fence, then the owned section", `\`\`\`\n${HAND}\`\`\`\n${OWNED}`, "update_block"],
    ["the owned section, then a sample after it", `${OWNED}~~~\n${HAND}~~~\n`, "update_block"],
    ["a fence in a list item", `- item\n  \`\`\`md\n${HAND}  \`\`\`\n`, "add_block"],
    ["a fence in a list item, then the owned section", `- item\n  \`\`\`md\n${HAND}  \`\`\`\n\n${OWNED}`, "update_block"],
    ["a fence in an ordered list item", `1. item\n   ~~~\n${HAND}   ~~~\n`, "add_block"],
    ["a fence in a block quote", `> \`\`\`\n${HAND}> \`\`\`\n`, "add_block"],
    ["a block quote fence closed without the quote marker stays open", `> \`\`\`\n> x\n\`\`\`\n${HAND}`, "add_top"],
    ["a longer closing fence closes", `\`\`\`\nx\n\`\`\`\`\`\n${HAND}`, "problem:section_changed"],
    ["a shorter closing fence does not close", `\`\`\`\`\nx\n\`\`\`\n${HAND}`, "add_top"],
    ["a tilde line does not close a backtick fence", `\`\`\`\nx\n~~~\n${HAND}`, "add_top"],
    ["a backtick line does not close a tilde fence", `~~~~\n\`\`\`\`\n~~~~\n${HAND}`, "problem:section_changed"],
    ["backticks with a backtick in the info string are not a fence", `\`\`\` a \` b\n${HAND}`, "problem:section_changed"],
    ["a <pre> block", `<pre>\n${HAND}</pre>\n`, "add_block"],
    ["a <pre> block, then the owned section", `<pre>\n${HAND}</pre>\n${OWNED}`, "update_block"],
    ["a <script> block on one line is not a region", `<script>x()</script>\n${HAND}`, "problem:section_changed"],
    ["an unclosed <textarea>", `<textarea>\n${HAND}`, "add_top"],
    ["an HTML comment holding fence characters", `<!--\n\`\`\`\n-->\n${HAND}`, "problem:section_changed"],
    ["an HTML comment holding a pair (a marker line does not end the comment)", `<!--\n${HAND}-->\n`, "add_block"],
    ["a comment opened before a hand pair and never closed", `<!--\n${HAND}`, "add_top"],
    ["an HTML comment holding an indented pair", "<!--\n <!-- buildos:begin -->\n-->\n", "add_block"],
    ["a comment holding a begin line, then the owned section", `<!-- notes\n<!-- buildos:begin -->\n-->\n${OWNED}`, "update_block"],
    ["an unclosed fence after the owned section", `${OWNED}\`\`\`\nx\n`, "update_block"],
    ["an unclosed comment after the owned section", `${OWNED}<!--\nnotes\n`, "update_block"],
    ["the owned section inside a code block is still owned", `\`\`\`\n${OWNED}\`\`\`\n`, "update_block"],
    ["<pre> opened after other tags on one line", `<details><summary>x</summary><pre>\n${HAND}</pre></details>\n`, "add_block"],
    ["a <script> holding '</pre>' before the pair", `<script type="text/plain">\nconst s = '</pre>';\n${HAND}</script>\n`, "add_block"],
    ["a comment opened in the middle of a line", `Text <!-- note\n${HAND}-->\n`, "add_block"],
    ["a <pre> in a code span opens nothing", `Use \`<pre>\` for code.\n${HAND}`, "problem:section_changed"],
    ["<!-- in a code span opens nothing", `Write \`<!--\` to start a comment.\n${HAND}`, "problem:section_changed"],
    ["a comment closed in the middle of a line, then a <pre> on the same line", `<!-- a\nb --> <pre>\n${HAND}</pre>\n`, "add_block"],
    ["a marker indented by one space is text", ` <!-- buildos:begin -->\n <!-- buildos:end -->\n`, "add_block"],
    ["a marker after 300 spaces is text", `${" ".repeat(300)}<!-- buildos:begin -->\n`, "add_block"],
    ["a marker in the middle of a line is text", "see <!-- buildos:begin --> here\n", "add_block"],
    ["trailing spaces and tabs at any length", OWNED.replace("<!-- buildos:begin -->", `<!-- buildos:begin -->${" ".repeat(300)}\t`), "update_block"],
    ["a begin line with no end line", "<!-- buildos:begin -->\n", "problem:begin_without_end"],
    ["two owned sections", `${OWNED}${OWNED}`, "problem:more_than_one_section"],
    ["the owned section and a hand pair", `${OWNED}${HAND}`, "problem:more_than_one_section"],
    ["no marker lines, ending inside an open fence", "# Mine\n```\nx\n", "add_top"],
  ];
  for (const eol of ["\n", "\r\n", "mixed"] as const) {
    for (const [name, text, want] of cases) {
      it(`${name} (${eol === "\n" ? "LF" : eol === "\r\n" ? "CRLF" : "mixed LF and CRLF"})`, () => {
        const lines = text.split("\n");
        const converted = eol === "\n" ? text : eol === "\r\n" ? lines.join("\r\n") : lines.map((l, i) => (i % 2 === 0 ? l : `${l}\r`)).join("\n");
        const merged = mergeSection(AGENTS, enc(converted), body, nodeHash);
        if (want.startsWith("problem:")) {
          assert.ok("problem" in merged, `${name}: ${JSON.stringify(merged)}`);
          assert.equal(merged.problem, want.slice("problem:".length), name);
          return;
        }
        assert.ok("action" in merged, `${name}: ${JSON.stringify(merged)}`);
        assert.equal(merged.action, want === "add_top" ? "add_block" : want, name);
        assert.equal(merged.position, want === "add_top" ? "top" : undefined, name);
        // Every byte outside the section stays.
        const out = dec(merged.data);
        if (want === "add_block") assert.ok(out.startsWith(converted), name);
        if (want === "add_top") assert.ok(out.endsWith(converted), name);
        if (want === "update_block") {
          const old = /<!-- buildos:begin -->[ \t]*\r?\n<!-- buildos:section v1 sha256=[0-9a-f]{64} -->\r?\nold\r?\n<!-- buildos:end -->/.exec(converted)!;
          const now = /<!-- buildos:begin -->\r?\n<!-- buildos:section v1 sha256=[0-9a-f]{64} -->\r?\ncurrent text\r?\n<!-- buildos:end -->/.exec(out)!;
          assert.equal(out.slice(0, now.index), converted.slice(0, old.index), name);
          assert.equal(out.slice(now.index + now[0].length), converted.slice(old.index + old[0].length), name);
        }
      });
    }
  }

  it("a CRLF conversion of the whole file keeps the section valid: a rerun finds it unchanged", () => {
    const lf = `# Mine\n${buildosSection("current text\n")}`;
    const crlf = lf.replace(/\n/g, "\r\n");
    assert.equal((mergeSection(AGENTS, enc(crlf), body, nodeHash) as { action?: string }).action, "unchanged");
  });

  it("keeps .gitignore simple: a whole line at column 0, no regions, and the same integrity rule", () => {
    const owned = buildosSection("x\n", { gitignore: true });
    assert.equal((mergeSection(GITIGNORE, enc(`\`\`\`\n${owned}`), enc("y\n"), nodeHash) as { action: string }).action, "update_block");
    const hand = mergeSection(GITIGNORE, enc("```\n# buildos:begin\nx\n# buildos:end\n"), enc("y\n"), nodeHash);
    assert.ok("problem" in hand && hand.problem === "section_changed");
    // P6-R1-15 reconciled: leading whitespace means "not a marker", in .gitignore too.
    const pad = " ".repeat(300);
    assert.equal((mergeSection(GITIGNORE, enc(`node_modules/\n${pad}# buildos:begin\n`), enc("x\n"), nodeHash) as { action: string }).action, "add_block");
    const padded = enc(owned.replace("# buildos:begin", `# buildos:begin${" ".repeat(300)}\t`));
    const trailing = mergeSection(GITIGNORE, padded, enc("y\n"), nodeHash);
    assert.ok("action" in trailing && trailing.action === "update_block");
    // P6-R4-01: the same section, current: unchanged, every byte kept (the padding too).
    const current = mergeSection(GITIGNORE, padded, enc("x\n"), nodeHash);
    assert.ok("action" in current && current.action === "unchanged" && current.data === padded);
  });
});

/**
 * P6-R3-01 (orchestrator direction 5): a property test. For many generated
 * files in which no marker pair has a valid integrity line, `mergeSection`
 * never changes or removes a byte that was there: it adds bytes in one
 * place, or it stops.
 */
describe("P6-R3-01: without a valid integrity line, init only adds bytes or stops (generated files)", () => {
  const pieces = [
    "# Title\n", "text\n", "\n", "<!-- buildos:begin -->\n", "<!-- buildos:end -->\n", "<!-- buildos:begin -->   \t\n", "  <!-- buildos:begin -->\n",
    `<!-- buildos:section v1 sha256=${"a".repeat(64)} -->\n`, "<!-- buildos:section v1 sha256=zz -->\n", "```\n", "````md\n", "~~~\n", "  ```\n", "> ```\n", "- ```\n",
    "<pre>\n", "</pre>\n", "<details><pre>\n", "</pre></details>\n", "<script>\n", "'</pre>'\n", "</script>\n", "<!--\n", "-->\n", "a <!-- b\n", "c --> d\n",
    "`<pre>`\n", "<textarea>\n", "</textarea>\n", "<style>x</style>\n", "Team instruction.\n", "été\n",
    // W1 R7 P6 review round 4 (P6-R4-04): bare CRs, in text and around marker lines.
    "\r", "note\rmore\n", "<!-- buildos:end -->\r \t\n", "<!-- buildos:begin -->\r", "\r \t\r\n",
  ];
  /** A small, repeatable random sequence (mulberry32), so a failure can be run again. */
  function random(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** True when `out` is `before` with one run of bytes put in at one place. */
  function onlyAdds(before: Uint8Array, out: Uint8Array): boolean {
    if (out.length < before.length) return false;
    let head = 0;
    while (head < before.length && out[head] === before[head]) head++;
    let tail = 0;
    while (tail < before.length - head && out[out.length - 1 - tail] === before[before.length - 1 - tail]) tail++;
    return head + tail === before.length;
  }
  it("holds for 4,000 generated files, each with LF, CRLF, mixed, or CR-only line breaks and an optional BOM", () => {
    const next = random(20261124);
    const counts = { added: 0, stopped: 0 };
    for (let n = 0; n < 4000; n++) {
      const parts: string[] = [];
      const size = 1 + Math.floor(next() * 14);
      for (let i = 0; i < size; i++) parts.push(pieces[Math.floor(next() * pieces.length)]!);
      let text = parts.join("");
      const style = Math.floor(next() * 4);
      if (style === 1) text = text.replace(/\n/g, "\r\n");
      if (style === 3) text = text.replace(/\n/g, "\r");
      if (style === 2) text = text.split("\n").map((l, i) => (i % 2 === 0 ? l : `${l}\r`)).join("\n");
      if (next() < 0.5) text = text.replace(/\r?\n$/, "");
      if (next() < 0.2) text = `﻿${text}`;
      const before = enc(text);
      const merged = mergeSection(AGENTS, before, enc("package text\n"), nodeHash);
      if ("problem" in merged) {
        counts.stopped++;
        continue;
      }
      assert.notEqual(merged.action, "update_block", JSON.stringify(text));
      assert.ok(onlyAdds(before, merged.data), `bytes changed or removed for ${JSON.stringify(text)}`);
      counts.added++;
    }
    assert.ok(counts.added > 500 && counts.stopped > 500, JSON.stringify(counts));
  });
});

describe("P6-R1-09: a UTF-8 BOM stays when the section starts on the first line", () => {
  const BOM = "\uFEFF";
  for (const eol of ["\n", "\r\n"]) {
    const name = eol === "\n" ? "LF" : "CRLF";
    it(`keeps the BOM for a current and for a stale first-line section (${name})`, () => {
      const body = enc("current text\n");
      const current = `${BOM}${buildosSection("current text\n", { eol })}# After${eol}`;
      assert.equal((mergeSection(AGENTS, enc(current), body, nodeHash) as { action?: string }).action, "unchanged");
      const stale = `${BOM}${buildosSection("old\n", { eol })}# After${eol}`;
      const merged = mergeSection(AGENTS, enc(stale), body, nodeHash);
      assert.ok("data" in merged && merged.action === "update_block");
      assert.equal(dec(merged.data), current);
    });
  }

  it("keeps the BOM through the CLI", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), `${BOM}${buildosSection("old\n")}`);
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `${BOM}${section("AGENTS.md")}`);
  });
});

describe("P6-R1-10: unsupported encodings stop before any write", () => {
  const cases: [string, Uint8Array, RegExp][] = [
    ["UTF-16 LE", new Uint8Array([0xff, 0xfe, 0x23, 0x00, 0x0a, 0x00]), /AGENTS\.md is saved as UTF-16 text\. BuildOS changes only UTF-8 text, so it did not change this file\./],
    ["UTF-16 BE", new Uint8Array([0xfe, 0xff, 0x00, 0x23, 0x00, 0x0a]), /saved as UTF-16 text/],
    ["UTF-32 LE", new Uint8Array([0xff, 0xfe, 0x00, 0x00, 0x23, 0x00, 0x00, 0x00]), /saved as UTF-32 text/],
    ["a zero byte", new Uint8Array([0x23, 0x00, 0x0a]), /AGENTS\.md holds a zero byte/],
  ];
  for (const [what, bytes, message] of cases) {
    it(`stops with exit 10 and names the file (${what})`, async () => {
      const dir = folder();
      writeFileSync(join(dir, "AGENTS.md"), bytes);
      const human = await init(dir, ["--skip-make-docs"]);
      assert.equal(human.exit, 10);
      assertOutputMatches(human.stdout, message);
      assertOutputMatches(human.stdout, /To fix it: Save the file as UTF-8 text, or move it away\. Then run `buildos init` again\./);
      const json = await init(dir, ["--skip-make-docs", "--json"]);
      assertSame(json.json.result.problems[0].problem, "unsupported_encoding");
      assertSame(new Uint8Array(readFileSync(join(dir, "AGENTS.md"))), bytes);
      assert.deepEqual(readdirSync(dir), ["AGENTS.md"]);
    });
  }

  it("keeps bytes that are not UTF-8, outside the section, byte for byte", async () => {
    const dir = folder();
    const latin1 = new Uint8Array([0x23, 0x20, 0x43, 0x61, 0x66, 0xe9, 0x0a]);
    writeFileSync(join(dir, ".gitignore"), latin1);
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    const after = new Uint8Array(readFileSync(join(dir, ".gitignore")));
    assert.deepEqual(after.subarray(0, latin1.length), latin1);
  });
});

describe("P6-R1-16: a shared file keeps its full mode", () => {
  it("keeps the sticky or setgid bit when the BuildOS section is added", async (t) => {
    if (windows) return t.skip("Windows has no POSIX mode bits");
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    let mode = 0;
    for (const wanted of [0o1640, 0o2640]) {
      try {
        chmodSync(join(dir, "AGENTS.md"), wanted);
      } catch {
        continue;
      }
      if ((statSync(join(dir, "AGENTS.md")).mode & 0o7777) === wanted) {
        mode = wanted;
        break;
      }
    }
    if (mode === 0) return t.skip("this OS user cannot set a sticky or setgid bit on a file");
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    assert.equal(statSync(join(dir, "AGENTS.md")).mode & 0o7777, mode);
  });
});

describe("P6-R1-06: running init again in a set-up project", () => {
  it("the same command twice: the second run exits 0, changes nothing, and says so", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    const before = readFileSync(join(dir, "AGENTS.md"), "utf8");
    const again = await init(dir, ["--skip-make-docs"]);
    assert.equal(again.exit, 0, shape(again.stdout));
    assert.ok(again.stdout.endsWith("\nDone. BuildOS is already set up in this folder, and its sections are up to date. Nothing was changed.\nBuildOS was already set up here, so it kept its other files as they are.\nMake Docs: not run, as chosen.\n"), shape(again.stdout));
    const json = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(json.exit, 0);
    assertSame(json.json.result.setup, "rerun");
    assertSame(json.json.result.written, []);
    assertSame(json.json.result.shared_files.map((f: { result: string }) => f.result), ["unchanged", "unchanged", "unchanged"]);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), before);
  });

  it("a rerun refreshes a stale section and keeps every other BuildOS file", async () => {
    const dir = folder();
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    writeFileSync(join(dir, "AGENTS.md"), `# Mine\n${buildosSection("old\n")}`);
    writeFileSync(join(dir, "assets", "AGENTS.md"), "edited by the user\n");
    rmSync(join(dir, "CLAUDE.md"));
    const again = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(again.exit, 0);
    // P6-R3-05: every shared file is reported, also one a rerun does not change.
    assertSame(again.json.result.shared_files, [
      { path: "AGENTS.md", result: "block_updated" },
      { path: "CLAUDE.md", result: "skipped", reason: "missing" },
      { path: ".gitignore", result: "unchanged" },
    ]);
    assertOutputMatches(again.json.result.summary, /^BuildOS was already set up in this folder\. It refreshed its section in 1 shared file\.$/);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `# Mine\n${section("AGENTS.md")}`);
    assertSame(readFileSync(join(dir, "assets", "AGENTS.md"), "utf8"), "edited by the user\n");
    assert.equal(existsSync(join(dir, "CLAUDE.md")), false, "a rerun creates no shared file");
  });

  it("a rerun of an adopted project adds no section to its shared files", async () => {
    const dir = folder();
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(dir, "AGENTS.md"), "# Go-era router\n");
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    const again = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(again.exit, 0);
    assertSame(again.json.result.shared_files, [
      { path: "AGENTS.md", result: "skipped", reason: "no_section" },
      { path: "CLAUDE.md", result: "skipped", reason: "missing" },
      { path: ".gitignore", result: "skipped", reason: "missing" },
    ]);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Go-era router\n");
    const human = await init(dir, ["--skip-make-docs"]);
    assertOutputMatches(human.stdout, /\n {2}AGENTS\.md: no change; it has no BuildOS section, and a rerun does not add one\n {2}CLAUDE\.md: no change; it is not there, and a rerun does not create it\n/);
  });

  it("stops (exit 10) when .os/manifest.json is a folder or is not a valid manifest", async () => {
    for (const [name, make] of [
      ["a folder", (dir: string) => mkdirSync(join(dir, ".os", "manifest.json"))],
      ["not JSON", (dir: string) => writeFileSync(join(dir, ".os", "manifest.json"), "{")],
      ["no version", (dir: string) => writeFileSync(join(dir, ".os", "manifest.json"), '{"schema_version":1}')],
    ] as const) {
      const dir = folder();
      mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
      make(dir);
      const result = await init(dir, ["--skip-make-docs", "--json"]);
      assert.equal(result.exit, 10, tag(String(name)));
      assertSame(result.json.result.reason, "manifest_problem", tag(String(name)));
      assertOutputMatches(result.json.result.problems[0].message, /\.os\/manifest\.json is (a folder|not a valid BuildOS manifest), so BuildOS cannot tell how this folder was set up\./, tag(String(name)));
      assert.deepEqual(readdirSync(dir).sort(), [".os"], tag(String(name)));
    }
  });
});

describe("P6-R1-04: the setup BuildOS planned does not change behind its back", () => {
  for (const [name, action, found] of [
    ["Make Docs adds an .os/ folder", (target: string) => mkdirSync(join(target, ".os")), "adoption"],
    [
      "Make Docs adds .os/manifest.json",
      (target: string) => {
        mkdirSync(join(target, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
        writeFileSync(join(target, ".os", "manifest.json"), '{"schema_version":1,"buildos_version":"1.0.0","initialized_at":"2026-11-24T00:00:00Z"}\n');
      },
      "rerun",
    ],
  ] as const) {
    it(`stops with exit 10, names what Make Docs did, and never says "Nothing was changed" (${name})`, async () => {
      const dir = folder();
      const stub = makeDocs(action);
      const human = await init(dir, ["--make-docs"], { process: stub.port });
      assert.equal(human.exit, 10);
      assertOutputDoesNotMatch(human.stdout, /Nothing was changed/);
      assertOutputMatches(human.stdout, /\nStopped\. Make Docs was set up, but BuildOS changed nothing\. BuildOS planned to set up a new project, but after Make Docs ran, the folder looks like /);
      assertOutputMatches(human.stdout, /\nMake Docs: set up\.\n/);
      assertOutputMatches(human.stdout, /add --skip-make-docs when you run buildos init again/);
      assert.equal(existsSync(join(dir, "assets")), false);
      const dir2 = folder();
      const json = await init(dir2, ["--make-docs", "--json"], { process: makeDocs(action).port });
      assertSame(json.json.result.reason, "setup_changed");
      assertSame(json.json.result.found_setup, found);
      assert.equal(json.json.result.make_docs.status, "set_up");
    });
  }

  it("a clash after Make Docs ran carries the Make Docs result in both outputs", async () => {
    const dir = folder();
    const stub = makeDocs((target) => writeFileSync(join(target, "workspace"), "a file where a folder goes\n"));
    const human = await init(dir, ["--make-docs"], { process: stub.port });
    assert.equal(human.exit, 10);
    assertOutputMatches(human.stdout, /^Project folder: .*\n\nPlanned changes [^]*\n\nStopped\. Make Docs was set up, but BuildOS changed nothing\. 1 path that BuildOS must add is already in this folder\.\n/);
    assertOutputMatches(human.stdout, /\nMake Docs: set up\.\n$/);
  });
});

describe("P6-R1-03: permissions are checked before Make Docs runs, and the Make Docs result is never lost", () => {
  it("stops with exit 5 before Make Docs runs when a folder BuildOS writes in is read-only", async (t) => {
    if (!permissionsApply) return t.skip("POSIX permissions do not apply to this user");
    const dir = folder();
    mkdirSync(join(dir, "assets"));
    chmodSync(join(dir, "assets"), 0o555);
    const stub = makeDocs((target) => mkdirSync(join(target, "docs")));
    const human = await init(dir, ["--make-docs"], { process: stub.port });
    assert.equal(human.exit, 5);
    assert.equal(stub.runs, 0, "Make Docs must not run");
    assertSame(human.stdout, `Project folder: ${dir}\nStopped. Nothing was changed. BuildOS cannot write in 1 folder that it must add files to.\n\nBuildOS cannot write in these folders:\n  assets/ (permission denied)\n\nAllow your user to write in these folders, then run \`buildos init\` again.\n`);
    const json = await init(dir, ["--make-docs", "--json"], { process: stub.port });
    assert.equal(json.exit, 5);
    assertSame(json.json.result.reason, "folder_not_writable");
    assertSame(json.json.result.folders, [{ path: "assets/", error: "permission denied" }]);
    assert.equal(json.json.diagnostics[0].code, "init_folder_not_writable");
    assert.deepEqual(readdirSync(dir), ["assets"]);
    chmodSync(join(dir, "assets"), 0o755);
  });

  it("a write failure after Make Docs ran reports both: Make Docs set up, BuildOS undone, and what to run next", async () => {
    const dir = folder();
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        root: port.root,
        writeNewFile: (path, data, opts) => {
          if (path === ".os/manifest.json") throw new Error("injected failure");
          return port.writeNewFile(path, data, opts);
        },
      };
    };
    const human = await init(dir, ["--make-docs"], { openFs, process: makeDocs((target) => mkdirSync(join(target, "docs"))).port });
    assert.equal(human.exit, 1);
    assertOutputMatches(human.stdout, /\n\nFailed\. BuildOS could not finish its setup, so it undid its own changes\. Make Docs was set up before this, and it stays set up\.\nWhy: injected failure\.\n\nMake Docs: set up\.\n\nFix the problem shown in "Why", then run `buildos init` again\. Make Docs already ran, so add --skip-make-docs when you run buildos init again\.\n$/);
    assert.deepEqual(readdirSync(dir), ["docs"]);
    const dir2 = folder();
    const json = await init(dir2, ["--make-docs", "--json"], { openFs, process: makeDocs().port });
    assertSame(json.json.ok, false);
    assert.equal(json.json.result.status, "failed");
    assert.equal(json.json.result.make_docs.status, "set_up");
    assertSame(json.json.result.not_restored, []);
  });
});

describe("P6-R1-02 and P6-R1-08: the undo restores links and removes only what this run made", () => {
  // P6-R2-15: the failure comes after the wrapper was replaced (a later wrapper's create), and the
  // link text is compared with what readlink gave before the run (Windows gives backslashes).
  it("P6-R1-02: puts a replaced wrapper link back as a link after a later failure", async (t) => {
    const dir = folder();
    mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(dir, "old-wrapper"), "#!/bin/sh\n");
    const link = join(dir, ".os", "scripts", "buildos");
    if (!trySymlink(join("..", "..", "old-wrapper"), link)) return t.skip("this OS user cannot make a symbolic link");
    const pre = readlinkSync(link);
    let replaced = 0;
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        writeFileAtomic: (path, data, opts) => {
          const id = port.writeFileAtomic(path, data, opts);
          if (path === ".os/scripts/buildos" && opts?.expect?.kind === "symlink") replaced++;
          return id;
        },
        writeNewFile: (path, data, opts) => {
          if (path === ".os/scripts/buildos-design") throw new Error("injected failure");
          return port.writeNewFile(path, data, opts);
        },
      };
    };
    const result = await init(dir, ["--skip-make-docs", "--json"], { openFs });
    assert.equal(replaced, 1, "the wrapper link was replaced before the failure");
    assert.equal(result.exit, 1);
    assertSame(result.json.result.not_restored, []);
    assert.ok(lstatSync(link).isSymbolicLink());
    assert.equal(readlinkSync(link), pre);
    assert.deepEqual(readdirSync(join(dir, ".os", "scripts")), ["buildos"]);
  });

  it("P6-R1-08: leaves an entry that changed after BuildOS wrote it, and reports every path it could not put back (exit 10)", async () => {
    const dir = folder();
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        root: port.root,
        writeFileAtomic: (path, data, opts) => {
          if (path === ".gitignore" && opts?.expect?.kind === "file") {
            // Someone replaces a file this run created, then the write fails.
            unlinkSync(join(dir, ".os", "manifest.json"));
            writeFileSync(join(dir, ".os", "manifest.json"), "the user's own file\n");
            throw new Error("injected failure");
          }
          return port.writeFileAtomic(path, data, opts);
        },
      };
    };
    const human = await init(dir, ["--skip-make-docs"], { openFs });
    assert.equal(human.exit, 10);
    assertOutputMatches(human.stdout, /\nFailed\. BuildOS could not finish its setup, and it could not undo all of its own changes\.\nWhy: injected failure\.\n\nBuildOS could not put these paths back as they were:\n {2}\.os\/manifest\.json \(it changed after BuildOS wrote it, so BuildOS left it as it is\)\n {2}\.os\/ \(/);
    assertSame(readFileSync(join(dir, ".os", "manifest.json"), "utf8"), "the user's own file\n");
    assertSame(readFileSync(join(dir, ".gitignore"), "utf8"), "node_modules/\n");
    assert.deepEqual(readdirSync(dir).sort(), [".gitignore", ".os"]);
    assertSame(readdirSync(join(dir, ".os")), ["manifest.json"]);

    const dir2 = folder();
    writeFileSync(join(dir2, ".gitignore"), "node_modules/\n");
    const json = await init(dir2, ["--skip-make-docs", "--json"], {
      openFs: (root, cwd, options) => {
        const port = createNodeFsPort(root, cwd, options);
        return {
          ...port,
          root: port.root,
          writeFileAtomic: (path, data, opts) => {
            if (path === ".gitignore" && opts?.expect?.kind === "file") {
              unlinkSync(join(dir2, ".os", "manifest.json"));
              writeFileSync(join(dir2, ".os", "manifest.json"), "x\n");
              throw new Error("injected failure");
            }
            return port.writeFileAtomic(path, data, opts);
          },
        };
      },
    });
    assert.equal(json.exit, 10);
    assertSame(json.json.ok, false);
    assertSame(json.json.write_status, "partially_applied");
    assertSame(json.json.result.not_restored.map((n: { path: string }) => n.path), [".os/manifest.json", ".os/"]);
    assertSame(json.json.diagnostics.map((d: { code: string }) => d.code), ["internal_error", "init_undo_incomplete"]);
  });
});

describe("P6-R1-07: the destination is checked right before each replace, and kept entries are checked before success", () => {
  it("an editor save between the plan and the rename stops the run, and the user's save stays", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    writeRaceHooks.beforeOpen = (step, target) => {
      if (step === "rename" && target.endsWith(`${sep}AGENTS.md`)) writeFileSync(join(dir, "AGENTS.md"), "# Saved by an editor\n");
    };
    try {
      const result = await init(dir, ["--skip-make-docs", "--json"]);
      assert.equal(result.exit, 10);
      assert.equal(result.json.diagnostics[0].code, "entry_changed");
      assertSame(result.json.result.not_restored, []);
    } finally {
      delete writeRaceHooks.beforeOpen;
    }
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Saved by an editor\n");
    assert.deepEqual(readdirSync(dir), ["AGENTS.md"]);
  });

  it("a shared file the plan keeps that is gone before the end fails the run and undoes it", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), `# Mine\n\n${section("AGENTS.md")}`);
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        root: port.root,
        writeNewFile: (path, data, opts) => {
          const made = port.writeNewFile(path, data, opts);
          if (path === ".gitignore") rmSync(join(dir, "AGENTS.md"));
          return made;
        },
      };
    };
    const result = await init(dir, ["--skip-make-docs", "--json"], { openFs });
    assert.equal(result.exit, 10);
    assert.equal(result.json.diagnostics[0].code, "init_shared_file_changed");
    assert.deepEqual(readdirSync(dir), []);
  });
});

describe("P6-R1-05: names on a case-insensitive volume", () => {
  /** True when the folder's volume finds a name under another case. */
  function caseInsensitive(dir: string): boolean {
    writeFileSync(join(dir, "probe-a"), "");
    const insensitive = existsSync(join(dir, "PROBE-A"));
    rmSync(join(dir, "probe-a"));
    return insensitive;
  }

  it("keeps an existing agents.md spelled its own way, or keeps both names distinct on a case-sensitive volume", async () => {
    const dir = folder();
    writeFileSync(join(dir, "agents.md"), "# Mine\n");
    const insensitive = caseInsensitive(dir);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    const names = readdirSync(dir);
    if (insensitive) {
      assert.ok(names.includes("agents.md") && !names.includes("AGENTS.md"), tag(String(names.join(","))));
      assertSame(result.json.result.shared_files[0], { path: "agents.md", result: "block_added" });
      assertSame(readFileSync(join(dir, "agents.md"), "utf8"), `# Mine\n\n${section("AGENTS.md")}`);
    } else {
      assert.ok(names.includes("agents.md") && names.includes("AGENTS.md"), tag(String(names.join(","))));
      assertSame(readFileSync(join(dir, "agents.md"), "utf8"), "# Mine\n");
      assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), section("AGENTS.md"));
    }
  });

  it("replaces a differently cased wrapper in an adoption, keeping its spelling, or adds the wrapper on a case-sensitive volume", async () => {
    const dir = folder();
    mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(dir, ".os", "scripts", "BuildOS"), "old\n");
    const insensitive = caseInsensitive(dir);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    const names = readdirSync(join(dir, ".os", "scripts"));
    const wrapper = readFileSync(join(SYSTEM, ".os", "scripts", "buildos"), "utf8");
    if (insensitive) {
      assert.ok(names.includes("BuildOS") && !names.includes("buildos"), tag(String(names.join(","))));
      assertSame(readFileSync(join(dir, ".os", "scripts", "BuildOS"), "utf8"), wrapper);
      assert.ok(result.json.result.written.some((w: { path: string; action: string }) => w.path === ".os/scripts/BuildOS" && w.action === "replace"));
    } else {
      assertSame(readFileSync(join(dir, ".os", "scripts", "BuildOS"), "utf8"), "old\n");
      assertSame(readFileSync(join(dir, ".os", "scripts", "buildos"), "utf8"), wrapper);
    }
  });
});

describe("P6-R1-17: a program that cannot run does not hide one later on PATH", () => {
  it("skips a make-docs file without execute permission", (t) => {
    if (windows) return t.skip("Windows has no execute permission bit; PATHEXT decides");
    const base = join(scratch, `path-${++counter}`);
    const first = join(base, "first");
    const second = join(base, "second");
    mkdirSync(first, { recursive: true });
    mkdirSync(second);
    writeFileSync(join(first, "make-docs"), "#!/bin/sh\n");
    chmodSync(join(first, "make-docs"), 0o644);
    writeFileSync(join(second, "make-docs"), "#!/bin/sh\n");
    chmodSync(join(second, "make-docs"), 0o755);
    assert.equal(findOnPath("make-docs", { PATH: [first, second].join(delimiter) }), join(second, "make-docs"));
  });
});

describe("P6-R1-18: the shown commands are correct to copy and paste", () => {
  /** A `buildos` recorder on its own folder: it writes its arguments as JSON to `out`. */
  function recorder(out: string): string {
    const dir = join(scratch, `recorder-${++counter}`);
    mkdirSync(dir);
    const script = join(dir, "record.cjs");
    writeFileSync(script, `require("fs").writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)));\n`);
    if (windows) writeFileSync(join(dir, "buildos.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
    else {
      writeFileSync(join(dir, "buildos"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
      chmodSync(join(dir, "buildos"), 0o755);
    }
    return dir;
  }

  /** Runs `command` as a user would paste it: `sh -c` on macOS and Linux, Command Prompt on Windows. */
  function paste(command: string, path: string, cwd: string): number | null {
    const env = windows ? { PATH: [path, join(process.env["SystemRoot"] ?? "C:\\Windows", "System32")].join(delimiter), SystemRoot: process.env["SystemRoot"], PATHEXT: ".COM;.EXE;.BAT;.CMD" } : { PATH: `${path}${delimiter}/usr/bin${delimiter}/bin` };
    const result = windows
      ? spawnSync(join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "cmd.exe"), ["/d", "/s", "/c", `"${command}"`], { cwd, env, encoding: "utf8", windowsVerbatimArguments: true })
      : spawnSync("/bin/sh", ["-c", command], { cwd, env, encoding: "utf8" });
    return result.status;
  }

  // Shell-special characters that a folder name can hold on each system.
  const names = windows ? ["with space", "a&b (c) ^d !e", "100% sure", "%PATH%"] : ["with space", `it's "q" & $HOME \`x\` ;|<>(*)`, "100% sure"];
  for (const name of names) {
    it(`both choice commands run with exactly the shown arguments (${JSON.stringify(name)})`, async () => {
      const dir = join(scratch, `case-${++counter}`, name);
      mkdirSync(dir, { recursive: true });
      const result = await init(dir, []);
      assert.equal(result.exit, 10);
      for (const flag of ["--make-docs", "--skip-make-docs"]) {
        const line = result.stdout.split("\n").find((l) => l.startsWith("  ") && l.endsWith(flag));
        assert.ok(line !== undefined, shape(result.stdout));
        const out = join(scratch, `argv-${++counter}.json`);
        assertSame(paste(line.trim(), recorder(out), scratch), 0);
        assertSame(JSON.parse(readFileSync(out, "utf8")), ["init", "--root", dir, flag]);
      }
    });
  }

  it("quotes a Windows path that ends in a backslash so the quote stays closed", () => {
    assert.equal(commandLine(["C:\\Program Files\\"], "win32"), '"C:\\Program Files\\\\"');
    assert.equal(commandLine(["a%b%c"], "win32"), '"a"^%"b"^%"c"');
  });
});

describe("P6-R1-14: the installed-package golden runner passes arguments through npm's Windows .cmd shims", () => {
  it("each argument reaches the program unchanged through cmd.exe and a shim's %*", async (t) => {
    if (!windows) return t.skip("runs on Windows only; macOS and Linux start the .bin links directly");
    const { escapeCmdShimArg, escapeCmdCommand } = await import("./golden/harness.ts");
    const dir = join(scratch, `shim-${++counter}`, "bin dir (x)");
    mkdirSync(dir, { recursive: true });
    const out = join(dir, "argv.json");
    writeFileSync(join(dir, "rec.cjs"), `require("fs").writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)));\n`);
    // The same last line as npm's shim: the program, the script, then %*.
    writeFileSync(join(dir, "tool.cmd"), `@ECHO off\r\n"${process.execPath}" "%~dp0\\rec.cjs" %*\r\n`);
    const args = ["plain", "with space", "(parens)", "#hash", "a&b|c", "100%", "%PATH%", "caret^", "bang!", 'quote"inside', "trailing\\", ""];
    const line = [escapeCmdCommand(join(dir, "tool.cmd")), ...args.map((a) => escapeCmdShimArg(a))].join(" ");
    const result = spawnSync(join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "cmd.exe"), ["/d", "/s", "/c", `"${line}"`], { windowsVerbatimArguments: true, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), args);
  });
});
