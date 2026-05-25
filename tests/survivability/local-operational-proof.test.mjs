import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("local operational proof runner cannot be mistaken for live certification", () => {
  const source = readFileSync("infrastructure/scripts/operations/run-local-operational-proof.mjs", "utf8");

  assert.match(source, /scope: "local-only"/);
  assert.match(source, /certification: false/);
  assert.match(source, /blocked_live_evidence/);
  assert.match(source, /runReplayProof/);
  assert.match(source, /runQueueRecoveryProof/);
});
