#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const environment = valueFor("--environment") || "staging";
const mode = valueFor("--mode") || "plan";
const scenarioFilter = valueFor("--scenario") || "all";
const manifestPath = valueFor("--manifest") || "load/scenarios/internet-scale-load.json";
const runId = valueFor("--run-id") || `load-${environment}-${Date.now()}`;

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

function commandExists(command) {
  return spawnSync("bash", ["-lc", `command -v ${command}`], { stdio: "ignore" }).status === 0;
}

function apiBase() {
  if (process.env.LETBUYY_API_BASE_URL) return process.env.LETBUYY_API_BASE_URL.replace(/\/$/, "");
  if (environment === "production") return "https://api.letbuyy.store";
  if (environment === "staging") return "https://api.staging.letbuyy.store";
  return "https://api-dev.letbuyy.store";
}

function scenarioCommand(scenario, reportDirectory) {
  if (scenario.tool === "k6") {
    const summaryPath = path.join(reportDirectory, `${scenario.id}-k6-summary.json`);
    return {
      command: "k6",
      args: [...scenario.args, "--summary-export", summaryPath],
      evidencePath: summaryPath,
    };
  }

  if (scenario.tool === "locust") {
    const csvPrefix = path.join(reportDirectory, scenario.id);
    return {
      command: "locust",
      args: [...scenario.args, "--csv", csvPrefix],
      evidencePath: `${csvPrefix}_stats.csv`,
    };
  }

  if (scenario.tool === "gatling") {
    return {
      command: "gatling",
      args: scenario.args,
      evidencePath: path.join(reportDirectory, "gatling"),
    };
  }

  throw new Error(`Unsupported load tool ${scenario.tool}`);
}

assert(["dev", "staging", "production"].includes(environment), "--environment must be dev, staging, or production");
assert(["plan", "execute"].includes(mode), "--mode must be plan or execute");

const manifest = readJson(manifestPath);
const scenarios = manifest.scenarios.filter((scenario) => scenarioFilter === "all" || scenario.id === scenarioFilter);
assert(scenarios.length > 0, `No load scenarios matched ${scenarioFilter}`);

if (mode === "plan") {
  for (const scenario of scenarios) {
    const planned = scenarioCommand(scenario, manifest.evidenceDirectory);
    console.log(`[load-evidence] planned ${scenario.id}: ${planned.command} ${planned.args.join(" ")}`);
  }
  console.log("[load-evidence] plan mode complete; no evidence was recorded and no certification was claimed");
  process.exit(0);
}

assert(process.env.LETBUYY_API_BASE_URL, "LETBUYY_API_BASE_URL is required for executable load evidence");
assert(process.env.LETBUYY_OPERATIONS_TOKEN, "LETBUYY_OPERATIONS_TOKEN is required for executable load evidence");
if (environment === "production") {
  assert(
    process.env.LETBUYY_SURVIVABILITY_EXECUTION_APPROVED === "true",
    "LETBUYY_SURVIVABILITY_EXECUTION_APPROVED=true is required for production load execution",
  );
}

const reportDirectory = path.join(manifest.evidenceDirectory, runId);
fs.mkdirSync(reportDirectory, { recursive: true });

const results = [];
for (const scenario of scenarios) {
  assert(fs.existsSync(scenario.script), `Load scenario script is missing: ${scenario.script}`);
  const planned = scenarioCommand(scenario, reportDirectory);
  assert(commandExists(planned.command), `${scenario.tool} is required for executable load evidence`);

  const started = performance.now();
  const result = spawnSync(planned.command, planned.args, {
    stdio: "inherit",
    env: {
      ...process.env,
      LETBUYY_API_BASE_URL: apiBase(),
      LETBUYY_LOAD_RUN_ID: runId,
      LETBUYY_LOAD_SCENARIO_ID: scenario.id,
    },
  });
  const elapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(3));

  results.push({
    scenario_id: scenario.id,
    category: scenario.category,
    tool: scenario.tool,
    status: result.status === 0 ? "measured" : "failed",
    exit_code: result.status,
    elapsed_seconds: elapsedSeconds,
    evidence_path: planned.evidencePath,
    required_metrics: scenario.requiredMetrics,
  });

  if (result.status !== 0) {
    throw new Error(`Load scenario failed: ${scenario.id}`);
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
  api_base_url: apiBase(),
  results,
};

const reportPath = path.join(reportDirectory, "load-evidence.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
