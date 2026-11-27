// W1 R7 P7 t14 and t15: the `buildos validate` command, its output and exit
// codes, and hostile input: oversized files, deep nesting, links out of the
// project root, bytes that are not UTF-8, CRLF line endings, and a byte
// order mark. Parity with the legacy validator is in validate-parity.test.ts.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it, type TestContext } from "node:test";
import { run } from "../src/cli/run.ts";
import { VALIDATE_HELP } from "../src/cli/commands/validate.ts";
import { checkConfigData, checkEntityLines, checkReferences, EMPTY_INDEX, Findings } from "../src/core/validate/checks.ts";
import { isMarkdownName, isPlaybookTemplateName, jsonlLines, VALIDATE_LIMITS } from "../src/core/validate/validate.ts";
import { parseYamlSubset, YAML_MAX_DEPTH, YamlSubsetError } from "../src/core/validate/yaml-subset.ts";
import { materialize } from "./golden/validate/cases.ts";
import { captureIo } from "./helpers.ts";

const scratch = mkdtempSync(join(tmpdir(), "buildos-validate-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let counter = 0;

/** A fresh copy of the valid fixture project, or of one case. */
function project(id = "base"): string {
  const root = join(scratch, `p${++counter}`);
  materialize(id, root);
  return root;
}

interface Finding {
  code: string;
  path: string;
  field: string;
  message: string;
}

async function validate(args: string[], cwd = scratch): Promise<{ exit: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const exit = await run(["validate", ...args], io);
  return { exit, stdout: io.stdout(), stderr: io.stderr() };
}

async function findings(root: string): Promise<{ exit: number; findings: Finding[]; truncated: boolean }> {
  const out = await validate(["--root", root, "--json"]);
  const envelope = JSON.parse(out.stdout) as { result: { findings: Finding[]; truncated: boolean } };
  return { exit: out.exit, findings: envelope.result.findings, truncated: envelope.result.truncated };
}

const codes = (list: Finding[]): string[] => list.map((f) => `${f.code} ${f.path} ${f.field}`);

/** Makes a symlink, or skips the test where the OS does not allow it (Windows without the privilege). */
function link(t: TestContext, target: string, path: string, type: "file" | "dir"): boolean {
  try {
    symlinkSync(target, path, type);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      t.skip("this OS does not allow a symlink here");
      return false;
    }
    throw error;
  }
}

function treeDigest(root: string): string {
  const hash = createHash("sha256");
  const walk = (dir: string, prefix: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const stats = statSync(full);
      hash.update(`${prefix}${name}:${stats.mtimeMs}\n`);
      if (stats.isDirectory()) walk(full, `${prefix}${name}/`);
      else hash.update(readFileSync(full));
    }
  };
  walk(root, "");
  return hash.digest("hex");
}

