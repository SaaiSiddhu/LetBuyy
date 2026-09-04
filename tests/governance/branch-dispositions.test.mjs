import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VALIDATOR = "scripts/validators/branch-dispositions-validator.mjs";

function run(env = {}) {
  return spawnSync(process.execPath, [VALIDATOR], { cwd: repoRoot, encoding: "utf8", env: { ...process.env, ...env } });
}

function ledgerWith(rowsMarkdown, promotionsMarkdown = "") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "letbuyy-ledger-"));
  const file = path.join(dir, "BRANCH_DISPOSITIONS.md");
  fs.writeFileSync(
    file,
    [
      "# fixture",
      "",
      "## Rows",
      "",
      "| Branch | SHA | Status | Decided | Decided by | Why | Merged into |",
      "|---|---|---|---|---|---|---|",
      rowsMarkdown,
      "",
      "## Promotions",
      "",
      "| Date | Source SHA | Target | Pushed | Owner's word (quoted) | CI run |",
      "|---|---|---|---|---|---|",
      promotionsMarkdown,
      "",
    ].join("\n"),
  );
  return file;
}

const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).stdout.trim();
const envRows = ["develop", "staging", "main"].map((b) => `| \`${b}\` | \`${head}\` | ENVIRONMENT | 2026-09-04 | test | fixture | N/A |`).join("\n");

test("branch-dispositions validator passes on the repository ledger", () => {
  const result = run();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Branch dispositions validator passed/);
});

test("a branch with two rows BLOCKS", () => {
  const file = ledgerWith(`${envRows}\n| \`letbuyy/x\` | \`${head}\` | ACTIVE | 2026-09-04 | test | fixture | N/A |\n| \`letbuyy/x\` | \`${head}\` | ACTIVE | 2026-09-04 | test | dup | N/A |`);
  const result = run({ LETBUYY_BRANCH_DISPOSITIONS_PATH: file });
  assert.notEqual(result.status, 0, "a duplicate row must fail the validator, not warn");
  assert.match(result.stderr, /more than one row: letbuyy\/x/);
});

test("an unknown status token BLOCKS", () => {
  const file = ledgerWith(`${envRows}\n| \`letbuyy/y\` | \`${head}\` | DONE | 2026-09-04 | test | fixture | N/A |`);
  const result = run({ LETBUYY_BRANCH_DISPOSITIONS_PATH: file });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown status token "DONE"/);
});

test("a missing ENVIRONMENT row BLOCKS", () => {
  const file = ledgerWith(`| \`develop\` | \`${head}\` | ENVIRONMENT | 2026-09-04 | test | fixture | N/A |`);
  const result = run({ LETBUYY_BRANCH_DISPOSITIONS_PATH: file });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /staging must have an ENVIRONMENT row/);
});

test("a Promotions row targeting an unknown branch BLOCKS", () => {
  const file = ledgerWith(envRows, `| 2026-09-04 | \`${head}\` | \`production\` | no | "fixture" | none |`);
  const result = run({ LETBUYY_BRANCH_DISPOSITIONS_PATH: file });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown branch: production/);
});

test("the chain and ancestry claims use assert, never the non-blocking path", () => {
  const source = fs
    .readFileSync(path.join(repoRoot, VALIDATOR), "utf8")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
  assert.match(source, /reporter\.assert\(isAncestor\("main", "staging"\)/);
  assert.match(source, /reporter\.assert\(isAncestor\("staging", "develop"\)/);
  assert.match(source, /reporter\.assert\(isAncestor\(row\.sha, "develop"\)/);
  assert.doesNotMatch(source, /reporter\.warn\(/, "must not use the deprecated warn path");
});
