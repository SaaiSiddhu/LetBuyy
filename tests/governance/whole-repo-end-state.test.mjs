import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
  });
}

test("whole-repo end-state validator passes", () => {
  const result = runNode(["scripts/validators/whole-repo-end-state-validator.mjs"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("whole-repo end-state validator is wired into governance", () => {
  const gate = readFileSync(resolve(ROOT, "scripts/validate-governance.mjs"), "utf8");
  assert.match(gate, /whole-repo-end-state-validator\.mjs/);

  const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["validate:end-state"],
    "node scripts/validators/whole-repo-end-state-validator.mjs",
  );
});
