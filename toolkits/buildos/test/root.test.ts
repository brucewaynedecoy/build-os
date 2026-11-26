import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { isCoreError, PathRefusedError } from "../src/core/shared/errors.ts";
import type { Domain } from "../src/cli/domain.ts";
import { run } from "../src/cli/run.ts";
import { captureIo } from "./helpers.ts";
import { resolveDefaultRoot, resolveEntityRoot, rootAsGiven } from "../src/core/shared/root.ts";
import { goClean } from "../src/core/shared/go-path.ts";
import { createNodeFsPort as openFs } from "../src/adapters/node-fs.ts";
import { exitCodeFor } from "../src/cli/exit-codes.ts";

/** Root spellings from Go 1.24.1; see `source` in the fixture. */
const rootGoldens = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "go-seed", "root-spelling.json"), "utf8")) as {
  cwd: string;
  posixAbs: { in: string; out: string }[];
  windowsClean: { in: string; out: string }[];
  windowsAbsolute: { in: string; out: string }[];
};

let project: string;
let nested: string;

before(() => {
  project = mkdtempSync(join(tmpdir(), "buildos-root-"));
  mkdirSync(join(project, ".os", "data"), { recursive: true });
  nested = join(project, "workspace", "runs", "deep");
  mkdirSync(nested, { recursive: true });
});

after(() => {
  rmSync(project, { recursive: true, force: true });
});

describe("default root model", () => {
  it("uses the current folder from a nested folder and never the parent's .os/", () => {
    const result = resolveDefaultRoot({ cwd: nested, openFs });
    assert.equal(result.root, nested);
    assert.equal(result.hasOsFolder, false);
    assert.equal(result.fs.root, realpathSync.native(nested));
  });

  it("finds .os/ when the current folder is the project root", () => {
    const result = resolveDefaultRoot({ cwd: project, openFs });
    assert.equal(result.root, project);
    assert.equal(result.hasOsFolder, true);
  });

  it("lets --root win, folded as Go's filepath.Abs folds it", () => {
    const result = resolveDefaultRoot({ cwd: nested, root: "../../..", openFs });
    // The root is reported as the Go seed spells it; the port binds the real path.
    assert.equal(result.root, project);
    assert.equal(result.fs.root, realpathSync.native(project));
    assert.equal(result.hasOsFolder, true);
    assert.equal(resolveDefaultRoot({ cwd: nested, root: "", openFs }).root, nested);
  });
});

describe("entity root model", () => {
  it("accepts an explicit root whose .os/data/ exists", () => {
    const result = resolveEntityRoot(project, nested, openFs);
    assert.equal(result.root, project);
    assert.equal(result.fs.root, realpathSync.native(project));
  });

  it("refuses a nested folder and does not infer the parent root", () => {
    let caught: unknown;
    try {
      resolveEntityRoot(nested, project, openFs);
    } catch (error) {
      caught = error;
    }
    if (caught === undefined) assert.fail("expected resolveEntityRoot to throw");
    assert.equal(isCoreError(caught) && caught.code, "root_not_found");
    assert.equal(exitCodeFor(caught), 3);
  });

  it("refuses an empty root", () => {
    assert.throws(() => resolveEntityRoot("  ", nested, openFs), { message: /an explicit --root is required/ });
  });
});

