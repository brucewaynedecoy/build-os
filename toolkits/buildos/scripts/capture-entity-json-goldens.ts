// Captures Go 1.24.1 encoding/json and time.Parse answers for the entity port
// (W1 R7 P3). The TypeScript port in src/core/shared/go-json.ts and
// rfc3339Offset in src/core/entities/consolidate.ts must give the same text.
//
//   node scripts/capture-entity-json-goldens.ts <path to the go binary>
//
// It writes a small Go program to a scratch folder, builds it with that Go
// (GOTOOLCHAIN=local, no modules fetched), runs it on the inputs below, and
// writes test/fixtures/go-seed/entity-json.json. Tests never run Go.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SYNTAX = ["{not json", "[1,]", '{"a" 1}', '{"a":1 "b"}', "[1 2]", "01", "-", "1.", "1e", "1e+", "tru", "nul!", '"\\x"', '"\\u12g4"', '"a\tb"', "'", "\u00c3", '{"a":', "", " ", "{}", "[]", "null", "1", '"s"', "true", '{"id":"x"}', '{"a":{"b":[1,{"c":"\\ud800"}]}}', "{,}", '{"a":1,}', "[,1]", '{"a":1}}', "-01", "1.5e3x", "\u0001", "{\"\\u00", "[[[[", '{"a":"\\u00e9\\uD83D\\uDE00"}', "  \n {\"a\" : 1 } \n", "1 2", "{} x"];
/**
 * Repeated (case-folded) keys decode into the slice already there: Go reuses
 * its backing array, so `null` and `{}` elements can bring back old values.
 * Maps merge, and a map element is decoded from zero.
 */
