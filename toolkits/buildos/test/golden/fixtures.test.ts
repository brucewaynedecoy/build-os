// Golden fixture checks (W1 R7 P2 t1, A14).
//
// The binary fixtures are generated, not hand-made: regenerating them must
// give the committed bytes. Git must never rewrite fixture or golden bytes on
// any operating system, so both folders carry `-text`. The fixtures must stay
// synthetic and small.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { PACKAGE_ROOT } from "./harness.ts";
import { generatedFixtures } from "./generate-fixtures.ts";

const FIXTURES = join(PACKAGE_ROOT, "test", "fixtures", "golden");

function walk(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split("\\").join("/"))
    .sort();
}

describe("golden fixtures", () => {
  it("match a fresh run of the fixture generator byte for byte", () => {
    const generated = generatedFixtures();
    assert.ok(generated.size >= 10);
    for (const [rel, data] of generated) {
      const committed = readFileSync(join(FIXTURES, ...rel.split("/")));
      assert.ok(committed.equals(data), `${rel} differs from generate-fixtures.ts output; run node test/golden/generate-fixtures.ts`);
    }
  });

  it("stay small", () => {
    let total = 0;
    for (const rel of walk(FIXTURES)) {
      const size = statSync(join(FIXTURES, ...rel.split("/"))).size;
      assert.ok(size <= 16 * 1024, `${rel} is ${size} bytes; keep fixtures under 16 KiB`);
      total += size;
    }
    assert.ok(total <= 256 * 1024, `fixtures total ${total} bytes`);
  });

  it("are checked out without line-ending or text conversion", (t) => {
    const probe = spawnSync("git", ["check-attr", "text", "--", "test/fixtures/golden/intake/inputs/service-guide.docx", "test/golden/buildos/cli-version/stdout", "test/fixtures/golden/intake/inputs/team-roster.csv"], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8",
    });
    if (probe.status !== 0) {
      t.skip("git is not available");
      return;
    }
    for (const line of probe.stdout.trim().split("\n")) assert.match(line, /: text: unset$/, line);
  });

  it("hold no carriage returns, so every operating system reads the same bytes", () => {
    for (const rel of walk(FIXTURES)) {
      if (/\.(docx|xlsx|pdf|png)$/.test(rel)) continue;
      assert.ok(!readFileSync(join(FIXTURES, ...rel.split("/"))).includes(0x0d), `${rel} holds a carriage return`);
    }
  });
});
