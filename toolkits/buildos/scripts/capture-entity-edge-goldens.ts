// Captures the Go seed on the entity edge cases of the W1 R7 P3 review
// (symlinks at a write target, a symlink loop at the index after the
// canonical rename, Unicode key folding, integer-like map keys, deep
// nesting, an out-of-range trailing number, and permission denial at the
// temporary file). test/entities-edge.test.ts runs the TypeScript bundle on
// the same cases and compares exit code, stdout, stderr, and the file tree.
//
// The Go sources are gone since W1 R7 P8. Build the Go tool from a worktree
// of the frozen baseline commit 263f5ca (test/golden/CAPTURE.md, Frozen Go
// Baseline); the paths below are inside that worktree.
// Build the seed first, from `toolkits/buildos/`:
//   go build -o <scratch>/buildos-go ./cmd/buildos
// Then (POSIX only):
//   node scripts/capture-entity-edge-goldens.ts <scratch>/buildos-go
//
// Writes test/fixtures/go-seed/entity-edge-goldens.json. Two run-to-run
// values are normalized, the same way for Go and TypeScript:
// - `{ROOT}`: the scratch fixture folder (its given and real spellings).
// - `{RAND}`: the random part of the temporary file name in Go's
//   `os.CreateTemp` permission diagnostic, and nowhere else. Go names the file
//   prefix + a random uint32 in decimal (`strconv.Itoa(int(rand.Uint32()))`)
//   + suffix and prints that name when the create fails. Only a case with a
//   `temp` entry is normalized, and only in two places: the `message` of an
//   entry of the JSON envelope's top-level `diagnostics` array (stdout), and a
//   whole human diagnostic line `ERROR [internal_error]: <message>` (stderr).
//   The whole message must equal the case's template exactly:
//   `<words>: open {ROOT}/root/<folder>/<prefix><n><suffix>: permission denied`,
//   with `<n>` a canonical decimal uint32 (0 to 4294967295, no leading zero).
//   Every other field and line (an entity ID, `result.requested_id`, a near
//   miss such as `permission denied by policy`) is compared byte for byte.
//
// The file tree after a run is snapshotted before the harness restores the
// folder permissions it removed, so a changed mode shows. The snapshot also
// covers the files of the scratch folder outside the root (the manifest, and
// the outside target of a dataset link), under `../<name>`.
//
// Cases with an approved parity exception (PE-004, PE-006, PE-007) list it in
// `exception`; test/entities-edge.test.ts passes them only with exactly the
// differences that test/golden/parity-exceptions.json (`edge`) allows.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATASETS = ["requirements", "capabilities", "personas", "test-cases", "results", "runs", "findings", "extractions"];

type Row = Record<string, unknown>;
const row = (id: string, status = "active", extra: Row = {}): Row => ({ id, type: "persona", status, ...extra });
const mapping = (source = "Alfa", target = "Zulu"): Row => ({
  source_id: source,
  target_id: target,
  kind: "duplicate",
  reason: "design review",
  decided_at: "2004-02-29T00:00:00Z",
  decided_by: "Ada",
  evidence_refs: [],
});
const edge = (a: string, b: string): Row => {
  const { source_id: _s, target_id, ...rest } = mapping(a, b);
  return row(a, "superseded", { redirect: { target_id, ...rest } });
};
const deep = (depth: number) => `{"id":"Alfa","type":"persona","status":"active","ext":${"[".repeat(depth)}0${"]".repeat(depth)}}`;

