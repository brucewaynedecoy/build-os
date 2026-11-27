/**
 * `buildos fitgap workbook` (W1 R7 P9 t5): the port of `cmd_workbook` in
 * `fitgap.py`. It builds the same sheets, cells, styles, tables, links,
 * conditional formats, and page setup that the script set through openpyxl,
 * writes the `.xlsx` with hand-written Office Open XML parts
 * (`xlsx-write.ts`) zipped by the CLI's ZIP port (the bundled `fflate`),
 * then reads the bytes back (`xlsx-read.ts`) and runs the script's checks
 * on what it read. The file is written only when every check passes
 * (divergence SD-12: the script kept a workbook that failed a check).
 */

import { basename, extname } from "node:path";
import { isDict, isList, isPyNumber, PyFloat, pyNumber, pyRepr, pyLen, type PyDict, type PyValue } from "../shared/py-json.ts";
import { READ_LIMITS } from "../shared/read-limits.ts";
import { commitPlan, die, ownerColors, print, reqsOf, type FitgapContext, type Frame, type System, capOf, lower } from "./fitgap.ts";
import { DESCOPED, MARKS, VERDICTS } from "./vocab.ts";
import { FitgapShapeError, get, getN, hashKey, idx, iter, joinBar, or, pyCompare, sortedBy, str, truthy } from "./py.ts";
import { columnLetter as L, newSheet, type XAlignment, type XCell, type XFont, type XSheet, type XStyle, type XValue, type XWorkbook, type XlsxZip } from "./xlsx-model.ts";
import { readWorkbook } from "./xlsx-read.ts";
import { writeWorkbookParts, XML_FORBIDDEN } from "./xlsx-write.ts";

export type { XlsxZip } from "./xlsx-model.ts";

const VERDICT_MEANING: [string, string][] = [
  ["native", "Every baseline requirement is met out of the box."],
  ["configurable", "Every requirement is met, some only after configuration. No code."],
  ["partial", "Part of the capability is covered. Something the baseline needs is missing or weaker."],
  ["unreleased", "The target names every requirement, but none is in the release assessed. Wait, do not build."],
  ["gap", "No requirement is met, even in part. Extension, ISV or process change."],
  [DESCOPED, "The organisation does not need any requirement of this capability in the target. Not scored."],
];
const MARK_MEANING: [string, string][] = [
  ["met", "The target does this out of the box, at comparable depth."],
  ["configured", "The target does this after setup or configuration, with no code."],
  ["partly", "The target does part of this, or does it in a weaker way."],
  ["unreleased", "The target names this, but it is not in the release assessed."],
  ["not_met", "The target sources have no counterpart."],
  [DESCOPED, "The organisation decided it does not need this in the target. No points; left out of the fit score."],
];
const TODO_TYPE_MEANING: [string, string][] = [
  ["decision", "A business decision the owner must make before the build can be designed."],
  ["research", "Find and compare options (products, APIs, approaches) and recommend one."],
  ["build", "Custom development: code, plug-ins, integrations, templates."],
  ["configure", "Set up the target with no code: fields, forms, views, rules, roles."],
  ["vendor_question", "A question only the vendor can answer."],
  ["test", "Prove a claimed capability in the target environment before relying on it."],
  ["data", "Gather, clean, map or migrate data."],
];
const CONF_MEANING: [string, string][] = [
  ["high", "The target sources speak directly to the marks that decide the verdict."],
  ["medium", "Some deciding marks rest on inference from nearby documentation."],
  ["low", "The sources are silent or unclear on the deciding marks. A question, not a conclusion."],
];
const EFFORT_MEANING: [string, string][] = [
  ["none", "Nothing to do."],
  ["low", "Configuration or a small process change. Days."],
  ["medium", "Several configurations, data work or a small extension. Weeks."],
  ["high", "A custom build, an ISV product or a large process change. Months."],
  ["unknown", "The sources do not say enough to tell."],
];
const WHY_MEANING: [string, string][] = [
  ["decision", "The business uses this today (maturity proven or available), effort is high or unknown, and the verdict is not native."],
  ["must_objective_gap", "It serves a must objective and its fit score is under 50."],
  ["live_loss", "Verdict gap on a capability with maturity proven."],
  ["open_question", "Confidence is low. Put it to the vendor before deciding."],
];

const VERDICT_COLORS: Record<string, [string, string]> = {
  native: ["C6EFCE", "006100"],
  configurable: ["E2F0D9", "375623"],
  partial: ["FFEB9C", "9C5700"],
  unreleased: ["DDEBF7", "1F4E78"],
  gap: ["FFC7CE", "9C0006"],
  [DESCOPED]: ["EDEDED", "595959"],
};
const MARK_COLORS: Record<string, [string, string]> = {
  met: ["C6EFCE", "006100"],
  configured: ["E2F0D9", "375623"],
  partly: ["FFEB9C", "9C5700"],
  unreleased: ["DDEBF7", "1F4E78"],
  not_met: ["FFC7CE", "9C0006"],
  [DESCOPED]: ["EDEDED", "595959"],
};
const MAX_LINES = 8;

const TOP: XAlignment = { vertical: "top" };
const WRAP: XAlignment = { vertical: "top", wrap: true };
const HEAD: XAlignment = { vertical: "center", wrap: true };
const LINK: XFont = { color: "0563C1", underline: "single" };
const H1: XFont = { bold: true, size: 16 };
const H2: XFont = { bold: true, size: 12, color: "FFFFFF" };
const BOLD: XFont = { bold: true };
const SECTION = "1F4E78";
const THEAD = "D9E1F2";

/** One cell being set, as an openpyxl `Cell`. */
class Cell {
  readonly c: XCell;
  constructor(c: XCell) {
    this.c = c;
  }
  set font(f: XFont) {
    this.c.style.font = f;
  }
  set fill(f: string) {
    this.c.style.fill = f;
  }
  set alignment(a: XAlignment) {
    this.c.style.alignment = a;
  }
  set numFmt(n: string) {
    this.c.style.numFmt = n;
  }
  get value(): XValue {
    return this.c.value;
  }
}

