/**
 * Azure Boards CSV rules of `buildos export azure-boards`, ported from the
 * skill script `buildos-export-azure-boards/scripts/azure_boards_csv.mjs`
 * (W1 R7 P9 t6): the profiles, the manifest-to-row rendering, the CSV
 * encoder (UTF-8 byte order mark, CRLF between records, no final line
 * break), the CSV reader, and the validator. The script was JavaScript, so
 * this port keeps its exact semantics, messages, and order. The manifest is
 * read with `JSON.parse`, as the script read it.
 */

/** One data row as an adapter sees it. */
export interface AdapterRow {
  rowNumber: number;
  level: number;
  workItemType: string;
  fields: Record<string, string>;
}

/** A target-platform adapter (`adapters/<id>.mjs` in the script). */
export interface AzureAdapter {
  id: string;
  label: string;
  requiredParams: string[];
  normalizeParams(params?: Record<string, unknown>): { params: Record<string, unknown>; warnings: string[] };
  inferParams?(rows: AdapterRow[]): Record<string, unknown> | null;
  validateRows(input: { headers: string[]; rows: AdapterRow[]; params: Record<string, unknown> }): { errors: string[]; warnings: string[] };
}

export const TARGET_17_HEADERS = [
  "ID",
  "Work Item Type",
  "Title 1",
  "Title 2",
  "Title 3",
  "Title 4",
  "State",
  "Effort",
  "Iteration Path",
  "Repro Steps",
  "Description",
  "Acceptance Criteria",
  "Design Notes",
  "Solution",
  "Solution Type",
  "Tags",
  "Assigned To",
];

const NEW_HEADERS = TARGET_17_HEADERS.filter((header) => !["ID", "State", "Assigned To"].includes(header));

export interface Profile {
  headers: string[];
  newItems: boolean;
}

export const PROFILES: Record<string, Profile> = {
  "target17-new": { headers: TARGET_17_HEADERS, newItems: true },
  new: { headers: NEW_HEADERS, newItems: true },
  update: { headers: TARGET_17_HEADERS, newItems: false },
};

const TYPE_BY_LEVEL: Record<number, string> = { 1: "Epic", 2: "Feature", 3: "Product Backlog Item", 4: "Task" };

const ALLOWED_HTML_TAGS = new Set(["div", "b", "ul", "li", "br"]);
const VOID_HTML_TAGS = new Set(["br"]);

/** The profile named `name`; `auto` gives null when allowed. An own-property lookup, as the script's `PROFILES[name]` for a plain name. */
export function getProfile(name: string, allowAuto = false): Profile | null {
  if (allowAuto && name === "auto") return null;
  const profile = Object.hasOwn(PROFILES, name) ? PROFILES[name] : undefined;
  if (!profile) throw new Error(`Unknown profile '${name}'. Use target17-new, new, or update.`);
  return profile;
}

