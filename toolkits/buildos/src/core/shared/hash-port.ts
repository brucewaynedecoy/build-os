/**
 * The hash port (W1 R7 P6 review round 4). The init core never loads
 * `node:crypto` (the boundary check in `test/boundary-rules.ts` enforces
 * this). It asks this port for the SHA-256 of a section's text, which the
 * CLI passes in. `src/adapters/node-hash.ts` implements it.
 */
export interface HashPort {
  /** The SHA-256 of `data`, as 64 lowercase hex digits. */
  sha256Hex(data: Uint8Array): string;
}
