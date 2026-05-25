import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("resumable execution validator enforces deterministic DAG continuation", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/resumable-execution-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("resumable execution contract covers restart interruption compensation and replay continuation", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/durable-execution-contract.json", "utf8"));
  const survives = new Set(manifest.resumableExecution.survives);

  for (const item of ["restart", "interruption", "partial-compensation", "replay-continuation"]) {
    assert.ok(survives.has(item), `missing resumability case ${item}`);
  }
  assert.equal(manifest.resumableExecution.continuationPolicy, "dependencies-completed-before-next-node");
});
