/**
 * HTML to Markdown, ported from the Go intake tool (`html.go`), with Go's
 * `html.Render` (golang.org/x/net/html v0.48.0, `render.go` and
 * `escape.go`) for inline SVG side artifacts.
 *
 * One approved difference from Go (parity exception PE-008): Go writes text
 * only from `p`, `h1`-`h6`, `li`, and table cells, so text directly inside a
 * `div` box (an HTML callout) is lost. PRD 07 requires that no section is
 * lost, so this port writes each run of text and inline elements directly
 * inside a `div` as one paragraph, where it stands. An inline element that
 * holds an image, an SVG, or another part Go writes is opened up, so each
 * of those parts keeps Go's handling (and its side artifact) in place. Every
 * other part of the walk is Go's.
 */

import { goEqualFold, goFields, goToLower, goTrimSpace, normalizeSpace } from "../go-text.ts";
import { markdownTable } from "./docx.ts";
import type { HtmlNode } from "./parsers.ts";

type HtmlElement = Extract<HtmlNode, { kind: "element" }>;

/** Go `attr`: the first attribute whose key equals `name` under `strings.EqualFold`. */
export function htmlAttr(n: HtmlElement, name: string): string {
  return n.attrs.find((a) => goEqualFold(a.key, name))?.value ?? "";
}

/** Go `hasClass`. */
function hasClass(n: HtmlElement, className: string): boolean {
  return goFields(htmlAttr(n, "class")).some((c) => goEqualFold(c, className));
}

const children = (n: HtmlNode): HtmlNode[] => (n.kind === "document" || n.kind === "element" ? n.children : []);

/** Go `textContent`: text runs joined with spaces, links as `[label](href)`, white space folded. */
export function textContent(n: HtmlNode): string {
  let b = "";
  const walk = (cur: HtmlNode) => {
    if (cur.kind === "text") b += `${cur.data} `;
    if (cur.kind === "element" && goToLower(cur.tag) === "a") {
      const label = normalizeSpace(textContentChildren(cur));
      const href = htmlAttr(cur, "href");
      if (label !== "" && href !== "") {
        b += `[${label}](${href}) `;
        return;
      }
    }
    for (const child of children(cur)) walk(child);
  };
  walk(n);
  return normalizeSpace(b);
}

/** Go `textContentChildren`. */
function textContentChildren(n: HtmlNode): string {
  return children(n)
    .map((c) => `${textContent(c)} `)
    .join("");
}

/** Go `rawTextContent`. */
function rawTextContent(n: HtmlNode): string {
  if (n.kind === "text") return n.data;
  return children(n).map(rawTextContent).join("");
}

/** Go `htmlTable`. */
function htmlTable(n: HtmlNode): string {
  const rows: string[][] = [];
  const collect = (cur: HtmlNode) => {
    if (cur.kind === "element" && goEqualFold(cur.tag, "tr")) {
      const row = cur.children.filter((c): c is HtmlElement => c.kind === "element" && (goEqualFold(c.tag, "td") || goEqualFold(c.tag, "th"))).map(textContent);
      if (row.length > 0) rows.push(row);
      return;
    }
    for (const child of children(cur)) collect(child);
  };
  collect(n);
  return markdownTable(rows);
}

// ---------------------------------------------------------------- Go html.Render

const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "keygen", "link", "meta", "param", "source", "track", "wbr"]);
const LITERAL_TEXT_PARENTS = new Set(["iframe", "noembed", "noframes", "noscript", "plaintext", "script", "style", "xmp"]);

