// Builds the fixtures of `buildos extract bulk` (W1 R7 P9 t1) in
// test/fixtures/skills/bulk-extract/: the base projects, the step input files,
// and cases.json. Run it once after a change, then capture the goldens:
//
//   node test/fixtures/skills/generate-bulk-extract.ts
//   node test/golden/skills/capture.ts --script bulk-extract
//
// Every file is invented, on the one neutral topic of the skills: a community
// library's book-lending system.

import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "bulk-extract");
const sha = (text: string | Buffer): string => createHash("sha256").update(text).digest("hex");
type J = Record<string, unknown>;

function write(rel: string, content: string | Buffer): void {
  const path = join(HERE, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

// ---------------------------------------------------------------- base project "library"

const SOURCES: Record<string, string> = {
  "assets/_intake/lending-policy.txt": "Lending Policy\nPatrons may borrow up to five books.\nLoans last 21 days.\nHolds expire after 7 days.\n",
  "assets/_intake/branch-hours.xlsx": "branch hours workbook (invented bytes for the fixture)\n",
  "assets/_intake/patron-faq.txt": "Patron FAQ\r\nCaf\u00e9 corner, \u66f8 shelf, and the \u{1f4da} return box.\r\n",
  "assets/_intake/fines.txt": "Fines\nOverdue books cost ten cents a day.\n",
  "assets/_intake/holds-notes.txt": "Holds notes\nNo new needs here.\n",
};

const CONVERTED: Record<string, string> = {
  "assets/lending-policy/lending-policy.md": "# Lending Policy\n\nPatrons may borrow up to five books at once.\nA loan lasts 21 days and can be renewed twice.\nA hold expires after 7 days on the shelf.\n",
  "assets/branch-hours/main-branch.csv": 'day,open,close,note\nMonday,09:00,17:00,\nTuesday,09:00,20:00,"late night,\nreading club"\nSaturday,10:00,14:00,\n',
  "assets/branch-hours/east-branch.csv": "day,open,close\r\nMonday,10:00,18:00\r\nFriday,10:00,16:00\r\n",
  "assets/patron-faq/patron-faq.md": "\ufeff# Patron FAQ\r\n\r\nCaf\u00e9 corner, \u66f8 shelf, and the \u{1f4da} return box.\r\nPatrons ask about renewals.\r\n",
  "assets/fines/fines.md": "# Fines\n\nOverdue books cost ten cents a day.\nLost books cost the list price.\n",
  "assets/holds-notes/holds-notes.md": "# Holds notes\n\nNo new needs here.\n",
};

function references(): J[] {
  return [
    { id: "REF-001", source: "assets/_intake/lending-policy.txt", converted: "assets/lending-policy/lending-policy.md", sha256: sha(SOURCES["assets/_intake/lending-policy.txt"]!) },
    { id: "REF-002", source: "assets/_intake/branch-hours.xlsx", converted: "assets/branch-hours/main-branch.csv", sha256: sha(SOURCES["assets/_intake/branch-hours.xlsx"]!) },
    { id: "REF-003", source: "assets/_intake/branch-hours.xlsx", converted: "assets/branch-hours/east-branch.csv", sha256: sha(SOURCES["assets/_intake/branch-hours.xlsx"]!) },
    { id: "REF-004", source: "assets/_intake/patron-faq.txt", converted: "assets/patron-faq/patron-faq.md", sha256: sha(SOURCES["assets/_intake/patron-faq.txt"]!) },
    { id: "REF-005", source: "assets/_intake/fines.txt", converted: "assets/fines/fines.md", sha256: sha(SOURCES["assets/_intake/fines.txt"]!) },
    { id: "REF-006", source: "assets/_intake/holds-notes.txt", converted: "assets/holds-notes/holds-notes.md", sha256: sha(SOURCES["assets/_intake/holds-notes.txt"]!) },
  ];
}

const STAMP = "2026-01-10T08:00:00Z";
const REQ_001 = {
  id: "REQ-001",
  type: "requirement",
  title: "Borrow limit",
  status: "draft",
  summary: "A patron can borrow up to five books.",
  source_anchor: "assets/lending-policy/lending-policy.md#L3",
  doc_anchor: null,
  source_refs: ["assets/lending-policy/lending-policy.md#L3"],
  related: [],
  created_at: STAMP,
  updated_at: STAMP,
  statement: "The system shall limit a patron to five loans at once.",
  rationale: "The lending policy sets the limit.",
  acceptance_refs: [],
  shelf_note: "Keep this custom field",
};
const CAP_001 = {
  id: "CAP-001",
  type: "capability",
  title: "Circulation desk",
  status: "draft",
  summary: "Staff check books out and in.",
  source_anchor: "assets/lending-policy/lending-policy.md#L3",
  doc_anchor: null,
  source_refs: [],
  related: [],
  created_at: STAMP,
  updated_at: STAMP,
  description: "Check out and check in at the desk.",
  supports: [],
  limits: [],
};

const overlays: Record<string, { remove?: string[] }> = {};

/** The full base project, or (with a name other than library) an overlay: only the files that differ, and the files it removes. */
function base(name: string, options: { index?: unknown; data?: Record<string, string>; extra?: Record<string, string | Buffer> } = {}): void {
  const full = name === "library";
  const root = full ? "bases/library" : `overlays/${name}`;
  if (full) {
    for (const [path, text] of Object.entries(SOURCES)) write(`${root}/${path}`, text);
    for (const [path, text] of Object.entries(CONVERTED)) write(`${root}/${path}`, text);
  }
  if (options.index === null) overlays[name] = { remove: [".os/indexes/references.json"] };
  else if (full || options.index !== undefined) write(`${root}/.os/indexes/references.json`, options.index === undefined ? json({ references: references() }) : typeof options.index === "string" ? options.index : json(options.index));
  if (!(name in overlays)) overlays[name] = {};
  const data: Record<string, string> = full
    ? {
        "requirements.jsonl": `${JSON.stringify(REQ_001)}\n`,
        "capabilities.jsonl": `${JSON.stringify(CAP_001)}\n`,
        "personas.jsonl": "",
        "test-cases.jsonl": "",
        "results.jsonl": "",
        "runs.jsonl": "",
        "findings.jsonl": "",
        "extractions.jsonl": "",
      }
    : {};
  for (const [file, text] of Object.entries({ ...data, ...options.data })) write(`${root}/.os/data/${file}`, text);
  for (const [path, content] of Object.entries(options.extra ?? {})) write(`${root}/${path}`, content);
}

// ---------------------------------------------------------------- reviews and candidates

function row(kind: string, fields: J): J {
  const r: J = { type: kind, title: "", status: "draft", summary: "", source_anchor: "", doc_anchor: null, source_refs: [], related: [], created_at: null, updated_at: null };
  const typeFields: Record<string, J> = {
    requirement: { statement: "", rationale: "", acceptance_refs: [] },
    capability: { description: "", supports: [], limits: [] },
    persona: { description: "", goals: [], needs: [] },
    "test-case": { verifies: [], preconditions: [], steps: [], expected: "" },
    result: { target_id: "", outcome: "inconclusive", evidence_refs: [] },
    run: { playbook_id: null, started_at: "", ended_at: null, inputs: {}, outputs: {} },
    finding: { observed: "", basis_refs: [], confidence: "medium", implications: [] },
  };
  return { ...r, ...typeFields[kind], ...fields };
}

function candidate(key: string, kind: string, fields: J, extra: J = {}): J {
  return { key, type: kind, action: "minted", review_state: "pending", ...extra, row: row(kind, fields) };
}

const REQ_ROW = (n: string, anchor = "assets/lending-policy/lending-policy.md#L3"): J => ({
  title: `Renewal rule ${n}`,
  summary: `A patron can renew a loan (${n}).`,
  source_anchor: anchor,
  source_refs: [anchor],
  statement: `The system shall allow two renewals per loan (${n}).`,
  rationale: "The lending policy allows two renewals.",
});

function review(ref: string, group: { source: string; refs: [string, string][] }, fields: J = {}): J {
  return {
    format_version: 2,
    source: group.source,
    source_sha256: sha(SOURCES[group.source]!),
    reviewed_by: "Circulation Analyst",
    reviewed_at: "2026-01-12",
    source_check: { result: "matched", notes: "Compared the converted text with the original policy.", repairs: [] },
    references: group.refs.map(([id, converted]) => ({ id, converted, outcome: "reviewed", note: "" })),
    candidates: [],
    unresolved: [],
    applied: {},
    extraction_ids: [],
    publication_review: null,
    ...fields,
  };
  void ref;
}

const G1 = { source: "assets/_intake/lending-policy.txt", refs: [["REF-001", "assets/lending-policy/lending-policy.md"]] as [string, string][] };
const G2 = { source: "assets/_intake/branch-hours.xlsx", refs: [["REF-002", "assets/branch-hours/main-branch.csv"], ["REF-003", "assets/branch-hours/east-branch.csv"]] as [string, string][] };
const G4 = { source: "assets/_intake/patron-faq.txt", refs: [["REF-004", "assets/patron-faq/patron-faq.md"]] as [string, string][] };
const G5 = { source: "assets/_intake/fines.txt", refs: [["REF-005", "assets/fines/fines.md"]] as [string, string][] };
const G6 = { source: "assets/_intake/holds-notes.txt", refs: [["REF-006", "assets/holds-notes/holds-notes.md"]] as [string, string][] };

const R1 = "extractions/REF-001-lending-policy.json";
const R2 = "extractions/REF-002-branch-hours.json";
const R4 = "extractions/REF-004-patron-faq.json";
const R5 = "extractions/REF-005-fines.json";
const R6 = "extractions/REF-006-holds-notes.json";

interface Step {
  run?: string[];
  stdin?: string;
  write?: string;
  from?: string;
  remove?: string;
}
interface Case {
  id: string;
  description: string;
  base: string;
  overlay?: string;
  remove?: string[];
  steps: Step[];
}
const cases: Case[] = [];
const files = new Map<string, string>();

function file(name: string, content: unknown): string {
  const text = typeof content === "string" ? content : json(content);
  files.set(name, text);
  return name;
}

const put = (path: string, name: string, content: unknown): Step => ({ write: path, from: file(name, content) });
const run = (...args: string[]): Step => ({ run: args });
const runIn = (stdin: string, ...args: string[]): Step => ({ run: args, stdin });

function add(id: string, description: string, steps: Step[], overlay?: string): void {
  const remove = overlay === undefined ? undefined : overlays[overlay]?.remove;
  cases.push({ id, description, base: "library", ...(overlay === undefined ? {} : { overlay }), ...(remove === undefined ? {} : { remove }), steps });
}

// ---------------------------------------------------------------- cases

rmSync(HERE, { recursive: true, force: true });
base("library");
base("empty-index", { index: { references: null } });
base("no-index", { index: null });
base("bad-index-json", { index: '{"references": [\n' });
base("index-not-list", { index: { references: { "REF-001": {} } } });
base("index-duplicate", { index: { references: [references()[0], references()[0]] } });
base("index-bad-record", { index: { references: [{ id: "REF-1A", source: "assets/a.txt", converted: "assets/a.md", sha256: "0".repeat(64) }] } });
base("index-leaves", { index: { references: [{ id: "REF-001", source: "../outside.txt", converted: "assets/a.md", sha256: "0".repeat(64) }] } });
base("index-absolute", { index: { references: [{ id: "REF-001", source: "/srv/library/a.txt", converted: "assets/a.md", sha256: "0".repeat(64) }] } });
base("index-hash-mismatch", {
  index: { references: [{ ...references()[1], sha256: "a".repeat(64) }, references()[2]] },
});
base("bad-data", { data: { "capabilities.jsonl": `${JSON.stringify(CAP_001)}\n{"id": "CAP-002", \n` } });
base("duplicate-data", { data: { "capabilities.jsonl": `${JSON.stringify(CAP_001)}\n${JSON.stringify(CAP_001)}\n` } });
base("crlf-data", { data: { "requirements.jsonl": `${JSON.stringify(REQ_001)}\r\n\r\n` } });
base("large-index", {
  index: {
    references: Array.from({ length: 300 }, (_, i) => ({
      id: `REF-${String(i + 1).padStart(3, "0")}`,
      source: `assets/_intake/branch-note-${String(i + 1).padStart(3, "0")}.txt`,
      converted: `assets/branch-notes/note-${String(i + 1).padStart(3, "0")}.md`,
      sha256: sha(`note ${i + 1}\n`),
    })),
  },
});

add("status-fresh", "status and next on a fresh queue (every source pending)", [run("status"), run("next"), run("next", "--count", "3"), run("next", "--stage", "review")]);
add("next-count-zero", "next --count 0 is refused", [run("next", "--count", "0")]);
add("next-count-negative", "next --count -2 is refused", [run("next", "--count", "-2")]);
add("show-group", "show a source with two converted files, before and after start", [run("show", "REF-003"), run("start", "REF-002"), run("show", "REF-002")]);
add("templates", "template for every row type", ["requirement", "capability", "persona", "test-case", "result", "run", "finding"].map((t) => run("template", t)));
add("start-twice", "start creates the review; a second start reports it exists", [run("start", "REF-001"), run("start", "REF-001"), run("check", "REF-001"), run("next", "--stage", "extract", "--count", "2")]);
add("check-pending", "check before start is pending (fails), unknown ID errors", [run("check", "REF-001"), run("check", "REF-999"), run("show", "REF-999")]);

const minted = review("REF-001", G1, {
  candidates: [
    candidate("renewals", "requirement", REQ_ROW("a")),
    candidate("holds-desk", "capability", {
      title: "Holds shelf",
      summary: "Staff keep holds on a shelf for seven days.",
      source_anchor: "assets/lending-policy/lending-policy.md#L5",
      source_refs: ["assets/lending-policy/lending-policy.md#L5", "REQ-001"],
      description: "A hold waits seven days on the holds shelf.",
      limits: ["Seven days only"],
    }),
  ],
});
add("full-flow", "start, write the review, check, stage, show, decide (approve), publish, status, check, publish again", [
  run("start", "REF-001"),
  put(R1, "full-flow-review.json", minted),
  run("check", "REF-001"),
  run("stage", "REF-001"),
  run("show", "REF-001"),
  run("next", "--stage", "review"),
  run("check", "REF-001"),
  runIn(file("approve-two.json", [{ key: "renewals", review_state: "approved" }, { key: "holds-desk", review_state: "approved", review_note: "Matches the policy." }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  run("check", "REF-001"),
  run("publish", "REF-001"),
  run("status"),
  run("check", "REF-001"),
  run("show", "REF-001"),
  run("publish", "REF-001"),
]);

add("csv-anchors", "a source with two CSV twins: row anchors, a quoted line break, and a row past the end", [
  run("start", "REF-002"),
  put(
    R2,
    "csv-review.json",
    review("REF-002", G2, {
      candidates: [
        candidate("late-night", "requirement", { ...REQ_ROW("csv"), title: "Late night hours", source_anchor: "assets/branch-hours/main-branch.csv#row-3", source_refs: ["assets/branch-hours/main-branch.csv#row-3", "assets/branch-hours/east-branch.csv#row-2"] }),
        candidate("past-end", "requirement", { ...REQ_ROW("end"), source_anchor: "assets/branch-hours/main-branch.csv#row-9", source_refs: [] }),
      ],
    }),
  ),
  run("check", "REF-002"),
  put(
    R2,
    "csv-review-fixed.json",
    review("REF-002", G2, {
      candidates: [candidate("late-night", "requirement", { ...REQ_ROW("csv"), title: "Late night hours", source_anchor: "assets/branch-hours/main-branch.csv#row-4", source_refs: ["assets/branch-hours/main-branch.csv#row-4", "assets/branch-hours/east-branch.csv#row-3"] })],
    }),
  ),
  run("check", "REF-002"),
  run("stage", "REF-002"),
]);

add("unicode-faq", "a source with a byte order mark, CRLF lines, and non-ASCII text; Unicode in the rows", [
  run("start", "REF-004"),
  put(
    R4,
    "faq-review.json",
    review("REF-004", G4, {
      candidates: [candidate("cafe-corner", "requirement", { ...REQ_ROW("faq"), title: "Caf\u00e9 corner \u66f8 \u{1f4da}", summary: "Patrons read in the caf\u00e9 corner \u2014 quietly.", source_anchor: "assets/patron-faq/patron-faq.md#L3", source_refs: ["assets/patron-faq/patron-faq.md#L4"] })],
    }),
  ),
  run("check", "REF-004"),
  run("stage", "REF-004"),
  runIn(file("approve-cafe.json", [{ key: "cafe-corner", review_state: "approved" }]), "decide", "REF-004", "--reviewer", "Bibliot\u00e9caire"),
  run("publish", "REF-004"),
]);

const broken = review("REF-005", G5, {
  source_sha256: "b".repeat(64),
  source_check: { result: "repaired", notes: "", repairs: [] },
  references: [{ id: "REF-005", converted: "assets/fines/other.md", outcome: "blocked", note: "" }, { id: "REF-005", converted: "assets/fines/fines.md", outcome: "maybe" }, { converted: "x" }],
  reviewed_at: "last week",
  unresolved: ["", 3],
  applied: { ghost: { id: "REQ-009", action: "minted" } },
  extraction_ids: "EXT-001",
  publication_review: { reviewed_by: "Circulation Analyst", reviewed_at: "soon" },
  candidates: [
    "not an object",
    candidate("dup", "requirement", REQ_ROW("x", "assets/fines/fines.md#L3")),
    candidate("dup", "requirement", REQ_ROW("y", "assets/fines/fines.md#L3")),
    { key: "", type: "requirement" },
    { key: "badtype", type: "book" },
    candidate("anchors", "requirement", { ...REQ_ROW("z", "system/assets/fines/fines.md#L1"), source_refs: ["assets/fines/fines.md#L99", "https://example.org/x#y", "notes", "assets/fines/fines.md#row-1"], related: ["CAP-1", "REQ-001"], acceptance_refs: ["TC-001", "docs/tests/fines.md#t1", "RES-1", "maybe"], systems: ["both"], env: "prod", tags: "fines" }),
    candidate("status", "finding", { title: "", summary: "  ", status: "qualified", doc_anchor: "docs/", source_anchor: "assets/fines/fines.md#L3", observed: "", basis_refs: ["RUN-001", "notes.md", 4], confidence: "certain", implications: ["What about lost books?", "REQ-001", "A narrative note"], created_at: "2026-13-45", redirect: {} }, { action: "minted", target_id: "FIND-001" }),
    candidate("result-row", "result", { title: "Result", summary: "A result", source_anchor: "assets/fines/fines.md#L3", target_id: "PB-001", outcome: "maybe", evidence_refs: ["RUN-001", "assets/fines/fines.md#L3", "EXT-1"] }),
    candidate("run-row", "run", { title: "Run", summary: "A run", source_anchor: "assets/fines/fines.md#L3", playbook_id: "PLAY-1", started_at: "nope", ended_at: "later", inputs: [], outputs: "x", status: "running" }),
    candidate("tc-row", "test-case", { title: "Case", summary: "A case", source_anchor: "assets/fines/fines.md#L3", verifies: ["REQ-001", "FIND-001", ""], preconditions: [], steps: ["Return a late book"], expected: "" }),
    candidate("persona-row", "persona", { title: "Patron", summary: "A patron", source_anchor: "assets/fines/fines.md#L3", status: "superseded", description: "A patron who borrows books.", goals: ["Borrow"], needs: ["Renew"] }),
    candidate("referenced", "requirement", REQ_ROW("r", "assets/fines/fines.md#L3"), { action: "referenced", target_id: "REQ-1" }),
    candidate("updated", "capability", { ...REQ_ROW("u", "assets/fines/fines.md#L3"), id: "CAP-002" }, { action: "updated", target_id: "CAP-001", base_sha256: "nope", review_state: "held" }),
    candidate("wrong-type", "requirement", REQ_ROW("w", "assets/fines/fines.md#L3"), { action: "referenced", target_id: "REQ-002", review_state: "approved" }),
    { ...candidate("nested", "requirement", { ...REQ_ROW("n", "assets/fines/fines.md#L3"), _stage: {} }), authored_by: " ", reviewed_by: 5, reviewed_at: "never" },
  ],
});
add("needs-repair", "a review with many problems: check lists each one, stage refuses", [run("start", "REF-005"), put(R5, "broken-review.json", broken), run("check", "REF-005"), run("stage", "REF-005"), run("status")]);

add("blocked-and-no-rows", "a blocked source with unresolved notes, and a source with no new rows that completes without publishing rows", [
  run("start", "REF-005"),
  put(
    R5,
    "blocked-review.json",
    review("REF-005", G5, { references: [{ id: "REF-005", converted: "assets/fines/fines.md", outcome: "blocked", note: "The lost-book price list is missing." }], unresolved: ["Which price list applies to lost books?", "Do fines stop at a cap?"] }),
  ),
  run("check", "REF-005"),
  run("stage", "REF-005"),
  run("check", "REF-005"),
  run("start", "REF-006"),
  put(R6, "no-rows-review.json", review("REF-006", G6, { references: [{ id: "REF-006", converted: "assets/holds-notes/holds-notes.md", outcome: "no-new-rows", note: "The notes repeat REQ-001." }] })),
  run("check", "REF-006"),
  run("stage", "REF-006"),
  run("check", "REF-006"),
  runIn(file("no-decisions.json", []), "decide", "REF-006", "--reviewer", "Branch Supervisor"),
  run("publish", "REF-006"),
  run("check", "REF-006"),
  run("status"),
]);

add("update-flow", "stage-update copies a saved row; the edited row is staged, approved, and published over the saved row", [
  run("start", "REF-001"),
  put(R1, "update-review.json", review("REF-001", G1)),
  run("stage-update", "REF-001", "REQ-001", "--key", "fix-limit"),
  run("stage-update", "REF-001", "REQ-001", "--key", "fix-limit"),
  run("stage-update", "REF-001", "REQ-404", "--key", "other"),
  run("check", "REF-001"),
  { run: ["stage", "REF-001"] },
  runIn(file("approve-fix.json", [{ key: "fix-limit", review_state: "approved" }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  run("publish", "REF-001"),
  run("check", "REF-001"),
]);

add("replace-and-decide", "replace-row and decide: good rows, every refusal, held and pending decisions", [
  run("start", "REF-001"),
  put(R1, "replace-review.json", review("REF-001", G1, { candidates: [candidate("renewals", "requirement", REQ_ROW("a")), candidate("hold-time", "requirement", REQ_ROW("b", "assets/lending-policy/lending-policy.md#L5"))] })),
  runIn(file("approve-early.json", [{ key: "renewals", review_state: "approved" }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  run("stage", "REF-001"),
  runIn(file("replacement-row.json", row("requirement", { ...REQ_ROW("c"), title: "Renewal rule, corrected" })), "replace-row", "REF-001", "renewals"),
  runIn(file("replacement-with-stage.json", { ...row("requirement", REQ_ROW("d")), _stage: {} }), "replace-row", "REF-001", "renewals"),
  runIn(file("replacement-bad.json", row("requirement", { ...REQ_ROW("e"), title: "" })), "replace-row", "REF-001", "renewals"),
  runIn(file("replacement-row.json", row("requirement", { ...REQ_ROW("c"), title: "Renewal rule, corrected" })), "replace-row", "REF-001", "nobody"),
  runIn(file("not-json.txt", "{not json\n"), "replace-row", "REF-001", "renewals"),
  runIn(file("approve-same.json", [{ key: "renewals", review_state: "approved" }]), "decide", "REF-001", "--reviewer", "Circulation Analyst"),
  runIn(file("held-no-note.json", [{ key: "renewals", review_state: "held" }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  runIn(file("unknown-key.json", [{ key: "ghost", review_state: "approved" }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  runIn(file("bad-state.json", [{ key: "renewals", review_state: "yes" }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  runIn(file("not-list.json", { key: "renewals" }), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  runIn(file("held-and-pending.json", [{ key: "renewals", review_state: "held", review_note: "Check the renewal count." }, { key: "hold-time", review_state: "pending" }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  run("check", "REF-001"),
  run("publish", "REF-001"),
  runIn(file("approve-renewals.json", [{ key: "renewals", review_state: "approved" }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  runIn(file("replacement-row.json", row("requirement", { ...REQ_ROW("c"), title: "Renewal rule, corrected" })), "replace-row", "REF-001", "renewals"),
  run("publish", "REF-001"),
  run("status"),
]);

add("author-rules", "stage --author: a blank name, a new candidate after staging needs a name, the original author is kept", [
  run("start", "REF-001"),
  put(R1, "author-review.json", review("REF-001", G1, { candidates: [candidate("renewals", "requirement", REQ_ROW("a"))] })),
  run("stage", "REF-001", "--author", "  "),
  run("stage", "REF-001"),
]);

add("stage-before-review", "stage before the source review is named and dated", [run("start", "REF-001"), run("stage", "REF-001"), run("publish", "REF-001"), runIn(file("approve-none.json", []), "decide", "REF-001", "--reviewer", "Branch Supervisor")]);

add("legacy-review", "an older review (no format_version 2): check reads it; stage refuses it", [
  put(R1, "legacy-review.json", { source: G1.source, source_sha256: sha(SOURCES[G1.source]!), reviewed_by: "Circulation Analyst", reviewed_at: "2026-01-02", source_check: { result: "matched", notes: "Checked.", repairs: [] }, references: [{ id: "REF-001", converted: "assets/lending-policy/lending-policy.md", outcome: "reviewed" }], candidates: [{ key: "old", type: "requirement", row: { type: "requirement", status: "draft", title: "Old need", summary: "An old need.", source_anchor: "assets/lending-policy/lending-policy.md#L3", source_refs: [], related: [], acceptance_refs: [] } }], unresolved: [], applied: {}, extraction_ids: [] }),
  run("check", "REF-001"),
  run("show", "REF-001"),
  run("stage", "REF-001"),
]);

add("legacy-review-broken", "an older review with problems, and one with a publication_review (the newer rules)", [
  put(R5, "legacy-broken.json", { source: G5.source, source_sha256: "c".repeat(64), source_check: { result: "partial", notes: "", repairs: "none" }, references: [{ id: "REF-005", converted: "assets/fines/fines.md", outcome: "no-new-rows" }], candidates: [{ key: "old", type: "requirement", row: { type: "requirement", status: "active", id: "REQ-009", title: "", summary: "x", source_anchor: "assets/fines/fines.md#L9", source_refs: "x", related: [] } }, { key: "old", type: "requirement", row: {} }, { key: "kind", type: "book", row: {} }], unresolved: "none", applied: [], extraction_ids: ["EXT-1", 7] }),
  run("check", "REF-005"),
  put(R5, "legacy-modern.json", { source: G5.source, source_sha256: sha(SOURCES[G5.source]!), reviewed_by: "Circulation Analyst", reviewed_at: "2026-01-02", publication_review: { reviewed_by: "Circulation Analyst", reviewed_at: "2026-01-03" }, source_check: { result: "matched", notes: "Checked.", repairs: [] }, references: [{ id: "REF-005", converted: "assets/fines/fines.md", outcome: "reviewed" }], candidates: [candidate("fine-rate", "requirement", REQ_ROW("f", "assets/fines/fines.md#L3"), { review_state: "approved" })], unresolved: [], applied: { "fine-rate": { id: "REQ-001", action: "minted", candidate_sha256: "0" } }, extraction_ids: [] }),
  run("check", "REF-005"),
]);

add("bad-review-json", "a review file that is not JSON, and one that is not an object", [
  run("start", "REF-001"),
  put(R1, "bad-review.json", "{\"format_version\": 2,\n"),
  run("check", "REF-001"),
  run("status"),
  put(R1, "list-review.json", [1, 2]),
  run("check", "REF-001"),
]);

add("index-errors-empty", "an index with references null is an empty queue", [run("status"), run("next")], "empty-index");
add("index-errors-missing", "the reference index is missing", [run("status")], "no-index");
add("index-errors-json", "the reference index is not valid JSON", [run("status")], "bad-index-json");
add("index-errors-shape", "the references value is not a list", [run("status")], "index-not-list");
add("index-errors-duplicate", "a duplicate reference ID", [run("status")], "index-duplicate");
add("index-errors-record", "a reference record with a bad ID", [run("status")], "index-bad-record");
add("index-errors-leaves", "a source path that leaves the project folder", [run("status")], "index-leaves");
add("index-errors-absolute", "an absolute source path", [run("status")], "index-absolute");
add("index-errors-hash", "two converted files of one source with different hashes", [run("status")], "index-hash-mismatch");
add("data-errors-json", "a canonical data file with a line that is not JSON", [run("check", "REF-001")], "bad-data");
add("data-errors-duplicate", "a canonical data file with a duplicate ID", [run("check", "REF-001")], "duplicate-data");
add("data-crlf", "CRLF and blank lines in a canonical data file; the replaced row keeps the other bytes", [
  run("start", "REF-001"),
  put(R1, "crlf-review.json", review("REF-001", G1)),
  run("stage-update", "REF-001", "REQ-001", "--key", "fix-limit"),
  run("stage", "REF-001"),
  runIn(file("approve-fix.json", [{ key: "fix-limit", review_state: "approved" }]), "decide", "REF-001", "--reviewer", "Branch Supervisor"),
  run("publish", "REF-001"),
], "crlf-data");
add("large-queue", "a queue of 300 sources", [run("status"), run("next", "--count", "250"), run("show", "REF-300")], "large-index");

const longRun = row("run", { title: "Long run", summary: "x".repeat(70 * 1024), source_anchor: "assets/fines/fines.md#L3", started_at: "2026-01-12" });
add("row-too-long", "a run row of more than 64 KiB is refused before any write", [
  run("start", "REF-005"),
  put(R5, "long-run-review.json", review("REF-005", G5, { candidates: [{ key: "long-run", type: "run", action: "minted", review_state: "pending", row: longRun }] })),
  run("stage", "REF-005"),
  runIn(file("approve-long.json", [{ key: "long-run", review_state: "approved" }]), "decide", "REF-005", "--reviewer", "Branch Supervisor"),
  run("publish", "REF-005"),
]);

add("staged-file-errors", "a staged file with a line that is not JSON, and one with no _stage block", [
  run("start", "REF-001"),
  put("extractions/staging/requirements.jsonl", "staged-bad.jsonl", '{"type": "requirement"\n'),
  run("check", "REF-001"),
  put("extractions/staging/requirements.jsonl", "staged-no-meta.jsonl", '{"type": "requirement", "title": "x"}\n'),
  run("check", "REF-001"),
  put("extractions/staging/requirements.jsonl", "staged-wrong-type.jsonl", '{"type": "capability", "_stage": {"ref_id": "REF-001", "key": "x"}}\n'),
  run("show", "REF-001"),
]);

add("usage-errors", "argument errors (argparse in the script)", [run(), run("bogus"), run("show"), run("template", "book"), run("next", "--stage", "later"), run("stage-update", "REF-001", "REQ-001"), run("decide", "REF-001"), run("check", "REF-001", "extra")]);

// ---------------------------------------------------------------- write

for (const [name, text] of files) write(`files/${name}`, text);
write("cases.json", json({ $comment: "Cases of buildos extract bulk (W1 R7 P9 t1), generated by generate-bulk-extract.ts. Each case copies bases/<base>/ into a fresh project folder, lays overlays/<overlay>/ over it and removes its remove paths, then runs its steps in order: run (the subcommand and its arguments, with stdin from files/<name>), write (a file from files/ into the project), or remove.", cases }));
write(".gitattributes", "# Fixture bytes stay as they are on every OS (CRLF, byte order marks).\n* -text whitespace=-blank-at-eol,-blank-at-eof,-space-before-tab,cr-at-eol\n");
process.stdout.write(`wrote ${cases.length} cases\n`);