describe("buildos validate: command", () => {
  it("prints help with the checks and the exit codes", async () => {
    const out = await validate(["--help"]);
    assert.equal(out.exit, 0);
    assert.equal(out.stdout, VALIDATE_HELP);
    assert.match(out.stdout, /buildos validate \[--root <folder>\] \[--json\]/);
    assert.match(out.stdout, /0 {2}no problems found/);
    assert.match(out.stdout, /4 {2}problems found/);
  });

  it("is listed in the root help", async () => {
    const io = captureIo(scratch);
    assert.equal(await run(["help"], io), 0);
    assert.match(io.stdout(), /\n {2}validate {3}Check the project config, scoped frontmatter, and entity records\n/);
  });

  it("a clean project: exit 0, the folder, what was checked, and OK", async () => {
    const root = project();
    const out = await validate(["--root", root]);
    assert.equal(out.exit, 0);
    assert.equal(out.stderr, "");
    assert.equal(
      out.stdout,
      `Project folder: ${root}\nChecked: the config contract, the config file, 2 files with scoped frontmatter, and 8 entity data files.\n\nOK. No problems found.\n`,
    );
  });

  it("with no --root, checks the current folder and never a parent", async () => {
    const root = project();
    assert.equal((await validate([], root)).exit, 0);
    const child = join(root, "workspace-child");
    mkdirSync(child);
    const out = await validate(["--json"], child);
    assert.equal(out.exit, 3);
    const envelope = JSON.parse(out.stdout) as { ok: boolean; diagnostics: { code: string }[] };
    assert.equal(envelope.ok, false);
    assert.equal(envelope.diagnostics[0]?.code, "root_not_buildos");
  });

  it("a project with problems: exit 4, each problem under its file, and the next step", async () => {
    const root = project("collection-slug");
    const out = await validate(["--root", root]);
    assert.equal(out.exit, 4);
    assert.equal(out.stderr, "");
    assert.match(out.stdout, /^Project folder: .+\nChecked: .+\n\nFound 3 problems\.\n\n\.os\/config\/instance\.yaml\n {2}systems\[1\]\.id: "Second_System" must be a stable slug: .+ \[not_slug\]\n/);
    assert.match(out.stdout, /\nFix each problem, then run the same validate command again\.\n$/);
  });

  it("--json: the shared envelope with every finding, ok false, and one diagnostic", async () => {
    const root = project("environment-systems-unknown");
    const out = await validate(["--root", root, "--json"]);
    assert.equal(out.exit, 4);
    const envelope = JSON.parse(out.stdout) as Record<string, unknown> & { result: { findings: Finding[] }; diagnostics: { code: string }[] };
    assert.deepEqual(Object.keys(envelope), ["ok", "command", "version", "source_revision", "root", "mode", "write_status", "result", "diagnostics"]);
    assert.equal(envelope["ok"], false);
    assert.equal(envelope["command"], "validate");
    assert.equal(envelope["root"], root);
    assert.equal(envelope["write_status"], "not_requested");
    assert.deepEqual(envelope.result.findings[0], {
      code: "unknown_id",
      path: ".os/config/instance.yaml",
      field: "environments[1].systems[0]",
      message: '"missing-system" is not a configured ID in .os/config/instance.yaml.',
      detail: "missing-system",
    });
    assert.deepEqual(envelope.diagnostics.map((d) => d.code), ["validation_failed"]);
  });

  it("usage errors exit 2", async () => {
    assert.equal((await validate(["extra"])).exit, 2);
    assert.equal((await validate(["--bogus"])).exit, 2);
    assert.equal((await validate(["--root"])).exit, 2);
  });

  it("a folder with no .os/ exits 3 with a plain message", async () => {
    const empty = join(scratch, "not-a-project");
    mkdirSync(empty);
    const out = await validate(["--root", empty]);
    assert.equal(out.exit, 3);
    assert.match(out.stderr, /has no \.os\/ folder, so it is not a BuildOS project/);
  });

  it("changes no file", async () => {
    const root = project("entity-bad-status");
    const before = treeDigest(root);
    assert.equal((await validate(["--root", root])).exit, 4);
    assert.equal(treeDigest(root), before);
  });
});

