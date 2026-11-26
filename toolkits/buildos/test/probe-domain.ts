// A test-only domain that drives every exit code through the real dispatcher.

import {
  ContractError,
  IndexRebuildError,
  InputError,
  NeedsOperatorReviewError,
  WriteError,
} from "../src/core/shared/errors.ts";
import type { Domain } from "../src/cli/domain.ts";
import { parseCommandFlags, wantsJson } from "../src/cli/parse.ts";
import { UsageError } from "../src/cli/usage-error.ts";

export const probeDomain: Domain = {
  name: "probe",
  summary: "Test-only probe",
  help: "Usage:\n  buildos probe <case> [--json]\n",
  run(args, context) {
    const [kase, ...rest] = args;
    // The Go seed entity rule: a usage error is JSON when the literal `--json` is present.
    const { values } = parseCommandFlags(`probe.${kase ?? ""}`, { json: "boolean" }, rest, (_partial, raw) => wantsJson(raw));
    const json = values.json === true;
    context.setCommand(`probe.${kase ?? ""}`);
    const opts = { code: `probe_${kase ?? ""}`, correction: "Probe correction.", root: "/probe-root" };
    switch (kase) {
      case "ok":
        return { command: "probe.ok", json, root: "/probe-root", mode: "compat", result: { fine: true } };
      case "notice":
        context.notice("notice: this is informational");
        return { command: "probe.notice", json, result: { fine: true } };
      case "warn":
        return {
          command: "probe.warn",
          json,
          result: { fine: true },
          diagnostics: [{ code: "probe_warning", severity: "warning", message: "a warning" }],
        };
      case "usage":
        throw new UsageError("probe usage problem", { command: "probe.usage", json });
      case "input":
        throw new InputError("cannot load input", opts);
      case "contract":
        throw new ContractError("contract conflict", opts);
      case "io":
        throw new WriteError("write failed", opts);
      case "index":
        throw new IndexRebuildError("index rebuild failed", opts);
      case "review":
        throw new NeedsOperatorReviewError("needs a person", opts);
      case "unexpected":
        throw new TypeError("boom happened\n    at secret (file.ts:1:1)");
      case "throw-string":
        throw "plain string failure";
      default:
        throw new UsageError(`unknown probe case ${JSON.stringify(kase)}`, { command: "probe", json });
    }
  },
};
