import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("test-only dependencies are allowed in __tests__ and refused in runtime source", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "letbuyy-dependency-test-"));
  const validator = fileURLToPath(new URL("../../scripts/validators/dependency-manifest-validator.mjs", import.meta.url));
  const service = path.join(fixture, "services", "gateway");
  try {
    const initialized = spawnSync("git", ["init", "--quiet", fixture], { encoding: "utf8" });
    assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
    fs.mkdirSync(path.join(service, "src", "__tests__"), { recursive: true });
    fs.writeFileSync(path.join(service, "package.json"), JSON.stringify({
      name: "@fixture/gateway", devDependencies: { "test-client": "1.0.0" },
    }));
    fs.writeFileSync(path.join(service, "src", "__tests__", "client.test.ts"), "import client from 'test-client';\n");
    const run = () => spawnSync(process.execPath, [validator], { cwd: fixture, encoding: "utf8" });
    let result = run();
    assert.equal(result.status, 0, result.stderr || result.stdout);
    fs.writeFileSync(path.join(service, "src", "handler.ts"), "import client from 'test-client';\n");
    result = run();
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr + result.stdout, /src\/handler\.ts imports test-client/);
    assert.doesNotMatch(result.stderr + result.stdout, /client\.test\.ts imports test-client/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

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