describe("root as given", () => {
  for (const given of ["/dev/null", "/dev/stdout"]) {
    it(`refuses the device root ${given} on every platform, before it is resolved`, () => {
      let caught: unknown;
      try {
        resolveEntityRoot(given, nested, openFs);
      } catch (error) {
        caught = error;
      }
      assert.ok(caught instanceof PathRefusedError, String(caught));
      assert.equal(caught.reason, "device-path");
      assert.throws(() => resolveDefaultRoot({ cwd: nested, root: given, openFs }), PathRefusedError);
    });
  }

  it("reports the given root, not its real path, in a refusal envelope", { skip: process.platform === "win32" ? "symlinks need privileges on Windows" : false }, async () => {
    const link = join(project, "..", `${project.split(/[\\/]/).pop()}-link`);
    symlinkSync(project, link);
    try {
      const domain: Domain = {
        name: "escape",
        summary: "Test-only port refusal",
        help: "Usage:\n  buildos escape\n",
        run(args, context) {
          context.setCommand("escape.read");
          const { fs } = resolveEntityRoot(args[0]!, nested, context.openFs);
          return { command: "escape.read", json: true, result: fs.readText("../outside.txt", 1 << 20) };
        },
      };
      const io = captureIo(nested);
      const code = await run(["escape", link, "--json"], io, { domains: [domain], buildInfo: { version: "dev", sourceRevision: "unknown" } });
      assert.equal(code, 3);
      const envelope = JSON.parse(io.stdout()) as { root: string; diagnostics: { message: string }[] };
      assert.equal(envelope.root, link);
      assert.notEqual(realpathSync.native(link), link);
      assert.ok(envelope.diagnostics.some((diagnostic) => diagnostic.message.includes(`outside the root ${link}`)), JSON.stringify(envelope.diagnostics));
    } finally {
      rmSync(link, { force: true });
    }
  });
});

