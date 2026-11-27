// W1 R7 P6 review round 2: one or more tests per finding (P6-R2-02 to
// P6-R2-17; P6-R2-01 is in `test/init-review.test.ts`, the wrapper findings
// P6-R2-12 to P6-R2-14 in `test/wrappers.test.ts`, and P6-R2-09 also in
// `test/manifest-contract.test.ts`). Each test fails without its fix. Tests
// that need a feature of the running system (a symbolic link, POSIX
// permissions, a folder flush) check for it first and say so when they skip.

import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { run } from "../src/cli/run.ts";
import { createNodeFsPort, writeRaceHooks } from "../src/adapters/node-fs.ts";
import { loadSourceContent } from "../src/adapters/package-content.ts";
import type { FsPortFactory } from "../src/core/shared/fs-port.ts";
import type { ProcessPort } from "../src/core/shared/process-port.ts";
import { assertOutputDoesNotMatch, assertOutputMatches, assertSame, assertSameBytes, captureIo, shape, tag } from "./helpers.ts";

const windows = process.platform === "win32";
const SYSTEM = join(import.meta.dirname, "..", "..", "..", "system");
const content = loadSourceContent(SYSTEM);
const MAKE_DOCS_ROUTER = "<!-- make-docs:begin -->\n# Agent Instructions\n\n- Read the same-named file in docs/.\n<!-- make-docs:end -->\n";
/** True when this user can be refused by POSIX permissions (not Windows, not root). */
const permissionsApply = !windows && process.getuid?.() !== 0;

let scratch: string;
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-init-review-2-"));
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

function trySymlink(target: string, path: string): boolean {
  try {
    symlinkSync(target, path);
    return true;
  } catch {
    return false;
  }
}

/** A Make Docs stub: `action` runs in the target folder, then it reports success (or exit `code`). */
function makeDocs(action: (target: string) => void = () => {}, code = 0): { port: ProcessPort; runs: () => number } {
  let runs = 0;
  return {
    runs: () => runs,
    port: {
      find: (name) => (name === "make-docs" ? "/stub/make-docs" : undefined),
      run: (_program, _args, options) => {
        runs++;
        action(options.cwd);
        return code === 0 ? { exitCode: 0, stdout: '{"status":"complete"}', stderr: "" } : { exitCode: code, stdout: "", stderr: "make-docs cannot classify this target safely enough to write changes." };
      },
    },
  };
}

async function init(dir: string, args: string[], options: { openFs?: FsPortFactory; process?: ProcessPort; platform?: string } = {}) {
  const io = captureIo(dir);
  const domain = createInitDomain({
    loadContent: () => content,
    now: () => new Date("2026-11-24T00:00:00Z"),
    openProcess: () => options.process ?? makeDocs().port,
    ...(options.platform === undefined ? {} : { platform: options.platform }),
  });
  const exit = await run(["init", ...args], io, { domains: [domain], ...(options.openFs === undefined ? {} : { openFs: options.openFs }) });
  const stdout = io.stdout();
  return { exit, stdout, json: args.includes("--json") ? JSON.parse(stdout) : undefined };
}

describe("P6-R2-02: a write that committed and then failed is still undone", () => {
  it("the folder flush after the AGENTS.md rename fails: the undo puts AGENTS.md back, and says so only when it did", async (t) => {
    if (windows) return t.skip("Windows has no folder flush (PE-005)");
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    let failed = 0;
    writeRaceHooks.beforeStep = (step, target) => {
      if (step === "sync-parent" && target.endsWith(`${sep}AGENTS.md`) && failed++ === 0) throw Object.assign(new Error("EIO: i/o error, fsync"), { code: "EIO" });
    };
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(failed >= 1, true, "the injected flush failure ran");
    assert.equal(result.exit, 5, shape(result.stdout));
    assertSame(result.json.result.not_restored, []);
    assertOutputMatches(result.json.result.summary, /so it undid its own changes/);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Mine\n");
    assert.deepEqual(readdirSync(dir), ["AGENTS.md"]);
  });
});

