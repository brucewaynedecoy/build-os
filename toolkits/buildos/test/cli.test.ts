import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUILTIN_DOMAINS, run } from "../src/cli/run.ts";
import { ENVELOPE_FIELDS } from "../src/core/shared/envelope.ts";
import { assertIncludes, captureIo } from "./helpers.ts";
import { probeDomain } from "./probe-domain.ts";

const buildInfo = { version: "dev", sourceRevision: "unknown" };
const domains = [...BUILTIN_DOMAINS, probeDomain];

async function cli(argv: string[], info = buildInfo) {
  const io = captureIo();
  const code = await run(argv, io, { domains, buildInfo: info });
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

describe("help", () => {
  for (const argv of [[], ["help"], ["--help"], ["-h"], ["help", "--help"]]) {
    it(`prints root help for ${JSON.stringify(argv)}`, async () => {
      const { code, stdout, stderr } = await cli(argv);
      assert.equal(code, 0);
      assert.equal(stderr, "");
      assertIncludes(stdout, "BuildOS deterministic project tooling");
      for (const domain of domains) assertIncludes(stdout, `  ${domain.name}`);
      assertIncludes(stdout, "  help ");
    });
  }

  it("prints the same domain help in every registered domain, by flag or by help", async () => {
    for (const domain of domains) {
      for (const argv of [[domain.name, "--help"], [domain.name, "-h"], [domain.name, "help"], ["help", domain.name]]) {
        const { code, stdout, stderr } = await cli(argv);
        assert.equal(code, 0, argv.join(" "));
        assert.equal(stderr, "");
        assert.equal(stdout, domain.help);
      }
    }
  });

  it("prints help for help", async () => {
    const { code, stdout } = await cli(["help", "help"]);
    assert.equal(code, 0);
    assertIncludes(stdout, "buildos help [<domain>]");
  });
});

describe("version", () => {
  it("prints dev and unknown for a source build, in the Go seed layout", async () => {
    const { code, stdout, stderr } = await cli(["version"]);
    assert.equal(code, 0);
    assert.equal(stderr, "");
    assert.equal(
      stdout,
      "version: ok\nroot: not_applicable\nmode: not_applicable\nversion: dev\nsource revision: unknown\n" +
        'write status: not_requested\n{\n  "version": "dev",\n  "source_revision": "unknown"\n}\n',
    );
  });

  it("prints a nine-field envelope with --json", async () => {
    const { code, stdout } = await cli(["version", "--json"]);
    assert.equal(code, 0);
    const envelope = JSON.parse(stdout);
    assert.deepEqual(Object.keys(envelope), [...ENVELOPE_FIELDS]);
    assert.deepEqual(envelope, {
      ok: true,
      command: "version",
      version: "dev",
      source_revision: "unknown",
      root: "not_applicable",
      mode: "not_applicable",
      write_status: "not_requested",
      result: { version: "dev", source_revision: "unknown" },
      diagnostics: [],
    });
  });

  it("reports injected release identity in every domain envelope", async () => {
    const info = { version: "0.1.0", sourceRevision: "abc1234" };
    for (const argv of [["version", "--json"], ["probe", "ok", "--json"], ["probe", "input", "--json"]]) {
      const envelope = JSON.parse((await cli(argv, info)).stdout);
      assert.equal(envelope.version, "0.1.0");
      assert.equal(envelope.source_revision, "abc1234");
    }
  });
});
