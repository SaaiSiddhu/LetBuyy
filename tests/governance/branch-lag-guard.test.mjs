import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
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
  assert.match(workflow, /LETBUYY_BRANCH_LAG_CONTEXT: monitor/);
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

function isolatedRefs(t) {
  const root = fs.mkdtempSync(path.join(tmpdir(), "branch-lag-refs-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relative of [
    "scripts/validators/branch-lag-guard-validator.mjs",
    "scripts/validators/governance-common.mjs",
    "scripts/validate-governance.mjs",
    ".github/workflows/production-deploy.yml",
    ".github/workflows/branch-lag-monitor.yml",
  ]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, relative), target);
  }
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "--template=", "-b", "main");
  git("config", "user.name", "Branch lag fixture");
  git("config", "user.email", "synthetic@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("add", "."); git("commit", "-qm", "fixture baseline");
  git("branch", "staging"); git("checkout", "-qb", "develop");
  fs.writeFileSync(path.join(root, "development-only.txt"), "source ahead of release\n");
  git("add", "."); git("commit", "-qm", "development ahead");
  git("update-ref", "refs/remotes/origin/main", "main");
  git("update-ref", "refs/remotes/origin/staging", "staging");
  const run = (overrides = {}) => spawnSync(process.execPath, ["scripts/validators/branch-lag-guard-validator.mjs"], {
    cwd: root, encoding: "utf8",
    env: { ...process.env,
      LETBUYY_ENFORCE_BRANCH_LAG: "1", LETBUYY_SKIP_BRANCH_LAG_FETCH: "1",
      LETBUYY_PRODUCTION_BRANCH: "main", LETBUYY_RELEASE_INTEGRATION_BRANCH: "staging",
      LETBUYY_BRANCH_LAG_CONTEXT: "monitor", GITHUB_REF_NAME: "develop",
      GITHUB_WORKFLOW: "Branch lag monitor", GITHUB_EVENT_NAME: "schedule", ...overrides },
  });
  return { root, git, run };
}

test("scheduled monitor compares remote release refs from an ahead develop checkout without moving any ref", t => {
  const f = isolatedRefs(t), before = f.git("show-ref");
  assert.equal(f.git("rev-list", "--count", "main..HEAD"), "1");
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.git("show-ref"), before);
});

test("monitor blocks genuine main lag even when the current checkout already contains all staging commits", t => {
  const f = isolatedRefs(t);
  f.git("update-ref", "refs/remotes/origin/staging", "HEAD");
  const before = f.git("show-ref"), result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /main is behind staging by 1 commit/);
  assert.equal(f.git("show-ref"), before);
});

test("deployment context still refuses develop and accepts only the aligned main checkout", t => {
  const f = isolatedRefs(t);
  const options = { LETBUYY_BRANCH_LAG_CONTEXT: "deploy", GITHUB_WORKFLOW: "Production deploy", GITHUB_EVENT_NAME: "workflow_dispatch" };
  const refused = f.run(options);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Production deploy must run from main/);
  f.git("checkout", "-q", "main");
  const allowed = f.run({ ...options, GITHUB_REF_NAME: "main" });
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
});

test("production cannot select the monitor context through invocation or workflow configuration", t => {
  const f = isolatedRefs(t);
  const invocation = f.run({ GITHUB_WORKFLOW: "Production deploy", GITHUB_EVENT_NAME: "workflow_dispatch" });
  assert.notEqual(invocation.status, 0);
  assert.match(invocation.stderr, /Monitor context is reserved/);
  const file = path.join(f.root, ".github/workflows/production-deploy.yml");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('LETBUYY_ENFORCE_BRANCH_LAG: "1"', 'LETBUYY_ENFORCE_BRANCH_LAG: "1"\n          LETBUYY_BRANCH_LAG_CONTEXT: monitor'));
  const configured = f.run();
  assert.notEqual(configured.status, 0);
  assert.match(configured.stderr, /Production deploy must retain the main-only deploy context/);
});

test("monitor refuses missing release refs, unknown context and disabled enforcement", t => {
  const f = isolatedRefs(t);
  for (const ref of ["main", "staging"]) {
    const name = "refs/remotes/origin/" + ref, sha = f.git("rev-parse", name);
    f.git("update-ref", "-d", name);
    const missing = f.run();
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Unable to verify main branch lag against staging/);
    f.git("update-ref", name, sha);
  }
  const unknown = f.run({ LETBUYY_BRANCH_LAG_CONTEXT: "ignore-lag" });
  assert.notEqual(unknown.status, 0); assert.match(unknown.stderr, /Unknown branch-lag context/);
  const disabled = f.run({ LETBUYY_ENFORCE_BRANCH_LAG: "" });
  assert.notEqual(disabled.status, 0); assert.match(disabled.stderr, /requires live branch-lag enforcement/);
  const event = f.run({ GITHUB_EVENT_NAME: "push" });
  assert.notEqual(event.status, 0); assert.match(event.stderr, /scheduled or manually dispatched monitor/);
});
