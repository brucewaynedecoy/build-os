// W1 R7 P3: `buildos entities` through the real dispatcher. Ports the Go
// seed's CLI domain tests (toolkits/buildos/internal/cli/domain_test.go and
// cli_test.go) and adds the Windows atomic-apply test (P3 t14).
//
// Go paths in this comment name the Go sources at the frozen baseline
// commit 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).

import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createEntitiesDomain, ENTITIES_HELP } from "../src/cli/commands/entities.ts";
import { run } from "../src/cli/run.ts";
import { checkIndex } from "../src/core/entities/index.ts";
import { GoError } from "../src/core/entities/io.ts";
import { FsReadFailure, FsWriteFailure, PathRefusedError } from "../src/core/shared/errors.ts";
import type { FsPort } from "../src/core/shared/fs-port.ts";
import { writeCanonicalAtomic } from "../src/core/entities/consolidate.ts";
import type { EntityHooks } from "../src/core/entities/commands.ts";
import { printedPath } from "./golden/harness.ts";
import { captureIo } from "./helpers.ts";

const scratch = mkdtempSync(join(tmpdir(), "buildos-p3-cli-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const PILOT = join(import.meta.dirname, "..", "testdata", "persona-pilot");
const DATASETS = ["requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "findings.jsonl", "extractions.jsonl"];
let counter = 0;

/** Go `writeCLIRoot`: two active personas, every other dataset empty, no index. */
function writeCliRoot(): string {
  const root = join(scratch, `root-${++counter}`);
  mkdirSync(join(root, ".os", "data"), { recursive: true });
  for (const name of DATASETS) {
    const content =
      name === "personas.jsonl"
        ? '{"id":"PER-001","type":"persona","status":"active","name":"Administrator"}\n{"id":"PER-002","type":"persona","status":"active","name":"Admin","x_keep":true}\n'
        : "";
    writeFileSync(join(root, ".os", "data", name), content, { mode: 0o644 });
  }
  return root;
}

/** Go `writeCLIManifest`. */
function writeCliManifest(): string {
  const dir = join(scratch, `manifest-${++counter}`);
  mkdirSync(dir);
  const path = join(dir, "manifest.json");
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      mappings: [{ source_id: "PER-002", target_id: "PER-001", kind: "duplicate", decided_at: "2026-07-21T15:30:00Z", decided_by: "reviewer", reason: "same reviewed persona", evidence_refs: [] }],
    }),
  );
  return path;
}

/** A copy of the persona pilot fixture; returns its folder. */
function copyPilot(): string {
  const dir = join(scratch, `pilot-${++counter}`);
  cpSync(PILOT, dir, { recursive: true });
  return dir;
}

interface Envelope {
  ok: boolean;
  root: string;
  write_status: string;
  result: Record<string, unknown> | null;
  diagnostics: { code: string; severity: string; message: string; correction?: string }[];
}

async function entities(args: string[], options: { cwd?: string; hooks?: Partial<EntityHooks> } = {}) {
  const io = captureIo(options.cwd ?? scratch);
  const code = await run(["entities", ...args], io, { domains: [createEntitiesDomain(options.hooks)], buildInfo: { version: "dev", sourceRevision: "unknown" } });
  const stdout = io.stdout();
  return { code, stdout, stderr: io.stderr(), envelope: (stdout.startsWith("{") ? JSON.parse(stdout) : undefined) as Envelope };
}

// Go spelled the root with `%q` (internal/cli/domain.go). PE-023 (owner
// decision 2026-11-26): the port always quotes it for the shell instead
// (POSIX single quotes; Windows Command Prompt double quotes, each `\` kept
// single), and a source build starts the command with `buildos`.
const recoveryFor = (root: string) => `buildos entities rebuild-index --root ${printedPath(root, process.platform)} --mode compat --apply`;
const tempFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".tmp"));