describe("buildos validate: hostile input", () => {
  it("an oversized config is not read: file_too_large", async () => {
    const root = project();
    writeFileSync(join(root, ".os", "config", "instance.yaml"), `# ${"x".repeat(VALIDATE_LIMITS.configMaxBytes)}\n`);
    const result = await findings(root);
    assert.equal(result.exit, 4);
    assert.ok(codes(result.findings).includes("file_too_large .os/config/instance.yaml config"));
  });

  it("an oversized data file is not read: file_too_large", async () => {
    const root = project();
    const path = join(root, ".os", "data", "results.jsonl");
    truncateSync(path, VALIDATE_LIMITS.entityFileMaxBytes + 1);
    const result = await findings(root);
    assert.deepEqual(codes(result.findings), ["file_too_large .os/data/results.jsonl file"]);
  });

  it("deep YAML nesting is a parse finding, not a crash", async () => {
    const root = project();
    const levels = YAML_MAX_DEPTH + 40;
    const lines = Array.from({ length: levels }, (_, i) => `${" ".repeat(i)}k${i}:`);
    writeFileSync(join(root, ".os", "config", "instance.yaml"), `${lines.join("\n")}\n${" ".repeat(levels)}leaf: 1\n`);
    const result = await findings(root);
    const parse = result.findings.find((f) => f.code === "config_parse");
    assert.ok(parse !== undefined);
    assert.match(parse.message, /nesting is deeper than 64 levels/);
  });

  it("deep YAML nesting in frontmatter is a parse finding", async () => {
    const root = project();
    const lines = Array.from({ length: 200 }, (_, i) => `${" ".repeat(i)}k${i}:`);
    writeFileSync(join(root, "playbooks", "sample", "check-sample.md"), `---\nsystems:\n${lines.map((l) => ` ${l}`).join("\n")}\n---\n`);
    const result = await findings(root);
    assert.ok(result.findings.some((f) => f.code === "frontmatter_parse" && /nesting is deeper/.test(f.message)));
  });

  it("deep JSON nesting is invalid JSON, not a crash, also far past the limit", async () => {
    const root = project();
    const deep = `${"[".repeat(200_000)}${"]".repeat(200_000)}\n`;
    writeFileSync(join(root, ".os", "data", "results.jsonl"), `${"[".repeat(600)}${"]".repeat(600)}\n${deep}`);
    const result = await findings(root);
    assert.deepEqual(codes(result.findings), ["invalid_json .os/data/results.jsonl line 1", "invalid_json .os/data/results.jsonl line 2"]);
  });

  it("bytes that are not UTF-8 give not_utf8 for each file, with the file named", async () => {
    const root = project("non-utf8-jsonl");
    const result = await findings(root);
    assert.deepEqual(codes(result.findings), ["not_utf8 .os/data/requirements.jsonl file"]);
    const human = await validate(["--root", root]);
    assert.match(human.stdout, /\.os\/data\/requirements\.jsonl\n {2}file: This file is not UTF-8 text\. Save it as UTF-8\. \[not_utf8\]/);
  });

  it("CRLF line endings check the same as LF", async () => {
    assert.deepEqual((await findings(project("crlf"))).findings, []);
    assert.deepEqual(codes((await findings(project("crlf-findings"))).findings), [
      "version_not_integer .os/config/instance.yaml version",
      "legacy_scoped_field playbooks/sample/check-sample.md env",
      "bad_status .os/data/requirements.jsonl line 2.status",
    ]);
  });

  it("one byte order mark at the start is ignored", async () => {
    assert.deepEqual((await findings(project("bom-config"))).findings, []);
    assert.deepEqual((await findings(project("bom-jsonl"))).findings, []);
    assert.deepEqual(codes((await findings(project("bom-frontmatter"))).findings), ["legacy_scoped_field playbooks/sample/check-sample.md env"]);
  });

  it("a second byte order mark is text", async () => {
    const root = project();
    const path = join(root, ".os", "config", "instance.yaml");
    writeFileSync(path, `﻿﻿${readFileSync(path, "utf8")}`);
    const result = await findings(root);
    assert.ok(codes(result.findings).includes("version_not_integer .os/config/instance.yaml version"));
  });

  it("a config that is a link out of the project is not followed", async (t) => {
    const root = project();
    const outside = join(scratch, `outside-${++counter}.yaml`);
    writeFileSync(outside, readFileSync(join(root, ".os", "config", "instance.yaml")));
    rmSync(join(root, ".os", "config", "instance.yaml"));
    if (!link(t, outside, join(root, ".os", "config", "instance.yaml"), "file")) return;
    const result = await findings(root);
    assert.ok(codes(result.findings).includes("not_regular_file .os/config/instance.yaml config"));
  });

  it("a data file that is a link inside the project is not followed either", async (t) => {
    const root = project();
    rmSync(join(root, ".os", "data", "runs.jsonl"));
    if (!link(t, "results.jsonl", join(root, ".os", "data", "runs.jsonl"), "file")) return;
    assert.deepEqual(codes((await findings(root)).findings), ["not_regular_file .os/data/runs.jsonl file"]);
  });

  it("a data folder that is a link out of the project is never read", async (t) => {
    const root = project();
    const outside = join(scratch, `outside-data-${++counter}`);
    mkdirSync(outside);
    for (const name of readdirSync(join(root, ".os", "data"))) writeFileSync(join(outside, name), readFileSync(join(root, ".os", "data", name)));
    rmSync(join(root, ".os", "data"), { recursive: true });
    if (!link(t, outside, join(root, ".os", "data"), "dir")) return;
    const result = await findings(root);
    assert.equal(result.findings.length, 8);
    assert.ok(result.findings.every((f) => f.code === "outside_root" && f.path.startsWith(".os/data/")));
  });

  it("a link at a checked .md name is a finding; a folder link at any other name is skipped without a word (P7-R1-08)", async (t) => {
    const root = project();
    const outside = join(scratch, `outside-playbooks-${++counter}`);
    mkdirSync(outside);
    writeFileSync(join(outside, "secret.md"), "---\nenv: both\n---\n");
    if (!link(t, join(outside, "secret.md"), join(root, "playbooks", "linked.md"), "file")) return;
    if (!link(t, outside, join(root, "playbooks", "linked-folder"), "dir")) return;
    const result = await findings(root);
    assert.deepEqual(codes(result.findings), ["not_regular_file playbooks/linked.md frontmatter"]);
  });

  it("a link to a non-Markdown file out of the project is skipped: exit 0 (P7-R1-08)", async (t) => {
    const root = project();
    const outside = join(scratch, `outside-pdf-${++counter}`);
    mkdirSync(outside);
    writeFileSync(join(outside, "references.pdf"), "%PDF-1.4\n");
    if (!link(t, join(outside, "references.pdf"), join(root, "playbooks", "references.pdf"), "file")) return;
    if (!link(t, join(outside, "missing.txt"), join(root, "playbooks", "dangling.txt"), "file")) return;
    const result = await findings(root);
    assert.equal(result.exit, 0);
    assert.deepEqual(result.findings, []);
  });

  it("a link at a checked name whose target cannot even be looked at is still only the link finding: nothing is followed (P7-R1-08)", { skip: process.platform === "win32" ? "POSIX permissions" : false }, async (t) => {
    const root = project();
    const locked = join(scratch, `locked-${++counter}`);
    mkdirSync(locked);
    writeFileSync(join(locked, "notes.txt"), "x");
    if (!link(t, join(locked, "notes.txt"), join(root, "playbooks", "notes.txt"), "file")) return;
    if (!link(t, join(locked, "plan.md"), join(root, "playbooks", "plan.md"), "file")) return;
    chmodSync(locked, 0o000);
    try {
      const result = await findings(root);
      assert.deepEqual(codes(result.findings), ["not_regular_file playbooks/plan.md frontmatter"]);
    } finally {
      chmodSync(locked, 0o755);
    }
  });

  it("a pipe at a checked .md name is a finding, not a silent skip (P7-R1-08)", { skip: process.platform === "win32" ? "mkfifo is POSIX" : false }, async () => {
    const root = project();
    assert.equal(spawnSync("mkfifo", [join(root, "playbooks", "sample", "pipe.md")]).status, 0);
    assert.equal(spawnSync("mkfifo", [join(root, ".os", "templates", "pipe-playbook.md")]).status, 0);
    assert.equal(spawnSync("mkfifo", [join(root, "playbooks", "sample", "pipe.txt")]).status, 0);
    const result = await findings(root);
    assert.deepEqual(codes(result.findings).sort(), ["not_regular_file .os/templates/pipe-playbook.md frontmatter", "not_regular_file playbooks/sample/pipe.md frontmatter"]);
    assert.match(result.findings[0]!.message, /special file/);
  });

  it("playbooks/ itself as a link is reported", async (t) => {
    const root = project();
    const outside = join(scratch, `outside-pb-${++counter}`);
    mkdirSync(outside);
    rmSync(join(root, "playbooks"), { recursive: true });
    if (!link(t, outside, join(root, "playbooks"), "dir")) return;
    assert.deepEqual(codes((await findings(root)).findings), ["folder_link playbooks frontmatter"]);
  });

  it("folders nested past the limit under playbooks/ are not entered", async () => {
    const root = project();
    const parts = Array.from({ length: VALIDATE_LIMITS.folderMaxDepth + 2 }, () => "d");
    mkdirSync(join(root, "playbooks", ...parts), { recursive: true });
    writeFileSync(join(root, "playbooks", ...parts, "deep.md"), "---\nenv: both\n---\n");
    const result = await findings(root);
    assert.deepEqual(codes(result.findings), [`too_deep playbooks/${parts.slice(0, VALIDATE_LIMITS.folderMaxDepth + 1).join("/")} frontmatter`]);
  });

  it("stops after the findings limit and says so", async () => {
    const root = project();
    writeFileSync(join(root, ".os", "data", "results.jsonl"), "\n".repeat(VALIDATE_LIMITS.maxFindings + 50));
    const result = await findings(root);
    assert.equal(result.findings.length, VALIDATE_LIMITS.maxFindings);
    assert.equal(result.truncated, true);
    const human = await validate(["--root", root]);
    assert.match(human.stdout, /Found at least 10000 problems\. BuildOS stopped after 10000; fix these first/);
  });
});