describe("P6-R2-03: the undo keeps a later edit by the user, also one in place", () => {
  it("a save in place (same identity) after BuildOS replaced AGENTS.md is kept and listed (exit 10)", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        writeFileAtomic: (path, data, opts) => {
          if (path === ".gitignore" && opts?.expect?.kind === "file" && opts.expect.id !== undefined && new TextDecoder().decode(opts.expect.data) === "node_modules/\n") {
            const before = statSync(join(dir, "AGENTS.md")).ino;
            // An editor that saves in place: same file, new bytes.
            writeFileSync(join(dir, "AGENTS.md"), "# Saved by the user\n");
            assert.equal(statSync(join(dir, "AGENTS.md")).ino, before);
            throw new Error("injected failure");
          }
          return port.writeFileAtomic(path, data, opts);
        },
      };
    };
    const result = await init(dir, ["--skip-make-docs", "--json"], { openFs });
    assert.equal(result.exit, 10);
    assertSame(result.json.write_status, "partially_applied");
    assertSame(result.json.result.not_restored[0], { path: "AGENTS.md", reason: "it changed after BuildOS wrote it, so BuildOS left it as it is", state: "left" });
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Saved by the user\n");
    assertSame(readFileSync(join(dir, ".gitignore"), "utf8"), "node_modules/\n");
  });
});

describe("P6-R2-04: a temporary file that cannot be removed is reported with its exact path", () => {
  it("the destination check fails, then the unlink of the temporary file fails: exit 10, the temporary file listed", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    writeRaceHooks.beforeOpen = (step, target) => {
      if (step === "rename" && target.endsWith(`${sep}AGENTS.md`)) writeFileSync(join(dir, "AGENTS.md"), "# Saved by an editor\n");
    };
    writeRaceHooks.beforeStep = (step, target) => {
      if (step === "unlink" && /\.buildos-init-[0-9]+\.tmp$/.test(target)) throw Object.assign(new Error("EPERM: operation not permitted, unlink"), { code: "EPERM" });
    };
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    delete writeRaceHooks.beforeStep;
    const temp = readdirSync(dir).find((n) => /^\.buildos-init-[0-9]+\.tmp$/.test(n));
    assert.ok(temp !== undefined, tag(String(readdirSync(dir).join(","))));
    assert.equal(result.exit, 10);
    assertSame(result.json.write_status, "partially_applied");
    assertSame(result.json.result.not_restored, [{ path: temp, reason: "BuildOS could not remove this file after a failed write, so it is still there", state: "left" }]);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Saved by an editor\n");
    const human = await init(folder(), ["--skip-make-docs"]);
    assert.equal(human.exit, 0);
  });
});

describe("P6-R2-05: every replacement is read and checked before Make Docs runs", () => {
  it("a wrapper of 4 MiB + 1 byte stops the adoption before Make Docs runs (exit 10)", async () => {
    const dir = folder();
    mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(dir, ".os", "scripts", "buildos"), new Uint8Array(4 * 1024 * 1024 + 1));
    const stub = makeDocs((target) => mkdirSync(join(target, "docs")));
    const result = await init(dir, ["--make-docs", "--json"], { process: stub.port });
    assert.equal(result.exit, 10);
    assert.equal(stub.runs(), 0, "Make Docs must not run");
    assertSame(result.json.result.problems[0].problem, "replace_too_large");
    assertSame(result.json.result.problems[0].message, ".os/scripts/buildos is larger than 4 MiB, so BuildOS cannot keep a copy to put back if setup fails.");
    assert.deepEqual(readdirSync(dir), [".os"]);
  });

  // P6-R3-02: the second read of the folder now finds the change, so BuildOS writes nothing at all.
  it("a wrapper edited while Make Docs runs is not overwritten: the run stops before any write (exit 10)", async () => {
    const dir = folder();
    mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(dir, ".os", "scripts", "buildos"), "#!/bin/sh\necho old\n");
    const stub = makeDocs((target) => writeFileSync(join(target, ".os", "scripts", "buildos"), "#!/bin/sh\necho edited by the user\n"));
    const result = await init(dir, ["--make-docs", "--json"], { process: stub.port });
    assert.equal(result.exit, 10, shape(result.stdout));
    assert.equal(result.json.diagnostics[0].code, "init_changed_during_setup");
    assertSame(result.json.result.changed, [{ path: ".os/scripts/buildos", change: "changed" }]);
    assert.equal(result.json.result.make_docs.status, "set_up");
    assert.deepEqual(readdirSync(join(dir, ".os", "scripts")), ["buildos"]);
    assertSame(readFileSync(join(dir, ".os", "scripts", "buildos"), "utf8"), "#!/bin/sh\necho edited by the user\n");
    assertSame(existsSync(join(dir, ".os", "manifest.json")), false);
  });
});

