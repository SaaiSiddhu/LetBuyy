#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const skipWorkers = args.has("--skip-workers");
const environment = valueFor("--environment") || "dev";
const topology = JSON.parse(fs.readFileSync("config/runtime/cloudflare-topology.json", "utf8"));

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, commandArgs, options = {}) {
  const printable = [command, ...commandArgs].join(" ");
  console.log(`[bootstrap-cloudflare] ${execute || options.alwaysRun ? "running" : "planned"} ${printable}`);
  if (!execute && !options.alwaysRun) return;

  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");
assert(topology.environments?.[environment], `Missing Cloudflare topology for ${environment}`);

if (environment === "production" && execute) {
  assert(process.env.LETBUYY_PROVIDER_MUTATION_APPROVED === "true", "Production bootstrap requires LETBUYY_PROVIDER_MUTATION_APPROVED=true");
}

run("node", [
  "infrastructure/scripts/cloudflare/provider-capability-validator.mjs",
  `--environment=${environment}`,
  ...(execute ? ["--execute"] : []),
], { alwaysRun: true });

run("node", [
  "infrastructure/scripts/deploy/production-deploy.mjs",
  `--environment=${environment}`,
  "--target=cloudflare",
  ...(execute ? ["--execute"] : []),
]);

const databaseName = topology.environments[environment].d1;
run("pnpm", [
  "--dir",
  "services/api-gateway",
  "exec",
  "wrangler",
  "d1",
  "migrations",
  "apply",
  databaseName,
  "--config",
  "wrangler.toml",
  "--env",
  environment,
  ...(execute ? [] : ["--dry-run"]),
]);

if (!skipWorkers) {
  run("node", [
    "infrastructure/scripts/deploy/production-deploy.mjs",
    `--environment=${environment}`,
    "--target=workers",
    ...(execute ? ["--execute"] : []),
  ]);
}

run("node", [
  "scripts/validators/cloudflare-topology-validator.mjs",
]);
run("node", [
  "scripts/validators/provider-evidence-validator.mjs",
  `--environment=${environment}`,
  ...(execute ? ["--require-live-evidence"] : []),
]);