describe("root spelling", () => {
  it("folds a root as Go's filepath.Abs does, by text only", () => {
    assert.equal(rootAsGiven("../x", "/work/cwd", "posix"), "/work/x");
    assert.equal(rootAsGiven("./a/./b/", "/work/cwd/", "posix"), "/work/cwd/a/b");
    assert.equal(rootAsGiven("link/..", "/work", "posix"), "/work");
    assert.equal(rootAsGiven("/abs/link/..", "/work", "posix"), "/abs");
    assert.equal(rootAsGiven("..\\x", "C:\\work", "win32"), "C:\\x");
    assert.equal(rootAsGiven("D:\\abs\\..", "C:\\work", "win32"), "D:\\");
    assert.equal(rootAsGiven("\\\\server\\share\\r", "C:\\work", "win32"), "\\\\server\\share\\r");
    // A final `..` that reaches the UNC root drops the separator after the share.
    assert.equal(rootAsGiven("\\\\server\\share\\..\\..", "C:\\work", "win32"), "\\\\server\\share");
    assert.equal(rootAsGiven("\\dev\\x", "C:\\work", "win32"), "C:\\dev\\x");
    assert.equal(rootAsGiven("/x", "\\\\server\\share\\work", "win32"), "\\\\server\\share\\x");
    assert.equal(rootAsGiven("c:x", "C:\\work", "win32"), "C:\\work\\x");
    assert.equal(rootAsGiven("D:x", "C:\\work", "win32"), "D:\\x");
    assert.equal(rootAsGiven("a//b/", "C:\\work", "win32"), "C:\\work\\a\\b");
    // GetFullPathNameW drops a single trailing dot from a folder name, and trailing dots and spaces at the end.
    assert.equal(rootAsGiven("a.\\b. .", "C:\\work", "win32"), "C:\\work\\a\\b");
    assert.equal(rootAsGiven("a..\\b", "C:\\work", "win32"), "C:\\work\\a..\\b");
    assert.equal(rootAsGiven("x\\...\\y", "C:\\work", "win32"), "C:\\work\\x\\...\\y");
    assert.equal(rootAsGiven("a \\b", "C:\\work", "win32"), "C:\\work\\a \\b");
    assert.equal(rootAsGiven("a .\\b", "C:\\work", "win32"), "C:\\work\\a \\b");
    assert.equal(rootAsGiven("a. \\b", "C:\\work", "win32"), "C:\\work\\a. \\b");
    assert.equal(rootAsGiven("...", "C:\\work", "win32"), "C:\\work");
    assert.equal(rootAsGiven("", "C:\\work", "win32"), "C:\\work");
    assert.equal(rootAsGiven("", "/work", "posix"), "/work");
  });

  it("matches Go's filepath.Abs (POSIX) for every golden case", () => {
    for (const { in: given, out } of rootGoldens.posixAbs) {
      assert.equal(rootAsGiven(given, rootGoldens.cwd, "posix"), out, JSON.stringify(given));
    }
  });

  it("matches Go's filepath.Clean (Windows rules) for every golden case", () => {
    for (const { in: given, out } of rootGoldens.windowsClean) {
      assert.equal(goClean(given, "win32"), out, JSON.stringify(given));
    }
  });

  it("matches Go's Windows filepath.Abs for already-absolute golden paths", () => {
    // For these paths GetFullPathNameW folds as Clean does, so Go's Abs is the Clean golden.
    assert.ok(rootGoldens.windowsAbsolute.length > 0);
    for (const { in: given, out } of rootGoldens.windowsAbsolute) {
      assert.equal(rootAsGiven(given, "C:\\work", "win32"), out, JSON.stringify(given));
    }
  });

  it("matches the documented GetFullPathNameW results for trailing dots, spaces, devices, and UNC roots", () => {
    // Real GetFullPathNameW output, run from drive D: (Jeremy Kuhne, "Path
    // Normalization", Microsoft, 2016). Go's Abs is Clean of that output.
    const documented: [string, string][] = [
      ["C:\\Foo\\ ", "C:\\Foo\\"],
      ["C:\\Foo\\ . . .", "C:\\Foo\\"],
      ["C:\\Foo\\.", "C:\\Foo"],
      ["C:\\Foo\\ \\", "C:\\Foo\\ \\"],
      ["C:\\Foo\\ . . .\\", "C:\\Foo\\ . . \\"],
      ["C:\\Foo\\a.\\", "C:\\Foo\\a\\"],
      ["C:\\Foo\\a. \\", "C:\\Foo\\a. \\"],
      ["C:\\Foo\\a..\\", "C:\\Foo\\a..\\"],
      ["C:\\Foo\\.\\", "C:\\Foo\\"],
      ["C:\\Foo\\..\\", "C:\\"],
      ["\\\\LOCALHOST\\Share\\Foo\\..\\", "\\\\LOCALHOST\\Share\\"],
      ["C:\\Foo\\..\\..\\", "C:\\"],
      ["\\\\LOCALHOST\\Share\\Foo\\..\\..\\", "\\\\LOCALHOST\\Share\\"],
      ["C:\\..", "C:\\"],
      ["\\\\LOCALHOST\\Share\\..", "\\\\LOCALHOST\\Share"],
      ["\\\\?\\C:\\Foo\\..\\..", "\\\\?\\"],
      ["\\\\.\\C:\\Foo\\..\\..", "\\\\.\\"],
      ["\\Foo", "D:\\Foo"],
      ["C:/Foo/", "C:\\Foo\\"],
      ["C://\\Foo/", "C:\\Foo\\"],
      ["//.", "\\\\.\\"],
      ["//?", "\\\\?\\"],
      ["//LOCALHOST/Share/..", "\\\\LOCALHOST\\Share"],
      ["///LOCALHOST/Share/..", "\\\\\\LOCALHOST"],
      ["////LOCALHOST/Share/..", "\\\\\\LOCALHOST"],
    ];
    for (const [given, full] of documented) {
      assert.equal(rootAsGiven(given, "D:\\projects", "win32"), goClean(full, "win32"), JSON.stringify(given));
    }
  });

  it("parses the UNC server and an empty share before it collapses separators (W1 R7 P3 t13)", () => {
    // GetFullPathNameW reads `\\\\foo\\\\bar` as server `foo`, an empty share,
    // and `bar` below it, so `..` folds to `\\\\foo\\`; Go's Clean keeps it.
    assert.equal(rootAsGiven("//foo//bar/..", "C:\\work", "win32"), "\\\\foo\\");
    assert.equal(rootAsGiven("\\\\foo\\\\bar\\..", "C:\\work", "win32"), "\\\\foo\\");
    assert.equal(rootAsGiven("//foo/bar/..", "C:\\work", "win32"), "\\\\foo\\bar");
    // An empty server still takes a run of separators as one (documented `////LOCALHOST`).
    assert.equal(rootAsGiven("////LOCALHOST/Share/..", "C:\\work", "win32"), "\\\\\\LOCALHOST");
  });

  it("indexes by UTF-16 code unit, so astral characters fold as Go folds them", () => {
    // Regression: the UNC volume end was a code unit index, but the
    // GetFullPathNameW port split by code point, so `..` ate the separator.
    assert.equal(rootAsGiven("\\\\files\\📁\\a\\..\\reports", "C:\\work", "win32"), "\\\\files\\📁\\reports");
    assert.equal(rootAsGiven("\\\\📁\\s\\..\\x", "C:\\work", "win32"), "\\\\📁\\s\\x");
    assert.equal(rootAsGiven("😀\\..\\x", "\\\\files\\📁\\w", "win32"), "\\\\files\\📁\\w\\x");
    assert.equal(rootAsGiven("\\😀\\..\\x", "\\\\files\\📁\\w", "win32"), "\\\\files\\📁\\x");
    assert.equal(rootAsGiven("😀\\..\\x", "C:\\📁", "win32"), "C:\\📁\\x");
    assert.equal(rootAsGiven("😀/../x", "/📁/w", "posix"), "/📁/w/x");
  });

  // Calls GetFullPathNameW itself through P/Invoke, as Go's syscall.FullPath
  // does. .NET's Path.GetFullPath is not used: it returns a `\\?\` path
  // unchanged and expands 8.3 names, and Go does neither.
  it("matches GetFullPathNameW, then Go's Clean, on Windows", { skip: process.platform === "win32" ? false : "Windows only" }, (t) => {
    const cwd = realpathSync.native(mkdtempSync(join(tmpdir(), "buildos-root-win-")));
    try {
      const drive = cwd.slice(0, 2);
      const cases = [
        ".", "..", "..\\x\\.\\y\\..", "a//b", "a\\", "\\x\\..\\y", `${drive}x\\..\\y`, `${drive}\\a\\..\\b`,
        // Trailing dots and spaces.
        "a.\\b", "a..\\b", "a...\\b", "b. .", "a \\b", "a .\\b", "a. \\b", " . . .\\b", "...", "x\\...\\y", "x\\...", "a\\ \\",
        // Roots, devices, and UNC.
        "../../../../../../../../..", `${drive}\\..`, "\\\\server\\share\\a\\..\\..", "\\\\server\\share\\a\\..", "\\\\server\\share\\.",
        "\\\\server\\share\\a\\..\\..\\", "//server/share/x/", "///server/share/..", "////server/share/..",
        `\\\\?\\${drive}\\a\\..\\..`, `\\\\.\\${drive}\\a\\..\\..`, `\\\\?\\${drive}\\a.\\b. `, "//.", "//?", `//?/${drive}/a/../b`,
        // A doubled separator after the UNC server: an empty share (W1 R7 P3 t13).
        "//foo//bar/..", "//foo/bar/..",
        // UTF-16 code units.
        "\\\\files\\📁\\a\\..\\reports", "📁\\..\\😀\\.\\x", "\\😀\\..\\𝔘",
      ];
      // Non-ASCII goes as \u escapes, so neither command-line nor console code pages touch it.
      const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
      // No case holds a single quote, so the JSON is safe inside a PowerShell single-quoted string.
      const script = [
        `Add-Type -Namespace BuildOS -Name Win32 -MemberDefinition '[DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern uint GetFullPathNameW(string name, uint size, System.Text.StringBuilder buffer, System.IntPtr filePart);'`,
        `$out = foreach ($c in (ConvertFrom-Json '${ascii(JSON.stringify(cases))}')) { $b = New-Object System.Text.StringBuilder 32768; $n = [BuildOS.Win32]::GetFullPathNameW($c, 32768, $b, [IntPtr]::Zero); if ($n -eq 0) { "error" } else { $b.ToString() } }`,
        "ConvertTo-Json -Compress -EscapeHandling EscapeNonAscii -InputObject @($out)",
      ].join("; ");
      const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", script], { cwd, encoding: "utf8" });
      if (result.error !== undefined || result.status !== 0) {
        t.skip(`pwsh is not available: ${String(result.error ?? result.stderr)}`);
        return;
      }
      const full = JSON.parse(result.stdout) as string[];
      assert.equal(full.length, cases.length);
      cases.forEach((given, i) => {
        assert.notEqual(full[i], "error", JSON.stringify(given));
        assert.equal(rootAsGiven(given, cwd, "win32"), goClean(full[i]!, "win32"), JSON.stringify(given));
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

const posixOnly = { skip: process.platform === "win32" ? "POSIX device paths, FIFOs, and symlinks" : false };

/** Runs a test-only domain that opens `given` as an entity root and reads outside it; returns exit code and JSON envelope. */
async function refusalEnvelope(given: string, cwd: string): Promise<{ code: number; envelope: unknown }> {
  const domain: Domain = {
    name: "escape",
    summary: "Test-only port refusal",
    help: "Usage:\n  buildos escape\n",
    run(args, context) {
      context.setCommand("escape.read");
      const { fs } = resolveEntityRoot(args[0]!, cwd, context.openFs);
      return { command: "escape.read", json: true, result: fs.readText("../outside.txt", 1 << 20) };
    },
  };
  const io = captureIo(cwd);
  const code = await run(["escape", given, "--json"], io, { domains: [domain], buildInfo: { version: "dev", sourceRevision: "unknown" } });
  return { code, envelope: JSON.parse(io.stdout()) };
}

function expectedRefusal(root: string, message: string): unknown {
  return {
    ok: false,
    command: "escape.read",
    version: "dev",
    source_revision: "unknown",
    root,
    mode: "",
    write_status: "not_requested",
    result: null,
    diagnostics: [{ code: "path_refused", severity: "error", message, correction: "Use a file or folder path inside the BuildOS root." }],
  };
}

describe("refusal envelopes name the root as the Go seed spells it", () => {
  let scratch: string;
  before(() => {
    scratch = mkdtempSync(join(tmpdir(), "buildos-root-envelope-"));
  });
  after(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it("names a device root", async () => {
    const given = "/dev/null";
    const root = rootAsGiven(given, scratch);
    if (process.platform !== "win32") assert.equal(root, "/dev/null");
    const { code, envelope } = await refusalEnvelope(given, scratch);
    assert.equal(code, 3);
    assert.deepEqual(envelope, expectedRefusal(root, `the filesystem root ${root} is a device or special path`));
  });

  it("names a dangling root", posixOnly, async () => {
    const given = join(scratch, "dangling");
    symlinkSync(join(scratch, "nothing-here"), given);
    const { code, envelope } = await refusalEnvelope(given, scratch);
    assert.equal(code, 3);
    assert.deepEqual(envelope, expectedRefusal(given, `the filesystem root ${given} goes through a symlink that does not resolve`));
  });

  it("names a relative dangling root joined to the current folder", posixOnly, async () => {
    symlinkSync(join(scratch, "nothing-either"), join(scratch, "dangling-rel"));
    const { code, envelope } = await refusalEnvelope("./dangling-rel", scratch);
    assert.equal(code, 3);
    const root = `${scratch}/dangling-rel`;
    assert.deepEqual(envelope, expectedRefusal(root, `the filesystem root ${root} goes through a symlink that does not resolve`));
  });

  it("names a FIFO root", posixOnly, async (t) => {
    const given = join(scratch, "fifo");
    if (spawnSync("mkfifo", [given]).status !== 0) {
      t.skip("mkfifo is not available");
      return;
    }
    const { code, envelope } = await refusalEnvelope(given, scratch);
    assert.equal(code, 3);
    assert.deepEqual(envelope, expectedRefusal(given, `the filesystem root ${given} is not a regular file or folder`));
  });

  it("names a root that ends in link/.. by the folded text, as Go does, and checks the real path", posixOnly, async () => {
    // link -> project/workspace, so the OS reads link/.. as project, while
    // Go's filepath.Abs folds the text to scratch. The envelope reports the
    // Go spelling (owner decision); containment still uses the real path.
    const link = join(scratch, "link");
    symlinkSync(join(project, "workspace"), link);
    const { code, envelope } = await refusalEnvelope(`${link}/..`, scratch);
    assert.equal(code, 3);
    assert.deepEqual(envelope, expectedRefusal(scratch, `../outside.txt resolves outside the root ${scratch}`));
    // The relative spelling, joined to the current folder and folded.
    const relative = await refusalEnvelope("link/..", scratch);
    assert.equal(relative.code, 3);
    assert.deepEqual(relative.envelope, expectedRefusal(scratch, `../outside.txt resolves outside the root ${scratch}`));
    // The port binds the real path: the OS's link/.., not the folded text.
    const { fs } = resolveDefaultRoot({ cwd: scratch, root: "link/..", openFs });
    assert.equal(fs.root, realpathSync.native(project));
  });
});

/** Runs a test-only domain that opens `given` as an entity root, then reads, writes, or throws; returns exit code and JSON envelope. */
async function loadEnvelope(given: string, cwd: string, action: "read" | "write" | "throw" = "read", target = ".os/data/entities.jsonl"): Promise<{ code: number; envelope: unknown }> {
  const domain: Domain = {
    name: "load",
    summary: "Test-only root load",
    help: "Usage:\n  buildos load\n",
    run(args, context) {
      context.setCommand("load.run");
      const { fs } = resolveEntityRoot(args[0]!, cwd, context.openFs);
      if (action === "write") fs.writeFileAtomic(target, "x\n");
      if (action === "throw") throw new TypeError("domain bug after the root opened");
      return { command: "load.run", json: true, result: fs.readText(target, 1 << 20) };
    },
  };
  const io = captureIo(cwd);
  const code = await run(["load", given, "--json"], io, { domains: [domain], buildInfo: { version: "dev", sourceRevision: "unknown" } });
  return { code, envelope: JSON.parse(io.stdout()) };
}

function expectedFailure(root: string, code: string, message: string, correction: string): unknown {
  return {
    ok: false,
    command: "load.run",
    version: "dev",
    source_revision: "unknown",
    root,
    mode: "",
    write_status: "not_requested",
    result: null,
    diagnostics: [{ code, severity: "error", message, correction }],
  };
}

const UNREADABLE_ROOT = "Pass --root with a project folder you can open and read.";
const UNREADABLE_PATH = "Check that the path exists and that you can read it, then retry.";
// Root (uid 0) ignores folder permissions, so EACCES cannot happen.
const posixPermissions = {
  skip: process.platform === "win32" ? "POSIX folder permissions" : process.getuid?.() === 0 ? "running as root ignores folder permissions" : false,
};

describe("filesystem errors name the given root and exit 3", () => {
  let scratch: string;
  let locked: string;
  let good: string;
  before(() => {
    scratch = mkdtempSync(join(tmpdir(), "buildos-root-fserr-"));
    // A folder without search permission, holding a would-be root and a would-be target.
    locked = join(scratch, "locked");
    mkdirSync(join(locked, "root", ".os", "data"), { recursive: true });
    good = join(scratch, "good");
    mkdirSync(join(good, ".os", "data"), { recursive: true });
    mkdirSync(join(good, "locked"));
    writeFileSync(join(scratch, "afile"), "not a folder\n");
    writeFileSync(join(good, "afile"), "not a folder\n");
    if (process.platform !== "win32") {
      symlinkSync("loop-b", join(scratch, "loop-a"));
      symlinkSync("loop-a", join(scratch, "loop-b"));
      chmodSync(locked, 0o000);
      chmodSync(join(good, "locked"), 0o000);
    }
  });
  after(() => {
    if (process.platform !== "win32") {
      chmodSync(locked, 0o755);
      chmodSync(join(good, "locked"), 0o755);
    }
    rmSync(scratch, { recursive: true, force: true });
  });

  it("names a root under a folder without search permission (EACCES)", posixPermissions, async () => {
    const given = join(locked, "root");
    const { code, envelope } = await loadEnvelope(given, scratch);
    assert.equal(code, 3);
    assert.deepEqual(envelope, expectedFailure(given, "root_unreadable", `the filesystem root ${given} cannot be opened: permission denied (EACCES)`, UNREADABLE_ROOT));
    // The relative spelling is folded against the current folder.
    const relative = await loadEnvelope("./locked/../locked/root", scratch);
    assert.equal(relative.code, 3);
    assert.deepEqual(relative.envelope, expectedFailure(given, "root_unreadable", `the filesystem root ${given} cannot be opened: permission denied (EACCES)`, UNREADABLE_ROOT));
  });

  it("names a root below a file (ENOTDIR)", async () => {
    const given = join(scratch, "afile", "root");
    const { code, envelope } = await loadEnvelope(given, scratch);
    assert.equal(code, 3);
    assert.deepEqual(envelope, expectedFailure(given, "root_not_found", `root ${given} has no .os/data/ folder`, "Pass --root with the project folder that holds .os/data/."));
  });

  it("names a root that is a symlink loop (ELOOP)", posixOnly, async () => {
    const given = join(scratch, "loop-a");
    const { code, envelope } = await loadEnvelope(given, scratch);
    assert.equal(code, 3);
    assert.deepEqual(envelope, expectedFailure(given, "path_refused", `the filesystem root ${given} goes through a symlink loop`, "Use a file or folder path inside the BuildOS root."));
  });

  it("names a root whose name is too long (ENAMETOOLONG; ENOENT on Windows)", async () => {
    const given = join(scratch, "n".repeat(300), "root");
    const { code, envelope } = await loadEnvelope(given, scratch);
    // Exit 3 and the given root on every platform (PRD 20 Output and Exit Contract).
    assert.equal(code, 3);
    assert.equal((envelope as { root: string }).root, given);
    if (process.platform === "win32") {
      // NTFS refuses a 300-character name with ERROR_INVALID_NAME, which
      // libuv reports as ENOENT, so the root reads as missing.
      assert.deepEqual(envelope, expectedFailure(given, "root_not_found", `root ${given} has no .os/data/ folder`, "Pass --root with the project folder that holds .os/data/."));
    } else {
      assert.deepEqual(envelope, expectedFailure(given, "root_unreadable", `the filesystem root ${given} cannot be opened: name too long (ENAMETOOLONG)`, UNREADABLE_ROOT));
    }
  });

  it("names the root when a target cannot be read (EACCES, ENOTDIR, ENOENT)", async (t) => {
    if (posixPermissions.skip === false) {
      const denied = await loadEnvelope(good, scratch, "read", "locked/x");
      assert.equal(denied.code, 3);
      assert.deepEqual(denied.envelope, expectedFailure(good, "path_unreadable", "read locked/x failed: permission denied (EACCES)", UNREADABLE_PATH));
    } else {
      t.diagnostic(`EACCES target skipped: ${String(posixPermissions.skip)}`);
    }
    const notDir = await loadEnvelope(good, scratch, "read", "afile/x");
    // Exit 3 and the given root on every platform (PRD 20 Output and Exit Contract).
    assert.equal(notDir.code, 3);
    assert.equal((notDir.envelope as { root: string }).root, good);
    // A path below a file is ERROR_PATH_NOT_FOUND on Windows, which libuv
    // reports as ENOENT; POSIX reports ENOTDIR.
    const belowFile = process.platform === "win32" ? "no such file or directory (ENOENT)" : "not a directory (ENOTDIR)";
    assert.deepEqual(notDir.envelope, expectedFailure(good, "path_unreadable", `read afile/x failed: ${belowFile}`, UNREADABLE_PATH));
    const missing = await loadEnvelope(good, scratch);
    assert.equal(missing.code, 3);
    assert.deepEqual(missing.envelope, expectedFailure(good, "path_unreadable", "read .os/data/entities.jsonl failed: no such file or directory (ENOENT)", UNREADABLE_PATH));
  });

  it("names the root and exits 5 when a write cannot land (EACCES)", posixPermissions, async () => {
    const { code, envelope } = await loadEnvelope(good, scratch, "write", "locked/x");
    assert.equal(code, 5);
    assert.deepEqual(envelope, expectedFailure(good, "write_failed", "write locked/x failed: permission denied (EACCES)", "Check the permissions and free space under the BuildOS root, then retry."));
  });

  it("names the root in an internal error after the root opened", async () => {
    const { code, envelope } = await loadEnvelope(good, scratch, "throw");
    assert.equal(code, 1);
    assert.deepEqual(envelope, expectedFailure(good, "internal_error", "domain bug after the root opened", "Report this BuildOS failure with the command you ran."));
  });
});
