// W1 R7 P7 skills review round 2 (P7S-R2-05): the guide's worked config and
// its worked entity records load together into a new project and pass
// `buildos validate`. Chapter 4 configured the environment `vendor-baseline`
// while chapter 7's capability used `baseline`, so loading both gave
// `unknown_id`.
//
// The maintained list below names each code block the test loads: the
// chapter, the heading the block sits under, and its position there. A block
// that moves, disappears, or changes language fails the test, so the list is
// kept in step with the guide.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { quoteArg } from "../src/core/init/make-docs.ts";
import { run } from "../src/cli/run.ts";
import { assertNoProblems, assertOutputMatches, captureIo, shape, tag } from "./helpers.ts";

const PACKAGE = resolve(import.meta.dirname, "..");
const GUIDE = join(PACKAGE, "..", "..", "guide", "content");
const MAIN = join(PACKAGE, "src", "cli", "main.ts");

interface Block {
  chapter: string;
  heading: string;
  index: number;
  language: "yaml" | "json";
  /** Where the block goes in the project. */
  target: string;
}

const BLOCKS: Block[] = [
  { chapter: "04-install-and-configure-your-instance.md", heading: "### A worked example", index: 0, language: "yaml", target: ".os/config/instance.yaml" },
  { chapter: "07-pull-knowledge-out-of-it.md", heading: "### What a row actually looks like", index: 0, language: "json", target: ".os/data/capabilities.jsonl" },
  { chapter: "07-pull-knowledge-out-of-it.md", heading: "### What a row actually looks like", index: 1, language: "json", target: ".os/data/requirements.jsonl" },
  { chapter: "07-pull-knowledge-out-of-it.md", heading: "### What a row actually looks like", index: 2, language: "json", target: ".os/data/personas.jsonl" },
  { chapter: "07-pull-knowledge-out-of-it.md", heading: "### What a row actually looks like", index: 3, language: "json", target: ".os/data/test-cases.jsonl" },
  { chapter: "07-pull-knowledge-out-of-it.md", heading: "### The extraction row", index: 0, language: "json", target: ".os/data/extractions.jsonl" },
];

