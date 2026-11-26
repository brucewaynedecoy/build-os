// W1 R7 P6 A50 (self-check): the Make Docs contract check passes on a stub
// that keeps the contract and fails on a stub with a renamed setup flag or a
// changed JSON field. The CI job `make-docs-contract` runs the same check
// against the real Make Docs at both bounds of the pinned range.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { checkMakeDocsContract } from "../scripts/make-docs-contract.ts";

let scratch: string;
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-md-contract-"));
});
after(() => rmSync(scratch, { recursive: true, force: true }));

const FLAGS = ["--target", "--codex-method", "--claude-code-method", "--no-github-copilot", "--no-skills", "--project-resources", "--yes", "--json"];

/** A Make Docs stub: `rename` swaps one setup flag for another name; `status` is the setup JSON status. */
function stub(name: string, options: { rename?: [string, string]; status?: string; stateField?: string } = {}): string[] {
  const flags = FLAGS.map((f) => (options.rename !== undefined && f === options.rename[0] ? options.rename[1] : f));
  const file = join(scratch, `${name}.cjs`);
  writeFileSync(
    file,
    `const args = process.argv.slice(2);
const flags = ${JSON.stringify(flags)};
if (args[0] === "--version") { process.stdout.write("2.0.9\\n"); process.exit(0); }
if (args[0] === "setup" && args[1] === "--help") { process.stdout.write("Options:\\n" + flags.map((f) => "  " + f + "  text").join("\\n") + "\\n"); process.exit(0); }
if (args[0] === "setup") {
  for (const a of args.slice(1)) if (a.startsWith("--") && !flags.includes(a)) { process.stderr.write("unknown option " + a + "\\n"); process.exit(2); }
  process.stdout.write(JSON.stringify({ status: ${JSON.stringify(options.status ?? "complete")} })); process.exit(0);
}
if (args[0] === "project") { process.stdout.write(JSON.stringify({ ${JSON.stringify(options.stateField ?? "status")}: "ready" })); process.exit(0); }
process.exit(2);
`,
  );
  return [process.execPath, file];
}

describe("Make Docs contract check", () => {
  it("passes on a stub that keeps the contract", () => {
    assert.deepEqual(checkMakeDocsContract(stub("good"), { expectVersion: "2.0.9" }), { version: "2.0.9", problems: [] });
  });

  it("fails on a stub with a renamed setup flag", () => {
    const report = checkMakeDocsContract(stub("renamed", { rename: ["--no-skills", "--skip-skills"] }));
    assert.ok(report.problems.includes("make-docs setup --help does not name --no-skills"), report.problems.join("; "));
    assert.ok(report.problems.some((p) => p.startsWith("make-docs setup: exit 2: unknown option --no-skills")), report.problems.join("; "));
  });

  it("fails when the setup JSON status or the state status field changes", () => {
    assert.ok(checkMakeDocsContract(stub("status", { status: "done" })).problems.includes('make-docs setup --json: status is "done", not "complete"'));
    assert.ok(checkMakeDocsContract(stub("state", { stateField: "state" })).problems.includes("make-docs project state status --json: no string status field"));
  });

  it("fails on an unexpected version", () => {
    assert.deepEqual(checkMakeDocsContract(stub("version"), { expectVersion: "2.0.10" }).problems, ["make-docs --version: expected 2.0.10, got 2.0.9"]);
  });
});
