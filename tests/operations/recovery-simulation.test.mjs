import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("recovery simulation validator enforces deterministic recovery playback", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/recovery-simulation-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("recovery simulation contract covers durable recovery interruption paths", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const simulationKinds = new Set(manifest.recoverySimulation.simulationKinds);

  for (const kind of ["orchestration-recovery", "replay-restoration", "compensation-recovery", "checkpoint-restoration", "lease-failover", "wal-replay", "execution-continuation"]) {
    assert.ok(simulationKinds.has(kind), `missing recovery simulation ${kind}`);
  }
  assert.equal(manifest.recoverySimulation.equilibriumPolicy, "all-recovery-paths-converge-before-execute-mode");
});
