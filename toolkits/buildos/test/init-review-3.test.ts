// W1 R7 P6 review round 3: one or more tests per init finding (P6-R3-02,
// P6-R3-03, P6-R3-05, P6-R3-06, P6-R3-10, P6-R3-12 to P6-R3-14). P6-R3-01
// and P6-R3-04 are in `test/init-review.test.ts`; the wrapper findings in
// `test/wrappers.test.ts`; P6-R3-09 in `test/manifest-contract.test.ts`.
// Each test fails without its fix. Tests that need a feature of the running
// system (hard links, POSIX permissions, a link mode) check for it first and
// say so when they skip.

import assert from "node:assert/strict";
import { chmodSync, existsSync, lchmodSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import type { BigIntStats } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { run } from "../src/cli/run.ts";
import { createNodeFsPort, identityOf, writeRaceHooks } from "../src/adapters/node-fs.ts";
import { loadSourceContent } from "../src/adapters/package-content.ts";
import type { FsPortFactory } from "../src/core/shared/fs-port.ts";
import type { ProcessPort } from "../src/core/shared/process-port.ts";
import { assertOutputMatches, assertSame, buildosSection, captureIo, shape } from "./helpers.ts";

const windows = process.platform === "win32";
const SYSTEM = join(import.meta.dirname, "..", "..", "..", "system");
const content = loadSourceContent(SYSTEM);
/** True when this user can be refused by POSIX permissions (not Windows, not root). */
const permissionsApply = !windows && process.getuid?.() !== 0;

let scratch: string;
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-init-review-3-"));
});
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});
afterEach(() => {
  delete writeRaceHooks.beforeOpen;
  delete writeRaceHooks.beforeStep;
});

