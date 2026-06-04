#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = new Set(process.argv.slice(2));
const requestedMode = valueFor("--mode") || (args.has("--execute") ? "execute" : "auto");
const environment = valueFor("--environment") || "production";
const version = valueFor("--version") || process.env.GITHUB_SHA || `local-${Date.now()}`;

const capabilityGroups = [
  {
    name: "operator-approval",
    env: ["LETBUYY_SURVIVABILITY_EXECUTION_APPROVED"],
    validator: () => process.env.LETBUYY_SURVIVABILITY_EXECUTION_APPROVED === "true",
  },
  {
    name: "cloudflare",
    env: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "TF_VAR_cloudflare_api_token", "TF_VAR_cloudflare_account_id"],
    tools: ["pnpm", "terraform"],
  },
  {
    name: "supabase",
    envAny: [["SUPABASE_DB_URL", "DATABASE_URL"]],
    tools: ["psql"],
  },
  {
    name: "observability",
    env: ["PROMETHEUS_URL", "GRAFANA_URL", "OTEL_COLLECTOR_HEALTH_URL"],
  },
  {
    name: "operations-control-plane",
    env: ["LETBUYY_OPERATIONS_TOKEN"],
  },
  {
    name: "vercel",
    env: ["VERCEL_TOKEN", "VERCEL_ORG_ID"],
    tools: ["pnpm"],
  },
  {
    name: "load-testing",
    tools: ["k6", "locust", "gatling"],
  },
];

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasEnv(name) {
  return typeof process.env[name] === "string" && process.env[name].trim().length > 0;
}

function hasTool(command) {
  return spawnSync("bash", ["-lc", `command -v ${command}`], { stdio: "ignore" }).status === 0;
}

function evaluateCapabilities() {
  return capabilityGroups.map((group) => {
    const missingEnv = [];
    for (const envName of group.env || []) {
      if (!hasEnv(envName)) missingEnv.push(envName);
    }
    for (const alternatives of group.envAny || []) {
      if (!alternatives.some(hasEnv)) missingEnv.push(alternatives.join("|"));
    }
    const missingTools = (group.tools || []).filter((tool) => !hasTool(tool));
    const validatorReady = group.validator ? group.validator() : true;
    return {
      name: group.name,
      ready: missingEnv.length === 0 && missingTools.length === 0 && validatorReady,
      missingEnv,
      missingTools,
      approval: validatorReady ? "ok" : "not-approved",
    };
  });
}

function run(command, commandArgs) {
  const printable = [command, ...commandArgs].join(" ");
  console.log(`[survivability-suite] ${printable}`);
  const result = spawnSync(command, commandArgs, { stdio: "inherit", env: process.env });
  assert(result.status === 0, `${printable} failed with status ${result.status}`);
}

assert(["staging", "production"].includes(environment), "--environment must be staging or production");
assert(["auto", "plan", "execute"].includes(requestedMode), "--mode must be auto, plan, or execute");
assert(fs.existsSync("config/runtime/survivability-execution.json"), "Missing survivability execution contract");

const capabilities = evaluateCapabilities();
const executeReady = capabilities.every((capability) => capability.ready);
if (requestedMode === "execute" && !executeReady) {
  const missing = capabilities
    .filter((capability) => !capability.ready)
    .map((capability) => `${capability.name}: env=[${capability.missingEnv.join(",") || "ok"}] tools=[${capability.missingTools.join(",") || "ok"}] approval=${capability.approval}`)
    .join("; ");
  throw new Error(`Cannot run survivability suite in execute mode. Missing capabilities: ${missing}`);
}

const mode = requestedMode === "auto" ? (executeReady ? "execute" : "plan") : requestedMode;
console.log(`[survivability-suite] environment=${environment} mode=${mode} version=${version}`);
for (const capability of capabilities) {
  console.log(
    `[survivability-suite] capability ${capability.name}: ${capability.ready ? "ready" : "plan-only"} env=${capability.missingEnv.join(",") || "ok"} tools=${capability.missingTools.join(",") || "ok"} approval=${capability.approval}`,
  );
}

const nonMutatingGates = [
  ["pnpm", ["run", "validate:governance"]],
  ["pnpm", ["run", "validate:production"]],
  ["pnpm", ["run", "validate:security"]],
  ["pnpm", ["run", "validate:migrations"]],
  ["pnpm", ["run", "validate:replay"]],
  ["pnpm", ["run", "validate:cloudflare"]],
  ["pnpm", ["run", "validate:observability"]],
  ["pnpm", ["run", "validate:chaos"]],
  ["pnpm", ["run", "validate:ci"]],
];

for (const [command, commandArgs] of nonMutatingGates) {
  run(command, commandArgs);
}

if (mode === "execute") {
  run("node", [
    "infrastructure/scripts/operations/phase4-live-certify.mjs",
    `--environment=${environment}`,
    "--mode=execute",
    `--version=${version}`,
  ]);
} else {
  run("node", [
    "infrastructure/scripts/operations/phase4-live-certify.mjs",
    `--environment=${environment}`,
    "--mode=plan",
    `--version=${version}`,
  ]);
}

console.log(`[survivability-suite] ${environment} ${mode} survivability suite completed`);
