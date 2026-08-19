// Adapter: Dynamics 365 Customer Engagement.
// Enforces the target-platform rules described in adapters/dynamics-365-ce/ADAPTER.md.

export const id = "dynamics-365-ce";
export const label = "Dynamics 365 CE";
export const requiredParams = ["publisher_prefix"];

const WORK_TYPE_CODES = ["CFG", "DEV", "INT", "DATA", "SEC"];
const TITLE_PATTERN = /^(.+?)\s\((CFG|DEV|INT|DATA|SEC)\)\s-\s(.+)$/;
const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,7}_$/;
const PREFIX_LINE_PATTERN = /^Publisher Prefix:\s*(\S+)\s*$/;
const COMPONENT_MARKERS = [
  "Schema:",
  "Logical Name:",
  "Entity:",
  "Form:",
  "Views:",
  "Flow:",
  "Function:",
  "Endpoint:",
  "Role:",
  "Target:",
];

function htmlDecode(value) {
  return String(value)
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

// Returns each list item's own text with its nesting depth. Nested <ul> content
// is reported as its own entries, not folded into the parent.
function listItems(html) {
  const items = [];
  let depth = 0;
  for (const match of String(html).matchAll(/<ul>|<\/ul>|<li>([^<]*)/g)) {
    if (match[0] === "<ul>") {
      depth += 1;
    } else if (match[0] === "</ul>") {
      depth = Math.max(0, depth - 1);
    } else {
      items.push({ depth, text: htmlDecode(match[1] ?? "").trim() });
    }
  }
  return items;
}

function sectionHtml(description, heading) {
  const marker = `<b>${heading}</b>`;
  const start = description.indexOf(marker);
  if (start < 0) return "";
  const rest = description.slice(start + marker.length);
  const next = rest.search(/<b>[A-Z]/);
  return next < 0 ? rest : rest.slice(0, next);
}

function rowText(row) {
  return htmlDecode(Object.values(row.fields).join("\n"));
}

export function normalizeParams(params = {}) {
  const warnings = [];
  const raw = params.publisher_prefix;
  if (raw == null || String(raw).trim() === "") {
    throw new Error(
      "Adapter 'dynamics-365-ce' requires adapter_params.publisher_prefix. Ask the user for the organization's Dataverse publisher prefix. Never use 'new_'.",
    );
  }
  const prefix = String(raw).trim();
  if (prefix.toLowerCase() === "new_") {
    throw new Error("Adapter 'dynamics-365-ce' rejects the default publisher prefix 'new_'.");
  }
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error(
      `Publisher prefix '${prefix}' is invalid. Use letters and digits starting with a letter, followed by a trailing underscore, for example 'jd_'.`,
    );
  }
  if (prefix.length - 1 > 5) {
    warnings.push(
      `Publisher prefix '${prefix}' is longer than five characters. Confirm it matches the organization's Dataverse publisher.`,
    );
  }
  return { params: { publisher_prefix: prefix }, warnings };
}

// Reads every declared 'Publisher Prefix:' line so validate can run without --adapter-params.
export function inferParams(rows) {
  const declared = new Set();
  for (const row of rows) {
    for (const item of listItems(row.fields.Description ?? "")) {
      const match = PREFIX_LINE_PATTERN.exec(item.text);
      if (match) declared.add(match[1]);
    }
  }
  if (declared.size === 0) return null;
  if (declared.size > 1) {
    throw new Error(
      `CSV declares more than one publisher prefix: ${[...declared].join(", ")}. One export uses one prefix.`,
    );
  }
  return { publisher_prefix: [...declared][0] };
}

function checkNaming(row, prefix, errors) {
  const where = `Row ${row.rowNumber}`;
  const text = rowText(row);
  const schemaPath = new RegExp(`^${prefix}/[A-Za-z0-9._/-]+$`);
  const schemaName = new RegExp(`^${prefix}[A-Za-z0-9]+$`);
  const logicalName = new RegExp(`^${prefix}[a-z0-9]+$`);

  if (/\bnew_[A-Za-z0-9]/.test(text)) {
    errors.push(`${where} uses the default publisher prefix 'new_'.`);
  }
  if (/\*\*/.test(text) || /\{\.underline\}/.test(text) || /__[^_\s][^_]*__/.test(text)) {
    errors.push(`${where} contains Markdown emphasis or Pandoc span syntax. Azure renders it as noise.`);
  }

  let lastSchema = null;
  for (const item of listItems(row.fields.Description ?? "")) {
    const schema = /^Schema:\s*(\S+)\s*$/.exec(item.text);
    if (schema) {
      const value = schema[1];
      if (!schemaName.test(value) && !schemaPath.test(value)) {
        errors.push(`${where} schema name '${value}' must start with '${prefix}' and use letters and digits.`);
      }
      lastSchema = schemaPath.test(value) ? null : value;
      continue;
    }
    const logical = /^Logical Name:\s*(\S+)\s*$/.exec(item.text);
    if (logical) {
      const value = logical[1];
      if (!logicalName.test(value)) {
        errors.push(
          `${where} logical name '${value}' must start with '${prefix}' and use lowercase letters and digits.`,
        );
      } else if (lastSchema && value !== lastSchema.toLowerCase()) {
        errors.push(`${where} logical name '${value}' does not match schema name '${lastSchema}' in lowercase.`);
      }
      lastSchema = null;
    }
  }
}

