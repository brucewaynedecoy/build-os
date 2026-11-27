// Builds the fixtures of `buildos capability-matrix` (W1 R7 P9, F-P9-04) in
// test/fixtures/skills/capability-matrix/. Run it once after a change, then
// capture the goldens with Python 3 (the standard library is enough):
//
//   node test/fixtures/skills/generate-capability-matrix.ts
//   node test/golden/skills/capture.ts --script capability-matrix
//
// Every file is invented, on the one neutral topic of the skills: a community
// library's book-lending system. The current circulation system (CIRC) is
// modelled beside a candidate library platform (LIB). The working folder is
// `cm/` (the skill says `build/`, which the repository's .gitignore hides).
//
// Most JSON is written by JSON.stringify. A few files hold JSON that
// JavaScript cannot write (a float `1.0`, an integer above 2^53, `1e16`, a
// byte order mark, broken JSON): those are written as text.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "capability-matrix");
type J = Record<string, unknown>;

function write(rel: string, content: string | Buffer): void {
  const path = join(HERE, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

rmSync(HERE, { recursive: true, force: true });
const B = "bases/library";
const put = (rel: string, value: unknown): void => write(`${B}/${rel}`, typeof value === "string" ? value : json(value));

const scope = (what: string): string => `${what} as the circulation desk does it today, from the desk manual and the branch notes.`;

// ---------------------------------------------------------------- CIRC (the current system)

const circSystem: J = {
  code: "CIRC",
  name: "Current Circulation System",
  title: "CIRC capability model",
  converted: false,
  status_vocabulary: ["live", "pilot", "planned", "retired"],
  maturity_map: { live: "proven", pilot: "partial", planned: "planned", retired: "deferred" },
  sources: ["Desk manual", "Branch notes"],
  revision: "__FLOAT_1_0__",
  catalogue_size: "__BIG_INT__",
  scale: "__FLOAT_1E16__",
};
const circLayers = [
  { id: "L1", code: "CORE", name: "Circulation" },
  { id: "L2", code: "PAT", name: "Patrons" },
  { id: "L3", code: "RPT", name: "Reports" },
];
const circPrinciples = [
  { id: "DP-1", name: "Patron first", statement: "Every desk step starts from the patron in front of the desk." },
  { id: "DP-2", name: "One record per book", statement: "A book has one record, whatever branch holds it." },
];
const circCaps = [
  { id: "CIRC-CORE-01", layer_id: "L1", doc_ref: "1.1", type: "process", name: "Check out books", status: "live", scope: scope("Lending a book to a patron"), source_refs: ["Desk manual 2"] },
  { id: "CIRC-CORE-02", layer_id: "L1", doc_ref: "1.2", type: "workflow", name: "Holds queue", status: "pilot", scope: scope("Queueing holds on books that are out") },
  { id: "CIRC-CORE-02a", layer_id: "L1", doc_ref: "1.2", type: "configuration", name: "Hold pickup window", status: "live", scope: scope("How long a held book waits at the desk"), origin: "captured" },
  { id: "CIRC-PAT-01", layer_id: "L2", doc_ref: "2.1", type: "data_entity", name: "Patron record", status: "live", scope: scope("The record of each patron") },
  { id: "CIRC-RPT-01", layer_id: "L3", doc_ref: "3.1", type: "report", name: "Overdue report", status: "planned", scope: scope("The weekly list of overdue loans") },
];
const skeletonText = (system: J, layers: unknown, caps: unknown, principles: unknown): string =>
  json({ system, layers, design_principles: principles, capabilities: caps })
    .replace('"__FLOAT_1_0__"', "1.0")
    .replace('"__BIG_INT__"', "12345678901234567890")
    .replace('"__FLOAT_1E16__"', "1e16");
put("cm/CIRC/skeleton.json", skeletonText(circSystem, circLayers, circCaps, circPrinciples));

const req = (kind: string, status: string, text: string, extra: J = {}): J => ({ kind, status, text, source_refs: ["Desk manual 2"], ...extra });
const summary = (what: string): string => `${what}, as the desk staff described it in the branch notes.`;
put("cm/CIRC/parts/part-a.json", [
  {
    id: "CIRC-CORE-01",
    name: "Check out books (desk)",
    layer_id: "L9",
    doc_ref: "1.1",
    type: "process",
    status: "live",
    _status_note: "Seen at two branches.",
    summary: summary("Lending a book to a patron at the desk, with the patron card and the book barcode"),
    personas: ["Desk clerk", "Patron"],
    triggers: ["A patron brings a book to the desk"],
    outcomes: ["The loan is recorded"],
    entities: ["Loan", "Patron", "Book"],
    dependencies: ["CIRC-PAT-01"],
    provenance: ["observed"],
    source: ["Desk manual"],
    tags: ["core"],
    requirements: [
      req("rule", "live", "Block a checkout when the patron owes more than the fine limit.", { id: "OLD-7" }),
      req("behavior", "live", 'Print a slip that says "Due back", the date, and the branch, on one line.', { option_values: "slip|none", option_scope: "global" }),
      req("setting", "live", "Loan length in days, by book category.\nShorter for new books.", { option_values: " 7 | 14 |21 ", option_default: "14", option_scope: "pricing class" }),
      req("setting", "pilot", "Receipt channels a patron can choose.", { option_values: ["paper", "e-mail"], option_default: "paper", option_scope: "global" }),
    ],
  },
  {
    id: "CIRC-CORE-02",
    layer_id: "L1",
    doc_ref: "1.2",
    type: "workflow",
    name: "Holds queue",
    status: "pilot",
    summary: summary("Queueing holds on a book that is out, first come first served"),
    personas: ["Patron"],
    triggers: [],
    outcomes: ["The next patron is told the book is in"],
    entities: ["Hold"],
    dependencies: [],
    provenance: null,
    source: [],
    tags: [],
    requirements: [
      req("data", "retired", "Keep the date a hold was placed — for the café notice board too ☕."),
      req("behavior", "pilot", "Skip a patron who is away, and keep their place.", { id: "CIRC-CORE-02-R02" }),
    ],
  },
  {
    id: "CIRC-CORE-02a",
    parent_id: "CIRC-CORE-02",
    layer_id: "L1",
    doc_ref: "1.2",
    type: "configuration",
    name: "Hold pickup window",
    status: "live",
    summary: summary("How many days a held book waits at the desk before it goes back on the shelf"),
    requirements: [req("setting", "live", "Pickup window in days.", { option_values: "3|5|7", option_default: "5", option_scope: "location" })],
  },
]);
put("cm/CIRC/parts/part-b.json", [
  {
    id: "CIRC-PAT-01",
    layer_id: "L2",
    doc_ref: "2.1",
    type: "data_entity",
    name: "Patron record",
    status: "live",
    origin: "merged",
    summary: summary("The record of each patron: name, address, card number, and a guardian for a child"),
    personas: ["Desk clerk"],
    entities: ["Patron"],
    requirements: [req("data", "live", "Record a guardian for a child, with a phone number.", { option_scope: "account" }), req("rule", "live", "A card number is never given twice.")],
  },
  {
    id: "CIRC-RPT-01",
    layer_id: "L3",
    doc_ref: "3.1",
    type: "report",
    name: "Overdue report",
    status: "planned",
    summary: summary("The weekly list of overdue loans that the branch prints on Monday"),
    dependencies: ["CIRC-CORE-01"],
    requirements: [req("behavior", "planned", "List loans more than seven days overdue, by branch.")],
  },
]);

const narrative = [
  "# Current Circulation System - Capability Model",
  "",
  "## Part I - Framing",
  "",
  "The principles: Patron first; One record per book.",
  "",
  "## Part II - Capability Inventory",
  "",
  "### 1.1 Check out books",
  "",
  "Lending at the desk.",
  "",
  "### §1.2 Holds queue **[pilot]**",
  "",
  "The holds queue, with its Hold pickup window.",
  "",
  "#### 2.1 Patron record   ",
  "",
  "### 3.1 Overdue report",
  "**[planned]**",
  "",
].join("\r\n");
put("deliver/CIRC/Current Circulation System - Capability Model.md", narrative);
put(
  "deliver/CIRC/narrative-wrong.md",
  ["# Circulation", "", "## Part One", "", "### 1.1 Checkout", "", "#### 2.1 Patron record", "", "### 9.9 Something else", "", "Patron first.", ""].join("\n"),
);

// ---------------------------------------------------------------- LIB (the candidate platform)

const libSystem: J = { code: "LIB", name: "Candidate Library Platform", title: "LIB capability model", converted: true, status_vocabulary: ["ga", "beta", "roadmap"], maturity_map: { ga: "available", beta: "partial", roadmap: "planned" } };
const libLayers = [
  { id: "L1", code: "LEND", name: "Lending" },
  { id: "L2", code: "MEM", name: "Members" },
];
const libCaps = [
  { id: "LIB-LEND-01", layer_id: "L1", doc_ref: "4.1", type: "capability", name: "Loans", status: "ga" },
  { id: "LIB-LEND-02", layer_id: "L1", doc_ref: "4.2", type: "workflow", name: "Reservations", status: "beta", scope: "Thin." },
  { id: "LIB-MEM-01", layer_id: "L2", doc_ref: "5.1", type: "data_entity", name: "Members", status: "ga" },
  { id: "LIB-MEM-02", layer_id: "L2", doc_ref: "5.2", type: "integration", name: "Self-service kiosk", status: "roadmap" },
];
put("cm/LIB/skeleton.json", { system: libSystem, layers: libLayers, capabilities: libCaps });
const libSummary = (what: string): string => `${what}, as the platform's public product notes describe it.`;
put("cm/LIB/parts/lending.json", [
  { id: "LIB-LEND-01", layer_id: "L1", doc_ref: "4.1", type: "capability", name: "Loans", status: "ga", summary: libSummary("Loans of any item to a member"), requirements: [req("behavior", "ga", "Lend an item with a barcode scan."), req("setting", "ga", "Loan rules by item type.", { option_values: "book | dvd", option_scope: "category" })] },
  { id: "LIB-LEND-02", layer_id: "L1", doc_ref: "4.2", type: "workflow", name: "Reservations", status: "beta", summary: libSummary("Reservations on items that are out, in a queue"), requirements: [req("behavior", "beta", "Queue reservations in order.")] },
]);
put("cm/LIB/parts/members.json", [
  { id: "LIB-MEM-01", layer_id: "L2", doc_ref: "5.1", type: "data_entity", name: "Members", status: "ga", summary: libSummary("Member records with contact details"), requirements: [req("data", "ga", "Store a member's address.")] },
  { id: "LIB-MEM-02", layer_id: "L2", doc_ref: "5.2", type: "integration", name: "Self-service kiosk", status: "roadmap", summary: libSummary("A kiosk where members lend and return items themselves"), requirements: [req("dependency", "roadmap", "Needs the kiosk hardware kit.")] },
]);

// ---------------------------------------------------------------- fit/gap rows

const evidence = (what: string): string => `${what}. The platform notes and the desk manual were read side by side for this capability, and the steps match.`;
put("analysis/scored/rows-1.json", [
  { baseline_capability_id: "CIRC-CORE-02a", target_capability_ids: ["LIB-LEND-02"], verdict: "configurable", confidence: "medium", effort: "low", evidence: evidence("The pickup window is a reservation setting"), migration_note: "Set the window to 5 days." },
  { baseline_capability_id: "CIRC-CORE-01", target_capability_ids: ["LIB-LEND-01"], verdict: "native", confidence: "high", effort: "none", evidence: evidence("Loans cover checkout, with the fine limit as a loan rule") },
  { baseline_capability_id: "CIRC-CORE-02", target_capability_ids: ["LIB-LEND-02", "LIB-LEND-01"], verdict: "partial", confidence: "medium", effort: "medium", evidence: evidence("Reservations queue holds, but cannot skip a patron who is away"), gap_detail: "No skip, so the desk keeps a paper list." },
]);
put("analysis/scored/rows-2.json", [
  { baseline_capability_id: "CIRC-PAT-01", target_capability_ids: ["LIB-MEM-01"], verdict: "native", confidence: "high", effort: "low", evidence: evidence("Member records hold the patron fields, guardian, too") },
  { baseline_capability_id: "CIRC-RPT-01", target_capability_ids: [], verdict: "gap", confidence: "low", effort: "high", evidence: evidence("No overdue report is listed; the platform exports loans as a file instead"), gap_detail: "Build the report from the export.", migration_note: "Keep the old report until then." },
]);
put("analysis/target-only.json", [{ target_capability_id: "LIB-MEM-02", confidence: "medium", effort: "unknown", evidence: evidence("A self-service kiosk is new: the branches have no such thing today and would gain it"), opportunity: "Pilot one kiosk at the main branch." }]);
put("analysis/integration.json", [
  { capability_key: "lending", name: "Lending", layer_id: "L1", overlap_type: "duplicate", proposed_owner: "LIB", integration_need: "Move open loans", data_flow: "CIRC -> LIB", effort: "medium", confidence: "high", systems: { CIRC: ["CIRC-CORE-01"], LIB: ["LIB-LEND-01"] }, evidence: "Both systems lend books; the platform takes over lending at cut-over.", notes: "One weekend." },
  { capability_key: "patrons", name: "Patrons", layer_id: "L2", overlap_type: "handoff", confidence: "medium", systems: { CIRC: ["CIRC-PAT-01"] }, evidence: "Patron records start in the old system and are copied to members nightly." },
  { capability_key: "kiosk", name: "Kiosk", layer_id: "L2", overlap_type: "sideways", confidence: "sure", systems: { LIB: ["LIB-MEM-02"] }, evidence: "Too short." },
]);
put("analysis/bad/unknown-baseline.json", [{ baseline_capability_id: "CIRC-CORE-99", target_capability_ids: [], verdict: "gap", confidence: "low", evidence: "x" }]);
put("analysis/bad/unknown-target.json", [{ baseline_capability_id: "CIRC-CORE-01", target_capability_ids: ["LIB-LEND-01", "LIB-LEND-09"], verdict: "native", confidence: "high", evidence: "x" }]);
put("analysis/bad/target-string.json", [{ baseline_capability_id: "CIRC-CORE-01", target_capability_ids: "LIB-LEND-01", verdict: "native", confidence: "high", evidence: "x" }]);
put("analysis/bad/only-unknown.json", [{ target_capability_id: "LIB-MEM-07", confidence: "low", evidence: "x" }]);
put("analysis/bad/not-json.json", "[{\"baseline_capability_id\": \"CIRC-CORE-01\",]\n");

// ---------------------------------------------------------------- skeleton problems

put("cm/bad/skeleton-problems.json", {
  system: { code: "CIRC", converted: false, status_vocabulary: ["live", "pilot", "gone"], maturity_map: { live: "proven", pilot: "partial" } },
  layers: [
    { id: "L1", code: "CORE", name: "Circulation" },
    { id: "L2", code: "PAT", name: "Patrons" },
  ],
  design_principles: [{ id: "DP-1", name: "Patron first" }, { name: "No id", statement: "x" }],
  capabilities: [
    { id: "CIRC-CORE-01", layer_id: "L1", type: "process", status: "live", scope: scope("Lending") },
    { id: "CIRC-CORE-01", layer_id: "L1", type: "process", status: "live", scope: scope("Lending again") },
    { id: "CIRC-core-1", layer_id: "L1", type: "process", status: "live", scope: scope("Lower case") },
    { id: "CIRC-PAT-02", layer_id: "L1", type: "person", status: "gone", scope: "Too thin." },
    { id: "CIRC-CORE-03", layer_id: "L2", type: "workflow", status: "draft" },
    { id: "LIB-CORE-04", layer_id: "L3", type: "report", status: "pilot", scope: scope("Another system's prefix") },
  ],
});
put("cm/bad/skeleton-formats.json", {
  system: { code: "C2", converted: true, status_vocabulary: ["on", 1], maturity_map: { on: "proven" } },
  layers: [
    { id: 1, code: "AB", name: "Numbered layer" },
    { id: "L2", code: "XYZW", name: null },
    { id: true, code: "Q", name: 2.5 },
  ],
  capabilities: [
    { id: "C2-AB-01", layer_id: 1, type: "process", status: "on" },
    { id: "C2-AB-02", layer_id: 1, type: "process", status: "on" },
    { id: "C2-XYZW-100", layer_id: "L2", type: "document", status: "on" },
  ],
});
put("cm/bad/skeleton-not-json.json", "{\"system\": {\"code\": \"CIRC\"\n");
write(`${B}/cm/bad/skeleton-bom.json`, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json({ system: { code: "CIRC" }, layers: [], capabilities: [] }))]));
put("cm/bad/skeleton-no-layers.json", { system: { code: "CIRC", status_vocabulary: [], maturity_map: {} }, capabilities: [] });
put("cm/bad/skeleton-no-dash.json", { system: { code: "CIRC", converted: true, status_vocabulary: ["live"], maturity_map: { live: "proven" } }, layers: [{ id: "L1", code: "CORE", name: "Circulation" }], capabilities: [{ id: "CIRCCORE01", layer_id: "L1", type: "process", status: "live" }] });
put("cm/bad/skeleton-null-layer.json", { system: { code: "CIRC", converted: true, status_vocabulary: ["live"], maturity_map: { live: "proven" } }, layers: [{ id: null, code: "CORE", name: "Circulation" }], capabilities: [] });

