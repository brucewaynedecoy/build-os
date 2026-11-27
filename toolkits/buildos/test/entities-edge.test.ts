// W1 R7 P3 review fixes, through the packaged binary (the esbuild bundle),
// against the Go seed (test/fixtures/go-seed/entity-edge-goldens.json, from
// scripts/capture-entity-edge-goldens.ts). Each case compares the exit code,
// stdout, stderr, and the file tree after the run with Go 1.24.1's:
// - a symlink loop at the index after the canonical rename (exit 6, the
//   consolidation result, and the exact recovery command);
// - a symlink, or a dangling symlink, at a write target: the entry is
//   replaced and the file it pointed at is kept;
// - Go's case-insensitive key matching (`bytes.EqualFold`): `versıon` is not
//   `version`, `mappingſ` is `mappings`;
// - integer-like IDs in both index maps, in Go's byte order;
// - 8000 and 10000 levels of nesting, and one past Go's limit;
// - an out-of-range trailing number after the manifest and the index;
// - permission denial at the temporary file, with Go's `open <name>` text;
// - repeated (case-folded) keys that decode into an existing slice, struct,
//   or map (review round 2, finding 1).
// The random part of the temporary name in Go's `os.CreateTemp` permission
// diagnostic is normalized to `{RAND}` only in the diagnostic message of the
// two temporary-file cases, when the whole message equals the case's template
// (see the script). The file tree is snapshotted before the folder
// permissions are restored, and covers the files outside the root.
// "harness plants" (review fix round 3) proves that a changed mode, a write
// through a link to an outside file, and a changed manifest fail a case.
// The cases of the approved parity exceptions PE-004 (scope extension),
// PE-006, and PE-007 pass only with exactly the differences that
// test/golden/parity-exceptions.json lists under `edge`.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../scripts/build.ts";
import { EDGE_CASES, type EdgeCase, normalizeEdge, runEdgeCase, tempMessage } from "../scripts/capture-entity-edge-goldens.ts";
import { edgeExceptionProblems, loadExceptions, seedWithPrintedCommands } from "./golden/harness.ts";

let dir: string;
let program: string[];

before(
  async () => {
    dir = mkdtempSync(join(tmpdir(), "buildos-p3-edge-"));
    program = [process.execPath, await bundle({ outfile: join(dir, "buildos.js") })];
  },
  { timeout: 60_000 },
);
after(() => rmSync(dir, { recursive: true, force: true }));

const posix = process.platform !== "win32";
const asRoot = process.getuid?.() === 0;

