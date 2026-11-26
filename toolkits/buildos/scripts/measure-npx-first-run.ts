// PERF-002 instrument: wall-clock time of the first `npx -y build-os@<version>
// version` with an empty npm cache, measured from the parent's spawn call to
// child exit. Two reference workloads run in the same repetition: the same
// command again with the now-filled cache (warm), and a fetch of the registry
// tarball alone in a new Node process (the part that package size drives).
//
// Usage: node scripts/measure-npx-first-run.ts --version <version>
//          --tarball-sha256 <hex> [--repetitions 10]
// Writes one JSON document to stdout. Every repetition uses a new empty npm
// cache folder and new empty working folders below one temporary root, which
// is removed at the end; no path is printed. npm install scripts and npm's
// update notice are off. The profile that governs its use is
// `## PERF-002 Profile` in the W1 R7 P8 work file.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { arch, cpus, platform, release, tmpdir, totalmem } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    version: { type: "string" },
    "tarball-sha256": { type: "string" },
    repetitions: { type: "string", default: "10" },
  },
});
const version = values.version ?? "";
const digest = values["tarball-sha256"] ?? "";
const repetitions = Number.parseInt(values.repetitions, 10);
if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version) || !/^[0-9a-f]{64}$/.test(digest) || !(repetitions > 0)) {
  process.stderr.write("Usage: node scripts/measure-npx-first-run.ts --version <version> --tarball-sha256 <hex> [--repetitions 10]\n");
  process.exit(2);
}
const tarballUrl = `https://registry.npmjs.org/build-os/-/build-os-${version}.tgz`;

/** npx as `node <npx-cli.js>` (no shell on any system). */
function npxCli(): string {
  const nodeDir = dirname(process.execPath);
  for (const cli of [join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"), join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js")]) if (existsSync(cli)) return cli;
  throw new Error("npx-cli.js not found next to this Node.js");
}
const cli = npxCli();
const root = mkdtempSync(join(tmpdir(), "buildos-perf-002-"));

const env = (cache: string): NodeJS.ProcessEnv => {
  const e: NodeJS.ProcessEnv = { ...process.env, npm_config_cache: cache, npm_config_ignore_scripts: "true", npm_config_update_notifier: "false", npm_config_fund: "false", npm_config_audit: "false" };
  for (const key of Object.keys(e)) if (key.startsWith("BUILDOS_") || /^npm_config_(prefer_offline|offline|prefer_online)$/i.test(key)) delete e[key];
  return e;
};

interface Sample {
  ms: number;
  ok: boolean;
}

function timed(file: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv, ok: (stdout: string, status: number | null) => boolean): Sample {
  const start = process.hrtime.bigint();
  const r = spawnSync(file, args, { cwd, env: environment, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 600_000 });
  const end = process.hrtime.bigint();
  return { ms: Number(end - start) / 1e6, ok: ok(String(r.stdout ?? ""), r.status) };
}

const FETCH = "const r=await fetch(process.argv[1]);if(!r.ok)process.exit(1);const b=Buffer.from(await r.arrayBuffer());const h=(await import('node:crypto')).createHash('sha256').update(b).digest('hex');process.stdout.write(h+' '+b.length+'\\n');";

const samples: Record<string, Sample[]> = { cold: [], warm: [], tarball: [] };
let tarballBytes = 0;
const startedAt = new Date().toISOString();
for (let i = 0; i < repetitions; i += 1) {
  const cache = join(root, `cache-${i}`);
  const cold = join(root, `cold-${i}`);
  const warm = join(root, `warm-${i}`);
  for (const d of [cache, cold, warm]) mkdirSync(d);
  const expect = (stdout: string, status: number | null) => status === 0 && stdout.includes(`version: ${version}\n`);
  samples["cold"]!.push(timed(process.execPath, [cli, "-y", `build-os@${version}`, "version"], cold, env(cache), expect));
  samples["warm"]!.push(timed(process.execPath, [cli, "-y", `build-os@${version}`, "version"], warm, env(cache), expect));
  samples["tarball"]!.push(
    timed(process.execPath, ["--input-type=module", "-e", FETCH, tarballUrl], root, env(cache), (stdout, status) => {
      const [hash, size] = stdout.trim().split(" ");
      if (hash === digest) tarballBytes = Number(size);
      return status === 0 && hash === digest;
    }),
  );
}
const endedAt = new Date().toISOString();
rmSync(root, { recursive: true, force: true, maxRetries: 5 });

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const a = sorted[low] ?? Number.NaN;
  const b = sorted[high] ?? Number.NaN;
  return a + (b - a) * (position - low);
}

/** Distribution-free 95% confidence interval for the median (order statistics), as in scripts/measure-startup.ts. */
function medianInterval(sorted: number[]): [number, number] {
  const n = sorted.length;
  const half = (1.96 * Math.sqrt(n)) / 2;
  const lowRank = Math.max(1, Math.floor(n / 2 - half));
  const highRank = Math.min(n, Math.ceil(n / 2 + half) + 1);
  return [sorted[lowRank - 1] ?? Number.NaN, sorted[highRank - 1] ?? Number.NaN];
}

const round = (value: number) => Math.round(value * 10) / 10;
const summary = Object.fromEntries(
  Object.entries(samples).map(([id, list]) => {
    const sorted = list.filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
    const [ciLow, ciHigh] = medianInterval(sorted);
    return [id, { n: sorted.length, excluded: list.length - sorted.length, min: round(sorted[0] ?? Number.NaN), p25: round(quantile(sorted, 0.25)), median: round(quantile(sorted, 0.5)), p75: round(quantile(sorted, 0.75)), max: round(sorted.at(-1) ?? Number.NaN), iqr: round(quantile(sorted, 0.75) - quantile(sorted, 0.25)), median_ci95: [round(ciLow), round(ciHigh)] }];
  }),
);
const npmVersion = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8", env: env(join(tmpdir(), "unused")) }).stdout.trim();
process.stdout.write(
  `${JSON.stringify(
    {
      instrument: "scripts/measure-npx-first-run.ts",
      instrument_sha256: createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex"),
      package: `build-os@${version}`,
      tarball_sha256: digest,
      tarball_bytes: tarballBytes,
      node: process.version,
      npm: npmVersion,
      platform: `${platform()} ${release()} ${arch()}`,
      cpu: cpus()[0]?.model ?? "unknown",
      cpu_count: cpus().length,
      memory_gib: Math.round((totalmem() / 2 ** 30) * 100) / 100,
      started_at: startedAt,
      ended_at: endedAt,
      repetitions,
      summary,
      samples_ms: Object.fromEntries(Object.entries(samples).map(([id, list]) => [id, list.map((s) => (s.ok ? round(s.ms) : null))])),
    },
    null,
    2,
  )}\n`,
);
