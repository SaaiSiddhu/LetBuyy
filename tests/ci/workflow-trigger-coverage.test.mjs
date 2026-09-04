import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const WORKFLOW_DIR = ".github/workflows";

function runValidator() {
  return spawnSync(process.execPath, ["scripts/validators/workflow-trigger-coverage-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function workflowText(name) {
  return fs.readFileSync(path.join(process.cwd(), WORKFLOW_DIR, name), "utf8");
}

test("workflow trigger coverage validator passes", () => {
  const result = runValidator();
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("ci.yml gates the Web V1 integration branch on pull_request and push", () => {
  const ci = workflowText("ci.yml");
  const triggerBlock = ci.slice(ci.indexOf("on:"), ci.indexOf("permissions:"));
  const pullRequest = triggerBlock.slice(triggerBlock.indexOf("pull_request:"), triggerBlock.indexOf("push:"));
  const push = triggerBlock.slice(triggerBlock.indexOf("push:"));

  for (const [eventName, block] of [["pull_request", pullRequest], ["push", push]]) {
    // `staging` gates since D-BRANCH (2026-09-04); `stepup/main` is retained as a fail-safe like `develop` was.
    for (const branch of ["main", "staging", "stepup/main", "codex/web-v1-integration"]) {
      assert.ok(
        block.includes(`- ${branch}`),
        `ci.yml ${eventName} trigger must cover ${branch}`,
      );
    }
    assert.ok(
      block.includes("- develop"),
      `ci.yml ${eventName} trigger must retain the develop fail-safe (removing it weakens an existing gate)`,
    );
  }
});

test("no deploy workflow triggers from the Web V1 integration branch", () => {
  for (const name of [
    "production-deploy.yml",
    "production-rollout.yml",
    "live-production-certification.yml",
    "deploy-staging.yml",
    "staging-deploy.yml",
    "staging-runtime-deployment.yml",
    "mobile-merchant-release.yml",
  ]) {
    const text = workflowText(name);
    assert.ok(
      !text.includes("codex/"),
      `${name} must not reference any codex/* branch; deploy lanes stay on the approved release path`,
    );
  }
});

test("architecture-governance.yml reports every gate step instead of fail-fasting", () => {
  const governance = workflowText("architecture-governance.yml");

  const tolerantSteps = governance.match(/continue-on-error: true/g) ?? [];
  assert.ok(
    tolerantSteps.length >= 12,
    `expected >= 12 continue-on-error gate steps, found ${tolerantSteps.length}`,
  );

  assert.ok(governance.includes("id: gate-aggregate"), "aggregate gate step must exist");
  assert.ok(
    governance.indexOf("id: gate-aggregate") > governance.lastIndexOf("continue-on-error: true"),
    "the aggregate gate step must run last so it observes every step outcome",
  );
  assert.ok(governance.includes("exit 1"), "aggregate gate step must be able to fail the job");

  // The historical defect: governance ran first and hid typecheck/test failures behind it.
  const governanceIndex = governance.indexOf("id: validate-governance");
  const typecheckIndex = governance.indexOf("id: typecheck");
  const testsIndex = governance.indexOf("id: governance-tests");
  assert.ok(governanceIndex !== -1 && typecheckIndex !== -1 && testsIndex !== -1);
  assert.ok(
    governance.includes("steps.typecheck.outcome") && governance.includes("steps.governance-tests.outcome"),
    "typecheck and governance test outcomes must be aggregated, not masked by an earlier failure",
  );
});

test("every workflow file parses and declares jobs", () => {
  const dir = path.join(process.cwd(), WORKFLOW_DIR);
  const files = fs.readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));
  assert.ok(files.length > 0, "expected workflow files");

  for (const name of files) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    assert.ok(!text.includes("\t"), `${name} must not use tab indentation`);
    assert.ok(/^jobs:/m.test(text), `${name} must declare a jobs: block`);
  }
});
