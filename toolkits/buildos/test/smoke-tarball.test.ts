// W1 R7 P9, F-P9-15: the tarball mode of scripts/published-smoke.ts. The
// mode switch, the SHA-256 check, the registry guard, and step 10 in tarball
// mode, with stubs (scripts/smoke-source.ts and scripts/printed-fix-step.ts
// start no process). One real npm run shows that the guard makes a registry
// fetch of build-os fail; it needs no network. The full smoke on a packed
// tarball runs in the buildos-smoke workflow (source local-pack) on three
// systems.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { expectedActionLine, expectedRebuild, printedFixStep, type RanStep } from "../scripts/printed-fix-step.ts";
import {
  BLOCKED_REGISTRY,
  cacheIndexKeys,
  guardedEnv,
  legacyNpxArgs,
  npxArgs,
  parseSmokeArgs,
  readTarballIdentity,
  registryGuardProblems,
  sha256Hex,
  TARBALL_MODE_LIMITS,
  UsageError,
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
  const dir = mkdtempSync(join(tmpdir(), "buildos-smoke-tarball-"));
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

describe("F-P9-15: the registry guard", () => {
  it("drops the caller's npm offline, prefer, and registry settings in any spelling, and sets offline with the blocked registry", () => {
    const env = guardedEnv({ PATH: "/bin", NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/", npm_config_prefer_online: "true", "npm_config_prefer-offline": "true", npm_config_OFFLINE: "false", npm_config_cache: "/c" });
    assert.deepEqual(env, { PATH: "/bin", npm_config_cache: "/c", npm_config_offline: "true", npm_config_registry: BLOCKED_REGISTRY });
    assert.equal(BLOCKED_REGISTRY, "http://127.0.0.1:9/");
  });

  it("with the guard, a real npx fetch of build-os from a registry fails and fetches nothing (ENOTCACHED)", () => {
    const dir = temp();
    const cache = join(dir, "cache");
    const cwd = join(dir, "work");
    mkdirSync(cache);
    mkdirSync(cwd);
    const nodeDir = dirname(process.execPath);
    const cli = [join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"), join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js")].find((p) => existsSync(p));
    assert.ok(cli !== undefined, "npx-cli.js next to this Node.js");
    const env = guardedEnv({ ...process.env, npm_config_cache: cache, npm_config_ignore_scripts: "true", npm_config_update_notifier: "false" });
    const r = spawnSync(process.execPath, [cli, "-y", "build-os@0.2.0", "version"], { cwd, env, encoding: "utf8", timeout: 120_000 });
    assert.notEqual(r.status, 0, r.stdout);
    assert.match(r.stderr, /ENOTCACHED/);
    assert.deepEqual(registryGuardProblems({ cacheKeys: cacheIndexKeys([]), packages: [], identity: { sha256: SHA, name: "build-os", version: "0.2.0", bins: {} } }), ["no build-os package was found in the npx cache or the project"]);
  });

  it("reads cache index keys and flags every entry that is not a tarball file, a missing package, another version, and other bin bytes", () => {
    const keys = cacheIndexKeys([
      `abc\t${JSON.stringify({ key: "pacote:tarball:file:/t/build-os-0.2.0.tgz", integrity: "sha512-x" })}\n`,
      `def\t${JSON.stringify({ key: "make-fetch-happen:request-cache:https://registry.npmjs.org/build-os" })}\nghi\tnot json\n`,
    ]);
    assert.deepEqual(keys, ["pacote:tarball:file:/t/build-os-0.2.0.tgz", "make-fetch-happen:request-cache:https://registry.npmjs.org/build-os", "(an index line that is not JSON)"]);
    const identity: TarballIdentity = { sha256: SHA, name: "build-os", version: "0.2.0", bins: { "dist/buildos.js": "b".repeat(64) } };
    const good = { where: "{TMP}/project/node_modules/build-os", version: "0.2.0", bins: { "dist/buildos.js": "b".repeat(64) } };
    assert.deepEqual(registryGuardProblems({ cacheKeys: [keys[0]!], packages: [good], identity }), []);
    const problems = registryGuardProblems({
      cacheKeys: keys,
      packages: [good, { where: "{TMP}/npm-cache/_npx/1/node_modules/build-os", version: "0.1.0", bins: { "dist/buildos.js": "c".repeat(64) } }, { where: "{TMP}/x/node_modules/build-os", version: undefined, bins: { "dist/buildos.js": undefined } }],
      identity,
    });
    assert.deepEqual(problems, [
      "the npm cache holds an entry that is not the tarball file: make-fetch-happen:request-cache:https://registry.npmjs.org/build-os",
      "the npm cache holds an entry that is not the tarball file: (an index line that is not JSON)",
      "{TMP}/npm-cache/_npx/1/node_modules/build-os holds build-os 0.1.0, not 0.2.0",
      "{TMP}/npm-cache/_npx/1/node_modules/build-os: dist/buildos.js is not the tarball's file",
      "{TMP}/x/node_modules/build-os holds build-os (no version), not 0.2.0",
      "{TMP}/x/node_modules/build-os: dist/buildos.js is not the tarball's file",
    ]);
  });

  it("published-smoke.ts sets the guard for every process in tarball mode, checks it first, and checks the cache and every build-os folder last", () => {
    const text = readFileSync(SMOKE, "utf8");
    assert.match(text, /\nconst baseEnv: NodeJS\.ProcessEnv = source\.kind === "tarball" \? guardedEnv\(callerEnv\) : callerEnv;\n/);
    assert.equal(text.match(/env: opts\.env \?\? baseEnv/g)?.length, 1, "run() uses baseEnv");
    assert.equal(text.match(/\bcallerEnv\b/g)?.length, 5, "callerEnv is built, cleaned, and guarded, and used nowhere else");
    const first = text.indexOf("// 0. Tarball mode only: the registry guard is on");
    assert.ok(first > 0 && first < text.indexOf("// 1. version, human and JSON."));
    assert.match(text, /check\(step, `npm reads offline=true and registry=\$\{BLOCKED_REGISTRY\}`, step\.stdout === `offline=true\\nregistry=\$\{BLOCKED_REGISTRY\}\\n`\);/);
    const last = text.indexOf("// Tarball mode only, last: nothing came from a registry.");
    assert.ok(last > text.indexOf("printedFixStep({") && last < text.indexOf("for (const s of steps) s.ok"));
    assert.match(text.slice(last), /registryGuardProblems\(\{ cacheKeys: cacheIndexKeys\(buckets\), packages, identity: id \}\)/);
  });
});

describe("F-P9-15: the wrapper step and the report in tarball mode", () => {
  const text = readFileSync(SMOKE, "utf8");

  it("installs the tarball into the project, offline and with install scripts off, after the Node.js-missing step and before the wrapper step", () => {
    const at = text.indexOf("// Tarball mode only, before step 9:");
    assert.ok(at > text.indexOf("// 8. The project wrapper with Node.js missing") && at < text.indexOf("// 9. The project wrapper with Node.js present"));
    assert.match(text, /\[\.\.\.npm\.prefix, "install", "--offline", "--ignore-scripts", "--no-save", "--no-package-lock", "--prefix", project, source\.file\]/);
    assert.match(text, /check\(step, `node_modules\/build-os in the project is \$\{version\}, the pinned version`, installed === version\);/);
  });

  it("checks the SHA-256 before the temporary root exists, and the version comes from the tarball", () => {
    assert.ok(text.indexOf("if (actual !== source.sha256)") < text.indexOf("const root = mkdtempSync("));
    assert.match(text, /\nconst version = identity !== undefined \? identity\.version : source\.kind === "registry" \? source\.version : "";\n/);
  });

  it("the report records the mode, the package source, the tarball's file name, SHA-256, and version, and what the mode proves and does not prove", () => {
    assert.match(text, /\n {2}mode: source\.kind,\n {2}package_source: packageSource,\n {2}tarball: tarballRecord,\n {2}\.\.\.\(source\.kind === "tarball" \? \{ tarball_mode: TARBALL_MODE_LIMITS \} : \{\}\),\n/);
    assert.match(text, /\{ file: basename\(source\.file\), sha256: identity\.sha256, name: identity\.name, version: identity\.version, bin_sha256: identity\.bins \}/);
    assert.ok(TARBALL_MODE_LIMITS.does_not_prove.some((line) => line.includes("npx -y build-os@<version> fetches the package from the public registry") && line.includes("runbook step k")));
    assert.ok(TARBALL_MODE_LIMITS.does_not_prove.some((line) => line.includes("step h1")));
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
