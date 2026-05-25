import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("telemetry lineage validator enforces deterministic evidence correlation", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/telemetry-lineage-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Telemetry lineage validator passed/);
});
