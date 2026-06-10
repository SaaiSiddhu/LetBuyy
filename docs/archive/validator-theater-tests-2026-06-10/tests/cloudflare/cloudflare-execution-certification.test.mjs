import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Cloudflare execution certification validator enforces provider boundary contracts", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/cloudflare-execution-certification-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Cloudflare execution certification validator passed/);
});