// ---------------------------------------------------------------- assemble problems and variants

put("cm/CIRC/parts-extra/unknown.json", [{ id: "CIRC-CORE-77", layer_id: "L1", doc_ref: "1.9", type: "process", name: "Unknown", status: "live", requirements: [] }]);
put("cm/CIRC/parts-bad/status.json", [
  { id: "CIRC-CORE-01", status: "closed", requirements: [] },
  { id: "CIRC-CORE-02", status: "pilot", requirements: [] },
  { id: "CIRC-CORE-02a", status: "live", requirements: [] },
  { id: "CIRC-PAT-01", status: "live", requirements: [] },
  { id: "CIRC-RPT-01", status: "planned", requirements: [] },
]);
put("cm/CIRC/parts-bad/req-status.json", [
  { id: "CIRC-CORE-01", status: "live", requirements: [{ kind: "rule", status: "live", text: "Fine." }, { kind: "rule", status: "someday", text: "Not in the vocabulary." }] },
  { id: "CIRC-CORE-02", status: "pilot", requirements: [] },
  { id: "CIRC-CORE-02a", status: "live", requirements: [] },
  { id: "CIRC-PAT-01", status: "live", requirements: [] },
  { id: "CIRC-RPT-01", status: "planned", requirements: [] },
]);
put("cm/CIRC/parts-bad/no-kind.json", [
  { id: "CIRC-CORE-01", status: "live", requirements: [{ status: "live", text: "No kind." }] },
  { id: "CIRC-CORE-02", status: "pilot" },
  { id: "CIRC-CORE-02a", status: "live" },
  { id: "CIRC-PAT-01", status: "live" },
  { id: "CIRC-RPT-01", status: "planned" },
]);
put("cm/CIRC/parts-bad/no-status.json", [{ id: "CIRC-CORE-01", requirements: [] }, { id: "CIRC-CORE-02", status: "pilot" }, { id: "CIRC-CORE-02a", status: "live" }, { id: "CIRC-PAT-01", status: "live" }, { id: "CIRC-RPT-01", status: "planned" }]);
put("cm/CIRC/parts-bad/not-json.json", "[{\"id\": \"CIRC-CORE-01\" \"status\": \"live\"}]\n");