describe("entities domain (Go internal/cli tests)", () => {
  it("prints the Go entities help for no command, help, -h, and --help", async () => {
    for (const args of [[], ["help"], ["-h"], ["--help"]]) {
      const { code, stdout, stderr } = await entities(args);
      assert.equal(code, 0);
      assert.equal(stdout, ENTITIES_HELP);
      assert.equal(stderr, "");
    }
  });

  it("TestRealDomainValidateRebuildAndStrictGate", async () => {
    const root = writeCliRoot();
    let r = await entities(["validate", "--root", root, "--mode", "compat", "--json"]);
    assert.equal(r.code, 0, r.stdout);
    assert.ok(r.envelope.ok && r.envelope.write_status === "not_requested" && r.envelope.diagnostics.some((d) => d.code === "index_stale"));
    r = await entities(["validate", "--root", root, "--mode", "strict", "--json"]);
    assert.ok(r.code === 4 && !r.envelope.ok, r.stdout);
    r = await entities(["rebuild-index", "--root", root, "--mode", "compat", "--apply", "--json"]);
    assert.ok(r.code === 0 && r.envelope.ok && r.envelope.write_status === "applied", r.stdout);
    statSync(join(root, ".os", "indexes", "entity-resolution.json"));
    r = await entities(["validate", "--root", root, "--mode", "strict", "--json"]);
    assert.ok(r.code === 0 && r.envelope.ok, r.stdout);
  });

  it("TestRealDomainConsolidationDryRun", async () => {
    const root = writeCliRoot();
    const personas = join(root, ".os", "data", "personas.jsonl");
    const before = readFileSync(personas, "utf8");
    const r = await entities(["consolidate", "--root", root, "--mode", "compat", "--manifest", writeCliManifest(), "--json"]);
    assert.ok(r.code === 0 && r.envelope.ok && r.envelope.write_status === "planned", r.stdout);
    assert.equal(readFileSync(personas, "utf8"), before, "dry run changed canonical data");
  });

  describe("TestCanonicalApplyIndexFailuresUseExitSixAndRecovery", () => {
    const injected: Record<string, Partial<EntityHooks>> = {
      derive: {
        buildIndex: () => ({
          index: { version: 0, canonical_by_id: null, members_by_canonical: null },
          diagnostics: [{ code: "input_contract", severity: "error", message: "injected derivation failure", action: "rebuild after correcting the graph" }],
        }),
      },
      inspect: {
        checkIndex: () => {
          throw new GoError("injected inspection failure");
        },
      },
      apply: {
        applyIndex: () => {
          throw new GoError("injected index apply failure");
        },
      },
      // A typed refusal or read failure from the filesystem port after the
      // canonical rename is an index-completion failure too (P3 review, finding 1).
      "inspect refusal": {
        checkIndex: () => {
          throw new PathRefusedError("outside-root", ".os/indexes/entity-resolution.json resolves outside the root");
        },
      },
      "apply read failure": {
        applyIndex: () => {
          throw new FsReadFailure("read .os/indexes/entity-resolution.json failed: permission denied (EACCES)", { code: "path_unreadable", fs: { errno: "EACCES" } });
        },
      },
    };
    for (const [name, hooks] of Object.entries(injected)) {
      it(name, async () => {
        const root = writeCliRoot();
        const r = await entities(["consolidate", "--root", root, "--mode", "compat", "--manifest", writeCliManifest(), "--apply", "--json"], { hooks });
        assert.equal(r.code, 6, r.stdout);
        assert.ok(!r.envelope.ok && r.envelope.write_status === "canonical_applied_index_failed", r.stdout);
        assert.ok(r.envelope.diagnostics.some((d) => d.correction === recoveryFor(root)), `missing exact recovery: ${r.stdout}`);
        assert.equal(r.envelope.result?.["recovery_command"], recoveryFor(root));
        assert.match(readFileSync(join(root, ".os", "data", "personas.jsonl"), "utf8"), /"status":"superseded"/, "canonical write was not retained");
      });
    }
  });

  it("TestCanonicalApplyPostWriteIndexCheckFailureUsesExitSixAndRecovery", async () => {
    let checks = 0;
    const hooks: Partial<EntityHooks> = {
      checkIndex: (...args) => {
        checks++;
        if (checks === 1) return checkIndex(...args);
        throw new GoError("injected post-write index verification failure");
      },
    };
    const root = writeCliRoot();
    const r = await entities(["consolidate", "--root", root, "--mode", "compat", "--manifest", writeCliManifest(), "--apply", "--json"], { hooks });
    assert.equal(r.code, 6, r.stdout);
    assert.equal(checks, 2, "want the pre-apply and post-apply checks");
    assert.ok(!r.envelope.ok && r.envelope.write_status === "canonical_applied_index_failed");
    assert.ok(r.envelope.diagnostics.some((d) => d.correction === recoveryFor(root)));
    assert.equal(r.envelope.result?.["recovery_command"], recoveryFor(root));
  });

  it("TestCanonicalWriteFailureUsesExitFiveWithoutMutationOrRecovery", async () => {
    const hooks: Partial<EntityHooks> = {
      writeCanonical: () => {
        throw new GoError("injected canonical temporary-file creation failure");
      },
    };
    const root = writeCliRoot();
    const personas = join(root, ".os", "data", "personas.jsonl");
    const before = readFileSync(personas, "utf8");
    const r = await entities(["consolidate", "--root", root, "--mode", "compat", "--manifest", writeCliManifest(), "--apply", "--json"], { hooks });
    assert.equal(r.code, 5, r.stdout);
    assert.ok(!r.envelope.ok && r.envelope.write_status === "not_requested", r.stdout);
    assert.equal(r.envelope.result?.["recovery_command"], undefined);
    assert.ok(r.envelope.diagnostics.every((d) => d.correction !== recoveryFor(root)));
    assert.equal(r.envelope.diagnostics[0]?.message, "injected canonical temporary-file creation failure");
    assert.equal(readFileSync(personas, "utf8"), before);
  });

  it("an EIO when the canonical folder is opened for sync after the rename: the dataset is replaced, exit 5, applied false, no recovery (Go seed behavior)", async () => {
    // Go writeCanonicalAtomic returns "open canonical directory for sync: ..." after
    // replaceCanonicalFile has committed, and consolidateCommand reports it as a
    // canonical write failure (exit 5), not the exit-6 index path.
    const hooks: Partial<EntityHooks> = {
      writeCanonical: (fs, path, data, mode) => {
        const failing: FsPort = {
          ...fs,
          root: fs.root,
          writeFileAtomic: (target, bytes, options) => {
            fs.writeFileAtomic(target, bytes, { ...options, syncParent: false });
            throw new FsWriteFailure("injected", { code: "write_failed", fs: { errno: "EIO", syscall: "open", step: "open-parent" } });
          },
        };
        writeCanonicalAtomic(failing, path, data, mode);
      },
    };
    const root = writeCliRoot();
    const personas = join(root, ".os", "data", "personas.jsonl");
    const before = readFileSync(personas, "utf8");
    const r = await entities(["consolidate", "--root", root, "--mode", "compat", "--manifest", writeCliManifest(), "--apply", "--json"], { hooks });
    assert.equal(r.code, 5, r.stdout);
    assert.ok(!r.envelope.ok && r.envelope.write_status === "not_requested", r.stdout);
    assert.equal((r.envelope.result?.["consolidation"] as { applied: boolean }).applied, false, r.stdout);
    assert.equal(r.envelope.result?.["recovery_command"], undefined);
    assert.ok(r.envelope.diagnostics.every((d) => d.correction !== recoveryFor(root)));
    // The injected EIO is a POSIX errno. On Windows the port never opens the
    // folder for sync (P3 t14, PE-005), so this step cannot fail there, and
    // Windows never reports Go's invented syscall.EIO: libuv's EIO comes from
    // several Win32 errors, each with its own text. So Windows checks the Go
    // operation prefix; POSIX checks Go's full text. The exit code, write
    // status, and committed dataset are checked on every OS.
    const prefix = `open canonical directory for sync: open ${join(root, ".os", "data")}: `;
    if (process.platform === "win32") assert.ok(r.envelope.diagnostics.at(-1)?.message.startsWith(prefix), r.stdout);
    else assert.equal(r.envelope.diagnostics.at(-1)?.message, `${prefix}input/output error`);
    assert.notEqual(readFileSync(personas, "utf8"), before, "the rename committed: the dataset is replaced");
    assert.deepEqual(tempFiles(join(root, ".os", "data")), []);
  });

  it("TestRealDomainInputExitCode", async () => {
    const root = writeCliRoot();
    writeFileSync(join(root, ".os", "data", "personas.jsonl"), "not-json\n");
    const r = await entities(["validate", "--root", root, "--mode", "compat", "--json"]);
    assert.equal(r.code, 3, r.stdout);
  });

  it("TestRebuildIndexWriteStatusDistinguishesPlanAndCheck and rejects --check with --apply", async () => {
    const root = writeCliRoot();
    assert.equal((await entities(["rebuild-index", "--root", root, "--mode", "compat", "--json"])).envelope.write_status, "planned");
    assert.equal((await entities(["rebuild-index", "--root", root, "--mode", "compat", "--check", "--json"])).envelope.write_status, "not_requested");
    const both = await entities(["rebuild-index", "--root", root, "--mode", "compat", "--check", "--apply", "--json"]);
    assert.equal(both.code, 2);
    assert.equal(both.envelope.diagnostics[0]?.message, "--check and --apply are mutually exclusive");
  });

  it("writes human output with the diagnostics before the result, on stdout for success and stderr for failure", async () => {
    const root = writeCliRoot();
    const ok = await entities(["validate", "--root", root, "--mode", "compat"]);
    assert.equal(ok.code, 0);
    assert.equal(ok.stderr, "");
    // PE-023 (F-P8-11 review round 1): on Windows the action line names its shell first; POSIX quotes the root in single quotes.
    const action = process.platform === "win32" ? 'run this in Command Prompt: buildos entities rebuild-index --root ".*"' : "buildos entities rebuild-index --root '.*'";
    assert.match(ok.stdout, new RegExp(`^entities\\.validate: ok\\nroot: .*\\nmode: compat\\nversion: dev\\nsource revision: unknown\\nwrite status: not_requested\\nWARNING \\[index_stale\\]: entity-resolution index is missing\\n {2}action: ${action} --mode compat --apply\\n\\{\\n {2}"valid": true,`));
    const failed = await entities(["validate", "--root", root, "--mode", "strict"]);
    assert.equal(failed.code, 4);
    assert.equal(failed.stdout, "");
    assert.match(failed.stderr, /^entities\.validate: error\n[\s\S]*ERROR \[index_stale\][\s\S]*"valid": false/);
  });

  it("escapes HTML in the human result, as Go's json.MarshalIndent does, and not in the JSON envelope", async () => {
    // NTFS refuses `<` and `>` in a file name, so on Windows the folder name
    // carries only `&`; POSIX keeps all three characters Go escapes.
    const windows = process.platform === "win32";
    const root = join(scratch, `${windows ? "a&b" : "a&b<c>"}-${++counter}`);
    mkdirSync(join(root, ".os", "data"), { recursive: true });
    for (const name of DATASETS) writeFileSync(join(root, ".os", "data", name), "");
    const human = await entities(["validate", "--root", root, "--mode", "compat"]);
    assert.match(human.stdout, windows ? /"remediation_command": "buildos entities rebuild-index --root \\".*a\\u0026b-\d+\\"/ : /"remediation_command": "buildos entities rebuild-index --root '.*a\\u0026b\\u003cc\\u003e-\d+'/);
    const json = await entities(["validate", "--root", root, "--mode", "compat", "--json"]);
    assert.match(json.stdout, windows ? /"remediation_command": "buildos entities rebuild-index --root \\".*a&b-\d+\\"/ : /"remediation_command": "buildos entities rebuild-index --root '.*a&b<c>-\d+'/);
  });
});

