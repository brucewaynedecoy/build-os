import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, closeSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, win32 } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyPathText, createNodeFsPort, createNodeInPlaceWriter, isDevicePathText, isInsideRoot, writeRaceHooks } from "../src/adapters/node-fs.ts";
import { exitCodeFor } from "../src/cli/exit-codes.ts";
import { FsWriteFailure, PathRefusedError, type PathRefusalReason } from "../src/core/shared/errors.ts";
import { inPlaceEffectOf, type FsPort, type InPlaceWritePort } from "../src/core/shared/fs-port.ts";
import { goPathError, goReadFileError } from "../src/core/shared/go-os-error.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const posixOnly = { skip: isWindows ? "POSIX device paths, FIFOs, and symlinks" : false };

let base: string;
let root: string;
let outside: string;
let fs: FsPort;
let writer: InPlaceWritePort;

before(() => {
  base = mkdtempSync(join(tmpdir(), "buildos-fs-port-"));
  root = join(base, "root");
  outside = join(base, "outside");
  mkdirSync(join(root, ".os", "data"), { recursive: true });
  mkdirSync(outside);
  writeFileSync(join(outside, "secret.txt"), "secret");
  fs = createNodeFsPort(root);
  writer = createNodeInPlaceWriter(root);
});

after(() => {
  rmSync(base, { recursive: true, force: true });
});

/** Asserts that `action` throws a PathRefusedError with `reason`, mapped to exit 3. */
/** The error that `action` throws (fails when it does not throw). */
function thrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  assert.fail("expected a throw");
}

function assertRefused(action: () => unknown, reason: PathRefusalReason): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof PathRefusedError, `expected PathRefusedError, got ${String(caught)}`);
  assert.equal(caught.reason, reason, caught.message);
  assert.equal(caught.code, "path_refused");
  assert.equal(exitCodeFor(caught), 3);
}

/** Every port call that takes a target, with that target. */
const callsWith = (port: FsPort, target: unknown): [string, () => unknown][] => {
  const t = target as string;
  return [
    ["readText", () => port.readText(t, 1 << 20)],
    ["readBytes", () => port.readBytes(t, 1 << 20)],
    ["writeFileAtomic", () => port.writeFileAtomic(t, "x")],
    ["rename from", () => port.rename(t, "renamed.txt")],
    ["rename to", () => port.rename(".os/data", t)],
    ["mkdir", () => port.mkdir(t)],
    ["list", () => port.list(t)],
    ["stat", () => port.stat(t)],
    ["exists", () => port.exists(t)],
    ["statStrict", () => port.statStrict(t)],
    ["readDir", () => port.readDir(t)],
    ["writeFileInPlace", () => writer.writeFileInPlace(t, new Uint8Array([120]), 0o644)],
    ["checkInPlaceTarget", () => writer.checkInPlaceTarget(t)],
    ["checkMkdir", () => writer.checkMkdir(t)],
    ["openRead", () => port.openRead(t).close()],
    ["readLink", () => port.readLink(t)],
    ["symlinkAtomic", () => port.symlinkAtomic(t, "target.txt")],
    ["checkWritable", () => port.checkWritable(t)],
  ];
};

