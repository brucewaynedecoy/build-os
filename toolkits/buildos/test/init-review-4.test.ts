// W1 R7 P6 review round 4 (closing check): one or more tests per finding
// that is fixed in code (P6-R4-01 to P6-R4-07, P6-R4-09). P6-R4-08 is in
// `test/boundary.test.ts`, P6-R4-10 in `test/package.test.ts`. Each test
// fails without its fix. Tests that need a feature of the running system
// (hard links, POSIX permissions, signals) check for it first and say so
// when they skip.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { run } from "../src/cli/run.ts";
import { sameKey } from "../src/adapters/node-fs.ts";
import { nodeHash } from "../src/adapters/node-hash.ts";
import { loadSourceContent } from "../src/adapters/package-content.ts";
import { mergeSection, SHARED_FILE_MAX_BYTES, SHARED_FILES } from "../src/core/init/shared-files.ts";
import type { ProcessPort } from "../src/core/shared/process-port.ts";
import { assertOutputDoesNotMatch, assertSame, buildosSection, captureIo, shape } from "./helpers.ts";

const windows = process.platform === "win32";
const SYSTEM = join(import.meta.dirname, "..", "..", "..", "system");
const HELPER = join(SYSTEM, ".os", "scripts", "pinned-version.cjs");
const content = loadSourceContent(SYSTEM);
const permissionsApply = !windows && process.getuid?.() !== 0;
const [AGENTS, CLAUDE, GITIGNORE] = SHARED_FILES as [(typeof SHARED_FILES)[number], (typeof SHARED_FILES)[number], (typeof SHARED_FILES)[number]];
const enc = (text: string) => new TextEncoder().encode(text);

let scratch: string;
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-init-review-4-"));
});
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

let counter = 0;
function folder(): string {
  const dir = join(scratch, `case-${++counter}`, "project");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeDocs(action: (target: string) => void = () => {}): ProcessPort {
  return {
    find: (name) => (name === "make-docs" ? "/stub/make-docs" : undefined),
    run: (_program, _args, options) => {
      action(options.cwd);
      return { exitCode: 0, stdout: '{"status":"complete"}', stderr: "" };
    },
  };
}

async function init(dir: string, args: string[], process?: ProcessPort) {
  const io = captureIo(dir);
  const domain = createInitDomain({ loadContent: () => content, now: () => new Date("2026-11-24T00:00:00Z"), openProcess: () => process ?? makeDocs() });
  const exit = await run(["init", ...args], io, { domains: [domain] });
  const stdout = io.stdout();
  return { exit, stdout, json: args.includes("--json") ? JSON.parse(stdout) : undefined };
}

describe("P6-R4-01: a valid, current section is unchanged whatever the line breaks around or in it", () => {
  const cases: [string, typeof AGENTS, boolean][] = [
    ["AGENTS.md", AGENTS, false],
    ["CLAUDE.md", CLAUDE, false],
    [".gitignore", GITIGNORE, true],
  ];
  for (const [name, spec, gitignore] of cases) {
    it(`${name}: an LF section in a file with a CRLF line elsewhere, or with CRLF lines inside it, keeps every byte`, () => {
      const body = "line one\nline two\n";
      const lf = buildosSection(body, { gitignore });
      const inputs = [
        `# Team\r\n\r\n${lf}`,
        `# Team\n${lf}tail\r\n`,
        `# Team\r\n${lf.replace("line one\n", "line one\r\n")}`,
        `${lf.replace(/\n/, "\r\n")}after\n`,
      ];
      for (const text of inputs) {
        const before = enc(text);
        const merged = mergeSection(spec, before, enc(body), nodeHash);
        assert.ok("action" in merged, JSON.stringify(text));
        assert.equal(merged.action, "unchanged", JSON.stringify(text));
        assert.deepEqual(merged.data, before);
      }
    });
  }

  it("a rerun with a hard-linked AGENTS.md whose section is current: exit 0, no write, the link kept", async (t) => {
    const dir = folder();
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    const section = readFileSync(join(dir, "AGENTS.md"), "utf8");
    writeFileSync(join(dir, "AGENTS.md"), `# Team policy\r\n\r\n${section}`);
    try {
      linkSync(join(dir, "AGENTS.md"), join(dir, "team-policy.md"));
    } catch {
      return t.skip("this file system has no hard links");
    }
    const before = readFileSync(join(dir, "AGENTS.md"));
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(result.json.result.shared_files[0], { path: "AGENTS.md", result: "unchanged" });
    assertSame(readFileSync(join(dir, "AGENTS.md")), before);
    assert.equal(statSync(join(dir, "AGENTS.md")).nlink, 2);
  });
});

describe("P6-R4-02: a marker pair that starts inside an HTML comment is one example, through its end line", () => {
  const stale = `<!-- buildos:section v1 sha256=${"0".repeat(64)} -->`;
  const example = `# Mine\n\n<!--\n<!-- buildos:begin -->\n${stale}\nexample text\n<!-- buildos:end -->\n-->\n`;

  it("keeps the example and adds the section (no stop)", () => {
    const merged = mergeSection(AGENTS, enc(example), enc("package text\n"), nodeHash);
    assert.ok("action" in merged, JSON.stringify(merged));
    assert.equal(merged.action, "add_block");
    assert.ok(new TextDecoder().decode(merged.data).startsWith(example));
  });

  it("through the CLI: exit 0, and the example stays byte for byte", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), example);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(result.json.result.shared_files[0].result, "block_added");
    assert.ok(readFileSync(join(dir, "AGENTS.md"), "utf8").startsWith(example));
  });

  it("a pair with a valid hash inside a comment is still owned and refreshed", () => {
    const owned = `<!--\n${buildosSection("old\n")}-->\n`;
    const merged = mergeSection(AGENTS, enc(owned), enc("new\n"), nodeHash);
    assert.ok("action" in merged && merged.action === "update_block", JSON.stringify(merged));
    assert.equal(new TextDecoder().decode(merged.data), `<!--\n${buildosSection("new\n")}-->\n`);
  });
});

