// W1 R7 P6 review round 2, P6-R2-09: one manifest contract (PRD 20 Manifest
// Contract), implemented once in TypeScript (`src/core/init/manifest.ts`) and
// mirrored in the dependency-free wrapper helper
// (`system/.os/scripts/pinned-version.cjs`). Both are tested against the same
// table of accepted and refused manifests, `test/fixtures/manifest-contract.json`,
// and the helper is also run as the wrappers run it.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { MANIFEST_MAX_BYTES, parseManifest } from "../src/core/init/manifest.ts";
import { prepareInit } from "../src/core/init/init.ts";
import { createNodeFsPort } from "../src/adapters/node-fs.ts";
import { nodeHash } from "../src/adapters/node-hash.ts";

const SCRIPTS = join(import.meta.dirname, "..", "..", "..", "system", ".os", "scripts");
const HELPER = join(SCRIPTS, "pinned-version.cjs");
const helper = createRequire(import.meta.url)(HELPER) as { parseManifest: (bytes: Buffer) => unknown };
const table = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "manifest-contract.json"), "utf8")) as {
  cases: { name: string; text?: string; base64?: string; accept: boolean }[];
};

function bytesOf(c: { text?: string; base64?: string }): Buffer {
  return c.base64 !== undefined ? Buffer.from(c.base64, "base64") : Buffer.from(c.text ?? "", "utf8");
}

let scratch: string;
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-manifest-contract-"));
});
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("P6-R2-09: the shared manifest contract table", () => {
  it("has accepted and refused cases", () => {
    assert.ok(table.cases.filter((c) => c.accept).length >= 10);
    assert.ok(table.cases.filter((c) => !c.accept).length >= 40);
  });

  for (const c of table.cases) {
    it(`${c.accept ? "accepts" : "refuses"} ${c.name}, in TypeScript and in the wrapper helper alike`, () => {
      const bytes = bytesOf(c);
      const ts = parseManifest(new Uint8Array(bytes));
      const cjs = helper.parseManifest(bytes);
      assert.equal(ts !== undefined, c.accept, `TypeScript: ${c.name}`);
      assert.equal(cjs !== undefined, c.accept, `helper: ${c.name}`);
      assert.deepEqual(cjs, ts, c.name);
    });
  }

  it("refuses a manifest one byte over the limit in both", () => {
    const base = Buffer.from('{"schema_version":1,"buildos_version":"1.2.3","initialized_at":"2026-11-24T00:00:00Z","pad":""}');
    const pad = Buffer.alloc(MANIFEST_MAX_BYTES + 1 - base.length, 0x61);
    const big = Buffer.concat([base.subarray(0, base.length - 2), pad, base.subarray(base.length - 2)]);
    assert.equal(big.length, MANIFEST_MAX_BYTES + 1);
    assert.equal(parseManifest(new Uint8Array(big)), undefined);
    assert.equal(helper.parseManifest(big), undefined);
    const fits = Buffer.concat([base.subarray(0, base.length - 2), pad.subarray(1), base.subarray(base.length - 2)]);
    assert.notEqual(parseManifest(new Uint8Array(fits)), undefined);
    assert.notEqual(helper.parseManifest(fits), undefined);
  });

  // W1 R7 P8 pin-first review round 2, finding 6: every exact version the contract accepts is one that npm
  // itself reads as a version (its own semver package), never as a dist-tag; "9007199254740992.0.0" is refused.
  it("accepts only versions that npm's own semver reads as exactly that version", (t) => {
    const npmRoot = process.platform === "win32" ? join(dirname(process.execPath), "node_modules", "npm") : join(dirname(process.execPath), "..", "lib", "node_modules", "npm");
    const semverDir = join(npmRoot, "node_modules", "semver");
    if (!existsSync(semverDir)) return t.skip("npm's semver package is not next to this Node.js");
    const semver = createRequire(join(npmRoot, "index.js"))(semverDir) as { valid(v: string): string | null };
    let checked = 0;
    for (const c of table.cases) {
      const manifest = parseManifest(new Uint8Array(bytesOf(c)));
      if (manifest === undefined || manifest.buildos_version === "dev") continue;
      assert.equal(semver.valid(manifest.buildos_version), manifest.buildos_version, `${c.name}: npm must read it as that version`);
      checked++;
    }
    assert.ok(checked >= 10, `checked ${checked} accepted versions`);
    for (const refused of ["9007199254740992.0.0", "1.9007199254740992.0", "1.2.10000000000000000"]) {
      assert.equal(semver.valid(refused), null, `npm reads ${refused} as a tag`);
      assert.equal(parseManifest(new TextEncoder().encode(JSON.stringify({ schema_version: 1, buildos_version: refused, initialized_at: "2026-11-24T00:00:00Z" }))), undefined, refused);
    }
  });

  it("the helper, run as the wrapper runs it, prints the version of an accepted manifest (a BOM too) and exits 3 for a refused one", () => {
    for (const c of table.cases) {
      const file = join(scratch, "manifest.json");
      writeFileSync(file, bytesOf(c));
      // No PATH and a scratch working folder: no installed buildos on this computer counts.
      const result = spawnSync(process.execPath, [HELPER, "--sh", join(scratch, "self"), file], { cwd: scratch, env: { ...process.env, PATH: "" }, encoding: "utf8" });
      const version = (parseManifest(new Uint8Array(bytesOf(c))) as { buildos_version?: string } | undefined)?.buildos_version;
      if (c.accept && version !== "dev") {
        assert.equal(result.status, 0, `${c.name}: ${result.stderr}`);
        assert.equal(result.stdout, `${version}\n`, c.name);
      } else {
        assert.equal(result.status, 3, c.name);
        assert.equal(result.stdout, "", c.name);
        assert.match(result.stderr, c.accept ? /development build of BuildOS/ : /Run "buildos init" in the project folder/, c.name);
      }
    }
  });
});

