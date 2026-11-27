// W1 R7 P9, F-P9-15: the tarball mode of scripts/published-smoke.ts. The
// mode switch, the SHA-256 check, the registry guard, and step 10 in tarball
// mode, with stubs (scripts/smoke-source.ts and scripts/printed-fix-step.ts
// start no process). One real npm run shows that the guard makes a registry
// fetch of build-os fail; it needs no network. The full smoke on a packed
// tarball runs in the buildos-smoke workflow (source local-pack) on three
// systems.
//
// Review round 1 of pull request 12: real npm runs (no network: npm is
// offline with a blocked registry) build the real npx and project installs
// and npm cache that the provenance checks read (scripts/smoke-evidence.ts):
// the honest layout passes, and an empty cache, a cache entry for another
// tarball, changed install bytes, a build-os on PATH, and one in a global
// prefix each fail or are shown not to be used (finding 1). Two runs of the
// script itself, with its process starts stubbed by a preload module, show
// that a failed preflight stops the run before step 1, that the report
// claims only what ran (finding 2), and that the report holds no runner path
// (finding 3).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { after, describe, it } from "node:test";
import { expectedActionLine, expectedRebuild, printedFixStep, type RanStep } from "../scripts/printed-fix-step.ts";
import { cacheContentSha256, findBuildOsFolders, MAX_DEPTH, readCacheIndex, readInstalledCopy, readLaunchers, readNpxFolders } from "../scripts/smoke-evidence.ts";
import {
  BLOCKED_REGISTRY,
  cacheContentProblems,
  cacheIndexEntries,
  cacheIndexProblems,
  cmdShimTarget,
  comparisonStatement,
  copyProblems,
  guardedEnv,
  launcherProblems,
  launchProblems,
  launchRecords,
  legacyNpxArgs,
  npxArgs,
  npxFolderProblems,
  parseSmokeArgs,
  PREFLIGHT_STDOUT,
  PROBE_LOG_VARIABLE,
  PROBE_SOURCE,
  ps1ShimTarget,
  readTarballIdentity,
  reportCacheKey,
  sha256Hex,
  sha512Integrity,
  strayProblems,
  TARBALL_MODE_LIMITS,
  tarballClaims,
  UsageError,
  type StepOutcome,
  type TarballIdentity,
} from "../scripts/smoke-source.ts";
import { tarGz, tarGzRaw, ustarEntry } from "./tar-fixture.ts";

const SCRIPTS = resolve(import.meta.dirname, "..", "scripts");
const SMOKE = join(SCRIPTS, "published-smoke.ts");
const SHA = "a".repeat(64);
const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});
function temp(): string {
  // The real path: through a linked temporary folder (macOS /var, /tmp), npm records other lockfile keys.
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "buildos-smoke-tarball-")));
  temps.push(dir);
  return dir;
}

const BIN = "#!/usr/bin/env node\nconsole.log('stub');\n";
function fixtureTarball(pkg: Record<string, unknown> = {}, extra: Record<string, string> = {}): Uint8Array {
  const manifest = { name: "build-os", version: "0.2.0", bin: { buildos: "dist/buildos.js", "build-os": "dist/buildos.js", "buildos-intake": "./dist/buildos-intake.js" }, ...pkg };
  return tarGz({ "package/package.json": JSON.stringify(manifest), "package/dist/buildos.js": BIN, "package/dist/buildos-intake.js": `${BIN}// intake\n`, ...extra });
}

describe("F-P9-15: the mode switch (--version or --tarball with --sha256)", () => {
  it("reads the registry mode and the tarball mode", () => {
    assert.deepEqual(parseSmokeArgs(["--version", "0.1.0", "--out", "o"]), { source: { kind: "registry", version: "0.1.0" }, out: "o" });
    assert.deepEqual(parseSmokeArgs(["--tarball", "t.tgz", "--sha256", SHA, "--out", "o"]), { source: { kind: "tarball", file: "t.tgz", sha256: SHA }, out: "o" });
  });

  it("refuses both sources, no source, a --sha256 without --tarball, and a SHA-256 that is not 64 lowercase hex characters", () => {
    const bad: [string[], RegExp][] = [
      [["--version", "0.2.0", "--tarball", "t.tgz", "--sha256", SHA, "--out", "o"], /cannot be used together/],
      [["--out", "o"], /--version must be a plain version/],
      [["--version", "0.2.0", "--sha256", SHA, "--out", "o"], /--sha256 goes with --tarball only/],
      [["--tarball", "t.tgz", "--out", "o"], /--sha256 must be/],
      [["--tarball", "t.tgz", "--sha256", SHA.toUpperCase(), "--out", "o"], /--sha256 must be/],
      [["--tarball", "t.tgz", "--sha256", SHA.slice(1), "--out", "o"], /--sha256 must be/],
      [["--tarball", "", "--sha256", SHA, "--out", "o"], /--tarball needs a file/],
      [["--tarball", "t.tgz", "--sha256", SHA], /--out is required/],
      [["--tarball", "t.tgz", "--sha256", SHA, "--out", "o", "--registry", "x"], /unknown argument/],
    ];
    for (const [argv, message] of bad) {
      assert.throws(() => parseSmokeArgs(argv), (e: unknown) => e instanceof UsageError && message.test(e.message), argv.join(" "));
    }
  });

  it("the script exits 2 on a usage error, before any npm call", () => {
    for (const argv of [["--version", "0.2.0", "--tarball", "t.tgz", "--sha256", SHA, "--out", "o"], ["--tarball", "t.tgz", "--sha256", "nothex", "--out", "o"]]) {
      const r = spawnSync(process.execPath, [SMOKE, ...argv], { encoding: "utf8" });
      assert.equal(r.status, 2, argv.join(" "));
      assert.match(r.stderr, /Usage: node scripts\/published-smoke\.ts \(--version <version> \| --tarball <file> --sha256 <hex>\) --out <folder>/);
    }
  });

  it("each direct step takes the package from the registry version, or from the tarball file", () => {
    const registry = { kind: "registry", version: "0.1.0" } as const;
    const tarball = { kind: "tarball", file: "/t/build-os-0.2.0.tgz", sha256: SHA } as const;
    assert.deepEqual(npxArgs(registry, "0.1.0", ["version"]), ["-y", "build-os@0.1.0", "version"]);
    assert.deepEqual(npxArgs(tarball, "0.2.0", ["version", "--json"]), ["-y", "--package=/t/build-os-0.2.0.tgz", "--", "buildos", "version", "--json"]);
    assert.deepEqual(legacyNpxArgs(registry, "0.1.0"), ["-y", "--package=build-os@0.1.0", "buildos-intake", "--help"]);
    assert.deepEqual(legacyNpxArgs(tarball, "0.2.0"), ["-y", "--package=/t/build-os-0.2.0.tgz", "buildos-intake", "--help"]);
    for (const args of [npxArgs(tarball, "0.2.0", ["init"]), legacyNpxArgs(tarball, "0.2.0")]) assert.ok(!args.some((a) => a.includes("build-os@")), args.join(" "));
  });
});