export interface EdgeCase {
  name: string;
  /** Why the case exists: the review finding it covers. */
  covers: string;
  command: "resolve" | "validate" | "consolidate" | "rebuild-index";
  args?: string[];
  mode?: "strict" | "compat";
  /** `personas.jsonl` text; default: the rows Alfa and Zulu. */
  personas?: string;
  /** The manifest text; default: one mapping Alfa to Zulu. */
  manifest?: string;
  /** Text of `.os/indexes/entity-resolution.json`, when the case plants one. */
  index?: string;
  /** A change to make after the fixture is written. */
  plant?: "index-loop" | "dataset-link-sibling" | "dataset-link-dangling" | "dataset-link-outside" | "index-link-sibling" | "index-link-dangling" | "indexes-read-only" | "data-read-only" | "os-read-only" | "no-data";
  /** The approved parity exception that covers this case's differences from Go. */
  exception?: "PE-004" | "PE-006" | "PE-007";
  /** Go's `os.CreateTemp` permission diagnostic that this case prints; its random part is normalized to `{RAND}`. */
  temp?: TempDiagnostic;
}

/**
 * The template of one Go `os.CreateTemp` permission diagnostic:
 * `<words>: open {ROOT}/root/<folder>/<prefix><n><suffix>: permission denied`.
 */
export interface TempDiagnostic {
  words: string;
  /** The folder below the root, as path segments. */
  folder: string[];
  prefix: string;
  suffix: string;
}

const INDEX_TEMP: TempDiagnostic = { words: "create same-filesystem entity-resolution temporary file", folder: [".os", "indexes"], prefix: ".entity-resolution-", suffix: ".tmp" };
const CANONICAL_TEMP: TempDiagnostic = { words: "create same-filesystem canonical temporary file", folder: [".os", "data"], prefix: ".buildos-consolidation-", suffix: ".tmp" };

const ROWS = `${[row("Alfa"), row("Zulu")].map((r) => JSON.stringify(r)).join("\n")}\n`;
const MANIFEST = JSON.stringify({ version: 1, mappings: [mapping()] });
const INDEX_OK = '{"version":1,"canonical_by_id":{},"members_by_canonical":{}}';
/** The default mapping as JSON text, with `"evidence_refs":[]` replaced by `refs` (repeated keys). */
const mappingWithRefs = (refs: string, source = "Alfa") => JSON.stringify(mapping(source)).replace('"evidence_refs":[]', refs);
const THREE_ROWS = `${[row("Alfa"), row("Bravo"), row("Zulu")].map((r) => JSON.stringify(r)).join("\n")}\n`;

