// W1 R7 P6 t5, t11, t25, A39, A40, A51: the npm package as adopters get it.
//
// - The pack check: `npm pack --dry-run` lists exactly the bundle, the
//   `system/` package content with its list (`dist/system.json`), and the
//   license, security, notices, and README files. No `system/docs/`, no
//   `system/.make-docs/`, no Go file, no test, fixture, or golden.
// - From an installed tarball: the four command names and the package-name
//   bin `build-os` exist and no others; `build-os` runs exactly as
//   `buildos`; each legacy name writes its one notice line and keeps stdout
//   and the exit code (on Windows through npm's `.cmd` shims); `buildos
//   init` works.
// - The legacy entry files (owner decision 2026-11-24): each one passes its
//   own name to the bundle, so the name never depends on the path it was
//   started under; `node <dist>/<name>.js args`, the npm Windows shim form,
//   works for each name.
// - `npx -y --package=<tarball> buildos init --skip-make-docs` and the same
//   `init` with no TTY, in empty folders, with no other install step; and
//   `npx -y build-os@file:<tarball> version`, the form of
//   `npx -y build-os@<version>`: npx chooses the bin named after the package
//   (owner decision of 2026-11-26).
//
// npm runs offline here: the package has no runtime dependencies.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { bundle } from "../scripts/build.ts";
import type { ContentManifest } from "../src/adapters/package-content.ts";
import { assertOutputDoesNotMatch, assertOutputMatches, assertSame, assertSameList, shape, tag } from "./helpers.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
const npmCli = join(dirname(process.execPath), windows ? "" : "..", windows ? "" : "lib", "node_modules", "npm", "bin", "npm-cli.js");
const npxCli = join(dirname(npmCli), "npx-cli.js");
const SHIPPED = ["LICENSE", "SECURITY.md", "THIRD_PARTY_NOTICES.md", "README.md", "package.json"];
const NOTICE = (name: string, domain: string) => `Note: the command name "${name}" goes away in BuildOS 0.3.0. Use "buildos ${domain}" instead.\n`;
const LEGACY = [["buildos-intake", "intake"], ["buildos-discovery", "discovery"], ["buildos-design", "design"]] as const;
const ENTRIES = ["dist/buildos.js", ...LEGACY.map(([name]) => `dist/${name}.js`)];
/**
 * W1 R7 P8 pin-first review round 2, finding 4: the staged package and its
 * bundle have this deliberate fixture version, whatever the checkout's
 * package.json says (0.0.0-dev before the release bump, 0.1.0 after it).
 * Every pin and version assertion below comes from it.
 */
const FIXTURE_VERSION = "0.0.0-fixture.1";
const FIXTURE_REVISION = "f".repeat(40);

/** Writes the checkout's package.json into `dir` with `version` and no devDependencies (so npm never fetches them). */
function stagePackageJson(dir: string, version: string): void {
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as Record<string, unknown>;
  pkg["version"] = version;
  delete pkg["devDependencies"];
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

let scratch: string;
let stage: string;
let tarball: string;
let prefix: string;

function npm(args: string[], cwd: string, extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: join(scratch, "npm-cache"), npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false", ...extraEnv },
    maxBuffer: 64 * 1024 * 1024,
  });
}

before(
  async () => {
    scratch = mkdtempSync(join(tmpdir(), "buildos-package-"));
    stage = join(scratch, "stage");
    mkdirSync(stage);
    await bundle({ outfile: join(stage, "dist", "buildos.js"), version: FIXTURE_VERSION, sourceRevision: FIXTURE_REVISION });
    for (const name of SHIPPED) copyFileSync(join(packageRoot, name), join(stage, name));
    stagePackageJson(stage, FIXTURE_VERSION);
    copyFileSync(join(packageRoot, ".npmrc"), join(stage, ".npmrc"));
    const packed = npm(["pack", "--json", "--pack-destination", scratch], stage);
    assert.equal(packed.status, 0, shape(packed.stderr));
    tarball = join(scratch, (JSON.parse(packed.stdout) as { filename: string }[])[0]!.filename);
    prefix = join(scratch, "prefix");
    mkdirSync(prefix);
    // Pin-first final check, finding 8: bin links on whatever the host's npm config says (the bin tests need them).
    const installed = npm(["install", "--ignore-scripts", "--no-save", "--bin-links=true", "--prefix", prefix, tarball], prefix);
    assert.equal(installed.status, 0, shape(installed.stderr));
  },
  { timeout: 180_000 },
);
after(() => rmSync(scratch, { recursive: true, force: true }));