/** W1 R7 P7 review round 1: one test (or table) per finding that the parity fixtures do not cover alone. */
describe("buildos validate: review round 1 fixes", () => {
  it("P7-R1-07: one row with 10,001 bad references stops at the budget, and no check builds more findings than the limit", async () => {
    const root = project();
    const refs = Array.from({ length: VALIDATE_LIMITS.maxFindings + 1 }, (_, i) => `missing-${i}`);
    const row = { id: "REQ-001", type: "requirement", status: "draft", source_anchor: "assets/sample/sample.md#need-1", systems: refs, environments: [], owners: [] };
    writeFileSync(join(root, ".os", "data", "requirements.jsonl"), `${JSON.stringify(row)}\n`);
    const result = await findings(root);
    assert.equal(result.findings.length, VALIDATE_LIMITS.maxFindings);
    assert.equal(result.truncated, true);

    let adds = 0;
    class Counting extends Findings {
      override add(...args: Parameters<Findings["add"]>): void {
        adds++;
        super.add(...args);
      }
    }
    const out = new Counting(100);
    checkReferences(out, "x", Array.from({ length: 50_000 }, (_, i) => `id-${i}`), new Set(), "systems");
    assert.equal(adds, 100, "the loop stops at the budget");
    assert.equal(out.list.length, 100);
    assert.equal(out.truncated, true);
  });

  it("P7-R1-07: a findings count exactly at the limit with nothing left is not truncated", () => {
    const out = new Findings(2);
    out.add("a", "p", "f", "m");
    out.add("b", "p", "f", "m");
    assert.equal(out.truncated, false);
    out.add("c", "p", "f", "m");
    assert.equal(out.truncated, true);
    assert.equal(out.list.length, 2);
  });

  it("P7-R1-07: JSONL lines are made one at a time from the bounded text", () => {
    const lines = jsonlLines("a\r\nb\nc");
    assert.equal(typeof (lines as Iterator<string>).next, "function", "a lazy iterator, not an array");
    assert.ok(!Array.isArray(lines));
    assert.deepEqual([...jsonlLines("a\r\nb\nc")], ["a", "b", "c"]);
    assert.deepEqual([...jsonlLines("a\n\nb\n")], ["a", "", "b"]);
    assert.deepEqual([...jsonlLines("")], []);
    assert.deepEqual([...jsonlLines("\n")], [""]);
    assert.deepEqual([...jsonlLines("a\rb\n")], ["a\rb"]);
  });

  it("P7-R1-06: inline lists share the 64-level budget with blocks", () => {
    const flow = (levels: number): string => `${"[".repeat(levels)}x${"]".repeat(levels)}`;
    // A mapping at level 1 holds the list: 63 inline levels fit, 64 do not.
    assert.doesNotThrow(() => parseYamlSubset(`k: ${flow(YAML_MAX_DEPTH - 1)}\n`, "t"));
    assert.throws(() => parseYamlSubset(`k: ${flow(YAML_MAX_DEPTH)}\n`, "t"), /t:1: nesting is deeper than 64 levels/);
    assert.throws(() => parseYamlSubset(`k: ${flow(65)}\n`, "t"), YamlSubsetError);
    // 60 block levels (59 keys, then the mapping that holds leaf) and 5 inline levels: 65 together.
    const blocks = Array.from({ length: 59 }, (_, i) => `${" ".repeat(i)}k${i}:`).join("\n");
    assert.throws(() => parseYamlSubset(`${blocks}\n${" ".repeat(59)}leaf: ${flow(5)}\n`, "t"), /nesting is deeper than 64 levels/);
    assert.doesNotThrow(() => parseYamlSubset(`${blocks}\n${" ".repeat(59)}leaf: ${flow(4)}\n`, "t"));
    // A sequence item that holds an inline list counts its levels too.
    assert.throws(() => parseYamlSubset(`k:\n  - ${flow(YAML_MAX_DEPTH)}\n`, "t"), /nesting is deeper/);
  });

  it("P7-R1-06: a 100,000-level inline list in the config is a finding, not a crash", async () => {
    const root = project();
    const deep = `${"[".repeat(100_000)}${"]".repeat(100_000)}`;
    writeFileSync(join(root, ".os", "config", "instance.yaml"), `version: 1\nsystems: ${deep}\n`);
    const result = await findings(root);
    const parse = result.findings.find((f) => f.code === "config_parse");
    assert.ok(parse !== undefined, JSON.stringify(result.findings.slice(0, 3)));
    assert.match(parse.message, /nesting is deeper than 64 levels/);
  });

  it("P7-R1-12: an integer past 2^53 keeps its exact value; version passes", () => {
    const data = parseYamlSubset("version: 9007199254740993\nsmall: -12\n", "t") as Map<string, unknown>;
    assert.equal(data.get("version"), 9007199254740993n);
    assert.equal(data.get("small"), -12);
    const big = `1${"0".repeat(309)}`;
    assert.equal((parseYamlSubset(`version: ${big}\n`, "t") as Map<string, unknown>).get("version"), BigInt(big));
  });

  it("P7-R1-03: extracted_at accepts exactly the RFC 3339 UTC profile", () => {
    const table: [string, string | undefined][] = [
      ["2026-01-31T09:30:00Z", undefined],
      ["2026-01-31T09:30:00.5Z", undefined],
      ["2026-01-31T09:30:00.123456789012Z", undefined],
      ["2024-02-29T00:00:00Z", undefined],
      ["0001-01-01T00:00:00Z", undefined],
      ["9999-12-31T23:59:59Z", undefined],
      ["20261124T102030Z", "datetime_format"],
      ["2026-11-24T10:20:30,5Z", "datetime_format"],
      ["2026-11-24t10:20:30Z", "datetime_format"],
      ["2026-11-24T10:20:30z", "datetime_format"],
      ["2026-11-24T10:20Z", "datetime_format"],
      ["2026-11-24T10:20:30", "datetime_format"],
      ["2026-11-24T10:20:30+00:00", "datetime_format"],
      ["2026-11-24 10:20:30Z", "datetime_format"],
      ["2026-11-24T10:20:30.Z", "datetime_format"],
      ["2026-11-24T10:20:30Z\n", "datetime_format"],
      ["٢٠٢٦-11-24T10:20:30Z", "datetime_format"],
      ["2026-11-24T24:00:00Z", "datetime_invalid"],
      ["2026-11-24T23:59:60Z", "datetime_invalid"],
      ["2026-11-24T23:60:00Z", "datetime_invalid"],
      ["2026-02-29T00:00:00Z", "datetime_invalid"],
      ["2026-11-31T00:00:00Z", "datetime_invalid"],
      ["2026-13-01T00:00:00Z", "datetime_invalid"],
      ["0000-01-01T00:00:00Z", "datetime_invalid"],
      ["", "datetime_missing"],
    ];
    for (const [value, code] of table) {
      const out = new Findings();
      const row = { id: "EXT-001", type: "extraction", status: "draft", source_anchor: "assets/a.md#x", minted: [], extracted_by: "t", extracted_at: value };
      checkEntityLines(out, "e", [JSON.stringify(row)], "extraction", "EXT", EMPTY_INDEX);
      assert.deepEqual(out.list.map((f) => f.code), code === undefined ? [] : [code], value);
      if (code === "datetime_format") assert.match(out.list[0]!.message, /such as 2026-01-31T09:30:00Z/);
    }
  });

  it("P7-R1-10: file names match ASCII case-insensitively, and only ASCII letters fold", () => {
    for (const name of ["a.md", "a.MD", "a.Md", ".md", "UPPER.MD"]) assert.ok(isMarkdownName(name), name);
    for (const name of ["a.markdown", "a.md.txt", "a.ｍｄ", "a.mḋ", "amd"]) assert.ok(!isMarkdownName(name), name);
    for (const name of ["sample-playbook.md", "Sample-PlayBook.MD", "PLAYBOOK.md"]) assert.ok(isPlaybookTemplateName(name), name);
    for (const name of ["sample-play-book.md", "playbook.txt", "notes.md"]) assert.ok(!isPlaybookTemplateName(name), name);
  });
});

