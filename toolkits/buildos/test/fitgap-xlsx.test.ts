// W1 R7 P9 t5: the fit-gap workbook BuildOS writes is a well-formed Office
// Open XML package, so an Excel-compatible reader opens it without a repair
// prompt: every part is well-formed XML; every part has a content type;
// every relationship target exists; every style, format, string, and table
// index is in range; each table's columns are its header cells; sheet and
// table names are valid and unique; the document properties hold no user
// name and a fixed time; and the same inputs give the same bytes. It was not
// opened in Microsoft Excel (no Excel here); openpyxl 3.1.5 opened it with
// warnings as errors when it was built (evidence report).

import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { xlsxZip } from "../src/adapters/xlsx-zip.ts";
import { run } from "../src/cli/run.ts";
import { goXmlTokens } from "../src/core/intake/convert/go-xml.ts";
import { XLSX_FIXED_TIME } from "../src/core/fitgap/xlsx-write.ts";
import { FIXTURES } from "./golden/skills/scenario.ts";
import { FIXED_NOW } from "./golden/skills/buildos-runner.ts";
import { assertNoProblems, assertSame, assertSameBytes, captureIo } from "./helpers.ts";

const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

async function workbook(frame: string, options: { palette?: boolean } = {}): Promise<Uint8Array> {
  const dir = join(realpathSync(mkdtempSync(join(tmpdir(), "buildos-fitgap-xlsx-"))), "p");
  temps.push(join(dir, ".."));
  cpSync(join(FIXTURES, "fitgap", "bases", "library"), dir, { recursive: true });
  if (options.palette === false) rmSync(join(dir, ".os", "skills"), { recursive: true, force: true });
  const base = ["fitgap", "--root", dir];
  const io = captureIo(dir);
  const merge = await run([...base, "merge", "--frame", frame, "--rows", "analysis/scored/*.json", "--only", "analysis/only.json", "--findings", "analysis/findings.json", "--todos", "analysis/todos.json", "--out", "out"], io, { now: () => FIXED_NOW });
  assertSame(merge, 0, "merge");
  const book = await run([...base, "workbook", "--frame", frame, "--fitgap", "out/circ-lib-fit-gap-analysis.json"], io, { now: () => FIXED_NOW });
  assertSame(book, 0, "workbook");
  return readFileSync(join(dir, "out", "circ-lib-fit-gap-analysis.xlsx"));
}

type Node = { name: string; attrs: Record<string, string>; children: Node[]; text: string };

function parse(data: Uint8Array): Node {
  const root: Node = { name: "", attrs: {}, children: [], text: "" };
  const stack = [root];
  for (const t of goXmlTokens(data, "stream")) {
    const top = stack[stack.length - 1]!;
    if (t.t === "start") {
      const node: Node = { name: t.local, attrs: Object.fromEntries(t.attrs.map((a) => [a.space === "" ? a.local : `${a.space}|${a.local}`, a.value])), children: [], text: "" };
      top.children.push(node);
      stack.push(node);
    } else if (t.t === "end") stack.pop();
    else top.text += t.text;
  }
  assertSame(stack.length, 1, "balanced elements");
  return root.children[0]!;
}

const all = (node: Node, name: string): Node[] => [...(node.name === name ? [node] : []), ...node.children.flatMap((c) => all(c, name))];
const attr = (node: Node, local: string): string | undefined => node.attrs[local] ?? Object.entries(node.attrs).find(([k]) => k.endsWith(`|${local}`))?.[1];

