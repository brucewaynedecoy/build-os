/**
 * Input limits for `buildos intake convert`. Every source file is untrusted:
 * a ZIP bomb, a deeply nested document, or a huge sparse sheet must fail
 * cleanly, in bounded time and memory, before any file is written. Each
 * limit is far above what a real office document, web page, or PDF needs.
 * A source that passes a limit converts exactly as the Go intake tool
 * converts it; one that exceeds a limit fails with exit 1 and
 * `buildos-intake: error: <format>: <what> exceeds the BuildOS input limit
 * (<limit>)`, in the same class as Go's "not a valid zip file" or "XML
 * syntax error" failures. `SECURITY.md` lists the same values.
 */

import { GoError } from "../shared/go-fs.ts";

const MiB = 1024 * 1024;

export const INTAKE_LIMITS = {
  /** Entries in one ZIP archive (DOCX, XLSX), counted from the central directory. */
  zipMaxEntries: 10_000,
  /** Expanded bytes of one ZIP entry, counted on the inflated output. */
  zipMaxEntryBytes: 256 * MiB,
  /** Expanded bytes of all ZIP entries one conversion reads, counted on the inflated output. */
  zipMaxTotalBytes: 512 * MiB,
  /** Expanded size over compressed size of one entry, checked when the entry expands past `zipRatioFloorBytes`. */
  zipMaxRatio: 250,
  /** Entries smaller than this are not ratio-checked (a tiny entry can compress very well). */
  zipRatioFloorBytes: 1 * MiB,
  /** Open elements at one time in an XML part. */
  xmlMaxDepth: 1_000,
  /**
   * Elements, attributes, and text runs in one XML part that is parsed into
   * a tree (workbook, relationships, numbering). DOCX bodies, worksheets,
   * and shared strings are streamed, so they are bounded by the ZIP entry
   * limit instead.
   */
  xmlMaxNodes: 1_000_000,
  /** Attributes on one XML element, counted as each attribute is read. */
  xmlMaxAttributes: 10_000,
  /** UTF-8 bytes of the attribute names and values of one XML element, counted as each value is read. */
  xmlMaxAttributeBytes: 16 * MiB,
  /** Open elements at one time in an HTML document. */
  htmlMaxDepth: 512,
  /** Nodes in one HTML document. */
  htmlMaxNodes: 2_000_000,
  /** Columns in one worksheet row (Excel's own limit, column XFD). */
  xlsxMaxColumns: 16_384,
  /** Rows in one worksheet (Excel's own limit). */
  xlsxMaxRows: 1_048_576,
  /** Cells one worksheet allocates (sum of row widths), so a sparse sheet cannot allocate empty cells without bound. */
  xlsxMaxCells: 20_000_000,
  /** Shared strings in one workbook (`xl/sharedStrings.xml`), counted as each is read. */
  xlsxMaxSharedStrings: 2_000_000,
  /** Characters of all shared strings in one workbook, counted as text is read. */
  xlsxMaxSharedStringChars: 64 * MiB,
  /** Bytes of one worksheet's CSV twin, counted as rows are written (a short shared string can repeat in every cell). */
  xlsxMaxCsvBytes: 128 * MiB,
  /** Pages in one PDF. */
  pdfMaxPages: 5_000,
  /** Characters of extracted text in one PDF. */
  pdfMaxTextChars: 64 * MiB,
  /** Nested arrays and dictionaries in one PDF object read by the cross-reference checks. */
  pdfMaxObjectDepth: 1_000,
  /** `/Prev` cross-reference sections followed (Go follows a `/Prev` loop forever). */
  pdfMaxXrefSections: 1_000,
} as const;

/**
 * A limit failure. It is a `GoError`, so the CLI prints it as Go prints an
 * invalid input (exit 1), but no converter ever ignores it, even where Go
 * ignores a parse error (`word/numbering.xml`, `xl/sharedStrings.xml`).
 */
export class IntakeLimitError extends GoError {
  constructor(format: string, what: string, limit: string) {
    super(`${format}: ${what} exceeds the BuildOS input limit (${limit})`);
    this.name = "IntakeLimitError";
  }
}