describe("P6-R4-03: a rerun says 'up to date' only for the sections it checked", () => {
  it("an AGENTS.md over the size limit: the summary names it and why (human and JSON), exit 0", async () => {
    const dir = folder();
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    writeFileSync(join(dir, "AGENTS.md"), "x".repeat(SHARED_FILE_MAX_BYTES + 1));
    const want = "BuildOS is already set up in this folder. Its section is up to date in CLAUDE.md, .gitignore. BuildOS could not check AGENTS.md, because it is larger than 4 MiB, so BuildOS did not read it. Nothing was changed.";
    const json = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(json.exit, 0, shape(json.stdout));
    assertSame(json.json.result.summary, want);
    const human = await init(dir, ["--skip-make-docs"]);
    assert.equal(human.exit, 0, shape(human.stdout));
    assert.ok(human.stdout.includes(`Done. ${want}`), shape(human.stdout));
    assertOutputDoesNotMatch(human.stdout, /its sections are up to date/);
  });

  it("an unreadable AGENTS.md: the summary says BuildOS may not read it", async (t) => {
    if (!permissionsApply) return t.skip("POSIX permissions do not apply to this user");
    const dir = folder();
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    chmodSync(join(dir, "AGENTS.md"), 0o000);
    try {
      const json = await init(dir, ["--skip-make-docs", "--json"]);
      assert.equal(json.exit, 0, shape(json.stdout));
      assertSame(json.json.result.summary, "BuildOS is already set up in this folder. Its section is up to date in CLAUDE.md, .gitignore. BuildOS could not check AGENTS.md, because BuildOS may not read it. Nothing was changed.");
    } finally {
      chmodSync(join(dir, "AGENTS.md"), 0o644);
    }
  });
});