/** W1 R7 P7 review round 2: one test (or table) per finding. */
describe("buildos validate: review round 2 fixes", () => {
  it("P7-R2-04: an anchor splits at the first #, the fragment may hold #, and a folder or a raw system/ prefix fails; the file is never looked up", async () => {
    const root = project();
    const row = (id: string, status: string, fields: Record<string, string>) =>
      JSON.stringify({ id, type: "requirement", status, title: "Invented need", source_anchor: "assets/sample/sample.md#need-1", systems: [], environments: [], owners: [], ...fields });
    const rows = [
      row("REQ-001", "active", { doc_anchor: "docs/designs/#overview" }),
      row("REQ-002", "active", { doc_anchor: "system/../docs/a.md#x" }),
      row("REQ-003", "active", { doc_anchor: "docs/terms.md#C#" }),
      row("REQ-004", "draft", { source_anchor: "assets/sample/.#x" }),
      row("REQ-005", "draft", { source_anchor: "assets/a.md#" }),
      row("REQ-006", "active", { doc_anchor: "docs/a/..#x" }),
      row("REQ-007", "active", { doc_anchor: "./system/docs/a.md#x" }),
      row("REQ-008", "active", { doc_anchor: "docs\\designs\\#x" }),
      row("REQ-009", "active", { doc_anchor: "docs/does-not-exist.md#no-such-heading" }),
      row("REQ-010", "active", { doc_anchor: "docs/a.md##" }),
    ];
    writeFileSync(join(root, ".os", "data", "requirements.jsonl"), `${rows.join("\n")}\n`);
    const result = await findings(root);
    const here = result.findings.filter((f) => f.path === ".os/data/requirements.jsonl");
    assert.deepEqual(codes(here), [
      "anchor_format .os/data/requirements.jsonl line 1.doc_anchor",
      "anchor_format .os/data/requirements.jsonl line 2.doc_anchor",
      "anchor_format .os/data/requirements.jsonl line 4.source_anchor",
      "anchor_format .os/data/requirements.jsonl line 5.source_anchor",
      "anchor_format .os/data/requirements.jsonl line 6.doc_anchor",
      "anchor_not_docs .os/data/requirements.jsonl line 6.doc_anchor",
      "anchor_format .os/data/requirements.jsonl line 7.doc_anchor",
      "anchor_not_docs .os/data/requirements.jsonl line 7.doc_anchor",
      "anchor_format .os/data/requirements.jsonl line 8.doc_anchor",
    ]);
    assert.match(here[0]!.message, /must name a file before the #, not a folder/);
    assert.match(here[1]!.message, /starts with system\/, the source-package folder\. Write the path from the project folder, such as docs\/a\.md#x\./);
    assert.match(here[6]!.message, /such as docs\/a\.md#x\./);
  });

  it("P7-R2-05: a last `- key: value` item at sequence depth 64 opens level 65 and fails; a scalar item there fits", () => {
    const keys = Array.from({ length: YAML_MAX_DEPTH - 1 }, (_, i) => `${" ".repeat(i)}k${i}:`).join("\n");
    const pad = " ".repeat(YAML_MAX_DEPTH - 1);
    assert.doesNotThrow(() => parseYamlSubset(`${keys}\n${pad}- leaf\n`, "t"));
    assert.throws(() => parseYamlSubset(`${keys}\n${pad}- key: leaf\n`, "t"), /t:64: nesting is deeper than 64 levels/);
    assert.throws(() => parseYamlSubset(`${keys}\n${pad}- key:\n`, "t"), /nesting is deeper than 64 levels/);
    // One level less still fits.
    const fewer = Array.from({ length: YAML_MAX_DEPTH - 2 }, (_, i) => `${" ".repeat(i)}k${i}:`).join("\n");
    assert.doesNotThrow(() => parseYamlSubset(`${fewer}\n${" ".repeat(YAML_MAX_DEPTH - 2)}- key: leaf\n`, "t"));
  });

  it("P7-R2-06: with the budget spent, no loop keeps visiting entries (minted, dataset_refs, collections, environments)", () => {
    let rooms = 0;
    class Counting extends Findings {
      override room(): boolean {
        rooms++;
        return super.room();
      }
    }
    const many = 10_000;
    const extraction = { id: "EXT-001", type: "extraction", status: "draft", source_anchor: "assets/a.md#x", extracted_by: "t", extracted_at: "2026-01-31T09:30:00Z", minted: Array.from({ length: many }, () => "bad"), dataset_refs: Array.from({ length: many }, () => "") };
    const out = new Counting(2);
    checkEntityLines(out, "x", [JSON.stringify(extraction)], "extraction", "EXT", EMPTY_INDEX);
    assert.equal(out.list.length, 2);
    assert.equal(out.truncated, true);
    assert.ok(rooms < 20, `room() was called ${rooms} times for a 2-finding budget`);

    rooms = 0;
    const items = Array.from({ length: many }, () => "not a mapping");
    const config = new Map<string, unknown>([["version", 1], ["systems", items], ["environments", items], ["owners", items]]);
    const config2 = new Counting(2);
    checkConfigData(config2, "c", config as never);
    assert.equal(config2.list.length, 2);
    assert.ok(rooms < 40, `room() was called ${rooms} times for a 2-finding budget`);
  });
});
