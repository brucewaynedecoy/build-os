// Shared helpers of the skill-script review tests (W1 R7 P9 review rounds 1
// and 2): invented projects copied from the fixtures, an in-process run of
// the CLI, a port factory that can fail a call before or after it takes
// effect, and a tree of hashes. Failures print counts, tags, and sizes only
// (test-output-safety.test.ts).

import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { after } from "node:test";
import { createNodeFsPort } from "../src/adapters/node-fs.ts";
import type { CliIo } from "../src/cli/io.ts";
import { StdinTooLargeError } from "../src/cli/io.ts";
import { run } from "../src/cli/run.ts";
import { FsWriteFailure } from "../src/core/shared/errors.ts";
import type { FsPort, FsPortFactory } from "../src/core/shared/fs-port.ts";
import { FIXTURES } from "./golden/skills/scenario.ts";
import { FIXED_NOW } from "./golden/skills/buildos-runner.ts";
import { assertSame } from "./helpers.ts";

export const temps: string[] = [];
after(() => {
  for (const dir of temps) {
    for (const sub of walkDirs(dir)) {
      try {
        chmodSync(sub, 0o755);
      } catch {
        // gone
      }
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

export function walkDirs(dir: string): string[] {
  const out = [dir];
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) out.push(...walkDirs(join(dir, e.name)));
  } catch {
    // unreadable
  }
  return out;
}

export function project(script: "bulk-extract" | "fitgap" | "azure-boards", base: string): string {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "buildos-skill-review-")));
  temps.push(parent);
  const dir = join(parent, "project");
  cpSync(join(FIXTURES, script, "bases", base), dir, { recursive: true });
  return dir;
}

export interface Result {
  exit: number;
  stdout: string;
  stderr: string;
}

export async function buildos(args: string[], cwd: string, options: { stdin?: string | (() => Uint8Array); openFs?: FsPortFactory } = {}): Promise<Result> {
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
      if (typeof options.stdin === "function") return options.stdin();
      const data = new TextEncoder().encode(options.stdin ?? "");
      if (data.length > limit) throw new StdinTooLargeError(limit);
      return data;
    },
  };
  const exit = await run(args, io, { buildInfo: { version: "dev", sourceRevision: "unknown" }, now: () => FIXED_NOW, ...(options.openFs === undefined ? {} : { openFs: options.openFs }) });
  return { exit, stdout, stderr };
}

/**
 * A port factory that counts calls and can fail one: `fail(method, path, n)`
 * is asked before the n-th call of `method` on `path`. `true` or `"before"`
 * fails the call before it acts. `"after"` (W1 R7 P9 review round 2) lets the
 * call take effect, then throws as the adapter does when the folder flush
 * after a rename fails: an `FsWriteFailure` (`sync-parent`) that carries the
 * entry it committed (`WriteLeftovers.committed`) when the call returned one.
 */
export function instrumented(fail: (method: string, path: string, n: number) => boolean | "before" | "after" = () => false): { factory: FsPortFactory; calls: { method: string; path: string; root: string }[] } {
  const calls: { method: string; path: string; root: string }[] = [];
  const counts = new Map<string, number>();
  const factory: FsPortFactory = (root, cwd, opts) => {
    const port = createNodeFsPort(root, cwd, opts);
    return new Proxy(port, {
      get(target, prop) {
        const value = Reflect.get(target, prop) as unknown;
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const path = String(args[0]);
          calls.push({ method: String(prop), path, root: target.root });
          const key = `${String(prop)} ${path}`;
          const n = (counts.get(key) ?? 0) + 1;
          counts.set(key, n);
          const when = fail(String(prop), path, n);
          if (when === true || when === "before") throw new FsWriteFailure("injected", { code: "write_failed", fs: { errno: "EIO", syscall: "write" } });
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (when === "after") {
            const error = new FsWriteFailure("injected after the change", { code: "write_failed", fs: { errno: "EIO", syscall: "fsync", step: "sync-parent" } });
            if (typeof result === "object" && result !== null && "id" in result) (error as unknown as { buildosLeftovers: unknown }).buildosLeftovers = { committed: result };
            throw error;
          }
          return result;
        };
      },
    }) as FsPort;
  };
  return { factory, calls };
}