describe("P6-R4-04: a bare CR is text, never a line break or marker padding", () => {
  it("a stale section whose end line holds a bare CR stops (exit 10) instead of dropping bytes", () => {
    const text = `${buildosSection("old\n", { last: "" })}\r \t\r\nTeam policy\n`;
    const merged = mergeSection(AGENTS, enc(text), enc("new\n"), nodeHash);
    assert.deepEqual(merged, { problem: "cr_line_endings", line: 4 });
  });

  it("a CR-only file with a BuildOS section stops; no second section is added", () => {
    for (const [spec, gitignore] of [[AGENTS, false], [GITIGNORE, true]] as const) {
      const text = `# Mine\r${buildosSection("current\n", { gitignore, eol: "\r" })}`;
      const merged = mergeSection(spec, enc(text), enc("current\n"), nodeHash);
      assert.ok("problem" in merged && merged.problem === "cr_line_endings", JSON.stringify(merged));
    }
  });

  it("a bare CR elsewhere in the file is kept, and the section is still found", () => {
    const text = `note\rmore\n${buildosSection("old\n")}after\rend\n`;
    const merged = mergeSection(AGENTS, enc(text), enc("new\n"), nodeHash);
    assert.ok("action" in merged && merged.action === "update_block", JSON.stringify(merged));
    assert.equal(new TextDecoder().decode(merged.data), `note\rmore\n${buildosSection("new\n")}after\rend\n`);
  });

  it("through the CLI: exit 10 with the plain message, and the file is not changed", async () => {
    const dir = folder();
    const text = `# Mine\r${buildosSection("current\n", { eol: "\r" })}`;
    writeFileSync(join(dir, "AGENTS.md"), text);
    const human = await init(dir, ["--skip-make-docs"]);
    assert.equal(human.exit, 10, shape(human.stdout));
    assert.ok(human.stdout.includes(
        "AGENTS.md uses old Mac line endings (CR only) at line 1: BuildOS finds a buildos line there only when it reads a CR as a line break, so it cannot tell where that line starts and ends, and it did not change this file.\nTo fix it: Save the file with LF or CRLF line endings. Then run the same init command again.\n",
      ), shape(human.stdout));
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), text);
  });

  /** The property: with bare CRs anywhere, a valid section's surroundings keep every byte, or the command stops. */
  it("holds for 3,000 generated files with bare CRs around a valid section", () => {
    const pieces = ["text\n", "\r", "note\rmore\n", "\r \t", "\r\n", "<!-- buildos:end -->\r \t\n", "<!-- buildos:begin -->\r", "# Mine\r\n", "```\n", "<!--\n", "-->\n", "Team policy\n"];
    const tails = ["\n", "\r\n", "\r \t\r\n", "\r\n\r", "\r", ""];
    let seed = 20261124;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
    const counts = { kept: 0, stopped: 0 };
    for (let n = 0; n < 3000; n++) {
      const a = Array.from({ length: Math.floor(next() * 5) }, () => pick(pieces)).join("");
      const b = pick(tails) + Array.from({ length: Math.floor(next() * 5) }, () => pick(pieces)).join("");
      const head = a === "" || a.endsWith("\n") ? a : `${a}\n`;
      const text = `${head}${buildosSection("old\n", { last: "" })}${b}`;
      const merged = mergeSection(AGENTS, enc(text), enc("new\n"), nodeHash);
      if ("problem" in merged) {
        counts.stopped++;
        continue;
      }
      const out = new TextDecoder().decode(merged.data);
      if (merged.action === "add_block") {
        // No section was found (its end line is not a marker line): every byte stays, and the new section is put in one place.
        assert.ok(out.length > text.length && (out.startsWith(text) || out.endsWith(text)), shape(`bytes changed for ${JSON.stringify(text)}`));
        counts.kept++;
        continue;
      }
      assert.ok(out.startsWith(head), shape(`the bytes before the section changed for ${JSON.stringify(text)}`));
      // The end line's own terminator (LF or CRLF) is part of that line; every byte after it stays.
      const after = b.startsWith("\r\n") && !b.startsWith("\r\n\r") ? b.slice(2) : b.startsWith("\n") ? b.slice(1) : b;
      assert.ok(out.endsWith(after), shape(`the bytes after the section changed for ${JSON.stringify(text)}: ${JSON.stringify(out)}`));
      counts.kept++;
    }
    assert.ok(counts.kept > 300 && counts.stopped > 300, shape(JSON.stringify(counts)));
  });
});