describe("F-P9-15: the tarball's SHA-256 and identity", () => {
  it("reads the name, the version, and each bin file's SHA-256 from package/package.json", () => {
    const bytes = fixtureTarball();
    const id = readTarballIdentity(bytes);
    assert.equal(id.sha256, sha256Hex(bytes));
    assert.equal(id.integrity, sha512Integrity(bytes));
    assert.match(id.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
    assert.deepEqual([...id.files.keys()].sort(), ["dist/buildos-intake.js", "dist/buildos.js", "package.json"]);
    assert.deepEqual([...id.binFiles], [["buildos", "dist/buildos.js"], ["build-os", "dist/buildos.js"], ["buildos-intake", "dist/buildos-intake.js"]]);
    assert.deepEqual(id.nonFileEntries, []);
    assert.equal(id.name, "build-os");
    assert.equal(id.version, "0.2.0");
    assert.deepEqual(id.bins, { "dist/buildos.js": sha256Hex(Buffer.from(BIN)), "dist/buildos-intake.js": sha256Hex(Buffer.from(`${BIN}// intake\n`)) });
  });

  it("refuses another package name, a version that is not plain, a missing bin file, a repeated package.json, and a file that is not a gzip tar", () => {
    assert.throws(() => readTarballIdentity(fixtureTarball({ name: "build-0s" })), /package name is "build-0s"/);
    assert.throws(() => readTarballIdentity(fixtureTarball({ version: "^0.2.0" })), /not a plain version/);
    assert.throws(() => readTarballIdentity(fixtureTarball({ bin: { buildos: "dist/missing.js" } })), /no bin file dist\/missing\.js/);
    assert.throws(() => readTarballIdentity(fixtureTarball({ bin: {} })), /names no bin file/);
    assert.throws(() => readTarballIdentity(tarGz({ "package/dist/buildos.js": BIN })), /no package\/package\.json/);
    assert.throws(() => readTarballIdentity(Buffer.from("not a tarball")));
  });

  it("the script stops before any step when the SHA-256 differs, the file cannot be read, or the tarball is not build-os, and writes no report", () => {
    const dir = temp();
    const good = join(dir, "build-os-0.2.0.tgz");
    writeFileSync(good, fixtureTarball());
    const other = join(dir, "other.tgz");
    writeFileSync(other, fixtureTarball({ name: "other" }));
    const cases: [string, string, RegExp][] = [
      [good, SHA, /the tarball's SHA-256 is [0-9a-f]{64}, not the expected a{64}; no step ran/],
      [join(dir, "missing.tgz"), SHA, /cannot read the tarball .*; no step ran/],
      [other, sha256Hex(readFileSync(other)), /package name is "other", not "build-os"; no step ran/],
    ];
    for (const [file, sha, message] of cases) {
      const out = join(dir, `out-${sha.slice(0, 6)}`);
      const r = spawnSync(process.execPath, [SMOKE, "--tarball", file, "--sha256", sha, "--out", out], { encoding: "utf8" });
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, message);
      assert.equal(r.stdout, "");
      assert.equal(existsSync(out), false, "no report");
    }
  });
});

function npmCli(name: "npx" | "npm"): string {
  const nodeDir = dirname(process.execPath);
  const cli = [join(nodeDir, "node_modules", "npm", "bin", `${name}-cli.js`), join(nodeDir, "..", "lib", "node_modules", "npm", "bin", `${name}-cli.js`)].find((p) => existsSync(p));
  assert.ok(cli !== undefined, `${name}-cli.js next to this Node.js`);
  return cli;
}

/** The folders of one smoke run, as published-smoke.ts makes them: a temporary root with a new npm cache, a new empty global prefix, and a project; the tarball outside the root. */
interface Layout {
  root: string;
  cache: string;
  prefix: string;
  work: string;
  project: string;
  tarball: string;
  identity: TarballIdentity;
  env: NodeJS.ProcessEnv;
}

function layout(bytes: Uint8Array = fixtureTarball(), callerEnv: NodeJS.ProcessEnv = process.env): Layout {
  const root = temp();
  const cache = join(root, "npm-cache");
  const prefix = join(root, "npm-prefix");
  const work = join(root, "work");
  const project = join(root, "project");
  const probeDir = join(root, "launch-probe");
  for (const dir of [cache, prefix, work, project, probeDir]) mkdirSync(dir);
  // The launch probe of published-smoke.ts (review round 2 of pull request 12, finding 1).
  const probe = join(probeDir, "probe.cjs");
  writeFileSync(probe, PROBE_SOURCE);
  const tarball = join(temp(), "build-os-0.2.0.tgz");
  writeFileSync(tarball, bytes);
  const env = guardedEnv({ ...callerEnv, npm_config_ignore_scripts: "true", npm_config_update_notifier: "false", npm_config_fund: "false", npm_config_audit: "false" }, { cache, prefix, probe });
  return { root, cache, prefix, work, project, tarball, identity: readTarballIdentity(bytes), env };
}

let logCount = 0;
/** The last launch log that npx() wrote: one JSON line per Node.js process of that call. */
let lastLaunchLog = "";
function npx(l: Layout, cwd: string, args: string[], env: NodeJS.ProcessEnv = l.env) {
  lastLaunchLog = join(l.root, "launch-probe", `call-${++logCount}.jsonl`);
  return spawnSync(process.execPath, [npmCli("npx"), ...args], { cwd, env: { ...env, [PROBE_LOG_VARIABLE]: lastLaunchLog }, encoding: "utf8", timeout: 120_000 });
}
/** The launch records of the last npx() call. */
const lastLaunches = () => (existsSync(lastLaunchLog) ? launchRecords(readFileSync(lastLaunchLog, "utf8")) : []);

/** The direct-step form of published-smoke.ts: `npx -y --package=<tarball> -- buildos`. */
function npxTarball(l: Layout, tarball: string = l.tarball, env: NodeJS.ProcessEnv = l.env) {
  return npx(l, l.work, ["-y", `--package=${tarball}`, "--", "buildos"], env);
}

/** The install before step 9 of published-smoke.ts. */
function installIntoProject(l: Layout, tarball: string = l.tarball) {
  return spawnSync(process.execPath, [npmCli("npm"), "install", "--offline", "--ignore-scripts", "--no-save", "--no-package-lock", "--prefix", l.project, tarball], { cwd: l.project, env: l.env, encoding: "utf8", timeout: 120_000 });
}

/** Every provenance and cache check of published-smoke.ts, on a real layout. */
function evidence(l: Layout) {
  const name = basename(l.tarball);
  const folders = readNpxFolders(l.cache, (p) => p);
  const npxDir = folders.find((f) => f.hasBuildOs)?.dir;
  const index = readCacheIndex(l.cache);
  const entries = index.entries;
  const found = findBuildOsFolders(l.root);
  return {
    entries,
    cache: [...index.incomplete, ...cacheIndexProblems(entries, l.identity, name), ...cacheContentProblems(l.identity, cacheContentSha256(l.cache, l.identity.integrity))],
    npxFolders: npxFolderProblems(folders, l.tarball),
    npxCopy: copyProblems("the npx install", npxDir !== undefined ? readInstalledCopy(npxDir, "npx") : undefined, l.identity, name),
    projectCopy: copyProblems("the project install", readInstalledCopy(l.project, "project"), l.identity, name),
    stray: [...found.incomplete, ...strayProblems(found.found, [join(l.project, "node_modules", "build-os"), ...(npxDir !== undefined ? [join(npxDir, "node_modules", "build-os")] : [])], WINDOWS)],
  };
}

const WINDOWS = process.platform === "win32";
/** The bin file of the package in `<base>/node_modules/build-os` for a bin name of the fixture. */
const binFile = (base: string, rel = "dist/buildos.js") => join(base, "node_modules", "build-os", ...rel.split("/"));
/** The launcher problems of a route, as published-smoke.ts checks them. */
function launcherCheck(base: string, names: string[], l: Layout): string[] {
  return launcherProblems("route", readLaunchers(join(base, "node_modules", ".bin"), names, WINDOWS, (p) => p), new Map(names.map((n) => [n, binFile(base, l.identity.binFiles.get(n))])), WINDOWS);
}

/** A fixture tarball with other bytes (same name and version, another bin text). */
const otherTarball = () => tarGz({ "package/package.json": JSON.stringify({ name: "build-os", version: "0.2.0", bin: { buildos: "dist/buildos.js" } }), "package/dist/buildos.js": "#!/usr/bin/env node\nconsole.log('other');\n" });

/** The PATH key of an environment (Path on Windows). */
const pathKey = (env: NodeJS.ProcessEnv) => Object.keys(env).find((k) => /^path$/i.test(k)) ?? "PATH";

/** A folder with a `buildos` that prints `fake` (a shell script and a .cmd). */
function fakeBuildosBin(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "buildos"), "#!/bin/sh\necho fake\n");
  chmodSync(join(dir, "buildos"), 0o755);
  writeFileSync(join(dir, "buildos.cmd"), "@echo fake\r\n");
}

