import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("failure domain validator enforces explicit containment boundaries", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/failure-domain-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("failure domain manifest declares all runtime containment kinds", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/failure-domain-manifest.json", "utf8"));
  const kinds = new Set(manifest.domains.map((domain) => domain.isolationKind));

  for (const kind of ["runtime", "queue", "replay", "projection", "deployment", "reconciliation"]) {
    assert.ok(kinds.has(kind), `missing failure domain ${kind}`);
  }
});