/** The fenced code blocks of one language in the section under `heading` (up to the next heading of the same or a higher level). */
function blocksUnder(text: string, heading: string, language: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.indexOf(heading);
  assert.ok(start !== -1, `the guide has the heading ${tag(String(heading))}`);
  const level = heading.indexOf(" ");
  const out: string[] = [];
  let open: string[] | undefined;
  let fence = "";
  for (const line of lines.slice(start + 1)) {
    if (open === undefined && /^#{1,6} /.test(line) && line.indexOf(" ") <= level) break;
    if (open === undefined && line.startsWith("```")) {
      fence = line.slice(3).trim();
      open = [];
    } else if (open !== undefined && line.startsWith("```")) {
      if (fence === language) out.push(`${open.join("\n")}\n`);
      open = undefined;
    } else if (open !== undefined) open.push(line);
  }
  return out;
}

const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function cli(args: string[]) {
  const result = spawnSync(process.execPath, [MAIN, ...args], { encoding: "utf8", env: { ...process.env, PATH: "" } });
  return { exit: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("guide worked examples (P7S-R2-05)", () => {
  it("the chapter 4 config and the chapter 7 records load into a new project and pass buildos validate", () => {
    const root = mkdtempSync(join(tmpdir(), "buildos-guide-"));
    temps.push(root);
    const made = cli(["init", "--root", root, "--skip-make-docs"]);
    assert.equal(made.exit, 0, shape(made.stderr));
    // The worked records stand in for the seeded BuildOS rows, as the guide says to do before adding your own.
    for (const name of ["capabilities", "requirements", "personas", "test-cases", "extractions"]) writeFileSync(join(root, ".os", "data", `${name}.jsonl`), "");
    for (const block of BLOCKS) {
      const found = blocksUnder(readFileSync(join(GUIDE, block.chapter), "utf8"), block.heading, block.language);
      const body = found[block.index];
      assert.ok(body !== undefined, `${tag(String(block.chapter))} "${tag(String(block.heading))}" has ${tag(String(block.language))} block ${tag(String(block.index + 1))}`);
      const full = join(root, ...block.target.split("/"));
      if (block.language === "yaml") writeFileSync(full, body);
      else writeFileSync(full, `${readFileSync(full, "utf8")}${JSON.stringify(JSON.parse(body))}\n`);
    }
    // Chapter 4: the three shipped playbooks are updated to your IDs when you rename the shipped ones.
    const renamed: Record<string, string> = { "primary-system": "lending-system", baseline: "vendor-baseline", customized: "configured-sandbox", "adopter-team": "product-team", "platform-owner": "platform-vendor" };
    for (const playbook of ["build/package-build-artifact.md", "discovery/inspect-ui-discoverability.md", "testing/run-core-validation.md"]) {
      const full = join(root, "playbooks", ...playbook.split("/"));
      const text = readFileSync(full, "utf8");
      const end = text.indexOf("\n---", 4);
      const front = text.slice(0, end).replace(/^(systems|environments|owners): \[(.*)\]$/gm, (_line, field: string, list: string) => `${field}: [${list.split(",").map((id) => renamed[id.trim()] ?? id.trim()).join(", ")}]`);
      writeFileSync(full, front + text.slice(end));
    }
    // The converted twin the records anchor to, with the headings the anchors name.
    mkdirSync(join(root, "assets", "lending-overview"), { recursive: true });
    writeFileSync(join(root, "assets", "lending-overview", "lending-overview.md"), "# Lending overview\n\n## Holds\n\n## Fines\n\n## Roles\n\n## Loans and holds\n");
    const result = cli(["validate", "--root", root]);
    assert.equal(result.exit, 0, shape(`${result.stdout}\n${result.stderr}`));
    assertOutputMatches(result.stdout, /OK\. No problems found\./);
  });

  it("every scoped ID the chapter 7 records use is configured in chapter 4", () => {
    const config = blocksUnder(readFileSync(join(GUIDE, BLOCKS[0]!.chapter), "utf8"), BLOCKS[0]!.heading, "yaml")[0]!;
    const ids = new Set([...config.matchAll(/^\s*- id: ([a-z0-9-]+)$/gm)].map((m) => m[1]!));
    for (const block of BLOCKS.slice(1)) {
      const record = JSON.parse(blocksUnder(readFileSync(join(GUIDE, block.chapter), "utf8"), block.heading, "json")[block.index]!) as Record<string, unknown>;
      for (const field of ["systems", "environments", "owners"]) {
        for (const value of (record[field] as string[] | undefined) ?? []) assert.ok(ids.has(value), `${tag(String(block.target))}: ${tag(String(field))} ${tag(String(value))} is configured`);
      }
    }
  });
});

// W1 R7 P8 Stage 2 (t8): the guide shows real CLI output. The maintained
// list below names each output block of the guide that the test compares
// with the real output of the same command in a new project: every line of
// the block must be a line of the real output, in order (a block may be a
// shortened excerpt). A shown folder path is written `<project folder>`, and
// a shown `npx -y @brucewaynedecoy/buildos@<version>` command is what a
// source build prints as `buildos`.

interface OutputBlock {
  chapter: string;
  heading: string;
  /** Position among the `text` blocks under the heading. */
  index: number;
  /** False for an example of `buildos init` itself; else the project is set up first (Make Docs skipped). */
  setUp: boolean;
  /** Prepares the project, then returns the command arguments (the project folder is passed in). */
  run: (root: string) => string[];
  /**
   * The system whose output the block shows (P8-D-01): `posix` (macOS and
   * Linux) or `win32`. A block for one system is compared with the real CLI
   * on that system. A `win32` block is also compared, on macOS and Linux,
   * with the same CLI code run with the Windows platform setting in a folder
   * whose name holds a backslash, so it stays checked on every runner.
   * Omitted: the same on every system.
   */
  platform?: "posix" | "win32";
}

const CH4 = "04-install-and-configure-your-instance.md";

function replaceConfig(root: string): void {
  const config = blocksUnder(readFileSync(join(GUIDE, CH4), "utf8"), "### A worked example", "yaml")[0]!;
  writeFileSync(join(root, ".os", "config", "instance.yaml"), config);
}

const OUTPUT_BLOCKS: OutputBlock[] = [
  { chapter: CH4, heading: "### The one question: Make Docs", index: 0, setUp: false, run: (root) => ["init", "--root", root], platform: "posix" },
  { chapter: CH4, heading: "### The one question: Make Docs", index: 1, setUp: false, run: (root) => ["init", "--root", root], platform: "win32" },
  { chapter: CH4, heading: "## Validate it", index: 0, setUp: true, run: (root) => ["validate", "--root", root] },
  { chapter: CH4, heading: "## Validate it", index: 1, setUp: true, run: (root) => (replaceConfig(root), ["validate", "--root", root]) },
  { chapter: CH4, heading: "## Validate it", index: 2, setUp: true, run: (root) => (replaceConfig(root), ["validate", "--root", root]) },
  {
    chapter: CH4,
    heading: "## Words the system rejects",
    index: 0,
    setUp: true,
    run: (root) => {
      const file = join(root, "playbooks", "testing", "run-core-validation.md");
      writeFileSync(file, readFileSync(file, "utf8").replace(/^environments: /m, "env: "));
      return ["validate", "--root", root];
    },
  },
];

/** True when every line of `block` is a line of `actual`, in order. */
function linesInOrder(block: string, actual: string): boolean {
  const have = actual.replace(/\r\n/g, "\n").split("\n");
  let at = 0;
  for (const line of block.replace(/\n$/, "").split("\n")) {
    const found = have.indexOf(line, at);
    if (found === -1) return false;
    at = found + 1;
  }
  return true;
}

/** The init output of the in-process CLI with a platform setting (the Windows form on macOS and Linux). */
async function initWithPlatform(root: string, platform: string): Promise<string> {
  const io = captureIo(root);
  await run(["init", "--root", root], io, { domains: [createInitDomain({ platform })] });
  return `${io.stdout()}${io.stderr()}`;
}

const windows = process.platform === "win32";

describe("guide output examples (W1 R7 P8 t8; P8-D-01: each system against its own output)", () => {
  for (const block of OUTPUT_BLOCKS) {
    it(`${block.chapter} "${block.heading}" text block ${block.index + 1}${block.platform === undefined ? "" : ` (${block.platform})`} is real output`, async (t) => {
      if (block.platform === "posix" && windows) return t.skip("the macOS and Linux runners check this block; Windows checks the win32 block");
      const root = mkdtempSync(join(tmpdir(), "buildos-guide-out-"));
      temps.push(root);
      // On macOS and Linux, the win32 block runs in a folder whose name holds a backslash, as every Windows path does.
      const simulated = block.platform === "win32" && !windows;
      const project = join(root, simulated ? "pro\\ject" : "project");
      mkdirSync(project);
      const shown = blocksUnder(readFileSync(join(GUIDE, block.chapter), "utf8"), block.heading, "text")[block.index];
      assert.ok(shown !== undefined, `${tag(String(block.chapter))} "${tag(String(block.heading))}" has text block ${tag(String(block.index + 1))}`);
      if (block.setUp) assert.equal(cli(["init", "--root", project, "--skip-make-docs"]).exit, 0);
      let output: string;
      if (simulated) output = await initWithPlatform(project, "win32");
      else {
        const result = cli(block.run(project));
        output = `${result.stdout}${result.stderr}`;
      }
      // A path with a space or another special character is quoted in the shown commands (the guide says so):
      // the quoted form stands for the quoted placeholder, as the guide writes it for each system.
      const shellPlatform = simulated ? "win32" : process.platform;
      const quoted = quoteArg(project, shellPlatform);
      const display = shellPlatform === "win32" ? '"<project folder>"' : "<project folder>";
      if (quoted !== project) assert.ok(block.platform !== "posix" || readFileSync(join(GUIDE, block.chapter), "utf8").includes("the commands show it in single quotes"), "the guide says that a path with a space is quoted");
      const actual = (quoted === project ? output : output.split(quoted).join(display)).split(project).join("<project folder>");
      const expected = shown.replace(/npx -y @brucewaynedecoy\/buildos@[0-9][^ ]* /g, "buildos ");
      assert.ok(linesInOrder(expected, actual), `the guide block matches the real output (${shape(actual)})`);
    });
  }
});

// A67 (W1 R7 P8): the guide and the repository README hold no instruction of
// the Go era, and they announce that the legacy names end in 0.3.0.
describe("A67: no Go-era install instruction, and the 0.3.0 notice", () => {
  const REPO = resolve(PACKAGE, "..", "..");
  const files = [
    ...readdirSync(GUIDE).filter((name) => name.endsWith(".md")).map((name) => join(GUIDE, name)),
    join(REPO, "README.md"),
  ];
  const BANNED: [string, RegExp][] = [
    ["the Python config validator", /validate_config\.py/],
    ["Homebrew", /homebrew|\bbrew (install|tap|upgrade)\b/i],
    ["an archive download", /\.tar\.gz\b|archive download|download (the|an?) (release )?archive/i],
    ["go build", /\bgo (build|install|run)\b/],
    ["the Go-era toolkit install", /just install-toolkits|BUILDOS_(INTAKE_|DISCOVERY_|DESIGN_)?BIN\b|toolkits\/buildos-/],
  ];

  it("finds none of the banned instructions in guide/content/ or README.md", () => {
    const problems: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        for (const [what, pattern] of BANNED) if (pattern.test(line)) problems.push(`${tag(String(file.slice(REPO.length + 1)))} line ${i + 1}: ${what}`);
      });
    }
    assertNoProblems(problems, "Go-era instructions");
  });

  it("finds the 0.3.0 legacy-name notice in chapter 4 and README.md", () => {
    for (const file of [join(GUIDE, CH4), join(REPO, "README.md")]) {
      const text = readFileSync(file, "utf8");
      assert.ok(/buildos-intake[\s\S]{0,400}0\.3\.0|0\.3\.0[\s\S]{0,400}buildos-intake/.test(text), `${tag(String(file.slice(REPO.length + 1)))} announces that the legacy names stop working in 0.3.0`);
    }
  });

  it("the check finds a planted instruction", () => {
    const planted = ["brew install buildos", "go build ./cmd/buildos", "python3 .os/scripts/validate_config.py", "download the release archive"];
    for (const line of planted) assert.ok(BANNED.some(([, pattern]) => pattern.test(line)), `a planted line is found (${tag(String(line))})`);
  });
});
