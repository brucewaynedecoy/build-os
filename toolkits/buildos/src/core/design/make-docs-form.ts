/**
 * W1 R7 P7 Stage 6 (t20, register R-009 option B, parity exception PE-020):
 * the promoted design in the Make Docs 2.0.9 form. BuildOS builds it from the
 * project's own design template (`.make-docs/system/templates/design.md`)
 * and checks it against the project's own design contract
 * (`.make-docs/system/contracts/design-contract.md`), so the form follows
 * the Make Docs files of the project and does not drift from them:
 *
 * - Frontmatter: the template's frontmatter, with the placeholders BuildOS
 *   knows filled (`{{TITLE}}`, `{{FOLLOW_ON_ROUTE}}`, `{{PROMPT_FILE}}`,
 *   `{{FOLLOW_ON_WHY}}`, `{{COORDINATE_HANDOFF}}`) and its comment lines (the
 *   optional `coordinate`, `source`, and `lifecycle` keys, which apply only
 *   when their conditions hold) left out.
 * - `# <title>`, then every `## ` section of the template, in the template's
 *   order. BuildOS fills Purpose, Context, Decision, Alternatives
 *   Considered, Consequences, and Intended Follow-On from the finding (the
 *   Go text, with `docs/designs/` for the router). Every other section, such
 *   as Human Experience Intent, is the template's own text, unfilled, for the
 *   planner: BuildOS makes no claim there.
 * - Intended Follow-On: the template's lines, with Route, Next Prompt, Why,
 *   and Coordinate Handoff filled. The Next Prompt link is a relative link to
 *   the prompt file BuildOS read, so it resolves (the contract's rule).
 *
 * Fail safe: when the template or contract has a form this version does not
 * know (a missing known heading, a heading the contract requires that the
 * template lacks, a frontmatter key or placeholder BuildOS cannot fill, a
 * missing follow-on line), `DesignFormError` stops the promotion before any
 * write, so BuildOS never writes a malformed design.
 *
 * W1 R7 P7 review round 4 (P7-R4-04, P7-R4-05):
 *
 * - The template is checked before anything is filled: its frontmatter lines
 *   must be the 2.0.9 lines exactly (each value double-quoted, as BuildOS
 *   writes it), the contract's required headings must be the 2.0.9 list in
 *   the 2.0.9 order, and the template must hold them in that order. Every
 *   `{{...}}` placeholder of the template is checked here, before user text
 *   is put in, so a finding title that holds `{{x}}` is just text.
 * - Values are put in once, in one pass over the template, and the result is
 *   never scanned for placeholders again.
 * - The frontmatter title is a YAML double-quoted scalar with every
 *   character outside YAML's printable set escaped (line breaks as `\n`).
 *   The `# ` title line is one line: line breaks become spaces, and a leading
 *   `#` is escaped.
 * - Every section body BuildOS fills from the finding (title, summary,
 *   observed text, references, scope names) has each line start that could
 *   open a block escaped: an ATX heading, a setext underline, a code fence,
 *   and an HTML block. So user text can never add, hide, or move a section.
 * - Self-check: the frontmatter is read back with the project's own YAML
 *   subset reader and a strict double-quoted scalar reader, and the headings
 *   of the result are read back and compared with the template's. A failure
 *   writes nothing (`DesignSelfCheckError`).
 */

/** What BuildOS fills in the 2.0.9 form. */
export interface DesignFacts {
  title: string;
  route: string;
  promptFile: string;
  /** The relative link from the design to the prompt file BuildOS read. */
  promptLink: string;
  why: string;
  coordinateHandoff: string;
  /** Section bodies BuildOS writes, without the heading, each ending in one line feed. */
  sections: ReadonlyMap<string, string>;
}

/** The sections BuildOS fills. Each must be in the template. */
export const FILLED_SECTIONS = ["Purpose", "Context", "Decision", "Alternatives Considered", "Consequences", "Intended Follow-On"] as const;

/** The template does not have a form this BuildOS version can fill. */
export class DesignFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignFormError";
  }
}

/** The design BuildOS made failed its own check; nothing is written. */
export class DesignSelfCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignSelfCheckError";
  }
}

/**
 * A YAML double-quoted scalar's inside (P7-R4-04): `\` and `"` escaped, and
 * every character outside YAML's printable set (C0 and C1 controls, DEL, the
 * line and paragraph separators, unpaired surrogates, U+FFFE and U+FFFF)
 * written as an escape, so the value stays on one line and reads back
 * exactly.
 */
