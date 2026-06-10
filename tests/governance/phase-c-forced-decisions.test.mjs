import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("Phase C forced-decision validator passes current governance docs", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/phase-c-forced-decisions-validator.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Phase C forced decisions validator passed/);
});

test("Phase C forced-decision validator is wired into the gate", () => {
  const gate = fs.readFileSync(path.join(repoRoot, "scripts/validate-governance.mjs"), "utf8");
  assert.match(gate, /"phase-c-forced-decisions-validator\.mjs"/);
});
