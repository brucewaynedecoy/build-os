// W1 R7 P7 review round 3 (P7-R3-01 to P7-R3-07, the parts not covered in
// test/design.test.ts and test/installed-layout.test.ts). Each test failed
// before its fix.

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { run } from "../src/cli/run.ts";
import { READ_LIMITS } from "../src/core/shared/read-limits.ts";
import { userPathRel } from "../src/core/shared/buildos-layout.ts";
import { assertOutputMatches, assertSame, captureIo, shape } from "./helpers.ts";

const scratch = mkdtempSync(join(tmpdir(), "buildos-review-3-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const GOLDEN = join(import.meta.dirname, "fixtures", "golden");
let counter = 0;

function copy(fixture: string): string {
  const root = join(scratch, `p${++counter}`);
  cpSync(join(GOLDEN, fixture), root, { recursive: true });
  return root;
}

async function buildos(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const code = await run(args, io);
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

/** Every file under `root`, relative, with `/`. */
function files(root: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...files(root, rel));
    else out.push(rel);
  }
  return out.sort();
}

function tryLink(target: string, path: string): boolean {
  try {
    symlinkSync(target, path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") return false;
    throw error;
  }
}

describe("P7-R3-01: a path the user names is used as written", () => {
  it("the rule: literal, except the legacy system/ spelling in an installed project with no system entry", () => {
    assert.equal(userPathRel("system/inputs/a.csv", true, true), "system/inputs/a.csv", "installed, the user owns system/");
    assert.equal(userPathRel("system/inputs/a.csv", true, false), "inputs/a.csv", "installed, no system/: the Go-era spelling");
    assert.equal(userPathRel("system/inputs/a.csv", false, true), "system/inputs/a.csv", "the source layout");
    assert.equal(userPathRel("inputs/a.csv", true, false), "inputs/a.csv");
  });

  /** An installed project (five folders and the init manifest) that also owns system/.os/, with two different report.csv files. */
  function installedWithSystem(): string {
    const root = copy("intake-installed");
    writeFileSync(join(root, ".os", "manifest.json"), '{"buildos_version":"0.0.0-dev","schema_version":1,"initialized_at":"2026-11-24T00:00:00Z"}\n');
    mkdirSync(join(root, "system", ".os"), { recursive: true });
    mkdirSync(join(root, "system", "inputs"), { recursive: true });
    writeFileSync(join(root, "system", "inputs", "report.csv"), "name,team\nsystem copy,blue\n");
    writeFileSync(join(root, "inputs", "report.csv"), "name,team\nroot copy,red\n");
    return root;
  }

  it("intake convert --source system/inputs/report.csv converts that file, not inputs/report.csv", async () => {
    const root = installedWithSystem();
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "system/inputs/report.csv"], root);
    assert.equal(out.code, 0, out.stderr);
    const twin = readFileSync(join(root, "assets", "report", "report.csv"), "utf8");
    assert.match(twin, /^source: "system\/inputs\/report\.csv"$/m);
    assert.match(twin, /system copy,blue/);
    assert.doesNotMatch(twin, /root copy/);
    // The BuildOS-owned default (--assets-root system/assets) still names assets/ in an installed project.
    assert.ok(!existsSync(join(root, "system", "assets")));
  });

  it("an installed project with no system/ entry keeps Go's legacy spelling", async () => {
    const root = copy("intake-installed");
    writeFileSync(join(root, "inputs", "report.csv"), "name,team\nroot copy,red\n");
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "system/inputs/report.csv"], root);
    assert.equal(out.code, 0, out.stderr);
    assert.match(readFileSync(join(root, "assets", "report", "report.csv"), "utf8"), /root copy,red/);
  });

  it("an explicit --assets-root under a user-owned system/ is used as written", async () => {
    const root = installedWithSystem();
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/report.csv", "--assets-root", "system/converted"], root);
    assert.equal(out.code, 0, out.stderr);
    assert.ok(existsSync(join(root, "system", "converted", "report", "report.csv")));
    assert.ok(!existsSync(join(root, "converted")));
  });

  it("discovery run --evidence system/... copies that file, and the run record names it as written", async () => {
    const root = copy("discovery-installed");
    mkdirSync(join(root, "system", ".os"), { recursive: true });
    mkdirSync(join(root, "system", "inputs", "evidence"), { recursive: true });
    writeFileSync(join(root, "system", "inputs", "evidence", "checkout-notes.txt"), "the system copy\n");
    const out = await buildos(
      ["discovery", "run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", "--evidence", "system/inputs/evidence/checkout-notes.txt", "--raw-finding", "inputs/raw/raw-1.md"],
      root,
    );
    assert.equal(out.code, 0, out.stderr);
    const runDir = join(root, "workspace", "runs", "RUN-003");
    assert.equal(readFileSync(join(runDir, "evidence", "001-checkout-notes.txt"), "utf8"), "the system copy\n");
    assert.match(readFileSync(join(runDir, "run.md"), "utf8"), /\[system\/inputs\/evidence\/checkout-notes\.txt\]/);
  });
});