describe("npm pack (t11)", () => {
  it("lists exactly the bundle, the system/ package content, and the shipped documents", () => {
    const dry = npm(["pack", "--dry-run", "--json"], stage);
    assert.equal(dry.status, 0, shape(dry.stderr));
    const files = (JSON.parse(dry.stdout) as { files: { path: string }[] }[])[0]!.files.map((f) => f.path).sort();
    const content = JSON.parse(readFileSync(join(stage, "dist", "system.json"), "utf8")) as ContentManifest;
    const expected = [...ENTRIES, "dist/system.json", ...content.files.map((f) => `dist/system/${f.stored}`), ...SHIPPED].sort();
    assertSameList(files, expected, "npm pack file list");
    for (const path of files) {
      assertOutputDoesNotMatch(path, /^dist\/system\/(?:docs|\.make-docs)\//, tag(String(path)));
      assertOutputDoesNotMatch(path, /(?:^|\/)(?:test|fixtures|golden|testdata)\//, tag(String(path)));
      assertOutputDoesNotMatch(path, /\.go$|(?:^|\/)go\.(?:mod|sum)$/, tag(String(path)));
    }
    for (const wrapper of ["buildos", "buildos-intake", "buildos-discovery", "buildos-design"]) {
      assert.ok(files.includes(`dist/system/.os/scripts/${wrapper}`), tag(String(wrapper)));
      assert.ok(files.includes(`dist/system/.os/scripts/${wrapper}.cmd`), `${tag(String(wrapper))}.cmd`);
    }
    assert.ok(files.includes("dist/system/_dot.gitignore"), "the project .gitignore ships under its stored name");
    assertSame(content.files.find((f) => f.path === ".gitignore")?.stored, "_dot.gitignore");
  });

  // W1 R7 P8 t14, W1 R7 P9 t9: no Python file ships to users. P9 removed the
  // last ones, the skill scripts of buildos-bulk-extract and fit-gap-analysis,
  // which the commands `buildos extract bulk` and `buildos fitgap` replace.
  // A Python file anywhere in the package fails here.
  it("t14: the package holds no Python file", () => {
    const dry = npm(["pack", "--dry-run", "--json"], stage);
    assert.equal(dry.status, 0, shape(dry.stderr));
    const files = (JSON.parse(dry.stdout) as { files: { path: string }[] }[])[0]!.files.map((f) => f.path);
    const python = files.filter((path) => /\.(?:py|pyc|pyo|pyw|pyz|ipynb)$/i.test(path) || /(?:^|\/)(?:requirements[^/]*\.txt|pyproject\.toml|setup\.py|__pycache__)(?:$|\/)/i.test(path)).sort();
    assertSameList(python, [], "Python files in the package");
    // No script of the removed skill scripts ships either (the Azure Boards
    // scripts were Node.js; `buildos export azure-boards` replaces them).
    assertSameList(files.filter((path) => /^dist\/system\/\.os\/skills\/[^/]+\/(?:scripts|tests)\//.test(path)), [], "skill script files in the package");
  });
});

describe("installed tarball (t5, A39, A40)", () => {
  const binDir = () => join(prefix, "node_modules", ".bin");

  it("A40: exposes buildos, the package-name bin build-os, and the three legacy names, and no buildos-entities or buildos-lifecycle", () => {
    const names = readdirSync(binDir()).map((n) => n.replace(/\.(?:cmd|ps1)$/i, ""));
    assert.deepEqual([...new Set(names)].sort(), ["build-os", "buildos", "buildos-design", "buildos-discovery", "buildos-intake"]);
    const manifest = JSON.parse(readFileSync(join(prefix, "node_modules", "build-os", "package.json"), "utf8")) as { bin: Record<string, string> };
    // Each legacy name has its own entry file (owner decision 2026-11-24).
    assert.deepEqual(manifest.bin, { buildos: "dist/buildos.js", "build-os": "dist/buildos.js", "buildos-intake": "dist/buildos-intake.js", "buildos-discovery": "dist/buildos-discovery.js", "buildos-design": "dist/buildos-design.js" });
  });

  /** Runs an installed command name: the `.bin` link on macOS and Linux, npm's `.cmd` shim through `cmd.exe` on Windows. */
  function bin(name: string, args: string[]) {
    if (!windows) return spawnSync(join(binDir(), name), args, { encoding: "utf8" });
    const line = [`"${join(binDir(), `${name}.cmd`)}"`, ...args].join(" ");
    return spawnSync(join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "cmd.exe"), ["/d", "/s", "/c", `"${line}"`], { encoding: "utf8", windowsVerbatimArguments: true });
  }

  // Owner decision of 2026-11-26: the package is build-os, and npx needs a bin
  // with the package name. build-os is the same file as buildos: no notice
  // line, no domain added, the same stdout, stderr, and exit code.
  it("build-os runs exactly as buildos: no notice line and no domain added", () => {
    for (const args of [["--help"], ["version", "--json"], ["intake", "--help"], ["nope"]]) {
      const named = bin("build-os", args);
      const modern = bin("buildos", args);
      assert.equal(named.status, modern.status, args.join(" "));
      assert.equal(named.stdout, modern.stdout, args.join(" "));
      assert.equal(named.stderr, modern.stderr, args.join(" "));
      assert.doesNotMatch(named.stderr, /goes away/);
    }
    assert.equal(JSON.parse(bin("build-os", ["version", "--json"]).stdout).version, FIXTURE_VERSION);
  });

  for (const [name, domain] of LEGACY) {
    it(`A39: ${name} writes one notice line, then the ${domain} output, with the same stdout and exit code`, () => {
      const legacy = bin(name, ["--help"]);
      const modern = bin("buildos", [domain, "--help"]);
      assert.equal(legacy.status, modern.status);
      assert.equal(legacy.stdout, modern.stdout);
      assert.equal(legacy.stderr, NOTICE(name, domain) + modern.stderr);
      const missing = bin(name, ["nope"]);
      const missingModern = bin("buildos", [domain, "nope"]);
      assert.equal(missing.status, missingModern.status);
      assert.notEqual(missing.status, 0);
      assert.equal(missing.stderr, NOTICE(name, domain) + missingModern.stderr);
    });
  }

  it("buildos init --skip-make-docs works from the installed package", () => {
    const dir = join(scratch, "installed-init");
    mkdirSync(dir);
    const entry = join(prefix, "node_modules", "build-os", "dist", "buildos.js");
    const result = spawnSync(process.execPath, [entry, "init", "--skip-make-docs"], { cwd: dir, encoding: "utf8", env: { ...process.env, PWD: dir } });
    assert.equal(result.status, 0, shape(result.stderr));
    assert.ok(existsSync(join(dir, ".os", "manifest.json")));
    assert.ok(existsSync(join(dir, ".gitignore")));
    assert.equal(existsSync(join(dir, "_dot.gitignore")), false);
  });
});

describe("legacy entry files (owner decision 2026-11-24)", () => {
  const dist = () => join(stage, "dist");
  const node = (file: string, args: string[]) => spawnSync(process.execPath, [file, ...args], { encoding: "utf8" });

  for (const [name, domain] of LEGACY) {
    it(`node <dist>/${name}.js (the npm Windows shim form) runs buildos ${domain} with the notice line`, () => {
      const legacy = node(join(dist(), `${name}.js`), ["--help"]);
      const modern = node(join(dist(), "buildos.js"), [domain, "--help"]);
      assert.equal(legacy.status, modern.status);
      assert.equal(legacy.stdout, modern.stdout);
      assert.equal(legacy.stderr, NOTICE(name, domain) + modern.stderr);
    });

    it(`the ${name} entry file passes its own name: a copy under another file name still runs buildos ${domain}`, () => {
      const renamed = join(dist(), `renamed-${name.slice("buildos-".length)}-entry.js`);
      writeFileSync(renamed, readFileSync(join(dist(), `${name}.js`)));
      try {
        const legacy = node(renamed, ["--help"]);
        const modern = node(join(dist(), "buildos.js"), [domain, "--help"]);
        assert.equal(legacy.status, modern.status);
        assert.equal(legacy.stdout, modern.stdout);
        assert.equal(legacy.stderr, NOTICE(name, domain) + modern.stderr);
      } finally {
        rmSync(renamed, { force: true });
      }
    });
  }

  it("the bundle never reads a legacy name from its own path: a copy named buildos-intake.js is plain buildos", () => {
    const other = join(scratch, "renamed-bundle");
    mkdirSync(other, { recursive: true });
    const copy = join(other, "buildos-intake.js");
    copyFileSync(join(dist(), "buildos.js"), copy);
    const result = node(copy, ["--help"]);
    const plain = node(join(dist(), "buildos.js"), ["--help"]);
    assert.equal(result.status, plain.status);
    assert.equal(result.stdout, plain.stdout);
    assert.equal(result.stderr, plain.stderr);
    assert.doesNotMatch(result.stderr, /goes away/);
  });
});

describe("npx from the tarball (t25, A51)", () => {
  function npx(args: string[], cwd: string) {
    // PATH keeps only Node's own folder, so no installed buildos or make-docs counts.
    // Finding 8 (final check): npx makes the bin link of the package it installs whatever the host's npm config says.
    return spawnSync(process.execPath, [npxCli, "-y", "--bin-links=true", `--package=${tarball}`, "buildos", ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, PATH: dirname(process.execPath) + delimiter + (windows ? join(process.env["SystemRoot"] ?? "C:\\Windows", "System32") : "/usr/bin:/bin"), PWD: cwd, npm_config_cache: join(scratch, "npx-cache"), npm_config_offline: "true", npm_config_update_notifier: "false" },
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });
  }

  it("npx -y --package=<tarball> buildos init --skip-make-docs sets up an empty folder", () => {
    const dir = join(scratch, "npx-skip");
    mkdirSync(dir);
    const result = npx(["init", "--skip-make-docs"], dir);
    assert.equal(result.status, 0, shape(result.stderr));
    assertOutputMatches(result.stdout, /\nDone\. BuildOS is set up in this folder\.\n/);
    assert.ok(existsSync(join(dir, ".os", "manifest.json")));
  });

  // npx -y build-os@<version> needs a bin named after the package, since the
  // package has several bins (without it npx stops with "could not determine
  // executable to run"). The build-os@file:<tarball> spec takes the same path
  // through npx with no registry.
  it("npx -y build-os@file:<tarball> version runs buildos at the package version, with no notice line", () => {
    const dir = join(scratch, "npx-package-name");
    mkdirSync(dir);
    const result = spawnSync(process.execPath, [npxCli, "-y", "--bin-links=true", `build-os@file:${tarball}`, "version", "--json"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, PATH: dirname(process.execPath) + delimiter + (windows ? join(process.env["SystemRoot"] ?? "C:\\Windows", "System32") : "/usr/bin:/bin"), PWD: dir, npm_config_cache: join(scratch, "npx-name-cache"), npm_config_offline: "true", npm_config_update_notifier: "false" },
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });
    assert.equal(result.status, 0, shape(result.stderr));
    const envelope = JSON.parse(result.stdout) as { command: string; version: string };
    assertSame(envelope.command, "version");
    assertSame(envelope.version, FIXTURE_VERSION);
    assert.doesNotMatch(result.stderr, /goes away/);
    assert.deepEqual(readdirSync(dir), []);
  });

  it("npx -y --package=<tarball> buildos init with no TTY stops with exit 10 and changes nothing", () => {
    const dir = join(scratch, "npx-no-tty");
    mkdirSync(dir);
    const result = npx(["init"], dir);
    assert.equal(result.status, 10, shape(result.stderr));
    assertOutputMatches(result.stdout, /^Project folder: .*\nStopped\. Nothing was changed\. BuildOS needs one answer from the user first\.\n/);
    assert.deepEqual(readdirSync(dir), []);
  });
});

// W1 R7 P8 pin-first review round 1, finding 1, with real npm: a project
// with a local install of the pinned version and no bin link (as
// `npm install --no-bin-links` leaves it), and a planted `buildos` first on
// PATH. npx alone takes that install as found and then starts "buildos" by
// name from PATH, so the planted program runs; the project wrapper runs the
// local install's own bin file instead. And a real global npm install of the
// pinned version on PATH runs directly, with no npx on PATH at all. The pin
// is the fixture version of the staged package (review round 2, finding 4).
//
// Review round 2 (the program that runs checks itself): npx can start a
// version other than the pin (finding 2: a local install of
// `<pin>+local`, which npm's semver.satisfies accepts), and a package can
// say one version in package.json while its bundle reports another
// (finding 3: after the release bump, a plain `npm run build` reports
// `dev`). The wrapper sets BUILDOS_REQUIRE_VERSION, and the program that
// starts refuses itself (exit 3, nothing on stdout).
describe("project wrappers with real npm installs (pin-first review rounds 1 and 2)", () => {
  const scriptsSource = join(packageRoot, "..", "..", "system", ".os", "scripts");
  const system = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32");

  function project(name: string, version: string = FIXTURE_VERSION): string {
    const dir = join(scratch, name);
    mkdirSync(join(dir, ".os"), { recursive: true });
    cpSync(scriptsSource, join(dir, ".os", "scripts"), { recursive: true });
    writeFileSync(join(dir, ".os", "manifest.json"), `${JSON.stringify({ schema_version: 1, buildos_version: version, initialized_at: "2026-11-25T00:00:00Z" })}\n`);
    return dir;
  }

  /** A hand-made `buildos` in `dir` that writes `marker` and prints PLANTED. */
  function planted(dir: string, marker: string): void {
    mkdirSync(dir, { recursive: true });
    const script = join(dir, "planted.cjs");
    writeFileSync(script, `require("fs").writeFileSync(${JSON.stringify(marker)}, "ran");\nprocess.stdout.write("PLANTED\\n");\n`);
    // Both names: npx -y build-os@<version> starts the bin named after the package (build-os) by name.
    for (const name of ["buildos", "build-os"]) {
      if (windows) writeFileSync(join(dir, `${name}.cmd`), `@"${process.execPath}" "${script}" %*\r\n`);
      else {
        writeFileSync(join(dir, name), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
        chmodSync(join(dir, name), 0o755);
      }
    }
  }

  /**
   * A folder with only the programs a wrapper run needs (finding 13): `node`,
   * and `npx` when `withNpx`; on macOS and Linux also `sh` (for the
   * wrappers' first line) and `env`. No system folder is on PATH, so no
   * `npx` of the system counts.
   */
  function tools(name: string, withNpx: boolean): string {
    const dir = join(scratch, name);
    mkdirSync(dir, { recursive: true });
    if (windows) {
      writeFileSync(join(dir, "node.cmd"), `@"${process.execPath}" %*\r\n`);
      if (withNpx) writeFileSync(join(dir, "npx.cmd"), `@"${process.execPath}" "${npxCli}" %*\r\n`);
      return dir;
    }
    writeFileSync(join(dir, "node"), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`);
    if (withNpx) writeFileSync(join(dir, "npx"), `#!/bin/sh\nexec "${process.execPath}" "${npxCli}" "$@"\n`);
    for (const file of readdirSync(dir)) chmodSync(join(dir, file), 0o755);
    symlinkSync("/bin/sh", join(dir, "sh"));
    symlinkSync(existsSync("/usr/bin/env") ? "/usr/bin/env" : "/bin/env", join(dir, "env"));
    return dir;
  }

  function env(path: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    const out: NodeJS.ProcessEnv = { ...process.env, PATH: path, npm_config_cache: join(scratch, "wrapper-npm-cache"), npm_config_offline: "true", npm_config_update_notifier: "false", ...extra };
    delete out["BUILDOS_WRAPPER_ACTIVE"];
    delete out["BUILDOS_REQUIRE_VERSION"];
    return out;
  }

  function wrapper(dir: string, path: string, args: string[], extra: NodeJS.ProcessEnv = {}) {
    // The Windows system folder only for cmd.exe itself.
    const full = windows ? `${path}${delimiter}${system}` : path;
    if (windows) return spawnSync(join(system, "cmd.exe"), ["/d", "/s", "/c", `"".os\\scripts\\buildos.cmd" ${args.join(" ")}"`], { cwd: dir, env: env(full, extra), encoding: "utf8", windowsVerbatimArguments: true, timeout: 120_000 });
    return spawnSync(join(dir, ".os", "scripts", "buildos"), args, { cwd: dir, env: env(full, extra), encoding: "utf8", timeout: 120_000 });
  }

  /**
   * A package folder `dir` as a source checkout or a release build makes it:
   * package.json with `packageVersion`, and a bundle that reports
   * `buildVersion` (undefined: a plain `npm run build`, which reports dev).
   */
  async function stagedPackage(dir: string, packageVersion: string, buildVersion: string | undefined): Promise<string> {
    mkdirSync(dir, { recursive: true });
    await bundle({ outfile: join(dir, "dist", "buildos.js"), version: buildVersion, sourceRevision: buildVersion === undefined ? undefined : FIXTURE_REVISION });
    for (const name of SHIPPED) if (name !== "package.json") copyFileSync(join(packageRoot, name), join(dir, name));
    copyFileSync(join(packageRoot, ".npmrc"), join(dir, ".npmrc"));
    stagePackageJson(dir, packageVersion);
    return dir;
  }

  function pack(dir: string): string {
    const packed = npm(["pack", "--json", "--pack-destination", dirname(dir)], dir);
    assert.equal(packed.status, 0, shape(packed.stderr));
    return join(dirname(dir), (JSON.parse(packed.stdout) as { filename: string }[])[0]!.filename);
  }

  /**
   * What `npm link` makes for the package folder `pkg` under the global
   * prefix `prefixDir`: the package folder is a link to `pkg`, and the bin
   * is a link to its bin file (macOS and Linux) or an npm-style `.cmd` shim
   * next to it (Windows, with a junction). Returns the folder for PATH.
   */
  function linked(pkg: string, prefixDir: string): string {
    if (windows) {
      mkdirSync(join(prefixDir, "node_modules"), { recursive: true });
      symlinkSync(pkg, join(prefixDir, "node_modules", "build-os"), "junction");
      writeFileSync(join(prefixDir, "buildos.cmd"), `@"${process.execPath}" "%~dp0\\node_modules\\build-os\\dist\\buildos.js" %*\r\n`);
      return prefixDir;
    }
    mkdirSync(join(prefixDir, "lib", "node_modules"), { recursive: true });
    mkdirSync(join(prefixDir, "bin"), { recursive: true });
    symlinkSync(pkg, join(prefixDir, "lib", "node_modules", "build-os"), "dir");
    symlinkSync(join(prefixDir, "lib", "node_modules", "build-os", "dist", "buildos.js"), join(prefixDir, "bin", "buildos"));
    return join(prefixDir, "bin");
  }

  /** Checks a self-check refusal: exit 3, nothing on stdout, the plain message with both versions and both fixes. */
  function assertRefused(result: ReturnType<typeof spawnSync>, required: string, started: string): void {
    const explain = `exit ${String(result.status)}\nstdout: ${String(result.stdout)}\nstderr: ${String(result.stderr)}`;
    assert.equal(result.status, 3, shape(explain));
    assertSame(result.stdout, "", shape(explain));
    assertSame(
      String(result.stderr).replace(/\r\n/g, "\n"),
      `BuildOS stopped: this project needs BuildOS ${required}, but BuildOS ${started} started. Nothing ran.\nFix the BuildOS install so that version ${required} runs, then run the project wrapper (.os/scripts/buildos) again. Or set buildos_version in .os/manifest.json to the version that you want to use.${required === "dev" ? " For a development build: in the project folder, replace the local install with the built development package (npm install <path to toolkits/buildos>). Or remove the local install (npm uninstall build-os), so that the linked build on PATH runs." : ""}\n`,
      shape(explain),
    );
  }

  it("runs a local install of the pinned version that has no bin link, never a buildos on PATH (npx alone runs the planted one)", () => {
    const dir = project("wrapper-local");
    const installed = npm(["install", "--no-bin-links", "--ignore-scripts", "--no-save", "--prefix", dir, tarball], dir);
    assert.equal(installed.status, 0, shape(installed.stderr));
    assert.equal(existsSync(join(dir, "node_modules", ".bin")), false, "no bin links");
    const marker = join(scratch, "wrapper-local-planted.txt");
    planted(join(scratch, "wrapper-local-planted"), marker);
    const path = [join(scratch, "wrapper-local-planted"), tools("wrapper-local-tools", true)].join(delimiter);
    // The hazard: real npx with the same PATH starts the planted program.
    const alone = spawnSync(process.execPath, [npxCli, "-y", `build-os@${FIXTURE_VERSION}`, "version"], { cwd: dir, env: env(windows ? `${path}${delimiter}${system}` : path), encoding: "utf8", timeout: 120_000 });
    // Shown on macOS and Linux; on Windows npm starts the command through cmd.exe, which this check does not cover.
    if (!windows) assert.equal(alone.stdout.trim(), "PLANTED", shape(`npx alone: ${alone.stdout}${alone.stderr}`));
    rmSync(marker, { force: true });
    const result = wrapper(dir, path, ["version", "--json"]);
    assert.equal(result.status, 0, shape(result.stderr));
    const envelope = JSON.parse(result.stdout) as { command: string; version: string };
    assertSame(envelope.command, "version");
    assertSame(envelope.version, FIXTURE_VERSION);
    assertSame(existsSync(marker), false, "the planted buildos must not run");
  });

  // Finding 13: npm bin links on for this install whatever the host's npm config says, and a PATH with node only.
  it("runs a global npm install of the pinned version on PATH directly, with no npx on PATH", () => {
    const dir = project("wrapper-global");
    const prefixDir = join(scratch, "wrapper-global-prefix");
    mkdirSync(prefixDir);
    const installed = npm(["install", "--global", "--ignore-scripts", "--bin-links=true", "--prefix", prefixDir, tarball], scratch);
    assert.equal(installed.status, 0, shape(installed.stderr));
    const bin = windows ? prefixDir : join(prefixDir, "bin");
    assert.ok(existsSync(join(bin, windows ? "buildos.cmd" : "buildos")), "npm made the bin link");
    // Only node: npx is not on PATH, so a fallback to npx would stop with exit 127.
    const path = [bin, tools("wrapper-global-tools", false)].join(delimiter);
    const result = wrapper(dir, path, ["version", "--json"]);
    assert.equal(result.status, 0, shape(result.stderr));
    assertSame((JSON.parse(result.stdout) as { version: string }).version, FIXTURE_VERSION);
  });

  // Finding 2: pin P, a local install of P+local. The helper does not take it, then npm 11 accepts it for the spec P
  // (semver.satisfies ignores build metadata) and npx starts its bin file. That program refuses itself.
  it("finding 2: npx starts a local install of <pin>+local, and that program refuses itself (exit 3, nothing on stdout)", async () => {
    const other = `${FIXTURE_VERSION}+local`;
    const tgz = pack(await stagedPackage(join(scratch, "plus-local", "pkg"), other, other));
    const dir = project("wrapper-plus-local");
    const installed = npm(["install", "--ignore-scripts", "--no-save", "--bin-links=true", "--prefix", dir, tgz], dir);
    assert.equal(installed.status, 0, shape(installed.stderr));
    const path = tools("wrapper-plus-local-tools", true);
    const result = wrapper(dir, path, ["version"]);
    assertRefused(result, FIXTURE_VERSION, other);
    const json = wrapper(dir, path, ["version", "--json"]);
    assert.equal(json.status, 3, shape(String(json.stderr)));
    const envelope = JSON.parse(json.stdout) as { ok: boolean; version: string; diagnostics: { code: string }[] };
    assertSame(envelope.ok, false);
    assertSame(envelope.version, other);
    assertSame(envelope.diagnostics[0]?.code, "version_mismatch");
  });

  // Finding 3: after the release bump, package.json says the release while a plain `npm run build` reports dev.
  describe("finding 3: a package.json version that differs from the bundle's own version", () => {
    const RELEASE = "0.1.0";
    let devBuild: string;
    let releaseTarball: string;
    before(
      async () => {
        // A linked development build: package.json bumped to the release, the bundle from a plain build (dev).
        devBuild = await stagedPackage(join(scratch, "bumped", "dev-build"), RELEASE, undefined);
        // A release build, as scripts/release-build.ts makes it: the bundle reports the package.json version.
        releaseTarball = pack(await stagedPackage(join(scratch, "bumped", "release-build"), RELEASE, RELEASE));
      },
      { timeout: 180_000 },
    );

    it("a dev project runs a linked development build whose package.json says the release", () => {
      const dir = project("bumped-dev-linked", "dev");
      const path = [linked(devBuild, join(scratch, "bumped-dev-linked-prefix")), tools("bumped-dev-linked-tools", false)].join(delimiter);
      const result = wrapper(dir, path, ["version", "--json"]);
      assert.equal(result.status, 0, shape(result.stderr));
      assertSame((JSON.parse(result.stdout) as { version: string }).version, "dev");
    });

    it("a project pinned to the release refuses the linked development build (exit 3, nothing on stdout)", () => {
      const dir = project("bumped-release-linked", RELEASE);
      const path = [linked(devBuild, join(scratch, "bumped-release-linked-prefix")), tools("bumped-release-linked-tools", false)].join(delimiter);
      assertRefused(wrapper(dir, path, ["version"]), RELEASE, "dev");
    });

    it("a dev project refuses a local install of the release build (exit 3, nothing on stdout)", () => {
      const dir = project("bumped-dev-release", "dev");
      const installed = npm(["install", "--ignore-scripts", "--no-save", "--prefix", dir, releaseTarball], dir);
      assert.equal(installed.status, 0, shape(installed.stderr));
      assertRefused(wrapper(dir, tools("bumped-dev-release-tools", false), ["version"]), "dev", RELEASE);
    });

    it("a project pinned to the release runs a local install of the release build", () => {
      const dir = project("bumped-release-release", RELEASE);
      const installed = npm(["install", "--ignore-scripts", "--no-save", "--prefix", dir, releaseTarball], dir);
      assert.equal(installed.status, 0, shape(installed.stderr));
      const result = wrapper(dir, tools("bumped-release-release-tools", false), ["version", "--json"]);
      assert.equal(result.status, 0, shape(result.stderr));
      assertSame((JSON.parse(result.stdout) as { version: string }).version, RELEASE);
    });
  });
});

// W1 R7 P8 pin-first final check, findings 1 and 2, with real npm. A
// fresh npx fetch needs a registry, so a small registry on 127.0.0.1 (in a
// worker thread, so that spawnSync does not block it) serves the staged
// package at the fixture version. npm runs online against that registry
// only, with an empty cache for each case.
const REGISTRY_WORKER = `
const { parentPort, workerData } = require("node:worker_threads");
const http = require("node:http");
const fs = require("node:fs");
const tarball = fs.readFileSync(workerData.tarball);
let base = "";
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/" + workerData.name) {
    const version = Object.assign({}, workerData.manifest, { dist: { tarball: base + "/tarball.tgz", integrity: workerData.integrity, shasum: workerData.shasum } });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ name: workerData.name, "dist-tags": { latest: workerData.manifest.version }, versions: { [workerData.manifest.version]: version } }));
  } else if (url === "/tarball.tgz") {
    res.setHeader("content-type", "application/octet-stream");
    res.end(tarball);
  } else {
    res.statusCode = 404;
    res.end("{}");
  }
});
server.listen(0, "127.0.0.1", () => {
  base = "http://127.0.0.1:" + server.address().port;
  parentPort.postMessage(base);
});
`;

describe("project wrappers with real npm in an npm workspace (pin-first final check)", () => {
  const scriptsSource = join(packageRoot, "..", "..", "system", ".os", "scripts");
  const system = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32");
  let worker: Worker;
  let registry: string;
  let caseCount = 0;

  before(async () => {
    const bytes = readFileSync(tarball);
    const manifest = JSON.parse(readFileSync(join(stage, "package.json"), "utf8")) as Record<string, unknown>;
    worker = new Worker(REGISTRY_WORKER, {
      eval: true,
      workerData: { tarball, name: "build-os", manifest, integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`, shasum: createHash("sha1").update(bytes).digest("hex") },
    });
    registry = await new Promise<string>((done, fail) => {
      worker.once("message", (url: string) => done(url));
      worker.once("error", fail);
    });
  });
  after(async () => {
    await worker?.terminate();
  });

  /** A BuildOS project folder `dir` (any depth) with the wrappers and a manifest that pins the fixture version. */
  function project(dir: string): string {
    mkdirSync(join(dir, ".os"), { recursive: true });
    cpSync(scriptsSource, join(dir, ".os", "scripts"), { recursive: true });
    writeFileSync(join(dir, ".os", "manifest.json"), `${JSON.stringify({ schema_version: 1, buildos_version: FIXTURE_VERSION, initialized_at: "2026-11-25T00:00:00Z" })}\n`);
    return dir;
  }

  /** An npm workspace at `root` with the member packages/app; returns the member folder. */
  function workspace(root: string): string {
    mkdirSync(join(root, "packages", "app"), { recursive: true });
    writeFileSync(join(root, "package.json"), '{"name":"ws","private":true,"workspaces":["packages/*"]}\n');
    writeFileSync(join(root, "packages", "app", "package.json"), '{"name":"app","version":"1.0.0"}\n');
    return join(root, "packages", "app");
  }

  /** A folder with `node` and `npx` only (and `sh` and `env` on macOS and Linux). */
  function tools(dir: string): string {
    mkdirSync(dir, { recursive: true });
    if (windows) {
      writeFileSync(join(dir, "node.cmd"), `@"${process.execPath}" %*\r\n`);
      writeFileSync(join(dir, "npx.cmd"), `@"${process.execPath}" "${npxCli}" %*\r\n`);
      return dir;
    }
    writeFileSync(join(dir, "node"), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`);
    writeFileSync(join(dir, "npx"), `#!/bin/sh\nexec "${process.execPath}" "${npxCli}" "$@"\n`);
    for (const file of readdirSync(dir)) chmodSync(join(dir, file), 0o755);
    symlinkSync("/bin/sh", join(dir, "sh"));
    symlinkSync(existsSync("/usr/bin/env") ? "/usr/bin/env" : "/bin/env", join(dir, "env"));
    return dir;
  }

  /** Runs the project wrapper of `dir` from `cwd`, with `path` (and the Windows system folder) on PATH and npm on the local registry. */
  function wrapper(dir: string, cwd: string, path: string, args: string[]) {
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: windows ? `${path}${delimiter}${system}` : path, npm_config_registry: `${registry}/`, npm_config_offline: "false", npm_config_cache: join(scratch, `registry-cache-${++caseCount}`), npm_config_update_notifier: "false", npm_config_audit: "false", npm_config_fund: "false" };
    delete env["BUILDOS_WRAPPER_ACTIVE"];
    delete env["BUILDOS_REQUIRE_VERSION"];
    if (windows) return spawnSync(join(system, "cmd.exe"), ["/d", "/s", "/c", `""${join(dir, ".os", "scripts", "buildos.cmd")}" ${args.join(" ")}"`], { cwd, env, encoding: "utf8", windowsVerbatimArguments: true, timeout: 120_000 });
    return spawnSync(join(dir, ".os", "scripts", "buildos"), args, { cwd, env, encoding: "utf8", timeout: 120_000 });
  }

  const explain = (result: ReturnType<typeof spawnSync>) => `exit ${String(result.status)}\nstdout: ${String(result.stdout)}\nstderr: ${String(result.stderr)}`;
  const same = (a: string, b: string) => (windows ? realpathSync(a).toLowerCase() === realpathSync(b).toLowerCase() : realpathSync(a) === realpathSync(b));

  // Finding 2: with no install, npx fetches the pin. In a workspace member's subfolder, npm alone runs the program in
  // the member folder (packages/app), so init sets up the wrong folder. --prefix and --workspaces=false keep it here.
  it("finding 2: a fresh npx fetch from a project inside an npm workspace member runs in the project folder", () => {
    const member = workspace(join(scratch, "reg-ws"));
    const dir = project(join(member, "nested project"));
    const result = wrapper(dir, dir, tools(join(scratch, "reg-ws-tools")), ["init", "--skip-make-docs", "--json"]);
    assert.ok(existsSync(join(member, ".os")) === false, shape(`npm must not run BuildOS in the workspace member folder\n${explain(result)}`));
    const envelope = JSON.parse(String(result.stdout)) as { version: string; root: string };
    assertSame(envelope.version, FIXTURE_VERSION, shape(explain(result)));
    assert.ok(same(envelope.root, dir), shape(`init must run in the project folder\n${explain(result)}`));
  });

  it("finding 2: a fresh npx fetch still works in a plain project (no workspace) whose path holds spaces", () => {
    const dir = project(join(scratch, "reg plain", "my project"));
    const result = wrapper(dir, dir, tools(join(scratch, "reg-plain-tools")), ["version", "--json"]);
    assert.equal(result.status, 0, shape(explain(result)));
    assertSame((JSON.parse(String(result.stdout)) as { version: string }).version, FIXTURE_VERSION, shape(explain(result)));
  });

  // Finding 1: npm hoisted a --no-bin-links install to the workspace root. npx alone finds the package and starts
  // its bin by name from PATH (a planted program; "build-os" since the package name of 2026-11-26); the wrapper
  // finds it in the folder above and runs its bin file.
  it("finding 1: runs a --no-bin-links install that npm hoisted to the workspace root, never a buildos on PATH", () => {
    const root = join(scratch, "hoisted-ws");
    const member = workspace(root);
    const dir = project(member);
    const installed = npm(["install", "--no-bin-links", "--ignore-scripts", "--no-save", "--workspace", "app", tarball], root);
    assert.equal(installed.status, 0, shape(installed.stderr));
    assert.ok(existsSync(join(root, "node_modules", "build-os", "package.json")), "npm hoisted the package to the workspace root");
    assert.equal(existsSync(join(member, "node_modules", "build-os")), false, "no install in the member folder");
    const planted = join(scratch, "hoisted-planted");
    mkdirSync(planted);
    const marker = join(scratch, "hoisted-planted.txt");
    const script = join(planted, "planted.cjs");
    writeFileSync(script, `require("fs").writeFileSync(${JSON.stringify(marker)}, "ran");\nprocess.stdout.write("PLANTED\\n");\n`);
    for (const name of ["buildos", "build-os"]) {
      if (windows) writeFileSync(join(planted, `${name}.cmd`), `@"${process.execPath}" "${script}" %*\r\n`);
      else {
        writeFileSync(join(planted, name), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
        chmodSync(join(planted, name), 0o755);
      }
    }
    const result = wrapper(dir, dir, [planted, tools(join(scratch, "hoisted-tools"))].join(delimiter), ["version", "--json"]);
    assert.equal(result.status, 0, shape(explain(result)));
    assertSame((JSON.parse(String(result.stdout)) as { version: string }).version, FIXTURE_VERSION, shape(explain(result)));
    assertSame(existsSync(marker), false, "the planted buildos must not run");
  });
});

// W1 R7 P6 review round 2 (P6-R1-14): the installed-tarball golden step runs
// on every system of the matrix, Windows included, from the installed
// package's node_modules/.bin. The "installed runner" test in
// test/golden/compare.test.ts checks, inside that step, that the shims are
// what runs.
describe("CI: golden parity from the installed tarball (P6-R1-14)", () => {
  it("runs on macOS, Linux, and Windows, with BUILDOS_GOLDEN_BIN_DIR set to the installed node_modules/.bin", () => {
    const workflow = readFileSync(join(packageRoot, "..", "..", ".github", "workflows", "buildos-ci.yml"), "utf8");
    assert.match(workflow, /os: \[ubuntu-latest, macos-latest, windows-latest\]/);
    const start = workflow.indexOf("- name: Golden parity from the installed tarball");
    assert.ok(start >= 0, "the step is there");
    const next = workflow.indexOf("\n      - name:", start + 1);
    const step = workflow.slice(start, next < 0 ? undefined : next);
    assert.doesNotMatch(step, /^\s+if:/m, "the step runs on every system");
    assert.match(step, /BUILDOS_GOLDEN_BIN_DIR="\$RUNNER_TEMP\/installed\/node_modules\/\.bin" node --test --test-reporter=spec test\/golden\/compare\.test\.ts/);
  });
});

/** An absolute path, a home folder, a user name variable, a file URL, or a shebang (the placeholder one is removed before the scan). */
const FIXTURE_PATH_PATTERN = /(^|[\s"'=(:`,[{!])\/[A-Za-z0-9.~_-]|[A-Za-z]:\\|\\\\[A-Za-z]|~\/|\$HOME|%USERPROFILE%|%HOMEPATH%|file:\/\/|^#!/m;

// W1 R7 P6 review round 2 (P6-R1-13): the Go-era fixture stays short
// placeholder files, with no machine-specific path and no real script.
describe("the go-era-project fixture (P6-R1-13)", () => {
  const fixture = join(packageRoot, "test", "fixtures", "init", "go-era-project");
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else files.push(join(dir, entry.name));
    }
  };
  walk(fixture);

  // W1 R7 P6 review round 3 (P6-R3-16): any absolute POSIX path (such as /tmp/...), not only home folders.
  it("holds no absolute path, home folder, user name, or file URL", () => {
    assert.ok(files.length >= 30);
    for (const file of files) {
      // The one allowed absolute path: the placeholder scripts' own first line.
      const text = readFileSync(file, "latin1").replace(/^#!\/usr\/bin\/env sh\r?\n/, "");
      assert.ok(!FIXTURE_PATH_PATTERN.test(text), file);
    }
  });

  // W1 R7 P6 review round 4 (P6-R4-10): a path that starts with a digit, and any other shebang, count too.
  it("the scan finds absolute paths that start with a digit and every shebang but the placeholder one", () => {
    for (const text of ["see /2026/team.txt", "#!/bin/bash\nexit 0\n", "x=/9/a", "C:\\Users", "~/notes", "file:///x", "a /tmp/x"]) {
      assert.match(text.replace(/^#!\/usr\/bin\/env sh\r?\n/, ""), FIXTURE_PATH_PATTERN, text);
    }
    for (const text of ["#!/usr/bin/env sh\nexit 0\n", "a/b/c", "1/2 cup", "and/or"]) {
      assert.doesNotMatch(text.replace(/^#!\/usr\/bin\/env sh\r?\n/, ""), FIXTURE_PATH_PATTERN, text);
    }
  });

  it("holds only placeholder scripts: each file is short, and a script only exits (comments aside)", () => {
    for (const file of files) {
      const text = readFileSync(file, "latin1");
      assert.ok(text.length <= 400, `${file} has ${text.length} bytes`);
      if (!text.startsWith("#!") && !/\.(sh|cmd|bat|ps1|py)$/.test(file)) continue;
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      const body = lines[0]?.startsWith("#!") === true ? lines.slice(1) : lines;
      for (const line of body) assert.match(line.trim(), /^(?:#|rem(?:\s|$)|::|@?echo off$|exit(?: \/b)? 0$)/i, `${file} is more than a placeholder: ${line}`);
    }
  });

  it("checks out byte for byte: no text conversion applies to the fixture (the package rule does not override it)", () => {
    const attrs = readFileSync(join(packageRoot, ".gitattributes"), "utf8").split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#"));
    const all = attrs.findIndex((l) => l.startsWith("* "));
    const fixture = attrs.findIndex((l) => l.startsWith("test/fixtures/init/** ") && l.includes("-text"));
    assert.ok(fixture > all && all >= 0, "the package .gitattributes turns text conversion off for the fixture, after its * rule");
  });
});

// W1 R7 P7 review round 3: the deny-list check has its own workflow with no
// path filter, so it sees every change; the test workflow keeps a path filter
// that covers every file the tests build, read, or ship.
describe("CI: the deny-list workflow and the test workflow's path filter", () => {
  const read = (name: string) => readFileSync(join(packageRoot, "..", "..", ".github", "workflows", name), "utf8").replace(/\r\n/g, "\n");
  /** The `on:` block of a workflow. */
  const triggers = (text: string) => text.slice(text.indexOf("\non:\n"), text.indexOf("\npermissions:"));

  it("buildos-deny-list.yml runs on every push and pull request, with no path filter, and holds the deny-list job", () => {
    const deny = read("buildos-deny-list.yml");
    assert.equal(triggers(deny), "\non:\n  push:\n  pull_request:\n  workflow_dispatch:\n");
    assert.match(deny, /\n  deny-list:\n    name: Deny list \(real list, default branch only\)\n/);
    assert.match(deny, /BUILDOS_DENY_LIST: \$\{\{ secrets\.BUILDOS_DENY_LIST_ENV \}\}/);
    assert.match(deny, /FORK_PR: \$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.repo\.full_name != github\.repository \}\}/);
    assert.doesNotMatch(read("buildos-ci.yml"), /\n  deny-list:/);
  });

  it("buildos-ci.yml filters push and pull_request by the same paths, which cover every input of its tests", () => {
    const on = triggers(read("buildos-ci.yml"));
    const paths = ["toolkits/buildos/**", "system/**", "docs/**", "guide/**", "*.md", "justfile", ".github/**"];
    const block = paths.map((p) => `      - "${p}"\n`).join("");
    assert.ok(on.includes(`  push:\n    paths:\n${block}`), on);
    assert.ok(on.includes(`  pull_request:\n    paths:\n${block}`), on);
  });
});