describe("P6-R2-06: permission bits are part of what the replace expects", () => {
  it("a chmod 0644 to 0600 between the plan and the replace stops the run; the user's mode stays", async (t) => {
    if (windows) return t.skip("Windows has no POSIX mode bits");
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    chmodSync(join(dir, "AGENTS.md"), 0o644);
    writeRaceHooks.beforeOpen = (step, target) => {
      if (step === "temp" && target.includes(`${sep}.buildos-init-`)) chmodSync(join(dir, "AGENTS.md"), 0o600);
    };
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 10, shape(result.stdout));
    assert.equal(result.json.diagnostics[0].code, "entry_changed");
    assert.equal(statSync(join(dir, "AGENTS.md")).mode & 0o777, 0o600);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Mine\n");
  });
});

describe("P6-R2-07: the write check looks at the folder the rename acts in, never through a link", () => {
  it("adopts a project whose wrapper is a link to a file outside the project: the link is replaced, the outside file kept (exit 0)", async (t) => {
    const dir = folder();
    const outside = join(dir, "..", "outside-wrapper");
    writeFileSync(outside, "#!/bin/sh\necho outside\n");
    mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    if (!trySymlink(outside, join(dir, ".os", "scripts", "buildos"))) return t.skip("this OS user cannot make a symbolic link");
    const stub = makeDocs();
    const result = await init(dir, ["--make-docs", "--json"], { process: stub.port });
    assert.equal(result.exit, 0, shape(result.stdout));
    assert.equal(stub.runs(), 1);
    assertSame(readFileSync(outside, "utf8"), "#!/bin/sh\necho outside\n");
    assert.equal(statSync(join(dir, ".os", "scripts", "buildos")).isFile(), true);
    assertSameBytes(readFileSync(join(dir, ".os", "scripts", "buildos")), readFileSync(join(SYSTEM, ".os", "scripts", "buildos")), ".os/scripts/buildos");
  });

  it("stops with exit 5 before Make Docs runs when the wrapper folder itself is read-only", async (t) => {
    if (!permissionsApply) return t.skip("POSIX permissions do not apply to this user");
    const dir = folder();
    mkdirSync(join(dir, ".os", "scripts"), { recursive: true });
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(dir, ".os", "scripts", "buildos"), "old\n");
    chmodSync(join(dir, ".os", "scripts"), 0o555);
    const stub = makeDocs();
    try {
      const result = await init(dir, ["--make-docs", "--json"], { process: stub.port });
      assert.equal(result.exit, 5);
      assert.equal(stub.runs(), 0);
      assertSame(result.json.result.folders, [{ path: ".os/scripts/", error: "permission denied" }]);
    } finally {
      chmodSync(join(dir, ".os", "scripts"), 0o755);
    }
  });
});

