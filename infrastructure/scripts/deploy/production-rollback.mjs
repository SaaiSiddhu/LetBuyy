#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const environment = valueFor("--environment") || "production";
const worker = valueFor("--worker");
const versionId = valueFor("--version-id");
const reason = valueFor("--reason") || "operator requested production rollback";

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

if (!["dev", "staging", "production"].includes(environment)) {
  throw new Error("--environment must be dev, staging, or production");
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  throw new Error("CLOUDFLARE_API_TOKEN is required for Worker rollback");
}

const rollbackArgs = ["--dir", packageDirForWorker(worker), "exec", "wrangler", "rollback", "--name", worker, "--env", environment, "--message", reason];
if (versionId) rollbackArgs.splice(5, 0, versionId);

run("pnpm", rollbackArgs);
