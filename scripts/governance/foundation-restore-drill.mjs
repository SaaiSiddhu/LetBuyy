#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const sourceUrl = process.env.LETBUYY_RESTORE_DRILL_SOURCE_URL || "";
const targetUrl = process.env.LETBUYY_RESTORE_DRILL_TARGET_URL || "";

function assertLocalTarget(url) {
  if (!/^postgres(?:ql)?:\/\//.test(url)) throw new Error("Restore drill target must be a Postgres URL.");
  if (!/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/.test(url)) {
    throw new Error("Restore drill execution is local-only for Codex. Shared/staging/prod restores are human SKIP-DEPLOY runbook steps.");
  }
}

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(" ")} failed`);
}

if (!execute) {
  console.log("LetBuyy restore drill plan");
  console.log("- Codex mode: plan only; no production/shared DB action.");
  console.log("- Execute locally with --execute and LETBUYY_RESTORE_DRILL_SOURCE_URL / LETBUYY_RESTORE_DRILL_TARGET_URL.");
  console.log("- Human shared-env apply remains SKIP-DEPLOY with backup, verify, and rollback evidence.");
  process.exit(0);
}

if (process.env.LETBUYY_RESTORE_DRILL_ALLOW_EXECUTE !== "true") {
  throw new Error("Set LETBUYY_RESTORE_DRILL_ALLOW_EXECUTE=true to run a local restore drill.");
}
if (!sourceUrl || !targetUrl) {
  throw new Error("LETBUYY_RESTORE_DRILL_SOURCE_URL and LETBUYY_RESTORE_DRILL_TARGET_URL are required.");
}
assertLocalTarget(sourceUrl);
assertLocalTarget(targetUrl);

const dir = mkdtempSync(join(tmpdir(), "letbuyy-restore-drill-"));
const dumpPath = join(dir, "source.backup");
try {
  run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", dumpPath, sourceUrl]);
  run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", targetUrl, dumpPath]);
  console.log("Restore drill completed against local target.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