describe("F-P9-15: the registry guard and the provenance checks (review round 1 of pull request 12, finding 1)", () => {
  it("drops the caller's npm offline, prefer, registry, cache, prefix, and bin-links settings and NODE_OPTIONS in any spelling, and sets offline, the blocked registry, the new cache, the new global prefix, bin links on, and the launch probe", () => {
    const env = guardedEnv(
      { PATH: "/bin", NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/", npm_config_prefer_online: "true", "npm_config_prefer-offline": "true", npm_config_OFFLINE: "false", NPM_CONFIG_CACHE: "/seeded-cache", npm_config_cache: "/c", NPM_CONFIG_PREFIX: "/global", NPM_CONFIG_BIN_LINKS: "false", "npm_config_bin-links": "false", npm_config_Bin_Links: "0", node_options: "--require /evil.cjs", SMOKE_LAUNCH_LOG: "/old" },
      { cache: "/new-cache", prefix: "/new-prefix", probe: "C:\\probe dir\\p\"x.cjs" },
    );
    assert.deepEqual(env, { PATH: "/bin", npm_config_offline: "true", npm_config_registry: BLOCKED_REGISTRY, npm_config_cache: "/new-cache", npm_config_prefix: "/new-prefix", npm_config_bin_links: "true", NODE_OPTIONS: '--require "C:\\\\probe dir\\\\p\\"x.cjs"' });
    assert.equal(BLOCKED_REGISTRY, "http://127.0.0.1:9/");
    assert.equal(PREFLIGHT_STDOUT, `offline=true\nregistry=${BLOCKED_REGISTRY}\nbin-links=true\n`);
    // Without a probe, NODE_OPTIONS is the caller's.
    assert.equal(guardedEnv({ NODE_OPTIONS: "--no-warnings" }, { cache: "/c", prefix: "/p" })["NODE_OPTIONS"], "--no-warnings");
  });

  it("real npm: with the guard, an npx fetch of build-os from a registry fails (ENOTCACHED), and the empty npm cache index then fails the cache check", () => {
    const l = layout();
    const r = npx(l, l.work, ["-y", "build-os@0.2.0", "version"]);
    assert.notEqual(r.status, 0, r.stdout);
    assert.match(r.stderr, /ENOTCACHED/);
    const e = evidence(l);
    assert.deepEqual(e.entries, []);
    assert.ok(e.cache.includes("the npm cache index is empty: no evidence that npm read the tarball"), e.cache.join("\n"));
    assert.ok(e.cache.some((p) => p.startsWith("the npm cache holds no content for the tarball's integrity")), e.cache.join("\n"));
    assert.deepEqual(e.npxCopy, ["the npx install: no build-os install was found"]);
  });

  it("real npm: the honest run (npx --package=<tarball>, then the project install) passes every check, with positive evidence for each copy", () => {
    const l = layout();
    const r = npxTarball(l);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.replace(/\r\n/g, "\n"), "stub\n");
    assert.equal(installIntoProject(l).status, 0);
    const e = evidence(l);
    assert.deepEqual(e, { entries: e.entries, cache: [], npxFolders: [], npxCopy: [], projectCopy: [], stray: [] });
    // npm 11's cache index records each read of the file as pacote:tarball:file:<path> with the file's sha512 integrity.
    assert.ok(e.entries.length >= 1);
    for (const entry of e.entries) {
      assert.ok(entry.key.startsWith("pacote:tarball:file:") && entry.key.endsWith("build-os-0.2.0.tgz"), entry.key);
      assert.equal(entry.integrity, l.identity.integrity);
    }
    assert.equal(cacheContentSha256(l.cache, l.identity.integrity), l.identity.sha256);
  });

  it("real npm: a cache pre-seeded with another build-os tarball, or an index that names another tarball, fails", () => {
    // Pre-seeded: another tarball of the same name ran first into the same cache; then the honest run.
    const seeded = layout();
    const other = join(temp(), "build-os-0.2.0.tgz");
    writeFileSync(other, otherTarball());
    assert.equal(npxTarball(seeded, other).stdout.replace(/\r\n/g, "\n"), "other\n");
    assert.equal(npxTarball(seeded).stdout.replace(/\r\n/g, "\n"), "stub\n");
    const e1 = evidence(seeded);
    assert.ok(e1.cache.some((p) => p.includes("has the integrity sha512-") && p.includes("not the tarball's")), e1.cache.join("\n"));
    assert.ok(e1.npxFolders.includes("the npx cache holds 2 install folders, not 1"), e1.npxFolders.join("\n"));
    // Only another tarball ran: the index names another tarball, and the npx install is not the tarball's.
    const wrong = layout();
    const otherOnly = join(temp(), "build-os-0.2.0.tgz");
    writeFileSync(otherOnly, otherTarball());
    assert.equal(npxTarball(wrong, otherOnly).status, 0);
    const e2 = evidence(wrong);
    assert.ok(e2.cache.some((p) => p.includes("not the tarball's")), e2.cache.join("\n"));
    assert.ok(e2.cache.some((p) => p.startsWith("the npm cache holds no content for the tarball's integrity")));
    assert.ok(e2.npxFolders.some((p) => p.includes("was made for") && p.includes("not for the tarball file alone")), e2.npxFolders.join("\n"));
    assert.ok(e2.npxCopy.some((p) => p.endsWith("dist/buildos.js is not the tarball's file")), e2.npxCopy.join("\n"));
  });

  it("real npm: changed bytes, an extra file, or a missing lockfile entry in either install fails", () => {
    const l = layout();
    npxTarball(l);
    installIntoProject(l);
    const npxDir = readNpxFolders(l.cache, (p) => p)[0]!.dir;
    appendFileSync(join(npxDir, "node_modules", "build-os", "dist", "buildos.js"), "// changed\n");
    writeFileSync(join(l.project, "node_modules", "build-os", "extra.js"), "planted\n");
    const e = evidence(l);
    assert.deepEqual(e.npxCopy, ["the npx install (npx): dist/buildos.js is not the tarball's file"]);
    assert.deepEqual(e.projectCopy, ["the project install (project): extra.js is not in the tarball"]);
    rmSync(join(l.project, "node_modules", ".package-lock.json"));
    assert.ok(evidence(l).projectCopy.includes("the project install (project): no node_modules/build-os entry in node_modules/.package-lock.json"));
  });

  it("real npm: a build-os first on PATH is not used (npx puts its own install first), and one in a global prefix is not used and, inside the run's root, fails", () => {
    const fake = join(temp(), "bin");
    fakeBuildosBin(fake);
    const key = pathKey(process.env);
    const onPath = layout(fixtureTarball(), { ...process.env, [key]: `${fake}${delimiter}${process.env[key] ?? ""}` });
    assert.equal(spawnSync("buildos", [], { env: onPath.env, encoding: "utf8", shell: process.platform === "win32" }).stdout.trim(), "fake", "the fake buildos is first on PATH");
    assert.equal(npxTarball(onPath).stdout.replace(/\r\n/g, "\n"), "stub\n", "npx ran the tarball's install, not the PATH copy");
    // A global prefix of the caller with another build-os: the guard replaces the prefix with the new empty folder.
    const global = temp();
    mkdirSync(join(global, "lib", "node_modules", "build-os"), { recursive: true });
    writeFileSync(join(global, "lib", "node_modules", "build-os", "package.json"), JSON.stringify({ name: "build-os", version: "0.2.0", bin: { buildos: "b.js" } }));
    fakeBuildosBin(join(global, "bin"));
    const withGlobal = layout(fixtureTarball(), { ...process.env, NPM_CONFIG_PREFIX: global, npm_config_prefix: global });
    const prefix = spawnSync(process.execPath, [npmCli("npm"), "config", "get", "prefix"], { cwd: withGlobal.work, env: withGlobal.env, encoding: "utf8" });
    assert.equal(prefix.stdout.trim(), withGlobal.prefix);
    assert.equal(npxTarball(withGlobal).stdout.replace(/\r\n/g, "\n"), "stub\n");
    assert.deepEqual(evidence(withGlobal).stray, []);
    // A build-os in the run's own global prefix (below the root) fails the folder check.
    const planted = join(withGlobal.prefix, "lib", "node_modules", "build-os");
    mkdirSync(planted, { recursive: true });
    assert.deepEqual(evidence(withGlobal).stray, [`another build-os folder is below the temporary root: ${planted}`]);
  });

  it("stubs: every index entry that is not a tarball file entry, names another file, has another integrity, or is not an entry fails, and so does missing or other cache content", () => {
    const identity: TarballIdentity = { sha256: "b".repeat(64), integrity: "sha512-good", name: "build-os", version: "0.2.0", bins: {}, binFiles: new Map(), files: new Map(), nonFileEntries: [] };
    const entries = cacheIndexEntries([
      `abc\t${JSON.stringify({ key: "pacote:tarball:file:/t/build-os-0.2.0.tgz", integrity: "sha512-good" })}\n`,
      `def\t${JSON.stringify({ key: "make-fetch-happen:request-cache:https://registry.npmjs.org/build-os", integrity: "sha512-x" })}\nghi\tnot json\n`,
      `jkl\t${JSON.stringify({ key: "pacote:tarball:file:../other.tgz", integrity: "sha512-good" })}\nmno\t${JSON.stringify({ key: "pacote:tarball:file:C:\\t\\build-os-0.2.0.tgz", integrity: "sha512-bad" })}\n`,
    ]);
    assert.equal(entries.length, 5);
    assert.deepEqual(cacheIndexProblems([entries[0]!], identity, "build-os-0.2.0.tgz"), []);
    assert.deepEqual(cacheIndexProblems(entries, identity, "build-os-0.2.0.tgz"), [
      "the npm cache holds an entry that is not a tarball file entry: make-fetch-happen:request-cache:https://registry.npmjs.org/build-os",
      "the npm cache holds an entry that is not a tarball file entry: (an index line that is not an entry)",
      // Review round 2, finding 4: an error shows a tarball file key by its file name only, as the normal output does.
      "the npm cache holds an entry for another file: pacote:tarball:file:.../other.tgz",
      "the npm cache entry pacote:tarball:file:.../build-os-0.2.0.tgz has the integrity sha512-bad, not the tarball's sha512-good",
    ]);
    assert.deepEqual(cacheIndexProblems([], identity, "build-os-0.2.0.tgz"), ["the npm cache index is empty: no evidence that npm read the tarball"]);
    // The report shows a tarball file key by its file name only (finding 3: the relative path names runner folders).
    assert.equal(reportCacheKey("pacote:tarball:file:../../../../runner-folder/build-os-0.2.0.tgz"), "pacote:tarball:file:.../build-os-0.2.0.tgz");
    assert.equal(reportCacheKey("pacote:tarball:file:C:\\a\\build-os-0.2.0.tgz"), "pacote:tarball:file:.../build-os-0.2.0.tgz");
    assert.equal(reportCacheKey("make-fetch-happen:request-cache:https://registry.npmjs.org/build-os"), "make-fetch-happen:request-cache:https://registry.npmjs.org/build-os");
    assert.deepEqual(cacheContentProblems(identity, identity.sha256), []);
    assert.equal(cacheContentProblems(identity, undefined).length, 1);
    assert.equal(cacheContentProblems(identity, "c".repeat(64)).length, 1);
    assert.deepEqual(npxFolderProblems([], "/t/x.tgz"), ["the npx cache holds 0 install folders, not 1"]);
    // Finding 2: every folder below _npx counts, also one without build-os.
    assert.deepEqual(npxFolderProblems([{ where: "a", packages: ["/t/x.tgz"], hasBuildOs: true }, { where: "b", packages: ["/t/x.tgz"], hasBuildOs: false }], "/t/x.tgz"), ["the npx cache holds 2 install folders, not 1"]);
    assert.deepEqual(npxFolderProblems([{ where: "a", packages: ["/t/x.tgz"], hasBuildOs: false }], "/t/x.tgz"), ["the npx folder a holds no node_modules/build-os"]);
    assert.deepEqual(strayProblems(["/r/a/node_modules/build-os"], []), ["another build-os folder is below the temporary root: /r/a/node_modules/build-os"]);
    // Finding 2: on Windows the folder names compare case-insensitively, with either separator.
    assert.deepEqual(strayProblems(["C:\\R\\Project\\node_modules\\build-os"], ["c:/r/project/node_modules/build-os"], true), []);
    assert.equal(strayProblems(["C:\\R\\Project\\node_modules\\build-os"], ["c:/r/project/node_modules/build-os"], false).length, 1);
  });
});

