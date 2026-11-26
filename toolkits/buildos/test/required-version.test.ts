// W1 R7 P8 pin-first review round 2 (orchestrator decision of 2026-11-25):
// the program that runs checks itself. The project wrappers set
// BUILDOS_REQUIRE_VERSION to the pinned version on every start. The CLI
// (src/cli/required-version.ts, called first in src/cli/main.ts) stops when
// that is not its own build identity: nothing on stdout, one plain message
// on stderr, exit 3; with --json the failure envelope instead. It removes the
// variable, and puts back the caller's npm bin-links settings, before it
// starts any other program. An unset or empty variable means no check.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EXIT_CODES } from "../src/cli/exit-codes.ts";
import { MINIMUM_NODE_MAJOR, nodeRefusal, REQUIRE_VERSION, takeVersionRequirement, versionRefusal } from "../src/cli/required-version.ts";
import { assertSame, shape } from "./helpers.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const main = join(packageRoot, "src", "cli", "main.ts");
const DEV = { version: "dev", sourceRevision: "unknown" };
const RELEASE = { version: "0.1.0", sourceRevision: "f".repeat(40) };
/** Pin-first final check, finding 7: a dev pin also names the development-build recovery. */
const DEV_RECOVERY =
  " For a development build: in the project folder, replace the local install with the built development package (npm install <path to toolkits/buildos>). Or remove the local install (npm uninstall @brucewaynedecoy/buildos), so that the linked build on PATH runs.";
const MESSAGE = (required: string, started: string) =>
  `BuildOS stopped: this project needs BuildOS ${required}, but BuildOS ${started} started. Nothing ran.\nFix the BuildOS install so that version ${required} runs, then run the project wrapper (.os/scripts/buildos) again. Or set buildos_version in .os/manifest.json to the version that you want to use.${required === "dev" ? DEV_RECOVERY : ""}\n`;
const NODE_MESSAGE = (found: string) =>
  `BuildOS stopped: BuildOS needs Node.js 24 or newer, but Node.js ${found} started it. Nothing ran.\nInstall Node.js 24 or newer from https://nodejs.org. If the project holds an older node (node_modules/.bin/node), remove it or replace it with Node.js 24 or newer. Then try again.\n`;

let scratch: string;
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-required-"));
});
after(() => rmSync(scratch, { recursive: true, force: true }));

describe("takeVersionRequirement", () => {
  it("returns the required version and removes the variable", () => {
    const env: NodeJS.ProcessEnv = { [REQUIRE_VERSION]: "0.1.0", HOME: "h" };
    assert.equal(takeVersionRequirement(env), "0.1.0");
    assert.deepEqual(env, { HOME: "h" });
  });

  it("treats an unset or empty variable as no check, and removes an empty one", () => {
    assert.equal(takeVersionRequirement({}), undefined);
    const env: NodeJS.ProcessEnv = { [REQUIRE_VERSION]: "" };
    assert.equal(takeVersionRequirement(env), undefined);
    assert.deepEqual(env, {});
  });

  it("finding 12: puts back the caller's npm bin-links settings when the wrapper turned them on for npx", () => {
    const env: NodeJS.ProcessEnv = {
      [REQUIRE_VERSION]: "1.2.3",
      npm_config_bin_links: "true",
      BUILDOS_NPM_BIN_LINKS_OVERRIDE: "1",
      BUILDOS_SAVED_NPM_CONFIG_BIN_LINKS: "false",
      BUILDOS_SAVED_npm_config_bin_links: "false",
      BUILDOS_SAVED_OTHER: "kept",
    };
    takeVersionRequirement(env);
    assert.deepEqual(env, { NPM_CONFIG_BIN_LINKS: "false", npm_config_bin_links: "false", BUILDOS_SAVED_OTHER: "kept" });
  });

  it("finding 12: removes the wrapper's bin-links value when the caller had none", () => {
    const env: NodeJS.ProcessEnv = { npm_config_bin_links: "true", BUILDOS_NPM_BIN_LINKS_OVERRIDE: "1" };
    takeVersionRequirement(env);
    assert.deepEqual(env, {});
  });

  it("leaves a caller's own npm bin-links setting alone when no wrapper turned it on", () => {
    const env: NodeJS.ProcessEnv = { npm_config_bin_links: "false", BUILDOS_SAVED_npm_config_bin_links: "true" };
    takeVersionRequirement(env);
    assert.deepEqual(env, { npm_config_bin_links: "false" });
  });
});

