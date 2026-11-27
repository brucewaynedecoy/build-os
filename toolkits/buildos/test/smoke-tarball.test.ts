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
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { after, describe, it } from "node:test";
import { expectedActionLine, expectedRebuild, printedFixStep, type RanStep } from "../scripts/printed-fix-step.ts";
import { cacheContentSha256, findBuildOsFolders, readCacheIndex, readInstalledCopy, readNpxFolders } from "../scripts/smoke-evidence.ts";
import {
  BLOCKED_REGISTRY,
  cacheContentProblems,
  cacheIndexEntries,
  cacheIndexProblems,
  copyProblems,
  guardedEnv,
  legacyNpxArgs,
  npxArgs,
  npxFolderProblems,
  parseSmokeArgs,
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
import { tarGz } from "./tar-fixture.ts";

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
    assert.deepEqual(Object.keys(id.files).sort(), ["dist/buildos-intake.js", "dist/buildos.js", "package.json"]);
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
  for (const dir of [cache, prefix, work, project]) mkdirSync(dir);
  const tarball = join(temp(), "build-os-0.2.0.tgz");
  writeFileSync(tarball, bytes);
  const env = guardedEnv({ ...callerEnv, npm_config_ignore_scripts: "true", npm_config_update_notifier: "false", npm_config_fund: "false", npm_config_audit: "false" }, { cache, prefix });
  return { root, cache, prefix, work, project, tarball, identity: readTarballIdentity(bytes), env };
}

