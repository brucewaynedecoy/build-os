// W1 R7 P9, owner decision of 2026-11-25 on register D-010 (option A):
// `buildos intake` prints the shared envelope with `--json` (parity
// exception PE-022). These tests pin the envelope of `convert`, `index
// references`, and `index playbooks` for a success, a usage error, and a
// failed run, and they check that the text form without `--json` stays the
// Go text. The Go parity goldens (test/golden/compare.test.ts) and the
// intake edge goldens (test/intake-edge.test.ts) hold the text form too.

import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFsPort, createNodeInPlaceWriter, writeRaceHooks } from "../src/adapters/node-fs.ts";
import type { Domain } from "../src/cli/domain.ts";
import { FsWriteFailure, PathRefusedError } from "../src/core/shared/errors.ts";
import { withInPlaceEffect, type FsPortFactory, type InPlaceWritePortFactory } from "../src/core/shared/fs-port.ts";
import { goErrnoText } from "../src/core/shared/go-os-error.ts";
import { READ_LIMITS } from "../src/core/shared/read-limits.ts";
import { after, describe, it } from "node:test";
import { INTAKE_USAGE, intakeDomain, runIntake } from "../src/cli/commands/intake.ts";
import { ENVELOPE_FIELDS } from "../src/core/shared/envelope.ts";
import { loadExceptions } from "./golden/harness.ts";
import { zip } from "./golden/generate-fixtures.ts";
import { captureIo } from "./helpers.ts";
import { run, type RunOptions } from "../src/cli/run.ts";