/** The control characters openpyxl drops from cell text (`ILLEGAL_CHARACTERS_RE`). */
const ILLEGAL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
/** The other characters XML 1.0 cannot hold (U+FFFE, U+FFFF, a lone surrogate), which openpyxl wrote into a part that then did not parse. */
const XML_EXTRA = /[\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
/** How many `XML_EXTRA` characters the current workbook's text lost (reported on stderr). */
let removedExtra = 0;

/**
 * W1 R7 P9 review round 2 (P9-R2-13, divergence SD-19): the one XML-safe
 * rule for free text in any part (cells, shared strings, the document
 * title): openpyxl's control characters are dropped as the script did, and
 * the other characters XML cannot hold are dropped and counted. A code or a
 * name that holds one is refused instead (`checkSheetNames`).
 */
function xmlSafe(text: string): string {
  const kept = text.replace(ILLEGAL, "");
  const safe = kept.replace(XML_EXTRA, "");
  removedExtra += kept.length - safe.length;
  return safe;
}

class Ws {
  readonly s: XSheet;
  constructor(s: XSheet) {
    this.s = s;
  }
  cell(row: number, col: number): Cell {
    const key = `${row},${col}`;
    let c = this.s.cells.get(key);
    if (c === undefined) {
      c = { value: null, style: {} };
      this.s.cells.set(key, c);
    }
    return new Cell(c);
  }
  at(ref: string): Cell {
    const m = /^([A-Z]+)([0-9]+)$/.exec(ref)!;
    let col = 0;
    for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
    return this.cell(Number(m[2]), col);
  }
  width(col: number, w: number): void {
    this.s.colWidths.set(col, w);
  }
  height(row: number, h: number): void {
    this.s.rowHeights.set(row, h);
  }
}

/** `clean(v)` and the value openpyxl stores. */
function clean(v: PyValue | undefined): XValue {
  let value: PyValue = v ?? null;
  if (isList(value)) value = joinBar(value.map((x) => str(x)));
  if (typeof value === "string") {
    value = xmlSafe(value);
    if (pyLen(value) > 32000) value = `${[...value].slice(0, 32000).join("")} \u2026`;
    return value === "" ? null : { t: "s", v: value };
  }
  if (value === null) return null;
  if (typeof value === "boolean") return { t: "b", v: value };
  if (isPyNumber(value)) return { t: "n", v: pyNumber(value) };
  throw new FitgapShapeError(`ValueError: Cannot convert ${pyRepr(value)} to Excel`);
}

function put(ws: Ws, r: number, c: number, v: PyValue | undefined): Cell {
  const cell = ws.cell(r, c);
  cell.c.value = clean(v);
  return cell;
}

function lines(text: PyValue | string, width: number): number {
  const cpl = Math.max(8, Math.trunc(width * 1.2));
  return str(text as PyValue)
    .split("\n")
    .reduce((n, p) => n + Math.max(1, Math.ceil(pyLen(p) / cpl)), 0);
}

function link(ws: Ws, ref: string, sheet: string, row: number): void {
  // P9-R1-03: an apostrophe inside a sheet name is doubled in a reference, as Excel spells it.
  ws.s.hyperlinks.push({ ref, location: `'${sheet.replaceAll("'", "''")}'!A${row}` });
  ws.at(ref).font = LINK;
}

type Col = [string, number, boolean];

function table(ws: Ws, name: string, cols: Col[], data: PyValue[][], freeze?: string): [Record<string, string>, number, number] {
  const start = 1;
  cols.forEach(([h, w], j0) => {
    const j = j0 + 1;
    const c = put(ws, start, j, h);
    c.font = BOLD;
    c.alignment = HEAD;
    ws.width(j, w);
  });
  ws.height(start, 30);
  const rows = data.length > 0 ? data : [["(none)", ...Array<PyValue>(cols.length - 1).fill(null)]];
  rows.forEach((vals, i0) => {
    const i = start + 1 + i0;
    let n = 1;
    const count = Math.min(cols.length, vals.length);
    for (let j0 = 0; j0 < count; j0++) {
      const [, w, wr] = cols[j0]!;
      const c = put(ws, i, j0 + 1, vals[j0]);
      c.alignment = wr ? WRAP : TOP;
      if (wr && c.value !== null && c.value.t === "s") n = Math.max(n, lines(c.value.v, w));
    }
    if (n > 1) ws.height(i, Math.min(n, MAX_LINES) * 15);
  });
  const last = start + rows.length;
  ws.s.tables.push({ name, ref: `A${start}:${L(cols.length)}${last}`, columns: cols.map(([h]) => h), style: "TableStyleMedium2", showRowStripes: true });
  if (freeze !== undefined) ws.s.freeze = freeze;
  const cm: Record<string, string> = {};
  cols.forEach(([h], j0) => (cm[h] = L(j0 + 1)));
  return [cm, start + 1, last];
}

function palette(ws: Ws, rng: string, colors: Iterable<[string, [string, string]]>): void {
  for (const [val, [bg, fg]] of colors) addRule(ws, { type: "cellIs", sqref: rng, operator: "equal", formula: [`"${val}"`], dxf: { fill: bg, fontColor: fg } });
}

function fitScale(ws: Ws, rng: string): void {
  addRule(ws, { type: "colorScale", sqref: rng, cfvo: ["num:0", "num:50", "num:100"], colors: ["F8696B", "FFEB84", "63BE7B"] });
}

function bars(ws: Ws, rng: string): void {
  addRule(ws, { type: "dataBar", sqref: rng, cfvo: ["num:0", "num:100"], colors: ["5B9BD5"] });
}

function addRule(ws: Ws, rule: Omit<XSheet["rules"][number], "priority">): void {
  ws.s.rules.push({ ...rule, priority: ws.s.rules.length + 1 });
}

function landscape(ws: Ws): void {
  ws.s.landscape = true;
}

function section(ws: Ws, r: number, text: string, span = 2): number {
  for (let j = 1; j <= span; j++) ws.cell(r, j).fill = SECTION;
  put(ws, r, 1, text).font = H2;
  return r + 1;
}

function pairs(ws: Ws, r: number, items: [PyValue, PyValue][], head?: string[]): number {
  if (head !== undefined) {
    head.forEach((h, j0) => {
      const c = put(ws, r, j0 + 1, h);
      c.font = BOLD;
      c.fill = THEAD;
    });
    r += 1;
  }
  for (const [k, v] of items) {
    put(ws, r, 1, k).alignment = TOP;
    const c = put(ws, r, 2, v);
    c.alignment = WRAP;
    const n = lines(or(v, ""), 110);
    if (n > 1) ws.height(r, n * 15);
    r += 1;
  }
  return r + 1;
}

function head(ws: Ws, r: number, labels: string[]): number {
  labels.forEach((h, j0) => {
    const c = put(ws, r, j0 + 1, h);
    c.font = BOLD;
    c.fill = THEAD;
    c.alignment = HEAD;
  });
  return r + 1;
}

function avg(xs: PyValue[]): PyValue {
  const v = xs.filter((x) => x !== null && x !== undefined);
  if (v.length === 0) return null;
  let total = 0;
  for (const x of v) total += pyNumber(x);
  return roundHalfEven(total / v.length);
}

function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

function dividePy(a: PyValue, b: number): PyValue {
  if (b === 0) throw new FitgapShapeError("ZeroDivisionError: division by zero");
  return new PyFloat(pyNumber(a) / b);
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1).toLowerCase();
}

function scoringText(scoring: PyValue, key: string): string {
  const d = idx(scoring, key);
  if (!isDict(d)) throw new FitgapShapeError("AttributeError: object has no attribute 'items'");
  return [...d].map(([k, v]) => `${k} ${pyRepr(v)}`).join(", ");
}

function rankOf(x: PyValue): PyValue {
  const r = getN(x, "objective_rank");
  return r !== null ? r : 99;
}