function structureProblems(bytes: Uint8Array): string[] {
  const problems: string[] = [];
  const entries = new Map(xlsxZip.unzip(bytes).map((e) => [e.name, e.data]));
  const xml = new Map<string, Node>();
  for (const [name, data] of entries) {
    try {
      xml.set(name, parse(data));
    } catch (error) {
      problems.push(`${name}: not well-formed XML (${(error as Error).message.slice(0, 60)})`);
    }
  }
  for (const required of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/sharedStrings.xml", "docProps/core.xml", "docProps/app.xml"]) {
    if (!entries.has(required)) problems.push(`missing part ${required}`);
  }
  const types = xml.get("[Content_Types].xml")!;
  const overrides = new Set(all(types, "Override").map((o) => attr(o, "PartName")!.slice(1)));
  const defaults = new Set(all(types, "Default").map((d) => attr(d, "Extension")!));
  for (const name of entries.keys()) {
    if (name === "[Content_Types].xml") continue;
    const ext = name.slice(name.lastIndexOf(".") + 1);
    if (!overrides.has(name) && !(ext === "rels" && defaults.has("rels"))) problems.push(`${name} has no content type`);
  }
  for (const part of overrides) if (!entries.has(part)) problems.push(`content type for a missing part ${part}`);
  for (const [name, node] of xml) {
    if (!name.endsWith(".rels")) continue;
    const source = name.replace("_rels/", "").replace(/\.rels$/, "");
    for (const rel of all(node, "Relationship")) {
      const target = attr(rel, "Target")!;
      const resolved = target.startsWith("/") ? target.slice(1) : `${source.slice(0, source.lastIndexOf("/") + 1)}${target}`;
      const normalized = resolved.split("/").reduce<string[]>((acc, part) => (part === ".." ? acc.slice(0, -1) : part === "." || part === "" ? acc : [...acc, part]), []).join("/");
      if (!entries.has(normalized)) problems.push(`${name}: relationship target ${normalized} is missing`);
    }
  }
  const styles = xml.get("xl/styles.xml")!;
  const count = (parent: string, child: string): number => all(all(styles, parent)[0]!, child).filter((n) => parent !== "cellXfs" || n.name === "xf").length;
  const fonts = count("fonts", "font");
  const fills = count("fills", "fill");
  const xfs = all(all(styles, "cellXfs")[0]!, "xf").length;
  const dxfs = all(all(styles, "dxfs")[0]!, "dxf").length;
  if (fills < 2) problems.push("styles: the two reserved fills are missing");
  for (const xf of all(all(styles, "cellXfs")[0]!, "xf")) {
    if (Number(attr(xf, "fontId")) >= fonts) problems.push("styles: a cell format names a missing font");
    if (Number(attr(xf, "fillId")) >= fills) problems.push("styles: a cell format names a missing fill");
  }
  const strings = all(xml.get("xl/sharedStrings.xml")!, "si").length;
  // P9-R1-20: `count` is every cell that names a shared string; `uniqueCount` is the number of strings.
  const sst = all(xml.get("xl/sharedStrings.xml")!, "sst")[0] ?? xml.get("xl/sharedStrings.xml")!;
  let stringCells = 0;
  for (const [name, node] of xml) if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) stringCells += all(node, "c").filter((c) => attr(c, "t") === "s").length;
  if (Number(attr(sst, "uniqueCount")) !== strings) problems.push("sharedStrings: uniqueCount is not the number of strings");
  if (Number(attr(sst, "count")) !== stringCells) problems.push("sharedStrings: count is not the number of cells that name a string");
  const workbookXml = xml.get("xl/workbook.xml")!;
  const sheetNames = all(workbookXml, "sheet").map((s) => attr(s, "name")!);
  if (new Set(sheetNames.map((n) => n.toLowerCase())).size !== sheetNames.length) problems.push("workbook: duplicate sheet names");
  for (const name of sheetNames) if (name.length > 31 || /[[\]:*?/\\]/.test(name)) problems.push("workbook: an invalid sheet name");
  const tableNames: string[] = [];
  for (const [name, node] of xml) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
    const cells = new Map<string, string>();
    for (const c of all(node, "c")) {
      if (attr(c, "s") !== undefined && Number(attr(c, "s")) >= xfs) problems.push(`${name}: a cell names a missing style`);
      const v = all(c, "v")[0];
      if (attr(c, "t") === "s" && v !== undefined) {
        if (Number(v.text) >= strings) problems.push(`${name}: a cell names a missing shared string`);
        else cells.set(attr(c, "r")!, all(all(xml.get("xl/sharedStrings.xml")!, "si")[Number(v.text)]!, "t").map((t) => t.text).join(""));
      }
    }
    for (const rule of all(node, "cfRule")) if (attr(rule, "dxfId") !== undefined && Number(attr(rule, "dxfId")) >= dxfs) problems.push(`${name}: a conditional format names a missing format`);
    const order = node.children.map((c) => c.name);
    const expectedOrder = ["sheetPr", "dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData", "mergeCells", "conditionalFormatting", "hyperlinks", "pageMargins", "pageSetup", "tableParts"];
    const ranks = order.map((n) => expectedOrder.indexOf(n));
    if (ranks.some((r) => r < 0) || ranks.some((r, i) => i > 0 && r < ranks[i - 1]!)) problems.push(`${name}: elements out of the schema order`);
    const rels = xml.get(name.replace("worksheets/", "worksheets/_rels/") + ".rels");
    for (const part of all(node, "tablePart")) {
      const rel = all(rels!, "Relationship").find((r) => attr(r, "Id") === attr(part, "id"));
      const table = xml.get(`xl/tables/${attr(rel!, "Target")!.split("/").pop()!}`)!;
      tableNames.push(attr(table, "displayName")!);
      const ref = attr(table, "ref")!;
      const [start] = ref.split(":") as [string];
      const row = Number(/[0-9]+/.exec(start)![0]);
      const columns = all(table, "tableColumn").map((c) => attr(c, "name")!);
      columns.forEach((col, i) => {
        const letter = String.fromCharCode(65 + (i % 26));
        const header = cells.get(`${i < 26 ? letter : String.fromCharCode(64 + Math.floor(i / 26)) + letter}${row}`);
        if (header !== col) problems.push(`${name}: table column ${i + 1} is not its header cell`);
      });
      if (new Set(columns.map((c) => c.toLowerCase())).size !== columns.length) problems.push(`${name}: duplicate table column names`);
    }
  }
  if (new Set(tableNames.map((n) => n.toLowerCase())).size !== tableNames.length) problems.push("duplicate table names");
  for (const n of tableNames) if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n)) problems.push("an invalid table name");
  const core = new TextDecoder().decode(entries.get("docProps/core.xml")!);
  if (/lastModifiedBy|<cp:keywords|<dc:description/.test(core)) problems.push("core properties hold more than the title and creator");
  if (core.split(XLSX_FIXED_TIME).length !== 3) problems.push("core properties do not hold the fixed time twice");
  return problems;
}

describe("fitgap workbook structure (t5)", () => {
  it("the workbook with tracks, owners, and the palette is a valid package", async () => {
    assertNoProblems(structureProblems(await workbook("analysis/frame.json")), "workbook structure");
  });

  it("the workbook without tracks and without a palette is a valid package", async () => {
    assertNoProblems(structureProblems(await workbook("analysis/frame-colors.json", { palette: false })), "workbook structure");
  });

  it("the same inputs give the same bytes", async () => {
    const a = await workbook("analysis/frame.json");
    const b = await workbook("analysis/frame.json");
    assertSameBytes(a, b, "two builds");
  });
});