function htmlEscape(value: unknown): string {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

interface ListItem {
  text: string;
  children: ListItem[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeListItem(value: any, location: string): ListItem {
  if (typeof value === "string") {
    if (!value.trim()) throw new Error(`${location} contains an empty list item.`);
    return { text: value.trim(), children: [] };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${location} must contain strings or {text, children} objects.`);
  if (typeof value.text !== "string" || !value.text.trim()) throw new Error(`${location} object requires nonempty text.`);
  const children = value.children ?? [];
  if (!Array.isArray(children)) throw new Error(`${location} children must be an array.`);
  return { text: value.text.trim(), children: children.map((child: any, index: number) => normalizeListItem(child, `${location}.children[${index}]`)) };
}

function normalizeList(values: any, location: string): ListItem[] {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${location} must be a nonempty array.`);
  return values.map((value, index) => normalizeListItem(value, `${location}[${index}]`));
}

function renderListItems(items: ListItem[]): string {
  return items
    .map((item) => {
      const children = item.children.length > 0 ? `<ul>${renderListItems(item.children)}</ul>` : "";
      return `<li>${htmlEscape(item.text)}${children}</li>`;
    })
    .join("");
}

function renderList(values: any, location: string): string {
  return `<ul>${renderListItems(normalizeList(values, location))}</ul>`;
}

function renderDescription(description: any, location: string): string {
  if (!description || typeof description !== "object" || Array.isArray(description)) throw new Error(`${location} must be an object.`);
  const useCase = renderList(description.use_case, `${location}.use_case`);
  const outcomes = renderList(description.outcomes, `${location}.outcomes`);
  const technical = renderList(description.technical_details, `${location}.technical_details`);
  return `<div><div><b>USE CASE</b></div><div>${useCase}</div><div><br></div><div><b>DESCRIPTION</b></div><div>${outcomes}</div><div><br></div><div><b>TECHNICAL DETAILS</b></div><div>${technical}</div></div>`;
}

function renderAcceptanceCriteria(criteria: any, location: string): string {
  return `<div>${renderList(criteria, location)}</div>`;
}

function renderSummary(summary: any): string {
  if (summary == null || summary === "") return "";
  if (typeof summary !== "string") throw new Error("summary must be a string.");
  return `<div>${htmlEscape(summary.trim())}</div>`;
}

function renderSourceTrace(trace: any, location: string): string {
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) throw new Error(`${location} must be an object.`);
  const labels: [string, any][] = [
    ["Work directory", trace.work_directory],
    ["Index file", trace.index_file],
    ["Phase file", trace.phase_file],
    ["Stage", trace.stage],
    ["Task IDs", Array.isArray(trace.task_ids) ? trace.task_ids.join(", ") : trace.task_ids],
    ["Source PRD Docs", Array.isArray(trace.source_prd_docs) ? trace.source_prd_docs.join(", ") : trace.source_prd_docs],
    ["Labels", Array.isArray(trace.labels) ? trace.labels.join(", ") : trace.labels],
  ];
  const items = labels.filter(([, value]) => value != null && String(value).trim() !== "").map(([label, value]) => `${label}: ${String(value).trim()}`);
  if (items.length === 0) throw new Error(`${location} has no trace values.`);
  return `<div><b>BUILD OS SOURCE</b></div><div>${renderList(items, location)}</div>`;
}

function normalizeTags(...values: any[]): string {
  const tags: string[] = [];
  for (const value of values) {
    const items = Array.isArray(value) ? value : value == null || value === "" ? [] : String(value).split(";");
    for (const item of items) {
      const tag = String(item).trim();
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }
  return tags.join("; ");
}

/** The CSV rows of a manifest (the script's `buildRows`). Throws a plain `Error` with the script's message. */
export function buildRows(manifest: any, profileName: string): { headers: string[]; rows: Record<string, string>[] } {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("Manifest must be a JSON object.");
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) throw new Error("Manifest items must be a nonempty array.");
  if (manifest.items.length > 1000) throw new Error("Azure Boards CSV imports support at most 1,000 work item rows.");

  const profile = getProfile(profileName)!;
  const defaults = manifest.defaults ?? {};
  const rows: Record<string, string>[] = [];

  for (const [index, item] of (manifest.items as any[]).entries()) {
    const location = `items[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${location} must be an object.`);
    const level = Number(item.level);
    if (![1, 2, 3, 4].includes(level)) throw new Error(`${location}.level must be 1, 2, 3, or 4.`);
    const expectedType = TYPE_BY_LEVEL[level]!;
    if (item.work_item_type !== expectedType) throw new Error(`${location}.work_item_type must be '${expectedType}' for level ${level}.`);
    if (typeof item.title !== "string" || !item.title.trim()) throw new Error(`${location}.title must be a nonempty string.`);

    const row: Record<string, any> = Object.fromEntries(profile.headers.map((header) => [header, ""]));
    row["Work Item Type"] = item.work_item_type;
    row[`Title ${level}`] = item.title.trim();

    if (profile.headers.includes("ID")) row["ID"] = item.id ?? "";
    if (profile.headers.includes("State")) row["State"] = item.state ?? "";
    if (profile.headers.includes("Assigned To")) row["Assigned To"] = item.assigned_to ?? "";

    row["Effort"] = item.effort ?? "";
    row["Iteration Path"] = item.iteration_path ?? defaults.iteration_path ?? "";
    row["Repro Steps"] = item.repro_steps ?? "";
    row["Solution"] = item.solution ?? "";
    row["Solution Type"] = item.solution_type ?? "";
    row["Tags"] = normalizeTags(defaults.tags, item.tags);

    if (level === 3) {
      row["Description"] = renderDescription(item.description, `${location}.description`);
      row["Acceptance Criteria"] = renderAcceptanceCriteria(item.acceptance_criteria, `${location}.acceptance_criteria`);
    } else {
      row["Description"] = renderSummary(item.summary);
      row["Acceptance Criteria"] = "";
    }

    row["Design Notes"] = renderSourceTrace(item.source_trace, `${location}.source_trace`);
    rows.push(row);
  }

  return { headers: profile.headers, rows };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function encodeCsvField(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** The CSV text: a byte order mark, then the records joined with CRLF. */
export function encodeCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const records = [headers.map(encodeCsvField).join(","), ...rows.map((row) => headers.map((header) => encodeCsvField(row[header])).join(","))];
  return `\ufeff${records.join("\r\n")}`;
}

/** The CSV rows (the script's reader: quotes only at a field start, CRLF or LF between records). */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith("\ufeff") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field === "") {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" && source[index + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (inQuotes) throw new Error("CSV contains an unterminated quoted field.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function detectProfile(headers: string[]): string | null {
  const matches = Object.entries(PROFILES).filter(([, profile]) => sameArray(headers, profile.headers));
  if (matches.length === 0) return null;
  if (matches.some(([name]) => name === "target17-new")) return "target17-new";
  return matches[0]![0];
}

function validateHtml(html: string, location: string, errors: string[]): void {
  const stack: string[] = [];
  for (const match of html.matchAll(/<\s*(\/?)\s*([a-zA-Z0-9]+)(?:\s[^>]*)?>/g)) {
    const closing = match[1] === "/";
    const tag = match[2]!.toLowerCase();
    if (!ALLOWED_HTML_TAGS.has(tag)) {
      errors.push(`${location} uses unsupported HTML tag <${tag}>.`);
      continue;
    }
    if (VOID_HTML_TAGS.has(tag)) continue;
    if (closing) {
      const expected = stack.pop();
      if (expected !== tag) {
        errors.push(`${location} has unbalanced HTML near </${tag}>.`);
        return;
      }
    } else {
      stack.push(tag);
    }
  }
  if (stack.length > 0) errors.push(`${location} has unclosed HTML tag <${stack.at(-1)}>.`);
}

/** What `validateCsvText` found. `headers` and `adapterRows` are for an adapter; `reportable` drops them. */
export interface CsvValidation {
  valid: boolean;
  profile: string | null;
  rowCount: number;
  counts: Record<string, number>;
  errors: string[];
  warnings: string[];
  headers?: string[];
  adapterRows?: AdapterRow[];
}

/** The script's `validateCsvText`. */
export function validateCsvText(text: string, requestedProfileName = "auto"): CsvValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!text.startsWith("\ufeff")) errors.push("CSV must start with a UTF-8 byte-order mark.");

  let parsed: string[][];
  try {
    parsed = parseCsv(text);
  } catch (error) {
    return { valid: false, profile: null, rowCount: 0, counts: {}, errors: [(error as Error).message], warnings };
  }
  if (parsed.length === 0) return { valid: false, profile: null, rowCount: 0, counts: {}, errors: ["CSV is empty."], warnings };

  const [headers, ...dataRows] = parsed as [string[], ...string[][]];
  const detectedProfileName = detectProfile(headers);
  const profileName = requestedProfileName === "auto" ? detectedProfileName : requestedProfileName;
  const known = profileName !== null && Object.hasOwn(PROFILES, profileName);
  if (!profileName || !known) {
    errors.push("CSV headers do not match a supported profile.");
  } else if (!sameArray(headers, PROFILES[profileName]!.headers)) {
    errors.push(`CSV headers do not match profile '${profileName}'.`);
  }

  if (dataRows.length === 0) errors.push("CSV must contain at least one work item row.");
  if (dataRows.length > 1000) errors.push("CSV contains more than 1,000 work item rows.");

  const profile = (known ? PROFILES[profileName!] : undefined) ?? { headers, newItems: false };
  const headerIndex: Record<string, number> = Object.fromEntries(headers.map((header, index) => [header, index]));
  const currentParent: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false };
  const counts: Record<string, number> = {};
  const adapterRows: AdapterRow[] = [];

  for (const [rowIndex, values] of dataRows.entries()) {
    const rowNumber = rowIndex + 2;
    if (values.length !== headers.length) {
      errors.push(`Row ${rowNumber} has ${values.length} fields; expected ${headers.length}.`);
      continue;
    }
    const value = (header: string): string => (headerIndex[header] == null ? "" : (values[headerIndex[header]!] ?? ""));
    const populatedLevels = [1, 2, 3, 4].filter((level) => value(`Title ${level}`).trim() !== "");
    if (populatedLevels.length !== 1) {
      errors.push(`Row ${rowNumber} must populate exactly one Title 1-4 field.`);
      continue;
    }
    const level = populatedLevels[0]!;
    const workItemType = value("Work Item Type").trim();
    const expectedType = TYPE_BY_LEVEL[level]!;
    if (workItemType !== expectedType) errors.push(`Row ${rowNumber} must use Work Item Type '${expectedType}' for Title ${level}.`);
    counts[workItemType || "(blank)"] = (counts[workItemType || "(blank)"] ?? 0) + 1;
    adapterRows.push({ rowNumber, level, workItemType, fields: Object.fromEntries(headers.map((header) => [header, value(header)])) });

    if (level > 1 && !currentParent[level - 1]) errors.push(`Row ${rowNumber} Title ${level} has no preceding Title ${level - 1} parent.`);
    currentParent[level] = true;
    for (let deeper = level + 1; deeper <= 4; deeper += 1) currentParent[deeper] = false;

    if (profile.newItems) {
      for (const header of ["ID", "State", "Assigned To"]) {
        if (value(header).trim() !== "") errors.push(`Row ${rowNumber} must leave '${header}' blank for profile '${profileName}'.`);
      }
    }

    const combined = headers.map((header) => value(header)).join("\n");
    if (/\b(?:TODO|TBD)\b|\{\{|\}\}/i.test(combined)) errors.push(`Row ${rowNumber} contains a placeholder.`);
    if (/-\s*\[[ xX]\]/.test(combined)) errors.push(`Row ${rowNumber} contains a Markdown checkbox.`);

    const description = value("Description");
    const criteria = value("Acceptance Criteria");
    const designNotes = value("Design Notes");
    if (level === 3) {
      const headings = ["USE CASE", "DESCRIPTION", "TECHNICAL DETAILS"];
      let previousPosition = -1;
      for (const heading of headings) {
        const marker = `<b>${heading}</b>`;
        const first = description.indexOf(marker);
        const last = description.lastIndexOf(marker);
        if (first < 0 || first !== last) errors.push(`Row ${rowNumber} Description must contain '${heading}' exactly once.`);
        else if (first <= previousPosition) errors.push(`Row ${rowNumber} Description headings are out of order.`);
        previousPosition = first;
      }
      if (!/<ul>.*<li>.*<\/li>.*<\/ul>/s.test(criteria)) errors.push(`Row ${rowNumber} Acceptance Criteria must contain an HTML unordered list item.`);
      if (!designNotes.includes("<b>BUILD OS SOURCE</b>")) errors.push(`Row ${rowNumber} Design Notes must contain a BUILD OS SOURCE trace.`);
      validateHtml(description, `Row ${rowNumber} Description`, errors);
      validateHtml(criteria, `Row ${rowNumber} Acceptance Criteria`, errors);
      validateHtml(designNotes, `Row ${rowNumber} Design Notes`, errors);
    } else {
      if (description) validateHtml(description, `Row ${rowNumber} Description`, errors);
      if (designNotes) validateHtml(designNotes, `Row ${rowNumber} Design Notes`, errors);
    }
  }

  if (profileName === "target17-new") {
    warnings.push("Run an Azure Boards import preview because this compatibility profile retains blank ID, State, and Assigned To columns.");
  }

  return { valid: errors.length === 0, profile: profileName, rowCount: dataRows.length, counts, errors, warnings, headers, adapterRows };
}