export const SLICE_REUSE = [
  '{"mappings":[{"evidence_refs":["a","b"],"EVIDENCE_REFS":["c"],"Evidence_Refs":[null,null]}]}',
  '{"mappings":[{"evidence_refs":["a","b","c"],"evidence_refs":[null],"evidence_refs":[null,null,null,null]}]}',
  '{"mappings":[{"evidence_refs":["a","b","c"],"evidence_refs":[null],"evidence_refs":[null,null,null,null,null]}]}',
  '{"mappings":[{"evidence_refs":["a","b"],"evidence_refs":[],"evidence_refs":[null,null]}]}',
  '{"mappings":[{"evidence_refs":["a","b"],"evidence_refs":null,"evidence_refs":[null]}]}',
  '{"mappings":[{"evidence_refs":["a","b"],"evidence_refs":["c"],"evidence_refs":[null,"d",null]}]}',
  '{"mappings":[{"source_id":"a","evidence_refs":["x"]}],"mappings":[{"target_id":"b"}]}',
  '{"mappings":[{"source_id":"a"},{"source_id":"b"},{"source_id":"c"}],"mappings":[{}],"mappings":[{},{},{}]}',
  '{"mappings":[{"source_id":"a"},{"source_id":"b"}],"mappings":[null],"mappings":[{},{},{}]}',
  '{"mappings":[{"evidence_refs":["a","b"]}],"mappings":[{"evidence_refs":["c"]}],"mappings":[{"evidence_refs":[null,null]}]}',
];
/** Element counts for Go's slice growth: the capacity after decoding that many elements into a nil slice. */
export const SLICE_CAPS = [...Array.from({ length: 70 }, (_, i) => i + 1), 100, 255, 256, 257, 300, 511, 512, 513, 1000, 1500, 2048, 2049, 3000, 5000].map(String);
export const INDEX_MERGE = [
  '{"canonical_by_id":{"a":"b"},"CANONICAL_BY_ID":{"c":"d","a":"e"}}',
  '{"canonical_by_id":{"a":"b"},"canonical_by_id":{}}',
  '{"canonical_by_id":{"a":"b"},"canonical_by_id":null,"canonical_by_id":{"c":"d"}}',
  '{"members_by_canonical":{"x":["a","b"]},"members_by_canonical":{"x":[null]}}',
  '{"members_by_canonical":{"x":["a","b"],"x":[null,null]}}',
];
export const MANIFESTS = ['{"version":1,"mappings":[],"x":1}', '{"version":1,"mappings":[{"source_id":1}]}', '{"version":1,"mappings":[{"evidence_refs":[1]}]}', '{"version":1,"mappings":{}}', '{"VERSION":2,"Mappings":[]}', " ", "{} {}", "{} x", '{"version":1', "[]", '"x"', "null", '{"version":1.0}', '{"version":1e2}', '{"version":"1"}', '{"version":true}', '{"version":null,"mappings":null}', '{"version":99999999999999999999}', '{"version":-0}', '{"mappings":[null,{"kind":"x","x":1}]}', '{"mappings":[{"source_id":"a"}],"mappings":[{"target_id":"b"}]}', '{"mappings":[{"source_id":"a"},{"source_id":"b"}],"mappings":[{"target_id":"c"}]}', '{"version":1,"mappings":[{"evidence_refs":null}]}', '{"version":1,"mappings":[{"evidence_refs":["a",null,2]}]}', '{"verſion":1}', '{"Source_ID":1}', '{"version":[1]}', '{"version":{}}', '{"mappings":"x"}', '{"mappings":[1]}', '{"mappings":[[1]]}', '{"x":1,"version":"s"}', '{"version":"s","x":1}', '{"versıon":1}', '{"VERSİON":1}', '{"mappingſ":[]}', '{"MAPPINGS":[{"\u212Aind":"k","ſource_id":"s","SOURCE_ID":"t"}]}', '{"mappings":[{"kind":"a","KIND":"b","Kind":"c"}]}', '{"version":1,"versıon":2}', '{"vërsion":1}', '{"VERSION":1,"version":2}', '{"version":1,"mappings":[]} 1e999', '{"version":1,"mappings":[]} -1e999', '{"version":1,"mappings":[]} 1e-999', '{"version":1,"mappings":[]} 1.7976931348623157e308', '{"version":1,"mappings":[]} 1.7976931348623159e308', '{"version":1,"mappings":[]} [1, {"a": [2e400]}, -3e400]', '{"version":1,"mappings":[]} {"1e999": "1e999"}', ...SLICE_REUSE];
export const INDEXES = ['{"version":1,"canonical_by_id":{},"members_by_canonical":{},"extra":true}', '{"version":"1"}', '{"version":1.5}', "[]", '{"version":1,"canonical_by_id":{}} {}', '{"version":1,"canonical_by_id":{"a":1}}', '{"canonical_by_id":{"a":"b"},"canonical_by_id":{"c":"d"}}', '{"canonical_by_id":{"a":null},"members_by_canonical":{"x":null,"y":[null,"z"]}}', '{"members_by_canonical":{"x":"y"}}', '{"members_by_canonical":{"x":[1]}}', '{"canonical_by_id":[]}', '{"canonical_by_id":null}', '{"version":1,"canonical_by_id":{"PER-102":"PER-101"}', "", '{"version":1,"canonical_by_id":{"10":"Z","2":"Z","b":"Z","é":"Z","\uE000":"Z","𐀀":"Z"},"members_by_canonical":{"Z":["2","10"],"100":["x"],"3":["y"]}}', '{"Version":1,"CANONICAL_BY_ID":{},"Members_By_Canonical":{}}', '{"version":1,"canonical_by_ıd":{}}', '{"version":1,"canonical_by_id":{},"members_by_canonical":{}} 1e999', '{"version":1,"canonical_by_id":{},"members_by_canonical":{}} ' + "[".repeat(10001) + "]".repeat(10001), '{"version":1,"canonical_by_id":{},"members_by_canonical":{}} ' + "[".repeat(10000) + "]".repeat(10000), ...INDEX_MERGE];
export const TIMES = ["2026-07-21T15:30:00Z", "2026-07-21T15:30:00.123Z", "2026-07-21T15:30:00-00:00", "2026-07-21T15:30:00+01:30", "2026-07-21T5:30:00Z", "2026-07-21T15:30:00,5Z", "2026-07-21", "2026-02-30T00:00:00Z", "2026-07-21 15:30:00Z", "2026-07-21T15:30:00", "2026-07-21T15:30:00z", "2026-07-21T24:00:00Z", "2026-07-21T15:30:60Z", "2026-07-21t15:30:00Z", "2024-02-29T00:00:00Z", "2023-02-29T00:00:00Z", "2026-7-21T15:30:00Z", "+2026-07-21T15:30:00Z", "2026-07-21T15:30:00+24:00", "2026-07-21T15:30:00+00:60", "2026-07-21T15:30:00.Z", "2026-07-21T15:30:00Z ", "0000-01-01T00:00:00Z", "2026-07-21T15:30:00+0000", "2026-07-21T15:30:00.1234567890123Z", "2026-07-21T1:30:00+00:00", "2026-07-21T15:3:00Z", "2026-13-01T00:00:00Z", "2026-07-21T15:30:00-01:00", "2026-07-21T15:30:00+00:00"];
export const RAWS = ['{"b":1,"a":"<&>\u2028","c":{"x" : [ 1 , 2 ]}}', '{"id":"\\u0069d","\\u0069d":"y"}', '{"a":"\\ud800x"}', '{"a":"\u00e9","\u00e9":null}', '{"a":1,"a":2}', '{"z":"\\/"}'];

