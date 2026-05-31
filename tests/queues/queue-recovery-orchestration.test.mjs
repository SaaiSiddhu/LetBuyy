import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("queue recovery validator enforces deterministic retry and DLQ recovery policy", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/queue-recovery-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("queue recovery policies cover production queues and quarantine poison messages", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-orchestration-manifest.json", "utf8"));
  const queueNames = new Set(manifest.queueRecovery.policies.map((policy) => policy.queueName));

  assert.ok(queueNames.has("letbuyy-events-production"));
  assert.ok(queueNames.has("letbuyy-analytics-queue-production"));
  for (const policy of manifest.queueRecovery.policies) assert.equal(policy.maxPoisonMessages, 0);
});
