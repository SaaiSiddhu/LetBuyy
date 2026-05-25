import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("replay simulation validator enforces stable branch timelines", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/replay-simulation-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("replay simulation covers schema evolution, rollback, checkpoint recovery, and branching", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));
  const scenarios = new Set(manifest.replaySimulation.branches.map((branch) => branch.scenario));

  for (const scenario of ["schema-evolution", "deployment-rollback", "checkpoint-recovery", "replay-branch"]) {
    assert.ok(scenarios.has(scenario), `missing scenario ${scenario}`);
  }
});
