import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("WAL certification validator enforces restoration and corruption evidence", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/wal-certification-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /WAL certification validator passed/);
});
