// Types for scripts/tar-reader.mjs (W1 R7 P8 review round 2, P8-R2-06).

export declare class TarError extends Error {
  readonly kind: string;
  constructor(kind: string);
}

export interface TarReaderEntry {
  path: string;
  type: "file" | "dir" | "symlink" | "hardlink" | "other";
  typeFlag: string;
  mode: number;
  size: number;
  linkName: string;
  body: Uint8Array | undefined;
}

export declare function readTar(tar: Uint8Array): TarReaderEntry[];
export declare function duplicatePaths(entries: readonly { path: string }[]): string[];