describe("node:fs in-place writer (intake output only)", () => {
  it("is not part of the canonical-data port", () => {
    assert.equal("writeFile" in fs, false);
    assert.equal("writeFileInPlace" in fs, false);
    assert.deepEqual(Object.keys(writer), ["writeFileInPlace", "checkInPlaceTarget", "checkMkdir"]);
  });

  it("creates a file and replaces an existing file's bytes", () => {
    mkdirSync(join(root, "in-place"), { recursive: true });
    writer.writeFileInPlace("in-place/new.txt", new Uint8Array([104, 105]), 0o644);
    assert.equal(readFileSync(join(root, "in-place", "new.txt"), "utf8"), "hi");
    writeFileSync(join(root, "in-place", "old.txt"), "a long old body");
    writer.writeFileInPlace("in-place/old.txt", new Uint8Array([110]), 0o644);
    assert.equal(readFileSync(join(root, "in-place", "old.txt"), "utf8"), "n");
  });

  it("says what it did at the name: created, changed, or untouched, also in a thrown error (W1 R7 P9 intake JSON review round 2)", () => {
    mkdirSync(join(root, "effect"), { recursive: true });
    assert.equal(writer.writeFileInPlace("effect/new.txt", new Uint8Array([104]), 0o644), "created");
    assert.equal(writer.writeFileInPlace("effect/new.txt", new Uint8Array([105]), 0o644), "changed");
    // A refusal before the open changes nothing.
    writeFileSync(join(outside, "effect-linked.txt"), "outside body");
    linkSync(join(outside, "effect-linked.txt"), join(root, "effect", "hard-link.txt"));
    const refused = thrown(() => writer.writeFileInPlace("effect/hard-link.txt", new Uint8Array([120]), 0o644));
    assert.ok(refused instanceof PathRefusedError);
    assert.equal(inPlaceEffectOf(refused), "untouched");
    // A failed open (a folder at the name) changes nothing.
    mkdirSync(join(root, "effect", "dir"));
    assert.equal(inPlaceEffectOf(thrown(() => writer.writeFileInPlace("effect/dir", new Uint8Array([120]), 0o644))), "untouched");
    // A write that fails after the open: the new file stays `created`; an existing file truncated is `changed`.
    class Failing extends Uint8Array {
      override get byteLength(): number {
        throw new Error("injected write fault");
      }
    }
    const failedNew = thrown(() => writer.writeFileInPlace("effect/partial.txt", new Failing(1), 0o644));
    assert.ok(failedNew instanceof FsWriteFailure);
    assert.deepEqual([failedNew.fs.step, inPlaceEffectOf(failedNew), existsSync(join(root, "effect", "partial.txt"))], ["write", "created", true]);
    assert.equal(inPlaceEffectOf(thrown(() => writer.writeFileInPlace("effect/new.txt", new Failing(1), 0o644))), "changed");
    assert.equal(readFileSync(join(root, "effect", "new.txt"), "utf8"), "", "the existing file was truncated");
  });

  it("says `created` or `changed` with the step `close` when the close fails after a complete write (W1 R7 P9 intake JSON final check, finding 6)", () => {
    mkdirSync(join(root, "close-fault"), { recursive: true });
    writeFileSync(join(root, "close-fault", "old.txt"), "old body");
    writeRaceHooks.afterStep = () => {
      throw Object.assign(new Error("EIO: injected close fault"), { code: "EIO", syscall: "close" });
    };
    try {
      for (const [name, effect] of [["new.txt", "created"], ["old.txt", "changed"]] as const) {
        const failed = thrown(() => writer.writeFileInPlace(`close-fault/${name}`, new Uint8Array([104, 105]), 0o644));
        assert.ok(failed instanceof FsWriteFailure, name);
        assert.deepEqual([failed.fs.step, failed.fs.errno, inPlaceEffectOf(failed)], ["close", "EIO", effect], name);
        assert.equal(readFileSync(join(root, "close-fault", name), "utf8"), "hi", `${name}: the write was complete before the close`);
      }
    } finally {
      delete writeRaceHooks.afterStep;
    }
  });

  it("without overwrite, never opens an entry at the name, also one that appears before the exclusive create (W1 R7 P9 intake JSON final check, finding 1)", () => {
    mkdirSync(join(root, "no-overwrite"), { recursive: true });
    writeFileSync(join(root, "no-overwrite", "there.txt"), "another program");
    const seen = thrown(() => writer.writeFileInPlace("no-overwrite/there.txt", new Uint8Array([120]), 0o644, { overwrite: false }));
    assert.ok(seen instanceof FsWriteFailure);
    assert.deepEqual([seen.fs.step, seen.fs.errno, inPlaceEffectOf(seen)], ["open", "EEXIST", "untouched"]);
    assert.equal(readFileSync(join(root, "no-overwrite", "there.txt"), "utf8"), "another program");
    // Another program makes the file between the check and the O_EXCL open.
    writeRaceHooks.beforeOpen = (step, entry) => {
      if (step === "in-place") writeFileSync(entry, "another program");
    };
    try {
      const raced = thrown(() => writer.writeFileInPlace("no-overwrite/raced.txt", new Uint8Array([120]), 0o644, { overwrite: false }));
      assert.ok(raced instanceof FsWriteFailure);
      assert.deepEqual([raced.fs.step, raced.fs.errno, inPlaceEffectOf(raced)], ["open", "EEXIST", "untouched"]);
      assert.equal(readFileSync(join(root, "no-overwrite", "raced.txt"), "utf8"), "another program", "the collision is not tried again as an overwrite");
    } finally {
      writeRaceHooks.beforeOpen = undefined;
    }
    // The default still writes an existing file in place.
    assert.equal(writer.writeFileInPlace("no-overwrite/there.txt", new Uint8Array([120]), 0o644), "changed");
  });

  it("gives the identity of the file it opened: the same for one file, different for two (W1 R7 P9 intake JSON final check, finding 5)", () => {
    mkdirSync(join(root, "identity"), { recursive: true });
    const ids: string[] = [];
    const opened = (id: string) => ids.push(id);
    writer.writeFileInPlace("identity/a.txt", new Uint8Array([97]), 0o644, { opened });
    writer.writeFileInPlace("identity/a.txt", new Uint8Array([98]), 0o644, { opened });
    writer.writeFileInPlace("identity/b.txt", new Uint8Array([99]), 0o644, { opened });
    assert.equal(ids.length, 3);
    assert.equal(ids[0], ids[1]);
    assert.notEqual(ids[0], ids[2]);
  });

  it("says `changed` when it replaced a link at the name (W1 R7 P9 intake JSON review round 2)", posixOnly, () => {
    mkdirSync(join(root, "effect-link"), { recursive: true });
    symlinkSync(join(outside, "effect-missing.txt"), join(root, "effect-link", "twin.md"));
    assert.equal(writer.writeFileInPlace("effect-link/twin.md", new Uint8Array([120]), 0o644), "changed");
    assert.equal(lstatSync(join(root, "effect-link", "twin.md")).isFile(), true);
  });

  it("refuses a file with a second hard link, before it truncates anything", () => {
    mkdirSync(join(root, "in-place"), { recursive: true });
    writeFileSync(join(outside, "linked.txt"), "outside body");
    linkSync(join(outside, "linked.txt"), join(root, "in-place", "hard-link.txt"));
    assertRefused(() => writer.writeFileInPlace("in-place/hard-link.txt", new Uint8Array([120]), 0o644), "special-file");
    assert.equal(readFileSync(join(outside, "linked.txt"), "utf8"), "outside body");
  });

  it("replaces a symlink at the file, never follows it, and keeps the file it points at (PRD 20, PE-010)", posixOnly, () => {
    mkdirSync(join(root, "in-place"), { recursive: true });
    writeFileSync(join(root, "in-place", "inside-target.txt"), "inside");
    const links: [string, string][] = [
      ["out-link.txt", join(outside, "secret.txt")],
      ["in-link.txt", "inside-target.txt"],
      ["dangling-link.txt", join(outside, "made-by-follow.txt")],
      ["loop-link.txt", "loop-link.txt"],
    ];
    for (const [name, target] of links) {
      symlinkSync(target, join(root, "in-place", name));
      writer.writeFileInPlace(`in-place/${name}`, new Uint8Array([120]), 0o644);
      assert.equal(lstatSync(join(root, "in-place", name)).isFile(), true, name);
      assert.equal(readFileSync(join(root, "in-place", name), "utf8"), "x", name);
    }
    assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "secret");
    assert.equal(readFileSync(join(root, "in-place", "inside-target.txt"), "utf8"), "inside");
    assert.equal(existsSync(join(outside, "made-by-follow.txt")), false);
  });

  it("refuses a write into a folder outside the root, unless the writer allows it through a link", posixOnly, () => {
    mkdirSync(join(outside, "linked-dir"), { recursive: true });
    symlinkSync(join(outside, "linked-dir"), join(root, "dir-link"));
    assertRefused(() => writer.writeFileInPlace("dir-link/x.txt", new Uint8Array([120]), 0o644), "outside-root");
    assertRefused(() => writer.writeFileInPlace(join(outside, "x.txt"), new Uint8Array([120]), 0o644), "outside-root");
    assert.equal(existsSync(join(outside, "linked-dir", "x.txt")), false);
    const allowed = createNodeInPlaceWriter(root, process.cwd(), { allowOutsideRoot: true });
    allowed.writeFileInPlace("dir-link/x.txt", new Uint8Array([121]), 0o644);
    assert.equal(readFileSync(join(outside, "linked-dir", "x.txt"), "utf8"), "y");
    // A path spelled outside the root, a device, and a link at the file to a device stay refused.
    assertRefused(() => allowed.writeFileInPlace(join(outside, "x.txt"), new Uint8Array([120]), 0o644), "outside-root");
    assertRefused(() => allowed.writeFileInPlace("/dev/null", new Uint8Array([120]), 0o644), "device-path");
    symlinkSync("/dev/null", join(root, "in-place", "null-link.txt"));
    assertRefused(() => allowed.writeFileInPlace("in-place/null-link.txt", new Uint8Array([120]), 0o644), "device-path");
    assertRefused(() => allowed.writeFileInPlace(1 as unknown as string, new Uint8Array([120]), 0o644), "file-descriptor");
  });

  it("preflight: reports the open error the write would get, and changes nothing (review round 3)", posixOnly, () => {
    const folder = join(root, "in-place", "probe");
    mkdirSync(join(folder, "dir"), { recursive: true });
    writeFileSync(join(folder, "read-only.txt"), "kept");
    chmodSync(join(folder, "read-only.txt"), 0o444);
    writeFileSync(join(folder, "plain.txt"), "plain body");
    const before = statSync(join(folder, "plain.txt"));
    const failure = (action: () => unknown): FsWriteFailure => {
      try {
        action();
      } catch (error) {
        assert.ok(error instanceof FsWriteFailure, String(error));
        return error;
      }
      assert.fail("expected an FsWriteFailure");
    };
    assert.equal(failure(() => writer.checkInPlaceTarget("in-place/probe/dir")).fs.errno, "EISDIR");
    const asRoot = typeof process.getuid === "function" && process.getuid() === 0;
    if (!asRoot) assert.equal(failure(() => writer.checkInPlaceTarget("in-place/probe/read-only.txt")).fs.errno, "EACCES");
    writer.checkInPlaceTarget("in-place/probe/plain.txt");
    writer.checkInPlaceTarget("in-place/probe/new.txt");
    writer.checkInPlaceTarget("in-place/probe/missing/new.txt");
    writer.checkMkdir("in-place/probe/new-dir");
    assert.equal(readFileSync(join(folder, "plain.txt"), "utf8"), "plain body");
    assert.equal(statSync(join(folder, "plain.txt")).mtimeMs, before.mtimeMs);
    assert.equal(existsSync(join(folder, "new.txt")), false);
    assert.equal(existsSync(join(folder, "new-dir")), false);
    chmodSync(folder, 0o555);
    try {
      if (!asRoot) {
        assert.equal(failure(() => writer.checkInPlaceTarget("in-place/probe/new.txt")).fs.errno, "EACCES");
        assert.equal(failure(() => writer.checkMkdir("in-place/probe/new-dir")).fs.errno, "EACCES");
      }
    } finally {
      chmodSync(folder, 0o755);
    }
    assertRefused(() => writer.checkMkdir(join(outside, "made")), "outside-root");
    assert.equal(existsSync(join(outside, "made")), false);
  });

  it("refuses a folder and a FIFO", posixOnly, () => {
    mkdirSync(join(root, "in-place", "dir"), { recursive: true });
    assert.throws(() => writer.writeFileInPlace("in-place/dir", new Uint8Array([120]), 0o644));
    assert.equal(spawnSync("mkfifo", [join(root, "in-place", "pipe")]).status, 0);
    assertRefused(() => writer.writeFileInPlace("in-place/pipe", new Uint8Array([120]), 0o644), "special-file");
  });
});

/**
 * A folder swapped between the checks of a write and its open (or rename).
 * `writeRaceHooks.beforeOpen` runs right before the open: it moves the real
 * folder away and puts a symlink to a folder outside the root in its place.
 */
