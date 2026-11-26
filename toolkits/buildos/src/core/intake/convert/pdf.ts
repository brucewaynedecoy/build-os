/**
 * Minimal PDF text extraction. The Go intake tool reads PDF text with
 * `github.com/ledongthuc/pdf` `GetPlainText`; the port reads the text runs of
 * each page from the parser port (pdf.js, through `unpdf`) and joins them
 * into lines. PRD 20 Compatibility compares PDF text with Go's only after
 * white space and line breaks are normalized, so the rules below decide
 * words and their order, not exact spacing:
 *
 * - Runs keep content-stream order, as Go does.
 * - A new line starts when the baseline moves by more than half the larger
 *   font size.
 * - A space goes between two runs on one line when the gap between them is
 *   more than 0.15 of the font size and neither run already has one. Go
 *   loses such a gap when the PDF draws it with a `TJ` offset instead of a
 *   space character; this port keeps it (see the evidence report).
 *
 * No OCR: a page that is only a scanned image has no text runs.
 */

import { goPdfXrefError } from "./go-pdf-xref.ts";
import type { PdfTextItem } from "./parsers.ts";

/** The text body of a PDF from its pages' text runs. */
export function pdfPagesToText(pages: readonly (readonly PdfTextItem[])[]): string {
  const lines: string[] = [];
  for (const page of pages) {
    let line = "";
    let last: PdfTextItem | undefined;
    for (const item of page) {
      if (item.str === "") continue;
      if (last !== undefined && Math.abs(item.y - last.y) > Math.max(item.size, last.size) * 0.5) {
        lines.push(line);
        line = "";
        last = undefined;
      }
      if (last !== undefined) {
        const gap = item.x - (last.x + last.width);
        if (gap > item.size * 0.15 && !line.endsWith(" ") && !item.str.startsWith(" ")) line += " ";
      }
      line += item.str;
      last = item;
    }
    if (line !== "") lines.push(line);
  }
  return lines.map((l) => l.replace(/ +$/, "")).join("\n");
}

/**
 * The first checks of Go's `pdf.NewReader` (`github.com/ledongthuc/pdf`
 * `read.go`), with its error texts: the `%PDF-1.x` header, the `%%EOF`
 * marker in the last 100 bytes, a final `startxref` line, and then the
 * `startxref` operand and the cross-reference section it points at
 * (`go-pdf-xref.ts`). A file that passes them goes to pdf.js, whose own
 * message is used for any later failure. Undefined when the checks pass.
 */
export function goPdfOpenError(data: Uint8Array): string | undefined {
  const head = new Uint8Array(10);
  head.set(data.subarray(0, 10));
  const prefix = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]; // %PDF-1.
  if (!prefix.every((b, i) => head[i] === b) || head[7]! < 0x30 || head[7]! > 0x37 || (head[8] !== 0x0d && head[8] !== 0x0a)) return "not a PDF file: invalid header";
  // Go reads the last 100 bytes; a shorter file leaves the buffer zeroed.
  let buf = data.length >= 100 ? data.subarray(data.length - 100) : new Uint8Array(100);
  let end = buf.length;
  while (end > 0 && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d || buf[end - 1] === 0x09 || buf[end - 1] === 0x20)) end--;
  buf = buf.subarray(0, end);
  const eof = [0x25, 0x25, 0x45, 0x4f, 0x46]; // %%EOF
  if (buf.length < eof.length || !eof.every((b, i) => buf[buf.length - eof.length + i] === b)) return "not a PDF file: missing %%EOF";
  // Go findLastLine(buf, "startxref").
  const word = [0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66];
  const isEol = (b: number | undefined) => b === 0x0a || b === 0x0d;
  let max = buf.length;
  for (;;) {
    let i = -1;
    for (let k = max - word.length; k >= 0; k--) {
      if (word.every((b, j) => buf[k + j] === b)) {
        i = k;
        break;
      }
    }
    if (i <= 0 || i + word.length >= buf.length) return "malformed PDF file: missing final startxref";
    if (isEol(buf[i - 1]) && isEol(buf[i + word.length])) return goPdfXrefError(data, data.length - 100 + i);
    max = i;
  }
}