export const EDGE_CASES: readonly EdgeCase[] = [
  { name: "index-loop-after-commit", covers: "1: symlink loop at the index after the canonical rename", command: "consolidate", args: ["--apply"], plant: "index-loop" },
  { name: "dataset-link-to-sibling", covers: "2: personas.jsonl is a symlink to a regular sibling", command: "consolidate", args: ["--apply"], plant: "dataset-link-sibling" },
  { name: "dataset-link-dangling", covers: "2: personas.jsonl is a dangling symlink", command: "consolidate", args: ["--apply"], plant: "dataset-link-dangling" },
  { name: "index-link-to-sibling", covers: "2: the index is a symlink to a regular sibling", command: "rebuild-index", args: ["--apply"], plant: "index-link-sibling" },
  { name: "index-link-dangling", covers: "2: the index is a dangling symlink", command: "rebuild-index", args: ["--apply"], plant: "index-link-dangling" },
  { name: "manifest-key-dotless-i", covers: "4: versıon (dotless i) is not version", command: "consolidate", manifest: MANIFEST.replace('"version"', '"versıon"') },
  { name: "manifest-key-long-s", covers: "4: mappingſ (long s) folds to mappings", command: "consolidate", manifest: MANIFEST.replace('"mappings"', '"mappingſ"') },
  { name: "manifest-key-kelvin", covers: "4: Kind (Kelvin sign) folds to kind", command: "consolidate", manifest: MANIFEST.replace('"kind"', '"Kind"') },
  { name: "manifest-key-upper", covers: "4: ASCII case folding", command: "consolidate", manifest: MANIFEST.replace('"version"', '"VERSION"').replace('"target_id"', '"Target_ID"') },
  { name: "index-key-dotless-i", covers: "4: index key versıon is unknown", command: "validate", index: INDEX_OK.replace('"version"', '"versıon"') },
  { name: "index-key-long-s", covers: "4: index key members_by_canonicalſ is unknown, MEMBERS_BY_CANONICAL is not", command: "validate", index: INDEX_OK.replace('"members_by_canonical"', '"MEMBERS_BY_CANONICAL"') },
  {
    name: "index-integer-like-ids",
    covers: "5: integer-like IDs in both index maps",
    command: "rebuild-index",
    args: ["--apply"],
    personas: `${[edge("10", "Z"), edge("2", "Z"), row("Z"), row("100"), edge("A", "100"), row("3"), edge("B", "3")].map((r) => JSON.stringify(r)).join("\n")}\n`,
  },
  { name: "deep-row-compat", covers: "6: 8000 levels of nesting in a row", command: "resolve", mode: "compat", personas: `${deep(8000)}\n` },
  { name: "deep-row-10000", covers: "6: 9999 levels inside the row object (10000 in all)", command: "validate", mode: "compat", personas: `${deep(9999)}\n` },
  { name: "deep-row-10001", covers: "6: one level past Go's limit", command: "validate", mode: "compat", personas: `${deep(10000)}\n` },
  { name: "manifest-trailer-1e999", covers: "6: trailing 1e999 after the manifest", command: "consolidate", manifest: `${MANIFEST} 1e999` },
  { name: "manifest-trailer-nested-1e999", covers: "6: the first out-of-range number in a trailing value", command: "consolidate", manifest: `${MANIFEST} [1, {"a": -1e999}, 1e999]` },
  { name: "manifest-trailer-1e308", covers: "6: a trailing number in range", command: "consolidate", manifest: `${MANIFEST} 1e308` },
  { name: "index-trailer-1e999", covers: "6: trailing 1e999 after the index", command: "validate", index: `${INDEX_OK} 1e999` },
  { name: "index-temp-permission", covers: "7: the indexes folder is not writable", command: "rebuild-index", args: ["--apply"], plant: "indexes-read-only", temp: INDEX_TEMP },
  { name: "canonical-temp-permission", covers: "7: the data folder is not writable", command: "consolidate", args: ["--apply"], plant: "data-read-only", temp: CANONICAL_TEMP },
  {
    name: "manifest-slice-reuse-folded",
    covers: "R2-1: evidence_refs, EVIDENCE_REFS, Evidence_Refs reuse one backing array: [c, b]",
    command: "consolidate",
    manifest: `{"version":1,"mappings":[${mappingWithRefs('"evidence_refs":["a","b"],"EVIDENCE_REFS":["c"],"Evidence_Refs":[null,null]')}]}`,
  },
  {
    name: "manifest-slice-reuse-grown-zero",
    covers: "R2-1: slots up to the grown capacity come back, the slot past it is zero: [a, b, c, \"\"]",
    command: "consolidate",
    manifest: `{"version":1,"mappings":[${mappingWithRefs('"evidence_refs":["a","b","c"],"evidence_refs":[null],"evidence_refs":[null,null,null,null]')}]}`,
  },
  {
    name: "manifest-slice-reuse-empty-resets",
    covers: "R2-1: an empty array drops the backing array: [\"\"]",
    command: "consolidate",
    manifest: `{"version":1,"mappings":[${mappingWithRefs('"evidence_refs":["a","b"],"evidence_refs":[],"evidence_refs":[null]')}]}`,
  },
  {
    name: "manifest-struct-slot-revived",
    covers: "R2-1: {} elements merge into the old mapping structs in the backing array",
    command: "consolidate",
    personas: THREE_ROWS,
    manifest: `{"version":1,"mappings":[${JSON.stringify(mapping())},${JSON.stringify(mapping("Bravo"))}],"mappings":[{}],"Mappings":[{},{}]}`,
  },
  {
    name: "manifest-struct-merge",
    covers: "R2-1: a repeated mappings key merges fields into the existing mapping struct",
    command: "consolidate",
    manifest: '{"version":1,"mappings":[{"source_id":"Alfa","target_id":"Zulu","kind":"duplicate"}],"MAPPINGS":[{"reason":"design review","decided_at":"2004-02-29T00:00:00Z","decided_by":"Ada","evidence_refs":[]}]}',
  },
  {
    name: "index-map-merge",
    covers: "R2-1: repeated index map keys merge into the existing map",
    command: "validate",
    personas: `${[edge("Alfa", "Zulu"), row("Zulu")].map((r) => JSON.stringify(r)).join("\n")}\n`,
    index: '{"version":1,"canonical_by_id":{"Alfa":"Zulu"},"CANONICAL_BY_ID":{"Zulu":"Zulu"},"members_by_canonical":{"Zulu":["Alfa"]},"members_by_canonical":{"Zulu":["Alfa","Zulu"]}}',
  },
  // W1 R7 P6 t29: Go's bytes.TrimSpace keeps a leading U+FEFF, so BOM + null is not the null literal.
  { name: "redirect-null", covers: "P6 t29: redirect is the null literal", command: "validate", personas: `{"id":"Alfa","type":"persona","status":"superseded","redirect":null}\n${JSON.stringify(row("Zulu"))}\n` },
  { name: "redirect-null-spaced", covers: "P6 t29: redirect is null with spaces around it", command: "validate", personas: `{"id":"Alfa","type":"persona","status":"superseded","redirect": \t null \t}\n${JSON.stringify(row("Zulu"))}\n` },
  { name: "redirect-bom-null", covers: "P6 t29: redirect is U+FEFF then null", command: "validate", personas: `{"id":"Alfa","type":"persona","status":"superseded","redirect":\uFEFFnull}\n${JSON.stringify(row("Zulu"))}\n` },
  { name: "row-bom-prefix", covers: "P6 t29: a row that starts with U+FEFF", command: "validate", personas: `\uFEFF${JSON.stringify(row("Alfa"))}\n${JSON.stringify(row("Zulu"))}\n` },
  { name: "root-without-os-data", covers: "PE-004: the root exists, .os/data/ does not", command: "validate", plant: "no-data", exception: "PE-004" },
  { name: "consolidate-dry-run-os-read-only", covers: "PE-006: a dry run with .os/ not writable", command: "consolidate", plant: "os-read-only", exception: "PE-006" },
  { name: "dataset-link-outside-root", covers: "PE-007: personas.jsonl is a symlink to a file outside the root", command: "consolidate", args: ["--apply"], plant: "dataset-link-outside", exception: "PE-007" },
];

