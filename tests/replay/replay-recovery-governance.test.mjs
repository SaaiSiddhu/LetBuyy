import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("replay recovery validator enforces ordered replay reconstruction contracts", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/replay-recovery-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("replay recovery plan uses checksums from replay evolution fixtures", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-orchestration-manifest.json", "utf8"));
  const plan = manifest.replayRecovery.recoveryPlans[0];

  assert.equal(plan.expectedProjectionChecksum, "77e95d5b");
  assert.deepEqual(
    plan.events.map((event) => event.checksum),
    ["da9a2c09", "781109fa", "557a2bb1"],
  );
});
