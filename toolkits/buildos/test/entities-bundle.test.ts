// W1 R7 P3 t11 and t12, through the packaged binary (the esbuild bundle).
//
// t11: P1 checked root errors only at the dispatcher, through a test domain.
// Here every `entities` command gets a root that cannot be loaded: under a
// folder without search permission (EACCES), below a file (ENOTDIR), a
// symlink loop (ELOOP), and a name too long (ENAMETOOLONG). Each exits 3 and
// its JSON envelope names the given root, as parity exception PE-004 records.
//
// t12: a relative `--root` folds against `$PWD` when `$PWD` names the current
// folder, as Go's `filepath.Abs` does through `os.Getwd`. The goldens come
// from the Go seed (test/fixtures/go-seed/pwd-goldens.json).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../scripts/build.ts";
import { makePwdLayout, PWD_CASES, runPwdCase } from "../scripts/capture-pwd-goldens.ts";
import { loadExceptions, seedWithPrintedCommands } from "./golden/harness.ts";

let dir: string;
let program: string[];

before(
  async () => {
    dir = mkdtempSync(join(tmpdir(), "buildos-p3-bundle-"));
    program = [process.execPath, await bundle({ outfile: join(dir, "buildos.js") })];
  },
  { timeout: 60_000 },
);
after(() => rmSync(dir, { recursive: true, force: true }));

const COMMANDS: { name: string; args: string[] }[] = [
  { name: "resolve", args: ["resolve", "--id", "PER-001"] },
  { name: "validate", args: ["validate"] },
  { name: "consolidate", args: ["consolidate", "--manifest", "manifest.json"] },
  { name: "rebuild-index", args: ["rebuild-index", "--apply"] },
];

function runBundle(args: string[], cwd: string): { exit: number; envelope: { ok: boolean; command: string; root: string; mode: string; diagnostics: { code: string }[] } } {
  const result = spawnSync(program[0]!, [...program.slice(1), ...args], { cwd, encoding: "utf8", env: { ...process.env, PWD: cwd } });
  assert.equal(result.stderr, "", "JSON mode writes nothing to stderr");
  return { exit: result.status ?? -1, envelope: JSON.parse(result.stdout) };
}

describe("entities root errors through the packaged binary (P3 t11, PE-004)", () => {
  let scratch: string;
  const posix = process.platform !== "win32";
  const permissions = { skip: !posix ? "POSIX folder permissions" : process.getuid?.() === 0 ? "running as root ignores folder permissions" : false };
  before(() => {
    scratch = mkdtempSync(join(tmpdir(), "buildos-p3-roots-"));
    mkdirSync(join(scratch, "locked", "root", ".os", "data"), { recursive: true });
    writeFileSync(join(scratch, "afile"), "not a folder\n");
    writeFileSync(join(scratch, "manifest.json"), "{}");
    if (posix) {
      symlinkSync("loop-b", join(scratch, "loop-a"));
      symlinkSync("loop-a", join(scratch, "loop-b"));
      chmodSync(join(scratch, "locked"), 0o000);
    }
  });
  after(() => {
    if (posix) chmodSync(join(scratch, "locked"), 0o755);
    rmSync(scratch, { recursive: true, force: true });
  });

  const roots: { kind: string; given: () => string; code: () => string; options?: { skip: string | boolean } }[] = [
    { kind: "EACCES", given: () => join(scratch, "locked", "root"), code: () => "root_unreadable", options: permissions },
    { kind: "ENOTDIR", given: () => join(scratch, "afile", "root"), code: () => "root_not_found" },
    { kind: "ELOOP", given: () => join(scratch, "loop-a"), code: () => "path_refused", options: { skip: posix ? false : "POSIX symlinks" } },
    // NTFS refuses a 300-character name with ERROR_INVALID_NAME, which libuv reports as ENOENT, so the root reads as missing there.
    { kind: "ENAMETOOLONG", given: () => join(scratch, "n".repeat(300), "root"), code: () => (posix ? "root_unreadable" : "root_not_found") },
  ];

  for (const root of roots) {
    for (const command of COMMANDS) {
      it(`entities ${command.name} with a ${root.kind} root exits 3 and names the given root`, root.options ?? {}, () => {
        const given = root.given();
        const { exit, envelope } = runBundle(["entities", ...command.args, "--root", given, "--mode", "strict", "--json"], scratch);
        assert.equal(exit, 3);
        assert.equal(envelope.ok, false);
        assert.equal(envelope.command, `entities.${command.name}`);
        assert.equal(envelope.root, given);
        assert.equal(envelope.mode, "strict");
        assert.deepEqual(envelope.diagnostics.map((d) => d.code), [root.code()]);
      });
    }
  }
});

describe("a relative --root folds against $PWD, as Go's filepath.Abs (P3 t12)", { skip: process.platform === "win32" ? "Go never reads $PWD on Windows" : false }, () => {
  const goldens = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "go-seed", "pwd-goldens.json"), "utf8")) as {
    goVersion: string;
    cases: { name: string; pwd: string; args: string[]; exit: number; stdout: string; stderr: string }[];
  };

  it("has Go 1.24.1 goldens for every case", () => {
    assert.equal(goldens.goVersion, "go1.24.1");
    assert.deepEqual(
      goldens.cases.map((c) => c.name),
      PWD_CASES.map((c) => c.name),
    );
    assert.match(goldens.cases[0]!.stdout, /"root": "\{LINK\}\/root"/, "the symlinked $PWD spelling is the parity target");
  });

  for (const c of PWD_CASES) {
    it(`${c.name} matches the Go seed byte for byte`, () => {
      const layout = makePwdLayout();
      try {
        // PE-023: Go's printed fix commands in the port's form; every other byte as Go wrote it.
        const golden = seedWithPrintedCommands(c.name, goldens.cases.find((g) => g.name === c.name)!, "pwd", loadExceptions());
        assert.deepEqual(runPwdCase(program, c, layout), { exit: golden.exit, stdout: golden.stdout, stderr: golden.stderr });
      } finally {
        rmSync(layout.scratch, { recursive: true, force: true });
      }
    });
  }
});