/** Go html `escape`. */
function escapeHtml(s: string): string {
  return s.replace(/[&'<>"\r]/g, (c) => ({ "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;", '"': "&#34;", "\r": "&#13;" })[c]!);
}

/** Go html `escapeComment`. */
function escapeComment(s: string): string {
  let out = "";
  for (let j = 0; j < s.length; j++) {
    const c = s[j]!;
    if (c === "&") out += "&amp;";
    else if (c === ">" && (j === 0 || s[j - 1] === "!" || s[j - 1] === "-")) out += "&gt;";
    else out += c;
  }
  return out;
}

/** Go html `writeQuoted`. */
function writeQuoted(s: string): string {
  const q = s.includes('"') ? "'" : '"';
  return `${q}${s}${q}`;
}

/** The result of Go's `html.Render`: the bytes written, and the error that stopped it, if any. */
export interface RenderResult {
  text: string;
  error: string | undefined;
}

/** Go `html.Render` of one node. */
export function renderHtml(n: HtmlNode): RenderResult {
  let out = "";
  class Abort extends Error {}
  const render1 = (node: HtmlNode): void => {
    switch (node.kind) {
      case "text":
        out += escapeHtml(node.data);
        return;
      case "document":
        for (const c of node.children) render1(c);
        return;
      case "comment":
        out += `<!--${escapeComment(node.data)}-->`;
        return;
      case "doctype": {
        out += `<!DOCTYPE ${escapeHtml(node.name)}`;
        if (node.publicId !== "") {
          out += ` PUBLIC ${writeQuoted(node.publicId)}`;
          if (node.systemId !== "") out += ` ${writeQuoted(node.systemId)}`;
        } else if (node.systemId !== "") {
          out += ` SYSTEM ${writeQuoted(node.systemId)}`;
        }
        out += ">";
        return;
      }
      case "element":
        break;
    }
    out += `<${node.tag}`;
    for (const a of node.attrs) {
      out += " ";
      if (a.namespace !== "") out += `${a.namespace}:`;
      out += `${a.key}="${escapeHtml(a.value)}"`;
    }
    if (VOID_ELEMENTS.has(node.tag)) {
      if (node.children.length > 0) throw new Abort(`html: void element <${node.tag}> has child nodes`);
      out += "/>";
      return;
    }
    out += ">";
    const first = node.children[0];
    if (first !== undefined && first.kind === "text" && first.data.startsWith("\n") && ["pre", "listing", "textarea"].includes(node.tag)) out += "\n";
    if (node.namespace === "" && LITERAL_TEXT_PARENTS.has(node.tag)) {
      for (const c of node.children) {
        if (c.kind === "text") out += c.data;
        else render1(c);
      }
      if (node.tag === "plaintext") throw new Abort("");
    } else {
      for (const c of node.children) render1(c);
    }
    out += `</${node.tag}>`;
  };
  try {
    render1(n);
    return { text: out, error: undefined };
  } catch (error) {
    if (error instanceof Abort) return { text: out, error: error.message === "" ? undefined : error.message };
    throw error;
  }
}

// ---------------------------------------------------------------- Markdown walk

/** Side artifacts the walk asks for. The converter writes them and returns the Markdown block. */
export interface HtmlCaptures {
  mermaid(code: string): string;
  svg(node: HtmlNode): string;
  image(node: HtmlElement): string;
}

/**
 * Inline elements whose text belongs to the `div` paragraph around them
 * (PE-008). `img`, `svg`, `br`, and elements with class `mermaid` keep
 * Go's handling, as does every block element.
 */
const DIV_INLINE = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "font",
  "i",
  "ins",
  "kbd",
  "label",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
]);

/** Elements Go's walk writes on their own: headings, paragraphs, list items, tables, images, SVG, line breaks, and Mermaid blocks. */
const GO_BLOCKS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "table", "img", "svg", "br"]);

/** True when `n` has a descendant that Go's walk writes (see `GO_BLOCKS`). */
function hasGoBlock(n: HtmlElement): boolean {
  const stack: HtmlNode[] = [...n.children];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.kind !== "element") continue;
    if (GO_BLOCKS.has(goToLower(cur.tag)) || hasClass(cur, "mermaid")) return true;
    stack.push(...cur.children);
  }
  return false;
}

/** Go `htmlToMarkdown`, with the PE-008 `div` text rule. */
export function htmlToMarkdown(root: HtmlNode, capture: HtmlCaptures): string {
  const out: string[] = [];
  const addBlock = (text: string) => {
    text = normalizeSpace(text);
    if (text !== "") out.push(text);
  };
  const addRawBlock = (text: string) => {
    text = goTrimSpace(text);
    if (text !== "") out.push(text);
  };
  const walk = (n: HtmlNode): void => {
    if (n.kind === "element") {
      const tag = goToLower(n.tag);
      switch (tag) {
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          out.push(`${"#".repeat(Number(n.tag[1]))} ${textContent(n)}`);
          return;
        case "p":
          addBlock(textContent(n));
          return;
        case "li": {
          const text = textContent(n);
          if (goTrimSpace(text) !== "") out.push(`- ${normalizeSpace(text)}`);
          return;
        }
        case "table": {
          const table = goTrimSpace(htmlTable(n));
          if (table !== "") out.push(table);
          return;
        }
        case "img":
          addRawBlock(capture.image(n));
          return;
        case "svg":
          addRawBlock(capture.svg(n));
          return;
        case "br":
          out.push("");
      }
      if (hasClass(n, "mermaid")) {
        const code = goTrimSpace(rawTextContent(n));
        if (code !== "") addRawBlock(capture.mermaid(code));
        return;
      }
      if (tag === "div") {
        // PE-008: a run of text and inline elements directly inside a div is one paragraph.
        let run: HtmlNode[] = [];
        const flush = () => {
          if (run.length > 0) addBlock(textContent({ kind: "document", children: run }));
          run = [];
        };
        const collect = (nodes: readonly HtmlNode[]): void => {
          for (const child of nodes) {
            const inline = child.kind === "text" || child.kind === "comment" || (child.kind === "element" && DIV_INLINE.has(goToLower(child.tag)) && !hasClass(child, "mermaid"));
            if (!inline) {
              flush();
              walk(child);
            } else if (child.kind === "element" && hasGoBlock(child)) {
              // An inline element that holds something Go writes (an image,
              // an SVG, a line break, a paragraph, ...): its parts take
              // their places in the run, and Go's walk handles the rest.
              collect(child.children);
            } else {
              run.push(child);
            }
          }
        };
        collect(n.children);
        flush();
        return;
      }
    }
    for (const child of children(n)) walk(child);
  };
  walk(root);
  return `${goTrimSpace(out.join("\n\n"))}\n`;
}