const vSystem: J = { code: "Var", generated: "kept in place", status_vocabulary: ["on", "off"], maturity_map: { on: "available", off: "deferred" }, note: "Bücher 📚" };
put("cm/Var/skeleton.json", {
  system: vSystem,
  layers: [{ id: "L1", code: "ODD", name: "Odd values" }],
  capabilities: [
    { id: "Var-ODD-01", layer_id: "L1", doc_ref: "1", type: "process", name: "Strings for lists", status: "on" },
    { id: "Var-ODD-02", layer_id: "L1", doc_ref: "2", type: "document", name: "Scope aliases", status: "off", source_refs: ["Skeleton ref"] },
  ],
});
put("cm/Var/parts/odd.json", [
  {
    id: "Var-ODD-02",
    status: "off",
    summary: null,
    personas: "abc",
    tags: { first: 1, second: 2 },
    requirements: [
      { kind: "setting", status: "on", text: "Class alias.", option_scope: "class", option_values: 7 },
      { kind: "setting", status: "on", text: "Template alias.", option_scope: "template", option_values: "a||b" },
      { kind: "setting", status: "off", text: "Setup alias.", option_scope: "setup", option_values: "" },
      { kind: "setting", status: "on", text: "User alias.", option_scope: "user", option_default: 0 },
      { kind: "setting", status: "on", text: "Contract alias.", option_scope: "contract", option_values: "x | y" },
      { kind: "rule", status: "on", option_default: "dropped" },
      { kind: "data", status: "off", text: "Alias then stripped.", option_scope: "pricing class" },
    ],
  },
  { id: "Var-ODD-01", status: "on", name: "Strings for lists", summary: 12, requirements: [{ id: "Var-ODD-01-R01", kind: "behavior", status: "on", text: "Already numbered.", source_refs: null }] },
]);

