// W1 R7 P9, review round 3 of pull request 17 and the final fix pass: the
// Release Checklist for 0.2.1 in the W1 R7 evidence. This test ties the
// checklist text to the rulings of that pass: the owner accepts the tarball
// before the ledger entry exists; the checks of the stage come before
// `npm stage approve`; the tag block stops before the tag when the merge is
// not a merge commit of <H2> on <B>; `npm audit signatures` runs after an
// install; and each departure names who decided it. It also runs the tag
// block in scratch git repositories, for a merge commit (it passes) and for a
// squash merge (it stops before the tag), with `gh` replaced by a stub.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const text = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const evidence = text(join(repoRoot, "docs", "work", "2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite", "evidence.md"));
const notes = text(join(packageRoot, "RELEASE_NOTES.md"));
const smokeWorkflow = text(join(repoRoot, ".github", "workflows", "buildos-smoke.yml"));

const between = (doc: string, from: string, to: string): string => {
  const a = doc.indexOf(from);
  const b = doc.indexOf(to, a + from.length);
  assert.ok(a >= 0 && b > a, `${from} ... ${to}`);
  return doc.slice(a, b);
};

const checklist = between(evidence, "### Release Checklist for 0.2.1\n", "### Departures From the Written Rules for 0.2.1\n");
const departures = between(evidence, "### Departures From the Written Rules for 0.2.1\n", "\n## Review Round 3 (Pull Request 17) and Final Fix Pass");
const SECTIONS_021 = ["### Fixed", "### Update a project from 0.2.0", "### Known limits", "### Check the package", "### Roll back"];

/** The tag block of owner step 3: the lines from the subshell to the exit-code line, without the list indent. */
function tagBlock(): string {
  const lines = checklist.split("\n");
  const start = lines.indexOf("   (");
  const end = lines.indexOf('   echo "exit code $?"');
  assert.ok(start > 0 && end > start, "owner step 3 holds the subshell block");
  return lines.slice(start, end + 1).map((l) => l.replace(/^ {3}/, "")).join("\n") + "\n";
}

describe("the 0.2.1 checklist: the order of acceptance, ledger entry, review, and merge", () => {
  it("owner step 1 (the accept reply) comes before the ledger entry, its dry run, the review, and the merge", () => {
    const accept = checklist.indexOf('1. Read the orchestrator\'s one-page summary. Reply "accept 0.2.1 <sha256>"');
    const entry = checklist.indexOf("6. The ledger entry, as a second commit `<H2>`");
    const dryRun = checklist.indexOf("7. The dry run of `<H2>` with candidates `committed`.");
    const review = checklist.indexOf("8. An independent review of `<H2>`");
    const merge = checklist.indexOf('2. When the orchestrator says "merge": merge this pull request with "Create a merge commit".');
    assert.ok(accept > 0 && entry > accept && dryRun > entry && review > dryRun && merge > review);
    assert.ok(checklist.includes("--reviewed-by brucewaynedecoy --reviewed-on <the date of the owner's reply>"));
    assert.ok(checklist.indexOf("5. The one-page summary (orchestrator).") < accept);
    assert.ok(departures.includes("The order of runbook step d is kept, so it needs no departure"));
  });
});

describe("the 0.2.1 checklist: the stage checks before npm stage approve", () => {
  it("the owner is told in bold not to approve before the orchestrator says approve", () => {
    assert.ok(checklist.includes('**Stop after owner step 5. Do NOT run `npm stage approve` until the orchestrator says "approve".**'));
    const stop = checklist.indexOf("**Stop after owner step 5.");
    assert.ok(stop > checklist.indexOf("5. When the orchestrator says \"ready\""));
    assert.ok(stop < checklist.indexOf("9. The smoke on three systems on the release asset"));
  });

  it("agent step 9 runs the smoke on the release asset, with inputs the workflow takes, and reads the stage job's log", () => {
    const step9 = between(checklist, "9. The smoke on three systems on the release asset", "Owner steps 6 and 7.");
    assert.ok(step9.includes("`gh workflow run buildos-smoke.yml --repo brucewaynedecoy/build-os --ref main -f source=release-tag -f release_tag=v0.2.1 -f tarball_sha256=<sha256>`"));
    for (const input of ["source", "release_tag", "tarball_sha256"]) assert.match(smokeWorkflow, new RegExp(`^ {6}${input}:$`, "m"), input);
    assert.match(smokeWorkflow, /options: \[[^\]]*\brelease-tag\b[^\]]*\]/);
    assert.ok(step9.includes("`build-os@0.2.1 (staged with id <stage-id>)`"));
    assert.ok(step9.includes("the SHA-256 that the stage check accepted (it equals `<sha256>`)"));
    assert.ok(step9.includes('Only when all of this passes does the orchestrator give the owner `<stage-id>` and say "approve".'));
  });

  it("owner step 6 lists, views, downloads, and hashes the stage before npm stage approve", () => {
    const step6 = between(checklist, '6. When the orchestrator says "approve":', "7. `npm view build-os versions dist-tags --json`");
    const order = ["npm stage list build-os", "npm stage view <stage-id>", "npm stage download <stage-id>", "shasum -a 256 <downloaded file>", "`npm stage approve <stage-id>` (2FA)"];
    let at = -1;
    for (const part of order) {
      const i = step6.indexOf(part, at + 1);
      assert.ok(i > at, `${part} comes in order`);
      at = i;
    }
    assert.ok(step6.includes("shows version `0.2.1` and the dist-tag `latest`"));
    assert.ok(step6.includes("its SHA-256 equals `<sha256>`, the SHA-256 of your \"accept\" reply"));
    assert.ok(step6.includes("If one is not true, do not approve"));
  });

  it("after publication, npm audit signatures runs after an npm init and an install, and only Rekor and PERF-002 moved there", () => {
    const post = checklist.slice(checklist.indexOf("After publication (agents;"));
    assert.ok(post.includes("in a new empty folder, `npm init -y`, `npm install --ignore-scripts build-os@0.2.1`, then `npm audit signatures`"));
    assert.ok(post.includes("the Rekor lookup of runbook h1, on the registry tarball"));
    assert.ok(post.includes("`PERF-002`"));
    assert.ok(!post.includes("npm stage"));
  });
});

