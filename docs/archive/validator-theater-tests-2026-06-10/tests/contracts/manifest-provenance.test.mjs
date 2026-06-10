import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("manifest provenance validator enforces ancestry and signature governance", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/manifest-provenance-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("manifest provenance requires detached signatures before execute mode", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-survivability-intelligence.json", "utf8"));

  assert.equal(manifest.manifestProvenance.checksumAlgorithm, "sha256");
  assert.equal(manifest.manifestProvenance.signaturePolicy, "detached-signature-required-before-execute-mode");
  assert.ok(manifest.manifestProvenance.ancestryEntries.length >= 3);
});
