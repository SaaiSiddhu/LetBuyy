import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("distributed clock validator enforces logical temporal ordering", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/distributed-clock-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("distributed clock contract forbids nondeterministic temporal sources", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const forbiddenSources = new Set(manifest.distributedClock.forbiddenTemporalSources);

  for (const source of ["Date.now", "new Date()", "Math.random"]) {
    assert.ok(forbiddenSources.has(source), `missing forbidden temporal source ${source}`);
  }
  assert.equal(manifest.distributedClock.replayTemporalPolicy, "logical-clock-ordering-precedes-wall-clock-observation");
});
