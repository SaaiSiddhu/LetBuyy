import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("runtime state machine validator enforces explicit lifecycle transitions", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/runtime-state-machine-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("runtime lifecycle state machines have terminal states with no outbound transitions", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-orchestration-manifest.json", "utf8"));

  assert.equal(manifest.stateMachines.length, 6);
  for (const machine of manifest.stateMachines) {
    for (const terminalState of machine.terminalStates) {
      assert.equal(machine.transitions.some((transition) => transition.from === terminalState), false, `${machine.kind}/${terminalState}`);
    }
  }
});