describe("versionRefusal", () => {
  it("accepts the program's own identity, a release version or dev, and no requirement", () => {
    assert.equal(versionRefusal("dev", DEV, ["version"]), undefined);
    assert.equal(versionRefusal("0.1.0", RELEASE, ["version"]), undefined);
    assert.equal(versionRefusal(undefined, RELEASE, ["version"]), undefined);
  });

  it("refuses another version with exit 3, nothing on stdout, and the message with both fixes", () => {
    assert.equal(EXIT_CODES.input, 3);
    assert.deepEqual(versionRefusal("0.1.0", DEV, ["version"]), { stdout: "", stderr: MESSAGE("0.1.0", "dev"), exitCode: 3 });
    assert.deepEqual(versionRefusal("dev", RELEASE, ["init"]), { stdout: "", stderr: MESSAGE("dev", "0.1.0"), exitCode: 3 });
    // Build metadata and other near matches are other versions.
    assert.equal(versionRefusal("0.1.0", { version: "0.1.0+local", sourceRevision: "x" }, [])?.exitCode, 3);
    assert.equal(versionRefusal("0.1.0", { version: "v0.1.0", sourceRevision: "x" }, [])?.exitCode, 3);
  });

  it("with --json, refuses with the failure envelope on stdout and nothing on stderr", () => {
    const refusal = versionRefusal("0.1.0", DEV, ["intake", "status", "--json"])!;
    assert.equal(refusal.exitCode, 3);
    assert.equal(refusal.stderr, "");
    assert.deepEqual(JSON.parse(refusal.stdout), {
      ok: false,
      command: "intake",
      version: "dev",
      source_revision: "unknown",
      root: "",
      mode: "",
      write_status: "not_requested",
      result: null,
      diagnostics: [
        {
          code: "version_mismatch",
          severity: "error",
          message: "BuildOS stopped: this project needs BuildOS 0.1.0, but BuildOS dev started. Nothing ran.",
          correction: "Fix the BuildOS install so that version 0.1.0 runs, then run the project wrapper (.os/scripts/buildos) again. Or set buildos_version in .os/manifest.json to the version that you want to use.",
        },
      ],
    });
  });

  it("finding 7 (final check): a dev pin names how to recover when a project-local install runs before a linked development build", () => {
    const stderr = versionRefusal("dev", RELEASE, ["version"])!.stderr;
    assert.ok(stderr.includes("replace the local install with the built development package"), stderr);
    assert.ok(stderr.includes("Or remove the local install (npm uninstall @brucewaynedecoy/buildos), so that the linked build on PATH runs."), stderr);
    assert.doesNotMatch(versionRefusal("0.1.0", DEV, ["version"])!.stderr, /development build/);
  });

  it("shows a required value with control characters quoted", () => {
    assert.match(versionRefusal("1.2.3\nX", DEV, [])!.stderr, /needs BuildOS "1\.2\.3\\nX", but/);
  });
});

// Pin-first final check, finding 3: BuildOS checks its own Node.js version first.
describe("nodeRefusal", () => {
  it("uses the minimum of package.json engines", () => {
    const engines = (JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as { engines: { node: string } }).engines.node;
    assert.equal(engines, `>=${MINIMUM_NODE_MAJOR}.0.0`);
  });

  it("accepts Node.js 24 and newer", () => {
    for (const version of ["24.0.0", "24.11.1", "26.13.1", "100.0.0"]) assert.equal(nodeRefusal(version, DEV, ["version"]), undefined, version);
  });

  it("refuses an older Node.js with exit 3, nothing on stdout, and the needed and the found version", () => {
    for (const version of ["20.18.0", "22.11.0", "23.11.0", "18.0.0"]) assert.deepEqual(nodeRefusal(version, DEV, ["version"]), { stdout: "", stderr: NODE_MESSAGE(version), exitCode: 3 }, version);
  });

  it("with --json, refuses with the failure envelope on stdout and nothing on stderr", () => {
    const refusal = nodeRefusal("20.18.0", RELEASE, ["init", "--json"])!;
    assert.equal(refusal.exitCode, 3);
    assert.equal(refusal.stderr, "");
    const envelope = JSON.parse(refusal.stdout) as { ok: boolean; command: string; version: string; write_status: string; diagnostics: { code: string; message: string; correction: string }[] };
    assert.equal(envelope.ok, false);
    assert.equal(envelope.command, "init");
    assert.equal(envelope.version, "0.1.0");
    assert.equal(envelope.write_status, "not_requested");
    assert.deepEqual(envelope.diagnostics.map((d) => d.code), ["node_version"]);
    assert.equal(`${envelope.diagnostics[0]!.message}\n${envelope.diagnostics[0]!.correction}\n`, NODE_MESSAGE("20.18.0"));
  });
});

