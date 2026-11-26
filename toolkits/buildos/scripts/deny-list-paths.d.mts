// Types for scripts/deny-list-paths.mjs (W1 R7 P7 final check, P7-F-01).
import type { PlatformPath } from "node:path";

export declare const PACKAGE_LABEL: string;
export declare function packEntries(root: string, packageDir: string, packedPaths: readonly string[], pathApi: PlatformPath): { full: string; path: string; packagePath: string }[];
