// PERF-001 instrument: wall-clock time of short BuildOS commands, measured
// from the parent's spawn call to child exit, against a bare Node control.
//
// Usage: node scripts/measure-startup.ts [--bundle dist/buildos.js]
//          [--warmup 5] [--repetitions 50]
// Writes one JSON document to stdout. The profile that governs its use is
// `## PERF-001 Profile` in the W1 R7 P1 work file.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

interface Workload {
  id: string;
  args: string[];
  /** Text stdout must contain for a run to count. */
  expect: string;
}

const { values } = parseArgs({
  options: {
    bundle: { type: "string", default: "dist/buildos.js" },
    warmup: { type: "string", default: "5" },
    repetitions: { type: "string", default: "50" },
  },
});

const bundle = resolve(values.bundle);
const warmup = Number.parseInt(values.warmup, 10);
const repetitions = Number.parseInt(values.repetitions, 10);

const workloads: Workload[] = [
  { id: "node-control", args: ["-e", "process.stdout.write('ok\\n')"], expect: "ok" },
  { id: "buildos-version", args: [bundle, "version"], expect: "source revision:" },
  { id: "buildos-help", args: [bundle, "help"], expect: "BuildOS deterministic project tooling" },
  { id: "buildos-version-json", args: [bundle, "version", "--json"], expect: '"write_status": "not_requested"' },
];

interface Sample {
  ms: number;
  ok: boolean;
}

function once(workload: Workload): Sample {
  const start = process.hrtime.bigint();
  const result = spawnSync(process.execPath, workload.args, { encoding: "utf8" });
  const end = process.hrtime.bigint();
  const ok = result.status === 0 && result.stdout.includes(workload.expect);
  return { ms: Number(end - start) / 1e6, ok };
}

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const a = sorted[low] ?? Number.NaN;
  const b = sorted[high] ?? Number.NaN;
  return a + (b - a) * (position - low);
}

/** Distribution-free 95% confidence interval for the median (order statistics). */
function medianInterval(sorted: number[]): [number, number] {
  const n = sorted.length;
  const half = 1.96 * Math.sqrt(n) / 2;
  const lowRank = Math.max(1, Math.floor(n / 2 - half));
  const highRank = Math.min(n, Math.ceil(n / 2 + half) + 1);
  return [sorted[lowRank - 1] ?? Number.NaN, sorted[highRank - 1] ?? Number.NaN];
}

const round = (value: number) => Math.round(value * 100) / 100;

const warmupSamples: Record<string, number[]> = {};
const samples: Record<string, Sample[]> = {};
for (const workload of workloads) {
  warmupSamples[workload.id] = [];
  samples[workload.id] = [];
}
for (let i = 0; i < warmup; i += 1) {
  for (const workload of workloads) warmupSamples[workload.id]!.push(round(once(workload).ms));
}
// Interleave workloads so drift affects each one equally.
for (let i = 0; i < repetitions; i += 1) {
  for (const workload of workloads) samples[workload.id]!.push(once(workload));
}

const summary = Object.fromEntries(
  workloads.map((workload) => {
    const kept = samples[workload.id]!.filter((sample) => sample.ok).map((sample) => sample.ms);
    const sorted = [...kept].sort((a, b) => a - b);
    const [ciLow, ciHigh] = medianInterval(sorted);
    return [
      workload.id,
      {
        n: sorted.length,
        excluded: samples[workload.id]!.length - sorted.length,
        min: round(sorted[0] ?? Number.NaN),
        p25: round(quantile(sorted, 0.25)),
        median: round(quantile(sorted, 0.5)),
        p75: round(quantile(sorted, 0.75)),
        p90: round(quantile(sorted, 0.9)),
        max: round(sorted[sorted.length - 1] ?? Number.NaN),
        iqr: round(quantile(sorted, 0.75) - quantile(sorted, 0.25)),
        median_ci95: [round(ciLow), round(ciHigh)],
      },
    ];
  }),
);

const bundleBytes = readFileSync(bundle);
process.stdout.write(
  `${JSON.stringify(
    {
      instrument: "scripts/measure-startup.ts",
      instrument_sha256: createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex"),
      node: process.version,
      platform: `${platform()} ${release()} ${arch()}`,
      cpu: cpus()[0]?.model ?? "unknown",
      cpu_count: cpus().length,
      memory_gib: round(totalmem() / 2 ** 30),
      bundle_bytes: bundleBytes.length,
      bundle_sha256: createHash("sha256").update(bundleBytes).digest("hex"),
      warmup,
      repetitions,
      summary,
      warmup_samples_ms: warmupSamples,
      samples_ms: Object.fromEntries(
        workloads.map((workload) => [workload.id, samples[workload.id]!.map((sample) => (sample.ok ? round(sample.ms) : null))]),
      ),
    },
    null,
    2,
  )}\n`,
);