let counter = 0;
function folder(): string {
  const dir = join(scratch, `case-${++counter}`, "project");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A Go-era project: an `.os/` folder with no manifest. */
function goEra(): string {
  const dir = folder();
  mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
  mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
  return dir;
}

/** A Make Docs stub: `action` runs in the target folder, then it reports success. */
function makeDocs(action: (target: string) => void = () => {}): { port: ProcessPort; runs: () => number } {
  let runs = 0;
  return {
    runs: () => runs,
    port: {
      find: (name) => (name === "make-docs" ? "/stub/make-docs" : undefined),
      run: (_program, _args, options) => {
        runs++;
        action(options.cwd);
        return { exitCode: 0, stdout: '{"status":"complete"}', stderr: "" };
      },
    },
  };
}

async function init(dir: string, args: string[], options: { openFs?: FsPortFactory; process?: ProcessPort } = {}) {
  const io = captureIo(dir);
  const domain = createInitDomain({ loadContent: () => content, now: () => new Date("2026-11-24T00:00:00Z"), openProcess: () => options.process ?? makeDocs().port });
  const exit = await run(["init", ...args], io, { domains: [domain], ...(options.openFs === undefined ? {} : { openFs: options.openFs }) });
  const stdout = io.stdout();
  return { exit, stdout, json: args.includes("--json") ? JSON.parse(stdout) : undefined };
}

function tryHardLink(existing: string, path: string): boolean {
  try {
    linkSync(existing, path);
    return true;
  } catch {
    return false;
  }
}

const packageWrapper = () => readFileSync(join(SYSTEM, ".os", "scripts", "buildos"), "utf8");

describe("P6-R3-02: the first plan's view of each path is carried through the second read", () => {
  it("a wrapper that another writer creates while Make Docs runs is not overwritten: stop before any write (exit 10)", async () => {
    const dir = goEra();
    const stub = makeDocs((target) => writeFileSync(join(target, ".os", "scripts", "buildos"), "#!/bin/sh\necho another writer\n"));
    const human = await init(dir, ["--make-docs"], { process: stub.port });
    assert.equal(human.exit, 10, shape(human.stdout));
    assert.ok(human.stdout.includes(
        "\nStopped. Make Docs was set up, but BuildOS changed nothing. While Make Docs ran, 1 path that BuildOS must write changed, so BuildOS did not write over it.\n\nThis path changed while Make Docs ran:\n  .os/scripts/buildos (it was not there before Make Docs ran, and now it is)\n\nMake Docs: set up.\n\nCheck this path, then run the same init command again. Make Docs already ran, so when you run it again, use --skip-make-docs and not --make-docs.\n",
      ), shape(human.stdout));
    assertSame(readFileSync(join(dir, ".os", "scripts", "buildos"), "utf8"), "#!/bin/sh\necho another writer\n");
    assertSame(existsSync(join(dir, ".os", "manifest.json")), false);
    assert.deepEqual(readdirSync(join(dir, ".os", "scripts")), ["buildos"]);
  });

  it("a wrapper that is deleted while Make Docs runs is not made again: stop before any write (exit 10)", async () => {
    const dir = goEra();
    writeFileSync(join(dir, ".os", "scripts", "buildos"), "#!/bin/sh\necho old\n");
    const stub = makeDocs((target) => unlinkSync(join(target, ".os", "scripts", "buildos")));
    const result = await init(dir, ["--make-docs", "--json"], { process: stub.port });
    assert.equal(result.exit, 10, shape(result.stdout));
    assertSame(result.json.result.reason, "changed_during_setup");
    assertSame(result.json.result.changed, [{ path: ".os/scripts/buildos", change: "removed" }]);
    assert.equal(result.json.result.make_docs.status, "set_up");
    assert.deepEqual(readdirSync(join(dir, ".os", "scripts")), []);
    assertSame(existsSync(join(dir, ".os", "manifest.json")), false);
  });
});

describe("P6-R3-03: a file that BuildOS would replace and that has more than one hard link stops before Make Docs runs", () => {
  it("AGENTS.md hard-linked with team-policy.md: exit 10, Make Docs not run, the link kept", async (t) => {
    const dir = folder();
    writeFileSync(join(dir, "team-policy.md"), "# Team policy\n");
    if (!tryHardLink(join(dir, "team-policy.md"), join(dir, "AGENTS.md"))) return t.skip("this file system has no hard links");
    const stub = makeDocs();
    const human = await init(dir, ["--make-docs"], { process: stub.port });
    assert.equal(human.exit, 10, shape(human.stdout));
    assert.equal(stub.runs(), 0, "Make Docs must not run");
    assert.ok(human.stdout.endsWith(
        "AGENTS.md is shared with another file name through a hard link. BuildOS replaces files and would break that link, so the names would no longer share their text.\nTo fix it: Make it a file with one name: copy it, delete the original, and give the copy the original name. Or move it away. Then run the same init command again.\n",
      ), shape(human.stdout));
    const json = await init(dir, ["--skip-make-docs", "--json"]);
    assertSame(json.json.result.problems[0].problem, "hard_link");
    assert.equal(statSync(join(dir, "AGENTS.md")).ino, statSync(join(dir, "team-policy.md")).ino);
    assert.equal(statSync(join(dir, "AGENTS.md")).nlink, 2);
    assert.deepEqual(readdirSync(dir).sort(), ["AGENTS.md", "team-policy.md"]);
  });

  it("a hard-linked wrapper in an adoption stops too (exit 10)", async (t) => {
    const dir = goEra();
    writeFileSync(join(dir, "shared-wrapper"), "#!/bin/sh\n");
    if (!tryHardLink(join(dir, "shared-wrapper"), join(dir, ".os", "scripts", "buildos"))) return t.skip("this file system has no hard links");
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 10, shape(result.stdout));
    assertSame([result.json.result.problems[0].path, result.json.result.problems[0].problem], [".os/scripts/buildos", "hard_link"]);
    assertSame(readFileSync(join(dir, ".os", "scripts", "buildos"), "utf8"), "#!/bin/sh\n");
    assertSame(existsSync(join(dir, ".os", "manifest.json")), false);
  });

  it("a hard link made between the plan and the replace stops the run; the link stays whole", async (t) => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    let linked = false;
    writeRaceHooks.beforeOpen = (step, target) => {
      if (step === "rename" && target.endsWith(`${sep}AGENTS.md`) && !linked) linked = tryHardLink(join(dir, "AGENTS.md"), join(dir, "team-policy.md"));
    };
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    if (!linked) return t.skip("this file system has no hard links");
    assert.equal(result.exit, 10, shape(result.stdout));
    assert.equal(result.json.diagnostics[0].code, "entry_changed");
    assert.equal(statSync(join(dir, "AGENTS.md")).ino, statSync(join(dir, "team-policy.md")).ino);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Mine\n");
  });
});

