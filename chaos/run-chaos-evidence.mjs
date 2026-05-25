#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const environment = valueFor("--environment") || "staging";
const mode = valueFor("--mode") || "plan";
const experimentFilter = valueFor("--experiment") || valueFor("--scenario") || "all";
const manifestPath = valueFor("--manifest") || "chaos/scenarios/failure-matrix.json";
const runId = valueFor("--run-id") || `chaos-${environment}-${Date.now()}`;

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");
assert(["plan", "execute"].includes(mode), "--mode must be plan or execute");

const manifest = readJson(manifestPath);
const experiments = manifest.experiments.filter((experiment) => experimentFilter === "all" || experiment.id === experimentFilter);
assert(experiments.length > 0, `No chaos experiments matched ${experimentFilter}`);

if (mode === "plan") {
  for (const experiment of experiments) {
    console.log(
      `[chaos-evidence] planned ${experiment.id}: node infrastructure/scripts/chaos/run-chaos-experiment.mjs --type=${experiment.type} --environment=${environment} --blast-radius=${experiment.blastRadius}`,
    );
  }
  console.log("[chaos-evidence] plan mode complete; no evidence was recorded and no certification was claimed");
  process.exit(0);
}

assert(process.env.LETBUYY_CHAOS_EXECUTION_APPROVED === "true", "LETBUYY_CHAOS_EXECUTION_APPROVED=true is required");
assert(process.env.LETBUYY_OPERATIONS_TOKEN, "LETBUYY_OPERATIONS_TOKEN is required for executable chaos evidence");
assert(process.env.LETBUYY_API_BASE_URL, "LETBUYY_API_BASE_URL is required for executable chaos evidence");
if (environment === "production") {
  assert(
    process.env.LETBUYY_SURVIVABILITY_EXECUTION_APPROVED === "true",
    "LETBUYY_SURVIVABILITY_EXECUTION_APPROVED=true is required for production chaos execution",
  );
}

const reportDirectory = path.join(manifest.evidenceDirectory, runId);
fs.mkdirSync(reportDirectory, { recursive: true });

const results = [];
for (const experiment of experiments) {
  const args = [
    "infrastructure/scripts/chaos/run-chaos-experiment.mjs",
    `--type=${experiment.type}`,
    `--environment=${environment}`,
    `--blast-radius=${experiment.blastRadius}`,
    "--status=requested",
    `--id=${runId}-${experiment.id}`,
  ];
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });

  results.push({
    experiment_id: experiment.id,
    type: experiment.type,
    blast_radius: experiment.blastRadius,
    status: result.status === 0 ? "requested" : "failed",
    exit_code: result.status,
    must_observe: experiment.mustObserve,
  });

  if (result.status !== 0) {
    throw new Error(`Chaos experiment request failed: ${experiment.id}`);
  }
}

const report = {
  run_id: runId,
  environment,
  mode,
  scope: "live-target",
  certification: false,
  certification_reason: manifest.certificationReason,
  generated_at: new Date().toISOString(),
  results,
};

const reportPath = path.join(reportDirectory, "chaos-evidence.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