describe("entity edge cases match the Go seed (P3 review fixes)", { skip: posix ? false : "POSIX symlinks and folder permissions" }, () => {
  const goldens = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "go-seed", "entity-edge-goldens.json"), "utf8")) as {
    goVersion: string;
    cases: { name: string; exit: number; stdout: string; stderr: string; tree: Record<string, string> }[];
  };

  it("has Go 1.24.1 goldens for every case", () => {
    assert.equal(goldens.goVersion, "go1.24.1");
    assert.deepEqual(
      goldens.cases.map((c) => c.name),
      EDGE_CASES.map((c) => c.name),
    );
  });

  it("the index loop golden exits 6 with the recovery command", () => {
    const golden = goldens.cases.find((c) => c.name === "index-loop-after-commit")!;
    assert.equal(golden.exit, 6);
    assert.match(golden.stdout, /"write_status": "canonical_applied_index_failed"/);
    assert.match(golden.stdout, /"recovery_command": "buildos entities rebuild-index --root \\"\{ROOT\}\/root\\" --mode strict --apply"/);
  });

  const exceptions = loadExceptions();

  it("lists each exception case under exactly its approved exception, and every edge entry names a known case", () => {
    const names = new Map(EDGE_CASES.map((c) => [c.name, c.exception]));
    const listed = exceptions.exceptions.flatMap((e) => (e.edge ?? []).map((x) => ({ id: e.id, name: x.case, field: x.field })));
    for (const x of listed) {
      assert.ok(names.has(x.name), `${x.id} names unknown edge case ${x.name}`);
      assert.equal(names.get(x.name), x.id, `${x.name} is listed under ${x.id}`);
      assert.ok(["exit", "stdout", "stderr", "tree"].includes(x.field), `${x.id} ${x.name}: unknown field ${x.field}`);
    }
    assert.deepEqual(
      [...new Set(listed.map((x) => `${x.id} ${x.name}`))].sort(),
      ["PE-004 root-without-os-data", "PE-006 consolidate-dry-run-os-read-only", "PE-007 dataset-link-outside-root"],
    );
    for (const c of EDGE_CASES.filter((x) => x.exception !== undefined)) assert.ok(listed.some((x) => x.name === c.name), `${c.name} names ${c.exception}, which does not list it`);
  });

  it("the exception goldens show the Go behavior each exception describes", () => {
    const go = (name: string) => goldens.cases.find((c) => c.name === name)!;
    assert.equal(go("root-without-os-data").exit, 3);
    assert.match(go("root-without-os-data").stdout, /"root": "",[\s\S]*"code": "internal_error"[\s\S]*expected \.os\/data: stat \{ROOT\}\/root\/\.os\/data: no such file or directory/);
    assert.equal(go("consolidate-dry-run-os-read-only").exit, 5);
    assert.match(go("consolidate-dry-run-os-read-only").stdout, /create prospective graph directory: mkdir \{ROOT\}\/root\/\.os\/\.buildos-consolidation-preflight-[0-9]+: permission denied/);
    assert.equal(go("dataset-link-outside-root").exit, 0);
    assert.match(go("dataset-link-outside-root").tree["./.os/data/personas.jsonl"]!, /^file 640 /);
  });

  it("the goldens snapshot the locked folder before its mode is restored, and the files outside the root", () => {
    const go = (name: string) => goldens.cases.find((c) => c.name === name)!;
    assert.equal(go("consolidate-dry-run-os-read-only").tree["./.os"], "dir 555");
    assert.equal(go("index-temp-permission").tree["./.os/indexes"], "dir 555");
    assert.equal(go("canonical-temp-permission").tree["./.os/data"], "dir 555");
    const rows = `${[{ id: "Alfa", type: "persona", status: "active" }, { id: "Zulu", type: "persona", status: "active" }].map((r) => JSON.stringify(r)).join("\n")}\n`;
    assert.equal(go("dataset-link-outside-root").tree["../outside.jsonl"], `file 640 ${createHash("sha256").update(rows).digest("hex")}`);
    for (const c of EDGE_CASES) assert.match(go(c.name).tree["../manifest.json"]!, /^file 644 [0-9a-f]{64}$/, c.name);
  });

  it("the temporary-file goldens hold the normalized diagnostic exactly once, in the diagnostics message", () => {
    const temps = EDGE_CASES.filter((c) => c.temp !== undefined);
    assert.deepEqual(
      temps.map((c) => c.name),
      ["index-temp-permission", "canonical-temp-permission"],
    );
    for (const c of temps) {
      const golden = goldens.cases.find((g) => g.name === c.name)!;
      const envelope = JSON.parse(golden.stdout) as { diagnostics: { message: string }[] };
      assert.deepEqual(
        envelope.diagnostics.map((d) => d.message),
        [tempMessage(c.temp!, "{RAND}")],
      );
      assert.equal(golden.stdout.split("{RAND}").length, 2);
    }
    for (const g of goldens.cases) if (!temps.some((c) => c.name === g.name)) assert.ok(!`${g.stdout}${g.stderr}`.includes("{RAND}"), g.name);
  });

  for (const c of EDGE_CASES) {
    const permission = c.plant === "indexes-read-only" || c.plant === "data-read-only" || c.plant === "os-read-only";
    const title = c.exception === undefined ? `${c.name} matches Go byte for byte (${c.covers})` : `${c.name} differs from Go exactly as ${c.exception} allows (${c.covers})`;
    it(title, { skip: permission && asRoot ? "running as root ignores folder permissions" : false }, () => {
      // PE-023: Go's printed fix commands in the port's form; every other byte as Go wrote it.
      const golden = seedWithPrintedCommands(c.name, goldens.cases.find((g) => g.name === c.name)!, "edge", exceptions);
      const ours = runEdgeCase(program, c);
      assert.deepEqual(edgeExceptionProblems(c.name, c.exception, golden, ours, exceptions), []);
      if (c.exception === undefined) {
        assert.equal(ours.exit, golden.exit, "exit code");
        assert.equal(ours.stdout, golden.stdout, "stdout");
        assert.equal(ours.stderr, golden.stderr, "stderr");
        assert.deepEqual(ours.tree, golden.tree, "file tree");
      }
    });
  }
});