describe("P6-R3-05: a rerun decides every file from its whole scan, and every stop comes before any write", () => {
  /** A project BuildOS set up, with AGENTS.md and a stale .gitignore section as given. */
  async function setUp(agents: string): Promise<string> {
    const dir = folder();
    assert.equal((await init(dir, ["--skip-make-docs"])).exit, 0);
    writeFileSync(join(dir, "AGENTS.md"), agents);
    writeFileSync(join(dir, ".gitignore"), `node_modules/\n\n${buildosSection("old/\n", { gitignore: true })}`);
    return dir;
  }

  it("AGENTS.md whose only pair is an example in a code block: reported as not refreshed; .gitignore refreshed (exit 0)", async () => {
    const agents = "# Mine\n\n```md\n<!-- buildos:begin -->\nexample\n<!-- buildos:end -->\n```\n";
    const dir = await setUp(agents);
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(result.json.result.shared_files, [
      { path: "AGENTS.md", result: "skipped", reason: "no_section" },
      { path: "CLAUDE.md", result: "unchanged" },
      { path: ".gitignore", result: "block_updated" },
    ]);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), agents);
  });

  it("AGENTS.md with a section changed by hand: exit 10, and .gitignore is not written either", async () => {
    const agents = "# Mine\n<!-- buildos:begin -->\nmy own text\n<!-- buildos:end -->\n";
    const dir = await setUp(agents);
    const ignore = readFileSync(join(dir, ".gitignore"));
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 10, shape(result.stdout));
    assertSame(result.json.result.problems[0].problem, "section_changed");
    assertSame(readFileSync(join(dir, ".gitignore")), ignore);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), agents);
  });
});

describe("P6-R3-06: an adoption keeps the replaced wrapper's permission bits, with the owner-execute bit", () => {
  for (const [before, after] of [
    [0o700, 0o700],
    [0o640, 0o740],
  ] as const) {
    it(`a ${before.toString(8)} wrapper is ${after.toString(8)} after the adoption`, async (t) => {
      if (windows) return t.skip("Windows has no POSIX mode bits");
      const dir = goEra();
      writeFileSync(join(dir, ".os", "scripts", "buildos"), "#!/bin/sh\necho old\n");
      chmodSync(join(dir, ".os", "scripts", "buildos"), before);
      const result = await init(dir, ["--skip-make-docs"]);
      assert.equal(result.exit, 0, shape(result.stdout));
      assert.equal(statSync(join(dir, ".os", "scripts", "buildos")).mode & 0o7777, after);
      assertSame(readFileSync(join(dir, ".os", "scripts", "buildos"), "utf8"), packageWrapper());
    });
  }

  it("a change of a wrapper link's own mode between the plan and the replace stops the run", async (t) => {
    if (windows || typeof lchmodSync !== "function") return t.skip("this OS keeps no mode on a link (only macOS does)");
    const dir = goEra();
    writeFileSync(join(dir, "old-wrapper"), "#!/bin/sh\n");
    symlinkSync(join("..", "..", "old-wrapper"), join(dir, ".os", "scripts", "buildos"));
    lchmodSync(join(dir, ".os", "scripts", "buildos"), 0o755);
    writeRaceHooks.beforeOpen = (step, target) => {
      if (step === "rename" && target.endsWith(`${sep}buildos`)) lchmodSync(join(dir, ".os", "scripts", "buildos"), 0o700);
    };
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 10, shape(result.stdout));
    assert.equal(result.json.diagnostics[0].code, "entry_changed");
    assert.ok(lstatSync(join(dir, ".os", "scripts", "buildos")).isSymbolicLink());
  });
});

describe("P6-R3-10: each router is read once per plan, and an unreadable one never stops an adoption", () => {
  it("a Go-era project with an unreadable AGENTS.md adopts with --skip-make-docs (exit 0), and AGENTS.md is not changed", async (t) => {
    if (!permissionsApply) return t.skip("POSIX permissions do not apply to this user");
    const dir = goEra();
    writeFileSync(join(dir, "AGENTS.md"), "# Go-era router\n");
    chmodSync(join(dir, "AGENTS.md"), 0o000);
    try {
      const result = await init(dir, ["--skip-make-docs", "--json"]);
      assert.equal(result.exit, 0, shape(result.stdout));
      assertSame(result.json.result.setup, "adoption");
    } finally {
      chmodSync(join(dir, "AGENTS.md"), 0o644);
    }
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Go-era router\n");
  });

  it("a new project reads AGENTS.md and CLAUDE.md once each", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    writeFileSync(join(dir, "CLAUDE.md"), "# Mine\n");
    const reads = new Map<string, number>();
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        readFileLimited: (path, limit) => {
          reads.set(path, (reads.get(path) ?? 0) + 1);
          return port.readFileLimited(path, limit);
        },
      };
    };
    const result = await init(dir, ["--skip-make-docs", "--dry-run"], { openFs });
    assert.equal(result.exit, 0);
    assert.equal(reads.get("AGENTS.md"), 1);
    assert.equal(reads.get("CLAUDE.md"), 1);
  });
});

