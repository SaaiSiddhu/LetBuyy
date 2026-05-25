import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

test("runtime causality validator enforces cross-runtime lineage graph", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/runtime-causality-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("runtime causality graph covers deployment replay queue projection rollback and execution", () => {
  const manifest = JSON.parse(fs.readFileSync("config/runtime/runtime-causality-graph.json", "utf8"));
  const kinds = new Set(manifest.graph.nodes.map((node) => node.kind));

  for (const kind of ["deployment", "replay", "queue", "projection", "rollback", "reconciliation", "execution", "temporal"]) {
    assert.ok(kinds.has(kind), `missing causality kind ${kind}`);
  }
});