describe("harness plants: a run that changes a mode or a file outside the root fails (review fix round 3)", { skip: posix && !asRoot ? false : "POSIX folder permissions, not as root" }, () => {
  const goldens = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "go-seed", "entity-edge-goldens.json"), "utf8")) as {
    cases: { name: string; exit: number; stdout: string; stderr: string; tree: Record<string, string> }[];
  };
  const exceptions = loadExceptions();
  // Runs the bundle with the arguments it is given, then does `action` to the fixture, then exits with the bundle's code.
  const wrapper = () => {
    const path = join(dir, "plant.mjs");
    writeFileSync(
      path,
      [
        'import { spawnSync } from "node:child_process";',
        'import { appendFileSync, chmodSync } from "node:fs";',
        'import { join } from "node:path";',
        "const [action, bundle, ...args] = process.argv.slice(2);",
        'const result = spawnSync(process.execPath, [bundle, ...args], { stdio: "inherit" });',
        'const root = args[args.indexOf("--root") + 1];',
        'if (action === "os-0775") chmodSync(join(root, ".os"), 0o775);',
        'if (action === "indexes-0755") chmodSync(join(root, ".os", "indexes"), 0o755);',
        'if (action === "data-0755") chmodSync(join(root, ".os", "data"), 0o755);',
        'if (action === "append-through-link") appendFileSync(join(root, ".os", "data", "personas.jsonl"), "planted\\n");',
        'if (action === "outside-0600") chmodSync(join(root, "..", "outside.jsonl"), 0o600);',
        'if (action === "manifest-append") appendFileSync(join(root, "..", "manifest.json"), " ");',
        "process.exit(result.status ?? 1);",
      ].join("\n"),
    );
    return path;
  };
  const run = (name: string, action: string) => {
    const c = EDGE_CASES.find((x) => x.name === name)!;
    const golden = seedWithPrintedCommands(name, goldens.cases.find((g) => g.name === name)!, "edge", exceptions);
    const ours = runEdgeCase([process.execPath, wrapper(), action, program[1]!], c);
    return { ours, problems: edgeExceptionProblems(name, c.exception, golden, ours, exceptions) };
  };
  // The case, the plant, and the snapshot entry the plant changes.
  const plants: [string, string, string, RegExp][] = [
    ["consolidate-dry-run-os-read-only", "os-0775", "./.os", /^dir 775$/],
    ["index-temp-permission", "indexes-0755", "./.os/indexes", /^dir 755$/],
    ["canonical-temp-permission", "data-0755", "./.os/data", /^dir 755$/],
    ["dataset-link-outside-root", "append-through-link", "../outside.jsonl", /^file 640 [0-9a-f]{64}$/],
    ["dataset-link-outside-root", "outside-0600", "../outside.jsonl", /^file 600 /],
    ["manifest-key-upper", "manifest-append", "../manifest.json", /^file 644 [0-9a-f]{64}$/],
  ];
  for (const [name, action, entry, value] of plants) {
    it(`${name} fails when the run does ${action}, and passes with no plant`, () => {
      assert.deepEqual(run(name, "none").problems, []);
      const { ours, problems } = run(name, action);
      assert.equal(problems.length, 1, problems.join("\n"));
      assert.match(problems[0]!, new RegExp(`^${name}: tree is `));
      assert.match(ours.tree[entry]!, value);
      assert.notEqual(ours.tree[entry], goldens.cases.find((g) => g.name === name)!.tree[entry]);
    });
  }
});

