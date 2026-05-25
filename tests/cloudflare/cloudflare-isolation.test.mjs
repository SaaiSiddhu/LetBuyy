import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Cloudflare Worker configs isolate dev, staging, and production", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/cloudflare-environment-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