const scratch = mkdtempSync(join(tmpdir(), "buildos-intake-json-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const GOLDEN = join(import.meta.dirname, "fixtures", "golden");
let counter = 0;

/** A copy of the installed intake fixture (no `system/`, so the default paths are `assets/` and `.os/`). */
function project(): string {
  const root = join(scratch, `p${++counter}`);
  cpSync(join(GOLDEN, "intake-installed"), root, { recursive: true });
  mkdirSync(join(root, "inputs"), { recursive: true });
  writeFileSync(join(root, "inputs", "table.csv"), "a,b\n1,2\n");
  return root;
}

/** A project with one valid entry for `sub`'s index: a converted twin (references) or a playbook with every required field (playbooks). */
function seeded(sub: "references" | "playbooks"): string {
  const root = project();
  if (sub === "references") {
    const head = ["---", 'source: "inputs/table.csv"', `sha256: "${"0".repeat(64)}"`, 'converter: "buildos-intake/0.1.0"', 'timestamp: "2026-11-25T00:00:00Z"', 'type: "csv"', 'status: "converted"', "---", ""].join("\n");
    mkdirSync(join(root, "assets", "table"), { recursive: true });
    writeFileSync(join(root, "assets", "table", "table.csv"), `${head}a,b\n1,2\n`);
  } else {
    const fields = ["id: PB-001", "title: Check the stock", "category: discovery", "execution_mode: manual", "state_nature: read-only", "status: active", "audience: operator", "source_anchor: null", "version: 1.0.0", ...["harness", "systems", "environments", "owners", "targets", "produces", "related"].map((key) => `${key}: []`)];
    writeFileSync(join(root, "playbooks", "check-stock.md"), `---\n${fields.join("\n")}\n---\n\n# Check the stock\n`);
  }
  return root;
}

async function buildos(args: string[], cwd: string, options: RunOptions = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const code = await run(args, io, options);
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

/** The intake domain with `openWriter` (a fault injection seam of `runIntake`). */
function withWriter(openWriter: InPlaceWritePortFactory): RunOptions {
  const domain: Domain = { ...intakeDomain, run: (args, context) => runIntake(args, context, { openWriter }) };
  return { domains: [domain] };
}

/**
 * A disk-full writer: write number `n` writes four bytes of its data (or,
 * with `atOpen`, nothing) and then fails with `ENOSPC` (step `write`, or
 * `open`), and says what it did (`withInPlaceEffect`), as the real writer
 * does. `during` runs at that point (another program at work). `afterWrite`
 * runs after each earlier write, with the call number and the port path.
 * Every other write is the real one.
 */
function diskFullOnWrite(n: number, during?: () => void, afterWrite?: (call: number, path: string) => void, atOpen = false): InPlaceWritePortFactory {
  let calls = 0;
  return (root, cwd, options) => {
    const real = createNodeInPlaceWriter(root, cwd, options);
    return {
      ...real,
      writeFileInPlace(path, data, mode, writeOptions) {
        const call = ++calls;
        if (call !== n) {
          const done = real.writeFileInPlace(path, data, mode, writeOptions);
          afterWrite?.(call, path);
          return done;
        }
        const effect = atOpen ? "untouched" : real.writeFileInPlace(path, data.subarray(0, 4), mode, writeOptions);
        during?.();
        const step = atOpen ? "open" : "write";
        throw withInPlaceEffect(new FsWriteFailure(`${step} ${path}: ${NO_SPACE}`, { code: "write_failed", fs: { errno: "ENOSPC", syscall: step, step } }), effect);
      },
    };
  };
}

/** The `left_in_place` text for an entry the run created (final check, finding 4: what the run did then, not what is there now). */
const CREATED = (kind: "file" | "folder") => `this run created this ${kind} before the failure and did not remove it (intake does not undo); another program can have changed this path after that`;
/** The `left_in_place` correction (finding 4). */
const LOOK_FIRST = "BuildOS does not undo a failed intake run. Before you remove anything, look at the entry that is at this path now: it can be another program's. Then run the command again.";

/** Go's text for `ENOSPC` on this platform (review round 2, finding 6: Windows has its own text). */
const NO_SPACE = goErrnoText({ errno: "ENOSPC", syscall: "write", step: "write" });

/** A filesystem port whose `statStrict` of a path that ends with `suffix` throws an error that is not a BuildOS error. */
function portFault(suffix: string): RunOptions {
  const openFs: FsPortFactory = (root, cwd, options) => {
    const port = createNodeFsPort(root, cwd, options);
    return {
      ...port,
      statStrict(path) {
        if (String(path).endsWith(suffix)) throw new Error("injected port fault\nsecond line");
        return port.statStrict(path);
      },
    };
  };
  return { openFs };
}

/** Runs `body` with `READ_LIMITS.intake` set to `limit` (a test seam: the object is constant only in its type). */
async function withIntakeLimit<T>(limit: number, body: () => Promise<T>): Promise<T> {
  const limits = READ_LIMITS as unknown as { intake: number };
  const saved = limits.intake;
  limits.intake = limit;
  try {
    return await body();
  } finally {
    limits.intake = saved;
  }
}

/** `path` with `/` (the envelope form), without an assumption about the host separator. */
const slashed = (path: string): string => path.replaceAll("\\", "/");

interface Envelope {
  ok: boolean;
  command: string;
  version: string;
  source_revision: string;
  root: string;
  mode: string;
  write_status: string;
  result: Record<string, unknown> | null;
  diagnostics: { code: string; severity: string; message: string; correction?: string }[];
}

/** Parses stdout as exactly one envelope with the nine fields in order, and checks that stderr is empty. */
function envelope(out: { stdout: string; stderr: string }): Envelope {
  assert.equal(out.stderr, "", "stderr is empty with --json");
  assert.ok(out.stdout.endsWith("}\n"), "stdout ends with the envelope and one line feed");
  const parsed = JSON.parse(out.stdout) as Envelope;
  assert.deepEqual(Object.keys(parsed), [...ENVELOPE_FIELDS]);
  assert.deepEqual([parsed.version, parsed.source_revision, parsed.mode], ["dev", "unknown", ""]);
  return parsed;
}

describe("buildos intake --json (PE-022)", () => {
  describe("intake convert", () => {
    it("success: a dry run is planned, a write is applied, and the result names each output", async () => {
      const root = project();
      const dry = envelope(await buildos(["intake", "convert", "--json", "--repo-root", root, "--source", "inputs/table.csv", "--dry-run"], root));
      assert.deepEqual([dry.ok, dry.command, dry.root, dry.write_status, dry.diagnostics], [true, "intake.convert", root, "planned", []]);
      const outputs = dry.result!["outputs"] as { path: string; source: string; type: string; status: string; sha256: string }[];
      assert.equal(outputs.length, 1);
      // Finding 5 (intake JSON review round 1): a result path is relative to the project root, with `/`.
      assert.deepEqual([outputs[0]!.path, outputs[0]!.source, outputs[0]!.type, outputs[0]!.status], ["assets/table/table.csv", "inputs/table.csv", "csv", "converted"]);
      assert.match(outputs[0]!.sha256, /^[0-9a-f]{64}$/);
      assert.deepEqual([dry.result!["side_artifacts"], dry.result!["warnings"], dry.result!["dry_run"]], [[], [], true]);
      assert.equal(existsSync(join(root, "assets", "table")), false, "a dry run writes nothing");

      const applied = envelope(await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/table.csv", "--json"], root));
      assert.deepEqual([applied.ok, applied.write_status, applied.result!["dry_run"]], [true, "applied", false]);
      assert.ok(existsSync(join(root, "assets", "table", "table.csv")));
    });

    it("usage error: a missing --source and an unknown flag give usage_error and exit 1, as the text form", async () => {
      const root = project();
      for (const [args, message] of [
        [["--json", "--repo-root", root], "convert requires --source"],
        [["--json", "--bogus"], "flag provided but not defined: -bogus"],
      ] as const) {
        const out = await buildos(["intake", "convert", ...args], root);
        assert.equal(out.code, 1);
        const failed = envelope(out);
        assert.deepEqual([failed.ok, failed.command, failed.write_status, failed.result], [false, "intake.convert", "not_requested", null]);
        assert.deepEqual([failed.diagnostics.length, failed.diagnostics[0]!.code, failed.diagnostics[0]!.severity, failed.diagnostics[0]!.message], [1, "usage_error", "error", message]);
      }
    });

    it("failed conversion: a missing source and a twin that exists give command_failed and exit 1; nothing is written", async () => {
      const root = project();
      const missing = await buildos(["intake", "convert", "--json", "--repo-root", root, "--source", "inputs/missing.csv"], root);
      assert.equal(missing.code, 1);
      const failed = envelope(missing);
      assert.deepEqual([failed.ok, failed.command, failed.root, failed.write_status, failed.result], [false, "intake.convert", root, "not_requested", null]);
      assert.deepEqual([failed.diagnostics[0]!.code, failed.diagnostics[0]!.severity], ["command_failed", "error"]);
      assert.match(failed.diagnostics[0]!.message, /^read source: /);

      assert.equal((await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/table.csv"], root)).code, 0);
      const twin = readFileSync(join(root, "assets", "table", "table.csv"));
      const again = await buildos(["intake", "convert", "--json", "--repo-root", root, "--source", "inputs/table.csv"], root);
      assert.equal(again.code, 1);
      const exists = envelope(again);
      assert.deepEqual([exists.ok, exists.write_status, exists.diagnostics[0]!.code], [false, "not_requested", "command_failed"]);
      assert.deepEqual(readFileSync(join(root, "assets", "table", "table.csv")), twin, "the twin is unchanged");
    });

    it("a warning (an image BuildOS did not copy) is a warning diagnostic and a result entry, not a stderr line", async () => {
      const root = project();
      writeFileSync(join(scratch, `secret-${counter}.png`), "SECRET");
      writeFileSync(join(root, "inputs", "page.html"), `<html><body><h1>Page</h1>\n<img src="../../secret-${counter}.png" alt="Image 1">\n</body></html>`);
      const text = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/page.html", "--dry-run"], root);
      assert.equal(text.code, 0, text.stderr);
      const line = text.stderr.replace(/^buildos-intake: warning: /, "").replace(/\n$/, "");
      assert.match(line, /^did not copy image \.\.\/\.\.\/secret-\d+\.png from inputs\/page\.html: the file is outside/);
      const out = envelope(await buildos(["intake", "convert", "--json", "--repo-root", root, "--source", "inputs/page.html", "--dry-run"], root));
      assert.deepEqual([out.ok, out.write_status, out.result!["warnings"]], [true, "planned", [line]]);
      assert.deepEqual(out.diagnostics.map((d) => [d.code, d.severity, d.message]), [["image_not_copied", "warning", line]]);
    });
  });

  for (const sub of ["references", "playbooks"] as const) {
    describe(`intake index ${sub}`, () => {
      it("success: the write is applied, and the result names the index (project-relative) and its exact entry count", async () => {
        // Finding 8 (intake JSON review round 1): one valid entry is seeded, so the count is exact.
        const root = seeded(sub);
        const out = await buildos(["intake", "index", sub, "--json", "--repo-root", root], root);
        assert.equal(out.code, 0);
        const parsed = envelope(out);
        assert.deepEqual([parsed.ok, parsed.command, parsed.root, parsed.write_status, parsed.diagnostics], [true, `intake.index.${sub}`, root, "applied", []]);
        assert.deepEqual(parsed.result, { output_path: `.os/indexes/${sub}.json`, count: 1 });
        assert.ok(existsSync(join(root, ".os", "indexes", `${sub}.json`)));
      });

      it("usage error: an unknown flag gives usage_error and exit 1", async () => {
        const root = project();
        const out = await buildos(["intake", "index", sub, "--json", "--bogus"], root);
        assert.equal(out.code, 1);
        const failed = envelope(out);
        assert.deepEqual([failed.ok, failed.command, failed.root, failed.write_status, failed.result], [false, `intake.index.${sub}`, "", "not_requested", null]);
        assert.deepEqual(failed.diagnostics.map((d) => [d.code, d.message]), [["usage_error", "flag provided but not defined: -bogus"]]);
      });

      it("failed run: a write that fails gives command_failed and exit 1; a write outside the root is refused with exit 3", async () => {
        const root = project();
        writeFileSync(join(root, "blocked"), "a file, not a folder");
        const out = await buildos(["intake", "index", sub, "--json", "--repo-root", root, "--output", "blocked/index.json"], root);
        assert.equal(out.code, 1);
        const failed = envelope(out);
        assert.deepEqual([failed.ok, failed.command, failed.root, failed.write_status, failed.result, failed.diagnostics[0]!.code], [false, `intake.index.${sub}`, root, "not_requested", null, "command_failed"]);

        const outside = await buildos(["intake", "index", sub, "--json", "--repo-root", root, "--output", `../outside-${counter}-${sub}.json`], root);
        assert.equal(outside.code, 3);
        const refused = envelope(outside);
        assert.deepEqual([refused.ok, refused.write_status], [false, "not_requested"]);
        assert.match(refused.diagnostics[0]!.message, /; pass --allow-outside-root to allow a write outside the repository root$/);
      });
    });
  }

  it("prints the text form, byte for byte, without --json", async () => {
    const root = project();
    const convert = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/table.csv", "--dry-run"], root);
    assert.deepEqual(convert, { code: 0, stdout: `would write ${join(root, "assets", "table", "table.csv")}\n`, stderr: "" });
    // Finding 8 (intake JSON review round 1): one seeded entry per index, the exact Go text, exit 0.
    const refsRoot = seeded("references");
    const refs = await buildos(["intake", "index", "references", "--repo-root", refsRoot], refsRoot);
    assert.deepEqual(refs, { code: 0, stdout: `wrote ${join(refsRoot, ".os", "indexes", "references.json")} (1 references)\n`, stderr: "" });
    const booksRoot = seeded("playbooks");
    const books = await buildos(["intake", "index", "playbooks", "--repo-root", booksRoot], booksRoot);
    assert.deepEqual(books, { code: 0, stdout: `wrote ${join(booksRoot, ".os", "indexes", "playbooks.json")} (1 playbooks)\n`, stderr: "" });
    const missing = await buildos(["intake", "convert", "--repo-root", root], root);
    assert.deepEqual(missing, { code: 1, stdout: "", stderr: "buildos-intake: error: convert requires --source\n" });
    const none = await buildos(["intake"], root);
    assert.deepEqual(none, { code: 1, stdout: "", stderr: `${INTAKE_USAGE}buildos-intake: error: missing command\n` });
  });

  it("treats --json as a switch only in flag position, with Go flag rules, as discovery and design do", async () => {
    const root = project();
    for (const spelling of ["-json", "--json=true"]) {
      const out = await buildos(["intake", "convert", spelling], root);
      assert.equal(out.code, 1);
      assert.equal(out.stdout, "");
      assert.match(out.stderr, /^flag provided but not defined: -json\nUsage of convert:\n/);
      assert.match(out.stderr, /buildos-intake: error: flag provided but not defined: -json\n$/);
    }
    // A flag value: `--source --json` names a source called `--json`.
    const value = await buildos(["intake", "convert", "--repo-root", root, "--source", "--json"], root);
    assert.deepEqual([value.code, value.stdout], [1, ""]);
    assert.match(value.stderr, /^buildos-intake: error: read source: /);
    // Before the subcommand, `--json` is the command or subcommand name, as in Go.
    assert.deepEqual(await buildos(["intake", "--json"], root), { code: 1, stdout: "", stderr: `${INTAKE_USAGE}buildos-intake: error: unknown command "--json"\n` });
    assert.deepEqual(await buildos(["intake", "index", "--json"], root), { code: 1, stdout: "", stderr: "buildos-intake: error: index requires subcommand references or playbooks\n" });
    // Help stays the Go usage text (PE-001, PE-002).
    assert.deepEqual(await buildos(["intake", "help", "--json"], root), { code: 0, stdout: INTAKE_USAGE, stderr: "" });
    assert.doesNotMatch(INTAKE_USAGE, /--json/);
  });

  it("is recorded as approved parity exception PE-022 with the owner decision of 2026-11-25", () => {
    const entry = loadExceptions().exceptions.find((e) => e.id === "PE-022");
    assert.ok(entry !== undefined, "PE-022 is in parity-exceptions.json");
    assert.match(entry.owner_decision, /2026-11-25/);
    assert.match(entry.owner_decision, /D-010/);
    assert.deepEqual([entry.golden, entry.go_seed], [[], []]);
  });
});

// W1 R7 P9 intake JSON review round 1: one regression test per finding.
describe("buildos intake --json, review round 1 (PE-022)", () => {
  const inventory = ["intake", "convert", "--source", "inputs/inventory.xlsx"];
  const twin = (root: string, name: string) => join(root, "assets", "inventory", `inventory-${name}.csv`);

  it("finding 2: an unexpected error prints exactly one form, the one the leaf parser decided, with the leaf's root", async () => {
    const root = project();
    const json = await buildos(["intake", "convert", "--json", "--repo-root", root, "--source", "inputs/stock.csv"], root, portFault("stock.csv"));
    assert.equal(json.code, 1);
    const failed = envelope(json);
    assert.deepEqual([failed.ok, failed.root, failed.write_status, failed.result], [false, root, "not_requested", null]);
    assert.deepEqual(failed.diagnostics.map((d) => [d.code, d.message]), [["internal_error", "injected port fault"]]);
    // `--json` as a flag value, after a positional argument, or after `--` is not the switch: only the text line.
    for (const args of [
      ["--repo-root", root, "--source", "--json"],
      ["--repo-root", root, "--source", "inputs/stock.csv", "extra", "--json"],
      ["--repo-root", root, "--source", "inputs/stock.csv", "--", "--json"],
    ]) {
      const suffix = args[3] === "--json" ? "--json" : "stock.csv";
      assert.deepEqual(await buildos(["intake", "convert", ...args], root, portFault(suffix)), { code: 1, stdout: "", stderr: "buildos: internal error: injected port fault\n" }, args.join(" "));
    }
  });

  it("finding 3: a dry run refuses a twin over the read-back limit with the same diagnostic as the write", async () => {
    // inputs/stock.csv is 18 bytes; its twin with the front matter is larger than 100 bytes.
    const root = project();
    const args = ["intake", "convert", "--repo-root", root, "--source", "inputs/stock.csv"];
    const [dry, write, text] = await withIntakeLimit(100, async () => [await buildos([...args, "--json", "--dry-run"], root), await buildos([...args, "--json"], root), await buildos([...args, "--dry-run"], root)]);
    const planned = envelope(dry);
    const applied = envelope(write);
    assert.deepEqual([dry.code, write.code, text.code], [4, 4, 4]);
    assert.deepEqual([planned.ok, planned.write_status], [false, "not_requested"]);
    assert.deepEqual(planned.diagnostics, applied.diagnostics);
    assert.equal(planned.diagnostics[0]!.code, "file_too_large_to_read_back");
    assert.match(planned.diagnostics[0]!.message, /^assets\/stock\/stock\.csv would be \d+ bytes, more than the 100 bytes BuildOS reads/);
    assert.equal(text.stderr, `buildos-intake: error: ${planned.diagnostics[0]!.message}\n`);
    assert.equal(existsSync(join(root, "assets", "stock")), false);
  });

  it("finding 4: the root is intake's cleaned root after the parse, for a usage error and for an empty --repo-root", async () => {
    const root = project();
    const usage = await buildos(["intake", "convert", "--json", "--repo-root", root], root);
    assert.equal(usage.code, 1);
    assert.deepEqual([envelope(usage).root, envelope(usage).diagnostics[0]!.message], [root, "convert requires --source"]);
    for (const spelling of [["--repo-root="], ["--repo-root", ""]]) {
      const dry = await buildos(["intake", "convert", "--json", ...spelling, "--source", "inputs/table.csv", "--dry-run"], root);
      assert.equal(dry.code, 0);
      assert.equal(envelope(dry).root, root, `${spelling.join(" ")} is the current folder, as intake uses it`);
    }
    // Before the flags parse, no root is known (as discovery and design report it).
    assert.equal(envelope(await buildos(["intake", "convert", "--json", "--bogus"], root)).root, "");
  });

  it("finding 5: result paths are project-relative with /, an allowed outside destination is absolute with /, and the text form keeps native paths", async () => {
    const root = project();
    const dry = envelope(await buildos([...inventory, "--json", "--repo-root", root, "--dry-run"], root));
    assert.deepEqual((dry.result!["outputs"] as { path: string }[]).map((o) => o.path), ["stock-levels", "suppliers-terms", "notes"].map((name) => `assets/inventory/inventory-${name}.csv`));
    assert.deepEqual(dry.result!["side_artifacts"], ["assets/inventory/media/image1.png"]);
    const text = await buildos([...inventory, "--repo-root", root, "--dry-run"], root);
    assert.ok(text.stdout.endsWith(`would write side artifact ${join(root, "assets", "inventory", "media", "image1.png")}\n`));

    const outside = join(scratch, `outside-${counter}`, "playbooks.json");
    const allowed = envelope(await buildos(["intake", "index", "playbooks", "--json", "--allow-outside-root", "--repo-root", root, "--output", outside], root));
    assert.deepEqual([allowed.ok, allowed.root, allowed.result!["output_path"]], [true, root, slashed(outside)]);
    const again = await buildos(["intake", "index", "playbooks", "--allow-outside-root", "--repo-root", root, "--output", outside], root);
    assert.equal(again.stdout, `wrote ${outside} (0 playbooks)\n`);
  });

  it("finding 7: help forms: help prints text; a subcommand --help is a Go flag request, an envelope with --json, as discovery and design", async () => {
    const root = project();
    for (const args of [["intake", "help"], ["intake", "--help"], ["intake", "help", "--json"], ["help", "intake"]]) {
      assert.deepEqual(await buildos(args, root), { code: 0, stdout: INTAKE_USAGE, stderr: "" }, args.join(" "));
    }
    for (const [domain, leaf] of [["intake", ["convert"]], ["discovery", ["run", "discovery"]], ["design", ["promote", "finding"]]] as const) {
      const out = await buildos([domain, ...leaf, "--json", "--help"], root);
      assert.equal(out.code, 1);
      assert.deepEqual(envelope(out).diagnostics.map((d) => [d.code, d.message]), [["usage_error", "flag: help requested"]]);
      // Review round 2 (finding 9): `--help` before `--json` stops the parse first, so the text form prints.
      for (const flags of [["--help"], ["--help", "--json"]]) {
        const text = await buildos([domain, ...leaf, ...flags], root);
        assert.deepEqual([text.code, text.stdout], [1, ""], [domain, ...leaf, ...flags].join(" "));
        assert.match(text.stderr, /flag: help requested\n$/);
      }
    }
  });
});

// W1 R7 P9 intake JSON review round 2: intake does not undo; the envelope
// names what stayed. One regression test per finding.
describe("buildos intake --json, review round 2 (PE-022)", () => {
  const inventory = ["intake", "convert", "--source", "inputs/inventory.xlsx"];
  const twin = (root: string, name: string) => join(root, "assets", "inventory", `inventory-${name}.csv`);
  const created = (path: string) => ({ path, reason: "created", state: "left" });
  const changed = (path: string) => ({ path, reason: "changed", state: "left" });
  const posixOnly: { skip: string | false } = { skip: process.platform === "win32" ? "POSIX file names and links" : false };
  const notRoot: { skip: string | false } = { skip: process.platform === "win32" ? "POSIX permissions" : typeof process.getuid === "function" && process.getuid() === 0 ? "root ignores permissions" : false };

  it("findings 1 and 2: a failed write keeps what the run made, with and without --json, and names each path once", async () => {
    // The workbook writes media/image1.png, then three twins: write 2 is the first twin.
    const root = project();
    const out = await buildos([...inventory, "--json", "--repo-root", root], root, withWriter(diskFullOnWrite(2)));
    assert.equal(out.code, 10);
    const partial = envelope(out);
    assert.deepEqual([partial.ok, partial.root, partial.write_status], [false, root, "partially_applied"]);
    assert.deepEqual(partial.result, {
      left_in_place: [created("assets/inventory/"), created("assets/inventory/media/"), created("assets/inventory/media/image1.png"), created("assets/inventory/inventory-stock-levels.csv")],
    });
    assert.deepEqual(partial.diagnostics.map((d) => [d.code, d.severity]), [["command_failed", "error"], ...Array(4).fill(["left_in_place", "error"])]);
    assert.ok(partial.diagnostics[0]!.message.endsWith(`: ${NO_SPACE}`), partial.diagnostics[0]!.message);
    assert.equal(partial.diagnostics[1]!.message, `assets/inventory/: ${CREATED("folder")}`);
    assert.equal(partial.diagnostics[4]!.message, `assets/inventory/inventory-stock-levels.csv: ${CREATED("file")}`);
    assert.ok(existsSync(join(root, "assets", "inventory", "media", "image1.png")), "nothing is removed");
    assert.equal(readFileSync(twin(root, "stock-levels")).length, 4, "the partial twin stays, as in the text form");

    const textRoot = project();
    const text = await buildos([...inventory, "--repo-root", textRoot], textRoot, withWriter(diskFullOnWrite(2)));
    assert.deepEqual([text.code, text.stdout], [1, ""]);
    assert.ok(text.stderr.startsWith("buildos-intake: error: write ") && text.stderr.endsWith(`: ${NO_SPACE}\n`), text.stderr);
    assert.ok(existsSync(join(textRoot, "assets", "inventory", "media", "image1.png")));
    assert.equal(readFileSync(twin(textRoot, "stock-levels")).length, 4);
  });

  it("finding 1: a folder that another program made during the run is not listed and still exists after the failure", async () => {
    // Another program makes assets/inventory/ just before BuildOS's mkdir of it.
    const root = project();
    const openFs: FsPortFactory = (base, cwd, options) => {
      const port = createNodeFsPort(base, cwd, options);
      return {
        ...port,
        mkdir(path, mkdirOptions) {
          if (String(path) === "assets/inventory") mkdirSync(join(root, "assets", "inventory"));
          return port.mkdir(path, mkdirOptions);
        },
      };
    };
    const domain: Domain = { ...intakeDomain, run: (args, context) => runIntake(args, context, { openWriter: diskFullOnWrite(1) }) };
    const out = await buildos([...inventory, "--json", "--repo-root", root], root, { domains: [domain], openFs });
    assert.ok(existsSync(join(root, "assets", "inventory")), "the other program's folder stays");
    assert.equal(out.code, 10);
    const partial = envelope(out);
    assert.deepEqual(partial.result, { left_in_place: [created("assets/inventory/media/"), created("assets/inventory/media/image1.png")] });
  });

  it("finding 2: a file that another program put in place of the run's file still exists after the failure", async () => {
    const root = project();
    const image = join(root, "assets", "inventory", "media", "image1.png");
    const replace = (call: number) => {
      if (call !== 1) return;
      unlinkSync(image);
      writeFileSync(image, "another program");
    };
    const out = await buildos([...inventory, "--json", "--repo-root", root], root, withWriter(diskFullOnWrite(2, undefined, replace)));
    assert.ok(existsSync(image), "the other program's file stays");
    assert.equal(readFileSync(image, "utf8"), "another program");
    assert.equal(out.code, 10);
    // Final check, finding 4: the diagnostic says what the run did then, and asks to look at the entry before a removal.
    const stays = envelope(out).diagnostics.find((d) => d.message.startsWith("assets/inventory/media/image1.png: "))!;
    assert.deepEqual([stays.code, stays.message, stays.correction], ["left_in_place", `assets/inventory/media/image1.png: ${CREATED("file")}`, LOOK_FIRST]);
  });

  it("findings 1 and 8: a failed run that changed nothing is not_requested with the text form's exit code; a changed index says what happened", async () => {
    // The open of the one index write fails: nothing changed.
    const root = seeded("references");
    mkdirSync(join(root, ".os", "indexes"), { recursive: true });
    const none = await buildos(["intake", "index", "references", "--json", "--repo-root", root], root, withWriter(diskFullOnWrite(1, undefined, undefined, true)));
    assert.equal(none.code, 1);
    assert.deepEqual([envelope(none).write_status, envelope(none).result], ["not_requested", null]);

    // New folders for the index are listed.
    const folders = await buildos(["intake", "index", "references", "--json", "--repo-root", root, "--output", "new/deeper/refs.json"], root, withWriter(diskFullOnWrite(1)));
    assert.equal(folders.code, 10);
    assert.deepEqual(envelope(folders).result, { left_in_place: [created("new/"), created("new/deeper/"), created("new/deeper/refs.json")] });

    // An existing index that the failed write overwrote.
    const index = join(root, ".os", "indexes", "references.json");
    writeFileSync(index, "{}\n");
    const over = await buildos(["intake", "index", "references", "--json", "--repo-root", root], root, withWriter(diskFullOnWrite(1)));
    assert.equal(over.code, 10);
    const partial = envelope(over);
    assert.deepEqual(partial.result, { left_in_place: [changed(".os/indexes/references.json")] });
    assert.equal(partial.diagnostics[1]!.message, ".os/indexes/references.json: the existing index was partly or fully overwritten before the failure, and its earlier content is lost");
    assert.ok(partial.diagnostics.every((d) => !d.message.includes("--force")), "the index commands have no --force");
  });

  it("finding 1: --force names each earlier file that the run changed, and removes nothing", async () => {
    const root = project();
    assert.equal((await buildos([...inventory, "--repo-root", root], root)).code, 0);
    const out = await buildos([...inventory, "--json", "--force", "--repo-root", root], root, withWriter(diskFullOnWrite(2)));
    assert.equal(out.code, 10);
    const partial = envelope(out);
    assert.deepEqual(partial.result, { left_in_place: [changed("assets/inventory/media/image1.png"), changed("assets/inventory/inventory-stock-levels.csv")] });
    assert.equal(partial.diagnostics[1]!.message, "assets/inventory/media/image1.png: this run overwrote or replaced this existing entry before the failure, and its earlier content is lost");
    for (const name of ["stock-levels", "suppliers-terms", "notes"]) assert.ok(existsSync(twin(root, name)), `${name} stays`);
    const text = await buildos([...inventory, "--force", "--repo-root", root], root, withWriter(diskFullOnWrite(2)));
    assert.deepEqual([text.code, text.stdout], [1, ""]);
  });

  // POSIX only, as the other intake link tests (test/intake-edge.test.ts).
  it("finding 3: a folder made below an allowed link out of the root (--allow-outside-root) is listed", posixOnly, async () => {
    const root = project();
    const outside = join(scratch, `linked-${counter}`);
    mkdirSync(outside);
    symlinkSync(outside, join(root, "assets", "ext"), "dir");
    const args = [...inventory, "--json", "--allow-outside-root", "--repo-root", root, "--assets-root", "assets/ext"];
    const out = await buildos(args, root, withWriter(diskFullOnWrite(2)));
    assert.equal(out.code, 10);
    assert.deepEqual(envelope(out).result, {
      left_in_place: [created("assets/ext/inventory/"), created("assets/ext/inventory/media/"), created("assets/ext/inventory/media/image1.png"), created("assets/ext/inventory/inventory-stock-levels.csv")],
    });
    assert.ok(existsSync(join(outside, "inventory", "media", "image1.png")));
  });

  it("finding 4: a refusal before the open stays exit 3 (or the text form's code), not_requested, and result null", async () => {
    const cases: { name: string; output: string; setup: (root: string) => void; code: number; skip: false | string }[] = [
      // The port refuses a Windows device name in any folder on every platform.
      { name: "a reserved device name", output: "assets/CON.json", setup: () => {}, code: 3, skip: false },
      { name: "a link to a device", output: "assets/null.json", setup: (root) => symlinkSync("/dev/null", join(root, "assets", "null.json")), code: 3, skip: posixOnly.skip },
      { name: "a folder that refuses the open", output: "assets/locked/index.json", setup: (root) => { mkdirSync(join(root, "assets", "locked")); chmodSync(join(root, "assets", "locked"), 0o500); }, code: 1, skip: notRoot.skip },
    ];
    for (const item of cases) {
      if (item.skip !== false) continue;
      const root = project();
      item.setup(root);
      try {
        const args = ["intake", "index", "playbooks", "--repo-root", root, "--output", item.output];
        const text = await buildos(args, root);
        assert.deepEqual([text.code, text.stdout], [item.code, ""], item.name);
        const out = await buildos([...args, "--json"], root);
        assert.equal(out.code, item.code, item.name);
        const failed = envelope(out);
        assert.deepEqual([failed.ok, failed.write_status, failed.result, failed.diagnostics.length], [false, "not_requested", null, 1], item.name);
      } finally {
        if (existsSync(join(root, "assets", "locked"))) chmodSync(join(root, "assets", "locked"), 0o755);
      }
    }
  });

  it("finding 5: two writes to one path (--force, two HTML files with one twin name) list the path once, as created", async () => {
    const root = project();
    mkdirSync(join(root, "inputs", "pages"));
    writeFileSync(join(root, "inputs", "pages", "a b.html"), "<html><body><p>one</p></body></html>");
    writeFileSync(join(root, "inputs", "pages", "a-b.html"), "<html><body><p>two</p></body></html>");
    const args = ["intake", "convert", "--json", "--force", "--repo-root", root, "--source", "inputs/pages"];
    const dry = envelope(await buildos([...args, "--dry-run"], root));
    assert.deepEqual((dry.result!["outputs"] as { path: string }[]).map((o) => o.path), ["assets/pages/a-b.md", "assets/pages/a-b.md"]);
    const out = await buildos(args, root, withWriter(diskFullOnWrite(2)));
    assert.equal(out.code, 10);
    const partial = envelope(out);
    assert.deepEqual(partial.result, { left_in_place: [created("assets/pages/"), created("assets/pages/a-b.md")] });
    assert.equal(partial.diagnostics.length, 3);
    assert.ok(partial.diagnostics.every((d) => !/restor|put back|earlier content/.test(d.message)), "no recovery text for a file this run made");
  });

  it("finding 7: a project-root source named `..draft.csv` is project-relative in the envelope; the front matter keeps Go's text", async () => {
    const root = project();
    writeFileSync(join(root, "..draft.csv"), "a,b\n1,2\n");
    const dry = envelope(await buildos(["intake", "convert", "--json", "--repo-root", root, "--source", "..draft.csv", "--dry-run"], root));
    const outputs = dry.result!["outputs"] as { path: string; source: string }[];
    assert.deepEqual([outputs[0]!.path, outputs[0]!.source], ["assets/draft/draft.csv", "..draft.csv"]);
    // The front matter keeps Go's `repoRelative` text (the absolute path for a name that starts with `..`).
    assert.equal((await buildos(["intake", "convert", "--repo-root", root, "--source", "..draft.csv"], root)).code, 0);
    assert.match(readFileSync(join(root, "assets", "draft", "draft.csv"), "utf8"), new RegExp(`^---\\nsource: "${slashed(join(root, "..draft.csv")).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\n`));
  });

  it("finding 7: on POSIX, a folder named `..\\draft` is inside the root in the envelope", posixOnly, async () => {
    const root = project();
    mkdirSync(join(root, "..\\draft"));
    writeFileSync(join(root, "..\\draft", "t.csv"), "a,b\n1,2\n");
    const dry = envelope(await buildos(["intake", "convert", "--json", "--repo-root", root, "--source", "..\\draft/t.csv", "--assets-root", "..\\out", "--dry-run"], root));
    const outputs = dry.result!["outputs"] as { path: string; source: string }[];
    assert.deepEqual([outputs[0]!.path, outputs[0]!.source], ["..\\out/t/t.csv", "..\\draft/t.csv"]);
    const text = await buildos(["intake", "convert", "--repo-root", root, "--source", "..\\draft/t.csv", "--assets-root", "..\\out", "--dry-run"], root);
    assert.equal(text.stdout, `would write ${join(root, "..\\out", "t", "t.csv")}\n`);
  });
});

describe("buildos intake --json, final check (PE-022)", () => {
  const inventory = ["intake", "convert", "--source", "inputs/inventory.xlsx"];
  const created = (path: string) => ({ path, reason: "created", state: "left" });
  const changed = (path: string) => ({ path, reason: "changed", state: "left" });
  const posixOnly: { skip: string | false } = { skip: process.platform === "win32" ? "POSIX links" : false };

  it("finding 1: without --force, a twin that another program makes after the last check gives the --force error and keeps its bytes", async () => {
    for (const json of [false, true]) {
      const root = project();
      const twin = join(root, "assets", "table", "table.csv");
      // Another program makes the twin after intake's existence check, before the writer's own check.
      const racing: InPlaceWritePortFactory = (base, cwd, options) => {
        const real = createNodeInPlaceWriter(base, cwd, options);
        return { ...real, writeFileInPlace: (path, data, mode, writeOptions) => (writeFileSync(twin, "another program"), real.writeFileInPlace(path, data, mode, writeOptions)) };
      };
      const args = ["intake", "convert", "--repo-root", root, "--source", "inputs/table.csv", ...(json ? ["--json"] : [])];
      const out = await buildos(args, root, withWriter(racing));
      assert.equal(readFileSync(twin, "utf8"), "another program", "the other program's file is not truncated");
      const message = `output exists, use --force to overwrite: ${twin}`;
      if (!json) assert.deepEqual([out.code, out.stdout, out.stderr], [1, "", `buildos-intake: error: ${message}\n`]);
      else {
        // The run made the twin's folder first: that stays and is listed.
        assert.equal(out.code, 10);
        const partial = envelope(out);
        assert.deepEqual(partial.result, { left_in_place: [created("assets/table/")] });
        assert.equal(partial.diagnostics[0]!.message, message);
      }
    }
  });

  it("finding 1: without --force, a side artifact that another program makes just before the exclusive create is not overwritten", async () => {
    for (const json of [false, true]) {
      const root = project();
      const image = join(root, "assets", "inventory", "media", "image1.png");
      writeRaceHooks.beforeOpen = (step, entry) => {
        if (step === "in-place" && entry.endsWith("image1.png")) writeFileSync(entry, "another program");
      };
      let out: { code: number; stdout: string; stderr: string };
      try {
        out = await buildos([...inventory, "--repo-root", root, ...(json ? ["--json"] : [])], root);
      } finally {
        writeRaceHooks.beforeOpen = undefined;
      }
      assert.equal(readFileSync(image, "utf8"), "another program", "the collision is not tried again as an overwrite");
      const message = `side artifact exists, use --force to overwrite: ${image}`;
      if (!json) assert.deepEqual([out.code, out.stdout, out.stderr], [1, "", `buildos-intake: error: ${message}\n`]);
      else {
        assert.equal(out.code, 10);
        const partial = envelope(out);
        assert.deepEqual(partial.result, { left_in_place: [created("assets/inventory/"), created("assets/inventory/media/")] });
        assert.equal(partial.diagnostics[0]!.message, message);
      }
    }
  });

  it("finding 2: a refusal of the writer itself (openWriter) is exit 3, not_requested, and result null, as the text form", async () => {
    const refusing: InPlaceWritePortFactory = () => {
      throw new PathRefusedError("outside-root", "the writer refused the root");
    };
    const root = seeded("playbooks");
    mkdirSync(join(root, ".os", "indexes"), { recursive: true });
    const args = ["intake", "index", "playbooks", "--repo-root", root];
    const text = await buildos(args, root, withWriter(refusing));
    assert.deepEqual([text.code, text.stdout], [3, ""]);
    const out = await buildos([...args, "--json"], root, withWriter(refusing));
    assert.equal(out.code, 3);
    const failed = envelope(out);
    assert.deepEqual([failed.ok, failed.write_status, failed.result, failed.diagnostics.length], [false, "not_requested", null, 1]);
    assert.equal(existsSync(join(root, ".os", "indexes", "playbooks.json")), false);
  });

  it("finding 3: an open failure after the writer removed an index link names the link; the linked file keeps its bytes", posixOnly, async () => {
    const root = seeded("references");
    mkdirSync(join(root, ".os", "indexes"), { recursive: true });
    writeFileSync(join(root, ".os", "indexes", "real.json"), "{}\n");
    symlinkSync("real.json", join(root, ".os", "indexes", "references.json"));
    writeRaceHooks.beforeOpen = (step) => {
      if (step === "in-place") throw Object.assign(new Error("EACCES: injected open fault"), { code: "EACCES", syscall: "open" });
    };
    let out: { code: number; stdout: string; stderr: string };
    try {
      out = await buildos(["intake", "index", "references", "--json", "--repo-root", root], root);
    } finally {
      writeRaceHooks.beforeOpen = undefined;
    }
    assert.equal(out.code, 10);
    const partial = envelope(out);
    assert.deepEqual(partial.result, { left_in_place: [changed(".os/indexes/references.json")] });
    assert.equal(partial.diagnostics[1]!.message, ".os/indexes/references.json: this run removed the link at this path before the failure, and the file that the link pointed to is not changed; make this link again if you need it");
    assert.equal(readFileSync(join(root, ".os", "indexes", "real.json"), "utf8"), "{}\n");
    assert.equal(existsSync(join(root, ".os", "indexes", "references.json")), false, "the link is gone");
  });

  it("finding 5: two spellings of one file on a case-insensitive volume are listed once; two files stay two entries", async () => {
    const root = project();
    const documentXml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hi</w:t></w:r></w:p></w:body></w:document>';
    writeFileSync(join(root, "inputs", "doc.docx"), zip([["word/document.xml", documentXml], ["word/media/image1.png", "one"], ["word/media/IMAGE1.PNG", "two"]]));
    const out = await buildos(["intake", "convert", "--json", "--force", "--repo-root", root, "--source", "inputs/doc.docx"], root, withWriter(diskFullOnWrite(3)));
    assert.equal(out.code, 10);
    const media = join(root, "assets", "doc", "media");
    const insensitive = readdirSync(media).length === 1;
    const listed = (envelope(out).result!["left_in_place"] as { path: string }[]).map((item) => item.path);
    const images = insensitive ? ["assets/doc/media/image1.png"] : ["assets/doc/media/image1.png", "assets/doc/media/IMAGE1.PNG"];
    assert.deepEqual(listed, ["assets/doc/", "assets/doc/media/", ...images, "assets/doc/doc.md"]);
    assert.deepEqual((envelope(out).result!["left_in_place"] as { reason: string }[]).map((item) => item.reason), listed.map(() => "created"));
  });

  it("finding 6: a close that fails after a complete write lists the new or changed file with the close step", async () => {
    const root = seeded("references");
    mkdirSync(join(root, ".os", "indexes"), { recursive: true });
    writeRaceHooks.afterStep = () => {
      throw Object.assign(new Error("EIO: injected close fault"), { code: "EIO", syscall: "close" });
    };
    try {
      const fresh = await buildos(["intake", "index", "references", "--json", "--repo-root", root], root);
      assert.equal(fresh.code, 10);
      assert.deepEqual(envelope(fresh).result, { left_in_place: [created(".os/indexes/references.json")] });
      assert.ok(envelope(fresh).diagnostics[0]!.message.startsWith("close "), envelope(fresh).diagnostics[0]!.message);
      const again = await buildos(["intake", "index", "references", "--json", "--repo-root", root], root);
      assert.equal(again.code, 10);
      assert.deepEqual(envelope(again).result, { left_in_place: [changed(".os/indexes/references.json")] });
    } finally {
      delete writeRaceHooks.afterStep;
    }
  });
});