// ---------------------------------------------------------------- validate inputs

const vcap = (id: string, extra: J = {}): J => ({
  id,
  parent_id: null,
  name: `Capability ${id}`,
  layer_id: "L1",
  doc_ref: id.slice(-2),
  type: "process",
  status: "on",
  maturity: "available",
  origin: "derived",
  source_refs: [],
  summary: "A capability of the hand-made model, long enough to pass the check.",
  personas: [],
  triggers: [],
  outcomes: [],
  entities: [],
  dependencies: [],
  provenance: [],
  source: [],
  tags: [],
  requirements: [{ id: `${id}-R01`, kind: "rule", status: "on", maturity: "available", text: "A requirement with text.", option_values: null, option_default: null, option_scope: null, source_refs: [] }],
  ...extra,
});
const vmodel = (caps: J[], extra: J = {}): J => ({
  schema_version: "4",
  meta: { code: "HM", vocabularies: { status: ["on", "off"] } },
  layers: [{ id: "L1", code: "ONE", name: "One" }],
  design_principles: [],
  capabilities: caps,
  capability_tree: caps.map((c) => ({ id: c["id"] })),
  ...extra,
});
put(
  "models/broken/hm-capability-model.json",
  vmodel(
    [
      vcap("HM-ONE-01", { dependencies: ["HM-ONE-09"] }),
      vcap("HM-ONE-01", { doc_ref: "01" }),
      vcap("HM-TWO-02", { type: "person", status: "gone", maturity: "ripe", origin: "found", summary: "Short." }),
      vcap("HM-ONE-03", { requirements: [] }),
      vcap("HM-ONE-04", {
        parent_id: "HM-ONE-03",
        doc_ref: "01",
        requirements: [
          { id: "HM-ONE-04-R01", kind: "wish", status: "on", maturity: "available", text: "Tiny", option_values: "a|b", option_default: null, option_scope: null, source_refs: [] },
          { id: "HM-ONE-04-R01", kind: "setting", status: "on", maturity: "available", text: "A setting with no scope.", option_values: null, option_default: null, option_scope: "planet", source_refs: [] },
        ],
      }),
    ],
    { design_principles: [{ id: "P1", name: "Unnamed" }], capability_tree: [] },
  ),
);
put("models/broken/hm-capabilities.csv", "﻿system,capability_id,requirement_count\r\nHM,HM-ONE-01,1\r\nHM,HM-ONE-01,1\r\n");
put("models/broken/hm-requirements.csv", "﻿system,requirement_id\r\nHM,HM-ONE-01-R01\r\n");
put("models/lone/hm-capability-model.json", vmodel([vcap("HM-ONE-01")]));
put("models/orphan/hm-capability-model.json", vmodel([vcap("HM-ONE-01"), vcap("HM-ONE-02", { parent_id: "HM-ONE-77" })]));
put("models/badcount/hm-capability-model.json", vmodel([vcap("HM-ONE-01")]));
put("models/badcount/hm-capabilities.csv", "system,capability_id,requirement_count\nHM,HM-ONE-01,one\n");
put("models/badcount/hm-requirements.csv", "system,requirement_id\nHM,HM-ONE-01-R01\n");
put("models/crlf/hm-capability-model.json", vmodel([vcap("HM-ONE-01"), vcap("HM-ONE-02")]));
put("models/crlf/hm-capabilities.csv", 'system,capability_id,name,requirement_count\r\nHM,HM-ONE-01,"two\r\nlines", 1 \r\n\r\nHM,HM-ONE-02,plain,+1\r\n');
put("models/crlf/hm-requirements.csv", "system,requirement_id\r\nHM,HM-ONE-01-R01\r\nHM,HM-ONE-02-R01\r\n");
put("models/not-json.json", "{\"meta\": nope}\n");
put("analysis/bad/fitgap-problems.json", {
  meta: { mode: "replacement" },
  baseline_to_target: [
    { baseline_capability_id: "CIRC-CORE-01", target_capability_ids: ["LIB-LEND-01", "LIB-NONE-01"], verdict: "great", confidence: "sure", effort: "huge", evidence: "Short." },
    { baseline_capability_id: "CIRC-CORE-01", target_capability_ids: ["LIB-LEND-02"], verdict: "gap", confidence: "high", effort: "low", evidence: evidence("Listed twice") },
    { baseline_capability_id: "CIRC-PAT-01", verdict: "native", confidence: "high", evidence: evidence("Cites no target") },
  ],
  target_only: [{ target_capability_id: "LIB-MEM-01", confidence: "low", evidence: "Short." }],
});
put("analysis/bad/integration-problems.json", { meta: { mode: "integration" }, rows: [{ overlap_type: "duplicate", evidence: "Both lend books; the platform takes over lending at the cut-over weekend." }, { overlap_type: "sideways" }] });