/** Every file under `dir` (relative, `/`) with its SHA-256, or `link:<target>` for a link. */
export function tree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (at: string): void => {
    for (const e of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, e.name);
      const rel = relative(dir, full).split(sep).join("/");
      if (e.isSymbolicLink()) out.set(rel, `link:${readlinkSync(full)}`);
      else if (e.isDirectory()) {
        out.set(`${rel}/`, "folder");
        walk(full);
      } else out.set(rel, createHash("sha256").update(readFileSync(full)).digest("hex"));
    }
  };
  walk(dir);
  return out;
}

export const canLink = (() => {
  const dir = mkdtempSync(join(tmpdir(), "buildos-link-probe-"));
  temps.push(dir);
  try {
    symlinkSync(join(dir, "nowhere"), join(dir, "probe"), "file");
    return true;
  } catch {
    return false;
  }
})();
export const posixPermissions = process.platform !== "win32" && process.getuid?.() !== 0;
export const fixtureFile = (script: string, name: string): string => readFileSync(join(FIXTURES, script, "files", name), "utf8");
export const envelopeOf = (r: Result): Record<string, unknown> => JSON.parse(r.stdout) as Record<string, unknown>;

export const CONFIG = (owners: string[]): string =>
  [
    "version: 1",
    "",
    "instance:",
    "  id: town-library",
    "  name: Town Library",
    "",
    "systems:",
    "  - id: circulation",
    "    name: Circulation",
    "    description: Lending and returns.",
    "",
    "environments:",
    "  - id: branch",
    "    name: Branch",
    "    description: The branch library.",
    "    systems:",
    "      - circulation",
    "",
    "owners:",
    ...owners.flatMap((id) => [`  - id: ${id}`, `    name: ${id}`, "    kind: team"]),
    "",
    "defaults:",
    "  systems: []",
    "  environments: []",
    "  owners: []",
    "",
  ].join("\n");

/** The full-flow review with an owner on its first minted row. */
export function ownedReview(): string {
  const review = JSON.parse(fixtureFile("bulk-extract", "full-flow-review.json")) as { candidates: { row: Record<string, unknown> }[] };
  review.candidates[0]!.row["owners"] = ["circulation-desk"];
  return `${JSON.stringify(review, null, 2)}\n`;
}

export async function stagedAndDecided(dir: string, openFs?: FsPortFactory): Promise<void> {
  const bulk = (args: string[], stdin?: string) => buildos(["extract", "bulk", "--root", dir, ...args], dir, { ...(stdin === undefined ? {} : { stdin }), ...(openFs === undefined ? {} : { openFs }) });
  assertSame((await bulk(["start", "REF-001"])).exit, 0, "start");
  writeFileSync(join(dir, "extractions", "REF-001-lending-policy.json"), fixtureFile("bulk-extract", "full-flow-review.json"));
  assertSame((await bulk(["stage", "REF-001"])).exit, 0, "stage");
  assertSame((await bulk(["decide", "REF-001", "--reviewer", "Branch Supervisor"], fixtureFile("bulk-extract", "approve-two.json"))).exit, 0, "decide");
}

export async function merged(dir: string, frame = "analysis/frame.json"): Promise<string> {
  const r = await buildos(["fitgap", "--root", dir, "merge", "--frame", frame, "--rows", "analysis/scored/*.json", "--only", "analysis/only.json", "--findings", "analysis/findings.json", "--todos", "analysis/todos.json", "--out", "out"], dir);
  assertSame(r.exit, 0, "merge exit");
  return "out/circ-lib-fit-gap-analysis.json";
}

export function frameWith(dir: string, name: string, change: (frame: Record<string, Record<string, unknown>>) => void): string {
  const frame = JSON.parse(readFileSync(join(dir, "analysis", "frame.json"), "utf8")) as Record<string, Record<string, unknown>>;
  change(frame);
  writeFileSync(join(dir, "analysis", name), JSON.stringify(frame));
  return `analysis/${name}`;
}