describe("P7-R3-02: an HTML image is read only from the document's folder or the project", () => {
  /** A project with inputs/page.html that names `srcs`, and a secret file outside the project. */
  function htmlProject(srcs: string[] | ((secret: string) => string[])): { work: string; root: string; secret: string } {
    const work = join(scratch, `w${++counter}`);
    const root = join(work, "project");
    cpSync(join(GOLDEN, "intake-installed"), root, { recursive: true });
    const secret = join(work, "secret.png");
    writeFileSync(secret, "SECRET BYTES");
    mkdirSync(join(root, "inputs", "shared"), { recursive: true });
    writeFileSync(join(root, "inputs", "shared", "logo.png"), "LOGO");
    mkdirSync(join(root, "inputs", "page_files"), { recursive: true });
    writeFileSync(join(root, "inputs", "page_files", "chart.png"), "CHART");
    writeFileSync(join(root, "inputs", "page.html"), `<html><body><h1>Page</h1>\n${(typeof srcs === "function" ? srcs(secret) : srcs).map((s, i) => `<img src="${s}" alt="Image ${i + 1}">`).join("\n")}\n</body></html>`);
    return { work, root, secret };
  }

  function media(root: string): string[] {
    const dir = join(root, "assets", "page", "media");
    return existsSync(dir) ? readdirSync(dir).map((name) => readFileSync(join(dir, name), "utf8")) : [];
  }

  it("copies an image in the document's folder tree or elsewhere in the project, as Go", async () => {
    const { root } = htmlProject(["page_files/chart.png", "shared/logo.png", "../inputs/shared/logo.png"]);
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/page.html"], root);
    assert.equal(out.code, 0, out.stderr);
    assert.equal(out.stderr, "");
    assert.deepEqual(media(root), ["CHART", "LOGO", "LOGO"]);
  });

  it("does not read a file outside the project (../, an absolute path), says why on stderr, and exits 0 with Go's link", async () => {
    const { root, secret } = htmlProject((secret) => ["../../secret.png", secret, `file://${secret}`, "page_files/chart.png"]);
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/page.html"], root);
    assert.equal(out.code, 0, out.stderr);
    assert.deepEqual(media(root), ["CHART"], "only the image inside the project is copied");
    const twin = readFileSync(join(root, "assets", "page", "page.md"), "utf8");
    assert.match(twin, /\[Uncopied image: Image 1\]\(\.\.\/\.\.\/secret\.png\)/);
    assert.ok(twin.includes(`[Uncopied image: Image 2](${secret})`));
    assert.doesNotMatch(twin, /SECRET/);
    const lines = out.stderr.split("\n").filter(Boolean);
    assert.deepEqual(lines, [
      "buildos-intake: warning: did not copy image ../../secret.png from inputs/page.html: the file is outside the folder that holds the document and outside the project, so BuildOS did not read it. The converted file has an \"Uncopied image\" marker with the address as the document gives it; that address is relative to the document, not to the converted file.",
      `buildos-intake: warning: did not copy image ${secret} from inputs/page.html: the file is outside the folder that holds the document and outside the project, so BuildOS did not read it. The converted file has an \"Uncopied image\" marker with the address as the document gives it; that address is relative to the document, not to the converted file.`,
    ]);
  });

  it("does not follow a link in the document's folder out of the project, also with --allow-outside-root", async (t) => {
    const { root, secret } = htmlProject(["page_files/leak.png"]);
    if (!tryLink(secret, join(root, "inputs", "page_files", "leak.png"))) return t.skip("this OS does not allow a symlink here");
    for (const extra of [[], ["--allow-outside-root"]]) {
      rmSync(join(root, "assets", "page"), { recursive: true, force: true });
      const out = await buildos(["intake", "convert", ...extra, "--repo-root", root, "--source", "inputs/page.html"], root);
      assert.equal(out.code, 0, out.stderr);
      assert.deepEqual(media(root), []);
      assert.match(out.stderr, /did not copy image page_files\/leak\.png from inputs\/page\.html: the file is outside/);
    }
  });

  it("a document outside the project: its own folder tree is allowed, a file one level above it is not (PE-018)", async () => {
    const work = join(scratch, `w${++counter}`);
    const root = join(work, "project");
    cpSync(join(GOLDEN, "intake-installed"), root, { recursive: true });
    const exportDir = join(work, "export", "site");
    mkdirSync(join(exportDir, "img"), { recursive: true });
    writeFileSync(join(exportDir, "img", "a.png"), "A");
    writeFileSync(join(work, "export", "shared.png"), "SHARED");
    writeFileSync(join(exportDir, "page.html"), '<html><body><img src="img/a.png" alt="A"><img src="../shared.png" alt="Shared"></body></html>');
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", join(exportDir, "page.html")], root);
    assert.equal(out.code, 0, out.stderr);
    assert.deepEqual(media(root), ["A"]);
    assert.match(out.stderr, /did not copy image \.\.\/shared\.png from .+page\.html: the file is outside the folder that holds the document and outside the project/);
  });

  it("an HTML folder: a page in a subfolder may use an image anywhere in the selected folder", async () => {
    const work = join(scratch, `w${++counter}`);
    const root = join(work, "project");
    cpSync(join(GOLDEN, "intake-installed"), root, { recursive: true });
    const site = join(work, "site");
    mkdirSync(join(site, "docs"), { recursive: true });
    mkdirSync(join(site, "img"), { recursive: true });
    writeFileSync(join(site, "img", "a.png"), "A");
    writeFileSync(join(site, "docs", "page.html"), '<html><body><img src="../img/a.png" alt="A"></body></html>');
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", site], root);
    assert.equal(out.code, 0, out.stderr);
    assert.equal(out.stderr, "");
    assert.equal(readFileSync(join(root, "assets", "site", "media", "docs-page-image-001.png"), "utf8"), "A");
  });

  it("P7-R3-06: an image over the read bound is not copied; the warning names the file and the bound, and the command exits 0", async () => {
    const { root } = htmlProject(["page_files/big.png"]);
    const big = join(root, "inputs", "page_files", "big.png");
    writeFileSync(big, "");
    truncateSync(big, READ_LIMITS.intake + 1);
    const out = await buildos(["intake", "convert", "--repo-root", root, "--source", "inputs/page.html"], root);
    assert.equal(out.code, 0, out.stderr);
    assert.deepEqual(media(root), []);
    assert.equal(
      out.stderr,
      "buildos-intake: warning: did not copy image page_files/big.png from inputs/page.html: the file is larger than 512 MiB, the most BuildOS reads from one file. The converted file has an \"Uncopied image\" marker with the address as the document gives it; that address is relative to the document, not to the converted file.\n",
    );
    assert.match(readFileSync(join(root, "assets", "page", "page.md"), "utf8"), /\[Uncopied image: Image 1\]\(page_files\/big\.png\)/);
  });
});