/** Builds, writes, and checks the workbook. Returns false when a check failed (exit 4). */
export function buildWorkbook(ctx: FitgapContext, fr: Frame, b: System, t: System, g: PyValue, fitgapPath: string, outPath: string | undefined): boolean {
  removedExtra = 0;
  const m = idx(g, "meta");
  const rows = iter(idx(g, "rows")) as PyDict[];
  const tonly = iter(idx(g, "target_only")) as PyDict[];
  const f = idx(g, "findings");
  const todos = iter(or(get(g, "todos"), [])) as PyDict[];
  const trk = iter(or(get(m, "tracks"), [])) as PyDict[];
  const own = iter(or(get(m, "owners"), []));
  const hasPlan = trk.length > 0;
  if (!(pyEqStr(idx(idx(m, "baseline"), "code"), b.code) && pyNumber(idx(idx(m, "baseline"), "capabilities")) === b.caps.length && pyNumber(idx(idx(m, "target"), "capabilities")) === t.caps.length)) {
    die("the fit-gap JSON was merged from different models than the frame names now. Run merge again.");
  }
  const otherModels = modelMismatch(m, rows, tonly, b, t);
  if (otherModels !== undefined) die(`the fit-gap JSON was merged from different models than the frame names now (${otherModels}). Run merge again.`);
  const bc = str(b.code);
  const tc = str(t.code);
  const out = outPath !== undefined && outPath !== "" ? outPath : `${fitgapPath.slice(0, fitgapPath.length - extname(fitgapPath).length)}.xlsx`;
  const S_FG = "Fit-Gap";
  const S_RM = "Requirement Marks";
  const S_DEC = "Decisions";
  const S_TO = "Target Only";
  const S_FIND = "Findings";
  const S_OBJ = "Objectives";
  const S_MAP = "Roadmap";
  const S_TD = "To-Dos";
  const S_BC = `${bc} Capabilities`;
  const S_TC = `${tc} Capabilities`;
  const S_TR = `${tc} Requirements`;
  checkSheetNames([
    ["Read Me", "", ""],
    ["Summary", "", ""],
    [S_OBJ, "", ""],
    [S_FG, "", ""],
    [S_RM, "", ""],
    [S_DEC, "", ""],
    ...(hasPlan ? ([[S_MAP, "", ""], [S_TD, "", ""]] as [string, string, string][]) : []),
    [S_TO, "", ""],
    [S_FIND, "", ""],
    [S_BC, "baseline", bc],
    [S_TC, "target", tc],
    [S_TR, "target", tc],
  ]);

  const fgRow = new Map<string, number>();
  rows.forEach((r, i) => fgRow.set(hashKey(idx(r, "baseline_capability_id")), i + 2));
  const rmRow = new Map<string, number>();
  let k = 2;
  for (const r of rows) {
    rmRow.set(hashKey(idx(r, "baseline_capability_id")), k);
    k += iter(idx(r, "marks")).length;
  }
  const tcRow = new Map<string, number>();
  t.caps.forEach((c, i) => tcRow.set(hashKey(c.get("id")), i + 2));
  const R = new Map<string, PyDict>(rows.map((r) => [hashKey(idx(r, "baseline_capability_id")), r]));
  const rowOf = (id: PyValue): PyDict => {
    const r = R.get(hashKey(id));
    if (r === undefined) throw new FitgapShapeError(`KeyError: ${pyRepr(id)}`);
    return r;
  };
  const lookup = (map: Map<string, number>, id: PyValue): number => {
    const n = map.get(hashKey(id));
    if (n === undefined) throw new FitgapShapeError(`KeyError: ${pyRepr(id)}`);
    return n;
  };
  const cites = new Map<string, number>();
  for (const r of rows) for (const tcid of iter(idx(r, "target_capability_ids"))) cites.set(hashKey(tcid), (cites.get(hashKey(tcid)) ?? 0) + 1);
  const onlyIds = new Set(tonly.map((x) => hashKey(idx(x, "target_capability_id"))));
  const objs = iter(idx(g, "objectives")) as PyDict[];
  const verb = str(idx(m, "mode")) === "replacement" ? "moved to" : "chose";
  const draft = truthy(idx(m, "draft"));
  const title = str(idx(m, "title"));

  const wbSheets: XSheet[] = [];
  const create = (name: string): Ws => {
    const s = newSheet(name);
    wbSheets.push(s);
    return new Ws(s);
  };

  // ---- Read Me
  let ws = create("Read Me");
  ws.width(1, 26);
  ws.width(2, 110);
  let r = 1;
  put(ws, r, 1, title + (draft ? " (DRAFT)" : "")).font = H1;
  r += 1;
  put(ws, r, 1, `Fit-gap analysis, ${str(idx(m, "mode"))} mode. Built ${str(idx(m, "generated"))} from ${basename(fitgapPath)}.`).font = { italic: true, color: "595959" };
  r += 2;
  r = section(ws, r, "What this workbook answers");
  const mb = idx(m, "baseline");
  const mt = idx(m, "target");
  r = pairs(ws, r, [
    ["Question", `If this organisation ${verb} ${str(t.name)}, what would happen to each capability of ${str(b.name)}, and how well would the move serve the project's objectives?`],
    ["Baseline", `${str(b.name)} (${bc}): ${str(idx(mb, "capabilities"))} capabilities, ${str(idx(mb, "requirements"))} requirements marked. Source: ${str(idx(mb, "source"))}`],
    ["Target", `${str(t.name)} (${tc}): ${str(idx(mt, "capabilities"))} capabilities, ${str(idx(mt, "requirements"))} requirements. Source: ${str(idx(mt, "source"))}`],
    ["Objectives", `${objs.length} objectives, confirmed by ${str(or(idx(m, "objectives_confirmed_by"), "nobody yet (draft)"))}.`],
  ]);
  r = section(ws, r, "Sheets");
  let sheetHelp: [PyValue, PyValue][] = [
    ["Summary", "Key numbers, headline findings, verdicts by layer, objective coverage and the top priorities."],
    [S_OBJ, "Each objective with its rank, weight, the capabilities that serve it, their average fit and the worst gaps."],
    [S_FG, `One row per ${bc} capability: verdict, fit score, priority, track, owners, evidence, gap detail and migration note.`],
    [S_RM, `One row per ${bc} requirement: the mark, the ${tc} capabilities that carry it, and a note.`],
    [S_DEC, "The rows that need a decision or a question, ranked by priority, with the reason they are listed."],
  ];
  if (hasPlan) {
    sheetHelp = [
      ...sheetHelp,
      [S_MAP, `Every ${bc} capability placed in a delivery track, in track order and then priority, with its owners and to-dos.`],
      [S_TD, "The to-do list: who owns each item, which track it belongs to, what it is, and the capabilities it unblocks. Filter the Owner column for one party's list."],
    ];
  }
  sheetHelp = [
    ...sheetHelp,
    [S_TO, `${tc} capabilities that no ${bc} requirement uses. Opportunities, not risks.`],
    [S_FIND, "The analyst findings: headlines, one finding per layer, what the target brings, and open questions."],
    [S_BC, `Reference: every ${bc} capability, linked to its fit-gap row.`],
    [S_TC, `Reference: every ${tc} capability, with how many ${bc} rows cite it.`],
    [S_TR, `Reference: every ${tc} requirement. Use it to check the evidence.`],
  ];
  r = pairs(ws, r, sheetHelp);
  r = section(ws, r, "How to read it");
  const scoring = idx(m, "scoring");
  r = pairs(ws, r, [
    ["Start here", `Read the Summary, then the Decisions sheet${hasPlan ? ", the Roadmap and the To-Dos" : ""}. Sort Fit-Gap by Priority, largest first.`],
    [
      "Fit score",
      `0 to 100. The average of the requirement marks: ${scoringText(scoring, "mark_points")}. Requirements marked ${DESCOPED} are left out of the average; a capability with every requirement ${DESCOPED} has no fit score and priority 0.`,
    ],
    [
      "Priority",
      "0 to 100. (100 minus fit) times the objective factor times the maturity factor. A large gap on something the business uses today, serving a must objective, ranks first. Ties are broken by the best objective rank the capability serves.",
    ],
    ["Objective factor", `The highest weight among the objectives the capability serves: ${scoringText(scoring, "objective_factor")}.`],
    ["Maturity factor", `How real the ${bc} capability is today: ${scoringText(scoring, "maturity_factor")}.`],
    ["Partial", "Partial is common by design: any 'yes, but' on one requirement makes the capability partial. Use the fit score and the marks to tell a small partial from a large one."],
    ["Edits", "Every number here is computed from the fit-gap JSON. Change the JSON and build the workbook again. Edits made only in this file do not flow back."],
  ]);
  r = section(ws, r, "Verdicts (read off the marks)");
  r = pairs(ws, r, VERDICT_MEANING);
  r = section(ws, r, "Requirement marks");
  r = pairs(ws, r, MARK_MEANING);
  r = section(ws, r, "Confidence");
  r = pairs(ws, r, CONF_MEANING);
  r = section(ws, r, "Effort to close the gap");
  r = pairs(ws, r, EFFORT_MEANING);
  if (hasPlan) {
    r = section(ws, r, "Delivery tracks");
    r = pairs(
      ws,
      r,
      trk.map((tr) => [`${str(idx(tr, "order"))}. ${str(idx(tr, "name"))}`, (truthy(get(tr, "timing")) ? `${str(get(tr, "timing"))}. ` : "") + str(or(get(tr, "description"), ""))]),
    );
    r = section(ws, r, "Owners");
    const roles = or(get(m, "owner_roles"), new Map());
    r = pairs(
      ws,
      r,
      own.map((o) => [o, get(roles, str(o), "") ?? ""]),
    );
    r = section(ws, r, "To-do types");
    r = pairs(ws, r, TODO_TYPE_MEANING);
  }
  r = section(ws, r, "Why a row is listed");
  pairs(ws, r, WHY_MEANING);

  // ---- Summary
  ws = create("Summary");
  [16, 44, 13, 13, 13, 13, 13, 13, 13, 44].forEach((w, j) => ws.width(j + 1, w));
  r = 1;
  put(ws, r, 1, title + (draft ? " (DRAFT)" : "")).font = H1;
  r += 1;
  put(ws, r, 1, `${bc} scored against ${tc}. ${capitalize(str(idx(m, "mode")))} mode. Built ${str(idx(m, "generated"))}.`).font = { italic: true, color: "595959" };
  r += 2;
  r = section(ws, r, "Key numbers", 10);
  const C = idx(m, "counts");
  const marksCount = idx(C, "marks");
  let keyNumbers: [string, PyValue][] = [
    [`${bc} capabilities scored`, idx(mb, "capabilities")],
    [`${bc} requirements marked`, idx(mb, "requirements")],
    [`${bc} requirements descoped (not needed in ${tc})`, get(marksCount, DESCOPED, 0) ?? 0],
    [`${tc} capabilities`, idx(mt, "capabilities")],
    ["Average fit score (descoped excluded)", idx(C, "average_fit")],
    ["Rows listed for a decision", rows.filter((x) => truthy(idx(x, "why_listed"))).length],
    ["Open questions (low confidence)", idx(idx(C, "why_listed"), "open_question")],
    [`${tc}-only capabilities`, idx(C, "target_only")],
  ];
  if (hasPlan) {
    const byOwner = or(get(C, "todos_by_owner"), new Map());
    keyNumbers = [...keyNumbers, ["To-dos", todos.length], ...own.map((o) => [`  owned by ${str(o)}`, get(byOwner, str(o), 0) ?? 0] as [string, PyValue])];
  }
  for (const [label, val] of keyNumbers) {
    ws.s.merges.push(`A${r}:B${r}`);
    put(ws, r, 1, label);
    put(ws, r, 3, val).font = { bold: true, size: 13 };
    r += 1;
  }
  r += 1;
  r = section(ws, r, "Headline findings", 10);
  const headlines = iter(or(get(f, "headline"), ["(draft: no findings yet)"]));
  headlines.forEach((h, i) => {
    put(ws, r, 1, i + 1).alignment = TOP;
    ws.s.merges.push(`B${r}:J${r}`);
    const c = put(ws, r, 2, h);
    c.alignment = WRAP;
    ws.height(r, Math.max(15, lines(h, 200) * 15));
    r += 1;
  });
  r += 1;
  r = section(ws, r, "Verdicts", 10);
  r = head(ws, r, ["Verdict", "Meaning", "Capabilities", "Share"]);
  for (const [v, meaning] of VERDICT_MEANING) {
    const n = idx(idx(C, "verdicts"), v);
    const c = put(ws, r, 1, v);
    c.fill = VERDICT_COLORS[v]![0];
    c.font = { color: VERDICT_COLORS[v]![1], bold: true };
    put(ws, r, 2, meaning).alignment = WRAP;
    ws.height(r, 30);
    put(ws, r, 3, n);
    put(ws, r, 4, dividePy(n, rows.length)).numFmt = "0%";
    r += 1;
  }
  r += 1;
  r = head(ws, r, ["Mark", "Meaning", "Requirements", "Share"]);
  const nm = [...(isDict(marksCount) ? marksCount.values() : [])].reduce<number>((a, x) => a + pyNumber(x), 0);
  for (const [k_, meaning] of MARK_MEANING) {
    const c = put(ws, r, 1, k_);
    c.fill = MARK_COLORS[k_]![0];
    c.font = { color: MARK_COLORS[k_]![1], bold: true };
    put(ws, r, 2, meaning).alignment = WRAP;
    put(ws, r, 3, idx(marksCount, k_));
    put(ws, r, 4, dividePy(idx(marksCount, k_), nm)).numFmt = "0%";
    r += 1;
  }
  r += 1;
  r = section(ws, r, "Verdicts by layer", 10);
  r = head(ws, r, ["Layer", "Name", "Capabilities", ...VERDICTS, "Average fit"]);
  let first = r;
  for (const lay of b.layers) {
    const lr = rows.filter((x) => pyEqStr(idx(x, "layer_code"), lay.get("code")!));
    if (lr.length === 0) continue;
    const vals: PyValue[] = [lay.get("code")!, lay.get("name")!, lr.length, ...VERDICTS.map((v) => lr.filter((x) => idx(x, "verdict") === v).length), avg(lr.map((x) => idx(x, "fit_score")))];
    vals.forEach((v, j) => put(ws, r, j + 1, v));
    r += 1;
  }
  if (r > first) {
    const lv = L(3 + VERDICTS.length);
    const lf = L(4 + VERDICTS.length);
    addRule(ws, { type: "colorScale", sqref: `D${first}:${lv}${r - 1}`, cfvo: ["min", "max"], colors: ["FFFFFF", "F4B183"] });
    fitScale(ws, `${lf}${first}:${lf}${r - 1}`);
  }
  r += 1;
  if (hasPlan) {
    r = section(ws, r, "To-dos by track and owner", 10);
    r = head(ws, r, ["Order", "Track", ...own.map((o) => str(o)), "Total"]);
    for (const tr of trk) {
      const tt = todos.filter((x) => pyEqStr(idx(x, "track"), idx(tr, "id")));
      const vals: PyValue[] = [idx(tr, "order"), idx(tr, "name"), ...own.map((o) => tt.filter((x) => pyEqStr(idx(x, "owner"), o)).length), tt.length];
      vals.forEach((v, j) => (put(ws, r, j + 1, v).alignment = j + 1 === 2 ? WRAP : TOP));
      r += 1;
    }
    r += 1;
  }
  r = section(ws, r, "Objective coverage", 10);
  r = head(ws, r, ["Objective", "Name", "Rank", "Weight", "Capabilities", "Average fit", "Partial", "Gap", capitalize(DESCOPED), "Worst gaps"]);
  first = r;
  for (const o of sortedBy(objs, (o) => [getN(o, "rank") !== null ? getN(o, "rank") : 99, idx(o, "id")])) {
    const verdicts = idx(o, "verdicts");
    const vals: PyValue[] = [idx(o, "id"), idx(o, "name"), getN(o, "rank"), idx(o, "weight"), idx(o, "linked_capabilities"), idx(o, "average_fit"), idx(verdicts, "partial"), idx(verdicts, "gap"), get(verdicts, DESCOPED, 0) ?? 0, iter(idx(o, "top_gaps")).slice(0, 3)];
    vals.forEach((v, j) => (put(ws, r, j + 1, v).alignment = j + 1 === 2 || j + 1 === 10 ? WRAP : TOP));
    r += 1;
  }
  if (r > first) fitScale(ws, `F${first}:F${r - 1}`);
  r += 1;
  r = section(ws, r, "Top 15 priorities", 10);
  if (hasPlan) r = head(ws, r, ["Capability", "Name", "Track", "Verdict", "Fit", "Priority", "Effort", "Owners", "Confidence", "Objectives"]);
  else r = head(ws, r, ["Capability", "Name", "Layer", "Verdict", "Fit", "Priority", "Effort", "Confidence", "Maturity", "Objectives"]);
  first = r;
  for (const x of sortedBy(rows, (x) => [-pyNumber(idx(x, "priority")), rankOf(x), idx(x, "baseline_capability_id")]).slice(0, 15)) {
    const vals: PyValue[] = hasPlan
      ? [idx(x, "baseline_capability_id"), idx(x, "baseline_name"), getN(x, "track_name"), idx(x, "verdict"), idx(x, "fit_score"), idx(x, "priority"), idx(x, "effort"), getN(x, "owners"), idx(x, "confidence"), idx(x, "objective_ids")]
      : [idx(x, "baseline_capability_id"), idx(x, "baseline_name"), idx(x, "layer_code"), idx(x, "verdict"), idx(x, "fit_score"), idx(x, "priority"), idx(x, "effort"), idx(x, "confidence"), idx(x, "baseline_maturity"), idx(x, "objective_ids")];
    vals.forEach((v, j) => (put(ws, r, j + 1, v).alignment = j + 1 === 2 || j + 1 === 3 ? WRAP : TOP));
    link(ws, `A${r}`, S_FG, lookup(fgRow, idx(x, "baseline_capability_id")));
    r += 1;
  }
  if (r > first) {
    palette(ws, `D${first}:D${r - 1}`, Object.entries(VERDICT_COLORS));
    fitScale(ws, `E${first}:E${r - 1}`);
    bars(ws, `F${first}:F${r - 1}`);
  }

  // ---- Objectives
  ws = create(S_OBJ);
  let cols: Col[] = [
    ["Objective", 11, false],
    ["Name", 28, true],
    ["Rank", 7, false],
    ["Weight", 9, false],
    ["Statement", 60, true],
    ["Measure", 40, true],
    ["Source", 24, true],
    ["Capabilities", 12, false],
    ["Average Fit", 10, false],
    ...VERDICTS.map((v): Col => [capitalize(v), 12, false]),
    ["Worst Gaps", 60, true],
    [`${tc}-Only Opportunities`, 30, true],
  ];
  let data: PyValue[][] = objs.map((o) => [
    idx(o, "id"),
    idx(o, "name"),
    getN(o, "rank"),
    idx(o, "weight"),
    idx(o, "statement"),
    getN(o, "measure"),
    getN(o, "source"),
    idx(o, "linked_capabilities"),
    idx(o, "average_fit"),
    ...VERDICTS.map((v) => get(idx(o, "verdicts"), v, 0) ?? 0),
    iter(idx(o, "top_gaps"))
      .map((gid) => `${str(gid)} ${str(idx(rowOf(gid), "baseline_name"))} (${str(idx(rowOf(gid), "priority"))})`)
      .join(" | "),
    idx(o, "target_only"),
  ]);
  let [cm, a0, a1] = table(ws, "tblObjectives", cols, data, "C2");
  fitScale(ws, `${cm["Average Fit"]}${a0}:${cm["Average Fit"]}${a1}`);
  landscape(ws);

  // ---- Fit-Gap
  ws = create(S_FG);
  const planCols: Col[] = hasPlan
    ? [
        ["Track", 24, true],
        ["Owners", 18, true],
        ["To-Dos", 16, true],
      ]
    : [];
  cols = [
    ["Layer", 8, false],
    ["Layer Name", 20, true],
    ["Capability ID", 13, false],
    ["Capability", 32, true],
    ["Status", 13, false],
    ["Maturity", 11, false],
    ["Reqs", 7, false],
    ["Verdict", 13, false],
    ["Fit", 7, false],
    ["Priority", 9, false],
    ["Confidence", 11, false],
    ["Effort", 10, false],
    ["Objectives", 14, true],
    ...planCols,
    ["Met", 7, false],
    ["Configured", 8, false],
    ["Partly", 7, false],
    ["Unreleased", 8, false],
    ["Not Met", 7, false],
    ["Descoped", 8, false],
    [`${tc} IDs`, 24, true],
    [`${tc} Capabilities`, 38, true],
    [`${tc} Statuses`, 16, true],
    ["Evidence", 80, true],
    ["Gap Detail", 60, true],
    ["Migration Note", 60, true],
    ["Why Listed", 20, true],
  ];
  const planVals = (x: PyDict): PyValue[] => (hasPlan ? [getN(x, "track_name"), getN(x, "owners"), getN(x, "todo_ids")] : []);
  data = rows.map((x) => [
    idx(x, "layer_code"),
    capOf(b, idx(x, "baseline_capability_id")).get("layer_name")!,
    idx(x, "baseline_capability_id"),
    idx(x, "baseline_name"),
    idx(x, "baseline_status"),
    idx(x, "baseline_maturity"),
    idx(x, "requirement_count"),
    idx(x, "verdict"),
    idx(x, "fit_score"),
    idx(x, "priority"),
    idx(x, "confidence"),
    idx(x, "effort"),
    idx(x, "objective_ids"),
    ...planVals(x),
    ...MARKS.map((k_) => get(idx(x, "mark_counts"), k_, 0) ?? 0),
    idx(x, "target_capability_ids"),
    idx(x, "target_capability_names"),
    idx(x, "target_statuses"),
    idx(x, "evidence"),
    idx(x, "gap_detail"),
    idx(x, "migration_note"),
    idx(x, "why_listed"),
  ]);
  [cm, a0, a1] = table(ws, "tblFitGap", cols, data, "E2");
  rows.forEach((x, i) => link(ws, `${cm["Capability ID"]}${a0 + i}`, S_RM, lookup(rmRow, idx(x, "baseline_capability_id"))));
  palette(ws, `${cm["Verdict"]}${a0}:${cm["Verdict"]}${a1}`, Object.entries(VERDICT_COLORS));
  fitScale(ws, `${cm["Fit"]}${a0}:${cm["Fit"]}${a1}`);
  bars(ws, `${cm["Priority"]}${a0}:${cm["Priority"]}${a1}`);
  landscape(ws);

  // ---- Requirement Marks
  ws = create(S_RM);
  cols = [
    ["Layer", 8, false],
    ["Capability ID", 13, false],
    ["Capability", 28, true],
    ["Requirement ID", 17, false],
    ["Kind", 10, false],
    ["Status", 13, false],
    ["Requirement", 70, true],
    ["Mark", 12, false],
    ["Points", 8, false],
    [`${tc} IDs`, 24, true],
    ["Note", 60, true],
  ];
  data = [];
  const refs: PyValue[] = [];
  for (const x of rows) {
    const c = capOf(b, idx(x, "baseline_capability_id"));
    const rq = new Map<string, PyDict>(reqsOf(c).map((q) => [hashKey(idx(q, "id")), q]));
    for (const mk of iter(idx(x, "marks"))) {
      const q = rq.get(hashKey(idx(mk, "requirement_id")));
      if (q === undefined) throw new FitgapShapeError(`KeyError: ${pyRepr(idx(mk, "requirement_id"))}`);
      data.push([idx(x, "layer_code"), c.get("id")!, c.get("name")!, idx(q, "id"), idx(q, "kind"), idx(q, "status"), idx(q, "text"), idx(mk, "mark"), get(idx(scoring, "mark_points"), str(idx(mk, "mark"))) ?? null, idx(mk, "target_capability_ids"), idx(mk, "note")]);
      refs.push(c.get("id")!);
    }
  }
  [cm, a0, a1] = table(ws, "tblMarks", cols, data, "E2");
  refs.forEach((cid, i) => link(ws, `${cm["Capability ID"]}${a0 + i}`, S_FG, lookup(fgRow, cid)));
  palette(ws, `${cm["Mark"]}${a0}:${cm["Mark"]}${a1}`, Object.entries(MARK_COLORS));
  landscape(ws);

  // ---- Decisions
  ws = create(S_DEC);
  const listed = sortedBy(
    rows.filter((x) => truthy(idx(x, "why_listed"))),
    (x) => [-pyNumber(idx(x, "priority")), rankOf(x), idx(x, "baseline_capability_id")],
  );
  cols = [
    ["Priority", 9, false],
    ["Why Listed", 22, true],
    ["Capability ID", 13, false],
    ["Capability", 32, true],
    ["Layer", 8, false],
    ["Maturity", 11, false],
    ["Verdict", 13, false],
    ["Fit", 7, false],
    ["Effort", 10, false],
    ["Confidence", 11, false],
    ["Objectives", 14, true],
    ...planCols,
    ["Gap Detail", 60, true],
    ["Migration Note", 60, true],
  ];
  data = listed.map((x) => [
    idx(x, "priority"),
    idx(x, "why_listed"),
    idx(x, "baseline_capability_id"),
    idx(x, "baseline_name"),
    idx(x, "layer_code"),
    idx(x, "baseline_maturity"),
    idx(x, "verdict"),
    idx(x, "fit_score"),
    idx(x, "effort"),
    idx(x, "confidence"),
    idx(x, "objective_ids"),
    ...planVals(x),
    idx(x, "gap_detail"),
    idx(x, "migration_note"),
  ]);
  [cm, a0, a1] = table(ws, "tblDecisions", cols, data, "E2");
  listed.forEach((x, i) => link(ws, `${cm["Capability ID"]}${a0 + i}`, S_FG, lookup(fgRow, idx(x, "baseline_capability_id"))));
  if (listed.length > 0) {
    palette(ws, `${cm["Verdict"]}${a0}:${cm["Verdict"]}${a1}`, Object.entries(VERDICT_COLORS));
    fitScale(ws, `${cm["Fit"]}${a0}:${cm["Fit"]}${a1}`);
    bars(ws, `${cm["Priority"]}${a0}:${cm["Priority"]}${a1}`);
  }
  landscape(ws);

  if (hasPlan) {
    // ---- Roadmap
    ws = create(S_MAP);
    const mapped = sortedBy(rows, (x) => [getN(x, "track_order") !== null ? getN(x, "track_order") : 999, -pyNumber(idx(x, "priority")), rankOf(x), idx(x, "baseline_capability_id")]);
    cols = [
      ["Order", 7, false],
      ["Track", 26, true],
      ["Capability ID", 13, false],
      ["Capability", 34, true],
      ["Layer", 8, false],
      ["Verdict", 13, false],
      ["Fit", 7, false],
      ["Priority", 9, false],
      ["Effort", 10, false],
      ["Owners", 18, true],
      ["Objectives", 14, true],
      ["To-Dos", 18, true],
      ["Migration Note", 70, true],
    ];
    data = mapped.map((x) => [getN(x, "track_order"), getN(x, "track_name"), idx(x, "baseline_capability_id"), idx(x, "baseline_name"), idx(x, "layer_code"), idx(x, "verdict"), idx(x, "fit_score"), idx(x, "priority"), idx(x, "effort"), getN(x, "owners"), idx(x, "objective_ids"), getN(x, "todo_ids"), idx(x, "migration_note")]);
    [cm, a0, a1] = table(ws, "tblRoadmap", cols, data, "D2");
    mapped.forEach((x, i) => link(ws, `${cm["Capability ID"]}${a0 + i}`, S_FG, lookup(fgRow, idx(x, "baseline_capability_id"))));
    palette(ws, `${cm["Verdict"]}${a0}:${cm["Verdict"]}${a1}`, Object.entries(VERDICT_COLORS));
    fitScale(ws, `${cm["Fit"]}${a0}:${cm["Fit"]}${a1}`);
    bars(ws, `${cm["Priority"]}${a0}:${cm["Priority"]}${a1}`);
    landscape(ws);

    // ---- To-Dos
    ws = create(S_TD);
    const ownOrder = new Map<string, number>(own.map((o, i) => [hashKey(o), i]));
    const tsorted = sortedBy(todos, (td) => [ownOrder.get(hashKey(idx(td, "owner"))) ?? 99, idx(td, "track_order"), getN(td, "sequence") !== null ? getN(td, "sequence") : 999, idx(td, "id")]);
    cols = [
      ["Owner", 12, false],
      ["ID", 8, false],
      ["Order", 7, false],
      ["Track", 26, true],
      ["Seq", 6, false],
      ["Type", 15, false],
      ["Title", 44, true],
      ["Detail", 80, true],
      ["Support", 16, true],
      ["Capabilities", 22, true],
      ["Objectives", 14, true],
      ["Max Priority", 9, false],
      ["Depends On", 12, true],
    ];
    data = tsorted.map((td) => [idx(td, "owner"), idx(td, "id"), idx(td, "track_order"), idx(td, "track_name"), getN(td, "sequence"), idx(td, "type"), idx(td, "title"), idx(td, "detail"), getN(td, "support"), getN(td, "capability_ids"), getN(td, "objective_ids"), getN(td, "max_priority"), getN(td, "depends_on")]);
    [cm, a0, a1] = table(ws, "tblToDos", cols, data, "C2");
    const ocol = ownerColors(ctx, own, getN(fr.data, "owner_colors"));
    if (ocol.size > 0) palette(ws, `${cm["Owner"]}${a0}:${cm["Owner"]}${a1}`, ocol);
    bars(ws, `${cm["Max Priority"]}${a0}:${cm["Max Priority"]}${a1}`);
    landscape(ws);
  }

  // ---- Target Only
  ws = create(S_TO);
  cols = [
    ["Capability ID", 14, false],
    ["Capability", 32, true],
    ["Layer", 8, false],
    ["Status", 16, false],
    ["Maturity", 11, false],
    ["Reqs", 7, false],
    ["Objectives", 14, true],
    ["Confidence", 11, false],
    ["Effort", 10, false],
    ["Evidence", 70, true],
    ["Opportunity", 60, true],
  ];
  data = tonly.map((x) => [idx(x, "target_capability_id"), idx(x, "target_name"), idx(x, "layer_code"), idx(x, "target_status"), idx(x, "target_maturity"), idx(x, "requirement_count"), idx(x, "objective_ids"), idx(x, "confidence"), idx(x, "effort"), idx(x, "evidence"), idx(x, "opportunity")]);
  [cm, a0, a1] = table(ws, "tblTargetOnly", cols, data, "C2");
  tonly.forEach((x, i) => link(ws, `${cm["Capability ID"]}${a0 + i}`, S_TC, lookup(tcRow, idx(x, "target_capability_id"))));
  landscape(ws);

  // ---- Findings
  ws = create(S_FIND);
  const ln = new Map<string, PyValue>(b.layers.map((l) => [hashKey(l.get("code")), l.get("name")!]));
  data = [
    ...iter(or(get(f, "headline"), [])).map((h): PyValue[] => ["Headline", null, null, h]),
    ...iter(or(get(f, "layers"), [])).map((x): PyValue[] => ["Layer", idx(x, "layer_code"), ln.get(hashKey(idx(x, "layer_code"))) ?? null, idx(x, "text")]),
    ...iter(or(get(f, "opportunities"), [])).map((h): PyValue[] => [`What ${tc} brings`, null, null, h]),
    ...iter(or(get(f, "open_questions"), [])).map((h): PyValue[] => ["Open question", null, null, h]),
  ];
  table(
    ws,
    "tblFindings",
    [
      ["Section", 18, false],
      ["Layer", 8, false],
      ["Layer Name", 24, true],
      ["Finding", 130, true],
    ],
    data,
    "A2",
  );
  landscape(ws);

  // ---- Reference sheets
  ws = create(S_BC);
  cols = [
    ["Capability ID", 13, false],
    ["Parent ID", 10, false],
    ["Layer", 8, false],
    ["Layer Name", 20, true],
    ["Doc Ref", 8, false],
    ["Type", 14, false],
    ["Status", 13, false],
    ["Maturity", 11, false],
    ["Capability", 32, true],
    ["Summary", 80, true],
    ["Reqs", 7, false],
    ["Verdict", 13, false],
    ["Fit", 7, false],
  ];
  data = b.caps.map((c) => [c.get("id")!, c.get("parent_id")!, c.get("layer_code")!, c.get("layer_name")!, c.get("doc_ref")!, c.get("type")!, c.get("status")!, c.get("maturity")!, c.get("name")!, c.get("summary")!, reqsOf(c).length, idx(rowOf(c.get("id")!), "verdict"), idx(rowOf(c.get("id")!), "fit_score")]);
  [cm, a0, a1] = table(ws, "tblBaselineCaps", cols, data, "B2");
  b.caps.forEach((c, i) => link(ws, `${cm["Capability ID"]}${a0 + i}`, S_FG, lookup(fgRow, c.get("id")!)));
  palette(ws, `${cm["Verdict"]}${a0}:${cm["Verdict"]}${a1}`, Object.entries(VERDICT_COLORS));
  fitScale(ws, `${cm["Fit"]}${a0}:${cm["Fit"]}${a1}`);
  landscape(ws);

  ws = create(S_TC);
  cols = [
    ["Capability ID", 14, false],
    ["Parent ID", 10, false],
    ["Layer", 8, false],
    ["Layer Name", 20, true],
    ["Doc Ref", 8, false],
    ["Type", 14, false],
    ["Status", 16, false],
    ["Maturity", 11, false],
    ["Capability", 32, true],
    ["Summary", 80, true],
    ["Reqs", 7, false],
    [`Cited By ${bc}`, 10, false],
    [`${tc} Only`, 8, false],
  ];
  data = t.caps.map((c) => [c.get("id")!, c.get("parent_id")!, c.get("layer_code")!, c.get("layer_name")!, c.get("doc_ref")!, c.get("type")!, c.get("status")!, c.get("maturity")!, c.get("name")!, c.get("summary")!, reqsOf(c).length, cites.get(hashKey(c.get("id"))) ?? 0, onlyIds.has(hashKey(c.get("id"))) ? "yes" : null]);
  table(ws, "tblTargetCaps", cols, data, "B2");
  landscape(ws);

  ws = create(S_TR);
  cols = [
    ["Requirement ID", 18, false],
    ["Capability ID", 14, false],
    ["Capability", 28, true],
    ["Layer", 8, false],
    ["Kind", 10, false],
    ["Status", 16, false],
    ["Maturity", 11, false],
    ["Requirement", 80, true],
    ["Option Values", 30, true],
  ];
  const trefs: [PyDict, PyDict][] = t.caps.flatMap((c) => reqsOf(c).map((q): [PyDict, PyDict] => [c, q]));
  data = trefs.map(([c, q]) => [idx(q, "id"), c.get("id")!, c.get("name")!, c.get("layer_code")!, idx(q, "kind"), idx(q, "status"), idx(q, "maturity"), idx(q, "text"), idx(q, "option_values")]);
  [cm, a0, a1] = table(ws, "tblTargetReqs", cols, data, "C2");
  trefs.forEach(([c], i) => link(ws, `${cm["Capability ID"]}${a0 + i}`, S_TC, lookup(tcRow, c.get("id")!)));
  landscape(ws);

  // P9-R1-21: the document title is cleaned as cell text is (openpyxl crashed on a control character there).
  const workbook: XWorkbook = { sheets: wbSheets, activeTab: 1, title: documentText(title), creator: "fit-gap-analysis" };
  const bytes = ctx.zip.zip(writeWorkbookParts(workbook));
  if (bytes.length > READ_LIMITS.data) throw new FitgapShapeError(`the workbook would be ${bytes.length} bytes, more than BuildOS reads back`);

  // ---- Check what was written: read the bytes back.
  const wb2 = readWorkbook(ctx.zip.unzip(bytes));
  const fails: string[] = [];
  const chk = (ok: boolean, msg: string): void => {
    print(ctx, `${ok ? "  PASS  " : "  FAIL  "}${msg}`);
    if (!ok) fails.push(msg);
  };
  const sheetNamed = (name: string): XSheet => wb2.sheets.find((s) => s.name === name)!;
  // P9-R1-19: each sheet's last row is found once, with a loop (no argument per cell, no rescan per row).
  const lastRows = new Map<string, number>();
  const maxRow = (name: string): number => {
    let last = lastRows.get(name);
    if (last === undefined) {
      last = 0;
      for (const key of sheetNamed(name).cells.keys()) {
        const row = Number(key.slice(0, key.indexOf(",")));
        if (row > last) last = row;
      }
      lastRows.set(name, last);
    }
    return last;
  };
  const want = ["Read Me", "Summary", S_OBJ, S_FG, S_RM, S_DEC, ...(hasPlan ? [S_MAP, S_TD] : []), S_TO, S_FIND, S_BC, S_TC, S_TR];
  chk(wb2.sheets.length === want.length && wb2.sheets.every((s, i) => s.name === want[i]), "sheets present in order");
  if (hasPlan) {
    chk(maxRow(S_MAP) === rows.length + 1, `${S_MAP} has one row per ${bc} capability (${rows.length})`);
    chk(maxRow(S_TD) === Math.max(1, todos.length) + 1, `${S_TD} lists ${todos.length} to-dos`);
    chk(
      rows.every((x) => truthy(get(x, "track"))),
      "every capability has a track",
    );
  }
  chk(maxRow(S_FG) === rows.length + 1, `${S_FG} has one row per ${bc} capability (${rows.length})`);
  chk(maxRow(S_RM) === refs.length + 1, `${S_RM} has one row per ${bc} requirement (${refs.length})`);
  chk(maxRow(S_TR) === trefs.length + 1, `${S_TR} has one row per ${tc} requirement (${trefs.length})`);
  chk(maxRow(S_DEC) === Math.max(1, listed.length) + 1, `${S_DEC} lists ${listed.length} rows`);
  chk(maxRow(S_TO) === Math.max(1, tonly.length) + 1, `${S_TO} lists ${tonly.length} rows`);
  const fgSheet = sheetNamed(S_FG);
  let outside = 0;
  const fgLast = maxRow(S_FG);
  for (let row = 2; row <= fgLast; row++) {
    const v = fgSheet.cells.get(`${row},8`)?.value ?? null;
    if (!(v !== null && v.t === "s" && VERDICTS.includes(v.v))) outside++;
  }
  chk(outside === 0, "every verdict in vocabulary");
  print(ctx, `workbook[${bc}->${tc}]${draft ? " DRAFT" : ""}: ${want.length} sheets -> ${out}`);
  if (removedExtra > 0) ctx.notices.push(`fitgap: removed ${removedExtra} character${removedExtra === 1 ? "" : "s"} that a workbook cannot hold (U+FFFE, U+FFFF, or a lone surrogate) from the workbook text.`);
  if (fails.length === 0) {
    const plan = ctx.files.plan();
    plan.write(out, bytes);
    commitPlan(ctx, plan);
  }
  void lower;
  return fails.length === 0;
}