describe("P6-R2-08: the Make Docs result is kept the moment Make Docs returns", () => {
  it("Make Docs succeeds and leaves AGENTS.md unreadable: the failure still names Make Docs and --skip-make-docs", async (t) => {
    if (!permissionsApply) return t.skip("POSIX permissions do not apply to this user");
    const dir = folder();
    const stub = makeDocs((target) => {
      mkdirSync(join(target, "docs"));
      writeFileSync(join(target, "AGENTS.md"), MAKE_DOCS_ROUTER);
      chmodSync(join(target, "AGENTS.md"), 0o000);
    });
    try {
      const human = await init(dir, ["--make-docs"], { process: stub.port });
      assert.notEqual(human.exit, 0);
      assertOutputMatches(human.stdout, /\nMake Docs: set up\.\n/);
      assertOutputMatches(human.stdout, /Make Docs already ran, so when you run it again, use --skip-make-docs and not --make-docs\./);
      chmodSync(join(dir, "AGENTS.md"), 0o644);
      rmSync(join(dir, "AGENTS.md"));
      rmSync(join(dir, "docs"), { recursive: true });
      const json = await init(dir, ["--make-docs", "--json"], { process: stub.port });
      assert.equal(json.json.result.status, "failed");
      assert.equal(json.json.result.make_docs.status, "set_up");
    } finally {
      if (existsSync(join(dir, "AGENTS.md"))) chmodSync(join(dir, "AGENTS.md"), 0o644);
    }
  });
});

describe("P6-R2-10: a rerun reports the manifest on disk", () => {
  it("in the result and in the dry run", async () => {
    const dir = folder();
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    const manifest = { schema_version: 1, buildos_version: "1.0.0", initialized_at: "2026-01-02T03:04:05.000Z" };
    writeFileSync(join(dir, ".os", "manifest.json"), `${JSON.stringify(manifest)}\n`);
    const done = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(done.exit, 0);
    assertSame(done.json.result.manifest, manifest);
    const dry = await init(dir, ["--skip-make-docs", "--dry-run", "--json"]);
    assertSame(dry.json.result.manifest, manifest);
  });

  it("refuses a rerun manifest that breaks the manifest contract (exit 10)", async () => {
    for (const text of ['{"schema_version":1,"buildos_version":"latest","initialized_at":"2026-01-02T03:04:05Z"}', '{"schema_version":1,"buildos_version":"1.0.0","initialized_at":"1"}']) {
      const dir = folder();
      mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
      writeFileSync(join(dir, ".os", "manifest.json"), text);
      const result = await init(dir, ["--skip-make-docs", "--json"]);
      assert.equal(result.exit, 10, tag(String(text)));
      assertSame(result.json.result.reason, "manifest_problem", tag(String(text)));
    }
  });
});

describe("P6-R2-11: the Make Docs words follow what is on disk and what BuildOS wrote", () => {
  it("in a folder that Make Docs set up first, the no-TTY stop says Make Docs can be set up now or later", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), MAKE_DOCS_ROUTER);
    writeFileSync(join(dir, "CLAUDE.md"), MAKE_DOCS_ROUTER);
    const result = await init(dir, ["--json"]);
    assert.equal(result.exit, 10);
    assertSame(result.json.result.later, "The user can also say no now and set up Make Docs later.");
    const human = await init(dir, []);
    assertOutputDoesNotMatch(human.stdout, /did not write/);
  });

  it("in a folder with the user's own AGENTS.md, it says Make Docs setup will not finish there", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    const result = await init(dir, ["--json"]);
    assertOutputMatches(result.json.result.later, /^This folder already has an AGENTS\.md or CLAUDE\.md file that Make Docs did not write\./);
  });

  it("a Go-era adoption with a failing Make Docs: the tip never says BuildOS added a section, and AGENTS.md keeps every byte", async () => {
    const dir = folder();
    mkdirSync(join(dir, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(dir, "AGENTS.md"), "# Go-era router\n");
    const result = await init(dir, ["--make-docs", "--json"], { process: makeDocs(() => {}, 1).port });
    assert.equal(result.exit, 0);
    assert.equal(result.json.result.status, "partial");
    assertSame(result.json.result.make_docs.tip, "This folder already had its own AGENTS.md or CLAUDE.md. Your files were kept.");
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Go-era router\n");
  });

  it("a new project with the user's own AGENTS.md and a failing Make Docs names the file that got the section", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    const result = await init(dir, ["--make-docs", "--json"], { process: makeDocs(() => {}, 1).port });
    assertSame(result.json.result.make_docs.tip, "This folder already had its own AGENTS.md or CLAUDE.md. Your files were kept, and BuildOS added its section to AGENTS.md.");
  });
});