/** Steps for tarballClaims, each with a role and an outcome. */
function outcomes(overrides: Partial<Record<string, boolean>> = {}, omit: string[] = []): StepOutcome[] {
  const roles = ["guard-preflight", "direct", "direct", "npx-copy", "wrapper-missing", "project-install", "wrapper", "fix-check", "fix-run", "fix-after", "project-copy", "cache-guard"] as const;
  return roles.filter((r) => !omit.includes(r)).map((role, i) => ({ name: `${role} ${i}`, role, ok: overrides[role] ?? true, checks: [{ check: role === "fix-check" ? "0.1.0 prints a bare buildos (the known defect F-P8-11, fixed in 0.2.0); the step does not run it" : "ok", ok: true }] }));
}
const TARBALL = { version: "0.2.0", sha256: "a".repeat(64), integrity: "sha512-x" };
const RAN_CLAIM = /ran that text|ran the printed|through the system shell/;

describe("F-P9-15: the report claims only what ran (review round 1 of pull request 12, finding 2)", () => {
  it("every step ran and passed: four claims, nothing unproven, nothing that ran nothing", () => {
    const c = tarballClaims(outcomes(), TARBALL);
    assert.equal(c.proves.length, 4);
    assert.ok(c.proves.some((p) => p.startsWith("Step 10 ") && RAN_CLAIM.test(p)));
    assert.deepEqual(c.not_proven, []);
    assert.deepEqual(c.not_run, []);
  });

  it("step 10 skipped its run (the 0.1.0 form): no claim says it ran, and not_run gives the step's own reason", () => {
    const c = tarballClaims(outcomes({}, ["fix-run", "fix-after"]), TARBALL);
    for (const line of [...c.proves, ...c.not_proven]) assert.doesNotMatch(line, RAN_CLAIM, line);
    assert.deepEqual(c.not_run, ["Step 10 ran no printed command: 0.1.0 prints a bare buildos (the known defect F-P8-11, fixed in 0.2.0); the step does not run it"]);
    assert.equal(c.proves.length, 3);
  });

  it("a failed step moves each claim that rests on it to not_proven, with the step's name; a run stopped after the preflight proves nothing", () => {
    const c = tarballClaims(outcomes({ "npx-copy": false }), TARBALL);
    assert.ok(c.not_proven.some((p) => p.startsWith("The 2 direct runs") && p.endsWith('Not proven: step "npx-copy 3" failed.')), c.not_proven.join("\n"));
    assert.equal(c.proves.length, 3);
    const stopped = tarballClaims([{ name: "preflight", role: "guard-preflight", ok: false, checks: [] }], TARBALL);
    assert.deepEqual(stopped.proves, []);
    assert.equal(stopped.not_proven.length, 3);
    assert.deepEqual(stopped.not_run, ["Step 10 did not run."]);
    assert.ok(TARBALL_MODE_LIMITS.does_not_prove.every((line) => !RAN_CLAIM.test(line)));
  });
});

