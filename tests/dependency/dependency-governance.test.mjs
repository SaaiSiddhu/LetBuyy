import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("dependency manifests declare all imported packages", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/dependency-manifest-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("workspace lifecycle enforces strict pnpm and deterministic toolchain governance", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/workspace-lifecycle-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Workspace lifecycle validator passed/);
});

test("package imports use explicit public exports", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/package-export-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
