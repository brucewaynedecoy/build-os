#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const TARGET_17_HEADERS = [
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

const NEW_HEADERS = TARGET_17_HEADERS.filter(
  (header) => !["ID", "State", "Assigned To"].includes(header),
);

const PROFILES = {
  "target17-new": { headers: TARGET_17_HEADERS, newItems: true },
  new: { headers: NEW_HEADERS, newItems: true },
  update: { headers: TARGET_17_HEADERS, newItems: false },
};

const TYPE_BY_LEVEL = {
  1: "Epic",
  2: "Feature",
  3: "Product Backlog Item",
  4: "Task",
};

const ADAPTER_IDS = ["dynamics-365-ce"];

const ALLOWED_HTML_TAGS = new Set(["div", "b", "ul", "li", "br"]);
const VOID_HTML_TAGS = new Set(["br"]);

function usage() {
  return `Usage:
  node azure_boards_csv.mjs emit --input <manifest.json> --output <file.csv> [--profile target17-new|new|update]
  node azure_boards_csv.mjs validate --input <file.csv> [--profile target17-new|new|update|auto] [--adapter <id>] [--adapter-params <json>] [--publisher-prefix <value>]
  node azure_boards_csv.mjs template --output <file.csv> [--profile target17-new|new|update]
  node azure_boards_csv.mjs adapters

Registered adapters: ${ADAPTER_IDS.join(", ")}
On emit, the adapter comes from the manifest keys 'adapter' and 'adapter_params'.`;
}

async function loadAdapter(name) {
  if (!ADAPTER_IDS.includes(name)) {
    throw new Error(`Unknown adapter '${name}'. Registered adapters: ${ADAPTER_IDS.join(", ")}.`);
  }
  return import(new URL(`./adapters/${name}.mjs`, import.meta.url).href);
}

// Resolves adapter parameters from the CLI, then the manifest, then the CSV itself.
function resolveAdapterParams(adapter, supplied, rows) {
  let params = supplied;
  if ((!params || Object.keys(params).length === 0) && typeof adapter.inferParams === "function") {
    params = adapter.inferParams(rows) ?? undefined;
  }
  return adapter.normalizeParams(params ?? {});
}

async function runAdapter(name, suppliedParams, validation) {
  const adapter = await loadAdapter(name);
  const { params, warnings } = resolveAdapterParams(adapter, suppliedParams, validation.adapterRows);
  const result = adapter.validateRows({
    headers: validation.headers,
    rows: validation.adapterRows,
    params,
  });
  return {
    adapter: name,
    adapterParams: params,
    errors: result.errors,
    warnings: [...warnings, ...result.warnings],
  };
}

