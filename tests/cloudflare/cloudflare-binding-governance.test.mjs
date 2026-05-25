import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Cloudflare binding validator enforces explicit env ownership", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/cloudflare-binding-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