// ---------------------------------------------------------------- review round 1 of pull request 10 (F-P9-04)
// Python's exact numbers (finding 1), int() and the JSON digit limit (finding 2), empty optional values
// (finding 3), and Python 3.14's text for an unhashable value. JSON with tokens JavaScript cannot write
// (NaN, -0.0, 1.0, integers above 2^53, 4,300 digits) is written as text.

const exactSystem = '{"code": "NUM", "converted": true, "status_vocabulary": ["live"], "maturity_map": {"live": "proven"}}';
const exactLayers = '[{"id": "L1", "code": "CORE", "name": "Numbers"}]';
const exactCap = (n: string, docRef: string): string => `{"id": "NUM-CORE-${n}", "layer_id": "L1", "doc_ref": ${docRef}, "type": "process", "name": "Number ${n}", "status": "live"}`;
const exactPart = (n: string, docRef: string): string => `{"id": "NUM-CORE-${n}", "layer_id": "L1", "doc_ref": ${docRef}, "type": "process", "name": "Number ${n}", "status": "live", "summary": "A capability whose doc_ref is a number, to test Python's equality.", "requirements": [{"kind": "rule", "status": "live", "text": "A rule with text."}]}`;
const exactPairs: [string, string, string][] = [
  ["01", "9007199254740992", "9007199254740993"],
  ["02", "1.0", "1"],
  ["03", "NaN", "NaN"],
  ["04", "[NaN]", "[NaN]"],
  ["05", "-0.0", "0"],
  ["06", "9007199254740993", "9007199254740992.0"],
  ["07", "true", "1"],
  ["08", "12345678901234567890123", "12345678901234567890123"],
];
put("cm/NUM/skeleton.json", `{"system": ${exactSystem}, "layers": ${exactLayers}, "capabilities": [\n${exactPairs.map(([n, sk]) => exactCap(n, sk)).join(",\n")}\n]}\n`);
put("cm/NUM/parts/all.json", `[\n${exactPairs.map(([n, , pt]) => exactPart(n, pt)).join(",\n")}\n]\n`);
put("cm/NUM/skeleton-big-ids.json", `{"system": ${exactSystem}, "layers": ${exactLayers}, "capabilities": [{"id": 9007199254740993}, {"id": 9007199254740992}, {"id": 9007199254740994}, {"id": 1.5}]}\n`);
put("cm/NUM/parts/none.json", "[]\n");
const digits = (n: number): string => "7".repeat(n);
put("cm/NUM/skeleton-4096.json", `{"system": {"code": "NUM", "converted": true, "status_vocabulary": ["live"], "maturity_map": {"live": "proven"}, "big": ${digits(4096)}, "bigger": -${digits(4300)}, "long_float": 1.${"5".repeat(5000)}}, "layers": ${exactLayers}, "capabilities": []}\n`);
put("cm/NUM/skeleton-4301.json", `{"system": {"code": "NUM", "big": ${digits(4301)}}, "layers": [], "capabilities": []}\n`);
put("cm/NUM/skeleton-empty.json", '{"system": {"code": "NUM", "status_vocabulary": [], "maturity_map": {}}, "layers": [], "capabilities": []}\n');