describe("P7-R3-03: discovery and design read the entity graph inside the project only", () => {
  it("a data folder that is a link out of the project is refused (exit 3), with or without --allow-outside-root", async (t) => {
    const root = copy("design-installed");
    const outside = join(scratch, `outside-data-${++counter}`);
    cpSync(join(root, ".os", "data"), outside, { recursive: true });
    rmSync(join(root, ".os", "data"), { recursive: true });
    if (!tryLink(outside, join(root, ".os", "data"))) return t.skip("this OS does not allow a symlink here");
    for (const extra of [[], ["--allow-outside-root"]]) {
      const out = await buildos(["design", "promote", "finding", ...extra, "--repo-root", root, "--finding-id", "FIND-002", "--route", "baseline-plan", "--dry-run"], root);
      assert.equal(out.code, 3, out.stderr);
      assert.match(out.stderr, /resolves outside the root .+; BuildOS reads this file only inside the project/);
      assert.doesNotMatch(out.stderr, /pass --allow-outside-root/);
    }
  });

  it("a dataset other than the index the command replaces may not be a link out of the project", async (t) => {
    const root = copy("discovery-installed");
    const outside = join(scratch, `outside-req-${++counter}.jsonl`);
    cpSync(join(root, ".os", "data", "requirements.jsonl"), outside);
    rmSync(join(root, ".os", "data", "requirements.jsonl"));
    if (!tryLink(outside, join(root, ".os", "data", "requirements.jsonl"))) return t.skip("this OS does not allow a symlink here");
    const out = await buildos(["discovery", "run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", "--evidence", "inputs/evidence/checkout-notes.txt", "--raw-finding", "inputs/raw/raw-1.md", "--dry-run"], root);
    assert.equal(out.code, 3, out.stderr);
    assert.match(out.stderr, /requirements\.jsonl resolves outside the root/);
  });
});