/** XML-safe document-property text: the same rule as cell text (P9-R2-13). */
function documentText(text: string): string {
  return xmlSafe(text);
}

/**
 * W1 R7 P9 review round 1 (P9-R1-08, divergence SD-18): the merged file
 * must be made from the models the frame names now. The script compared
 * only the baseline code and the two capability counts, so a merged file of
 * another target with as many capabilities built a workbook that showed the
 * earlier target's analysis under the new target's headings. Also equal
 * here: the target code, both requirement counts the merged file records,
 * the baseline capability IDs of its rows, and every target capability ID
 * it cites or lists as target-only. Review round 2 (P9-R2-09): by ID, in
 * any order, as the workbook joins rows to capabilities by ID; each mark's
 * requirement must be one of its capability's requirements. Returns what
 * differs, or undefined.
 */
function modelMismatch(m: PyValue, rows: PyDict[], tonly: PyDict[], b: System, t: System): string | undefined {
  const meta = (role: string): PyValue => (isDict(m) ? (m.get(role) ?? null) : null);
  if (!pyEqStr(get(meta("target"), "code") ?? null, t.code)) return "the target code differs";
  const reqCount = (s: System): number => s.caps.reduce((n, c) => n + reqsOf(c).length, 0);
  const recorded = (role: string): PyValue => get(meta(role), "requirements") ?? null;
  if (recorded("baseline") !== null && !(isPyNumber(recorded("baseline")) && pyNumber(recorded("baseline")) === reqCount(b))) return "the baseline requirements differ";
  if (recorded("target") !== null && !(isPyNumber(recorded("target")) && pyNumber(recorded("target")) === reqCount(t))) return "the target requirements differ";
  // P9-R2-09: by ID, in any order (the workbook joins rows to capabilities by ID): the same baseline capabilities, each once, and every mark's requirement one of its capability's requirements.
  const caps = new Map(b.caps.map((c) => [hashKey(c.get("id") ?? null), c]));
  const ids = rows.map((r) => hashKey(isDict(r) ? (r.get("baseline_capability_id") ?? null) : null));
  if (ids.length !== caps.size || new Set(ids).size !== ids.length || ids.some((id) => !caps.has(id))) return "the baseline capabilities differ";
  for (const r of rows) {
    const c = caps.get(hashKey(r.get("baseline_capability_id") ?? null))!;
    const reqIds = new Set(reqsOf(c).map((q) => hashKey(isDict(q) ? (q.get("id") ?? null) : null)));
    const marks = r.get("marks");
    if (isList(marks) && marks.some((mk) => !reqIds.has(hashKey(isDict(mk) ? (mk.get("requirement_id") ?? null) : null)))) return `the requirements of baseline capability ${str(c.get("id") ?? null)} differ`;
  }
  // Review round 3 (P9-F-03): the score-driving model fields the merged rows carry. merge takes only one field from a
  // model into the score: the baseline capability's `maturity` (the maturity factor of the priority, and the
  // `decision` and `live_loss` reasons); the marks, objectives, and scoring factors come from the scored rows and the
  // frame. A row whose `baseline_maturity` is not the model's now shows a stale priority, so the workbook stops.
  const changed: string[] = [];
  for (const r of rows) {
    if (!r.has("baseline_maturity")) continue;
    const c = caps.get(hashKey(r.get("baseline_capability_id") ?? null))!;
    const merged = r.get("baseline_maturity") ?? null;
    const now = c.get("maturity") ?? null;
    if (!pyEqStr(merged, now)) changed.push(`${str(c.get("id") ?? null)} (merged as ${str(merged)}, now ${str(now)})`);
  }
  if (changed.length > 0) return `the maturity of ${changed.length === 1 ? "baseline capability" : `${changed.length} baseline capabilities`} changed since the merge: ${changed.slice(0, 5).join(", ")}${changed.length > 5 ? ` and ${changed.length - 5} more` : ""}`;
  const known = new Set(t.caps.map((c) => hashKey(c.get("id") ?? null)));
  const cited = [...rows.flatMap((r) => (isDict(r) ? iter(r.get("target_capability_ids") ?? []) : [])), ...tonly.map((x) => (isDict(x) ? (x.get("target_capability_id") ?? null) : null))];
  if (cited.some((id) => !known.has(hashKey(id)))) return "the target capabilities differ";
  return undefined;
}

