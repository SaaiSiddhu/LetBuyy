import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("adaptive throttling validator enforces deterministic recovery governors", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/adaptive-throttling-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("adaptive throttling contract prevents replay compensation and queue rebuild storms", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const prevention = new Set(manifest.adaptiveRecoveryThrottling.stormPrevention);

  for (const item of ["replay", "compensation", "queue-rebuild"]) {
    assert.ok(prevention.has(item), `missing storm prevention ${item}`);
  }
  assert.equal(manifest.adaptiveRecoveryThrottling.governorPolicy, "deterministic-token-bucket-recovery-governor");
});