/**
 * A file-tree snapshot below `root`: kind, permission bits, and the content
 * digest or link target of every entry. With `work` (the scratch folder that
 * holds `root`), every other entry of `work` is added as `../<name>`, so the
 * manifest and the outside target of a dataset link are covered too.
 */
export function snapshot(root: string, work?: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (abs: string, rel: string) => {
    const st = lstatSync(abs);
    const mode = (st.mode & 0o777).toString(8);
    if (st.isSymbolicLink()) out[rel] = `link ${readlinkSync(abs)}`;
    else if (st.isFile()) out[rel] = `file ${mode} ${createHash("sha256").update(readFileSync(abs)).digest("hex")}`;
    else if (st.isDirectory()) {
      out[rel] = `dir ${mode}`;
      for (const name of readdirSync(abs).sort()) visit(join(abs, name), `${rel}/${name}`);
    } else out[rel] = "other";
  };
  visit(root, ".");
  if (work !== undefined) {
    for (const name of readdirSync(work).sort()) if (join(work, name) !== root) visit(join(work, name), `../${name}`);
  }
  return out;
}

/** Writes the fixture for `c` under a new scratch folder; returns the folder and its root. */
export function makeEdgeFixture(c: EdgeCase): { work: string; root: string } {
  const work = realpathSync(mkdtempSync(join(tmpdir(), "buildos-edge-")));
  const root = join(work, "root");
  const data = join(root, ".os", "data");
  const indexes = join(root, ".os", "indexes");
  mkdirSync(data, { recursive: true });
  for (const name of DATASETS) writeFileSync(join(data, `${name}.jsonl`), "");
  const personas = join(data, "personas.jsonl");
  writeFileSync(personas, c.personas ?? ROWS);
  chmodSync(personas, 0o640);
  writeFileSync(join(work, "manifest.json"), c.manifest ?? MANIFEST);
  if (c.index !== undefined || c.plant?.startsWith("index") === true) mkdirSync(indexes);
  if (c.index !== undefined) writeFileSync(join(indexes, "entity-resolution.json"), c.index);
  switch (c.plant) {
    case "index-loop":
      symlinkSync("entity-resolution.json", join(indexes, "entity-resolution.json"));
      break;
    case "dataset-link-sibling":
      writeFileSync(join(data, "personas.orig"), c.personas ?? ROWS);
      chmodSync(join(data, "personas.orig"), 0o640);
      rmSync(personas);
      symlinkSync("personas.orig", personas);
      break;
    case "dataset-link-dangling":
      rmSync(personas);
      symlinkSync("personas.missing", personas);
      break;
    case "dataset-link-outside":
      writeFileSync(join(work, "outside.jsonl"), c.personas ?? ROWS);
      chmodSync(join(work, "outside.jsonl"), 0o640);
      rmSync(personas);
      symlinkSync(join("..", "..", "..", "outside.jsonl"), personas);
      break;
    case "no-data":
      rmSync(data, { recursive: true });
      break;
    case "index-link-sibling":
      writeFileSync(join(indexes, "sibling.json"), INDEX_OK);
      symlinkSync("sibling.json", join(indexes, "entity-resolution.json"));
      break;
    case "index-link-dangling":
      symlinkSync("missing.json", join(indexes, "entity-resolution.json"));
      break;
    case "indexes-read-only":
    case "data-read-only":
    case "os-read-only":
      break;
    default:
      break;
  }
  return { work, root };
}