describe("P6-R3-12 and P6-R3-13: the undo journal and its report", () => {
  it("a folder made just before its read-back fails is journaled and reported, not forgotten (exit 10)", async () => {
    const dir = folder();
    const made = new Set<string>();
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        mkdir: (path, opts) => {
          port.mkdir(path, opts);
          made.add(path);
        },
        entryId: (path) => {
          if (path === ".os" && made.has(".os")) throw new Error("injected lstat failure");
          return port.entryId(path);
        },
      };
    };
    const result = await init(dir, ["--skip-make-docs", "--json"], { openFs });
    assert.equal(result.exit, 10, shape(result.stdout));
    assertSame(result.json.result.not_restored, [{ path: ".os/", reason: "BuildOS made this folder but could not check it afterwards, so it left it there", state: "left" }]);
    assert.deepEqual(readdirSync(dir), [".os"]);
  });

  it("a created file that is already gone is not listed as left behind (complete undo)", async () => {
    const dir = folder();
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        writeNewFile: (path, data, opts) => {
          if (path === ".os/manifest.json") {
            rmSync(join(dir, ".os", "AGENTS.md"));
            throw new Error("injected failure");
          }
          return port.writeNewFile(path, data, opts);
        },
      };
    };
    const result = await init(dir, ["--skip-make-docs", "--json"], { openFs });
    assert.equal(result.exit, 1, shape(result.stdout));
    assertSame(result.json.result.not_restored, []);
    assert.deepEqual(readdirSync(dir), []);
  });

  it("an undo whose folder flush fails says the content is back but its save to disk is not certain", async (t) => {
    if (windows) return t.skip("Windows has no folder flush (PE-005)");
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
    let flushes = 0;
    writeRaceHooks.beforeStep = (step, target) => {
      // The first flush after the AGENTS.md rename is the forward write; the second is the undo.
      if (step === "sync-parent" && target.endsWith(`${sep}AGENTS.md`) && ++flushes === 2) throw Object.assign(new Error("EIO: i/o error, fsync"), { code: "EIO" });
    };
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        writeFileAtomic: (path, data, opts) => {
          if (path === ".gitignore" && opts?.expect?.kind === "file" && opts.expect.id !== undefined && new TextDecoder().decode(opts.expect.data) === "node_modules/\n") throw new Error("injected failure");
          return port.writeFileAtomic(path, data, opts);
        },
      };
    };
    const human = await init(dir, ["--skip-make-docs"], { openFs });
    assert.equal(human.exit, 10, shape(human.stdout));
    assertOutputMatches(
      human.stdout,
      /\nFailed\. BuildOS could not finish its setup\. It undid its own changes, but it could not make sure that every undo was saved to disk\.\nWhy: injected failure\.\n\nBuildOS put these paths back, but could not make sure the change was saved to disk:\n {2}AGENTS\.md\n\nCheck that each path listed holds what it held before, fix the problem shown in "Why", then run the same init command again\.\n$/,
    );
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Mine\n");
  });
});

describe("P6-R3-14: an identity the OS does not report never matches", () => {
  /** A bigint `lstat` result with the given inode, as Node reports it. */
  function stats(ino: bigint): BigIntStats {
    return { dev: 5n, ino, mode: 0o100644n, nlink: 1n, isSymbolicLink: () => false, isDirectory: () => false, isFile: () => true } as unknown as BigIntStats;
  }
  it("inode 0 gives a new identity each time; a real inode gives the same one, kept as bigint", () => {
    assert.notEqual(identityOf(stats(0n)).id, identityOf(stats(0n)).id);
    assert.equal(identityOf(stats(7n)).id, identityOf(stats(7n)).id);
    // A 64-bit Windows file ID is not narrowed: two IDs that differ only past 2^53 stay different.
    assert.notEqual(identityOf(stats(2n ** 60n + 1n)).id, identityOf(stats(2n ** 60n + 2n)).id);
    assert.equal(identityOf(stats(7n)).links, 1);
  });
});