export function yamlInside(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (char === "\\") out += "\\\\";
    else if (char === '"') out += '\\"';
    else if (char === "\n") out += "\\n";
    else if (char === "\t") out += "\\t";
    else if (char === "\r") out += "\\r";
    else if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
    } else out += char;
  }
  return out;
}

/** Reads a YAML double-quoted scalar's inside strictly (the escapes `yamlInside` writes, and YAML's others); undefined when it is not valid. */
export function readYamlInside(inside: string): string | undefined {
  let out = "";
  for (let i = 0; i < inside.length; i += 1) {
    const char = inside[i]!;
    const code = char.charCodeAt(0);
    if (char === '"') return undefined;
    if (code < 0x20 && char !== "\t") return undefined;
    if (code === 0x2028 || code === 0x2029 || code === 0x85) return undefined;
    if (char !== "\\") {
      out += char;
      continue;
    }
    const next = inside[i + 1];
    i += 1;
    const simple: Record<string, string> = { "0": "\0", a: "\x07", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r", e: "\x1b", " ": " ", '"': '"', "/": "/", "\\": "\\", N: "\x85", _: "\xa0", L: "\u2028", P: "\u2029" };
    if (next !== undefined && next in simple) out += simple[next];
    else if (next === "x" || next === "u" || next === "U") {
      const width = next === "x" ? 2 : next === "u" ? 4 : 8;
      const hex = inside.slice(i + 1, i + 1 + width);
      if (!new RegExp(`^[0-9A-Fa-f]{${width}}$`).test(hex)) return undefined;
      out += String.fromCodePoint(Number.parseInt(hex, 16));
      i += width;
    } else return undefined;
  }
  return out;
}

/** A code fence opener (CommonMark): up to three spaces, three or more backticks or tildes; a backtick info string holds no backtick. */
function fenceOpener(line: string): string | undefined {
  const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (m === null) return undefined;
  if (m[1]![0] === "`" && m[2]!.includes("`")) return undefined;
  return m[1]!;
}

/** True when `line` closes a fence opened with `opener`: the same character, at least as many, and only white space after. */
function closesFence(line: string, opener: string): boolean {
  const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  return m !== null && m[1]![0] === opener[0] && m[1]!.length >= opener.length;
}

/**
 * The balanced fenced code blocks of `lines` (W1 R7 P7 final check,
 * P7-F-06): for each opener outside a block, the index of its closer, or no
 * entry when it has none (an unbalanced fence).
 */
function fencedBlocks(lines: readonly string[]): Map<number, number> {
  const blocks = new Map<number, number>();
  for (let i = 0; i < lines.length; i += 1) {
    const opener = fenceOpener(lines[i]!);
    if (opener === undefined) continue;
    let close = i + 1;
    while (close < lines.length && !closesFence(lines[close]!, opener)) close += 1;
    if (close < lines.length) {
      blocks.set(i, close);
      i = close;
    }
  }
  return blocks;
}

/**
 * User text in a section body (P7-R4-05; final check P7-F-06): line endings
 * as line feeds; a balanced fenced code block (``` or ~~~, any length of 3
 * or more, with its info string, closed by the same character at least as
 * long) kept byte for byte, so a YAML, JSON, or shell example keeps its
 * meaning; and outside those blocks, each line start that Markdown would read
 * as a block opener escaped with a backslash: an ATX heading (`#`), a setext
 * underline (`===` or `---`), a fence with no closer (so it cannot swallow
 * the template's next sections), and an HTML block (`<`). Up to three leading
 * spaces are kept. A heading inside a balanced block is code, not a heading.
 */
export function neutralizeBlocks(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks = fencedBlocks(lines);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const close = blocks.get(i);
    if (close !== undefined) {
      out.push(...lines.slice(i, close + 1));
      i = close;
      continue;
    }
    out.push(
      lines[i]!
        .replace(/^( {0,3})(#{1,6})(?=[ \t]|$)/, "$1\\$2")
        .replace(/^( {0,3})(=+|-+)([ \t]*)$/, "$1\\$2$3")
        .replace(/^( {0,3})(`{3,}|~{3,})/, "$1\\$2")
        .replace(/^( {0,3})</, "$1\\<"),
    );
  }
  return out.join("\n");
}

/** The `# ` title line text (P7-R4-05): one line, a leading `#` escaped. */
export function headingText(title: string): string {
  const one = title.replace(/[\r\n\v\f\u0085\u2028\u2029]+/g, " ").trim();
  return one.startsWith("#") ? `\\${one}` : one;
}

/** The 2.0.9 frontmatter lines, in order (comment lines are left out). Each placeholder value is double-quoted. */
const KNOWN_FRONTMATTER = [
  'title: "{{TITLE}}"',
  'kind: "design"',
  'status: "draft"',
  "follow_on:",
  '  route: "{{FOLLOW_ON_ROUTE}}"',
  '  next_prompt: "make-docs://system/prompt/{{PROMPT_FILE}}"',
  '  why: "{{FOLLOW_ON_WHY}}"',
  '  coordinate_handoff: "{{COORDINATE_HANDOFF}}"',
];

/** The Make Docs 2.0.9 design contract's Required Headings, in its order. */
export const REQUIRED_HEADINGS_209 = ["Purpose", "Context", "Human Experience Intent", "Decision", "Alternatives Considered", "Consequences", "Intended Follow-On"] as const;

interface Section {
  heading: string;
  body: string;
}

/** The template's frontmatter and body, with `\r\n` read as `\n`. */
function splitTemplate(template: string): { frontmatter: string[]; preamble: string[]; sections: Section[] } {
  const lines = template.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") throw new DesignFormError("it does not start with a frontmatter block");
  const end = lines.indexOf("---", 1);
  if (end === -1) throw new DesignFormError("its frontmatter block has no end");
  const frontmatter = lines.slice(1, end);
  const preamble: string[] = [];
  const sections: Section[] = [];
  let current: { heading: string; lines: string[] } | undefined;
  let fence = false;
  for (const line of lines.slice(end + 1)) {
    if (/^(```|~~~)/.test(line)) fence = !fence;
    const heading = fence ? undefined : /^## (.+?)\s*$/.exec(line)?.[1];
    if (heading !== undefined) {
      if (current !== undefined) sections.push({ heading: current.heading, body: trimBlank(current.lines) });
      current = { heading, lines: [] };
    } else if (current === undefined) preamble.push(line);
    else current.lines.push(line);
  }
  if (current !== undefined) sections.push({ heading: current.heading, body: trimBlank(current.lines) });
  return { frontmatter, preamble, sections };
}

/** Lines without leading and trailing blank lines, joined, with one final line feed (or empty). */
function trimBlank(lines: readonly string[]): string {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]!.trim() === "") start++;
  while (end > start && lines[end - 1]!.trim() === "") end--;
  return start === end ? "" : `${lines.slice(start, end).join("\n")}\n`;
}

/** The headings the contract's `## Required Headings` section lists (`- \`## X\``). */
export function contractRequiredHeadings(contract: string): string[] {
  const { sections } = splitTemplate(`---\n---\n${contract.replace(/^# .*\n/, "")}`);
  const required = sections.find((s) => s.heading === "Required Headings");
  if (required === undefined) throw new DesignFormError("the design contract has no Required Headings section");
  const headings = [...required.body.matchAll(/^- `## (.+?)`\s*$/gm)].map((m) => m[1]!);
  if (headings.length === 0) throw new DesignFormError("the design contract lists no required heading");
  return headings;
}

/** Checks the template's frontmatter against the 2.0.9 lines before anything is filled (P7-R4-04). */
function checkFrontmatter(lines: readonly string[]): void {
  const kept = lines.filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#"));
  for (const [i, line] of kept.entries()) {
    if (line === KNOWN_FRONTMATTER[i]) continue;
    const key = /^(\s*)([A-Za-z_][A-Za-z0-9_]*):/.exec(line)?.[2];
    const known = KNOWN_FRONTMATTER.find((k) => k.trimStart().startsWith(`${key}:`));
    if (key === undefined) throw new DesignFormError("its frontmatter has a line BuildOS does not know");
    if (known === undefined) throw new DesignFormError(`its frontmatter has the key ${key}, which is not a Make Docs 2.0.9 key`);
    if (/\{\{(?![A-Z0-9_]+\}\})|\{\{[A-Z0-9_]+\}\}/.test(line) && !/"\{\{/.test(line)) throw new DesignFormError(`its frontmatter value for ${key} is not a double-quoted "{{...}}" value, the form BuildOS fills`);
    throw new DesignFormError(`its frontmatter line for ${key} is not the Make Docs 2.0.9 line ${JSON.stringify(known.trim())}`);
  }
  if (kept.length !== KNOWN_FRONTMATTER.length) throw new DesignFormError(`its frontmatter has ${kept.length} lines, not the ${KNOWN_FRONTMATTER.length} Make Docs 2.0.9 lines`);
}

/** The frontmatter, filled in one pass over the 2.0.9 lines. */
function fillFrontmatter(facts: DesignFacts): string[] {
  const values: Record<string, string> = {
    TITLE: facts.title,
    FOLLOW_ON_ROUTE: facts.route,
    PROMPT_FILE: facts.promptFile,
    FOLLOW_ON_WHY: facts.why,
    COORDINATE_HANDOFF: facts.coordinateHandoff,
  };
  return KNOWN_FRONTMATTER.map((line) => line.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_whole, name: string) => yamlInside(values[name]!)));
}

/** The Make Docs 2.0.9 Next Prompt line of the design template, exactly (P7-F-05). */
export const NEXT_PROMPT_LINE_209 = "- Next Prompt: {{NEXT_PROMPT_LINK}}. Read `make-docs://system/prompt/{{PROMPT_FILE}}` with `make-docs resource read`.";

/** The Next Prompt line BuildOS writes: the 2.0.9 line with the relative link and the prompt file name in their places. */
export function renderedNextPromptLine(promptFile: string, promptLink: string): string {
  return `- Next Prompt: [${promptFile}](${promptLink}). Read \`make-docs://system/prompt/${promptFile}\` with \`make-docs resource read\`.`;
}

/**
 * Where each placeholder of the Make Docs 2.0.9 design template body is
 * (P7-F-05): the section that holds it (`""` for the lines before the first
 * `## ` section). The frontmatter is checked line by line in
 * `checkFrontmatter`. A placeholder that is not listed here, or that is in
 * another section, is a form this version does not know.
 */
const PLACEHOLDERS_209: Readonly<Record<string, string>> = {
  TITLE: "",
  IMPACT: "Human Experience Intent",
  AFFECTED_HUMANS: "Human Experience Intent",
  HUMAN_GOAL_OR_EFFECT: "Human Experience Intent",
  OBSERVABLE_EXPERIENCE_PROMISE: "Human Experience Intent",
  COMPLEXITY_NOT_REQUIRED_FOR_THE_GOAL: "Human Experience Intent",
  PLANNED_EVIDENCE: "Human Experience Intent",
  PERFORMANCE_CANDIDATE_OR_NONE: "Performance Evidence Candidates",
  BASE_MAINTENANCE_ACTION: "Performance Evidence Candidates",
  REQUIRED_NOW_CHARACTERIZE_NOW_DEFER_REQUIRED_NOT_NEEDED_OR_REJECT_UNSUPPORTED: "Performance Evidence Candidates",
  PROTECTED_OUTCOME_OR_NONE: "Performance Evidence Candidates",
  DECISION_INFORMED_OR_NONE: "Performance Evidence Candidates",
  OWNER_PERF_O_OR_NONE: "Performance Evidence Candidates",
  NEXT_PROMPT_LINK: "Intended Follow-On",
  PROMPT_FILE: "Intended Follow-On",
};

/**
 * Checks every `{{...}}` of the template body against the 2.0.9 positions
 * before anything is filled (P7-F-05): an unknown placeholder anywhere, or a
 * known one in another section, stops the promotion. `{{TITLE}}` is only the
 * `# {{TITLE}}` line, and the Intended Follow-On placeholders are only the
 * 2.0.9 Next Prompt line (`checkFollowOn`).
 */
function checkPlaceholders(preamble: readonly string[], sections: readonly Section[]): void {
  const parts = [{ heading: "", text: preamble.join("\n") }, ...sections.map((section) => ({ heading: section.heading, text: section.body }))];
  for (const { heading, text } of parts) {
    for (const m of text.matchAll(/\{\{([^{}]*)\}\}|\{\{|\}\}/g)) {
      const name = m[1];
      if (name === undefined || !/^[A-Z0-9_]+$/.test(name) || !(name in PLACEHOLDERS_209)) throw new DesignFormError("it has a placeholder BuildOS does not know");
      if (PLACEHOLDERS_209[name] !== heading) throw new DesignFormError(`its placeholder ${name} is not where the Make Docs 2.0.9 template has it`);
    }
  }
  const titles = preamble.filter((line) => line.includes("{{TITLE}}"));
  if (titles.length !== 1 || titles[0] !== "# {{TITLE}}") throw new DesignFormError('its {{TITLE}} placeholder is not the one "# {{TITLE}}" title line');
}

/**
 * Checks the Intended Follow-On template lines before anything is filled
 * (P7-R4-05; final check P7-F-05): one line each for Route, Next Prompt, Why,
 * and Coordinate Handoff; the Next Prompt line exactly the 2.0.9 line (so the
 * link is put where the contract wants a relative Markdown link, never inside
 * inline code); and no placeholder on any other line, since BuildOS writes
 * the Route, Why, and Coordinate Handoff lines whole and would drop it.
 */
function checkFollowOn(body: string): void {
  const seen = new Map<string, number>();
  for (const line of body.split("\n")) {
    const prefix = /^- (Route|Next Prompt|Why|Coordinate Handoff):/.exec(line)?.[1];
    if (prefix !== undefined) seen.set(prefix, (seen.get(prefix) ?? 0) + 1);
    if (prefix === "Next Prompt") {
      if (line !== NEXT_PROMPT_LINE_209) throw new DesignFormError(`its Next Prompt line is not the Make Docs 2.0.9 line ${JSON.stringify(NEXT_PROMPT_LINE_209)}`);
    } else if (line.includes("{{") || line.includes("}}")) throw new DesignFormError("its Intended Follow-On section has a placeholder BuildOS cannot fill");
  }
  for (const prefix of ["Route", "Next Prompt", "Why", "Coordinate Handoff"]) {
    const count = seen.get(prefix) ?? 0;
    if (count === 0) throw new DesignFormError(`its Intended Follow-On section has no "- ${prefix}:" line`);
    if (count > 1) throw new DesignFormError(`its Intended Follow-On section has more than one "- ${prefix}:" line`);
  }
}

/** The Intended Follow-On section, from the template's lines, each placeholder filled once. */
function fillFollowOn(body: string, facts: DesignFacts): string {
  const lines = body
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => {
      const prefix = /^- (Route|Next Prompt|Why|Coordinate Handoff):/.exec(line)?.[1];
      switch (prefix) {
        case undefined:
          return line;
        case "Route":
          return `- Route: \`${facts.route}\``;
        case "Why":
          return `- Why: ${neutralizeBlocks(facts.why)}`;
        case "Coordinate Handoff":
          return `- Coordinate Handoff: ${neutralizeBlocks(facts.coordinateHandoff)}`;
        default:
          // checkFollowOn made sure this is the 2.0.9 line.
          return renderedNextPromptLine(facts.promptFile, facts.promptLink);
      }
    });
  return `${lines.join("\n")}\n`;
}

/** The ATX headings of levels 1 and 2 outside code fences, as `# x` or `## x` (CommonMark: up to three leading spaces). */
function topHeadings(markdown: string): string[] {
  const out: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (fence !== undefined) {
      if (closesFence(line, fence)) fence = undefined;
      continue;
    }
    const open = fenceOpener(line);
    if (open !== undefined) {
      fence = open;
      continue;
    }
    const heading = /^ {0,3}(#{1,2})[ \t]+(.*?)[ \t]*$/.exec(line) ?? /^ {0,3}(#{1,2})$/.exec(line);
    if (heading !== null) out.push(`${heading[1]} ${heading[2] ?? ""}`.trimEnd());
  }
  return out;
}

/**
 * Self-check of a rendered design (P7-R4-04, P7-R4-05): the frontmatter reads
 * back with the YAML subset reader and the strict double-quoted reader, the
 * title reads back exactly, and the level 1 and 2 headings are the title and
 * the template's sections, in order. Throws `DesignSelfCheckError`.
 */
export function selfCheckDesign(design: string, title: string, sections: readonly string[], parse: (frontmatter: string) => unknown): void {
  const end = design.indexOf("\n---\n", 4);
  if (!design.startsWith("---\n") || end === -1) throw new DesignSelfCheckError("the frontmatter block is not closed");
  const frontmatter = design.slice(4, end + 1);
  let parsed: unknown;
  try {
    parsed = parse(frontmatter);
  } catch {
    throw new DesignSelfCheckError("the frontmatter is not valid YAML for the BuildOS reader");
  }
  if (!(parsed instanceof Map) || !(parsed.get("follow_on") instanceof Map)) throw new DesignSelfCheckError("the frontmatter does not read back as the 2.0.9 keys");
  for (const line of frontmatter.split("\n").filter((l) => l !== "")) {
    const value = /^\s*[a-z_]+: "(.*)"$/.exec(line)?.[1];
    if (value === undefined) {
      if (line !== "follow_on:") throw new DesignSelfCheckError("a frontmatter line is not a double-quoted value");
      continue;
    }
    if (readYamlInside(value) === undefined) throw new DesignSelfCheckError("a frontmatter value is not a valid double-quoted YAML scalar");
  }
  const titleValue = /^title: "(.*)"$/m.exec(frontmatter)?.[1];
  if (titleValue === undefined || readYamlInside(titleValue) !== title) throw new DesignSelfCheckError("the frontmatter title does not read back as the finding title");
  const expected = [`# ${headingText(title)}`, ...sections.map((heading) => `## ${heading}`)];
  const found = topHeadings(design.slice(end + 5));
  if (JSON.stringify(found) !== JSON.stringify(expected)) throw new DesignSelfCheckError(`the design has ${found.length} title and section headings, not the ${expected.length} the template gives`);
}

/**
 * The design in the Make Docs 2.0.9 form, from the project's template and
 * contract text. Throws `DesignFormError` (the reason, in plain words) when
 * either has a form this version does not know, and `DesignSelfCheckError`
 * when the result does not read back. `parseFrontmatter` is the project's
 * YAML subset reader.
 */
export function renderMakeDocsDesign(template: string, contract: string, facts: DesignFacts, parseFrontmatter: (frontmatter: string) => unknown): string {
  // 1. The template's form, before any value is put in.
  const { frontmatter, preamble, sections } = splitTemplate(template);
  checkFrontmatter(frontmatter);
  if (!preamble.some((line) => line === "# {{TITLE}}")) throw new DesignFormError('it has no "# {{TITLE}}" title line');
  const headings = sections.map((s) => s.heading);
  if (new Set(headings).size !== headings.length) throw new DesignFormError("it repeats a section heading");
  for (const heading of FILLED_SECTIONS) if (!headings.includes(heading)) throw new DesignFormError(`it has no "## ${heading}" section`);
  const required = contractRequiredHeadings(contract);
  if (JSON.stringify(required) !== JSON.stringify(REQUIRED_HEADINGS_209)) throw new DesignFormError(`the design contract requires the headings ${required.join(", ")}, not the Make Docs 2.0.9 list ${REQUIRED_HEADINGS_209.join(", ")}`);
  for (const heading of required) if (!headings.includes(heading)) throw new DesignFormError(`it has no "## ${heading}" section, which the design contract requires`);
  const order = headings.filter((h) => (required as readonly string[]).includes(h));
  if (JSON.stringify(order) !== JSON.stringify(required)) throw new DesignFormError(`its sections ${order.join(", ")} are not in the order the design contract gives (${required.join(", ")})`);
  checkFollowOn(sections.find((s) => s.heading === "Intended Follow-On")!.body);
  checkPlaceholders(preamble, sections);

  // 2. One pass: each value is put in once and never read for placeholders again.
  let out = `---\n${fillFrontmatter(facts).join("\n")}\n---\n\n# ${headingText(facts.title)}\n`;
  for (const section of sections) {
    let body: string;
    if (section.heading === "Intended Follow-On") body = fillFollowOn(section.body, facts);
    else {
      const filled = facts.sections.get(section.heading);
      body = filled === undefined ? section.body : neutralizeBlocks(filled);
    }
    out += `\n## ${section.heading}\n`;
    if (body !== "") out += `\n${body}`;
  }

  // 3. Self-check before anything is written.
  selfCheckDesign(out, facts.title, headings, parseFrontmatter);
  // P7-F-05: the Next Prompt reference is in the form the 2.0.9 contract gives (a relative Markdown link), once.
  const start = out.lastIndexOf("\n## Intended Follow-On\n") + 1;
  const next = out.indexOf("\n## ", start);
  const nextPrompt = out.slice(start, next === -1 ? out.length : next).split("\n").filter((line) => line.startsWith("- Next Prompt:"));
  if (nextPrompt.length !== 1 || nextPrompt[0] !== renderedNextPromptLine(facts.promptFile, facts.promptLink)) throw new DesignSelfCheckError("the Next Prompt line is not the relative link the Make Docs 2.0.9 design contract requires");
  return out;
}
