import type { HelpEntry } from "./domain.ts";

export const HELP_ENTRY: HelpEntry = {
  name: "help",
  summary: "Print help for the CLI or a domain",
  help: `Usage:
  buildos help [<domain>]

Prints help for the CLI, or for one domain.
`,
};

/** Root help text, built from the registered domains. */
export function rootHelp(domains: readonly HelpEntry[]): string {
  const width = Math.max(...domains.map((domain) => domain.name.length));
  const rows = domains.map((domain) => `  ${domain.name.padEnd(width)}  ${domain.summary}`);
  return `BuildOS deterministic project tooling

Usage:
  buildos <domain> [flags]
  buildos help [<domain>]
  buildos <domain> --help

Domains:
${rows.join("\n")}

Add --json for the stable automation envelope.
Run "buildos help <domain>" for domain details.
`;
}