/** The characters a sheet name cannot hold (Excel). */
const SHEET_NAME_FORBIDDEN = /[\\/?*[\]:]/;

/**
 * W1 R7 P9 review round 1 (P9-R1-03, divergence SD-17): every sheet name
 * is valid before anything is built: no `\ / ? * [ ] :`, no apostrophe at the
 * start or end, 1 to 31 characters, and no two names equal when case is
 * ignored. openpyxl stopped on a forbidden character (a traceback); it only
 * warned about a long name and renamed a name that differed only by case
 * (so links went to the wrong sheet), and Excel cannot open such a workbook.
 * Each entry is the name, the model role, and the model code it comes from.
 */
function checkSheetNames(names: [string, string, string][]): void {
  const seen = new Map<string, string>();
  for (const [name, role, code] of names) {
    const from = role === "" ? `the sheet name '${name}'` : `the ${role} code '${code}' gives the sheet name '${name}', which`;
    const bad = XML_FORBIDDEN.exec(name);
    const why = bad !== null
      ? `holds the character U+${bad[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}, which a workbook cannot hold`
      : SHEET_NAME_FORBIDDEN.test(name)
      ? `holds '${SHEET_NAME_FORBIDDEN.exec(name)![0]}', and a sheet name cannot hold any of \\ / ? * [ ] :`
      : name.startsWith("'") || name.endsWith("'")
        ? "starts or ends with an apostrophe, which a sheet name cannot"
        : name.length > 31
          ? `is ${name.length} characters long, and a sheet name has at most 31`
          : seen.has(name.toUpperCase())
            ? `is the same as the sheet name '${seen.get(name.toUpperCase())}' when case is ignored, and Excel needs each sheet name to differ`
            : undefined;
    if (why !== undefined) die(`${from} ${why}. Give the ${role === "" ? "model" : role} a shorter code with letters, digits, and hyphens in the frame (${role === "" ? "code" : `${role}.code`}).`);
    seen.set(name.toUpperCase(), name);
  }
}

function pyEqStr(a: PyValue, b: PyValue): boolean {
  return pyCompareSafe(a, b);
}

function pyCompareSafe(a: PyValue, b: PyValue): boolean {
  if (isPyNumber(a) && isPyNumber(b)) return pyNumber(a) === pyNumber(b);
  return a === b;
}

export type { XStyle };
void pyCompare;
