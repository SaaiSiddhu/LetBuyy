import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("replay safety validator enforces deterministic event and projection contracts", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/replay-safety-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("event schema validator enforces append-only versioned replay storage", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/event-schema-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("projection integrity validator enforces source event positions", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/projection-integrity-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("replay safety contract requires producer time and stable serialization", () => {
  const contract = JSON.parse(fs.readFileSync("config/runtime/replay-safety-contract.json", "utf8"));

  assert.equal(contract.determinism.eventTimeSource, "producer-supplied-occurredAt-only");
  assert.equal(contract.determinism.serialization, "stable-json-sorted-keys");
  assert.equal(contract.eventOrdering.gapPolicy, "fail-closed");
  assert.equal(contract.authorization.nonDryRunReplay, "approved-and-timeboxed");
});
