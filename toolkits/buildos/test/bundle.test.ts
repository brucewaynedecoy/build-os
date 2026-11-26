// Builds the real bundle into a temporary folder and runs it with Node.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../scripts/build.ts";
import { assertIncludes, assertMatchObject } from "./helpers.ts";

let dir: string;
let sourceBundle: string;
let releaseBundle: string;

before(
  async () => {
    dir = mkdtempSync(join(tmpdir(), "buildos-bundle-"));
    sourceBundle = await bundle({ outfile: join(dir, "source", "buildos.js") });
    releaseBundle = await bundle({ outfile: join(dir, "release", "buildos.js"), version: "9.8.7", sourceRevision: "feedbee" });
  },
  { timeout: 60_000 },
);

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

function runBundle(file: string, args: string[]) {
  return spawnSync(process.execPath, [file, ...args], { encoding: "utf8" });
}

describe("bundled CLI", () => {
  it("is one ESM file with a Node shebang", () => {
    const text = readFileSync(sourceBundle, "utf8");
    assert.equal(text.startsWith("#!/usr/bin/env node\n"), true);
    assert.ok(!/\brequire\(/.test(text), "the bundle calls require(");
  });

  it("keeps the Go license notice for the bundled Unicode tables", () => {
    const text = readFileSync(sourceBundle, "utf8");
    assertIncludes(text, "Copyright 2009 The Go Authors. Licensed under the BSD-3-Clause license.");
    assertIncludes(text, "@license BSD-3-Clause");
  });

  it("prints dev and unknown for a source build", () => {
    const human = runBundle(sourceBundle, ["version"]);
    assert.equal(human.status, 0);
    assertIncludes(human.stdout, "version: dev\nsource revision: unknown\n");
    const json = runBundle(sourceBundle, ["version", "--json"]);
    assert.equal(json.status, 0);
    assert.equal(Object.keys(JSON.parse(json.stdout)).length, 9);
  });

  it("reports the version and revision injected by a release build", () => {
    const json = runBundle(releaseBundle, ["version", "--json"]);
    assertMatchObject(JSON.parse(json.stdout), { version: "9.8.7", source_revision: "feedbee" });
  });

  it("exits 2 with no stack trace on a usage error", () => {
    const result = runBundle(sourceBundle, ["nope"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assertIncludes(result.stderr, 'unknown command "nope"');
    assert.doesNotMatch(result.stderr, /\n\s+at\s/);
  });
});
