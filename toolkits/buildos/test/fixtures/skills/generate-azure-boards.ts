// Builds the fixtures of `buildos export azure-boards` (W1 R7 P9 t1) in
// test/fixtures/skills/azure-boards/. Run it once after a change, then
// capture the goldens:
//
//   node test/fixtures/skills/generate-azure-boards.ts
//   node test/golden/skills/capture.ts --script azure-boards
//
// The two manifests and the two golden CSV files of the skill are copied
// from system/.os/skills/buildos-export-azure-boards/assets/ (invented
// content on the library book-lending topic); every other input is made here.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "azure-boards");
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "system", ".os", "skills", "buildos-export-azure-boards", "assets");
type J = Record<string, unknown>;

function write(rel: string, content: string | Buffer): void {
  const path = join(HERE, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

rmSync(HERE, { recursive: true, force: true });
const synthetic = readFileSync(join(ASSETS, "synthetic-manifest.json"));
const d365 = readFileSync(join(ASSETS, "adapters", "dynamics-365-ce-manifest.json"));
write("bases/project/backlog/synthetic-manifest.json", synthetic);
write("bases/project/backlog/d365-manifest.json", d365);
write("bases/project/backlog/synthetic-golden.csv", readFileSync(join(ASSETS, "synthetic-golden-example.csv")));
write("bases/project/backlog/d365-golden.csv", readFileSync(join(ASSETS, "adapters", "dynamics-365-ce-golden-example.csv")));

const syntheticJson = JSON.parse(synthetic.toString("utf8")) as J & { items: J[] };
const d365Json = JSON.parse(d365.toString("utf8")) as J & { items: J[] };

// ---------------------------------------------------------------- manifests made here

const trace = { work_directory: "docs/work/2026-01-12-w1-r1-holds", index_file: "docs/work/2026-01-12-w1-r1-holds/00-index.md", task_ids: ["t1", "t2"], labels: ["Holds"] };
const pbi = (title: string, extra: J = {}): J => ({
  work_item_type: "Product Backlog Item",
  level: 3,
  title,
  description: { use_case: ["A patron wants a held book kept for them."], outcomes: ["Keep a hold for seven days."], technical_details: ["Store the hold expiry date.", { text: "Notify the patron.", children: ["By e-mail", "By text message"] }] },
  acceptance_criteria: ["A hold expires after seven days.", "The patron gets a notice."],
  source_trace: trace,
  ...extra,
});
const epic: J = { work_item_type: "Epic", level: 1, title: "Holds & Notices <Phase 1>", summary: "Patrons place \"holds\" on books \u2014 caf\u00e9 edition.", source_trace: trace, tags: "Holds; Notices;Holds" };
const feature: J = { work_item_type: "Feature", level: 2, title: "Hold shelf", summary: "", source_trace: trace, effort: 5, iteration_path: "Library\\Sprint 1" };
const task: J = { work_item_type: "Task", level: 4, title: "Write the expiry job", source_trace: { phase_file: "docs/work/x/01-holds.md", stage: "Stage 1", source_prd_docs: ["docs/prd/04-holds.md", "docs/prd/05-notices.md"] } };
const holds = { profile: "target17-new", defaults: { iteration_path: "Library\\Backlog", tags: ["Library"] }, items: [epic, feature, pbi("Keep a hold seven days"), task] };

const manifests: Record<string, unknown> = {
  "holds.json": holds,
  "holds-update.json": { ...holds, profile: "update", items: [{ ...epic, id: 101, state: "Active", assigned_to: "Circulation Team" }, feature, pbi("Keep a hold seven days", { id: 103 }), { ...task, assigned_to: "Circulation Team" }] },
  "holds-assigned.json": { ...holds, items: [epic, feature, pbi("Keep a hold seven days"), { ...task, assigned_to: "Circulation Team" }] },
  "not-object.json": [holds],
  "items-empty.json": { items: [] },
  "items-too-many.json": { items: Array.from({ length: 1001 }, (_, i) => ({ ...task, title: `Task ${i + 1}` })) },
  "item-not-object.json": { items: ["Epic"] },
  "item-bad-level.json": { items: [{ ...epic, level: 7 }] },
  "item-wrong-type.json": { items: [{ ...epic, work_item_type: "Feature" }] },
  "item-no-title.json": { items: [{ ...epic, title: "   " }] },
  "pbi-no-description.json": { items: [epic, feature, { ...pbi("No description"), description: "text" }] },
  "pbi-empty-list.json": { items: [epic, feature, pbi("Empty item", { acceptance_criteria: ["  "] })] },
  "pbi-bad-children.json": { items: [epic, feature, pbi("Bad children", { acceptance_criteria: [{ text: "Parent", children: "child" }] })] },
  "pbi-bad-item.json": { items: [epic, feature, pbi("Bad item", { acceptance_criteria: [42] })] },
  "pbi-empty-object.json": { items: [epic, feature, pbi("Empty object", { acceptance_criteria: [{ text: "" }] })] },
  "no-trace.json": { items: [{ ...epic, source_trace: {} }] },
  "trace-not-object.json": { items: [{ ...epic, source_trace: ["x"] }] },
  "summary-not-string.json": { items: [{ ...epic, summary: 5 }] },
  "placeholder.json": { items: [{ ...epic, summary: "TODO: write this" }] },
  "orphan.json": { items: [pbi("Orphan item")] },
  "null.json": null,
  "d365-no-prefix.json": { ...d365Json, adapter_params: {} },
  "d365-new-prefix.json": { ...d365Json, adapter_params: { publisher_prefix: "new_" } },
  "d365-bad-prefix.json": { ...d365Json, adapter_params: { publisher_prefix: "9x" } },
  "d365-long-prefix.json": { ...d365Json, adapter_params: { publisher_prefix: "libraryx_" } },
  "unknown-adapter.json": { ...holds, adapter: "salesforce" },
};
for (const [name, value] of Object.entries(manifests)) write(`bases/project/backlog/${name}`, json(value));
write("bases/project/backlog/broken.json", '{"items": [\n');
write("bases/project/backlog/bom.json", `\ufeff${json(holds)}`);

// ---------------------------------------------------------------- CSV files made here

const HEADERS = ["ID", "Work Item Type", "Title 1", "Title 2", "Title 3", "Title 4", "State", "Effort", "Iteration Path", "Repro Steps", "Description", "Acceptance Criteria", "Design Notes", "Solution", "Solution Type", "Tags", "Assigned To"];
const field = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
const DESC = "<div><div><b>USE CASE</b></div><div><ul><li>A patron renews a loan.</li></ul></div><div><br></div><div><b>DESCRIPTION</b></div><div><ul><li>Renew twice.</li></ul></div><div><br></div><div><b>TECHNICAL DETAILS</b></div><div><ul><li>Count renewals.</li></ul></div></div>";
const AC = "<div><ul><li>A third renewal is refused.</li></ul></div>";
const DN = "<div><b>BUILD OS SOURCE</b></div><div><ul><li>Work directory: docs/work/renewals</li></ul></div>";
const csvRow = (values: Record<string, string>): string => HEADERS.map((h) => field(values[h] ?? "")).join(",");
const epicRow = { "Work Item Type": "Epic", "Title 1": "Renewals", "Design Notes": DN };
const featureRow = { "Work Item Type": "Feature", "Title 2": "Renewal rules", "Design Notes": DN };
const pbiRow = (extra: Record<string, string> = {}): Record<string, string> => ({ "Work Item Type": "Product Backlog Item", "Title 3": "Limit renewals", Description: DESC, "Acceptance Criteria": AC, "Design Notes": DN, ...extra });
const csv = (rows: Record<string, string>[], options: { bom?: boolean; eol?: string; headers?: string[] } = {}): string =>
  `${options.bom === false ? "" : "\ufeff"}${[(options.headers ?? HEADERS).map(field).join(","), ...rows.map(csvRow)].join(options.eol ?? "\r\n")}`;

const csvFiles: Record<string, string> = {
  "good.csv": csv([epicRow, featureRow, pbiRow()]),
  "good-lf.csv": csv([epicRow, featureRow, pbiRow()], { eol: "\n" }),
  "good-unicode.csv": csv([{ ...epicRow, "Title 1": "Caf\u00e9 renewals \u66f8 \u{1f4da}" }, featureRow, pbiRow()]),
  "no-bom.csv": csv([epicRow], { bom: false }),
  "empty.csv": "",
  "bom-only.csv": "\ufeff",
  "unterminated.csv": `\ufeff${HEADERS.join(",")}\r\n,Epic,"Renewals`,
  "headers-only.csv": csv([]),
  "headers-wrong.csv": csv([epicRow], { headers: ["Title", "Type"] }),
  "field-count.csv": `\ufeff${HEADERS.join(",")}\r\n,Epic,Renewals`,
  "two-titles.csv": csv([{ ...epicRow, "Title 2": "Also a feature" }]),
  "wrong-type.csv": csv([{ ...epicRow, "Work Item Type": "Feature" }, { ...featureRow, "Work Item Type": "" }]),
  "no-parent.csv": csv([featureRow, epicRow, { ...pbiRow(), "Title 3": "Orphan" }, { "Work Item Type": "Task", "Title 4": "Lonely task" }]),
  "id-in-new.csv": csv([{ ...epicRow, ID: "17", State: "Active", "Assigned To": "Someone" }]),
  "placeholders.csv": csv([{ ...epicRow, "Design Notes": `${DN} TBD` }, { ...featureRow, Description: "<div>{{fill in}}</div>" }, pbiRow({ "Acceptance Criteria": "<div><ul><li>- [ ] done</li></ul></div>" })]),
  "pbi-structure.csv": csv([epicRow, featureRow, pbiRow({ Description: "<div><b>DESCRIPTION</b><b>USE CASE</b><b>USE CASE</b></div>", "Acceptance Criteria": "<div>no list</div>", "Design Notes": "<div>none</div>" })]),
  "html-bad.csv": csv([{ ...epicRow, Description: "<div><span>x</span></div>" }, { ...featureRow, Description: "<div><b>x</div></b>" }, pbiRow({ Description: `${DESC}<div>`, "Design Notes": `${DN}<ul><li>x` })]),
  "too-many-rows.csv": csv([epicRow, featureRow, ...Array.from({ length: 1000 }, (_, i) => ({ "Work Item Type": "Task", "Title 4": `Task ${i + 1}`, "Design Notes": DN }))]),
  "update-profile.csv": csv([{ ...epicRow, ID: "101", State: "Active" }, featureRow, pbiRow({ ID: "103" })]),
  "new-profile.csv": csv([epicRow, featureRow, pbiRow()], { headers: HEADERS.filter((h) => !["ID", "State", "Assigned To"].includes(h)) }).replace(/^(.*)$/gm, (line) => line),
};
// The new-profile file needs rows without the three columns.
csvFiles["new-profile.csv"] = `\ufeff${[HEADERS.filter((h) => !["ID", "State", "Assigned To"].includes(h)).join(","), ...[epicRow, featureRow, pbiRow()].map((r) => HEADERS.filter((h) => !["ID", "State", "Assigned To"].includes(h)).map((h) => field(r[h as keyof typeof r] ?? "")).join(","))].join("\r\n")}`;

// Dynamics 365 CE adapter failures, built from the skill's own golden CSV.
const d365Golden = readFileSync(join(ASSETS, "adapters", "dynamics-365-ce-golden-example.csv"), "utf8");
csvFiles["d365-wrong-prefix.csv"] = d365Golden.replaceAll("Publisher Prefix: ex_", "Publisher Prefix: lib_");
csvFiles["d365-two-prefixes.csv"] = d365Golden.replace("Publisher Prefix: ex_", "Publisher Prefix: lib_");
const d365Pbi = (title: string, technical: string[], criteria: string[]): Record<string, string> => ({
  "Work Item Type": "Product Backlog Item",
  "Title 3": title,
  Description: `<div><div><b>USE CASE</b></div><div><ul><li>Staff record a fine.</li></ul></div><div><br></div><div><b>DESCRIPTION</b></div><div><ul><li>Fines are stored.</li></ul></div><div><br></div><div><b>TECHNICAL DETAILS</b></div><div><ul>${technical.map((t) => `<li>${t}</li>`).join("")}</ul></div></div>`,
  "Acceptance Criteria": `<div><ul>${criteria.map((c) => `<li>${c}</li>`).join("")}</ul></div>`,
  "Design Notes": DN,
});
csvFiles["d365-rules.csv"] = csv([
  { ...epicRow, "Title 1": "Fines (CFG) - Epic with a code" },
  { ...featureRow, "Title 2": "Fine setup", Description: "<div>Uses new_fine and **bold** and __under__ text.</div>" },
  d365Pbi("Fine table", ["Publisher Prefix: ex_", "Create columns: amount"], ["Columns exist."]),
  d365Pbi("Fine table (CFG) - Create the table", ["Publisher Prefix: ex_", "Create columns: amount", "Schema: ex_Fine", "Logical Name: ex_fines", "Schema: lib_Bad", "Logical Name: Ex_Upper", "Schema: ex_/path/to/item"], ["The table exists.", "It is in the solution."]),
  d365Pbi("Fine plug-in (DEV) - Compute the fine", ["Publisher Prefix: ex_", "if the book is late then charge", "Result is true or null"], ["The fine is right.", "Deployed to the test environment."]),
  d365Pbi("Fine flow (INT) - Send a notice", ["Prefix missing here"], ["A notice is sent."]),
  d365Pbi("Fine data (DATA) - Load old fines", ["Publisher Prefix: lib_"], ["Old fines load.", "Counts match."]),
]);
csvFiles["d365-no-pbi.csv"] = csv([epicRow, featureRow]);
for (const [name, text] of Object.entries(csvFiles)) write(`bases/project/csv/${name}`, text);

// ---------------------------------------------------------------- cases

interface Step {
  run?: string[];
}
const cases: { id: string; description: string; base: string; steps: Step[] }[] = [];
const run = (...args: string[]): Step => ({ run: args });
const add = (id: string, description: string, steps: Step[]): void => {
  cases.push({ id, description, base: "project", steps });
};

add("help", "help, --help, -h, and no command print the usage", [run(), run("help"), run("--help"), run("-h")]);
add("adapters", "the registered adapters", [run("adapters")]);
add("templates", "a template for each profile, and the refusals", [
  run("template", "--output", "out/target17.csv"),
  run("template", "--output", "out/new.csv", "--profile", "new"),
  run("template", "--output", "out/update.csv", "--profile", "update"),
  run("template", "--output", "out/x.csv", "--profile", "auto"),
  run("template"),
  run("template", "--profile", "new"),
]);
add("emit-synthetic", "the skill's synthetic manifest: emit, then validate the result; it equals the skill's golden CSV", [
  run("emit", "--input", "backlog/synthetic-manifest.json", "--output", "export/synthetic.csv"),
  run("validate", "--input", "export/synthetic.csv"),
  run("validate", "--input", "backlog/synthetic-golden.csv"),
  run("validate", "--input", "export/synthetic.csv", "--profile", "new"),
]);
add("emit-holds-profiles", "an invented manifest in each profile, with escaping, tags, defaults, and nested lists", [
  run("emit", "--input", "backlog/holds.json", "--output", "export/holds.csv"),
  run("emit", "--input", "backlog/holds.json", "--output", "export/holds-new.csv", "--profile", "new"),
  run("emit", "--input", "backlog/holds-update.json", "--output", "export/deep/nested/holds-update.csv"),
  run("validate", "--input", "export/holds-new.csv", "--profile", "auto"),
  run("validate", "--input", "export/deep/nested/holds-update.csv", "--profile", "update"),
  run("emit", "--input", "backlog/bom.json", "--output", "export/bom.csv"),
  run("emit", "--input", "backlog/holds-assigned.json", "--output", "export/assigned.csv"),
]);
add("emit-d365", "the Dynamics 365 CE manifest: emit with its adapter, validate with the adapter in each way", [
  run("emit", "--input", "backlog/d365-manifest.json", "--output", "export/d365.csv"),
  run("validate", "--input", "export/d365.csv", "--adapter", "dynamics-365-ce"),
  run("validate", "--input", "backlog/d365-golden.csv", "--adapter", "dynamics-365-ce", "--publisher-prefix", "ex_"),
  run("validate", "--input", "backlog/d365-golden.csv", "--adapter", "dynamics-365-ce", "--adapter-params", '{"publisher_prefix": "ex_"}'),
  run("validate", "--input", "backlog/d365-golden.csv"),
]);
add("adapter-params-errors", "adapter parameters that are refused", [
  run("validate", "--input", "backlog/d365-golden.csv", "--adapter", "dynamics-365-ce", "--adapter-params", "{prefix}"),
  run("validate", "--input", "backlog/d365-golden.csv", "--adapter", "dynamics-365-ce", "--adapter-params", "[1]"),
  run("validate", "--input", "backlog/d365-golden.csv", "--adapter", "dynamics-365-ce", "--publisher-prefix", "new_"),
  run("validate", "--input", "backlog/d365-golden.csv", "--adapter", "salesforce"),
  run("emit", "--input", "backlog/d365-no-prefix.json", "--output", "export/x.csv"),
  run("emit", "--input", "backlog/d365-new-prefix.json", "--output", "export/x.csv"),
  run("emit", "--input", "backlog/d365-bad-prefix.json", "--output", "export/x.csv"),
  run("emit", "--input", "backlog/d365-long-prefix.json", "--output", "export/long.csv"),
  run("emit", "--input", "backlog/unknown-adapter.json", "--output", "export/x.csv"),
  run("emit", "--input", "backlog/holds.json", "--output", "export/x.csv", "--adapter", "dynamics-365-ce", "--publisher-prefix", "ex_"),
]);
add("adapter-rules", "Dynamics 365 CE rules: titles, prefixes, components, criteria, conditions, naming, and warnings", [
  run("validate", "--input", "csv/d365-rules.csv", "--adapter", "dynamics-365-ce", "--publisher-prefix", "ex_"),
  run("validate", "--input", "csv/d365-wrong-prefix.csv", "--adapter", "dynamics-365-ce"),
  run("validate", "--input", "csv/d365-two-prefixes.csv", "--adapter", "dynamics-365-ce"),
  run("validate", "--input", "csv/d365-no-pbi.csv", "--adapter", "dynamics-365-ce", "--publisher-prefix", "ex_"),
]);
add("manifest-errors", "each manifest check, a file that is not JSON, a missing file, and a null manifest", [
  ...["not-object", "items-empty", "items-too-many", "item-not-object", "item-bad-level", "item-wrong-type", "item-no-title", "pbi-no-description", "pbi-empty-list", "pbi-bad-children", "pbi-bad-item", "pbi-empty-object", "no-trace", "trace-not-object", "summary-not-string", "placeholder", "orphan", "broken", "null"].map((n) => run("emit", "--input", `backlog/${n}.json`, "--output", "export/x.csv")),
  run("emit", "--input", "backlog/missing.json", "--output", "export/x.csv"),
  run("emit", "--input", "backlog", "--output", "export/x.csv"),
]);
add("csv-checks", "each CSV check", [
  ...Object.keys(csvFiles)
    .filter((n) => !n.startsWith("d365-"))
    .map((n) => run("validate", "--input", `csv/${n}`)),
  run("validate", "--input", "csv/new-profile.csv", "--profile", "new"),
  run("validate", "--input", "csv/update-profile.csv", "--profile", "update"),
  run("validate", "--input", "csv/good.csv", "--profile", "update"),
  run("validate", "--input", "csv/missing.csv"),
]);
add("arguments", "argument errors", [
  run("bogus"),
  run("emit", "input.json"),
  run("emit", "--input"),
  run("emit", "--input", "--output"),
  run("emit", "--output", "export/x.csv"),
  run("emit", "--input", "backlog/holds.json"),
  run("validate"),
  run("validate", "--input", "csv/good.csv", "--profile", "sideways"),
  run("emit", "--input", "backlog/holds.json", "--output", "export/x.csv", "--profile", "sideways"),
  run("emit", "--input", "backlog/holds.json", "--output", "export/x.csv", "--unknown", "kept"),
]);

write("cases.json", json({ $comment: "Cases of buildos export azure-boards (W1 R7 P9 t1), generated by generate-azure-boards.ts. Each case copies bases/<base>/ into a fresh project folder and runs its steps in order.", cases }));
write(".gitattributes", "# Fixture bytes stay as they are on every OS (CRLF, byte order marks).\n* -text whitespace=-blank-at-eol,-blank-at-eof,-space-before-tab,cr-at-eol\n");
process.stdout.write(`wrote ${cases.length} cases\n`);