describe("edge exception judging (edgeExceptionProblems)", () => {
  const go = { exit: 5, stdout: "go\n", stderr: "", tree: { ".": "dir 755" } };
  const file = (edge: { case: string; field: "exit" | "stdout" | "stderr" | "tree"; actual: string }[]) => ({ exceptions: [{ id: "PE-900", summary: "", reason: "test", owner_decision: "test", golden: [], go_seed: [], edge }] });
  it("passes only the exact allowed values, and fails a stale entry, an unlisted field, and a wrong exception ID", () => {
    const ours = { ...go, exit: 0, stdout: "ts\n" };
    const exact = file([{ case: "c", field: "exit", actual: "0" }, { case: "c", field: "stdout", actual: "ts\n" }]);
    assert.deepEqual(edgeExceptionProblems("c", "PE-900", go, ours, exact), []);
    assert.equal(edgeExceptionProblems("c", "PE-900", go, { ...ours, stdout: "other\n" }, exact).length, 1);
    assert.equal(edgeExceptionProblems("c", "PE-900", go, { ...ours, stderr: "x" }, exact).length, 1);
    assert.equal(edgeExceptionProblems("c", "PE-900", go, { ...ours, tree: {} }, exact).length, 1);
    assert.match(edgeExceptionProblems("c", "PE-900", { ...go, exit: 0 }, ours, exact).join("\n"), /exit now equals Go; remove it from PE-900/);
    assert.match(edgeExceptionProblems("c", "PE-901", go, ours, exact).join("\n"), /names PE-901/);
    assert.match(edgeExceptionProblems("c", undefined, go, ours, exact).join("\n"), /names no exception/);
    assert.equal(edgeExceptionProblems("d", undefined, go, ours, exact).length, 2);
  });
});