function checkWorkItem(row, prefix, errors, warnings) {
  const where = `Row ${row.rowNumber}`;
  const title = (row.fields["Title 3"] ?? "").trim();
  const titleMatch = TITLE_PATTERN.exec(title);
  if (!titleMatch) {
    errors.push(
      `${where} title '${title}' must match '{Feature} ({${WORK_TYPE_CODES.join("|")}}) - {Description}'.`,
    );
  }
  const code = titleMatch ? titleMatch[2] : null;

  const description = row.fields.Description ?? "";
  const technical = sectionHtml(description, "TECHNICAL DETAILS");
  const technicalItems = listItems(technical);
  const technicalText = technicalItems.map((item) => item.text).join("\n");

  if (technicalItems.length === 0) {
    errors.push(`${where} TECHNICAL DETAILS has no list items.`);
  } else {
    const first = technicalItems[0].text;
    const prefixLine = PREFIX_LINE_PATTERN.exec(first);
    if (!prefixLine) {
      errors.push(`${where} TECHNICAL DETAILS must begin with 'Publisher Prefix: ${prefix}'.`);
    } else if (prefixLine[1] !== prefix) {
      errors.push(
        `${where} declares publisher prefix '${prefixLine[1]}' but the export uses '${prefix}'.`,
      );
    }
  }

  if (code && ["CFG", "DEV", "INT"].includes(code)) {
    if (!COMPONENT_MARKERS.some((marker) => technicalText.includes(marker))) {
      errors.push(
        `${where} is a ${code} item but TECHNICAL DETAILS names no component. Add a schema name, logical name, or named existing component.`,
      );
    }
  }

  const criteria = listItems(row.fields["Acceptance Criteria"] ?? "").filter((item) => item.depth === 1);
  if (criteria.length < 2) {
    errors.push(`${where} must have at least two Acceptance Criteria items; found ${criteria.length}.`);
  }

  for (const item of technicalItems) {
    if (/^(?:if|else if|else)\b/.test(item.text)) {
      warnings.push(`${where} conditional '${item.text.slice(0, 48)}' should use capitals: IF, ELSE IF, ELSE.`);
      break;
    }
  }
  if (/\b(?:true|false|null|undefined)\b/.test(technicalText)) {
    warnings.push(`${where} uses a lowercase condition outcome. Use TRUE, FALSE, NULL, or UNDEFINED.`);
  }
  if (code === "DEV" && !/Execution:\s*(?:Synchronous|Asynchronous)/.test(technicalText)) {
    warnings.push(`${where} is a DEV item with no 'Execution: Synchronous' or 'Execution: Asynchronous' line.`);
  }
  if (code === "CFG" && /Create columns:/.test(technicalText) && !/Requirement:/.test(technicalText)) {
    warnings.push(`${where} creates columns but states no 'Requirement:' value for them.`);
  }
  const criteriaText = criteria.map((item) => item.text).join("\n");
  if (!/\b(?:deploy|deployed|environment|solution)\b/i.test(criteriaText)) {
    warnings.push(`${where} has no Acceptance Criteria item covering deployment, environment, or solution.`);
  }

  checkNaming(row, prefix, errors);
}

export function validateRows({ rows, params }) {
  const errors = [];
  const warnings = [];
  const prefix = params.publisher_prefix;

  let workItemCount = 0;
  for (const row of rows) {
    if (row.level === 3) {
      workItemCount += 1;
      checkWorkItem(row, prefix, errors, warnings);
      continue;
    }
    const title = (row.fields[`Title ${row.level}`] ?? "").trim();
    if (TITLE_PATTERN.test(title)) {
      warnings.push(
        `Row ${row.rowNumber} is a ${row.level === 1 ? "Epic" : "Feature"} whose title carries a work type code. Only Product Backlog Item titles use one.`,
      );
    }
    checkNaming(row, prefix, errors);
  }

  if (workItemCount === 0) {
    errors.push("Adapter 'dynamics-365-ce' requires at least one Product Backlog Item row.");
  }

  return { errors, warnings };
}
