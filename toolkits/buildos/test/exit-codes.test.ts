import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXIT_CODES, exitCodeFor } from "../src/cli/exit-codes.ts";
import { BUILTIN_DOMAINS, run } from "../src/cli/run.ts";
import { NeedsOperatorReviewError } from "../src/core/shared/errors.ts";
import { assertIncludes, assertMatchObject, captureIo } from "./helpers.ts";
import { probeDomain } from "./probe-domain.ts";

const domains = [...BUILTIN_DOMAINS, probeDomain];
const buildInfo = { version: "dev", sourceRevision: "unknown" };

async function probe(...argv: string[]) {
  const io = captureIo();
  const code = await run(["probe", ...argv], io, { domains, buildInfo });
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

describe("central exit code table", () => {
  it("has exactly the PRD 20 codes", () => {
    assert.deepEqual(EXIT_CODES, {
      ok: 0,
      internal: 1,
      usage: 2,
      input: 3,
      contract: 4,
      io: 5,
      canonicalAppliedIndexFailed: 6,
      needsOperatorReview: 10,
    });
  });

  const cases: [string, number][] = [
    ["ok", 0],
    ["usage", 2],
    ["input", 3],
    ["contract", 4],
    ["io", 5],
    ["index", 6],
    ["review", 10],
    ["unexpected", 1],
    ["throw-string", 1],
  ];
  for (const [kase, expected] of cases) {
    it(`probe ${kase} exits ${expected} in human and JSON mode`, async () => {
      assert.equal((await probe(kase)).code, expected);
      assert.equal((await probe(kase, "--json")).code, expected);
    });
  }

  it("produces 10 only for a needs-operator-review error", () => {
    const samples: unknown[] = [
      new Error("x"),
      new TypeError("x"),
      "x",
      undefined,
      null,
      { kind: "needs-operator-review" },
      Object.assign(new Error("x"), { kind: "needs-operator-review" }),
    ];
    for (const sample of samples) assert.notEqual(exitCodeFor(sample), 10);
    assert.equal(exitCodeFor(new NeedsOperatorReviewError("x", { code: "c" })), 10);
  });

  it("maps parse errors to 2", async () => {
    const unknownFlag = await probe("ok", "--nope");
    assert.equal(unknownFlag.code, 2);
    assertIncludes(unknownFlag.stderr, "ERROR [usage_error]");
    const versionArg = captureIo();
    assert.equal(await run(["version", "extra"], versionArg, { buildInfo }), 2);
    const unknownCommand = captureIo();
    assert.equal(await run(["nope"], unknownCommand, { buildInfo }), 2);
    assertIncludes(unknownCommand.stderr(), 'unknown command "nope"');
    // Like the Go seed, `help <unknown>` prints root help and exits 0.
    const unknownHelp = captureIo();
    assert.equal(await run(["help", "nope"], unknownHelp, { buildInfo }), 0);
  });

  it("writes a usage error as a JSON envelope on stdout with --json", async () => {
    const { code, stdout, stderr } = await probe("ok", "--nope", "--json");
    assert.equal(code, 2);
    assert.equal(stderr, "");
    const envelope = JSON.parse(stdout);
    assertMatchObject(envelope, { ok: false, command: "probe.ok", write_status: "not_requested", result: null });
    assertMatchObject(envelope.diagnostics[0], { code: "usage_error", severity: "error" });
  });

  it("reports an unexpected error as one stderr line with no stack trace", async () => {
    const human = await probe("unexpected");
    assert.equal(human.code, 1);
    assert.equal(human.stdout, "");
    assert.equal(human.stderr, "buildos: internal error: boom happened\n");
    assert.doesNotMatch(human.stderr, /\bat\s/);
    const json = await probe("unexpected", "--json");
    assert.equal(json.code, 1);
    assert.equal(json.stderr.split("\n").filter(Boolean).length, 1);
    assert.equal(JSON.parse(json.stdout).diagnostics[0].code, "internal_error");
  });

  it("carries core error diagnostics, root, and write status into the envelope", async () => {
    const { stdout } = await probe("index", "--json");
    const envelope = JSON.parse(stdout);
    assertMatchObject(envelope, {
      ok: false,
      command: "probe.index",
      root: "/probe-root",
      write_status: "canonical_applied_index_failed",
    });
    assert.deepEqual(envelope.diagnostics, [
      { code: "probe_index", severity: "error", message: "index rebuild failed", correction: "Probe correction." },
    ]);
  });

  it("writes human failures to stderr only", async () => {
    const { stdout, stderr } = await probe("contract");
    assert.equal(stdout, "");
    assert.equal(
      stderr,
      "probe.contract: error\nroot: /probe-root\nversion: dev\nsource revision: unknown\nwrite status: not_requested\n" +
        "ERROR [probe_contract]: contract conflict\n  action: Probe correction.\n",
    );
  });
});

describe("diagnostics and notices", () => {
  it("keeps notices on stderr without changing stdout or the exit code", async () => {
    const plain = await probe("ok");
    const noticed = await probe("notice");
    assert.equal(noticed.code, 0);
    assert.equal(noticed.stderr, "notice: this is informational\n");
    const json = await probe("notice", "--json");
    assert.equal(json.code, 0);
    assert.equal(json.stderr, "notice: this is informational\n");
    assertMatchObject(JSON.parse(json.stdout), { ok: true, command: "probe.notice", diagnostics: [] });
    assert.equal(plain.stderr, "");
  });

  it("writes human diagnostics to stderr and JSON diagnostics as stable records", async () => {
    const human = await probe("warn");
    assert.equal(human.code, 0);
    assert.ok(!human.stdout.includes("WARNING"));
    assert.equal(human.stderr, "WARNING [probe_warning]: a warning\n");
    const json = await probe("warn", "--json");
    assert.equal(json.stderr, "");
    assert.deepEqual(JSON.parse(json.stdout).diagnostics, [{ code: "probe_warning", severity: "warning", message: "a warning" }]);
  });
});