/**
 * P3 t14. Go 1.24.1 fails its post-rename folder sync on Windows ("Access is
 * denied.") after the rename has committed (PE-005). The TypeScript atomic
 * write must not: a successful apply exits 0, reports `applied`, and leaves
 * no temporary file, and the index matches the canonical data.
 */

async function applyRebuildAndConsolidate(pilot: string): Promise<void> {
  const root = join(pilot, "root");
  const indexes = join(root, ".os", "indexes");
  const data = join(root, ".os", "data");
  // rebuild-index --apply over a missing index (entities-rebuild-apply-missing-json).
  rmSync(join(indexes, "entity-resolution.json"));
  let r = await entities(["rebuild-index", "--root", "root", "--mode", "compat", "--apply", "--json"], { cwd: pilot });
  assert.equal(r.code, 0, r.stdout);
  assert.ok(r.envelope.ok && r.envelope.write_status === "applied", r.stdout);
  assert.equal((r.envelope.result?.["after"] as { state: string }).state, "current");
  assert.deepEqual(tempFiles(indexes), []);
  // consolidate --apply replaces an existing canonical file and the existing index (entities-consolidate-apply-json).
  const indexBefore = readFileSync(join(indexes, "entity-resolution.json"));
  r = await entities(["consolidate", "--root", "root", "--mode", "strict", "--manifest", "manifests/approved-persona-consolidations-v1.json", "--apply", "--json"], { cwd: pilot });
  assert.equal(r.code, 0, r.stdout);
  assert.ok(r.envelope.ok && r.envelope.write_status === "applied", r.stdout);
  assert.equal((r.envelope.result?.["index"] as { state: string }).state, "current");
  assert.ok((r.envelope.result?.["consolidation"] as { applied: boolean }).applied);
  assert.deepEqual(tempFiles(data), []);
  assert.deepEqual(tempFiles(indexes), []);
  assert.notDeepEqual(readFileSync(join(indexes, "entity-resolution.json")), indexBefore, "the index was not replaced");
  // No half-applied state: the index on disk is the rebuild of the canonical data.
  r = await entities(["rebuild-index", "--root", "root", "--mode", "strict", "--check", "--json"], { cwd: pilot });
  assert.equal(r.code, 0, r.stdout);
  assert.equal((r.envelope.result?.["before"] as { state: string }).state, "current");
  r = await entities(["validate", "--root", "root", "--mode", "strict", "--json"], { cwd: pilot });
  assert.equal(r.code, 0, r.stdout);
}