const LOCKED: Partial<Record<NonNullable<EdgeCase["plant"]>, string[]>> = {
  "indexes-read-only": [".os", "indexes"],
  "data-read-only": [".os", "data"],
  "os-read-only": [".os"],
};

const UINT32_MAX = 4294967295;

/** The message of `temp` with `n` as the random part (after `{ROOT}`). */
export const tempMessage = (temp: TempDiagnostic, n: string) => `${temp.words}: open {ROOT}/root/${temp.folder.join("/")}/${temp.prefix}${n}${temp.suffix}: permission denied`;

/**
 * Returns the message with `{RAND}` when the whole message equals the
 * template of `temp` with a canonical decimal uint32 (`0`, or 1 to 10 digits
 * with no leading zero and a value of at most 4294967295); otherwise undefined.
 */
function randMessage(message: string, temp: TempDiagnostic): string | undefined {
  const [head, tail] = tempMessage(temp, "\u0000").split("\u0000") as [string, string];
  if (message.length < head.length + tail.length || !message.startsWith(head) || !message.endsWith(tail)) return undefined;
  const n = message.slice(head.length, message.length - tail.length);
  return /^(0|[1-9][0-9]{0,9})$/.test(n) && Number(n) <= UINT32_MAX ? tempMessage(temp, "{RAND}") : undefined;
}

/**
 * Normalizes the scratch folder to `{ROOT}` in a stream. With `temp`, it also
 * normalizes the random part of that Go `os.CreateTemp` permission diagnostic
 * to `{RAND}`, and only there: on stdout, in the `message` of each entry of
 * the top-level `diagnostics` array of the JSON envelope (only when the
 * stream is exactly the envelope as the CLI prints it, two-space indented
 * with a final newline, so no other byte can change); on stderr, in each whole
 * line `ERROR [internal_error]: <message>`. The message must equal the
 * template exactly (see randMessage). Every other byte is kept.
 */
