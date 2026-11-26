// Captures the Go intake tool's twin bodies for every conversion eval file
// (W1 R7 P4 t12, parity exception PE-008). test/intake-eval-parity.test.ts
// compares the TypeScript bodies with them.
//
// The Go sources are gone since W1 R7 P8. Build the Go tool from a worktree
// of the frozen baseline commit 263f5ca (test/golden/CAPTURE.md, Frozen Go
// Baseline); the paths below are inside that worktree.
// Build the Go tool first, from `toolkits/buildos-intake/`:
//   go build -o <scratch>/buildos-intake ./cmd/buildos-intake
// Then, from `toolkits/buildos/`:
//   GO_VERSION=go1.24.1 node scripts/capture-intake-eval-goldens.ts <scratch>/buildos-intake
//
// Writes test/fixtures/go-seed/intake-eval-goldens.json: for each eval file,
// either Go's error text or each twin's file name and body (front matter
// removed; it holds a time stamp).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EVAL_ROOT, loadManifest } from "../test/conversion-eval/references.ts";

export interface EvalGolden {
  id: string;
  /** Go's stderr line without the `buildos-intake: error: ` prefix, for a failed conversion. */
  error?: string;
  parts?: { name: string; body: string }[];
}

export interface EvalGoldenFile {
  $comment: string;
  go_version: string;
  files: EvalGolden[];
}

export const EVAL_GOLDENS = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "go-seed", "intake-eval-goldens.json");

/** The twin body: everything after the front matter. */
export function stripFrontmatter(text: string): string {
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---\n", 4);
  return end === -1 ? text : text.slice(end + 5);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const program = process.argv[2];
  if (program === undefined) throw new Error("usage: node scripts/capture-intake-eval-goldens.ts <go buildos-intake>");
  const files: EvalGolden[] = [];
  for (const file of loadManifest().files) {
    const root = mkdtempSync(join(tmpdir(), "buildos-intake-eval-"));
    try {
      const run = spawnSync(program, ["convert", "--source", join(EVAL_ROOT, ...file.source.split("/")), "--repo-root", root, "--assets-root", "assets"], { encoding: "utf8" });
      if (run.status !== 0) {
        files.push({ id: file.id, error: run.stderr.trim().replace(/^buildos-intake: error: /, "") });
        continue;
      }
      const parts = run.stdout
        .split("\n")
        .filter((line) => line.startsWith("wrote ") && !line.startsWith("wrote side artifact "))
        .map((line) => line.slice("wrote ".length))
        .map((path) => ({ name: basename(path), body: stripFrontmatter(readFileSync(path, "utf8")) }));
      files.push({ id: file.id, parts });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  const out: EvalGoldenFile = {
    $comment: "Go intake tool twin bodies for the conversion eval set (front matter removed). Captured by scripts/capture-intake-eval-goldens.ts.",
    go_version: process.env["GO_VERSION"] ?? "unknown",
    files,
  };
  writeFileSync(EVAL_GOLDENS, `${JSON.stringify(out, null, 2)}\n`);
}