const countCaps = (codes: string[]): J[] => codes.map((_c, i) => vcapNum(`HM-ONE-0${i + 1}`));
const vcapNum = (id: string): J => ({ id, parent_id: null, name: `Capability ${id}`, layer_id: "L1", doc_ref: id.slice(-2), type: "process", status: "on", maturity: "available", origin: "derived", source_refs: [], summary: "A capability of the hand-made model, long enough to pass the check.", personas: [], triggers: [], outcomes: [], entities: [], dependencies: [], provenance: [], source: [], tags: [], requirements: [{ id: `${id}-R01`, kind: "rule", status: "on", maturity: "available", text: "A requirement with text.", option_values: null, option_default: null, option_scope: null, source_refs: [] }] });
const countModel = (folder: string, counts: string[]): void => {
  const caps = countCaps(counts);
  put(`models/${folder}/hm-capability-model.json`, { schema_version: "4", meta: { code: "HM", vocabularies: { status: ["on"] } }, layers: [{ id: "L1", code: "ONE", name: "One" }], design_principles: [], capabilities: caps, capability_tree: caps.map((c) => ({ id: c["id"] })) });
  put(`models/${folder}/hm-capabilities.csv`, `system,capability_id,requirement_count\r\n${counts.map((c, i) => `HM,HM-ONE-0${i + 1},${c}`).join("\r\n")}\r\n`);
  put(`models/${folder}/hm-requirements.csv`, `system,requirement_id\r\n${counts.map((_c, i) => `HM,HM-ONE-0${i + 1}-R01`).join("\r\n")}\r\n`);
};
countModel("int-ok", [`${"0".repeat(4299)}1`, " 1 ", "　1", "\u000b1\u000c", "1_0".replace("1_0", "0_1")]);
countModel("int-zeros", [`${"0".repeat(4300)}1`]);
countModel("int-separator", ["\u001c1\u001c"]);
countModel("int-long-text", ["x".repeat(300)]);
// Review round 2 (finding 3): two adjacent lone surrogates in a printed layer name, and in a layer name that only the model JSON holds.
put("cm/bad/skeleton-surrogates.json", '{"system": {"code": "SUR", "converted": true, "status_vocabulary": ["live"], "maturity_map": {"live": "proven"}}, "layers": [{"id": "L1", "code": "ONE", "name": "Desk"}, {"id": "L2", "code": "TWO", "name": "Desk \\ud808\\ud808 two"}], "capabilities": []}\n');
put("analysis/bad/integration-unhashable.json", { meta: { mode: "integration" }, rows: [{ overlap_type: "handoff", evidence: "Patron records start in the old system and are copied to members nightly, by a job." }, { overlap_type: ["handoff"], evidence: "A list where a word belongs." }] });

// ---------------------------------------------------------------- cases

interface Step {
  run?: string[];
}
const cases: { id: string; description: string; base: string; steps: Step[] }[] = [];
const run = (...args: string[]): Step => ({ run: args });
const add = (id: string, description: string, steps: Step[]): void => {
  cases.push({ id, description, base: "library", steps });
};

const CIRC_SK = ["--skeleton", "cm/CIRC/skeleton.json"];
const CIRC_MODEL = "deliver/CIRC/circ-capability-model.json";
const LIB_MODEL = "deliver/LIB/lib-capability-model.json";
const ASSEMBLE_CIRC = run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/part-a.json", "cm/CIRC/parts/part-b.json", "--out", "deliver/CIRC", "--date", "2026-01-15");
const ASSEMBLE_LIB = run("assemble", "--skeleton", "cm/LIB/skeleton.json", "--parts", "cm/LIB/parts/*.json", "--out", "deliver/LIB");
const NARRATIVE = "deliver/CIRC/Current Circulation System - Capability Model.md";
const PAIR = ["--baseline", CIRC_MODEL, "--target", LIB_MODEL];

