import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Worker deploy wrapper fails closed when --env is missing", () => {
  const result = spawnSync(process.execPath, ["infrastructure/scripts/deploy/deploy-worker-runtime.mjs", "--config", "services/api-gateway/wrangler.toml"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--env is required/);
});

test("Worker deploy wrapper rejects non-governed environments before invoking Wrangler", () => {
  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/deploy/deploy-worker-runtime.mjs",
    "--config",
    "services/api-gateway/wrangler.toml",
    "--env",
    "local",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid --env local/);
});
