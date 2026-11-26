// W1 R7 P7 review round 2 (P7-R2-02): every content read in core has a size
// bound (READ_LIMITS). One read site per domain gets a sparse file one byte
// over its bound; the command fails cleanly with the bound in plain words,
// and no byte of the file is read (a sparse file costs no disk or memory).

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { run } from "../src/cli/run.ts";
import { READ_LIMITS } from "../src/core/shared/read-limits.ts";
import { captureIo } from "./helpers.ts";

const scratch = mkdtempSync(join(tmpdir(), "buildos-read-bounds-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const GOLDEN = join(import.meta.dirname, "fixtures", "golden");
let counter = 0;

function copy(fixture: string): string {
  const root = join(scratch, `p${++counter}`);
  cpSync(join(GOLDEN, fixture), root, { recursive: true });
  return root;
}

/** Makes `path` a sparse file one byte over `limit`. */
function oversize(path: string, limit: number): void {
  writeFileSync(path, "");
  truncateSync(path, limit + 1);
}

async function buildos(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const code = await run(args, io);
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

describe("every read has a size bound (P7-R2-02)", () => {
  it("entities: a governed dataset over 128 MiB is a read diagnostic", async () => {
    const root = copy("design-installed");
    oversize(join(root, ".os", "data", "requirements.jsonl"), READ_LIMITS.data);
    const out = await buildos(["entities", "validate", "--root", root, "--mode", "compat"], root);
    assert.notEqual(out.code, 0);
    assert.match(out.stdout + out.stderr, /cannot read governed dataset requirements\.jsonl: read .+requirements\.jsonl: file too large: BuildOS reads at most 128 MiB from one such file/);
  });

  it("discovery: a playbook index over 128 MiB fails with exit 1", async () => {
    const root = copy("discovery-installed");
    oversize(join(root, ".os", "indexes", "playbooks.json"), READ_LIMITS.data);
    const out = await buildos(["discovery", "run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", "--dry-run"], root);
    assert.equal(out.code, 1);
    assert.match(out.stderr, /^buildos-discovery: error: read playbook index: read .+playbooks\.json: file too large: BuildOS reads at most 128 MiB from one such file\n$/);
  });

  it("design: a finding record over 64 MiB fails with exit 1", async () => {
    const root = copy("design-installed");
    oversize(join(root, "workspace", "findings", "FIND-001", "finding.md"), READ_LIMITS.document);
    const out = await buildos(["design", "promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "change-plan", "--dry-run"], root);
    assert.equal(out.code, 1);
    assert.match(out.stderr, /^buildos-design: error: read finding record: read .+finding\.md: file too large: BuildOS reads at most 64 MiB from one such file\n$/);
  });

  it("intake: a source over 512 MiB fails with exit 1 and writes nothing", async () => {
    const root = copy("intake-installed");
    oversize(join(root, "inputs", "huge.csv"), READ_LIMITS.intake);
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/huge.csv"], root);
    assert.equal(out.code, 1);
    assert.match(out.stderr, /^buildos-intake: error: .*huge\.csv: file too large: BuildOS reads at most 512 MiB from one such file\n$/);
  });
});
