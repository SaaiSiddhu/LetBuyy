import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("manifest lineage validator enforces runtime manifest checksums", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/manifest-lineage-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("manifest lineage records concrete checksums for runtime authority manifests", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/manifest-lineage.json", "utf8"));

  assert.equal(manifest.checksumAlgorithm, "sha256");
  assert.equal(manifest.failurePolicy, "fail-closed");
  assert.ok(manifest.entries.every((entry) => entry.checksum && entry.checksum !== "PENDING"));
});
