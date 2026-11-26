// Captures how the Go seed spells a relative `--root` from the current
// folder's `$PWD` (W1 R7 P3 t12). Go's `filepath.Abs` joins `os.Getwd`, which
// returns `$PWD` when it names the current folder, also through a symlink.
//
// The Go sources are gone since W1 R7 P8. Build the Go tool from a worktree
// of the frozen baseline commit 263f5ca (test/golden/CAPTURE.md, Frozen Go
// Baseline); the paths below are inside that worktree.
// Build the seed first, from `toolkits/buildos/`:
//   go build -o <scratch>/buildos-go ./cmd/buildos
// Then (POSIX only):
//   node scripts/capture-pwd-goldens.ts <scratch>/buildos-go
//
// Writes test/fixtures/go-seed/pwd-goldens.json. Paths are stored with
// `{LINK}` for the symlinked spelling of the work folder, `{REAL}` for its
// real path, and `{BASE}` for the scratch folder that holds both.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface PwdCase {
  name: string;
  /** `$PWD` for the run: `link` (the symlinked folder), `other` (another real folder), `relative`, or `unset`. */
  pwd: "link" | "other" | "relative" | "unset";
  args: string[];
}

export const PWD_CASES: readonly PwdCase[] = [
  { name: "pwd-through-symlink", pwd: "link", args: ["entities", "validate", "--root", "root", "--mode", "compat", "--json"] },
  { name: "pwd-through-symlink-dotdot", pwd: "link", args: ["entities", "rebuild-index", "--root", "../work/root", "--mode", "compat", "--json"] },
  { name: "pwd-names-another-folder", pwd: "other", args: ["entities", "validate", "--root", "root", "--mode", "compat", "--json"] },
  { name: "pwd-relative", pwd: "relative", args: ["entities", "validate", "--root", "root", "--mode", "compat", "--json"] },
  { name: "pwd-unset", pwd: "unset", args: ["entities", "validate", "--root", "root", "--mode", "compat", "--json"] },
];

const DATASETS = ["requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "findings.jsonl", "extractions.jsonl"];

/**
 * A scratch layout: `<base>/work/root/.os/data/` (empty datasets), `<base>/link`
 * a symlink to `work`, and `<base>/other`. Returns the folders; `scratch` is
 * the folder to remove afterwards.
 *
 * `<base>` is itself a symlink (`<scratch>/base` to `<scratch>/real-base`), so
 * the real path of `work` never equals `<base>/work` as text. Without it, the
 * `{REAL}` and `{BASE}/work` spellings collapse into one on Linux, where the
 * temporary folder has no symlink in it (macOS has `/var` to `/private/var`),
 * and a golden captured on one OS cannot match the other (P3 CI fix round).
 */
export function makePwdLayout(): { scratch: string; base: string; link: string; real: string; other: string } {
  const scratch = mkdtempSync(join(tmpdir(), "buildos-pwd-"));
  mkdirSync(join(scratch, "real-base"));
  symlinkSync("real-base", join(scratch, "base"));
  const base = join(scratch, "base");
  mkdirSync(join(base, "work", "root", ".os", "data"), { recursive: true });
  for (const name of DATASETS) writeFileSync(join(base, "work", "root", ".os", "data", name), "");
  mkdirSync(join(base, "other"));
  symlinkSync("work", join(base, "link"));
  return { scratch, base, link: join(base, "link"), real: realpathSync(join(base, "work")), other: join(base, "other") };
}

/** Runs `program` for `c` in the layout, from the symlinked folder; output with `{LINK}` and `{REAL}` for the scratch paths. */
export function runPwdCase(program: string[], c: PwdCase, layout: ReturnType<typeof makePwdLayout>): { exit: number; stdout: string; stderr: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, TZ: "UTC" };
  if (c.pwd === "link") env["PWD"] = layout.link;
  else if (c.pwd === "other") env["PWD"] = layout.other;
  else if (c.pwd === "relative") env["PWD"] = "link";
  else delete env["PWD"];
  const result = spawnSync(program[0]!, [...program.slice(1), ...c.args], { cwd: layout.link, env, encoding: "utf8" });
  if (result.error !== undefined) throw result.error;
  const norm = (text: string) => text.replaceAll(layout.real, "{REAL}").replaceAll(layout.link, "{LINK}").replaceAll(layout.base, "{BASE}");
  return { exit: result.status ?? -1, stdout: norm(result.stdout), stderr: norm(result.stderr) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const binary = process.argv[2];
  if (binary === undefined) {
    process.stderr.write("usage: node scripts/capture-pwd-goldens.ts <go seed binary>\n");
    process.exit(2);
  }
  const layout = makePwdLayout();
  try {
    const cases = PWD_CASES.map((c) => ({ ...c, ...runPwdCase([resolve(binary)], c, layout) }));
    const out = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "go-seed", "pwd-goldens.json");
    writeFileSync(out, `${JSON.stringify({ source: "scripts/capture-pwd-goldens.ts with the Go seed built from toolkits/buildos/cmd/buildos", goVersion: process.env["GO_VERSION"] ?? "", cases }, null, 2)}\n`);
    process.stdout.write(`wrote ${out}\n`);
  } finally {
    rmSync(layout.scratch, { recursive: true, force: true });
  }
}