describe("P6-R2-13: each shown command says which shell it is for", () => {
  it("on Windows, the human text says Command Prompt and the JSON says cmd; elsewhere sh", async () => {
    const dir = folder();
    const win = await init(dir, [], { platform: "win32" });
    assertOutputMatches(win.stdout, /\nIf the user says yes, run this in Command Prompt:\n/);
    assertOutputMatches(win.stdout, /\nIf the user says no, run this in Command Prompt:\n/);
    assertSame((await init(dir, ["--json"], { platform: "win32" })).json.result.shell, "cmd");
    assertSame((await init(dir, ["--json"], { platform: "linux" })).json.result.shell, "sh");
  });
});

describe("P6-R2-16: a link counts as the sibling only when the OS resolves it to that entry", () => {
  it("on POSIX, a CLAUDE.md link whose text is .\\AGENTS.md does not lead to AGENTS.md: stop (exit 10), nothing written", async (t) => {
    if (windows) return t.skip("on Windows a backslash is a separator, so the link does lead to AGENTS.md");
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    if (!trySymlink(".\\AGENTS.md", join(dir, "CLAUDE.md"))) return t.skip("this OS user cannot make a symbolic link");
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 10, shape(result.stdout));
    assertSame(result.json.result.problems[0].path, "CLAUDE.md");
    assertSame(result.json.result.problems[0].problem, "link");
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), "# Mine\n");
    assert.equal(readlinkSync(join(dir, "CLAUDE.md")), ".\\AGENTS.md");
  });

  it("a link with the text ./AGENTS.md is kept, and AGENTS.md gets the section", async (t) => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    if (!trySymlink(`.${sep}AGENTS.md`, join(dir, "CLAUDE.md"))) return t.skip("this OS user cannot make a symbolic link");
    const result = await init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stdout));
    assertSame(result.json.result.shared_files[1], { path: "CLAUDE.md", result: "unchanged", link_to: "AGENTS.md" });
  });
});

describe("P6-R2-17: every read of a user file is one open with a hard bound", () => {
  /** A port whose unbounded reads fail the test. */
  const bounded: FsPortFactory = (root, cwd, options) => {
    const port = createNodeFsPort(root, cwd, options);
    return {
      ...port,
      readBytes: (path) => assert.fail(`unbounded readBytes(${tag(String(path))})`),
      readText: (path) => assert.fail(`unbounded readText(${tag(String(path))})`),
    };
  };

  it("a new project with shared files, an adoption with a wrapper, and a rerun read nothing without a bound", async () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
    assert.equal((await init(dir, ["--skip-make-docs"], { openFs: bounded })).exit, 0);
    assert.equal((await init(dir, ["--skip-make-docs"], { openFs: bounded })).exit, 0);
    const go = folder();
    mkdirSync(join(go, ".os", "scripts"), { recursive: true });
    mkdirSync(join(go, ".os", "data"), { recursive: true }); // P7-R3-07: a Go-era project has .os/data/
    writeFileSync(join(go, ".os", "scripts", "buildos"), "old\n");
    assert.equal((await init(go, ["--skip-make-docs"], { openFs: bounded })).exit, 0);
  });

  it("readFileLimited reads at most the bound from one open, and names a larger file too large", () => {
    const dir = folder();
    writeFileSync(join(dir, "big"), new Uint8Array(11));
    writeFileSync(join(dir, "small"), "0123456789");
    const port = createNodeFsPort(dir, dir);
    assert.deepEqual(port.readFileLimited("big", 10), { tooLarge: true, size: 11 });
    const small = port.readFileLimited("small", 10);
    assert.ok(!small.tooLarge && new TextDecoder().decode(small.data) === "0123456789");
    if (trySymlink("small", join(dir, "link"))) assert.throws(() => port.readFileLimited("link", 10));
  });
});
