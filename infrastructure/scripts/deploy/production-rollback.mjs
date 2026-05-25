#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const environment = valueFor("--environment") || "production";
const worker = valueFor("--worker");
const versionId = valueFor("--version-id");
const reason = valueFor("--reason") || "operator requested production rollback";
const lineageManifest = "config/runtime/deployment-lineage-manifest.json";

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function run(command, commandArgs) {
  console.log(`[production-rollback] ${[command, ...commandArgs].join(" ")}`);
  const result = spawnSync(command, commandArgs, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function packageDirForWorker(workerName) {
  if (workerName.includes("webhooks")) return "services/webhook-service";
  if (workerName.includes("queue")) return "services/queue-workers";
  return "services/api-gateway";
}

if (!worker) {
  throw new Error("--worker is required, for example --worker=letbuyy-api");
}

if (!versionId) {
  throw new Error("--version-id is required for deterministic Worker rollback lineage");
}

if (!["dev", "staging", "production"].includes(environment)) {
  throw new Error("--environment must be dev, staging, or production");
}

if (!fs.existsSync(lineageManifest)) {
  throw new Error(`${lineageManifest} is required before Worker rollback`);
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  throw new Error("CLOUDFLARE_API_TOKEN is required for Worker rollback");
}

run("pnpm", ["run", "validate:rollback"]);

const rollbackArgs = ["--dir", packageDirForWorker(worker), "exec", "wrangler", "rollback", "--name", worker, "--env", environment, "--message", reason];
if (versionId) rollbackArgs.splice(5, 0, versionId);

run("pnpm", rollbackArgs);
