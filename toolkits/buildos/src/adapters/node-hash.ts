/** The Node implementation of the hash port (`src/core/shared/hash-port.ts`). */
import { createHash } from "node:crypto";
import type { HashPort } from "../core/shared/hash-port.ts";

export const nodeHash: HashPort = {
  sha256Hex: (data) => createHash("sha256").update(data).digest("hex"),
};
