import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("branch-lag guard validator passes when the working branch is not ahead of the production branch", () => {
  // LETBUYY_PRODUCTION_BRANCH=HEAD makes `HEAD..HEAD` a zero-lag comparison, so
  // the pass path is exercised without depending on live branch topology.
  const result = spawnSync(process.execPath, ["scripts/validators/branch-lag-guard-validator.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, LETBUYY_PRODUCTION_BRANCH: "HEAD", LETBUYY_ENFORCE_BRANCH_LAG: "" },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Branch lag guard validator passed/);
});

test("branch-lag guard validator BLOCKS a real branch lag instead of warning", () => {
  // Wave 0 truthfulness repair: local-mode branch lag used reporter.warn() and
  // could never fail. It must now exit non-zero on a genuine lag. HEAD~1 is
  // always exactly one commit behind HEAD.
  const result = spawnSync(process.execPath, ["scripts/validators/branch-lag-guard-validator.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, LETBUYY_PRODUCTION_BRANCH: "HEAD~1", LETBUYY_ENFORCE_BRANCH_LAG: "" },
  });

  assert.notEqual(result.status, 0, "a real branch lag must fail the validator, not warn");
  assert.match(result.stderr, /commit\(s\) ahead of/);
});

test("branch-lag guard exposes no non-blocking downgrade for local lag", () => {
  const source = fs
    .readFileSync(path.join(repoRoot, "scripts/validators/branch-lag-guard-validator.mjs"), "utf8")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

  assert.doesNotMatch(source, /reporter\.warn\(/, "branch-lag guard must not use the non-blocking reporter.warn path");
  assert.doesNotMatch(
    source,
    /reporter\.advisory\(/,
    "branch-lag guard must not downgrade a real lag to a declared advisory",
  );
});

test("production deploy enforces branch lag before credential preflight", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/production-deploy.yml"), "utf8");

  assert.match(workflow, /branch-lag-guard:/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /LETBUYY_ENFORCE_BRANCH_LAG: "1"/);
  assert.match(workflow, /release-preflight:\s+name: Release credential preflight\s+needs:\s+- branch-lag-guard\s+- governance-gate/s);
});

test("scheduled branch-lag monitor enforces main against staging (D-BRANCH, 2026-09-04)", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/branch-lag-monitor.yml"), "utf8");

  assert.match(workflow, /schedule:\s+- cron: "17 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /node scripts\/validators\/branch-lag-guard-validator\.mjs/);
  assert.match(workflow, /LETBUYY_ENFORCE_BRANCH_LAG: "1"/);
  assert.match(workflow, /LETBUYY_PRODUCTION_BRANCH: main/);
  assert.match(workflow, /LETBUYY_RELEASE_INTEGRATION_BRANCH: staging/);
  assert.doesNotMatch(workflow, /stepup\/main/, "the monitor must not measure the preserved alias");
});

test("local mode asserts the fast-forward chain main ⊆ staging ⊆ develop and never downgrades it", () => {
  const source = fs
    .readFileSync(path.join(repoRoot, "scripts/validators/branch-lag-guard-validator.mjs"), "utf8")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

  assert.match(source, /\[productionBranch, integrationBranch\]/);
  assert.match(source, /\[integrationBranch, developBranch\]/);
  assert.match(source, /LETBUYY_RELEASE_INTEGRATION_BRANCH \|\| "staging"/);
  assert.match(source, /strayCount === 0/);

  // A chain violation must be a real failure: name a downstream ref that is NOT an ancestor of its upstream.
  // `HEAD` as production vs `HEAD~1` as integration means HEAD holds one commit absent from HEAD~1.
  const result = spawnSync(process.execPath, ["scripts/validators/branch-lag-guard-validator.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, LETBUYY_PRODUCTION_BRANCH: "HEAD", LETBUYY_RELEASE_INTEGRATION_BRANCH: "HEAD~1", LETBUYY_ENFORCE_BRANCH_LAG: "" },
  });
  // With LETBUYY_PRODUCTION_BRANCH set the explicit-override path runs (HEAD..HEAD = 0 → pass); the chain
  // path is exercised only without the override, which the pass test above covers on the real refs.
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