/**
 * W1 R7 P6 review round 3, P6-R3-09: `buildos init` and the wrapper helper
 * apply the same file rules at their own filesystem entry: a regular file at
 * the name (a link is not followed), read with a bound. Each case is a real
 * `.os/manifest.json` on disk, read by `buildos init` (a rerun when it
 * accepts the manifest) and by the helper as the wrappers run it.
 */
describe("P6-R3-09: both read the manifest file by the same rules", () => {
  const VALID = '{"schema_version":1,"buildos_version":"1.2.3","initialized_at":"2026-11-24T00:00:00Z"}\n';
  let counter = 0;
  /** A project with `.os/manifest.json` made by `make` (a missing one when it does nothing). */
  function project(make: (file: string) => void): { root: string; file: string } {
    const root = join(scratch, `files-${++counter}`);
    // P7-R3-07: .os/data/ marks a Go-era project, so a missing manifest is an adoption, not an unknown .os/ folder.
    mkdirSync(join(root, ".os", "data"), { recursive: true });
    const file = join(root, ".os", "manifest.json");
    make(file);
    return { root, file };
  }
  /** True when `buildos init` reads the manifest as valid (a rerun), from the file on disk. */
  function initAccepts(root: string): boolean {
    const prepared = prepareInit({ cwd: root, openFs: createNodeFsPort, hash: nodeHash, content: { files: [] }, version: "1.2.3", now: new Date("2026-11-24T00:00:00Z") });
    return prepared.plan.installed !== undefined;
  }
  /** The helper as the sh wrapper runs it, with a count of the bytes it reads from the manifest. */
  function helperRun(file: string): { accepts: boolean; bytesRead: number } {
    const count = join(scratch, `count-${counter}.txt`);
    const preload = join(scratch, `count-${counter}.cjs`);
    writeFileSync(
      preload,
      `const fs = require("fs"); let n = 0; const fds = new Set();
const open = fs.openSync; fs.openSync = function (p, ...rest) { const fd = open.call(fs, p, ...rest); if (String(p) === ${JSON.stringify(file)}) fds.add(fd); return fd; };
const read = fs.readSync; fs.readSync = function (fd, ...rest) { const got = read.call(fs, fd, ...rest); if (fds.has(fd)) n += got; return got; };
const readFile = fs.readFileSync; fs.readFileSync = function (p, ...rest) { const data = readFile.call(fs, p, ...rest); if (String(p) === ${JSON.stringify(file)}) n += data.length; return data; };
process.on("exit", () => require("fs").writeFileSync(${JSON.stringify(count)}, String(n)));\n`,
    );
    const result = spawnSync(process.execPath, ["--require", preload, HELPER, "--sh", join(scratch, "self"), file], { cwd: scratch, env: { ...process.env, PATH: "" }, encoding: "utf8" });
    return { accepts: result.status === 0, bytesRead: Number(readFileSync(count, "utf8")) };
  }

  const cases: [string, (file: string) => boolean | void, boolean][] = [
    ["a regular file", (file) => writeFileSync(file, VALID), true],
    ["a regular file with a UTF-8 byte order mark", (file) => writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(VALID)])), true],
    [
      "a link to a valid manifest",
      (file) => {
        writeFileSync(`${file}.real`, VALID);
        try {
          symlinkSync("manifest.json.real", file);
        } catch {
          return false;
        }
      },
      false,
    ],
    ["a folder", (file) => mkdirSync(file), false],
    ["missing", () => {}, false],
    ["98,304 bytes (over the 64 KiB limit)", (file) => writeFileSync(file, `${VALID.slice(0, -2)},"pad":"${"a".repeat(98_304 - VALID.length - 9)}"}\n`), false],
  ];
  for (const [name, make, accept] of cases) {
    it(`${accept ? "accepts" : "refuses"} ${name}, in buildos init and in the helper alike`, (t) => {
      let made = true;
      const { root, file } = project((f) => {
        made = make(f) !== false;
      });
      if (!made) return t.skip("this OS user cannot make a symbolic link");
      assert.equal(initAccepts(root), accept, `buildos init: ${name}`);
      const helped = helperRun(file);
      assert.equal(helped.accepts, accept, `helper: ${name}`);
      // The helper never reads more than the limit and one byte.
      assert.ok(helped.bytesRead <= MANIFEST_MAX_BYTES + 1, `the helper read ${helped.bytesRead} bytes of ${name}`);
      if (name.startsWith("98,304")) assert.equal(lstatSync(file).size, 98_304);
    });
  }
});
