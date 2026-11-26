// Test fixtures: well-formed ustar archives, as npm packs them, and the raw
// pieces to craft malformed ones (W1 R7 P8 review round 2, P8-R2-06). Every
// header has the ustar magic and a correct checksum, so a test that wants a
// broken archive breaks exactly one thing.

import { gzipSync } from "node:zlib";

export interface HeaderOptions {
  mode?: number;
  typeFlag?: string;
  linkName?: string;
  /** Overrides the size field text (for crafted sizes). */
  sizeField?: string;
  /** Leaves the checksum wrong. */
  badChecksum?: boolean;
  /** Leaves out the ustar magic. */
  noMagic?: boolean;
}

/** One 512-byte ustar header. */
export function ustarHeader(name: string, size: number, options: HeaderOptions = {}): Buffer {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, "utf8");
  h.write(`${(options.mode ?? 0o644).toString(8).padStart(7, "0")}\0`, 100);
  h.write("0000000\0", 108);
  h.write("0000000\0", 116);
  h.write(options.sizeField ?? `${size.toString(8).padStart(11, "0")}\0`, 124);
  h.write("00000000000\0", 136);
  h.write(options.typeFlag ?? "0", 156);
  if (options.linkName !== undefined) h.write(options.linkName, 157, 100, "utf8");
  if (options.noMagic !== true) {
    h.write("ustar\0", 257);
    h.write("00", 263);
  }
  h.fill(0x20, 148, 156);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${(options.badChecksum === true ? sum + 1 : sum).toString(8).padStart(6, "0")}\0 `, 148);
  return h;
}

/** A header and its padded body. */
export function ustarEntry(name: string, body: Buffer | string, options: HeaderOptions = {}): Buffer {
  const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return Buffer.concat([ustarHeader(name, bytes.length, options), bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512)]);
}

/** The end-of-archive marker: two zero blocks. */
export const TAR_END = Buffer.alloc(1024);

/** A gzipped ustar archive of `files` (paths as given; usually under package/). */
export function tarGz(files: Record<string, Buffer | string>): Uint8Array {
  return new Uint8Array(gzipSync(Buffer.concat([...Object.entries(files).map(([name, body]) => ustarEntry(name, body)), TAR_END])));
}

/** A gzipped archive from raw tar pieces (for duplicates and crafted entries). */
export function tarGzRaw(pieces: Buffer[]): Uint8Array {
  return new Uint8Array(gzipSync(Buffer.concat(pieces)));
}