describe("node:fs writes with a folder swapped after the checks", () => {
  let swaps = 0;
  /** Makes `<root>/<name>` a fresh folder and returns a swap that replaces it with a link to a fresh outside folder. */
  const raceFolder = (name: string): { inside: string; target: string; swap: () => void } => {
    const inside = join(root, name);
    const target = join(outside, `${name}-target-${++swaps}`);
    mkdirSync(inside, { recursive: true });
    mkdirSync(target, { recursive: true });
    return {
      inside,
      target,
      swap: () => {
        renameSync(inside, `${inside}.moved`);
        symlinkSync(target, inside);
      },
    };
  };
  const once = (step: "in-place" | "temp" | "rename" | "new" | "read", action: () => void): void => {
    writeRaceHooks.beforeOpen = (current) => {
      if (current !== step) return;
      writeRaceHooks.beforeOpen = undefined;
      action();
    };
  };
  after(() => {
    writeRaceHooks.beforeOpen = undefined;
  });

  it("in place, new file: refuses, and leaves no file in the outside folder", posixOnly, () => {
    const race = raceFolder("race-new");
    once("in-place", race.swap);
    assertRefused(() => writer.writeFileInPlace("race-new/twin.md", new Uint8Array([120]), 0o644), "outside-root");
    assert.deepEqual(readdirSync(race.target), []);
    assert.deepEqual(readdirSync(`${race.inside}.moved`), []);
  });

  it("in place, existing file: refuses before it truncates, and the outside file keeps its bytes", posixOnly, () => {
    const race = raceFolder("race-old");
    writeFileSync(join(race.inside, "twin.md"), "inside body");
    writeFileSync(join(race.target, "twin.md"), "outside body");
    once("in-place", race.swap);
    assertRefused(() => writer.writeFileInPlace("race-old/twin.md", new Uint8Array([120]), 0o644), "outside-root");
    assert.equal(readFileSync(join(race.target, "twin.md"), "utf8"), "outside body");
    assert.equal(readFileSync(join(`${race.inside}.moved`, "twin.md"), "utf8"), "inside body");
  });

  it("in place, with allowOutsideRoot: a folder swapped after the check is still refused", posixOnly, () => {
    const race = raceFolder("race-allowed");
    const allowed = createNodeInPlaceWriter(root, process.cwd(), { allowOutsideRoot: true });
    once("in-place", race.swap);
    assertRefused(() => allowed.writeFileInPlace("race-allowed/twin.md", new Uint8Array([120]), 0o644), "outside-root");
    assert.deepEqual(readdirSync(race.target), []);
  });

  it("in place: a file swapped for a symlink after the check is never followed", posixOnly, () => {
    mkdirSync(join(root, "race-link"), { recursive: true });
    writeFileSync(join(root, "race-link", "twin.md"), "inside body");
    writeFileSync(join(outside, "race-link-secret.txt"), "secret");
    once("in-place", () => {
      rmSync(join(root, "race-link", "twin.md"));
      symlinkSync(join(outside, "race-link-secret.txt"), join(root, "race-link", "twin.md"));
    });
    assert.throws(() => writer.writeFileInPlace("race-link/twin.md", new Uint8Array([120]), 0o644));
    assert.equal(readFileSync(join(outside, "race-link-secret.txt"), "utf8"), "secret");
  });

  it("atomic write, temporary file: refuses, and leaves no temporary file in the outside folder", posixOnly, () => {
    const race = raceFolder("race-temp");
    once("temp", race.swap);
    assertRefused(() => fs.writeFileAtomic("race-temp/data.json", "{}"), "outside-root");
    assert.deepEqual(readdirSync(race.target), []);
    assert.deepEqual(readdirSync(`${race.inside}.moved`), []);
  });

  it("atomic write, rename: nothing lands in the outside folder", posixOnly, () => {
    const race = raceFolder("race-rename");
    once("rename", race.swap);
    assert.throws(() => fs.writeFileAtomic("race-rename/data.json", "{}"));
    assert.deepEqual(readdirSync(race.target), []);
  });

  it("exclusive create: refuses, and leaves no file in the outside folder (P4 and P5 merge)", posixOnly, () => {
    const race = raceFolder("race-excl");
    once("new", race.swap);
    assertRefused(() => fs.writeNewFile("race-excl/run.md", "x"), "outside-root");
    assert.deepEqual(readdirSync(race.target), []);
    assert.deepEqual(readdirSync(`${race.inside}.moved`), []);
  });

  it("atomic symlink: refuses before the rename when the folder is swapped (P4 and P5 merge)", posixOnly, () => {
    const race = raceFolder("race-link-put");
    once("rename", race.swap);
    assertRefused(() => fs.symlinkAtomic("race-link-put/index.jsonl", "elsewhere.jsonl"), "outside-root");
    assert.deepEqual(readdirSync(race.target), []);
    // The moved folder keeps at most the temporary link, never the index name.
    assert.equal(readdirSync(`${race.inside}.moved`).includes("index.jsonl"), false);
  });

  // P4-P5 merge fix round, finding 3: the rollback of a refused symlink put
  // never removes an entry through a changed folder. The replacement folder
  // holds an entry with the temporary link's name; it must stay, and the
  // temporary link stays in the moved folder, named in the refusal.
  for (const replacement of ["a link to an outside folder", "another folder"] as const) {
    it(`atomic symlink: a folder replaced by ${replacement} keeps its entry with the temporary link's name`, posixOnly, () => {
      const name = replacement === "another folder" ? "race-link-same-dir" : "race-link-same";
      const race = raceFolder(name);
      let tempName = "";
      let holder = "";
      once("rename", () => {
        tempName = readdirSync(race.inside).find((entry) => entry.startsWith(".index.jsonl.link-")) ?? "";
        renameSync(race.inside, `${race.inside}.moved`);
        if (replacement === "another folder") {
          mkdirSync(race.inside);
          holder = race.inside;
        } else {
          symlinkSync(race.target, race.inside);
          holder = race.target;
        }
        writeFileSync(join(holder, tempName), "not ours");
      });
      assert.throws(
        () => fs.symlinkAtomic(`${name}/index.jsonl`, "elsewhere.jsonl"),
        (error: unknown) => error instanceof PathRefusedError && error.reason === "outside-root" && error.message.includes(`${tempName} was left in place`),
      );
      assert.notEqual(tempName, "", "the hook saw the temporary link");
      assert.equal(lstatSync(join(holder, tempName)).isFile(), true);
      assert.equal(readFileSync(join(holder, tempName), "utf8"), "not ours");
      assert.deepEqual(readdirSync(holder), [tempName]);
      // The temporary link is still in the moved folder: the cleanup was skipped, not sent elsewhere.
      assert.equal(lstatSync(join(`${race.inside}.moved`, tempName)).isSymbolicLink(), true);
    });
  }

  // P4-P5 merge fix round 2: an empty replacement folder has no entry with
  // the temporary link's name. The cleanup checks the folder first, so it
  // removes nothing and the refusal names the link left in the moved folder.
  it("atomic symlink: a folder replaced by an empty folder names the temporary link left in place", posixOnly, () => {
    const name = "race-link-empty";
    const race = raceFolder(name);
    let tempName = "";
    once("rename", () => {
      tempName = readdirSync(race.inside).find((entry) => entry.startsWith(".index.jsonl.link-")) ?? "";
      renameSync(race.inside, `${race.inside}.moved`);
      mkdirSync(race.inside);
    });
    assert.throws(
      () => fs.symlinkAtomic(`${name}/index.jsonl`, "elsewhere.jsonl"),
      (error: unknown) => error instanceof PathRefusedError && error.reason === "outside-root" && error.message.includes(`the temporary link ${tempName} was left in place`),
    );
    assert.notEqual(tempName, "", "the hook saw the temporary link");
    assert.deepEqual(readdirSync(race.inside), []);
    assert.equal(lstatSync(join(`${race.inside}.moved`, tempName)).isSymbolicLink(), true);
  });

  it("rename: refuses when a folder is swapped after the checks", posixOnly, () => {
    const race = raceFolder("race-move");
    writeFileSync(join(root, "race-move-source.txt"), "moved body");
    once("rename", race.swap);
    assertRefused(() => fs.rename("race-move-source.txt", "race-move/dest.txt"), "outside-root");
    assert.deepEqual(readdirSync(race.target), []);
    assert.equal(readFileSync(join(root, "race-move-source.txt"), "utf8"), "moved body");
  });

  // W1 R7 P7 review round 1 (P7-R1-04): the bounded read checks its folder after the open too.
  it("bounded read: refuses when the folder is swapped for a link out of the root after the check, and returns no outside byte", posixOnly, () => {
    const race = raceFolder("race-read");
    writeFileSync(join(race.inside, "notes.md"), "inside body");
    writeFileSync(join(race.target, "notes.md"), "outside secret");
    once("read", race.swap);
    assertRefused(() => fs.readFileLimited("race-read/notes.md", 1024), "outside-root");
  });

  it("bounded read: also with allowOutsideRoot, a read is never let out of the root", posixOnly, () => {
    const race = raceFolder("race-read-allowed");
    writeFileSync(join(race.inside, "notes.md"), "inside body");
    writeFileSync(join(race.target, "notes.md"), "outside secret");
    const allowed = createNodeFsPort(root, process.cwd(), { allowOutsideRoot: true });
    once("read", race.swap);
    assertRefused(() => allowed.readFileLimited("race-read-allowed/notes.md", 1024), "outside-root");
  });

  it("bounded read: an unchanged folder reads as before", () => {
    mkdirSync(join(root, "read-plain"), { recursive: true });
    writeFileSync(join(root, "read-plain", "notes.md"), "plain body");
    const read = fs.readFileLimited("read-plain/notes.md", 1024);
    assert.equal(read.tooLarge, false);
    assert.equal(Buffer.from((read as { data: Uint8Array }).data).toString("utf8"), "plain body");
  });
});