describe("the 0.2.1 departures: who decided each one", () => {
  const rows = departures.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Written rule") && !l.startsWith("| ---"));

  it("the owner decision covers exactly its three changes; every other departure is an orchestrator decision the owner may overrule", () => {
    const who = rows.map((r) => r.slice(r.lastIndexOf("| ", r.length - 3) + 2, -2));
    assert.deepEqual(who.filter((w) => w.startsWith("Owner decision")), [
      "Owner decision of 2026-11-27, change (a)",
      "Owner decision of 2026-11-27, change (b)",
      "Owner decision of 2026-11-27, change (c)",
    ]);
    const others = who.filter((w) => !w.startsWith("Owner decision"));
    assert.equal(others.length, 4);
    for (const w of others) assert.equal(w, "Orchestrator decision; the owner may overrule");
    const orchestrator = rows.filter((r) => r.endsWith("| Orchestrator decision; the owner may overrule |")).join("\n");
    assert.ok(orchestrator.includes("One pull request with two commits"));
    assert.ok(orchestrator.includes("`release-dry-run/0.2.1`"));
    assert.ok(orchestrator.includes("through the API"));
    assert.ok(orchestrator.includes('"I thought we already trusted BuildOS on npm."'));
  });

  it("npm trust list is an optional line of owner step 4", () => {
    const step4 = between(checklist, "4. Start the prepare run:", "5. When the orchestrator says \"ready\"");
    assert.ok(step4.includes("Optional, before it: `npm trust list build-os`"));
  });

  it("owner step 5 names what the owner looks at on the draft page", () => {
    const step5 = between(checklist, "5. When the orchestrator says \"ready\"", "**Stop after owner step 5.");
    for (const part of ["the tag is `v0.2.1`", "the target commit is the merge commit of owner step 3", "no \"Status: draft\" line", "exactly two assets, `build-os-0.2.1.tgz` and `buildos-0.2.1.cdx.json`", "Settings > Rules > Rulesets"]) {
      assert.ok(step5.includes(part), part);
    }
  });
});