describe("P7-R3-04: a file BuildOS reads back is never written over its read bound", () => {
  it("a runs.jsonl at exactly 128 MiB: the next run stops before any write (exit 4), the dry run too", async () => {
    const root = copy("discovery-installed");
    const index = join(root, ".os", "data", "runs.jsonl");
    const rows = readFileSync(index);
    // Valid run rows with an unknown padding field (kept as is), each under the 64 KiB line limit of the discovery index scanner, fill the index to exactly the bound.
    const parts = [rows];
    let size = rows.length;
    for (let n = 900; size < READ_LIMITS.data; n++) {
      const head = `{"id":"RUN-${n}","type":"run","status":"closed","x_pad":"`;
      const room = READ_LIMITS.data - size - head.length - 3;
      const row = `${head}${"a".repeat(Math.max(0, Math.min(60_000, room)))}"}\n`;
      parts.push(Buffer.from(row));
      size += row.length;
    }
    writeFileSync(index, Buffer.concat(parts));
    assert.equal(statSync(index).size, READ_LIMITS.data);
    const before = files(root);
    const args = ["discovery", "run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", "--evidence", "inputs/evidence/checkout-notes.txt", "--raw-finding", "inputs/raw/raw-1.md"];
    for (const extra of [["--dry-run"], []]) {
      const out = await buildos([...args, ...extra], root);
      assert.equal(out.code, 4, out.stderr);
      assert.match(out.stderr, /^buildos-discovery: error: \.os\/data\/runs\.jsonl would be \d+ bytes, more than the 128 MiB BuildOS reads from one such file, so later commands could not read it\. BuildOS wrote nothing\.\n$/);
    }
    assert.deepEqual(files(root), before);
    assert.equal(statSync(index).size, READ_LIMITS.data);
  });
});

describe("P7-R3-07: buildos init uses the layout rule before it adopts", () => {
  it("in a BuildOS source checkout with a stray .os/: exit 10, a plain message, nothing written", async () => {
    const root = join(scratch, `checkout-${++counter}`);
    mkdirSync(join(root, "system", ".os"), { recursive: true });
    mkdirSync(join(root, ".os"));
    const before = files(root);
    for (const json of [false, true]) {
      const out = await buildos(["init", "--skip-make-docs", "--root", root, ...(json ? ["--json"] : [])], root);
      assert.equal(out.code, 10, shape(out.stdout + out.stderr));
      if (json) assert.equal((JSON.parse(out.stdout) as { diagnostics: { code: string }[] }).diagnostics[0]!.code, "init_source_checkout");
      else assertOutputMatches(out.stderr, /looks like the BuildOS source code, not a project: it has a system\/\.os\/ folder and no \.os\/manifest\.json\. BuildOS changed nothing\./);
    }
    assertSame(files(root), before);
    assert.ok(!existsSync(join(root, ".os", "manifest.json")));
    // The checkout itself, with no root .os/: the same stop.
    const plain = join(scratch, `checkout-${++counter}`);
    mkdirSync(join(plain, "system", ".os"), { recursive: true });
    assert.equal((await buildos(["init", "--skip-make-docs", "--root", plain], plain)).code, 10);
    assert.deepEqual(readdirSync(plain), ["system"]);
  });

  it("an .os/ folder with no Go-era marker is not adopted (exit 10); with .os/data/ it is", async () => {
    const root = join(scratch, `unknown-${++counter}`);
    mkdirSync(join(root, ".os", "cache"), { recursive: true });
    const out = await buildos(["init", "--skip-make-docs", "--root", root], root);
    assert.equal(out.code, 10, shape(out.stdout + out.stderr));
    assertOutputMatches(out.stderr, /has an \.os\/ folder that the earlier BuildOS tools did not set up/);
    assertSame(files(root), []);
    mkdirSync(join(root, ".os", "data"));
    const adopted = await buildos(["init", "--skip-make-docs", "--root", root, "--json"], root);
    assert.equal(adopted.code, 0, shape(adopted.stdout + adopted.stderr));
    assertSame((JSON.parse(adopted.stdout) as { result: { setup: string } }).result.setup, "adoption");
  });
});