describe("atomic apply leaves no half-applied state (P3 t14)", () => {
  it("rebuild-index --apply and consolidate --apply exit 0 and report applied", async () => {
    await applyRebuildAndConsolidate(copyPilot());
  });

  it("on Windows, replaces existing files and skips the folder sync that Go 1.24.1 fails (PE-005)", { skip: process.platform === "win32" ? false : "Windows only" }, async () => {
    const pilot = copyPilot();
    await applyRebuildAndConsolidate(pilot);
    // Replace the existing index once more: same meaning, not canonical bytes, so rebuild-index --apply rewrites it.
    const index = join(pilot, "root", ".os", "indexes", "entity-resolution.json");
    const canonical = readFileSync(index, "utf8");
    writeFileSync(index, JSON.stringify(JSON.parse(canonical)));
    const r = await entities(["rebuild-index", "--root", "root", "--mode", "strict", "--apply", "--json"], { cwd: pilot });
    assert.equal(r.code, 0, r.stdout);
    assert.equal(r.envelope.write_status, "applied");
    assert.equal((r.envelope.result?.["before"] as { state: string }).state, "non_reproducible");
    assert.equal(readFileSync(index, "utf8"), canonical);
    assert.deepEqual(tempFiles(join(pilot, "root", ".os", "indexes")), []);
  });
});
