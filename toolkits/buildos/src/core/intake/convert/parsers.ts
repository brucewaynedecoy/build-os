/**
 * The parser port of the intake converters. Core owns every conversion rule
 * (ported from the Go intake tool), but it never loads a ZIP, HTML, or PDF
 * package: the CLI passes in an implementation, and
 * `src/adapters/intake-parsers.ts` builds one from the bundled packages
 * (`fflate`, `parse5`, `unpdf`). XML is read by core itself, with a port of
 * Go's `encoding/xml` decoder (`go-xml.ts`). Every parser enforces
 * `INTAKE_LIMITS`. The port takes bytes and
 * returns plain data, so a package can never write a file or print output
 * through core. A parser failure throws a `GoError` with the text the Go
 * intake tool prints where Go's text is known, else the package's message.
 */

/**
 * One ZIP entry, in central-directory order. Its bytes are inflated only
 * when `read` is called, within the entry, total, and ratio limits, and
 * checked against the declared size and CRC-32 as Go's `zip.File.Open` does.
 */
export interface ZipEntry {
  name: string;
  /** Inflates the entry. Throws a `GoError` with Go's text, or a limit message. */
  read(): Uint8Array;
}

/** An XML attribute: its local name, its namespace URI (`""` when it has none), and its value. */
export interface XmlAttr {
  local: string;
  space: string;
  value: string;
}

/** An XML element, with its namespace URI and its child elements and character data (CDATA included) in order. */
export interface XmlElement {
  kind: "element";
  local: string;
  space: string;
  attrs: XmlAttr[];
  children: XmlNode[];
}

export interface XmlText {
  kind: "text";
  text: string;
}

export type XmlNode = XmlElement | XmlText;

/**
 * An HTML attribute as Go's `golang.org/x/net/html` stores it: `namespace`
 * is `xlink`, `xml`, or `xmlns` for an adjusted foreign attribute, else `""`.
 */
export interface HtmlAttr {
  namespace: string;
  key: string;
  value: string;
}

/** An HTML node of the WHATWG tree, as Go's `html.Parse` builds it. */
export type HtmlNode =
  | { kind: "document"; children: HtmlNode[] }
  | { kind: "doctype"; name: string; publicId: string; systemId: string }
  | { kind: "comment"; data: string }
  | { kind: "text"; data: string }
  | {
      kind: "element";
      /** The tag name as Go spells it (lower case for HTML, adjusted case for SVG and MathML). */
      tag: string;
      /** `""` for HTML, `svg`, or `math`, as Go's `Node.Namespace`. */
      namespace: string;
      attrs: HtmlAttr[];
      /** The children; for `template`, its template contents, as Go keeps them. */
      children: HtmlNode[];
    };

/** One run of PDF text on a page, in content-stream order, with its position in points. */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  /** The font size the run is drawn at, in points. */
  size: number;
}

export interface IntakeParsers {
  /**
   * Opens a ZIP archive (Go `zip.OpenReader`): reads the central directory
   * and refuses an archive with too many entries or an unsafe entry name.
   * No entry is inflated until its `read` is called.
   */
  readZip(data: Uint8Array): ZipEntry[];
  /** Parses an HTML document as UTF-8 (Go `html.Parse`). */
  parseHtml(data: Uint8Array): HtmlNode;
  /** The text runs of each page of a PDF, in page order. No OCR. */
  pdfText(data: Uint8Array): Promise<PdfTextItem[][]>;
}