/** A preload module that stubs every process start of published-smoke.ts and logs it; `npm config get offline registry bin-links` prints STUB_PREFLIGHT_STDOUT, and the project install leaves a cache index entry for another file. */
const PRELOAD = `import { createRequire, syncBuiltinESMExports } from "node:module";
const require = createRequire(import.meta.url);
const cp = require("node:child_process");
const fs = require("node:fs");
cp.spawnSync = (file, args = [], opts = {}) => {
  const all = [file, ...args].join(" ");
  fs.appendFileSync(process.env.STUB_LOG, all + "\\n");
  const out = / config get offline registry bin-links$/.test(all) ? process.env.STUB_PREFLIGHT_STDOUT : "";
  // Finding 4: an npm install call leaves a cache index entry whose key names a runner folder by a relative path, as npm records it.
  if (/ install --offline /.test(all) && opts.env && opts.env.npm_config_cache) {
    const dir = opts.env.npm_config_cache + "/_cacache/index-v5/aa/bb";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dir + "/cc", "x\\t" + JSON.stringify({ key: "pacote:tarball:file:../../runner-work/example.tgz", integrity: "sha512-other" }) + "\\n");
  }
  return { status: 0, signal: null, pid: 0, output: [], stdout: opts.encoding ? out : Buffer.from(out), stderr: opts.encoding ? "" : Buffer.alloc(0) };
};
syncBuiltinESMExports();
`;

/** Runs published-smoke.ts on a fixture tarball with every process start stubbed, its temporary root below a new folder. */
function stubbedSmoke(version: string, preflight: string) {
  const dir = temp();
  const tmp = join(dir, "tmp");
  mkdirSync(tmp);
  const preload = join(dir, "preload.mjs");
  writeFileSync(preload, PRELOAD);
  const tarball = join(dir, `build-os-${version}.tgz`);
  writeFileSync(tarball, fixtureTarball({ version }));
  const out = join(dir, "out");
  const log = join(dir, "log.txt");
  writeFileSync(log, "");
  const r = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, SMOKE, "--tarball", tarball, "--sha256", sha256Hex(readFileSync(tarball)), "--out", out], {
    encoding: "utf8",
    env: { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp, STUB_LOG: log, STUB_PREFLIGHT_STDOUT: preflight },
    timeout: 120_000,
  });
  const name = readdirSync(out).find((f) => f.endsWith(".json"))!;
  return { r, tmp, log: readFileSync(log, "utf8"), json: readFileSync(join(out, name), "utf8"), md: readFileSync(join(out, name.replace(/\.json$/, ".md")), "utf8") };
}

/** Every spelling of a path that a report could hold. */
function pathForms(path: string): string[] {
  const forms = new Set([path, realpathSync.native(path)]);
  for (const f of [...forms]) {
    forms.add(JSON.stringify(f).slice(1, -1));
    forms.add(f.replace(/\\/g, "/"));
  }
  return [...forms];
}

describe("F-P9-15: the script's preflight stop and its report (review round 1 of pull request 12, findings 1 to 3)", () => {
  it("a failed preflight stops the run before step 1: one step in the report, no npx or install started, and nothing claimed", () => {
    const s = stubbedSmoke("0.2.0", "offline=true\nregistry=http://127.0.0.1:9/\nbin-links=false\n");
    assert.equal(s.r.status, 1, s.r.stderr);
    assert.match(s.r.stdout, /FAILED \(0 of 1 steps\)\n {2}STOPPED: the registry guard preflight failed/);
    const report = JSON.parse(s.json) as { passed: boolean; stopped?: string; steps: { role?: string }[]; tarball_mode: { proves: string[]; not_run: string[] } };
    assert.equal(report.passed, false);
    assert.match(report.stopped ?? "", /stopped before step 1 and no other step ran/);
    assert.deepEqual(report.steps.map((x) => x.role), ["guard-preflight"]);
    assert.deepEqual(report.tarball_mode.proves, []);
    assert.deepEqual(report.tarball_mode.not_run, ["Step 10 did not run."]);
    const calls = s.log.trim().split("\n");
    assert.equal(calls.length, 2, s.log);
    assert.ok(calls[0]!.endsWith(" config get offline registry bin-links") && calls[1]!.endsWith(" --version"), s.log);
    assert.match(s.md, /\nStopped: the registry guard preflight failed/);
  });

  for (const version of ["0.2.0", "0.1.0"]) {
    it(`${version}: the report holds no path under the temporary root or the home folder (check labels included), and never claims a step that did not run`, () => {
      const s = stubbedSmoke(version, PREFLIGHT_STDOUT);
      assert.equal(s.r.status, 1, "stubbed processes print nothing, so checks fail");
      const report = JSON.parse(s.json) as { steps: { name: string; role?: string; checks: { check: string; ok: boolean }[] }[]; tarball_mode: { proves: string[]; not_proven: string[]; not_run: string[]; compares: string } };
      for (const text of [s.json, s.md]) for (const p of [...pathForms(s.tmp), ...pathForms(homedir())]) assert.ok(!text.includes(p), `the report holds ${p}`);
      if (version === "0.2.0") assert.ok(report.steps.some((x) => x.checks.some((c) => c.check.includes("--root '{PROJECT}'") || c.check.includes('--root "{PROJECT}"'))), "a check label held the project path, now {PROJECT}");
      assert.ok(!report.steps.some((x) => x.role === "fix-run"), "step 10 ran nothing");
      for (const line of [...report.tarball_mode.proves, ...report.tarball_mode.not_proven]) assert.doesNotMatch(line, RAN_CLAIM, line);
      assert.equal(report.tarball_mode.not_run.length, 1);
      assert.match(report.tarball_mode.not_run[0]!, version === "0.1.0" ? /^Step 10 ran no printed command: 0\.1\.0 prints a bare buildos/ : /^Step 10 ran no printed command: the printed command did not match/);
      assert.doesNotMatch(s.md, /through the system shell, with npm taking/);
      // Review round 2, finding 3: no fixed step or check name says that something ran; only the claims, made from outcomes, may.
      for (const step of report.steps) {
        assert.doesNotMatch(step.name, /\b(ran|started)\b/, step.name);
        for (const c of step.checks) assert.doesNotMatch(c.check.replace(/\bran nothing\b/g, ""), /\b(ran|started)\b/, c.check);
      }
      assert.ok(report.steps.some((x) => x.name === "verify the project and npx installs and their launchers (tarball mode, after step 10)"));
      // Review round 2, finding 4: a failed cache check (an entry for another file, recorded by a relative path) shows the key by its file name only.
      const cacheStep = report.steps.find((x) => x.role === "cache-guard")!;
      assert.ok(cacheStep.checks.some((c) => !c.ok), "the cache check failed");
      for (const text of [s.json, s.md]) {
        assert.ok(!text.includes("runner-work"), "the report holds the relative runner path of a cache key");
        assert.ok(text.includes("the npm cache holds an entry for another file: pacote:tarball:file:.../example.tgz"), "the failure names the file");
      }
      assert.match(report.tarball_mode.compares, /^Each install is compared with the tarball by the bytes \(SHA-256\) of each regular file/);
    });
  }
});

