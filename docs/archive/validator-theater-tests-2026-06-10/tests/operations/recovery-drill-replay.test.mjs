import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("recovery drill validator enforces deterministic drill lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/recovery-drill-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("recovery drill contract covers replay WAL checkpoint lease compensation queue and orchestration drills", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const drillKinds = new Set(manifest.recoveryDrillGovernance.drillKinds);

  for (const kind of ["replay-restoration", "wal-corruption", "checkpoint-corruption", "lease-failover", "compensation-interruption", "queue-reconstruction", "orchestration-replay"]) {
    assert.ok(drillKinds.has(kind), `missing recovery drill ${kind}`);
  }
  assert.equal(manifest.recoveryDrillGovernance.evidencePolicy, "governance-drills-are-not-live-operational-evidence");
});