add("skeleton-ok", "skeleton: a valid skeleton with a child capability, and a converted one with thin scope briefs", [run("skeleton", ...CIRC_SK), run("skeleton", "--skeleton", "cm/LIB/skeleton.json")]);
add("skeleton-problems", "skeleton: every check that fails, and layer columns formatted from ids, codes, and names that are numbers, null, or a bool", [run("skeleton", "--skeleton", "cm/bad/skeleton-problems.json"), run("skeleton", "--skeleton", "cm/bad/skeleton-formats.json")]);
add("skeleton-crashes", "skeleton: a missing file, broken JSON, a byte order mark, a missing key, an id with no dash, and a null layer id (the script crashed)", [
  run("skeleton", "--skeleton", "cm/bad/missing.json"),
  run("skeleton", "--skeleton", "cm/bad/skeleton-not-json.json"),
  run("skeleton", "--skeleton", "cm/bad/skeleton-bom.json"),
  run("skeleton", "--skeleton", "cm/bad/skeleton-no-layers.json"),
  run("skeleton", "--skeleton", "cm/bad/skeleton-no-dash.json"),
  run("skeleton", "--skeleton", "cm/bad/skeleton-null-layer.json"),
]);
add("assemble-ok", "assemble: restored fields, renumbered requirements, stripped and aliased option fields, pipe values, CSV quoting, non-ASCII text, Python numbers; a pattern of parts", [ASSEMBLE_CIRC, ASSEMBLE_LIB]);
add("assemble-variants", "assemble: strings and dicts where lists belong, null and number summaries, every scope alias, option values that are numbers or empty, and a system key named generated", [run("assemble", "--skeleton", "cm/Var/skeleton.json", "--parts", "cm/Var/parts/odd.json", "--out", "deliver/Var/nested/out")]);
add("assemble-duplicates", "assemble: the same part twice, as a file and as a pattern (the script keeps both copies)", [run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "cm/CIRC/parts/part-b.json", "--out", "deliver/dup")]);
add("assemble-stops", "assemble: missing and extra capabilities, a pattern that matches nothing, and statuses outside the vocabulary", [
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/part-a.json", "--out", "deliver/CIRC"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "cm/CIRC/parts-extra/unknown.json", "--out", "deliver/CIRC"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/nothing-*.json", "--out", "deliver/CIRC"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts-bad/status.json", "--out", "deliver/CIRC"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts-bad/req-status.json", "--out", "deliver/CIRC"),
]);
add("assemble-crashes", "assemble: a part that is not JSON, a capability or a requirement with a missing key, and a missing skeleton (the script crashed)", [
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts-bad/not-json.json", "--out", "deliver/CIRC"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts-bad/no-kind.json", "--out", "deliver/CIRC"),
  run("assemble", "--skeleton", "cm/CIRC/missing.json", "--parts", "cm/CIRC/parts/part-a.json", "--out", "deliver/CIRC"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts-bad/no-status.json", "--out", "deliver/CIRC"),
]);
add("pipeline", "assemble both systems, then fitgap in each mode and validate with a narrative and each fit/gap", [
  ASSEMBLE_CIRC,
  ASSEMBLE_LIB,
  run("fitgap", "--mode", "replacement", ...PAIR, "--rows", "analysis/scored/*.json", "--only", "analysis/target-only.json", "--out", "deliver/fit-gap", "--date", "2026-01-15"),
  run("validate", "--model", CIRC_MODEL, "--narrative", NARRATIVE),
  run("validate", "--model", LIB_MODEL),
  run("validate", "--model", CIRC_MODEL, "--fitgap", "deliver/fit-gap/circ-lib-fit-gap.json", ...PAIR),
  run("fitgap", "--mode", "selection", ...PAIR, "--rows", "analysis/scored/rows-2.json", "analysis/scored/rows-1.json", "--out", "deliver/selection"),
  run("validate", "--model", CIRC_MODEL, "--fitgap", "deliver/selection/circ-lib-fit-gap.json", ...PAIR),
  run("fitgap", "--mode", "integration", "--models", CIRC_MODEL, LIB_MODEL, "--rows", "analysis/integration.json", "--out", "deliver/integration"),
  run("validate", "--model", LIB_MODEL, "--fitgap", "deliver/integration/circ-lib-integration-map.json"),
  run("validate", "--model", CIRC_MODEL, "--narrative", "deliver/CIRC/narrative-wrong.md"),
  run("validate", "--model", CIRC_MODEL, "--fitgap", "analysis/bad/fitgap-problems.json", ...PAIR),
  run("validate", "--model", CIRC_MODEL, "--fitgap", "analysis/bad/integration-problems.json"),
]);
add("fitgap-stops", "fitgap: an unknown baseline id, an unknown target id, target ids as a string (read by character), and an unknown target-only id", [
  ASSEMBLE_CIRC,
  ASSEMBLE_LIB,
  run("fitgap", ...PAIR, "--rows", "analysis/bad/unknown-baseline.json", "--out", "deliver/fit-gap"),
  run("fitgap", ...PAIR, "--rows", "analysis/bad/unknown-target.json", "--out", "deliver/fit-gap"),
  run("fitgap", ...PAIR, "--rows", "analysis/bad/target-string.json", "--out", "deliver/fit-gap"),
  run("fitgap", ...PAIR, "--rows", "analysis/scored/rows-1.json", "--only", "analysis/bad/only-unknown.json", "--out", "deliver/fit-gap"),
]);
add("fitgap-crashes", "fitgap: no --baseline, no --models in integration mode, an empty --models, rows that are not JSON, and a missing model (the script crashed)", [
  ASSEMBLE_CIRC,
  run("fitgap", "--target", CIRC_MODEL, "--rows", "analysis/scored/rows-1.json", "--out", "deliver/fit-gap"),
  run("fitgap", "--mode", "integration", "--rows", "analysis/integration.json", "--out", "deliver/integration"),
  run("fitgap", "--mode", "integration", "--models", "--rows", "analysis/integration.json", "--out", "deliver/integration"),
  run("fitgap", "--baseline", CIRC_MODEL, "--target", CIRC_MODEL, "--rows", "analysis/bad/not-json.json", "--out", "deliver/fit-gap"),
  run("fitgap", "--baseline", CIRC_MODEL, "--target", LIB_MODEL, "--rows", "analysis/scored/rows-1.json", "--out", "deliver/fit-gap"),
]);
add("validate-problems", "validate: a model that fails every model check, with CSV counts that do not match", [run("validate", "--model", "models/broken/hm-capability-model.json")]);
add("validate-csv", "validate: no companion CSVs, CSVs with CRLF, a quoted line break, a blank line, and padded counts, and a count that is not a number (the script crashed)", [
  run("validate", "--model", "models/lone/hm-capability-model.json"),
  run("validate", "--model", "models/crlf/hm-capability-model.json"),
  run("validate", "--model", "models/badcount/hm-capability-model.json"),
]);
add("validate-crashes", "validate: an unresolved parent, a missing narrative, a fit/gap without its models, and a model that is not JSON (the script crashed after its first lines)", [
  ASSEMBLE_CIRC,
  run("validate", "--model", "models/orphan/hm-capability-model.json"),
  run("validate", "--model", CIRC_MODEL, "--narrative", "deliver/CIRC/missing.md"),
  run("validate", "--model", CIRC_MODEL, "--fitgap", "analysis/bad/fitgap-problems.json"),
  run("validate", "--model", "models/not-json.json"),
]);
add("exact-numbers", "assemble and validate with numbers as Python compares them (review round 1, finding 1): integers above 2^53 restored by every digit, 1.0 equal to 1 and to true, NaN unequal to NaN but equal inside a list, -0.0 equal to 0; missing ids sorted by every digit", [
  run("assemble", "--skeleton", "cm/NUM/skeleton.json", "--parts", "cm/NUM/parts/all.json", "--out", "deliver/NUM"),
  run("assemble", "--skeleton", "cm/NUM/skeleton-big-ids.json", "--parts", "cm/NUM/parts/none.json", "--out", "deliver/NUM-ids"),
]);
add("integer-limits", "int() and the JSON reader at Python's edges (review round 1, finding 2): 4,096 and 4,300 digits read, 4,301 refused; int() strips non-ASCII white space but not U+001C; a bad literal's repr is cut to 200 characters", [
  run("skeleton", "--skeleton", "cm/NUM/skeleton-4096.json"),
  run("skeleton", "--skeleton", "cm/NUM/skeleton-4301.json"),
  run("validate", "--model", "models/int-ok/hm-capability-model.json"),
  run("validate", "--model", "models/int-zeros/hm-capability-model.json"),
  run("validate", "--model", "models/int-separator/hm-capability-model.json"),
  run("validate", "--model", "models/int-long-text/hm-capability-model.json"),
]);
add("empty-values", "empty optional values (review round 1, finding 3): --narrative= and --fitgap= skip their checks, --parts= and --only '' match nothing, --baseline= names no file; and Python 3.14's text for a list used as a set element", [
  ASSEMBLE_CIRC,
  ASSEMBLE_LIB,
  run("validate", "--model", CIRC_MODEL, "--narrative=", "--fitgap="),
  run("assemble", "--skeleton", "cm/NUM/skeleton-empty.json", "--parts=", "--out", "deliver/empty"),
  run("fitgap", ...PAIR, "--rows", "analysis/scored/*.json", "--only", "", "--out", "deliver/fit-gap-empty-only"),
  run("fitgap", "--baseline=", "--target", LIB_MODEL, "--rows", "analysis/scored/rows-1.json", "--out", "deliver/fit-gap"),
  run("validate", "--model", CIRC_MODEL, "--fitgap", "analysis/bad/integration-unhashable.json"),
]);
add("spelled-paths", "paths as Python's glob and makedirs read them (review round 2, findings 1 and 3): a final separator after a file and after a pattern of files matches nothing; an out folder that is a file, and one under a file, are makedirs' errors; two adjacent lone surrogates in a printed line are one range", [
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/part-a.json/", "cm/CIRC/parts/part-b.json", "--out", "deliver/CIRC"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json/", "--out", "deliver/CIRC"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "cm/CIRC/skeleton.json"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "cm/CIRC/skeleton.json/out/deeper"),
  run("skeleton", "--skeleton", "cm/bad/skeleton-surrogates.json"),
]);
add("arguments", "argument errors (argparse in the script) and help", [
  run(),
  run("build"),
  run("skeleton"),
  run("assemble", ...CIRC_SK, "--parts", "--out", "deliver/CIRC"),
  run("fitgap", "--mode", "merger", "--rows", "x.json", "--out", "deliver"),
  run("validate", "--model", CIRC_MODEL, "--strict"),
  run("skeleton", ...CIRC_SK, "extra"),
  run("--help"),
  run("validate", "--help"),
]);
add("dash-values", "option values that start with a minus, as argparse reads them (review round 3, finding 3): a value with a space, or one that looks like a negative number (an optional dot and a Unicode digit), is a value; anything else is an option", [
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "-.stash71"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "- stash71"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "-\u0661desk71"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "deliver/dash", "--date", "-.edition71"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "deliver/dash-space", "--date", "- catalogue 71"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "deliver/dash-digit", "--date", "-\u0663issue71"),
  run("assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "deliver/dash-number", "--date", "-.71extra"),
]);

write("cases.json", json({ $comment: "Cases of buildos capability-matrix (W1 R7 P9, F-P9-04), generated by generate-capability-matrix.ts. Each case copies bases/<base>/ into a fresh project folder and runs its steps in order.", cases }));
write(".gitattributes", "# Fixture bytes stay as they are on every OS (CRLF, byte order marks).\n* -text whitespace=-blank-at-eol,-blank-at-eof,-space-before-tab,cr-at-eol\n");
process.stdout.write(`wrote ${cases.length} cases\n`);