describe("F-P9-15: the order of the checks in published-smoke.ts", () => {
  const text = readFileSync(SMOKE, "utf8");

  it("sets the guard for every process in tarball mode, checks it first and stops on failure, checks the npx install after step 7, and the project install and the cache after step 10", () => {
    assert.match(text, /\nconst baseEnv: NodeJS\.ProcessEnv = source\.kind === "tarball" \? guardedEnv\(callerEnv, \{ cache, prefix: globalPrefix, probe \}\) : callerEnv;\n/);
    assert.match(text, /\nconst root = realpathSync\.native\(mkdtempSync\(join\(tmpdir\(\), "buildos-smoke-"\)\)\);\n/);
    assert.equal(text.match(/const env = opts\.env \?\? baseEnv;/g)?.length, 1, "run() uses baseEnv");
    assert.match(text, /env: launchLog !== undefined \? \{ \.\.\.env, \[PROBE_LOG_VARIABLE\]: launchLog \} : env,/);
    assert.equal(text.match(/\bcallerEnv\b/g)?.length, 5, "callerEnv is built, cleaned, and guarded, and used nowhere else");
    const first = text.indexOf("// 0. Tarball mode only: the registry guard is on");
    const step1 = text.indexOf("// 1. version, human and JSON.");
    assert.ok(first > 0 && first < step1);
    assert.match(text.slice(first, step1), /"config", "get", "offline", "registry", "bin-links"\]/);
    assert.match(text.slice(first, step1), /, step\.stdout === PREFLIGHT_STDOUT\);\n {2}if \(!step\.checks\.every\(\(c\) => c\.ok\)\) finish\("the registry guard preflight failed/);
    const npxCheck = text.indexOf("// Tarball mode only, after step 7 and before the project install exists");
    assert.ok(npxCheck > text.indexOf("// 7. One legacy name") && npxCheck < text.indexOf("// 8. The project wrapper with Node.js missing"));
    const last = text.indexOf("// Tarball mode only, after step 10:");
    assert.ok(last > text.indexOf("printedFixStep({") && last < text.lastIndexOf("finish();"));
    assert.match(text.slice(last), /copyProblems\("the project install", copy, id, name\)/);
    assert.match(text.slice(last), /cacheIndexProblems\(entries, id, name\)/);
    assert.match(text.slice(last), /launcherProblems\("the project route", projectLaunchers/);
    assert.match(text.slice(npxCheck, text.indexOf("// 8. The project wrapper with Node.js missing")), /launcherProblems\("the npx route", launchers, expected, WINDOWS\)/);
    assert.match(text.slice(last), /cacheContentProblems\(id, cacheContentSha256\(cache, id\.integrity\)\)/);
  });

  it("installs the tarball into the project, offline and with install scripts off, after the Node.js-missing step and before the wrapper step", () => {
    const at = text.indexOf("// Tarball mode only, before step 9:");
    assert.ok(at > text.indexOf("// 8. The project wrapper with Node.js missing") && at < text.indexOf("// 9. The project wrapper with Node.js present"));
    assert.match(text, /\[\.\.\.npm\.prefix, "install", "--offline", "--ignore-scripts", "--no-save", "--no-package-lock", "--prefix", project, source\.file\]/);
    assert.match(text, /check\(step, `node_modules\/build-os in the project is \$\{version\}, the pinned version`, installed === version\);/);
  });

  it("checks the SHA-256 before the temporary root exists, and the version comes from the tarball", () => {
    assert.ok(text.indexOf("if (actual !== source.sha256)") < text.indexOf("const root = realpathSync.native(mkdtempSync("));
    assert.match(text, /\nconst version = identity !== undefined \? identity\.version : source\.kind === "registry" \? source\.version : "";\n/);
  });

  it("the report records the mode, the package source, the tarball's file name, SHA-256, integrity, and version, the claims made from the steps, and the fixed limits", () => {
    assert.match(text, /\n {4}mode: source\.kind,\n {4}package_source: packageSource,\n {4}tarball: tarballRecord,\n {4}\.\.\.\(claims !== null && identity !== undefined \? \{ tarball_mode: \{ \.\.\.claims, compares: comparisonStatement\(identity\), does_not_prove: TARBALL_MODE_LIMITS\.does_not_prove \}, launchers: launcherRecord \} : \{\}\),\n/);
    assert.match(text, /const claims = identity !== undefined \? tarballClaims\(reported, \{ version, sha256: identity\.sha256, integrity: identity\.integrity \}\) : null;/);
    assert.match(text, /\{ file: basename\(source\.file\), sha256: identity\.sha256, integrity: identity\.integrity, name: identity\.name, version: identity\.version, file_count: identity\.files\.size, non_file_entries: identity\.nonFileEntries, bin_sha256: identity\.bins \}/);
    assert.ok(TARBALL_MODE_LIMITS.does_not_prove.some((line) => line.includes("npx -y build-os@<version> fetches the package from the public registry") && line.includes("runbook step k")));
    assert.ok(TARBALL_MODE_LIMITS.does_not_prove.some((line) => line.includes("step h1")));
    assert.deepEqual(Object.keys(TARBALL_MODE_LIMITS), ["does_not_prove"]);
  });
});

describe("F-P9-15: step 10 in tarball mode", () => {
  const PROJECT = "/tmp/smoke/project";

  function stubbed(options: { source?: "registry" | "tarball"; printed?: string; human?: string }) {
    const expected = expectedRebuild(PROJECT, "0.2.0", false);
    const printed = options.printed ?? expected;
    const shellRuns: { name: string; command: string }[] = [];
    const failed: string[] = [];
    let validates = 0;
    const step = (stdout: string): RanStep => ({ stdout, stderr: "", exit: 0 });
    printedFixStep({
      version: "0.2.0",
      ...(options.source !== undefined ? { source: options.source } : {}),
      windows: false,
      project: PROJECT,
      humanStdout: options.human ?? `entities.validate: ok\n${expectedActionLine(printed, false)}\n`,
      npxRun: () => step(JSON.stringify(validates++ === 0 ? { ok: true, result: { index: { state: "missing", current: false, remediation_command: printed } }, diagnostics: [] } : { ok: true, result: { index: { state: "current", current: true } }, diagnostics: [] })),
      shellRun: (name, command) => {
        shellRuns.push({ name, command });
        return step("entities.rebuild-index: ok\nwrite status: applied\n");
      },
      check: (_s, what, ok) => {
        if (!ok) failed.push(what);
      },
    });
    return { expected, shellRuns, failed };
  }

  it("checks the printed text exactly, runs that same text through the shell, and the step name states no result (the launch check records what ran) and that the registry fetch waits for step k", () => {
    const r = stubbed({ source: "tarball" });
    assert.deepEqual(r.failed, []);
    assert.equal(r.shellRuns.length, 1);
    assert.equal(r.shellRuns[0]!.command, "npx -y build-os@0.2.0 entities rebuild-index --root '/tmp/smoke/project' --mode compat --apply");
    assert.match(r.shellRuns[0]!.name, /^the printed fix command, as printed, in sh \(tarball mode, registry blocked: the launch check after step 10 records which program ran; the registry fetch of this literal command is proven only after publication, runbook step k\)$/);
    assert.equal(stubbed({}).shellRuns[0]!.name, "the printed fix command, as printed, in sh");
  });

  it("a mismatch in the JSON field or the human line still runs nothing in tarball mode", () => {
    const expected = expectedRebuild(PROJECT, "0.2.0", false);
    for (const r of [stubbed({ source: "tarball", human: "  action: something else\n" }), stubbed({ source: "tarball", printed: `${expected} ; echo planted`, human: `${expectedActionLine(expected, false)}\n` })]) {
      assert.deepEqual(r.shellRuns, []);
      assert.ok(r.failed.some((what) => what.includes("ran nothing")));
    }
  });

  it("published-smoke.ts passes the mode to step 10", () => {
    assert.match(readFileSync(SMOKE, "utf8"), /\nprintedFixStep\(\{\n {2}version,\n {2}source: source\.kind,\n/);
  });
});

/** npm's cmd-shim (the module that writes npm's Windows launchers), from the npm next to this Node.js. */
function cmdShim(): (from: string, to: string) => Promise<void> {
  const req = createRequire(npmCli("npm"));
  return req(join(dirname(npmCli("npm")), "..", "node_modules", "cmd-shim")) as (from: string, to: string) => Promise<void>;
}

/** A script that prints `fake`, outside every install. */
function fakeScript(): string {
  const file = join(temp(), "elsewhere", "buildos.js");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "#!/usr/bin/env node\nconsole.log('fake');\n");
  chmodSync(file, 0o755);
  return file;
}

/** Removes every launcher file of `name` in a bin folder (the link, or the sh, .cmd, and PowerShell shims). */
function removeLauncher(binDir: string, name: string): void {
  for (const ext of ["", ".cmd", ".ps1"]) rmSync(join(binDir, `${name}${ext}`), { force: true });
}

const CAN_CHMOD = process.platform !== "win32" && process.getuid?.() !== 0;

describe("F-P9-15: which executable ran (review round 2 of pull request 12, finding 1)", () => {
  it("real npm: bin links off in the caller's environment (any spelling) and in the caller's npm config file are forced on; the launchers of both routes resolve into the verified copies, and the probe shows the package's bin file ran", () => {
    const userconfig = join(temp(), "npmrc");
    writeFileSync(userconfig, "bin-links=false\n");
    const l = layout(fixtureTarball(), { ...process.env, NPM_CONFIG_BIN_LINKS: "false", "npm_config_bin-links": "false", npm_config_userconfig: userconfig });
    const get = (env: NodeJS.ProcessEnv) => spawnSync(process.execPath, [npmCli("npm"), "config", "get", "offline", "registry", "bin-links"], { cwd: l.work, env, encoding: "utf8" }).stdout.replace(/\r\n/g, "\n");
    assert.equal(get(l.env), PREFLIGHT_STDOUT, "the preflight reads bin-links=true");
    const withoutForce = { ...l.env };
    delete withoutForce["npm_config_bin_links"];
    assert.match(get(withoutForce), /bin-links=false\n$/, "the caller's config file says false; only the forced value makes it true");
    const r = npxTarball(l);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.replace(/\r\n/g, "\n"), "stub\n");
    const npxDir = readNpxFolders(l.cache, (p) => p)[0]!.dir;
    assert.deepEqual(launchProblems("version", lastLaunches(), [binFile(npxDir)], [], WINDOWS), []);
    assert.ok(lastLaunches().some((x) => x.real !== null && x.real.endsWith(join("build-os", "dist", "buildos.js"))));
    assert.deepEqual(launcherCheck(npxDir, ["buildos", "buildos-intake"], l), []);
    assert.equal(installIntoProject(l).status, 0);
    assert.deepEqual(launcherCheck(l.project, ["build-os", "buildos"], l), []);
  });

  it("real npm: without the forced value, an npx install with bin links off has no launcher: the run fails (the review's exit 127), and the launcher and probe checks name the cause", () => {
    const l = layout();
    const r = npx(l, l.work, ["-y", `--package=${l.tarball}`, "--", "buildos"], { ...l.env, npm_config_bin_links: "false" });
    assert.notEqual(r.status, 0, r.stdout);
    const npxDir = readNpxFolders(l.cache, (p) => p)[0]!.dir;
    assert.deepEqual(launchProblems("version", lastLaunches(), [binFile(npxDir)], [], WINDOWS), [`step "version": no Node.js process ran ${binFile(npxDir)}`]);
    const problems = launcherCheck(npxDir, ["buildos"], l);
    assert.ok(problems.length > 0 && problems.every((p) => /^route: the launcher .*buildos(\.cmd|\.ps1)? is missing$/.test(p)), problems.join("\n"));
  });

  it("real npm: a launcher replaced by one that points elsewhere fails the launcher check and the probe check, and names the cause", async () => {
    const l = layout();
    assert.equal(npxTarball(l).status, 0);
    const npxDir = readNpxFolders(l.cache, (p) => p)[0]!.dir;
    const binDir = join(npxDir, "node_modules", ".bin");
    const fake = fakeScript();
    removeLauncher(binDir, "buildos");
    if (WINDOWS) await cmdShim()(fake, join(binDir, "buildos"));
    else symlinkSync(fake, join(binDir, "buildos"));
    const problems = launcherCheck(npxDir, ["buildos"], l);
    assert.ok(problems.length > 0 && problems.every((p) => p.includes(`resolves to ${realpathSync.native(fake)}`) || p.toLowerCase().includes(realpathSync.native(fake).toLowerCase())), problems.join("\n"));
    assert.ok(problems.every((p) => p.endsWith(`not to the package's bin file ${binFile(npxDir)}`)), problems.join("\n"));
    const r = npxTarball(l);
    assert.equal(r.stdout.replace(/\r\n/g, "\n"), "fake\n", "the replaced launcher ran: the output checks alone cannot tell");
    const ran = launchProblems("version", lastLaunches(), [binFile(npxDir)], [], WINDOWS);
    assert.ok(ran.some((p) => p.startsWith('step "version": a Node.js process ran ') && p.toLowerCase().includes(realpathSync.native(fake).toLowerCase())), ran.join("\n"));
    assert.ok(ran.includes(`step "version": no Node.js process ran ${binFile(npxDir)}`), ran.join("\n"));
  });

  it("real npm: a launcher removed after the install fails the launcher check of the project route, and names the launcher", () => {
    const l = layout();
    assert.equal(installIntoProject(l).status, 0);
    removeLauncher(join(l.project, "node_modules", ".bin"), "build-os");
    const problems = launcherCheck(l.project, ["build-os", "buildos"], l);
    assert.ok(problems.length > 0, "a problem");
    for (const p of problems) assert.match(p, /^route: the launcher .*build-os(\.cmd|\.ps1)? is missing$/);
  });

  it("Windows shims, on every system: npm's own cmd-shim output resolves to its target (compared case-insensitively), and a shim with another or a second target fails", async () => {
    const base = temp();
    const target = join(base, "node_modules", "build-os", "dist", "buildos.js");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, BIN);
    const binDir = join(base, "node_modules", ".bin");
    mkdirSync(binDir);
    await cmdShim()(target, join(binDir, "buildos"));
    const cmd = readFileSync(join(binDir, "buildos.cmd"), "utf8");
    const ps1 = readFileSync(join(binDir, "buildos.ps1"), "utf8");
    assert.equal(cmdShimTarget(cmd), "..\\build-os\\dist\\buildos.js");
    assert.equal(ps1ShimTarget(ps1), "../build-os/dist/buildos.js");
    const read = readLaunchers(binDir, ["buildos"], true, (p) => p);
    assert.deepEqual(read[0]!.files.map((x) => x.kind), ["cmd", "ps1"]);
    assert.deepEqual(launcherProblems("route", read, new Map([["buildos", target]]), true), []);
    assert.deepEqual(launcherProblems("route", read, new Map([["buildos", target.toUpperCase()]]), true), [], "case-insensitive on Windows");
    // Fixture texts: the older %~dp0 form, a second target, and another target.
    assert.equal(cmdShimTarget('@"%~dp0\\..\\build-os\\dist\\buildos.js" %*\r\n'), "..\\build-os\\dist\\buildos.js");
    assert.equal(cmdShimTarget(`${cmd}\r\n"%dp0%\\..\\other\\x.js" %*\r\n`), undefined);
    assert.equal(ps1ShimTarget(`${ps1}\n& "$basedir/../other/x.js" $args\n`), undefined);
    assert.equal(cmdShimTarget("@echo fake\r\n"), undefined);
    writeFileSync(join(binDir, "buildos.cmd"), cmd.split("..\\build-os\\dist\\buildos.js").join("..\\..\\..\\elsewhere\\buildos.js"));
    writeFileSync(join(binDir, "buildos.ps1"), `${ps1}\n& "$basedir/../other/x.js" $args\n`);
    const bad = launcherProblems("route", readLaunchers(binDir, ["buildos"], true, (p) => p), new Map([["buildos", target]]), true);
    assert.equal(bad.length, 2, bad.join("\n"));
    assert.match(bad[0]!, /buildos\.cmd resolves to .*elsewhere.buildos\.js, not to the package's bin file /);
    assert.match(bad[1]!, /buildos\.ps1 names no single target \(the shim text names no single target\)$/);
  });

  it("stubs: on macOS and Linux a launcher that is a regular file is not npm's link; a launch log line that is not a record, and a program outside the copy, fail", () => {
    const want = new Map([["buildos", "/r/c/node_modules/build-os/dist/buildos.js"]]);
    assert.deepEqual(launcherProblems("route", [{ name: "buildos", files: [{ where: "w", kind: "file", resolved: "/r/c/node_modules/build-os/dist/buildos.js" }] }], want, false), ["route: the launcher w is a regular file, not npm's symbolic link"]);
    assert.deepEqual(launcherProblems("route", [], want, false), ["route: no launcher was read for the bin buildos"]);
    assert.deepEqual(launcherProblems("route", [{ name: "buildos", files: [{ where: "w", kind: "symlink", resolved: "/R/C/node_modules/build-os/dist/buildos.js" }] }], want, false).length, 1, "case-sensitive off Windows");
    const records = launchRecords('{"argv1":"/n/npx","real":"/n/lib/node_modules/npm/bin/npx-cli.js"}\nnot json\n{"argv1":"/x","real":"/x/buildos.js"}\n');
    assert.deepEqual(launchProblems("s", records, ["/r/c/node_modules/build-os/dist/buildos.js"], [], false), [
      'step "s": a Node.js process ran (no main script), whose real path could not be read',
      'step "s": a Node.js process ran /x/buildos.js, not /r/c/node_modules/build-os/dist/buildos.js',
      'step "s": no Node.js process ran /r/c/node_modules/build-os/dist/buildos.js',
    ]);
    assert.deepEqual(launchProblems("s", launchRecords('{"argv1":"h","real":"/p/.os/scripts/pinned-version.cjs"}\n{"argv1":"b","real":"/r/c/node_modules/build-os/dist/buildos.js"}\n'), ["/r/c/node_modules/build-os/dist/buildos.js"], ["/p/.os/scripts/pinned-version.cjs"], false), []);
  });

  it("the launch probe writes one record per Node.js process to the step's log and nothing to stdout or stderr", () => {
    const dir = temp();
    const probe = join(dir, "probe dir", "probe.cjs");
    mkdirSync(dirname(probe));
    writeFileSync(probe, PROBE_SOURCE);
    const script = join(dir, "main.cjs");
    writeFileSync(script, "process.stdout.write('out');");
    const log = join(dir, "log.jsonl");
    const env = { ...guardedEnv(process.env, { cache: join(dir, "c"), prefix: join(dir, "p"), probe }), [PROBE_LOG_VARIABLE]: log };
    const r = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(r.stdout, "out");
    assert.equal(r.stderr, "");
    assert.deepEqual(launchRecords(readFileSync(log, "utf8")).map((x) => x.real), [realpathSync.native(script)]);
  });
});

describe("F-P9-15: what the install comparison covers (review round 2 of pull request 12, finding 2)", () => {
  it("real npm: an extra file named like an inherited object key (constructor, toString, __proto__) fails as not in the tarball, and a tarball file of such a name is compared like any other", () => {
    const l = layout();
    assert.equal(installIntoProject(l).status, 0);
    for (const name of ["constructor", "toString", "__proto__"]) writeFileSync(join(l.project, "node_modules", "build-os", name), "planted\n");
    assert.deepEqual(evidence(l).projectCopy, ["__proto__", "constructor", "toString"].map((n) => `the project install (project): ${n} is not in the tarball`));
    const id = readTarballIdentity(fixtureTarball({}, { "package/constructor": "c\n", "package/__proto__": "p\n" }));
    assert.ok(id.files.has("constructor") && id.files.has("__proto__"));
    const copy = { where: "w", files: new Map([...id.files].filter(([k]) => k !== "constructor" && k !== "__proto__")), incomplete: [], lock: { version: "0.2.0", resolved: "file:../build-os-0.2.0.tgz", integrity: id.integrity } };
    assert.deepEqual(copyProblems("c", copy, id, "build-os-0.2.0.tgz"), ["c (w): constructor is missing", "c (w): __proto__ is missing"]);
  });

  it("real npm: a folder deeper than the limit and an unreadable folder make the comparison, the folder search, and the cache index read incomplete, and name the path", { skip: !CAN_CHMOD && "needs chmod as a user that is not root (POSIX)" }, () => {
    const l = layout();
    assert.equal(npxTarball(l).status, 0);
    assert.equal(installIntoProject(l).status, 0);
    const pkg = join(l.project, "node_modules", "build-os");
    let deep = join(pkg, "deep");
    for (let i = 0; i < MAX_DEPTH; i++) deep = join(deep, "d");
    mkdirSync(deep, { recursive: true });
    const locked = join(pkg, "locked");
    mkdirSync(locked);
    writeFileSync(join(locked, "x.js"), "x\n");
    const bucket = readdirSync(join(l.cache, "_cacache", "index-v5"))[0]!;
    const lockedIndex = join(l.cache, "_cacache", "index-v5", bucket);
    const lockedRoot = join(l.root, "work", "sealed");
    mkdirSync(lockedRoot);
    chmodSync(locked, 0);
    chmodSync(lockedIndex, 0);
    chmodSync(lockedRoot, 0);
    try {
      const e = evidence(l);
      assert.ok(e.projectCopy.includes(`the project install (project): the comparison is incomplete: project/deep/${"d/".repeat(MAX_DEPTH - 1)}d: the folder is deeper than ${MAX_DEPTH} levels and was not read`), e.projectCopy.join("\n"));
      assert.ok(e.projectCopy.includes("the project install (project): the comparison is incomplete: project/locked: the folder cannot be read (EACCES)"), e.projectCopy.join("\n"));
      assert.ok(e.cache.includes(`_cacache/index-v5/${bucket}: the folder cannot be read (EACCES)`), e.cache.join("\n"));
      assert.ok(e.stray.includes(`${lockedRoot}: the folder cannot be read (EACCES)`), e.stray.join("\n"));
    } finally {
      for (const p of [locked, lockedIndex, lockedRoot]) chmodSync(p, 0o755);
    }
  });

  it("real npm: a symbolic link in the install where the tarball has a regular file fails, and says so", { skip: WINDOWS && "symbolic links need a privilege on Windows" }, () => {
    const l = layout();
    assert.equal(installIntoProject(l).status, 0);
    const file = join(l.project, "node_modules", "build-os", "dist", "buildos-intake.js");
    rmSync(file);
    symlinkSync("buildos.js", file);
    assert.deepEqual(evidence(l).projectCopy, ["the project install (project): dist/buildos-intake.js is a symbolic link, where the tarball's entry is a regular file"]);
  });

  it("the report states what is compared and what is not, with the tarball's own count of entries that are not regular files", () => {
    const id = readTarballIdentity(fixtureTarball());
    assert.equal(comparisonStatement(id), "Each install is compared with the tarball by the bytes (SHA-256) of each regular file, by its package-relative path: each of the tarball's 3 regular files must be in the install as a regular file with the same bytes (a symbolic link or another kind there fails), the install may hold no other entry of any kind, and a part of the install that cannot be read fails the comparison. File modes, owners, and times are not compared. The tarball holds no entry that is not a regular file or a folder (no symbolic link, no hard link).");
    const withLink = readTarballIdentity(tarGzRaw([ustarEntry("package/package.json", JSON.stringify({ name: "build-os", version: "0.2.0", bin: { buildos: "dist/buildos.js" } })), ustarEntry("package/dist/buildos.js", BIN), ustarEntry("package/dist/link.js", "", { typeFlag: "2", linkName: "buildos.js" }), Buffer.alloc(1024)]));
    assert.deepEqual(withLink.nonFileEntries, ["package/dist/link.js (symlink)"]);
    assert.match(comparisonStatement(withLink), /The tarball holds 1 entries that are not regular files or folders: package\/dist\/link\.js \(symlink\); they are not compared\.$/);
  });
});