export function normalizeEdge(stream: "stdout" | "stderr", text: string, work: string, temp?: TempDiagnostic): string {
  const out = text.replaceAll(work, "{ROOT}");
  if (temp === undefined) return out;
  if (stream === "stderr") {
    const human = "ERROR [internal_error]: ";
    return out
      .split("\n")
      .map((line) => (line.startsWith(human) ? `${human}${randMessage(line.slice(human.length), temp) ?? line.slice(human.length)}` : line))
      .join("\n");
  }
  let envelope: unknown;
  try {
    envelope = JSON.parse(out);
  } catch {
    return out;
  }
  if (`${JSON.stringify(envelope, null, 2)}\n` !== out || typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) return out;
  const diagnostics = (envelope as { diagnostics?: unknown }).diagnostics;
  if (!Array.isArray(diagnostics)) return out;
  let changed = false;
  for (const d of diagnostics) {
    if (typeof d !== "object" || d === null || Array.isArray(d) || typeof (d as { message?: unknown }).message !== "string") continue;
    const rand = randMessage((d as { message: string }).message, temp);
    if (rand !== undefined) {
      (d as { message: string }).message = rand;
      changed = true;
    }
  }
  return changed ? `${JSON.stringify(envelope, null, 2)}\n` : out;
}

/** Runs `program` on `c` in a fresh fixture: exit code, normalized output, and the file tree afterwards. */
export function runEdgeCase(program: string[], c: EdgeCase): { exit: number; stdout: string; stderr: string; tree: Record<string, string> } {
  const { work, root } = makeEdgeFixture(c);
  const locked = c.plant === undefined ? undefined : LOCKED[c.plant];
  try {
    if (locked !== undefined) {
      mkdirSync(join(root, ...locked), { recursive: true });
      chmodSync(join(root, ...locked), 0o555);
    }
    const extra = c.command === "resolve" ? ["--id", "Alfa"] : c.command === "consolidate" ? ["--manifest", join(work, "manifest.json")] : [];
    const args = ["entities", c.command, "--root", root, "--mode", c.mode ?? "strict", ...extra, ...(c.args ?? []), "--json"];
    const result = spawnSync(program[0]!, [...program.slice(1), ...args], { cwd: work, encoding: "utf8", env: { ...process.env, TZ: "UTC", PWD: work }, maxBuffer: 64 * 1024 * 1024 });
    if (result.error !== undefined) throw result.error;
    // Snapshot first: the locked folder's mode as the program left it, and the files outside the root.
    const tree = snapshot(root, work);
    if (locked !== undefined) chmodSync(join(root, ...locked), 0o755);
    return { exit: result.status ?? -1, stdout: normalizeEdge("stdout", result.stdout, work, c.temp), stderr: normalizeEdge("stderr", result.stderr, work, c.temp), tree };
  } finally {
    if (locked !== undefined) chmodSync(join(root, ...locked), 0o755);
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const binary = process.argv[2];
  if (binary === undefined) {
    process.stderr.write("usage: node scripts/capture-entity-edge-goldens.ts <go seed binary>\n");
    process.exit(2);
  }
  const cases = EDGE_CASES.map((c) => ({ name: c.name, covers: c.covers, ...runEdgeCase([resolve(binary)], c) }));
  for (const c of EDGE_CASES) {
    const golden = cases.find((x) => x.name === c.name)!;
    if (c.temp !== undefined && golden.stdout.split(tempMessage(c.temp, "{RAND}")).length !== 2) throw new Error(`${c.name}: Go did not print the ${c.temp.prefix} temporary-file diagnostic exactly once`);
  }
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "go-seed", "entity-edge-goldens.json");
  writeFileSync(out, `${JSON.stringify({ source: "scripts/capture-entity-edge-goldens.ts with the Go seed built from toolkits/buildos/cmd/buildos", goVersion: process.env["GO_VERSION"] ?? "", cases }, null, 2)}\n`);
  process.stdout.write(`wrote ${out}\n`);
}
