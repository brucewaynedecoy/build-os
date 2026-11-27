// Builds the fixtures of `buildos fitgap` (W1 R7 P9 t1) in
// test/fixtures/skills/fitgap/. Run it once after a change, then capture the
// goldens with a Python that has openpyxl:
//
//   node test/fixtures/skills/generate-fitgap.ts
//   node test/golden/skills/capture.ts --script fitgap --python <venv>/bin/python
//
// Every file is invented, on the one neutral topic of the skills: a community
// library's book-lending system. The current circulation system (CIRC) is
// scored against a candidate library platform (LIB).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "fitgap");
const PALETTE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "system", ".os", "skills", "fit-gap-analysis", "config", "owner-colors.json");
type J = Record<string, unknown>;

function write(rel: string, content: string | Buffer): void {
  const path = join(HERE, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

rmSync(HERE, { recursive: true, force: true });
const B = "bases/library";

// ---------------------------------------------------------------- models

const req = (id: string, text: string, extra: J = {}): J => ({ id, kind: "function", status: "built", maturity: "proven", text, option_values: null, ...extra });
const cap = (id: string, name: string, layer: string, maturity: string, requirements: J[], extra: J = {}): J => ({
  id,
  parent_id: null,
  name,
  layer_id: layer,
  doc_ref: `D-${id.slice(-2)}`,
  type: "process",
  status: maturity === "planned" ? "planned" : "built",
  maturity,
  summary: `${name} at the circulation desk.`,
  requirements,
  ...extra,
});

const circ = {
  meta: { code: "CIRC", name: "Current Circulation System", title: "CIRC capability model" },
  layers: [
    { id: "L1", code: "CORE", name: "Circulation" },
    { id: "L2", code: "PAT", name: "Patrons" },
    { id: "L3", code: "CAT", name: "Catalogue" },
  ],
  capabilities: [
    cap("CIRC-COR-01", "Check out books", "L1", "proven", [req("CIRC-COR-01-R01", "Scan a patron card."), req("CIRC-COR-01-R02", "Scan the book barcode.")]),
    cap("CIRC-COR-02", "Check in books", "L1", "proven", [req("CIRC-COR-02-R01", "Return a book at any branch."), req("CIRC-COR-02-R02", "Print a return receipt.", { option_values: "paper | e-mail" })]),
    cap("CIRC-COR-03", "Renew loans", "L1", "available", [req("CIRC-COR-03-R01", "Renew a loan twice."), req("CIRC-COR-03-R02", "Block a renewal when the book is held.")]),
    cap("CIRC-COR-04", "Holds queue", "L1", "proven", [req("CIRC-COR-04-R01", "Queue holds in order."), req("CIRC-COR-04-R02", "Skip a patron who is away.")]),
    cap("CIRC-PAT-01", "Register patrons", "L2", "proven", [req("CIRC-PAT-01-R01", "Record a patron's name and address."), req("CIRC-PAT-01-R02", "Issue a card number."), req("CIRC-PAT-01-R03", "Record a guardian for a child.")]),
    cap("CIRC-PAT-02", "Patron notices", "L2", "partial", [req("CIRC-PAT-02-R01", "Send an overdue notice.")]),
    cap("CIRC-PAT-03", "Patron fines", "L2", "available", [req("CIRC-PAT-03-R01", "Charge ten cents a day."), req("CIRC-PAT-03-R02", "Cap a fine at the book's price.")], { name: "Patron fines \u2014 caf\u00e9 desk" }),
    cap("CIRC-CAT-01", "Catalogue search", "L3", "available", []),
    cap("CIRC-CAT-02", "Shelf labels", "L3", "planned", [req("CIRC-CAT-02-R01", "Print spine labels.")]),
  ],
};
const lcap = (id: string, name: string, layer: string, status: string, maturity: string, n = 1): J => ({
  id,
  parent_id: null,
  name,
  layer_id: layer,
  doc_ref: null,
  type: "feature",
  status,
  maturity,
  summary: `${name} in the candidate platform.`,
  requirements: Array.from({ length: n }, (_, i) => ({ id: `${id}-R0${i + 1}`, kind: "function", status, maturity, text: `${name}, part ${i + 1}.`, option_values: i === 0 ? null : ["a", "b"] })),
});
const lib = {
  meta: { code: "LIB", name: "Candidate Library Platform" },
  layers: [
    { id: "L1", code: "CORE", name: "Circulation" },
    { id: "L2", code: "PAT", name: "Patrons" },
    { id: "L3", code: "CAT", name: "Catalogue" },
    { id: "L5", code: "RPT", name: "Reporting" },
  ],
  capabilities: [
    lcap("LIB-COR-01", "Circulation desk", "L1", "ga", "available", 2),
    lcap("LIB-COR-02", "Self check-in kiosk", "L1", "ga", "available"),
    lcap("LIB-COR-03", "Renewal rules", "L1", "ga", "available"),
    lcap("LIB-PAT-01", "Patron accounts", "L2", "ga", "available", 2),
    lcap("LIB-PAT-02", "Notice centre", "L2", "preview", "planned"),
    lcap("LIB-CAT-01", "Discovery search \u{1f50e}", "L3", "ga", "available"),
    lcap("LIB-RPT-01", "Lending reports", "L5", "ga", "available"),
    lcap("LIB-RPT-02", "Dashboards", "L5", "roadmap", "deferred", 0),
  ],
};
write(`${B}/deliver/CIRC/circ-capability-model.json`, json(circ));
write(`${B}/deliver/LIB/lib-capability-model.json`, json(lib));

// The same baseline as two CSV files (an older capability-matrix run), with a byte order mark, quoted commas and line breaks.
const csvLine = (values: string[]): string => values.map((v) => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)).join(",");
const capCsv = [
  ["capability_id", "parent_id", "name", "layer_id", "layer_code", "layer_name", "doc_ref", "capability_type", "status", "maturity", "summary"],
  ...circ.capabilities.map((c) => [String(c["id"]), "", String(c["name"]), String(c["layer_id"]), ...(() => {
    const l = circ.layers.find((x) => x.id === c["layer_id"])!;
    return [l.code, l.name];
  })(), String(c["doc_ref"]), "process", String(c["status"]), c["id"] === "CIRC-CAT-02" ? "" : String(c["maturity"]), String(c["summary"])]),
];
const reqCsv = [
  ["requirement_id", "capability_id", "requirement_kind", "status", "maturity", "text", "option_values"],
  ...circ.capabilities.flatMap((c) => (c["requirements"] as J[]).map((r) => [String(r["id"]), String(c["id"]), "function", "built", "proven", String(r["text"]), r["option_values"] === null ? "" : String(r["option_values"])])),
];
reqCsv[3]![5] = "Return a book, at any branch,\nthe same day.";
write(`${B}/deliver/CIRC/circ-capabilities.csv`, `\ufeff${capCsv.map(csvLine).join("\r\n")}\r\n`);
write(`${B}/deliver/CIRC/circ-requirements.csv`, `\ufeff${reqCsv.map(csvLine).join("\r\n")}\r\n`);
// W1 R7 P9 review round 1 (P9-R1-14): ragged rows, as a spreadsheet export can write them. Each capability data
// row ends in a surplus empty field (csv.DictReader keeps it aside); each requirement row lacks option_values,
// and one also lacks its text (DictReader gives None for a missing field).
write(`${B}/deliver/CIRC/circ-capabilities-ragged.csv`, `${capCsv.map((row, i) => `${csvLine(row)}${i === 0 ? "" : ","}`).join("\r\n")}\r\n`);
write(`${B}/deliver/CIRC/circ-requirements-ragged.csv`, `${reqCsv.map((row, i) => csvLine(i === 0 ? row : i === 2 ? row.slice(0, 5) : row.slice(0, 6))).join("\r\n")}\r\n`);

// ---------------------------------------------------------------- frame

const owners = ["Library Staff", "Platform Vendor", "Volunteer Team"];
const frame: J = {
  title: "Current Circulation System to Candidate Library Platform",
  mode: "replacement",
  baseline: { model: "../deliver/CIRC/circ-capability-model.json" },
  target: { model: "../deliver/LIB/lib-capability-model.json" },
  objectives: [
    { id: "OBJ-01", name: "Keep circulation desk operations running", weight: "must", rank: 1, statement: "Staff can check out, check in, renew, and hold books with no loss of function.", measure: "No built circulation capability is lost", source: "docs/charter.md, Goals" },
    { id: "OBJ-02", name: "Serve patrons on their own", weight: "should", rank: 2, statement: "Patrons register, get notices, and pay fines without staff help.", measure: "Half of renewals are self-service", source: "docs/charter.md, Goals" },
    { id: "OBJ-03", name: "Find books faster", weight: "could", statement: "Patrons find a book in the catalogue in under a minute.", measure: "", source: "docs/survey.md" },
  ],
  objectives_confirmed_by: "Library Director",
  tracks: [
    { id: "T1", name: "Go-live", order: 1, timing: "Spring", description: "What the desk needs on day one." },
    { id: "T2", name: "After go-live", order: 2, description: "Improvements once the desk runs." },
  ],
  owners,
  owner_roles: { "Library Staff": "Runs the circulation desk and decides policy.", "Platform Vendor": "Configures and builds the platform." },
  scoring: {},
};
write(`${B}/analysis/frame.json`, json(frame));
const variant = (name: string, changes: J, remove: string[] = []): void => {
  const f: J = { ...frame, ...changes };
  for (const k of remove) delete f[k];
  write(`${B}/analysis/${name}`, json(f));
};
variant("frame-no-plan.json", {}, ["tracks", "owners", "owner_roles"]);
variant("frame-colors.json", { owner_colors: { "Platform Vendor": { fill: "fce4d6", font: "833C0B" } } });
variant("frame-unconfirmed.json", { objectives_confirmed_by: "" });
variant("frame-no-objectives.json", { objectives: [] }, ["objectives_confirmed_by"]);
variant("frame-scoring.json", { title: "Scoring overrides", mode: "selection", scoring: { mark_points: { partly: 45.5, configured: 85 }, objective_factor: { should: 0.65 }, maturity_factor: { available: 0.75 } } });
variant("frame-unknown-scoring.json", { scoring: { weights: { must: 1 } } });
variant("frame-no-target.json", {}, ["target"]);
variant("frame-bad.json", {
  mode: "migration",
  target: { model: "../deliver/CIRC/circ-capability-model.json" },
  objectives: [
    { id: "OBJ-1", name: "", weight: "nice", statement: "x", rank: "first" },
    { id: "OBJ-01", name: "A", weight: "must", statement: "", measure: "  " },
    { id: "OBJ-01", name: "B", weight: "should", statement: "y" },
    { name: "No id", weight: "could", statement: "z" },
  ],
  tracks: [{ id: "T1", name: "Go-live", order: "first" }, { id: "T1" }, { name: "No id", order: 3 }],
  owners: ["Library Staff"],
  owner_colors: { "Library Staff": { fill: "zzzzzz", font: "000000" }, Stranger: { fill: "FFFFFF", font: "000000" } },
  scoring: { mark_points: { met: 120 }, objective_factor: { none: -0.1 }, maturity_factor: { deferred: 2 } },
  objectives_confirmed_by: "",
});
variant("frame-owner-colors-shape.json", { owner_colors: ["Library Staff"] });
variant("frame-tracks-no-owners.json", {}, ["owners", "owner_roles"]);
variant("frame-csv.json", {
  baseline: { capabilities_csv: "../deliver/CIRC/circ-capabilities.csv", requirements_csv: "../deliver/CIRC/circ-requirements.csv", code: "CIRC", name: "Current Circulation System", maturity_map: { planned: "planned", built: "proven" } },
});
variant("frame-csv-ragged.json", {
  baseline: { capabilities_csv: "../deliver/CIRC/circ-capabilities-ragged.csv", requirements_csv: "../deliver/CIRC/circ-requirements-ragged.csv", code: "CIRC", name: "Current Circulation System", maturity_map: { planned: "planned", built: "proven" } },
});
variant("frame-csv-no-map.json", { baseline: { capabilities_csv: "../deliver/CIRC/circ-capabilities.csv", requirements_csv: "../deliver/CIRC/circ-requirements.csv", code: "CIRC", name: "Current Circulation System" } });
variant("frame-csv-incomplete.json", { baseline: { capabilities_csv: "../deliver/CIRC/circ-capabilities.csv", code: "CIRC" } });
variant("frame-prior.json", { prior_fit_gap: "../deliver/prior/circ-lib-fit-gap.json" });
variant("frame-prior-csv.json", { prior_fit_gap: "../deliver/prior/circ-lib-fit-gap.csv" });
variant("frame-missing-model.json", { baseline: { model: "../deliver/CIRC/missing-model.json" } });
variant("frame-bad-model.json", { target: { model: "../deliver/LIB/broken-model.json" } });
variant("frame-layer-unknown.json", { target: { model: "../deliver/LIB/layer-unknown-model.json" } });
variant("frame-duplicate-caps.json", { target: { model: "../deliver/LIB/duplicate-model.json" } });
variant("frame-bad-maturity.json", { target: { model: "../deliver/LIB/bad-maturity-model.json" } });
variant("frame-no-code.json", { target: { model: "../deliver/LIB/no-code-model.json" } });
variant("frame-small-target.json", { target: { model: "../deliver/LIB/small-model.json" } });
write(`${B}/analysis/frame-not-json.json`, '{"title": "x",\n');
write(`${B}/deliver/LIB/broken-model.json`, '{"meta": {"code": "LIB"}, "layers": [\n');
write(`${B}/deliver/LIB/layer-unknown-model.json`, json({ ...lib, capabilities: [{ ...(lib.capabilities[0] as J), layer_id: "L9" }] }));
write(`${B}/deliver/LIB/duplicate-model.json`, json({ ...lib, capabilities: [lib.capabilities[0], lib.capabilities[0]] }));
write(`${B}/deliver/LIB/bad-maturity-model.json`, json({ ...lib, capabilities: [{ ...(lib.capabilities[0] as J), maturity: "ripe" }] }));
write(`${B}/deliver/LIB/small-model.json`, json({ ...lib, capabilities: lib.capabilities.slice(0, 3) }));
write(`${B}/deliver/LIB/no-code-model.json`, json({ ...lib, meta: { name: "Nameless" } }));
write(`${B}/deliver/prior/circ-lib-fit-gap.json`, json({ baseline_to_target: [{ baseline_capability_id: "CIRC-COR-01", verdict: "native", evidence: "Prior run.", gap_detail: "", target_capability_ids: "LIB-COR-01 | LIB-COR-02" }, { circ_capability_id: "CIRC-PAT-02", verdict: "preview_gap", lib_capability_ids: ["LIB-PAT-02"] }, { baseline_capability_id: "CIRC-GONE-01", verdict: "gap" }] }));
write(`${B}/deliver/prior/circ-lib-fit-gap.csv`, "\ufeffbaseline_capability_id,verdict,evidence,gap_detail,target_capability_ids\r\nCIRC-COR-03,partial,\"Prior, with a comma.\",Renewal block missing.,LIB-COR-03\r\n");
write(`${B}/.os/skills/fit-gap-analysis/config/owner-colors.json`, readFileSync(PALETTE));

// ---------------------------------------------------------------- scored rows, target-only rows, findings, to-dos

const evidence = (what: string): string => `${what} The candidate platform documents this in its circulation guide, and the desk staff confirmed the steps in a walk-through.`;
const mark = (rid: string, m: string, targets: string[] | string, note = ""): J => ({ requirement_id: rid, mark: m, target_capability_ids: targets, note });
const scored = (bid: string, marks: J[], extra: J = {}): J => ({
  baseline_capability_id: bid,
  objective_ids: [],
  confidence: "high",
  effort: "low",
  marks,
  evidence: evidence(`Rows for ${bid}.`),
  gap_detail: "",
  migration_note: "Configure the platform and train the desk staff.",
  track: "T1",
  owners: ["Library Staff"],
  ...extra,
});
const pkg1 = [
  scored("CIRC-COR-01", [mark("CIRC-COR-01-R01", "met", ["LIB-COR-01"]), mark("CIRC-COR-01-R02", "met", "LIB-COR-01")], { objective_ids: "OBJ-01" }),
  scored("CIRC-COR-02", [mark("CIRC-COR-02-R02", "configured", ["LIB-COR-01"], "Set the receipt template in the desk settings."), mark("CIRC-COR-02-R01", "met", ["LIB-COR-02"])], { objective_ids: ["OBJ-01"], owners: "Library Staff | Platform Vendor", gap_detail: "CIRC-COR-02-R02: the receipt needs a template." }),
  scored("CIRC-COR-03", [mark("CIRC-COR-03-R01", "partly", ["LIB-COR-03"], "Renewals are counted per patron, not per loan."), mark("CIRC-COR-03-R02", "not_met", [], "Searched 'renewal block' and 'hold check'; no counterpart.")], { objective_ids: ["OBJ-01"], effort: "high", confidence: "medium", gap_detail: "CIRC-COR-03-R02: no block on renewing a held book.", owners: ["Platform Vendor"] }),
  scored("CIRC-COR-04", [mark("CIRC-COR-04-R01", "not_met", "", "Searched 'holds queue' in the guide; nothing."), mark("CIRC-COR-04-R02", "not_met", [], "No away flag for a patron anywhere.")], { objective_ids: ["OBJ-01"], effort: "unknown", confidence: "low", gap_detail: "No holds queue at all.", owners: ["Library Staff", "Volunteer Team"] }),
];
const pkg2 = [
  scored("CIRC-PAT-01", [mark("CIRC-PAT-01-R01", "met", ["LIB-PAT-01"]), mark("CIRC-PAT-01-R02", "configured", ["LIB-PAT-01"], "Card number format set in account rules."), mark("CIRC-PAT-01-R03", "unreleased", ["LIB-PAT-02"], "Guardians are on the roadmap for the next release.")], { objective_ids: ["OBJ-02"], gap_detail: "Guardian link waits for the next release.", track: "T2", owners: ["Platform Vendor"] }),
  scored("CIRC-PAT-02", [mark("CIRC-PAT-02-R01", "unreleased", ["LIB-PAT-02"], "Notice centre is in preview only.")], { objective_ids: ["OBJ-02"], gap_detail: "Notices wait for general availability.", track: "T2", owners: ["Platform Vendor"], confidence: "low" }),
  scored("CIRC-PAT-03", [mark("CIRC-PAT-03-R01", "met", ["LIB-PAT-01"]), mark("CIRC-PAT-03-R02", "unreleased", [], "The fine cap is named in the roadmap only.")], { objective_ids: ["OBJ-02", "OBJ-03"], gap_detail: "No fine cap yet.", track: "T2", owners: ["Volunteer Team"] }),
  scored("CIRC-CAT-01", [mark("CIRC-CAT-01-WHOLE", "met", ["LIB-CAT-01"])], { objective_ids: ["OBJ-03"], track: "T2" }),
  scored("CIRC-CAT-02", [mark("CIRC-CAT-02-R01", "descoped", [], "The library decided to stop printing spine labels.")], { track: "T2", effort: "none" }),
];
write(`${B}/analysis/scored/pkg-01.json`, json(pkg1));
write(`${B}/analysis/scored/pkg-02.json`, json(pkg2));
const only = [
  { target_capability_id: "LIB-RPT-01", objective_ids: ["OBJ-02"], confidence: "high", effort: "low", evidence: "Lending reports count loans by branch and by month, from the platform guide.", opportunity: "Replace the monthly spreadsheet." },
  { target_capability_id: "LIB-RPT-02", objective_ids: "", confidence: "medium", effort: "medium", evidence: "Dashboards are on the roadmap with no date; the guide names them once.", opportunity: "Not worth phase one." },
];
write(`${B}/analysis/only.json`, json(only));
write(`${B}/analysis/findings.json`, json({ headline: ["7 of 9 circulation capabilities carry over.", "The holds queue is a live loss (fit 0).", "Notices wait for the next release.", "  "], layers: [{ layer_code: "CORE", text: "Desk work carries over except holds." }, { layer_code: "PAT", text: "Patron self-service waits for notices." }, { layer_code: "CAT", text: "Search is better in the candidate." }], opportunities: ["Lending reports replace a spreadsheet."], open_questions: ["When is the notice centre generally available (LIB-PAT-02)?"] }));
const todos = [
  { id: "TD-01", track: "T1", sequence: 1, owner: "Library Staff", support: ["Platform Vendor"], type: "decision", title: "Decide the holds approach", detail: "Choose between a custom holds queue and a manual list for day one.", capability_ids: ["CIRC-COR-04"], objective_ids: ["OBJ-01"], depends_on: [] },
  { id: "TD-02", track: "T1", sequence: 2, owner: "Platform Vendor", support: "", type: "vendor_question", title: "Confirm the notice centre date", detail: "Ask the vendor for the general availability date of the notice centre.", capability_ids: "CIRC-PAT-02 | CIRC-PAT-01", objective_ids: ["OBJ-02"], depends_on: "TD-01" },
  { id: "TD-03", track: "T2", sequence: 1, owner: "Volunteer Team", support: [], type: "build", title: "Build the fine cap report", detail: "Build a weekly report that flags fines above the book price.", capability_ids: ["CIRC-PAT-03"], objective_ids: [], depends_on: [] },
  { id: "TD-04", track: "T2", owner: "Platform Vendor", support: ["Library Staff"], type: "configure", title: "Configure renewal rules", detail: "Set two renewals per loan in the renewal rules profile.", capability_ids: ["CIRC-COR-03"], objective_ids: ["OBJ-01"], depends_on: ["TD-01"] },
];
write(`${B}/analysis/todos.json`, json(todos));

// Problem inputs for merge.
const badRows = [
  scored("CIRC-NOPE-01", []),
  { ...pkg1[0], confidence: "certain", effort: "huge", objective_ids: ["OBJ-09"], track: "T9", owners: [] },
  pkg1[0],
  scored("CIRC-COR-02", [mark("CIRC-COR-02-R01", "met", []), mark("CIRC-COR-02-R01", "met", ["LIB-XXX-01"]), mark("CIRC-COR-02-R09", "configured", ["LIB-COR-01"], "short"), mark("CIRC-COR-02-R01", "kinda", [])], { evidence: "Too short.", migration_note: " ", owners: ["Stranger"] }),
  scored("CIRC-COR-03", [mark("CIRC-COR-03-R01", "not_met", ["LIB-COR-03"], "Nothing in the guide for renewals at all."), mark("CIRC-COR-03-R02", "descoped", ["LIB-COR-03"], "Decided to drop the renewal block.")]),
];
write(`${B}/analysis/bad/rows.json`, json(badRows));
write(`${B}/analysis/bad/not-array.json`, json({ rows: [] }));
write(`${B}/analysis/bad/many.json`, json(Array.from({ length: 70 }, (_, i) => scored(`CIRC-ZZZ-${String(i).padStart(2, "0")}`, []))));
write(`${B}/analysis/bad/gap-detail.json`, json([...pkg1.slice(0, 2), { ...pkg1[2], gap_detail: "" }, pkg1[3]]));
write(`${B}/analysis/bad/only.json`, json([{ target_capability_id: "LIB-NOPE" }, only[0], only[0], { target_capability_id: "LIB-COR-01", objective_ids: ["OBJ-77"], confidence: "sure", effort: "lots", evidence: "short", opportunity: "" }]));
write(`${B}/analysis/bad/findings.json`, json({ headline: ["Only one."], layers: [{ layer_code: "CORE", text: "x" }, { layer_code: "PAT", text: "" }], opportunities: "none", open_questions: {} }));
write(`${B}/analysis/bad/todos.json`, json([{ id: "TD-1", track: "T9", owner: "Stranger", support: ["Nobody"], type: "wish", title: "", detail: "short", capability_ids: ["CIRC-NOPE"], objective_ids: ["OBJ-77"], depends_on: ["TD-99"] }, { ...todos[0] }, { ...todos[0] }, { title: "No id", detail: "A to-do with no id at all, long enough.", owner: "Library Staff", track: "T1", type: "test" }]));

// ---------------------------------------------------------------- cases

interface Step {
  run?: string[];
  write?: string;
  from?: string;
}
const cases: { id: string; description: string; base: string; palette?: boolean; remove?: string[]; steps: Step[] }[] = [];
const run = (...args: string[]): Step => ({ run: args });
const add = (id: string, description: string, steps: Step[], options: { palette?: boolean } = {}): void => {
  cases.push({ id, description, base: "library", ...(options.palette === false ? { palette: false, remove: [".os/skills/fit-gap-analysis/config/owner-colors.json"] } : {}), steps });
};
const ROWS = ["--rows", "analysis/scored/*.json"];
const FINAL = ["--only", "analysis/only.json", "--findings", "analysis/findings.json", "--todos", "analysis/todos.json"];
const OUT = ["--out", "deliver/fit-gap"];
const MERGED = "deliver/fit-gap/circ-lib-fit-gap-analysis.json";

add("frame-ok", "frame: a valid frame with tracks, owners, and a layer the target lacks", [run("frame", "--frame", "analysis/frame.json")]);
add("frame-variants", "frame: no objectives, scoring overrides, CSV systems, prior fit-gap files, colors, and the checks that fail", [
  run("frame", "--frame", "analysis/frame-no-objectives.json"),
  run("frame", "--frame", "analysis/frame-scoring.json"),
  run("frame", "--frame", "analysis/frame-csv.json"),
  run("frame", "--frame", "analysis/frame-prior.json"),
  run("frame", "--frame", "analysis/frame-prior-csv.json"),
  run("frame", "--frame", "analysis/frame-colors.json"),
  run("frame", "--frame", "analysis/frame-no-plan.json"),
  run("frame", "--frame", "analysis/frame-bad.json"),
  run("frame", "--frame", "analysis/frame-owner-colors-shape.json"),
  run("frame", "--frame", "analysis/frame-tracks-no-owners.json"),
]);
add("frame-stops", "frame: each stop (die) and input error", [
  run("frame", "--frame", "analysis/frame-unknown-scoring.json"),
  run("frame", "--frame", "analysis/frame-no-target.json"),
  run("frame", "--frame", "analysis/frame-csv-no-map.json"),
  run("frame", "--frame", "analysis/frame-csv-incomplete.json"),
  run("frame", "--frame", "analysis/frame-layer-unknown.json"),
  run("frame", "--frame", "analysis/frame-duplicate-caps.json"),
  run("frame", "--frame", "analysis/frame-bad-maturity.json"),
  run("frame", "--frame", "analysis/frame-no-code.json"),
  run("frame", "--frame", "analysis/frame-missing-model.json"),
  run("frame", "--frame", "analysis/frame-bad-model.json"),
  run("frame", "--frame", "analysis/frame-not-json.json"),
  run("frame", "--frame", "analysis/missing-frame.json"),
]);
add("frame-csv-ragged", "frame and packages: CSV systems with a surplus field on each data row and short rows (P9-R1-14)", [
  run("frame", "--frame", "analysis/frame-csv-ragged.json"),
  run("packages", "--frame", "analysis/frame-csv-ragged.json", "--out", "work-ragged"),
]);
add("packages", "packages: the default size, a small size, a rerun that removes old packages, prior rows, and no objectives", [
  { write: "work/packages/pkg-09.json", from: "stale-package.json" },
  run("packages", "--frame", "analysis/frame.json", "--out", "work"),
  run("packages", "--frame", "analysis/frame-prior.json", "--out", "work", "--max-requirements", "4"),
  run("packages", "--frame", "analysis/frame-csv.json", "--out", "work-csv", "--max-requirements", "0"),
  run("packages", "--frame", "analysis/frame-no-objectives.json", "--out", "work"),
]);
add("uncited", "uncited: with a pattern and an output file, with named files, and with a pattern that matches nothing", [
  run("uncited", "--frame", "analysis/frame.json", ...ROWS, "--out", "analysis/uncited.json"),
  run("uncited", "--frame", "analysis/frame.json", "--rows", "analysis/scored/pkg-01.json"),
  run("uncited", "--frame", "analysis/frame.json", "--rows", "analysis/nothing/*.json", "analysis/scored/pkg-0[2-9].json"),
]);
add("merge-draft", "merge --draft: no target-only rows and no findings yet", [run("merge", "--frame", "analysis/frame.json", ...ROWS, ...OUT, "--date", "2026-01-14", "--draft")]);
add("merge-and-workbook", "merge (final) then workbook: tracks, owners, to-dos, and owner colors from the skill palette", [
  run("merge", "--frame", "analysis/frame.json", ...ROWS, ...FINAL, ...OUT, "--date", "2026-01-14"),
  run("workbook", "--frame", "analysis/frame.json", "--fitgap", MERGED),
]);
add("workbook-owner-colors", "owner colors from the frame for one owner, the palette for the others", [
  run("merge", "--frame", "analysis/frame-colors.json", ...ROWS, ...FINAL, ...OUT),
  run("workbook", "--frame", "analysis/frame-colors.json", "--fitgap", MERGED, "--out", "deliver/books/colors.xlsx"),
]);
add("workbook-no-palette", "no skill palette in the project: the owners are plain", [run("merge", "--frame", "analysis/frame.json", ...ROWS, ...FINAL, ...OUT), run("workbook", "--frame", "analysis/frame.json", "--fitgap", MERGED)], { palette: false });
add("workbook-no-plan", "a frame without tracks: no Roadmap and To-Dos sheets; a draft workbook", [
  run("merge", "--frame", "analysis/frame-no-plan.json", ...ROWS, "--only", "analysis/only.json", ...OUT, "--draft", "--date", "2026-01-14"),
  run("workbook", "--frame", "analysis/frame-no-plan.json", "--fitgap", MERGED),
]);
add("workbook-scoring", "scoring overrides with floats, selection mode, CSV baseline", [
  run("merge", "--frame", "analysis/frame-scoring.json", ...ROWS, "--only", "analysis/only.json", "--findings", "analysis/findings.json", "--todos", "analysis/todos.json", ...OUT, "--date", "2026-01-14"),
  run("workbook", "--frame", "analysis/frame-scoring.json", "--fitgap", MERGED),
]);
add("workbook-mismatch", "a merged file from other models stops the workbook", [
  run("merge", "--frame", "analysis/frame.json", ...ROWS, ...FINAL, ...OUT),
  run("workbook", "--frame", "analysis/frame-csv.json", "--fitgap", MERGED),
  run("workbook", "--frame", "analysis/frame-small-target.json", "--fitgap", MERGED),
  run("workbook", "--frame", "analysis/frame-layer-unknown.json", "--fitgap", MERGED),
  run("workbook", "--frame", "analysis/frame.json", "--fitgap", "deliver/fit-gap/missing.json"),
]);
add("merge-problems", "merge: problems in scored rows, target-only rows, findings, and to-dos", [
  run("merge", "--frame", "analysis/frame.json", "--rows", "analysis/bad/rows.json", ...OUT),
  run("merge", "--frame", "analysis/frame.json", "--rows", "analysis/bad/many.json", ...OUT),
  run("merge", "--frame", "analysis/frame.json", "--rows", "analysis/bad/not-array.json", ...OUT),
  run("merge", "--frame", "analysis/frame.json", "--rows", "analysis/bad/gap-detail.json", "analysis/scored/pkg-02.json", ...OUT, "--draft"),
  run("merge", "--frame", "analysis/frame.json", ...ROWS, "--only", "analysis/bad/only.json", "--findings", "analysis/bad/findings.json", "--todos", "analysis/bad/todos.json", ...OUT),
  run("merge", "--frame", "analysis/frame.json", ...ROWS, ...OUT),
  run("merge", "--frame", "analysis/frame-unconfirmed.json", ...ROWS, "--only", "analysis/only.json", "--findings", "analysis/findings.json", ...OUT),
  run("merge", "--frame", "analysis/frame.json", ...ROWS, "--only", "analysis/only.json", "--findings", "analysis/findings.json", ...OUT),
  run("merge", "--frame", "analysis/frame.json", "--rows", "analysis/scored/pkg-01.json", "--only", "analysis/only.json", ...OUT, "--draft"),
]);
add("arguments", "argument errors (argparse in the script)", [run(), run("score"), run("frame"), run("packages", "--frame", "analysis/frame.json"), run("packages", "--frame", "analysis/frame.json", "--out", "work", "--max-requirements", "many"), run("merge", "--frame", "analysis/frame.json", ...OUT), run("frame", "--frame", "analysis/frame.json", "extra")]);

write("files/stale-package.json", json([{ id: "OLD" }]));
write("cases.json", json({ $comment: "Cases of buildos fitgap (W1 R7 P9 t1), generated by generate-fitgap.ts. Each case copies bases/<base>/ into a fresh project folder, removes its remove paths, and runs its steps in order. palette false: the project has no skill palette file, and the script ran with no config/owner-colors.json beside it.", cases }));
write(".gitattributes", "# Fixture bytes stay as they are on every OS (CRLF, byte order marks).\n* -text whitespace=-blank-at-eol,-blank-at-eof,-space-before-tab,cr-at-eol\n");
process.stdout.write(`wrote ${cases.length} cases\n`);