function npx(l: Layout, cwd: string, args: string[], env: NodeJS.ProcessEnv = l.env) {
  return spawnSync(process.execPath, [npmCli("npx"), ...args], { cwd, env, encoding: "utf8", timeout: 120_000 });
}

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
  const entries = readCacheIndex(l.cache);
  return {
    entries,
    cache: [...cacheIndexProblems(entries, l.identity, name), ...cacheContentProblems(l.identity, cacheContentSha256(l.cache, l.identity.integrity))],
    npxFolders: npxFolderProblems(folders, l.tarball),
    npxCopy: copyProblems("the npx install", npxDir !== undefined ? readInstalledCopy(npxDir, "npx") : undefined, l.identity, name),
    projectCopy: copyProblems("the project install", readInstalledCopy(l.project, "project"), l.identity, name),
    stray: strayProblems(findBuildOsFolders(l.root), [join(l.project, "node_modules", "build-os"), ...(npxDir !== undefined ? [join(npxDir, "node_modules", "build-os")] : [])]),
  };
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
  it("drops the caller's npm offline, prefer, registry, cache, and prefix settings in any spelling, and sets offline, the blocked registry, the new cache, and the new global prefix", () => {
    const env = guardedEnv(
      { PATH: "/bin", NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/", npm_config_prefer_online: "true", "npm_config_prefer-offline": "true", npm_config_OFFLINE: "false", NPM_CONFIG_CACHE: "/seeded-cache", npm_config_cache: "/c", NPM_CONFIG_PREFIX: "/global" },
      { cache: "/new-cache", prefix: "/new-prefix" },
    );
    assert.deepEqual(env, { PATH: "/bin", npm_config_offline: "true", npm_config_registry: BLOCKED_REGISTRY, npm_config_cache: "/new-cache", npm_config_prefix: "/new-prefix" });
    assert.equal(BLOCKED_REGISTRY, "http://127.0.0.1:9/");
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
    assert.ok(e1.npxFolders.includes("the npx cache holds 2 build-os install folders, not 1"), e1.npxFolders.join("\n"));
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
    const identity: TarballIdentity = { sha256: "b".repeat(64), integrity: "sha512-good", name: "build-os", version: "0.2.0", bins: {}, files: {} };
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
      "the npm cache holds an entry for another file: pacote:tarball:file:../other.tgz",
      "the npm cache entry pacote:tarball:file:C:\\t\\build-os-0.2.0.tgz has the integrity sha512-bad, not the tarball's sha512-good",
    ]);
    assert.deepEqual(cacheIndexProblems([], identity, "build-os-0.2.0.tgz"), ["the npm cache index is empty: no evidence that npm read the tarball"]);
    // The report shows a tarball file key by its file name only (finding 3: the relative path names runner folders).
    assert.equal(reportCacheKey("pacote:tarball:file:../../../../runner-folder/build-os-0.2.0.tgz"), "pacote:tarball:file:.../build-os-0.2.0.tgz");
    assert.equal(reportCacheKey("pacote:tarball:file:C:\\a\\build-os-0.2.0.tgz"), "pacote:tarball:file:.../build-os-0.2.0.tgz");
    assert.equal(reportCacheKey("make-fetch-happen:request-cache:https://registry.npmjs.org/build-os"), "make-fetch-happen:request-cache:https://registry.npmjs.org/build-os");
    assert.deepEqual(cacheContentProblems(identity, identity.sha256), []);
    assert.equal(cacheContentProblems(identity, undefined).length, 1);
    assert.equal(cacheContentProblems(identity, "c".repeat(64)).length, 1);
    assert.deepEqual(npxFolderProblems([], "/t/x.tgz"), ["the npx cache holds 0 build-os install folders, not 1"]);
    assert.deepEqual(strayProblems(["/r/a/node_modules/build-os"], []), ["another build-os folder is below the temporary root: /r/a/node_modules/build-os"]);
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

/** A preload module that stubs every process start of published-smoke.ts and logs it; `npm config get offline registry` prints STUB_PREFLIGHT_STDOUT. */
const PRELOAD = `import { createRequire, syncBuiltinESMExports } from "node:module";
const require = createRequire(import.meta.url);
const cp = require("node:child_process");
const fs = require("node:fs");
cp.spawnSync = (file, args = [], opts = {}) => {
  const all = [file, ...args].join(" ");
  fs.appendFileSync(process.env.STUB_LOG, all + "\\n");
  const out = / config get offline registry$/.test(all) ? process.env.STUB_PREFLIGHT_STDOUT : "";
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
    const s = stubbedSmoke("0.2.0", "offline=false\nregistry=https://registry.npmjs.org/\n");
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
    assert.ok(calls[0]!.endsWith(" config get offline registry") && calls[1]!.endsWith(" --version"), s.log);
    assert.match(s.md, /\nStopped: the registry guard preflight failed/);
  });

  for (const version of ["0.2.0", "0.1.0"]) {
    it(`${version}: the report holds no path under the temporary root or the home folder (check labels included), and never claims a step that did not run`, () => {
      const s = stubbedSmoke(version, `offline=true\nregistry=${BLOCKED_REGISTRY}\n`);
      assert.equal(s.r.status, 1, "stubbed processes print nothing, so checks fail");
      const report = JSON.parse(s.json) as { steps: { role?: string; checks: { check: string }[] }[]; tarball_mode: { proves: string[]; not_proven: string[]; not_run: string[] } };
      for (const text of [s.json, s.md]) for (const p of [...pathForms(s.tmp), ...pathForms(homedir())]) assert.ok(!text.includes(p), `the report holds ${p}`);
      if (version === "0.2.0") assert.ok(report.steps.some((x) => x.checks.some((c) => c.check.includes("--root '{PROJECT}'") || c.check.includes('--root "{PROJECT}"'))), "a check label held the project path, now {PROJECT}");
      assert.ok(!report.steps.some((x) => x.role === "fix-run"), "step 10 ran nothing");
      for (const line of [...report.tarball_mode.proves, ...report.tarball_mode.not_proven]) assert.doesNotMatch(line, RAN_CLAIM, line);
      assert.equal(report.tarball_mode.not_run.length, 1);
      assert.match(report.tarball_mode.not_run[0]!, version === "0.1.0" ? /^Step 10 ran no printed command: 0\.1\.0 prints a bare buildos/ : /^Step 10 ran no printed command: the printed command did not match/);
      assert.doesNotMatch(s.md, /through the system shell, with npm taking/);
    });
  }
});

describe("F-P9-15: the order of the checks in published-smoke.ts", () => {
  const text = readFileSync(SMOKE, "utf8");

  it("sets the guard for every process in tarball mode, checks it first and stops on failure, checks the npx install after step 7, and the project install and the cache after step 10", () => {
    assert.match(text, /\nconst baseEnv: NodeJS\.ProcessEnv = source\.kind === "tarball" \? guardedEnv\(callerEnv, \{ cache, prefix: globalPrefix \}\) : callerEnv;\n/);
    assert.match(text, /\nconst root = realpathSync\.native\(mkdtempSync\(join\(tmpdir\(\), "buildos-smoke-"\)\)\);\n/);
    assert.equal(text.match(/env: opts\.env \?\? baseEnv/g)?.length, 1, "run() uses baseEnv");
    assert.equal(text.match(/\bcallerEnv\b/g)?.length, 5, "callerEnv is built, cleaned, and guarded, and used nowhere else");
    const first = text.indexOf("// 0. Tarball mode only: the registry guard is on");
    const step1 = text.indexOf("// 1. version, human and JSON.");
    assert.ok(first > 0 && first < step1);
    assert.match(text.slice(first, step1), /check\(step, `npm reads offline=true and registry=\$\{BLOCKED_REGISTRY\}`, step\.stdout === `offline=true\\nregistry=\$\{BLOCKED_REGISTRY\}\\n`\);\n {2}if \(!step\.checks\.every\(\(c\) => c\.ok\)\) finish\("the registry guard preflight failed/);
    const npxCheck = text.indexOf("// Tarball mode only, after step 7 and before the project install exists");
    assert.ok(npxCheck > text.indexOf("// 7. One legacy name") && npxCheck < text.indexOf("// 8. The project wrapper with Node.js missing"));
    const last = text.indexOf("// Tarball mode only, after step 10:");
    assert.ok(last > text.indexOf("printedFixStep({") && last < text.lastIndexOf("finish();"));
    assert.match(text.slice(last), /copyProblems\("the project install", copy, id, name\)/);
    assert.match(text.slice(last), /cacheIndexProblems\(entries, id, name\)/);
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
    assert.match(text, /\n {4}mode: source\.kind,\n {4}package_source: packageSource,\n {4}tarball: tarballRecord,\n {4}\.\.\.\(claims !== null \? \{ tarball_mode: \{ \.\.\.claims, does_not_prove: TARBALL_MODE_LIMITS\.does_not_prove \} \} : \{\}\),\n/);
    assert.match(text, /const claims = identity !== undefined \? tarballClaims\(reported, \{ version, sha256: identity\.sha256, integrity: identity\.integrity \}\) : null;/);
    assert.match(text, /\{ file: basename\(source\.file\), sha256: identity\.sha256, integrity: identity\.integrity, name: identity\.name, version: identity\.version, file_count: Object\.keys\(identity\.files\)\.length, bin_sha256: identity\.bins \}/);
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

  it("checks the printed text exactly, runs that same text through the shell, and the step name says where the package came from and that the registry fetch waits for step k", () => {
    const r = stubbed({ source: "tarball" });
    assert.deepEqual(r.failed, []);
    assert.equal(r.shellRuns.length, 1);
    assert.equal(r.shellRuns[0]!.command, "npx -y build-os@0.2.0 entities rebuild-index --root '/tmp/smoke/project' --mode compat --apply");
    assert.match(r.shellRuns[0]!.name, /^the printed fix command, as printed, in sh \(tarball mode: npm resolves build-os@0\.2\.0 to the project's local install of the tarball, with the registry blocked; the registry fetch of this literal command is proven only after publication, runbook step k\)$/);
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