describe("edge normalization (normalizeEdge)", () => {
  const work = "/scratch/buildos-edge-x";
  const temp = (name: string) => EDGE_CASES.find((c) => c.name === name)!.temp!;
  const index = temp("index-temp-permission");
  const canonical = temp("canonical-temp-permission");
  const message = (t: NonNullable<EdgeCase["temp"]>, n: string) => tempMessage(t, n).replace("{ROOT}", work);
  // The JSON envelope as the CLI prints it.
  const envelope = (diagnostic: string, result: unknown = null) => `${JSON.stringify({ ok: false, root: `${work}/root`, result, diagnostics: [{ code: "internal_error", severity: "error", message: diagnostic, correction: "Review the reported error." }] }, null, 2)}\n`;
  const human = (diagnostic: string) => `entities.consolidate: error\nroot: ${work}/root\nERROR [internal_error]: ${diagnostic}\n  action: Review the reported error.\n`;
  const rooted = (text: string) => text.replaceAll(work, "{ROOT}");

  it("normalizes the whole diagnostic message, for 0 to 4294967295, in the envelope and the human line", () => {
    for (const t of [index, canonical]) {
      for (const n of ["0", "7", "47701218", "4294967295"]) {
        assert.equal(normalizeEdge("stdout", envelope(message(t, n)), work, t), rooted(envelope(message(t, "{RAND}"))));
        assert.equal(normalizeEdge("stderr", human(message(t, n)), work, t), rooted(human(message(t, "{RAND}"))));
      }
    }
  });

  it("regression: result.requested_id with a diagnostic-shaped ID stays byte for byte (47.tmp is not 48.tmp)", () => {
    for (const id of [message(canonical, "47"), `.buildos-consolidation-47.tmp`, `open ${work}/root/.os/data/.buildos-consolidation-47.tmp: permission denied`]) {
      const ours = normalizeEdge("stdout", envelope(message(canonical, "1"), { requested_id: id }), work, canonical);
      const theirs = normalizeEdge("stdout", envelope(message(canonical, "2"), { requested_id: id.replace("47", "48") }), work, canonical);
      assert.notEqual(ours, theirs);
      assert.equal(ours, rooted(envelope(message(canonical, "{RAND}"), { requested_id: id })));
    }
    // Another message field (not a diagnostic) is kept too.
    const text = envelope(message(index, "3"), { before: { message: message(index, "47") } });
    assert.equal(normalizeEdge("stdout", text, work, index), rooted(envelope(message(index, "{RAND}"), { before: { message: message(index, "47") } })));
  });

  it("regression: a near miss of the template is kept (permission denied by policy, other words, folder, prefix, or suffix)", () => {
    const misses = [
      `${message(canonical, "5")} by policy`,
      `x${message(canonical, "5")}`,
      message(canonical, "5").replace("permission denied", "permission denied by policy"),
      message(canonical, "5").replace("canonical temporary", "entity-resolution temporary"),
      message(canonical, "5").replace(".os/data", ".os/indexes"),
      message(canonical, "5").replace("/root/", "/elsewhere/"),
      message(canonical, "5").replace(".tmp:", ".json:"),
      message(index, "5"),
      `open ${work}/root/.os/data/.buildos-consolidation-5.tmp: permission denied`,
    ];
    for (const miss of misses) {
      assert.equal(normalizeEdge("stdout", envelope(miss), work, canonical), rooted(envelope(miss)), miss);
      assert.equal(normalizeEdge("stderr", human(miss), work, canonical), rooted(human(miss)), miss);
    }
    // The human line must be the whole line, and an ERROR line with another code is kept.
    const line = `ERROR [internal_error]: ${message(canonical, "5")}`;
    for (const text of [` ${line}\n`, `${line} \n`, `ERROR [path_refused]: ${message(canonical, "5")}\n`, `WARNING [internal_error]: ${message(canonical, "5")}\n`]) {
      assert.equal(normalizeEdge("stderr", text, work, canonical), rooted(text), text);
    }
  });

  it("keeps a number past uint32, leading zeros, and other spellings", () => {
    for (const n of ["4294967296", "999999999999", "10000000000", "00", "0123", "+5", "-5", "1e3", "ff", "", "12a", "1 2"]) {
      assert.equal(normalizeEdge("stdout", envelope(message(canonical, n)), work, canonical), rooted(envelope(message(canonical, n))), n);
      assert.equal(normalizeEdge("stderr", human(message(canonical, n)), work, canonical), rooted(human(message(canonical, n))), n);
    }
  });

  it("normalizes nothing but {ROOT} in a case with no temporary-file template, on stdout that is not the envelope as printed, or in another stream", () => {
    assert.equal(normalizeEdge("stdout", envelope(message(canonical, "5")), work), rooted(envelope(message(canonical, "5"))));
    assert.equal(normalizeEdge("stderr", human(message(canonical, "5")), work), rooted(human(message(canonical, "5"))));
    const compact = JSON.stringify(JSON.parse(envelope(message(canonical, "5"))));
    const duplicate = envelope(message(canonical, "5")).replace('"ok": false', `"diagnostics": [],\n  "ok": false`);
    for (const text of [compact, envelope(message(canonical, "5")).trimEnd(), `${envelope(message(canonical, "5"))}\n`, duplicate, human(message(canonical, "5"))]) {
      assert.equal(normalizeEdge("stdout", text, work, canonical), rooted(text));
    }
    assert.equal(normalizeEdge("stderr", envelope(message(canonical, "5")), work, canonical), rooted(envelope(message(canonical, "5"))));
  });
});