describe("the CLI entry", () => {
  function cli(args: string[], env: NodeJS.ProcessEnv, entry = main, cwd = scratch) {
    const full: NodeJS.ProcessEnv = { ...process.env, ...env };
    delete full["BUILDOS_WRAPPER_ACTIVE"];
    return spawnSync(process.execPath, [entry, ...args], { cwd, env: full, encoding: "utf8" });
  }

  it("refuses before any output or file write: init writes nothing", () => {
    const target = join(scratch, "init-target");
    mkdirSync(target);
    const result = cli(["init", "--root", target, "--skip-make-docs"], { [REQUIRE_VERSION]: "0.1.0" });
    assert.equal(result.status, 3, shape(result.stderr));
    assertSame(result.stdout, "");
    assertSame(result.stderr, MESSAGE("0.1.0", "dev"));
    assert.deepEqual(readdirSync(target), []);
  });

  it("runs as before with the variable unset, empty, or equal to its identity", () => {
    for (const value of [undefined, "", "dev"]) {
      const result = cli(["version", "--json"], { [REQUIRE_VERSION]: value });
      assert.equal(result.status, 0, shape(`${String(value)}: ${result.stderr}`));
      assertSame((JSON.parse(result.stdout) as { version: string }).version, "dev");
    }
  });

  it("a legacy-name entry goes through the same check, before its notice line", () => {
    const entry = join(scratch, "buildos-intake.mjs");
    writeFileSync(entry, `globalThis[Symbol.for("buildos.commandName")] = "buildos-intake";\nawait import(${JSON.stringify(pathToFileURL(main).href)});\n`);
    const refused = cli(["--help"], { [REQUIRE_VERSION]: "0.1.0" }, entry);
    assert.equal(refused.status, 3, shape(refused.stderr));
    assertSame(refused.stdout, "");
    assertSame(refused.stderr, MESSAGE("0.1.0", "dev"));
    const ran = cli(["--help"], { [REQUIRE_VERSION]: "dev" }, entry);
    assert.equal(ran.status, 0, shape(ran.stderr));
    assert.match(ran.stderr, /goes away in BuildOS/);
  });

  it("finding 3 (final check): on Node.js older than 24 it stops before the version check, any command, or a file write", () => {
    const preload = join(scratch, "fake-node-20.cjs");
    writeFileSync(preload, 'Object.defineProperty(process.versions, "node", { value: "20.18.0" });\n');
    const target = join(scratch, "old-node-target");
    mkdirSync(target);
    const full: NodeJS.ProcessEnv = { ...process.env, [REQUIRE_VERSION]: "dev" };
    delete full["BUILDOS_WRAPPER_ACTIVE"];
    const result = spawnSync(process.execPath, ["--require", preload, main, "init", "--root", target, "--skip-make-docs"], { cwd: scratch, env: full, encoding: "utf8" });
    assert.equal(result.status, 3, shape(result.stderr));
    assertSame(result.stdout, "");
    assertSame(result.stderr, NODE_MESSAGE("20.18.0"));
    assert.deepEqual(readdirSync(target), []);
  });

  it("a release build checks the same way (the build identity, not package.json)", () => {
    const entry = join(scratch, "release-entry.mjs");
    writeFileSync(entry, `globalThis.__BUILDOS_VERSION__ = "0.1.0";\nawait import(${JSON.stringify(pathToFileURL(main).href)});\n`);
    assert.equal(cli(["version"], { [REQUIRE_VERSION]: "0.1.0" }, entry).status, 0);
    const refused = cli(["version"], { [REQUIRE_VERSION]: "dev" }, entry);
    assert.equal(refused.status, 3);
    assertSame(refused.stderr, MESSAGE("dev", "0.1.0"));
    assert.equal(existsSync(join(scratch, ".os")), false);
  });
});
