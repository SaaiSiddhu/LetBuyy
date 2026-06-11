import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("branch-lag guard validator passes configuration mode", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/branch-lag-guard-validator.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Branch lag guard validator passed/);
});

test("production deploy enforces branch lag before credential preflight", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/production-deploy.yml"), "utf8");

  assert.match(workflow, /branch-lag-guard:/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /LETBUYY_ENFORCE_BRANCH_LAG: "1"/);
  assert.match(workflow, /release-preflight:\s+name: Release credential preflight\s+needs:\s+- branch-lag-guard\s+- governance-gate/s);
});
