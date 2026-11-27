// W1 R7 P9 t8: hostile input and the safe behavior that differs from the
// skill scripts (test/golden/skills/divergences.json SD-04 to SD-14), and
// A78: the `--json` output of the three commands has every envelope field.
// Every input is invented (the library book-lending topic).

import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { run } from "../src/cli/run.ts";
import type { CliIo } from "../src/cli/io.ts";
import { StdinTooLargeError } from "../src/cli/io.ts";
import { ENVELOPE_FIELDS } from "../src/core/shared/envelope.ts";
import { FIXTURES } from "./golden/skills/scenario.ts";
import { FIXED_NOW } from "./golden/skills/buildos-runner.ts";
import { assertIncludes, assertSame, assertSameList } from "./helpers.ts";

const temps: string[] = [];
after(() => {
  for (const dir of temps) {
    try {
      chmodSync(dir, 0o755);
    } catch {
      // gone
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function project(script: "bulk-extract" | "fitgap" | "azure-boards", base: string): string {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "buildos-skill-hostile-")));
  temps.push(parent);
  const dir = join(parent, "project");
  cpSync(join(FIXTURES, script, "bases", base), dir, { recursive: true });
  return dir;
}

interface Result {
  exit: number;
  stdout: string;
  stderr: string;
}

async function buildos(args: string[], cwd: string, stdin?: string | (() => Uint8Array)): Promise<Result> {
  let stdout = "";
  let stderr = "";
  const io: CliIo = {
    cwd,
    writeStdout: (t) => {
      stdout += t;
    },
    writeStderr: (t) => {
      stderr += t;
    },
    readStdin: (limit) => {
      if (typeof stdin === "function") return stdin();
      const data = new TextEncoder().encode(stdin ?? "");
      if (data.length > limit) throw new StdinTooLargeError(limit);
      return data;
    },
  };
  const exit = await run(args, io, { buildInfo: { version: "dev", sourceRevision: "unknown" }, now: () => FIXED_NOW });
  return { exit, stdout, stderr };
}

const canLink = (() => {
  const dir = mkdtempSync(join(tmpdir(), "buildos-link-probe-"));
  temps.push(dir);
  try {
    symlinkSync(dir, join(dir, "probe"), "dir");
    return true;
  } catch {
    return false;
  }
})();
const posixPermissions = process.platform !== "win32" && process.getuid?.() !== 0;

describe("skill-script commands: reads outside the root (SD-04)", () => {
  it("export azure-boards refuses an --input outside the project folder", async () => {
    const dir = project("azure-boards", "project");
    writeFileSync(join(dir, "..", "outside.json"), "{}");
    const r = await buildos(["export", "azure-boards", "--root", dir, "emit", "--input", "../outside.json", "--output", "out.csv"], dir);
    assert.equal(r.exit, 3);
    assertIncludes(r.stderr, "is outside the project folder");
    assert.equal(existsSync(join(dir, "out.csv")), false);
  });

  it("fitgap refuses a model that a frame names outside the project folder", async () => {
    const dir = project("fitgap", "library");
    const frame = JSON.parse(readFileSync(join(dir, "analysis", "frame.json"), "utf8")) as Record<string, unknown>;
    frame["baseline"] = { model: "../../outside-model.json" };
    writeFileSync(join(dir, "analysis", "frame-outside.json"), JSON.stringify(frame));
    writeFileSync(join(dir, "..", "outside-model.json"), "{}");
    const r = await buildos(["fitgap", "--root", dir, "frame", "--frame", "analysis/frame-outside.json"], dir);
    assert.equal(r.exit, 3);
    assertIncludes(r.stderr, "is outside the project folder");
  });

  it("fitgap refuses a frame reached through a link that leads out of the project", { skip: canLink ? false : "no symlinks here" }, async () => {
    const dir = project("fitgap", "library");
    mkdirSync(join(dir, "..", "elsewhere"));
    writeFileSync(join(dir, "..", "elsewhere", "frame.json"), readFileSync(join(dir, "analysis", "frame.json")));
    symlinkSync(join(dir, "..", "elsewhere"), join(dir, "linked"), "dir");
    const r = await buildos(["fitgap", "--root", dir, "frame", "--frame", "linked/frame.json"], dir);
    assert.equal(r.exit, 3);
    assertIncludes(r.stderr, "out of the project folder");
  });

  it("extract bulk refuses a source path that leads out through a link", { skip: canLink ? false : "no symlinks here" }, async () => {
    const dir = project("bulk-extract", "library");
    mkdirSync(join(dir, "..", "elsewhere"));
    symlinkSync(join(dir, "..", "elsewhere"), join(dir, "assets", "linked"), "dir");
    const index = JSON.parse(readFileSync(join(dir, ".os", "indexes", "references.json"), "utf8")) as { references: Record<string, unknown>[] };
    index.references[0]!["source"] = "assets/linked/policy.txt";
    writeFileSync(join(dir, ".os", "indexes", "references.json"), JSON.stringify(index));
    const r = await buildos(["extract", "bulk", "--root", dir, "status"], dir);
    assert.equal(r.exit, 3);
    assertSame(r.stderr, "Error: Path leaves repo: assets/linked/policy.txt\n");
  });
});

describe("skill-script commands: writes outside the root (SD-05)", () => {
  it("export azure-boards refuses --output outside the project folder, and writes there with --allow-outside-root", async () => {
    const dir = project("azure-boards", "project");
    const refused = await buildos(["export", "azure-boards", "--root", dir, "template", "--output", "../template.csv"], dir);
    assert.equal(refused.exit, 3);
    assertIncludes(refused.stderr, "Pass --allow-outside-root");
    assert.equal(existsSync(join(dir, "..", "template.csv")), false);
    const allowed = await buildos(["export", "azure-boards", "--root", dir, "--allow-outside-root", "template", "--output", "../template.csv"], dir);
    assert.equal(allowed.exit, 0);
    assert.equal(readFileSync(join(dir, "..", "template.csv"), "utf8").startsWith("\ufeffID,Work Item Type"), true);
  });

  it("fitgap refuses a merge --out folder outside the project folder before any write", async () => {
    const dir = project("fitgap", "library");
    const r = await buildos(["fitgap", "--root", dir, "merge", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json", "--out", "../merged", "--draft"], dir);
    assert.equal(r.exit, 3);
    assert.equal(existsSync(join(dir, "..", "merged")), false);
  });

  it("fitgap refuses an output folder that is a link out of the project", { skip: canLink ? false : "no symlinks here" }, async () => {
    const dir = project("fitgap", "library");
    mkdirSync(join(dir, "..", "elsewhere"));
    symlinkSync(join(dir, "..", "elsewhere"), join(dir, "out"), "dir");
    const r = await buildos(["fitgap", "--root", dir, "uncited", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json", "--out", "out/uncited.json"], dir);
    assert.equal(r.exit, 3);
    assertIncludes(r.stderr, "leads out of the project folder");
    assert.equal(existsSync(join(dir, "..", "elsewhere", "uncited.json")), false);
  });
});

describe("skill-script commands: a failed write leaves no files (SD-05)", () => {
  it("fitgap packages changes nothing when a later destination is a folder", async () => {
    const dir = project("fitgap", "library");
    mkdirSync(join(dir, "work", "packages"), { recursive: true });
    writeFileSync(join(dir, "work", "packages", "pkg-09.json"), "[]");
    mkdirSync(join(dir, "work", "target-index.json"));
    const r = await buildos(["fitgap", "--root", dir, "packages", "--frame", "analysis/frame.json", "--out", "work"], dir);
    assert.equal(r.exit, 5);
    // W1 R7 P9 review round 1 (P9-R1-04): a folder at a destination is refused before the first change.
    assertIncludes(r.stderr, "it is a folder, not a file). BuildOS wrote nothing.");
    assertSame(readFileSync(join(dir, "work", "packages", "pkg-09.json"), "utf8"), "[]", "pkg-09.json");
    assert.equal(existsSync(join(dir, "work", "packages", "pkg-01.json")), false);
    assert.equal(existsSync(join(dir, "work", "objectives.md")), false);
  });

  it("export azure-boards writes nothing when the output folder cannot be written", { skip: posixPermissions ? false : "POSIX permissions only" }, async () => {
    const dir = project("azure-boards", "project");
    mkdirSync(join(dir, "locked"));
    chmodSync(join(dir, "locked"), 0o555);
    const r = await buildos(["export", "azure-boards", "--root", dir, "emit", "--input", "backlog/holds.json", "--output", "locked/holds.csv"], dir);
    chmodSync(join(dir, "locked"), 0o755);
    assert.equal(r.exit, 5);
    assertSame(r.stdout, "");
    assert.equal(existsSync(join(dir, "locked", "holds.csv")), false);
  });

  it("extract bulk removes the folders it made when the command fails", async () => {
    const dir = project("bulk-extract", "library");
    const started = await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir);
    assert.equal(started.exit, 0);
    const r = await buildos(["extract", "bulk", "--root", dir, "stage", "REF-001"], dir);
    assert.equal(r.exit, 4);
    assertSame(r.stderr, "Error: Finish the named, dated source review before staging\n");
    assert.equal(existsSync(join(dir, "extractions", "staging")), false);
  });
});

describe("skill-script commands: size limits (SD-06)", () => {
  it("export azure-boards does not read a manifest larger than 128 MiB", async () => {
    const dir = project("azure-boards", "project");
    writeFileSync(join(dir, "big.json"), "");
    truncateSync(join(dir, "big.json"), 128 * 1024 * 1024 + 1);
    const r = await buildos(["export", "azure-boards", "--root", dir, "emit", "--input", "big.json", "--output", "out.csv"], dir);
    assert.equal(r.exit, 3);
    assertIncludes(r.stderr, "is larger than 128 MiB");
  });

  it("fitgap stops at JSON nested 600 levels deep, without a crash", async () => {
    const dir = project("fitgap", "library");
    writeFileSync(join(dir, "analysis", "deep.json"), `${"[".repeat(600)}${"]".repeat(600)}`);
    const r = await buildos(["fitgap", "--root", dir, "frame", "--frame", "analysis/deep.json"], dir);
    assert.equal(r.exit, 3);
    assertIncludes(r.stderr, "nests more than 512 levels");
  });

  it("extract bulk refuses standard input larger than 128 MiB", async () => {
    const dir = project("bulk-extract", "library");
    const r = await buildos(["extract", "bulk", "--root", dir, "decide", "REF-001", "--reviewer", "Branch Supervisor"], dir, () => {
      throw new StdinTooLargeError(128 * 1024 * 1024);
    });
    // P9-R1-16: oversized standard input is an input that cannot be read (exit 3), as an oversized file is.
    assert.equal(r.exit, 3);
    assertIncludes(r.stderr, "Error: standard input is larger than 128 MiB, so BuildOS did not read it");
  });
});

describe("skill-script commands: lock, malformed values, and prototype names (SD-09, SD-11, SD-14)", () => {
  it("extract bulk stops at once when another command holds the staging lock, and says how to clear it", async () => {
    const dir = project("bulk-extract", "library");
    mkdirSync(join(dir, "extractions", "staging"), { recursive: true });
    writeFileSync(join(dir, "extractions", "staging", ".buildos-extract-bulk-stage.lock"), "");
    await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir);
    const r = await buildos(["extract", "bulk", "--root", dir, "stage-update", "REF-001", "REQ-001", "--key", "x"], dir);
    assert.equal(r.exit, 4);
    assertIncludes(r.stderr, "Another staged write is active; retry after it ends. The lock file extractions/staging/.buildos-extract-bulk-stage.lock is in place. A command that crashed leaves it behind, also when only one person works in the project.");
  });

  it("fitgap reports two marks with no requirement ID as problems (the script crashed)", async () => {
    const dir = project("fitgap", "library");
    const rows = JSON.parse(readFileSync(join(dir, "analysis", "scored", "pkg-01.json"), "utf8")) as { marks: Record<string, unknown>[] }[];
    rows[0]!.marks = [{ mark: "met", target_capability_ids: ["LIB-COR-01"] }, { mark: "met", target_capability_ids: ["LIB-COR-01"] }];
    writeFileSync(join(dir, "analysis", "scored", "pkg-01.json"), JSON.stringify(rows));
    const r = await buildos(["fitgap", "--root", dir, "merge", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json", "--out", "deliver", "--draft"], dir);
    assert.equal(r.exit, 4);
    assertIncludes(r.stdout, "requirements marked twice: None");
  });

  it("fitgap names the Python error kind for a value of the wrong type", async () => {
    const dir = project("fitgap", "library");
    writeFileSync(join(dir, "analysis", "frame-list.json"), "[1, 2]");
    const r = await buildos(["fitgap", "--root", dir, "frame", "--frame", "analysis/frame-list.json"], dir);
    assert.equal(r.exit, 3);
    assertIncludes(r.stderr, "fitgap: an input file is missing a field or has a value of the wrong type (TypeError");
  });

  it("fitgap workbook writes no file when its own check fails (SD-12; the script kept the workbook)", async () => {
    const dir = project("fitgap", "library");
    const merged = await buildos(["fitgap", "--root", dir, "merge", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json", "--only", "analysis/only.json", "--findings", "analysis/findings.json", "--todos", "analysis/todos.json", "--out", "out"], dir);
    assert.equal(merged.exit, 0);
    const path = join(dir, "out", "circ-lib-fit-gap-analysis.json");
    writeFileSync(path, readFileSync(path, "utf8").replace('"track": "T2"', '"track": ""'));
    const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", "analysis/frame.json", "--fitgap", "out/circ-lib-fit-gap-analysis.json"], dir);
    assert.equal(r.exit, 4);
    assertIncludes(r.stdout, "  FAIL  every capability has a track\n");
    assert.equal(existsSync(join(dir, "out", "circ-lib-fit-gap-analysis.xlsx")), false);
  });

  it("export azure-boards treats a prototype name as an unknown profile", async () => {
    const dir = project("azure-boards", "project");
    const r = await buildos(["export", "azure-boards", "--root", dir, "validate", "--input", "csv/good.csv", "--profile", "constructor"], dir);
    assert.equal(r.exit, 2);
    assertSame(r.stderr, "Unknown profile 'constructor'. Use target17-new, new, or update.\n");
  });
});

describe("skill-script commands: --json has every envelope field (A78)", () => {
  const check = (r: Result, command: string, ok: boolean, writeStatus: string): Record<string, unknown> => {
    const envelope = JSON.parse(r.stdout) as Record<string, unknown>;
    assertSameList(Object.keys(envelope), [...ENVELOPE_FIELDS], `${command} envelope fields`);
    assertSame(envelope["ok"], ok, "ok");
    assertSame(envelope["command"], command, "command");
    assertSame(envelope["write_status"], writeStatus, "write_status");
    assertSame(typeof envelope["root"], "string", "root type");
    assert.equal(Array.isArray(envelope["diagnostics"]), true);
    assertSame((envelope["diagnostics"] as unknown[]).length === 0, ok, "diagnostics");
    assertSame(r.stderr, "");
    return envelope;
  };

  it("extract bulk: status, start, check (not ready), and an error", async () => {
    const dir = project("bulk-extract", "library");
    check(await buildos(["extract", "bulk", "--root", dir, "--json", "status"], dir), "extract.bulk.status", true, "not_requested");
    const started = check(await buildos(["extract", "bulk", "--json", "--root", dir, "start", "REF-001"], dir), "extract.bulk.start", true, "applied");
    assertSame(started["result"], { created: true, review: "extractions/REF-001-lending-policy.json" }, "start result");
    const r = await buildos(["extract", "bulk", "--root", dir, "check", "REF-001", "--json"], dir);
    assert.equal(r.exit, 4);
    check(r, "extract.bulk.check", false, "not_requested");
    const missing = await buildos(["extract", "bulk", "--root", dir, "--json", "show", "REF-404"], dir);
    assert.equal(missing.exit, 4);
    const envelope = check(missing, "extract.bulk.show", false, "not_requested");
    assertSame((envelope["diagnostics"] as { message: string }[])[0]!.message, "Error: Unknown reference ID: REF-404", "diagnostic message");
  });

  it("fitgap: frame, merge, and a failed check", async () => {
    const dir = project("fitgap", "library");
    check(await buildos(["fitgap", "--root", dir, "--json", "frame", "--frame", "analysis/frame.json"], dir), "fitgap.frame", true, "not_requested");
    const merged = check(await buildos(["fitgap", "--root", dir, "--json", "merge", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json", "--out", "deliver", "--draft"], dir), "fitgap.merge", true, "applied");
    assertSame((merged["result"] as { written: string[] }).written, ["deliver/circ-lib-fit-gap-analysis.json"], "written");
    const bad = await buildos(["fitgap", "--root", dir, "--json", "frame", "--frame", "analysis/frame-bad.json"], dir);
    assert.equal(bad.exit, 4);
    check(bad, "fitgap.frame", false, "not_requested");
  });

  it("export azure-boards: emit, an invalid CSV, and a usage error", async () => {
    const dir = project("azure-boards", "project");
    const emitted = check(await buildos(["export", "azure-boards", "--root", dir, "--json", "emit", "--input", "backlog/holds.json", "--output", "out/holds.csv"], dir), "export.azure-boards", true, "applied");
    assertSame((emitted["result"] as { operation: string }).operation, "emit", "operation");
    const invalid = await buildos(["export", "azure-boards", "--root", dir, "--json", "validate", "--input", "csv/no-bom.csv"], dir);
    assert.equal(invalid.exit, 4);
    const envelope = check(invalid, "export.azure-boards", false, "not_requested");
    assertSame((envelope["diagnostics"] as { code: string }[])[0]!.code, "validation_failed", "diagnostic code");
    const usage = await buildos(["export", "azure-boards", "--root", dir, "--json", "emit"], dir);
    assert.equal(usage.exit, 2);
    check(usage, "export.azure-boards", false, "not_requested");
  });
});

describe("skill-script commands: help and the root help (t7)", () => {
  it("root help lists extract, fitgap, and export; each has domain help", async () => {
    const root = await buildos(["help"], process.cwd());
    for (const name of ["extract", "fitgap", "export"]) assertIncludes(root.stdout, `\n  ${name} `);
    for (const [args, text] of [
      [["extract", "--help"], "buildos extract bulk"],
      [["extract", "bulk", "--help"], "Subcommands:"],
      [["fitgap", "--help"], "buildos fitgap workbook"],
      [["export", "--help"], "buildos export azure-boards"],
      [["export", "azure-boards", "--help"], "Registered adapters: dynamics-365-ce"],
      [["help", "fitgap"], "buildos fitgap frame"],
    ] as [string[], string][]) {
      const r = await buildos(args, process.cwd());
      assert.equal(r.exit, 0);
      assertIncludes(r.stdout, text);
    }
  });

  it("an unknown operation or target is a usage error", async () => {
    for (const args of [["extract"], ["extract", "rows"], ["export"], ["export", "jira"], ["fitgap"], ["fitgap", "score"]]) {
      const r = await buildos(args, process.cwd());
      assert.equal(r.exit, 2, args.join(" "));
    }
  });
});