describe("the 0.2.1 tag block of owner step 3", () => {
  it("checks the merge commit before the tag, in a subshell with set -e, and checks the five headings", () => {
    const block = tagBlock();
    const order = [
      "set -e",
      'test "$(git rev-parse "$L^2")" = "<H2>"',
      'test "$(git rev-parse "$L^1")" = "<B>"',
      'git merge-base --is-ancestor "<H1>" "$L"',
      'test "$(git diff --name-only "<H1>" "$L")" = "toolkits/buildos/release-candidates.json"',
      'git tag v0.2.1 "$L"',
      "git push origin refs/tags/v0.2.1",
      "git show v0.2.1:toolkits/buildos/RELEASE_NOTES.md | ",
      `= "${SECTIONS_021.join("|")}|"`,
      "gh release create v0.2.1 --repo brucewaynedecoy/build-os --draft --verify-tag",
    ];
    let at = -1;
    for (const part of order) {
      const i = block.indexOf(part, at + 1);
      assert.ok(i > at, `${part} comes in order`);
      at = i;
    }
    assert.ok(block.startsWith("(\n  set -e\n"));
    assert.ok(block.endsWith(')\necho "exit code $?"\n'), "no && or || after the subshell, which would turn off set -e");
    assert.ok(checklist.includes("filled in as full SHAs"));
  });

  describe("runs in scratch repositories", { skip: process.platform === "win32" && "sh and zsh steps; the owner runs them on macOS" }, () => {
    let root: string;
    const env = (bin: string) => ({
      ...process.env,
      PATH: bin === "" ? (process.env["PATH"] ?? "") : `${bin}${delimiter}${process.env["PATH"] ?? ""}`,
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    });
    const git = (cwd: string, args: string[]) => {
      const r = spawnSync("git", args, { cwd, encoding: "utf8", env: env("") });
      assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
      return r.stdout.trim();
    };
    let h1 = "";
    let h2 = "";
    let base = "";
    let bin = "";

    before(() => {
      root = mkdtempSync(join(tmpdir(), "buildos-tag-021-"));
      bin = join(root, "bin");
      mkdirSync(bin);
      writeFileSync(join(bin, "gh"), '#!/bin/sh\necho "STUB gh $*"\n');
      chmodSync(join(bin, "gh"), 0o755);
      const src = join(root, "src");
      mkdirSync(join(src, "toolkits", "buildos"), { recursive: true });
      git(src, ["init", "-q", "-b", "main"]);
      writeFileSync(join(src, "toolkits", "buildos", "RELEASE_NOTES.md"), notes);
      writeFileSync(join(src, "toolkits", "buildos", "release-candidates.json"), '{"v":0}\n');
      git(src, ["add", "."]);
      git(src, ["commit", "-q", "-m", "base"]);
      base = git(src, ["rev-parse", "HEAD"]);
      git(src, ["switch", "-q", "-c", "pr"]);
      writeFileSync(join(src, "other.txt"), "h1\n");
      git(src, ["add", "."]);
      git(src, ["commit", "-q", "-m", "h1"]);
      h1 = git(src, ["rev-parse", "HEAD"]);
      writeFileSync(join(src, "toolkits", "buildos", "release-candidates.json"), '{"v":1}\n');
      git(src, ["commit", "-q", "-a", "-m", "h2"]);
      h2 = git(src, ["rev-parse", "HEAD"]);
    });
    after(() => rmSync(root, { recursive: true, force: true }));

    const run = (name: string, kind: "merge" | "squash", shell: string) => {
      const origin = join(root, `${name}.git`);
      const work = join(root, name);
      git(root, ["init", "-q", "--bare", "-b", "main", origin]);
      git(join(root, "src"), ["push", "-q", origin, `${base}:refs/heads/main`]);
      git(root, ["clone", "-q", origin, work]);
      git(work, ["fetch", "-q", join(root, "src"), "pr:pr"]);
      if (kind === "merge") git(work, ["merge", "-q", "--no-ff", "pr", "-m", "Merge pull request #17"]);
      else {
        git(work, ["merge", "-q", "--squash", "pr"]);
        git(work, ["commit", "-q", "-m", "squash (#17)"]);
      }
      git(work, ["push", "-q", "origin", "main"]);
      const script = tagBlock().replaceAll("<H1>", h1).replaceAll("<H2>", h2).replaceAll("<B>", base);
      const scratchTmp = join(root, `${name}-tmp`);
      mkdirSync(scratchTmp);
      const r = spawnSync(shell, ["-c", script], { cwd: work, encoding: "utf8", env: { ...env(bin), TMPDIR: scratchTmp } });
      const remoteTag = git(work, ["ls-remote", "--tags", "origin", "v0.2.1"]);
      const diff = git(work, ["diff", "--name-only", h1, "origin/main"]);
      return { out: r.stdout + r.stderr, stdout: r.stdout, remoteTag, diff };
    };

    for (const shell of ["sh", "zsh"]) {
      const has = spawnSync(shell, ["-c", "true"]).status === 0;
      it(`${shell}: a merge commit passes, pushes the tag, and creates the draft`, { skip: !has && `${shell} is not installed` }, () => {
        const r = run(`merge-${shell}`, "merge", shell);
        assert.match(r.out, /STUB gh release create v0\.2\.1 /);
        assert.match(r.stdout, /exit code 0\n$/);
        assert.notEqual(r.remoteTag, "");
        assert.equal(r.diff, "toolkits/buildos/release-candidates.json");
      });
      it(`${shell}: a squash merge prints the same ledger-only diff, but the block stops before the tag`, { skip: !has && `${shell} is not installed` }, () => {
        const r = run(`squash-${shell}`, "squash", shell);
        assert.equal(r.diff, "toolkits/buildos/release-candidates.json", "the diff alone would not catch it");
        assert.doesNotMatch(r.out, /STUB gh/);
        assert.match(r.stdout, /^exit code [1-9][0-9]*\n$/);
        assert.equal(r.remoteTag, "", "no tag was pushed");
      });
    }
  });
});
