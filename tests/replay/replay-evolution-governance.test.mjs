import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("replay evolution validator enforces versioned deterministic event lineage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/replay-evolution-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("event versioning validator blocks unsafe replay evolution", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/event-versioning-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("replay evolution manifest is explicit governance contract, not live evidence", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/replay-evolution-manifest.json", "utf8"));

  assert.equal(manifest.mode, "governance-contract-not-live-evidence");
  assert.equal(manifest.serializer.name, "stable-json-sorted-keys");
  assert.equal(manifest.serializer.eventTimeSource, "producer-supplied-occurredAt-only");
  assert.ok(manifest.deterministicSnapshots[0].description.includes("not live production evidence"));
});