function parseAdapterParams(options) {
  if (options["adapter-params"]) {
    let parsed;
    try {
      parsed = JSON.parse(options["adapter-params"]);
    } catch (error) {
      throw new Error(`--adapter-params must be valid JSON: ${error.message}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("--adapter-params must be a JSON object.");
    }
    return parsed;
  }
  if (options["publisher-prefix"]) {
    return { publisher_prefix: options["publisher-prefix"] };
  }
  return undefined;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const name = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function requireOption(options, name) {
  if (!options[name]) {
    throw new Error(`Missing required option --${name}`);
  }
  return options[name];
}

function getProfile(name, allowAuto = false) {
  if (allowAuto && name === "auto") return null;
  const profile = PROFILES[name];
  if (!profile) {
    throw new Error(`Unknown profile '${name}'. Use target17-new, new, or update.`);
  }
  return profile;
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeListItem(value, location) {
  if (typeof value === "string") {
    if (!value.trim()) throw new Error(`${location} contains an empty list item.`);
    return { text: value.trim(), children: [] };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location} must contain strings or {text, children} objects.`);
  }
  if (typeof value.text !== "string" || !value.text.trim()) {
    throw new Error(`${location} object requires nonempty text.`);
  }
  const children = value.children ?? [];
  if (!Array.isArray(children)) {
    throw new Error(`${location} children must be an array.`);
  }
  return {
    text: value.text.trim(),
    children: children.map((child, index) =>
      normalizeListItem(child, `${location}.children[${index}]`),
    ),
  };
}

function normalizeList(values, location) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${location} must be a nonempty array.`);
  }
  return values.map((value, index) => normalizeListItem(value, `${location}[${index}]`));
}

function renderListItems(items) {
  return items
    .map((item) => {
      const children = item.children.length > 0 ? `<ul>${renderListItems(item.children)}</ul>` : "";
      return `<li>${htmlEscape(item.text)}${children}</li>`;
    })
    .join("");
}

function renderList(values, location) {
  return `<ul>${renderListItems(normalizeList(values, location))}</ul>`;
}

function renderDescription(description, location) {
  if (!description || typeof description !== "object" || Array.isArray(description)) {
    throw new Error(`${location} must be an object.`);
  }
  const useCase = renderList(description.use_case, `${location}.use_case`);
  const outcomes = renderList(description.outcomes, `${location}.outcomes`);
  const technical = renderList(description.technical_details, `${location}.technical_details`);
  return `<div><div><b>USE CASE</b></div><div>${useCase}</div><div><br></div><div><b>DESCRIPTION</b></div><div>${outcomes}</div><div><br></div><div><b>TECHNICAL DETAILS</b></div><div>${technical}</div></div>`;
}

function renderAcceptanceCriteria(criteria, location) {
  return `<div>${renderList(criteria, location)}</div>`;
}

function renderSummary(summary) {
  if (summary == null || summary === "") return "";
  if (typeof summary !== "string") throw new Error("summary must be a string.");
  return `<div>${htmlEscape(summary.trim())}</div>`;
}

function renderSourceTrace(trace, location) {
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) {
    throw new Error(`${location} must be an object.`);
  }
  const labels = [
    ["Work directory", trace.work_directory],
    ["Index file", trace.index_file],
    ["Phase file", trace.phase_file],
    ["Stage", trace.stage],
    ["Task IDs", Array.isArray(trace.task_ids) ? trace.task_ids.join(", ") : trace.task_ids],
    [
      "Source PRD Docs",
      Array.isArray(trace.source_prd_docs) ? trace.source_prd_docs.join(", ") : trace.source_prd_docs,
    ],
    ["Labels", Array.isArray(trace.labels) ? trace.labels.join(", ") : trace.labels],
  ];
  const items = labels
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([label, value]) => `${label}: ${String(value).trim()}`);
  if (items.length === 0) throw new Error(`${location} has no trace values.`);
  return `<div><b>BUILD OS SOURCE</b></div><div>${renderList(items, location)}</div>`;
}

function normalizeTags(...values) {
  const tags = [];
  for (const value of values) {
    const items = Array.isArray(value)
      ? value
      : value == null || value === ""
        ? []
        : String(value).split(";");
    for (const item of items) {
      const tag = String(item).trim();
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }
  return tags.join("; ");
}

function buildRows(manifest, profileName) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Manifest must be a JSON object.");
  }
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    throw new Error("Manifest items must be a nonempty array.");
  }
  if (manifest.items.length > 1000) {
    throw new Error("Azure Boards CSV imports support at most 1,000 work item rows.");
  }

  const profile = getProfile(profileName);
  const defaults = manifest.defaults ?? {};
  const rows = [];

  for (const [index, item] of manifest.items.entries()) {
    const location = `items[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${location} must be an object.`);
    }
    const level = Number(item.level);
    if (![1, 2, 3, 4].includes(level)) {
      throw new Error(`${location}.level must be 1, 2, 3, or 4.`);
    }
    const expectedType = TYPE_BY_LEVEL[level];
    if (item.work_item_type !== expectedType) {
      throw new Error(`${location}.work_item_type must be '${expectedType}' for level ${level}.`);
    }
    if (typeof item.title !== "string" || !item.title.trim()) {
      throw new Error(`${location}.title must be a nonempty string.`);
    }

    const row = Object.fromEntries(profile.headers.map((header) => [header, ""]));
    row["Work Item Type"] = item.work_item_type;
    row[`Title ${level}`] = item.title.trim();

    if (profile.headers.includes("ID")) row.ID = item.id ?? "";
    if (profile.headers.includes("State")) row.State = item.state ?? "";
    if (profile.headers.includes("Assigned To")) row["Assigned To"] = item.assigned_to ?? "";

    row.Effort = item.effort ?? "";
    row["Iteration Path"] = item.iteration_path ?? defaults.iteration_path ?? "";
    row["Repro Steps"] = item.repro_steps ?? "";
    row.Solution = item.solution ?? "";
    row["Solution Type"] = item.solution_type ?? "";
    row.Tags = normalizeTags(defaults.tags, item.tags);

    if (level === 3) {
      row.Description = renderDescription(item.description, `${location}.description`);
      row["Acceptance Criteria"] = renderAcceptanceCriteria(
        item.acceptance_criteria,
        `${location}.acceptance_criteria`,
      );
    } else {
      row.Description = renderSummary(item.summary);
      row["Acceptance Criteria"] = "";
    }

    row["Design Notes"] = renderSourceTrace(item.source_trace, `${location}.source_trace`);
    rows.push(row);
  }

  return { headers: profile.headers, rows };
}

function encodeCsvField(value) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function encodeCsv(headers, rows) {
  const records = [
    headers.map(encodeCsvField).join(","),
    ...rows.map((row) => headers.map((header) => encodeCsvField(row[header])).join(",")),
  ];
  return `\uFEFF${records.join("\r\n")}`;
}

function parseCsv(text) {
  const source = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows = [];
  let row = [];
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

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function detectProfile(headers) {
  const matches = Object.entries(PROFILES).filter(([, profile]) => sameArray(headers, profile.headers));
  if (matches.length === 0) return null;
  if (matches.some(([name]) => name === "target17-new")) return "target17-new";
  return matches[0][0];
}

function validateHtml(html, location, errors) {
  const stack = [];
  for (const match of html.matchAll(/<\s*(\/?)\s*([a-zA-Z0-9]+)(?:\s[^>]*)?>/g)) {
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
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

function validateCsvText(text, requestedProfileName = "auto") {
  const errors = [];
  const warnings = [];
  if (!text.startsWith("\uFEFF")) errors.push("CSV must start with a UTF-8 byte-order mark.");

  let parsed;
  try {
    parsed = parseCsv(text);
  } catch (error) {
    return { valid: false, profile: null, rowCount: 0, counts: {}, errors: [error.message], warnings };
  }
  if (parsed.length === 0) {
    return { valid: false, profile: null, rowCount: 0, counts: {}, errors: ["CSV is empty."], warnings };
  }

  const [headers, ...dataRows] = parsed;
  const detectedProfileName = detectProfile(headers);
  const profileName = requestedProfileName === "auto" ? detectedProfileName : requestedProfileName;
  if (!profileName || !PROFILES[profileName]) {
    errors.push("CSV headers do not match a supported profile.");
  } else if (!sameArray(headers, PROFILES[profileName].headers)) {
    errors.push(`CSV headers do not match profile '${profileName}'.`);
  }

  if (dataRows.length === 0) errors.push("CSV must contain at least one work item row.");
  if (dataRows.length > 1000) errors.push("CSV contains more than 1,000 work item rows.");

  const profile = PROFILES[profileName] ?? { headers, newItems: false };
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  const currentParent = { 1: false, 2: false, 3: false, 4: false };
  const counts = {};
  const adapterRows = [];

  for (const [rowIndex, values] of dataRows.entries()) {
    const rowNumber = rowIndex + 2;
    if (values.length !== headers.length) {
      errors.push(`Row ${rowNumber} has ${values.length} fields; expected ${headers.length}.`);
      continue;
    }
    const value = (header) => (headerIndex[header] == null ? "" : values[headerIndex[header]] ?? "");
    const populatedLevels = [1, 2, 3, 4].filter((level) => value(`Title ${level}`).trim() !== "");
    if (populatedLevels.length !== 1) {
      errors.push(`Row ${rowNumber} must populate exactly one Title 1-4 field.`);
      continue;
    }
    const level = populatedLevels[0];
    const workItemType = value("Work Item Type").trim();
    const expectedType = TYPE_BY_LEVEL[level];
    if (workItemType !== expectedType) {
      errors.push(`Row ${rowNumber} must use Work Item Type '${expectedType}' for Title ${level}.`);
    }
    counts[workItemType || "(blank)"] = (counts[workItemType || "(blank)"] ?? 0) + 1;
    adapterRows.push({
      rowNumber,
      level,
      workItemType,
      fields: Object.fromEntries(headers.map((header) => [header, value(header)])),
    });

    if (level > 1 && !currentParent[level - 1]) {
      errors.push(`Row ${rowNumber} Title ${level} has no preceding Title ${level - 1} parent.`);
    }
    currentParent[level] = true;
    for (let deeper = level + 1; deeper <= 4; deeper += 1) currentParent[deeper] = false;

    if (profile.newItems) {
      for (const header of ["ID", "State", "Assigned To"]) {
        if (value(header).trim() !== "") {
          errors.push(`Row ${rowNumber} must leave '${header}' blank for profile '${profileName}'.`);
        }
      }
    }

    const combined = headers.map((header) => value(header)).join("\n");
    if (/\b(?:TODO|TBD)\b|\{\{|\}\}/i.test(combined)) {
      errors.push(`Row ${rowNumber} contains a placeholder.`);
    }
    if (/-\s*\[[ xX]\]/.test(combined)) {
      errors.push(`Row ${rowNumber} contains a Markdown checkbox.`);
    }

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
        if (first < 0 || first !== last) {
          errors.push(`Row ${rowNumber} Description must contain '${heading}' exactly once.`);
        } else if (first <= previousPosition) {
          errors.push(`Row ${rowNumber} Description headings are out of order.`);
        }
        previousPosition = first;
      }
      if (!/<ul>.*<li>.*<\/li>.*<\/ul>/s.test(criteria)) {
        errors.push(`Row ${rowNumber} Acceptance Criteria must contain an HTML unordered list item.`);
      }
      if (!designNotes.includes("<b>BUILD OS SOURCE</b>")) {
        errors.push(`Row ${rowNumber} Design Notes must contain a BUILD OS SOURCE trace.`);
      }
      validateHtml(description, `Row ${rowNumber} Description`, errors);
      validateHtml(criteria, `Row ${rowNumber} Acceptance Criteria`, errors);
      validateHtml(designNotes, `Row ${rowNumber} Design Notes`, errors);
    } else {
      if (description) validateHtml(description, `Row ${rowNumber} Description`, errors);
      if (designNotes) validateHtml(designNotes, `Row ${rowNumber} Design Notes`, errors);
    }
  }

  if (profileName === "target17-new") {
    warnings.push(
      "Run an Azure Boards import preview because this compatibility profile retains blank ID, State, and Assigned To columns.",
    );
  }

  return {
    valid: errors.length === 0,
    profile: profileName,
    rowCount: dataRows.length,
    counts,
    errors,
    warnings,
    headers,
    adapterRows,
  };
}

function reportable(validation, adapterResult) {
  const { headers: _headers, adapterRows: _rows, ...rest } = validation;
  if (!adapterResult) return rest;
  return {
    ...rest,
    valid: rest.valid && adapterResult.errors.length === 0,
    adapter: adapterResult.adapter,
    adapter_params: adapterResult.adapterParams,
    errors: [...rest.errors, ...adapterResult.errors],
    warnings: [...rest.warnings, ...adapterResult.warnings],
  };
}

async function writeOutput(outputPath, content) {
  await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  await fs.writeFile(outputPath, content, "utf8");
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || ["help", "--help", "-h"].includes(command)) {
    console.log(usage());
    return;
  }

  if (command === "emit") {
    const inputPath = requireOption(options, "input");
    const outputPath = requireOption(options, "output");
    const manifest = JSON.parse(await fs.readFile(inputPath, "utf8"));
    const profileName = options.profile ?? manifest.profile ?? "target17-new";
    const adapterName = options.adapter ?? manifest.adapter ?? null;
    const adapterParams = parseAdapterParams(options) ?? manifest.adapter_params;
    if (adapterName) {
      const adapter = await loadAdapter(adapterName);
      adapter.normalizeParams(adapterParams ?? {});
    }
    const { headers, rows } = buildRows(manifest, profileName);
    const csv = encodeCsv(headers, rows);
    const validation = validateCsvText(csv, profileName);
    const adapterResult = adapterName ? await runAdapter(adapterName, adapterParams, validation) : null;
    const report = reportable(validation, adapterResult);
    if (!report.valid) {
      throw new Error(`Generated CSV failed validation:\n${report.errors.join("\n")}`);
    }
    await writeOutput(outputPath, csv);
    console.log(JSON.stringify({ operation: "emit", output: path.resolve(outputPath), ...report }, null, 2));
    return;
  }

  if (command === "validate") {
    const inputPath = requireOption(options, "input");
    const profileName = options.profile ?? "auto";
    getProfile(profileName, true);
    const csv = await fs.readFile(inputPath, "utf8");
    const validation = validateCsvText(csv, profileName);
    const adapterName = options.adapter ?? null;
    const adapterResult = adapterName
      ? await runAdapter(adapterName, parseAdapterParams(options), validation)
      : null;
    const report = reportable(validation, adapterResult);
    console.log(JSON.stringify({ operation: "validate", input: path.resolve(inputPath), ...report }, null, 2));
    if (!report.valid) process.exitCode = 1;
    return;
  }

  if (command === "template") {
    const outputPath = requireOption(options, "output");
    const profileName = options.profile ?? "target17-new";
    const profile = getProfile(profileName);
    const csv = `\uFEFF${profile.headers.map(encodeCsvField).join(",")}`;
    await writeOutput(outputPath, csv);
    console.log(
      JSON.stringify({ operation: "template", output: path.resolve(outputPath), profile: profileName }, null, 2),
    );
    return;
  }

  if (command === "adapters") {
    const adapters = [];
    for (const name of ADAPTER_IDS) {
      const adapter = await loadAdapter(name);
      adapters.push({ id: adapter.id, label: adapter.label, required_params: adapter.requiredParams });
    }
    console.log(JSON.stringify({ operation: "adapters", adapters }, null, 2));
    return;
  }

  throw new Error(`Unknown command '${command}'.\n${usage()}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