describe("P6-R4-05: a folder removed while Make Docs runs is reported as removed", () => {
  it("an .os/scripts folder that Make Docs removes: exit 10, 'now it is gone'", async () => {
    const dir = folder();
    mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    const human = await init(dir, ["--make-docs"], makeDocs((target) => rmSync(join(target, ".os", "scripts"), { recursive: true })));
    assert.equal(human.exit, 10, shape(human.stdout));
    assert.ok(human.stdout.includes("  .os/scripts/ (it was there before Make Docs ran, and now it is gone)\n"), shape(human.stdout));
  });
});

describe("P6-R4-06: a wrapper link that is itself hard-linked stops an adoption", () => {
  it("exit 10, hard_link, and the link is kept", async (t) => {
    if (windows) return t.skip("no hard link to a link on Windows");
    const dir = folder();
    mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(dir, "real-wrapper"), "#!/bin/sh\n");
    symlinkSync("../../real-wrapper", join(dir, ".os", "scripts", "buildos"));
    const made = spawnSync("ln", ["-P", join(dir, ".os", "scripts", "buildos"), join(dir, "second-name")]);
    if (made.status !== 0 || lstatSync(join(dir, ".os", "scripts", "buildos")).nlink !== 2) return t.skip("this system cannot hard-link a link itself");
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 10, shape(result.stdout));
    assertSame([result.json.result.problems[0].path, result.json.result.problems[0].problem], [".os/scripts/buildos", "hard_link"]);
    assert.ok(lstatSync(join(dir, ".os", "scripts", "buildos")).isSymbolicLink());
  });
});

describe("P6-R4-07: an inode of 0 never matches in the lower-level identity checks", () => {
  it("the adapter's sameKey", () => {
    assert.equal(sameKey({ dev: 1n, ino: 0n }, { dev: 1n, ino: 0n }), false);
    assert.equal(sameKey({ dev: 1n, ino: 2n ** 60n + 1n }, { dev: 1n, ino: 2n ** 60n + 1n }), true);
    assert.equal(sameKey({ dev: 1n, ino: 2n ** 60n + 1n }, { dev: 1n, ino: 2n ** 60n }), false);
  });

  it("the version helper's sameFileStats (bigint only)", () => {
    const helper = createRequire(import.meta.url)(HELPER) as { sameFileStats(a: object, b: object): boolean };
    assert.equal(helper.sameFileStats({ dev: 1n, ino: 0n }, { dev: 1n, ino: 0n }), false);
    assert.equal(helper.sameFileStats({ dev: 1n, ino: 2n ** 60n + 1n }, { dev: 1n, ino: 2n ** 60n + 1n }), true);
    assert.equal(helper.sameFileStats({ dev: 1n, ino: 2n ** 60n + 1n }, { dev: 1n, ino: 2n ** 60n }), false);
    assert.equal(helper.sameFileStats({ dev: 1, ino: 5 }, { dev: 1, ino: 5 }), false);
  });
});

describe("P6-R4-09: the version helper reports a program that a signal ended", () => {
  it("one plain line naming the signal, and exit 128 + its number", (t) => {
    if (windows) return t.skip("POSIX signals");
    const bin = join(scratch, `signal-${++counter}`);
    mkdirSync(bin, { recursive: true });
    // W1 R7 P8 pin-first review round 1: no program starts to learn its version, so the program here is npx with the pinned version.
    writeFileSync(join(bin, "manifest.json"), '{"schema_version":1,"buildos_version":"1.2.3","initialized_at":"2026-11-24T00:00:00Z"}');
    writeFileSync(join(bin, "npx.EXE"), "#!/bin/sh\nkill -TERM $$\n", { mode: 0o755 });
    const result = spawnSync(process.execPath, [HELPER, "--cmd", join(bin, "self.cmd"), join(bin, "manifest.json")], { env: { ...process.env, PATH: bin, PATHEXT: ".EXE" }, encoding: "utf8" });
    assert.equal(result.status, 143, shape(result.stderr));
    assertSame(result.stderr, `${join(bin, "npx.EXE")} was stopped by SIGTERM before it finished.\n`);
  });
});