/** The Go program: it prints Go's answer for each input. */
const GO_PROGRAM = [
  "package main",
  "",
  "import (",
  "\t\"bytes\"",
  "\t\"encoding/json\"",
  "\t\"errors\"",
  "\t\"fmt\"",
  "\t\"io\"",
  "\t\"os\"",
  "\t\"strconv\"",
  "\t\"strings\"",
  "\t\"time\"",
  ")",
  "",
  "type ConsolidationManifest struct {",
  "\tVersion  int                    `json:\"version\"`",
  "\tMappings []ConsolidationMapping `json:\"mappings\"`",
  "}",
  "type ConsolidationMapping struct {",
  "\tSourceID     string   `json:\"source_id\"`",
  "\tTargetID     string   `json:\"target_id\"`",
  "\tKind         string   `json:\"kind\"`",
  "\tDecidedAt    string   `json:\"decided_at\"`",
  "\tDecidedBy    string   `json:\"decided_by\"`",
  "\tReason       string   `json:\"reason\"`",
  "\tEvidenceRefs []string `json:\"evidence_refs\"`",
  "}",
  "type ResolutionIndex struct {",
  "\tVersion            int                 `json:\"version\"`",
  "\tCanonicalByID      map[string]string   `json:\"canonical_by_id\"`",
  "\tMembersByCanonical map[string][]string `json:\"members_by_canonical\"`",
  "}",
  "",
  "func decode(data []byte, v any) string {",
  "\td := json.NewDecoder(bytes.NewReader(data))",
  "\td.DisallowUnknownFields()",
  "\tif err := d.Decode(v); err != nil {",
  "\t\treturn \"first: \" + err.Error()",
  "\t}",
  "\tvar trailing any",
  "\tif err := d.Decode(&trailing); !errors.Is(err, io.EOF) {",
  "\t\tif err == nil {",
  "\t\t\treturn \"trailing: multiple\"",
  "\t\t}",
  "\t\treturn \"trailing: \" + err.Error()",
  "\t}",
  "\tb, _ := json.Marshal(v)",
  "\treturn \"ok \" + string(b)",
  "}",
  "",
  "func main() {",
  "\tvar in struct {",
  "\t\tUnmarshal []string `json:\"unmarshal\"`",
  "\t\tManifest  []string `json:\"manifest\"`",
  "\t\tIndex     []string `json:\"index\"`",
  "\t\tTimes     []string `json:\"times\"`",
  "\t\tRawMarshal []string `json:\"raw_marshal\"`",
  "\t\tSliceCap   []string `json:\"slice_cap\"`",
  "\t}",
  "\tdata, _ := io.ReadAll(os.Stdin)",
  "\tif err := json.Unmarshal(data, &in); err != nil {",
  "\t\tpanic(err)",
  "\t}",
  "\tout := map[string][]string{}",
  "\tfor _, s := range in.Unmarshal {",
  "\t\tvar m map[string]json.RawMessage",
  "\t\terr := json.Unmarshal([]byte(s), &m)",
  "\t\tr := \"ok\"",
  "\t\tif err != nil {",
  "\t\t\tr = err.Error()",
  "\t\t} else if m == nil {",
  "\t\t\tr = \"nil\"",
  "\t\t}",
  "\t\tout[\"unmarshal\"] = append(out[\"unmarshal\"], r)",
  "\t}",
  "\tfor _, s := range in.Manifest {",
  "\t\tvar m ConsolidationManifest",
  "\t\tout[\"manifest\"] = append(out[\"manifest\"], decode([]byte(s), &m))",
  "\t}",
  "\tfor _, s := range in.Index {",
  "\t\tvar m ResolutionIndex",
  "\t\tout[\"index\"] = append(out[\"index\"], decode([]byte(s), &m))",
  "\t}",
  "\tfor _, s := range in.Times {",
  "\t\tt, err := time.Parse(time.RFC3339, s)",
  "\t\tif err != nil {",
  "\t\t\tout[\"times\"] = append(out[\"times\"], \"error\")",
  "\t\t\tcontinue",
  "\t\t}",
  "\t\t_, off := t.Zone()",
  "\t\tout[\"times\"] = append(out[\"times\"], fmt.Sprint(off))",
  "\t}",
  "\tfor _, s := range in.RawMarshal {",
  "\t\tvar m map[string]json.RawMessage",
  "\t\tif err := json.Unmarshal([]byte(s), &m); err != nil {",
  "\t\t\tout[\"raw_marshal\"] = append(out[\"raw_marshal\"], \"error \"+err.Error())",
  "\t\t\tcontinue",
  "\t\t}",
  "\t\tb, err := json.Marshal(m)",
  "\t\tif err != nil {",
  "\t\t\tout[\"raw_marshal\"] = append(out[\"raw_marshal\"], \"error \"+err.Error())",
  "\t\t\tcontinue",
  "\t\t}",
  "\t\tout[\"raw_marshal\"] = append(out[\"raw_marshal\"], string(b))",
  "\t}",
  "\tfor _, s := range in.SliceCap {",
  "\t\tn, _ := strconv.Atoi(s)",
  "\t\tnulls := \"[\" + strings.Repeat(\"null,\", n-1) + \"null]\"",
  "\t\tvar a []string",
  "\t\tvar b []ConsolidationMapping",
  "\t\tvar c []int",
  "\t\tif json.Unmarshal([]byte(nulls), &a) != nil || json.Unmarshal([]byte(nulls), &b) != nil || json.Unmarshal([]byte(nulls), &c) != nil {",
  "\t\t\tpanic(s)",
  "\t\t}",
  "\t\tout[\"slice_cap\"] = append(out[\"slice_cap\"], fmt.Sprint(cap(a), \" \", cap(b), \" \", cap(c)))",
  "\t}",
  "\tenc := json.NewEncoder(os.Stdout)",
  "\tenc.SetEscapeHTML(false)",
  "\tenc.Encode(out)",
  "}",
  "",
].join("\n");

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const go = process.argv[2];
  if (go === undefined) {
    process.stderr.write("usage: node scripts/capture-entity-json-goldens.ts <go binary>\n");
    process.exit(2);
  }
  const dir = mkdtempSync(join(tmpdir(), "buildos-entity-json-"));
  try {
    writeFileSync(join(dir, "main.go"), GO_PROGRAM);
    writeFileSync(join(dir, "go.mod"), "module gojson\n\ngo 1.24\n");
    const env = { ...process.env, GOTOOLCHAIN: "local", GOFLAGS: "-mod=mod", CGO_ENABLED: "0" };
    const build = spawnSync(go, ["build", "-o", join(dir, "gojson"), "."], { cwd: dir, env, encoding: "utf8" });
    if (build.status !== 0) throw new Error(`go build failed: ${build.stderr}`);
    const version = spawnSync(go, ["version"], { encoding: "utf8" }).stdout.trim();
    const input = { unmarshal: SYNTAX, manifest: MANIFESTS, index: INDEXES, times: TIMES, raw_marshal: RAWS, slice_cap: SLICE_CAPS };
    const run = spawnSync(join(dir, "gojson"), { input: JSON.stringify(input), encoding: "utf8" });
    if (run.status !== 0) throw new Error(`capture failed: ${run.stderr}`);
    const output = JSON.parse(run.stdout) as Record<string, string[]>;
    const out = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "go-seed", "entity-json.json");
    writeFileSync(out, `${JSON.stringify({ source: "scripts/capture-entity-json-goldens.ts", goVersion: version, input, output }, null, 2)}\n`);
    process.stdout.write(`wrote ${out}\n`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