describe("node:fs filesystem port with allowOutsideRoot (--allow-outside-root)", () => {
  it("lets a path inside the root as spelled resolve outside through a link, and keeps every other refusal", posixOnly, () => {
    mkdirSync(join(outside, "port-dir"), { recursive: true });
    symlinkSync(join(outside, "port-dir"), join(root, "port-link"));
    assertRefused(() => fs.mkdir("port-link/sub"), "outside-root");
    const open = createNodeFsPort(root, process.cwd(), { allowOutsideRoot: true });
    open.mkdir("port-link/sub");
    assert.equal(existsSync(join(outside, "port-dir", "sub")), true);
    assertRefused(() => open.mkdir(join(outside, "spelled")), "outside-root");
    assertRefused(() => open.readText("/dev/stdin", 1 << 20), "device-path");
    assertRefused(() => open.readText(0 as unknown as string, 1 << 20), "file-descriptor");
    assert.equal(spawnSync("mkfifo", [join(outside, "port-dir", "pipe")]).status, 0);
    assertRefused(() => open.stat("port-link/pipe"), "special-file");
    // A content read stays inside the root in every mode (P5 review round 2).
    assertRefused(() => open.readText("port-link/pipe", 1 << 20), "outside-root");
  });
});

describe("node:fs filesystem port", () => {
  it("binds to the real root", () => {
    assert.equal(fs.root, realpathSync.native(root));
    // Already canonical: no symlink and, on Windows, no 8.3 short name left.
    assert.equal(realpathSync.native(fs.root), fs.root);
  });

  it("writes atomically, reads, renames, lists, and stats inside the root", () => {
    fs.mkdir("a/b");
    fs.writeFileAtomic("a/b/one.txt", "first");
    fs.writeFileAtomic("a/b/one.txt", "second");
    fs.writeFileAtomic(join(root, "a", "two.bin"), new Uint8Array([1, 2, 3]));
    assert.equal(fs.readText("a/b/one.txt", 1 << 20), "second");
    assert.deepEqual([...fs.readBytes("a/two.bin", 1 << 20)], [1, 2, 3]);
    fs.rename("a/b/one.txt", "a/b/three.txt");
    assert.deepEqual(fs.list("a/b"), ["three.txt"]);
    assert.deepEqual(fs.list("a"), ["b", "two.bin"]);
    assert.equal(fs.stat("a")?.kind, "directory");
    assert.equal(fs.stat("a/two.bin")?.size, 3);
    assert.equal(fs.stat("missing"), undefined);
    assert.equal(fs.exists("a/b/three.txt"), true);
    assert.equal(fs.exists("a/b/one.txt"), false);
    // No temporary file is left behind.
    assert.deepEqual(readdirSync(join(root, "a", "b")), ["three.txt"]);
  });

  it("replaces a symlink at the target and keeps the sibling it points at, as Go's os.Rename", posixOnly, () => {
    writeFileSync(join(root, "real.txt"), "old");
    symlinkSync(join(root, "real.txt"), join(root, "inner-link.txt"));
    fs.writeFileAtomic("inner-link.txt", "new");
    assert.equal(readFileSync(join(root, "real.txt"), "utf8"), "old");
    assert.equal(lstatSync(join(root, "inner-link.txt")).isFile(), true);
    assert.equal(readFileSync(join(root, "inner-link.txt"), "utf8"), "new");
  });

  it("creates the temporary file in the folder of the path as given, not of the symlink target", posixOnly, () => {
    mkdirSync(join(root, "elsewhere"));
    writeFileSync(join(root, "elsewhere", "target.txt"), "old");
    symlinkSync(join("elsewhere", "target.txt"), join(root, "here-link.txt"));
    fs.writeFileAtomic("here-link.txt", "new", { tempPrefix: ".probe-", tempSuffix: ".tmp" });
    assert.deepEqual(readdirSync(join(root, "elsewhere")), ["target.txt"]);
    assert.equal(readFileSync(join(root, "elsewhere", "target.txt"), "utf8"), "old");
    assert.equal(readFileSync(join(root, "here-link.txt"), "utf8"), "new");
  });

  it("refuses a read or a following write through a symlink at the target that resolves outside the root", posixOnly, () => {
    symlinkSync(join(outside, "secret.txt"), join(root, "secret-link.txt"));
    assertRefused(() => fs.readText("secret-link.txt", 1 << 20), "outside-root");
    assertRefused(() => fs.mkdir("secret-link.txt"), "outside-root");
    assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "secret");
    assert.equal(lstatSync(join(root, "secret-link.txt")).isSymbolicLink(), true);
    // A dangling symlink that points outside the root is refused too.
    symlinkSync(join(outside, "no-such.txt"), join(root, "dangling-out.txt"));
    assertRefused(() => fs.readText("dangling-out.txt", 1 << 20), "outside-root");
    assert.equal(existsSync(join(outside, "no-such.txt")), false);
  });

  it("replaces, never follows, a symlink to outside the root at an atomic-write target, as Go's os.Rename (P5 review round 1)", posixOnly, () => {
    symlinkSync(join(outside, "secret.txt"), join(root, "replace-link.txt"));
    fs.writeFileAtomic("replace-link.txt", "local");
    assert.equal(lstatSync(join(root, "replace-link.txt")).isFile(), true);
    assert.equal(readFileSync(join(root, "replace-link.txt"), "utf8"), "local");
    assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "secret");
    // A dangling one is replaced too; nothing is created outside.
    symlinkSync(join(outside, "never.txt"), join(root, "replace-dangling.txt"));
    fs.writeFileAtomic("replace-dangling.txt", "local");
    assert.equal(lstatSync(join(root, "replace-dangling.txt")).isFile(), true);
    assert.equal(existsSync(join(outside, "never.txt")), false);
    // O_EXCL never follows the link: EEXIST, and nothing is written outside.
    symlinkSync(join(outside, "never.txt"), join(root, "excl-dangling.txt"));
    assert.throws(() => fs.writeNewFile("excl-dangling.txt", "x"), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "EEXIST");
    assert.equal(existsSync(join(outside, "never.txt")), false);
  });

  it("refuses a write through a symlinked folder that leads outside the root, unless allowOutsideRoot (PE-012)", posixOnly, () => {
    symlinkSync(outside, join(root, "pe012-out"));
    const outsideBefore = readdirSync(outside).sort();
    for (const call of [
      () => fs.writeFileAtomic("pe012-out/a.txt", "x"),
      () => fs.writeNewFile("pe012-out/a.txt", "x"),
      () => writer.writeFileInPlace("pe012-out/a.txt", new Uint8Array([120]), 0o644),
      () => fs.mkdir("pe012-out/sub"),
    ]) {
      assertRefused(call, "outside-root");
    }
    assert.deepEqual(readdirSync(outside).sort(), outsideBefore);
    const open = createNodeFsPort(root, process.cwd(), { allowOutsideRoot: true });
    open.writeFileAtomic("pe012-out/a.txt", "atomic");
    open.writeNewFile("pe012-out/b.txt", "new");
    assert.equal(readFileSync(join(outside, "a.txt"), "utf8"), "atomic");
    assert.equal(readFileSync(join(outside, "b.txt"), "utf8"), "new");
    // Every other refusal stays: a path spelled outside the root, and a device path.
    assertRefused(() => open.writeFileAtomic("../outside/c.txt", "x"), "outside-root");
    assertRefused(() => open.writeFileAtomic("/dev/null", "x"), "device-path");
    rmSync(join(outside, "a.txt"));
    rmSync(join(outside, "b.txt"));
  });

  it("streams a copy with openRead and an iterable writeNewFile, and removes the new file when the source read fails", () => {
    const big = new Uint8Array(3 * 1024 * 1024 + 7).map((_, i) => i % 251);
    writeFileSync(join(root, "stream-src.bin"), big);
    const input = fs.openRead("stream-src.bin");
    function* chunks(): Generator<Uint8Array> {
      for (;;) {
        const chunk = input.read(1024 * 1024);
        if (chunk.length === 0) return;
        yield chunk;
      }
    }
    fs.writeNewFile("stream-dst.bin", chunks());
    input.close();
    input.close();
    assert.deepEqual(new Uint8Array(readFileSync(join(root, "stream-dst.bin"))), big);
    const failing = (function* (): Generator<Uint8Array> {
      yield new Uint8Array([1, 2, 3]);
      throw new PathRefusedError("outside-root", "planted read failure");
    })();
    assert.throws(() => fs.writeNewFile("stream-fail.bin", failing), PathRefusedError);
    assert.equal(existsSync(join(root, "stream-fail.bin")), false);
    assert.throws(() => fs.openRead("no-such-stream.bin"), (error: unknown) => (error as { fs?: { errno?: string; syscall?: string } }).fs?.errno === "ENOENT");
  });

  it("removes one file, link, or empty folder, never recursively and never through a link", posixOnly, () => {
    mkdirSync(join(root, "rm-dir", "inner"), { recursive: true });
    writeFileSync(join(root, "rm-dir", "inner", "f.txt"), "f");
    symlinkSync(join(outside, "secret.txt"), join(root, "rm-link"));
    fs.remove("rm-link");
    assert.equal(existsSync(join(root, "rm-link")), false);
    assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "secret");
    assert.throws(() => fs.remove("rm-dir/inner"));
    fs.remove("rm-dir/inner/f.txt");
    fs.remove("rm-dir/inner");
    assert.deepEqual(readdirSync(join(root, "rm-dir")), []);
    assertRefused(() => fs.remove("../outside/secret.txt"), "outside-root");
  });

  for (const [label, options] of [
    ["a prefix with /", { tempPrefix: "../escape-" }],
    ["a prefix with a backslash", { tempPrefix: "a\\b-" }],
    ["a prefix with ..", { tempPrefix: "..x" }],
    ["a prefix with NUL", { tempPrefix: "a\u0000" }],
    ["a suffix with /", { tempSuffix: "/x.tmp" }],
    ["a suffix with :", { tempSuffix: ":stream" }],
  ] as const) {
    it(`refuses a temporary name with ${label}`, () => {
      assertRefused(() => fs.writeFileAtomic("temp-check.txt", "x", options), "not-a-path");
      assert.equal(existsSync(join(root, "temp-check.txt")), false);
    });
  }

  it("refuses a temporary name that is a Windows device name", () => {
    assertRefused(() => fs.writeFileAtomic("temp-check.txt", "x", { tempPrefix: "CON", tempSuffix: "" }), "device-path");
    assertRefused(() => fs.writeFileAtomic("temp-check.txt", "x", { tempPrefix: "nul.", tempSuffix: ".tmp" }), "device-path");
  });

  it("names the temporary file <prefix><decimal uint32><suffix> in the target's folder", () => {
    mkdirSync(join(root, "temp-name"));
    const names: string[] = [];
    const probe = createNodeFsPort(root);
    // A file in the way at the target turns the rename into a failure that reports the name.
    mkdirSync(join(root, "temp-name", "busy"));
    writeFileSync(join(root, "temp-name", "busy", "x"), "");
    try {
      probe.writeFileAtomic("temp-name/busy", "x", { tempPrefix: ".probe-", tempSuffix: ".tmp" });
    } catch (error) {
      names.push((error as { fs?: { tempName?: string } }).fs?.tempName ?? "");
    }
    assert.match(names[0] ?? "", /^\.probe-[0-9]{1,10}\.tmp$/);
    assert.ok(Number(/[0-9]+/.exec(names[0]!)![0]) <= 0xffffffff);
    assert.deepEqual(readdirSync(join(root, "temp-name")), ["busy"]);
  });

  for (const fd of [0, 1, 2, 3, 1n]) {
    it(`refuses file descriptor ${String(fd)} in every call`, () => {
      for (const [name, call] of callsWith(fs, fd)) {
        assertRefused(call, "file-descriptor");
        assert.ok(name);
      }
    });
  }

  for (const [label, target] of [
    ["a Buffer", Buffer.from("x.txt")],
    ["a file URL object", pathToFileURL("/tmp/x.txt")],
    ["an empty string", ""],
    ["a NUL byte", "a\0b"],
    ["undefined", undefined],
  ] as const) {
    it(`refuses ${label} as a path`, () => {
      for (const [, call] of callsWith(fs, target)) assertRefused(call, "not-a-path");
    });
  }

  for (const target of [
    "/dev/stdout",
    "/dev/stderr",
    "/dev/fd/1",
    "/dev/tty",
    "/dev/null",
    "/proc/self/fd/1",
    "/sys/kernel",
    "/tmp/../dev/stdout",
    "//dev/stdout",
    "file:///dev/stdout",
    "\\\\.\\CON",
    "\\\\?\\C:\\x",
    "CON",
    "con.txt",
    "NUL",
    "sub/aux.md",
    "COM1",
    "LPT9.log",
    "CONOUT$",
    "conin$",
  ]) {
    // On Windows, `//dev/stdout` is the UNC share `\\dev\stdout`: a normal
    // path, refused because it is outside the root.
    const reason: PathRefusalReason = isWindows && target === "//dev/stdout" ? "outside-root" : "device-path";
    it(`refuses the device or special path ${JSON.stringify(target)} in every call (${reason})`, () => {
      for (const [, call] of callsWith(fs, target)) assertRefused(call, reason);
    });
  }

  it("reads device path text with POSIX rules on POSIX", () => {
    for (const text of ["/dev/stdout", "//dev/stdout", "///proc/self/fd/1", "\\\\dev\\stdout", "\\dev\\null", "/a/../../sys/x", "//dev", "\\\\.\\CON", "sub/nul.txt"]) {
      assert.equal(classifyPathText(text, "posix"), "device-path", text);
    }
  });

  it("reads device path text with Windows rules on Windows", () => {
    for (const text of ["/dev/null", "\\dev\\null", "/tmp/../dev/stdout", "/proc/self/fd/1", "\\sys\\x", "\\\\.\\CON", "//./pipe/x", "\\\\?\\C:\\x", "C:\\work\\NUL.txt", "file:///C:/x", "CONOUT$"]) {
      assert.equal(classifyPathText(text, "win32"), "device-path", text);
    }
    assert.equal(classifyPathText("C:\\work\\a.txt:stream", "win32"), "special-file");
    // A UNC path is a normal path on Windows, even on a host named `dev`.
    for (const text of ["\\\\server\\share\\..\\..\\sys\\file", "\\\\dev\\share\\notes.md", "//dev/stdout", "\\\\dev\\stdout", "C:\\dev\\null", "C:\\work\\a.txt"]) {
      assert.equal(classifyPathText(text, "win32"), undefined, text);
    }
  });

  it("does not read a UNC server or share as a device name on Windows", () => {
    // The Win32 path parser never reads a UNC server or share as a device
    // name, so a host such as `aux.example.org` or `nul`, and a share named
    // `CON`, name a remote server and share. Below the share, the BuildOS
    // rule (device names refused in any folder) still applies.
    for (const text of [
      "//aux.example.org/team/notes",
      "\\\\aux.example.org\\team\\notes",
      "//con.example.org/team/notes",
      "\\\\con.example.org\\team\\notes",
      "\\\\dev\\share\\notes.md",
      "\\\\nul\\share\\notes.md",
      "\\\\server\\CON\\notes.md",
      "//server/con.txt/notes.md",
      "\\\\server\\\\share\\notes.md",
    ]) {
      assert.equal(classifyPathText(text, "win32"), undefined, text);
    }
    // A device name below the share is still refused, and so are the
    // `\\.\` and `\\?\` device namespaces.
    for (const text of [
      "\\\\server\\share\\CON",
      "//aux.example.org/team/nul.txt",
      "\\\\nul\\share\\sub\\aux.md",
      "\\\\server\\CON\\com1",
      "\\\\.\\CON",
      "//?/UNC/server/share/x",
      "\\\\?\\UNC\\aux.example.org\\team\\notes",
    ]) {
      assert.equal(classifyPathText(text, "win32"), "device-path", text);
    }
    // On POSIX, `//aux.example.org/...` is the folder `/aux.example.org`,
    // which the device-name rule refuses on every platform.
    assert.equal(classifyPathText("//aux.example.org/team/notes", "posix"), "device-path");
  });

  it("reads ///dev/stdout, ///proc/self, and //sys as drive-rooted Windows paths, decided by containment", () => {
    // Owner Decisions, 2026-11-23: no UNC share, so Windows reads each as
    // rooted on the current drive, an ordinary path, not a device.
    const cases: [string, string][] = [
      ["///dev/stdout", "C:\\dev\\stdout"],
      ["///proc/self", "C:\\proc\\self"],
      ["//sys", "C:\\sys"],
    ];
    for (const [text, onDisk] of cases) {
      assert.notEqual(classifyPathText(text, "win32"), "device-path", text);
      assert.equal(classifyPathText(text, "win32"), undefined, text);
      const absolute = win32.resolve("C:\\work\\root", text);
      assert.equal(absolute, onDisk);
      // Outside the root: refused by containment.
      assert.equal(isInsideRoot("C:\\work\\root", absolute, "win32"), false, text);
      // Allowed only when it is genuinely inside the root.
      assert.equal(isInsideRoot("C:\\", absolute, "win32"), true, text);
    }
    assert.equal(isInsideRoot("C:\\dev", win32.resolve("C:\\dev", "///dev/stdout"), "win32"), true);
    assert.equal(isInsideRoot("C:\\dev", win32.resolve("C:\\dev", "//sys"), "win32"), false);
  });

  it("checks containment with Windows rules: UNC share, case, and drive", () => {
    const share = "\\\\server\\share";
    // Windows folds `..` as text and stops at the share root.
    const climbed = win32.resolve(`${share}\\..\\..\\sys\\file`);
    assert.equal(climbed, `${share}\\sys\\file`);
    assert.equal(isInsideRoot(share, climbed, "win32"), true);
    assert.equal(isInsideRoot(`${share}\\root`, win32.resolve(`${share}\\root`, "..\\..\\x"), "win32"), false);
    assert.equal(isInsideRoot(`${share}\\root`, "\\\\server\\other\\root\\x", "win32"), false);
    assert.equal(isInsideRoot("\\\\dev\\share\\root", "\\\\dev\\share\\root\\a.md", "win32"), true);
    assert.equal(isInsideRoot("C:\\Work\\Root", "c:\\work\\root\\a.md", "win32"), true);
    assert.equal(isInsideRoot("C:\\work\\root", "D:\\work\\root\\a.md", "win32"), false);
    assert.equal(isInsideRoot("/work/root", "/work/rootx/a.md", "posix"), false);
    assert.equal(isInsideRoot("/work/root", "/work/root/a.md", "posix"), true);
  });

  it("refuses UNC paths outside the root on Windows, by containment", { skip: isWindows ? false : "Windows UNC paths" }, () => {
    for (const target of [
      "\\\\server\\share\\..\\..\\sys\\file",
      "\\\\dev\\share\\notes.md",
      "\\\\dev\\stdout",
      "//aux.example.org/team/notes",
      "\\\\con.example.org\\team\\notes",
      "\\\\nul\\share\\notes.md",
      "\\\\server\\CON\\notes.md",
    ]) {
      for (const [, call] of callsWith(fs, target)) assertRefused(call, "outside-root");
    }
  });

  it("refuses ///dev/stdout, ///proc/self, and //sys outside the root on Windows, by containment", { skip: isWindows ? false : "Windows drive-rooted paths" }, () => {
    for (const target of ["///dev/stdout", "///proc/self", "//sys"]) {
      for (const [, call] of callsWith(fs, target)) assertRefused(call, "outside-root");
    }
  });

  it("refuses a POSIX-spelled device root on every platform, before it is resolved", () => {
    for (const given of ["/dev/null", "/dev/stdout", "/proc/self", "\\\\.\\NUL"]) {
      assertRefused(() => createNodeFsPort(given), "device-path");
      assertRefused(() => createNodeFsPort(given, root), "device-path");
    }
  });

  it("does not treat names that only start like a device as devices", () => {
    for (const name of ["console.md", "content.txt", "nullable.ts", "auxiliary", "com10", "docs/dev/notes.md", "dev/stdout"]) {
      assert.equal(isDevicePathText(name), false, name);
    }
  });

  for (const target of ["../outside/secret.txt", "../../x", "a/../../outside", "/etc/hosts"]) {
    it(`refuses ${JSON.stringify(target)}, outside the root`, () => {
      for (const [, call] of callsWith(fs, target)) assertRefused(call, "outside-root");
    });
  }

  it("refuses an absolute path outside the root", () => {
    assertRefused(() => fs.readText(join(outside, "secret.txt"), 1 << 20), "outside-root");
  });

  it("refuses a symlink inside the root that points to /dev/stdout", posixOnly, () => {
    symlinkSync("/dev/stdout", join(root, "stdout-link"));
    for (const [, call] of callsWith(fs, "stdout-link")) assertRefused(call, "device-path");
  });

  it("refuses a symlink inside the root that points to /dev/fd/1", posixOnly, () => {
    symlinkSync("/dev/fd/1", join(root, "fd1-link"));
    for (const [, call] of callsWith(fs, "fd1-link")) assertRefused(call, "device-path");
  });

  it("refuses a chain of symlinks inside the root that ends at /dev/stdout", posixOnly, () => {
    symlinkSync("/dev/stdout", join(root, "chain-end"));
    symlinkSync("chain-end", join(root, "chain-start"));
    for (const [, call] of callsWith(fs, "chain-start")) assertRefused(call, "device-path");
  });

  it("refuses a relative symlink that climbs out to /dev/stdout", posixOnly, () => {
    const depth = realpathSync.native(root).split("/").length;
    symlinkSync(`${"../".repeat(depth + 2)}dev/stdout`, join(root, "climb-link"));
    for (const [, call] of callsWith(fs, "climb-link")) assertRefused(call, "device-path");
  });

  it("refuses a path under a symlinked folder that points into /dev", posixOnly, () => {
    symlinkSync("/dev", join(root, "dev-dir-link"));
    for (const [, call] of callsWith(fs, "dev-dir-link/stdout")) assertRefused(call, "device-path");
  });

  it("refuses a root that is a symlink to /dev/stdout", posixOnly, () => {
    const link = join(base, "root-to-stdout");
    symlinkSync("/dev/stdout", link);
    assertRefused(() => createNodeFsPort(link), "device-path");
  });

  it("reads a dangling symlink inside the root as missing and replaces it on write, as Go", posixOnly, () => {
    symlinkSync(join(root, "nothing-here"), join(root, "dangling-link"));
    assert.throws(() => fs.readText("dangling-link", 1 << 20), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "ENOENT");
    assert.equal(fs.stat("dangling-link"), undefined);
    fs.writeFileAtomic("dangling-link", "x");
    assert.equal(lstatSync(join(root, "dangling-link")).isFile(), true);
    assert.equal(readFileSync(join(root, "dangling-link"), "utf8"), "x");
    assert.equal(existsSync(join(root, "nothing-here")), false);
  });

  it("reports a symlink loop inside the root as the OS error ELOOP", posixOnly, () => {
    symlinkSync("loop-self", join(root, "loop-self"));
    assert.throws(() => fs.readBytes("loop-self", 1 << 20), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "ELOOP");
  });

  it("follows a relative symlink before .., as the OS does", posixOnly, () => {
    mkdirSync(join(root, "sub", "inner"), { recursive: true });
    symlinkSync(join("sub", "inner"), join(root, "up"));
    // The OS reads `up/..` as `sub`, not as the root.
    fs.writeFileAtomic("up/../dotdot.txt", "x");
    assert.equal(readFileSync(join(root, "sub", "dotdot.txt"), "utf8"), "x");
    assert.equal(existsSync(join(root, "dotdot.txt")), false);
    assert.equal(fs.readText("up/../dotdot.txt", 1 << 20), "x");
  });

  it("refuses a symlink chain followed by .. that the OS resolves into /dev", posixOnly, () => {
    // `s1/../dev/null` reads as `<root>/dev/null` if `..` is folded as text,
    // but the OS follows s1 -> s2 -> / first, so it opens /dev/null.
    symlinkSync("/", join(root, "s2"));
    symlinkSync("s2", join(root, "s1"));
    for (const [, call] of callsWith(fs, "s1/../dev/null")) assertRefused(call, "device-path");
    // The same climb hidden inside a link target.
    symlinkSync("s1/../dev/null", join(root, "hidden-null"));
    for (const [, call] of callsWith(fs, "hidden-null")) assertRefused(call, "device-path");
    assert.equal(existsSync(join(root, "dev")), false);
  });

  it("refuses .. after a missing folder", posixOnly, () => {
    // Windows folds `..` as text before it touches the disk, so there this
    // path is `<root>\\x.txt`, inside the root.
    for (const [, call] of callsWith(fs, "no-such-folder/../x.txt")) assertRefused(call, "outside-root");
  });

  it("refuses a symlink to a folder outside the root, and files under it", posixOnly, () => {
    symlinkSync(outside, join(root, "out-link"));
    assertRefused(() => fs.readText("out-link/secret.txt", 1 << 20), "outside-root");
    assertRefused(() => fs.writeFileAtomic("out-link/new.txt", "x"), "outside-root");
    assertRefused(() => fs.list("out-link"), "outside-root");
    assert.equal(existsSync(join(outside, "new.txt")), false);
  });

  it("accepts an absolute alias outside the root whose real path is inside it", posixOnly, () => {
    // Owner Decisions, 2026-11-23: containment is checked on the real path
    // the OS resolves, so writes still land inside the root.
    const alias = join(base, "alias-to-root");
    symlinkSync(root, alias);
    fs.writeFileAtomic(join(alias, "via-alias.txt"), "aliased");
    assert.equal(readFileSync(join(root, "via-alias.txt"), "utf8"), "aliased");
    assert.equal(fs.readText(join(alias, "via-alias.txt"), 1 << 20), "aliased");
    assert.equal(fs.stat(join(alias, ".os", "data"))?.kind, "directory");
    // An alias whose real path is outside the root is refused.
    const outAlias = join(base, "alias-to-outside");
    symlinkSync(outside, outAlias);
    assertRefused(() => fs.readText(join(outAlias, "secret.txt"), 1 << 20), "outside-root");
    assertRefused(() => fs.writeFileAtomic(join(outAlias, "new.txt"), "x"), "outside-root");
    assert.equal(existsSync(join(outside, "new.txt")), false);
  });

  it("refuses a FIFO inside the root", posixOnly, () => {
    const made = spawnSync("mkfifo", [join(root, "pipe")]);
    if (made.status !== 0) return;
    assertRefused(() => fs.readText("pipe", 1 << 20), "special-file");
    assertRefused(() => fs.writeFileAtomic("pipe", "x"), "special-file");
  });

  it("refuses a device or special root", () => {
    assertRefused(() => createNodeFsPort("/dev"), "device-path");
    assertRefused(() => createNodeFsPort(1 as unknown as string), "not-a-path");
  });

  it("writes nothing to stdout when core-style code aims the port at the standard streams", posixOnly, () => {
    const dir = mkdtempSync(join(tmpdir(), "buildos-fs-port-child-"));
    try {
      symlinkSync("/dev/stdout", join(dir, "link"));
      const adapter = pathToFileURL(join(packageRoot, "src", "adapters", "node-fs.ts")).href;
      const script = [
        `const { createNodeFsPort } = await import(${JSON.stringify(adapter)});`,
        `const fs = createNodeFsPort(${JSON.stringify(dir)});`,
        "const reasons = [];",
        `for (const target of [1, 2, "/dev/stdout", "/dev/fd/1", "link"]) {`,
        "  try { fs.writeFileAtomic(target, 'LEAK'); reasons.push('written'); } catch (error) { reasons.push(error.name === 'PathRefusedError' ? error.reason : String(error)); }",
        "}",
        "process.stderr.write(reasons.join(','));",
      ].join("\n");
      const expected = "file-descriptor,file-descriptor,device-path,device-path,device-path";
      // The child's stdout is a pipe, as on CI: on Linux, /dev/stdout then
      // resolves to pipe:[n], not to a device path.
      const piped = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      assert.equal(piped.status, 0, piped.stderr);
      assert.equal(piped.stdout, "");
      assert.equal(piped.stderr, expected);
      // The child's stdout is a regular file inside the root: on Linux,
      // /dev/stdout then resolves to that file, which the port would accept.
      const outPath = join(dir, "stdout.txt");
      const out = openSync(outPath, "w");
      try {
        const toFile = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", stdio: ["ignore", out, "pipe"] });
        assert.equal(toFile.status, 0, toFile.stderr);
        assert.equal(toFile.stderr, expected);
      } finally {
        closeSync(out);
      }
      assert.equal(readFileSync(outPath, "utf8"), "");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("allowOutsideRoot covers writes only, and resolution retries when a missing folder appears (P5 review round 2)", () => {
  it("refuses every content read through a symlinked folder that leads outside the root, with the option on", posixOnly, () => {
    symlinkSync(outside, join(root, "r2-out"));
    const open = createNodeFsPort(root, process.cwd(), { allowOutsideRoot: true });
    const reads: [string, () => unknown][] = [
      ["readText", () => open.readText("r2-out/secret.txt", 1 << 20)],
      ["readBytes", () => open.readBytes("r2-out/secret.txt", 1 << 20)],
      ["openRead", () => open.openRead("r2-out/secret.txt").close()],
      ["list", () => open.list("r2-out")],
      ["readLink", () => open.readLink("r2-out/secret.txt")],
    ];
    for (const [, call] of reads) assertRefused(call, "outside-root");
    // The same reads refuse with the option off, and through a symlink at the target too.
    for (const [, call] of callsWith(fs, "r2-out/secret.txt").filter(([name]) => ["readText", "readBytes", "openRead", "readLink"].includes(name))) assertRefused(call, "outside-root");
    symlinkSync(join(outside, "secret.txt"), join(root, "r2-secret-link.txt"));
    assertRefused(() => open.readText("r2-secret-link.txt", 1 << 20), "outside-root");
    assertRefused(() => open.openRead("r2-secret-link.txt").close(), "outside-root");
    // Writes and the metadata a write needs still follow the link (PE-012).
    assert.equal(open.stat("r2-out")?.kind, "directory");
    open.writeFileAtomic("r2-out/r2.txt", "atomic");
    assert.equal(readFileSync(join(outside, "r2.txt"), "utf8"), "atomic");
    rmSync(join(outside, "r2.txt"));
  });

  it("reads and puts back a symlink atomically: readLink and symlinkAtomic", posixOnly, () => {
    writeFileSync(join(root, "r2-plain.txt"), "plain");
    assert.equal(fs.readLink("r2-plain.txt"), undefined);
    fs.symlinkAtomic("r2-plain.txt", "elsewhere/target.txt");
    assert.equal(lstatSync(join(root, "r2-plain.txt")).isSymbolicLink(), true);
    assert.equal(fs.readLink("r2-plain.txt")?.target, "elsewhere/target.txt");
    // A link to outside the root is stored as given: nothing is written there.
    fs.symlinkAtomic("r2-plain.txt", join(outside, "never.txt"));
    assert.equal(fs.readLink("r2-plain.txt")?.target, join(outside, "never.txt"));
    assert.equal(existsSync(join(outside, "never.txt")), false);
    assert.deepEqual(readdirSync(root).filter((name) => name.includes(".link-")), []);
    assertRefused(() => fs.symlinkAtomic("../outside/x.txt", "y"), "outside-root");
  });

  it("puts a symlink back with its own mode whatever the umask, where the OS keeps link modes (review round 3)", posixOnly, () => {
    for (const [createUmask, restoreUmask] of [
      [0o077, 0o022],
      [0o022, 0o077],
    ] as const) {
      const name = `r3-link-${createUmask.toString(8)}`;
      const previous = process.umask(createUmask);
      try {
        symlinkSync("elsewhere/target.txt", join(root, name));
      } finally {
        process.umask(previous);
      }
      const original = fs.readLink(name)!;
      assert.equal(original.target, "elsewhere/target.txt");
      assert.equal(original.mode, lstatSync(join(root, name)).mode & 0o7777);
      rmSync(join(root, name));
      writeFileSync(join(root, name), "replacement");
      process.umask(restoreUmask);
      try {
        fs.symlinkAtomic(name, original.target, { mode: original.mode });
      } finally {
        process.umask(previous);
      }
      // macOS keeps a link's mode (0777 minus the umask at creation); Linux
      // links are always 0777, so both sides are 0777 there.
      assert.deepEqual(fs.readLink(name), original, `umask ${createUmask.toString(8)} then ${restoreUmask.toString(8)}`);
      if (process.platform === "darwin") assert.equal(original.mode, 0o777 & ~createUmask);
    }
  });

  it("checks that a regular file is writable with no change: checkWritable (review round 3)", posixOnly, () => {
    writeFileSync(join(root, "r3-ro.jsonl"), "row\n");
    chmodSync(join(root, "r3-ro.jsonl"), 0o444);
    const isRoot = process.getuid?.() === 0;
    try {
      if (isRoot) fs.checkWritable("r3-ro.jsonl");
      else {
        assert.throws(
          () => fs.checkWritable("r3-ro.jsonl"),
          (error: unknown) => error instanceof FsWriteFailure && error.fs.errno === "EACCES" && error.fs.syscall === "open",
        );
      }
      assert.equal(readFileSync(join(root, "r3-ro.jsonl"), "utf8"), "row\n");
      assert.equal(statSync(join(root, "r3-ro.jsonl")).mode & 0o777, 0o444);
      // A writable file, a missing entry, and a symlink are not refused.
      chmodSync(join(root, "r3-ro.jsonl"), 0o644);
      fs.checkWritable("r3-ro.jsonl");
      fs.checkWritable("r3-missing.jsonl");
      symlinkSync(join(outside, "secret.txt"), join(root, "r3-link.jsonl"));
      chmodSync(join(outside, "secret.txt"), 0o444);
      fs.checkWritable("r3-link.jsonl");
      chmodSync(join(outside, "secret.txt"), 0o644);
      assert.equal(readFileSync(join(root, "r3-ro.jsonl"), "utf8"), "row\n");
      assert.equal(existsSync(join(root, "r3-missing.jsonl")), false);
    } finally {
      chmodSync(join(root, "r3-ro.jsonl"), 0o644);
    }
  });

  it("resolves again when a missing folder is created during the walk: mkdir gets EEXIST, not a refusal", posixOnly, async () => {
    const nodeFs = (await import("node:fs")).default as unknown as { realpathSync: { native: (path: string) => string } };
    mkdirSync(join(root, "r2-race"));
    const original = nodeFs.realpathSync.native;
    let planted = false;
    nodeFs.realpathSync.native = (target: string) => {
      if (!planted && target.endsWith(join("r2-race", "a"))) {
        planted = true;
        mkdirSync(join(root, "r2-race", "a", "b"), { recursive: true });
        throw Object.assign(new Error(`ENOENT: no such file or directory, realpath '${target}'`), { code: "ENOENT", syscall: "realpath" });
      }
      return original(target);
    };
    try {
      assert.throws(() => fs.mkdir("r2-race/a/b", { recursive: false }), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "EEXIST");
    } finally {
      nodeFs.realpathSync.native = original;
    }
    assert.ok(planted, "the planted race ran");
  });
});

describe("Go's text for a folder opened for writing (W1 R7 P4-5 Windows CI fix)", () => {
  it("fails the probe and the in-place write of a folder with EISDIR from open, on every OS, and keeps the folder", () => {
    // Node on Windows opens a folder for writing; Go there fails with EISDIR.
    mkdirSync(join(root, "eisdir-probe", "dir"), { recursive: true });
    for (const action of [
      () => writer.checkInPlaceTarget("eisdir-probe/dir"),
      () => writer.writeFileInPlace("eisdir-probe/dir", new Uint8Array([120]), 0o644),
      () => writer.checkInPlaceTarget("eisdir-probe/dir/"),
    ]) {
      assert.throws(action, (error: unknown) => error instanceof FsWriteFailure && error.fs?.errno === "EISDIR" && error.fs.syscall === "open");
    }
    assert.deepEqual(readdirSync(join(root, "eisdir-probe", "dir")), []);
  });

  it("is Go's own EISDIR for an open on every OS, and the Win32 text for a read on Windows", () => {
    // Go 1.24.1 syscall.Open on Windows turns ERROR_ACCESS_DENIED on a folder
    // opened for writing into its EISDIR, "is a directory" (zerrors_windows.go).
    for (const platform of ["darwin", "linux", "win32"] as const) {
      assert.equal(goPathError("open", "a", { errno: "EISDIR", syscall: "open" }, platform), "open a: is a directory");
    }
    assert.equal(goPathError("read", "a", { errno: "EISDIR", syscall: "read" }, "win32"), "read a: Incorrect function.");
    assert.equal(goPathError("read", "a", { errno: "EISDIR", syscall: "read" }, "linux"), "read a: is a directory");
  });
});

/**
 * W1 R7 P7 review round 2 (P7-R2-02): every content read has a size bound,
 * and the Make Docs design inputs are read inside the root with only an
 * in-root link followed.
 */
describe("bounded reads (P7-R2-02)", () => {
  let root: string;
  let outside: string;
  before(() => {
    const work = realpathSync(mkdtempSync(join(tmpdir(), "buildos-bounded-")));
    root = join(work, "root");
    outside = join(work, "outside");
    mkdirSync(root);
    mkdirSync(outside);
    writeFileSync(join(outside, "secret.txt"), "outside");
  });

  it("readBytes and readText read a file of exactly the limit and refuse one byte more with EFBIG and the limit", () => {
    const fs = createNodeFsPort(root);
    writeFileSync(join(root, "ten.txt"), "0123456789");
    assert.equal(fs.readText("ten.txt", 10), "0123456789");
    assert.deepEqual([...fs.readBytes("ten.txt", 10)].length, 10);
    for (const read of [() => fs.readBytes("ten.txt", 9), () => fs.readText("ten.txt", 9)]) {
      assert.throws(read, (error: unknown) => (error as { fs?: { errno?: string; limit?: number } }).fs?.errno === "EFBIG" && (error as { fs: { limit: number } }).fs.limit === 9);
    }
    assert.equal(fs.readText("ten.txt", 1 << 20), "0123456789");
    writeFileSync(join(root, "empty.txt"), "");
    assert.equal(fs.readBytes("empty.txt", 0).length, 0);
  });

  it("a large sparse file is refused from its size, before any byte is read", () => {
    const fs = createNodeFsPort(root);
    const fd = openSync(join(root, "sparse.bin"), "w");
    closeSync(fd);
    // 3 GiB: past Node's own 2 GiB readFile limit, so only the bound can answer.
    spawnSync(process.execPath, ["-e", `require("fs").truncateSync(${JSON.stringify(join(root, "sparse.bin"))}, 3 * 1024 ** 3)`]);
    assert.equal(statSync(join(root, "sparse.bin")).size, 3 * 1024 ** 3);
    assert.throws(() => fs.readBytes("sparse.bin", 128 * 1024 * 1024), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "EFBIG");
    rmSync(join(root, "sparse.bin"));
  });

  it("a folder fails as Go's read does (EISDIR), and the limit must be a whole number", () => {
    const fs = createNodeFsPort(root);
    mkdirSync(join(root, "folder"), { recursive: true });
    assert.throws(() => fs.readBytes("folder", 100), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "EISDIR");
    assert.throws(() => fs.readBytes("ten.txt", Number.NaN), /a read limit must be a whole number of bytes/);
  });

  it("the Go text names the bound in plain words", () => {
    assert.equal(goReadFileError("/p/a.json", { errno: "EFBIG", limit: 128 * 1024 * 1024 }), "read /p/a.json: file too large: BuildOS reads at most 128 MiB from one such file");
    assert.equal(goReadFileError("/p/a", { errno: "ENOENT", syscall: "open" }, "linux"), "open /p/a: no such file or directory");
  });

  it("readFileLimited with followLinkInRoot reads a link to a regular file inside the root, refuses one out of the root, and treats a dangling one as missing", { skip: isWindows ? "symlinks need a privilege on Windows" : false }, () => {
    const fs = createNodeFsPort(root);
    writeFileSync(join(root, "body.md"), "# Body\n");
    symlinkSync(join(root, "body.md"), join(root, "in-link.md"));
    symlinkSync(join(outside, "secret.txt"), join(root, "out-link.md"));
    symlinkSync(join(root, "missing.md"), join(root, "dangling.md"));
    const read = fs.readFileLimited("in-link.md", 100, { followLinkInRoot: true });
    assert.equal(read.tooLarge, false);
    assert.equal(Buffer.from((read as { data: Uint8Array }).data).toString(), "# Body\n");
    assertRefused(() => fs.readFileLimited("out-link.md", 100, { followLinkInRoot: true }), "outside-root");
    assert.throws(() => fs.readFileLimited("dangling.md", 100, { followLinkInRoot: true }), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "ENOENT");
    // Without the option, a link at the name is never followed.
    assert.throws(() => fs.readFileLimited("in-link.md", 100), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "ELOOP");
    // A link to a folder inside the root is not a file.
    mkdirSync(join(root, "sub"), { recursive: true });
    symlinkSync(join(root, "sub"), join(root, "folder-link.md"));
    assert.throws(() => fs.readFileLimited("folder-link.md", 100, { followLinkInRoot: true }), (error: unknown) => (error as { fs?: { errno?: string } }).fs?.errno === "EISDIR");
  });
});
