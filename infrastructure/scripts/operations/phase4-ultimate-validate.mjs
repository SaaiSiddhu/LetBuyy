#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const environment = valueFor("--environment") || "production";
const version = valueFor("--version") || process.env.GITHUB_SHA || `local-${Date.now()}`;

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, commandArgs) {
  const printable = [command, ...commandArgs].join(" ");
  console.log(`[phase4-ultimate] ${printable}`);
  const result = spawnSync(command, commandArgs, { stdio: "inherit", env: process.env });
  assert(result.status === 0, `${printable} failed with status ${result.status}`);
}

function apiBase() {
  if (process.env.LETBUYY_API_BASE_URL) return process.env.LETBUYY_API_BASE_URL.replace(/\/$/, "");
  if (environment === "production") return "https://api.letbuyy.com";
  if (environment === "staging") return "https://api.staging.letbuyy.com";
  return "https://api.staging.letbuyy.com";
}

async function postOperations(path, body) {
  assert(process.env.LETBUYY_OPERATIONS_TOKEN, "Missing LETBUYY_OPERATIONS_TOKEN for operations evidence recording");
  const response = await fetch(`${apiBase()}/v1/operations${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LETBUYY_OPERATIONS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Request-ID": `phase4-ultimate-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  assert(response.ok, `operations evidence POST ${path} returned ${response.status}: ${text.slice(0, 500)}`);
}

assert(["staging", "production"].includes(environment), "--environment must be staging or production");

const validationCommands = [
  ["node", ["scripts/validators/production-readiness-validator.mjs"]],
  ["node", ["infrastructure/scripts/cloudflare/verify-provider-contracts.mjs", `--environment=${environment}`, ...(execute ? ["--execute"] : [])]],
  ["node", ["infrastructure/scripts/database/verify-supabase-operations.mjs", `--environment=${environment}`, ...(execute ? ["--execute"] : [])]],
  ["node", ["infrastructure/scripts/observability/verify-observability-rollout.mjs", `--environment=${environment}`, ...(execute ? ["--execute"] : [])]],
  ["node", ["infrastructure/scripts/security/verify-security-gates.mjs"]],
  ["node", ["infrastructure/scripts/operations/verify-live-operations.mjs", `--environment=${environment}`, ...(execute ? ["--execute"] : [])]],
  ["node", ["infrastructure/scripts/operations/run-live-drills.mjs", `--environment=${environment}`, `--version=${version}`, ...(execute ? ["--execute"] : [])]],
  ["node", ["infrastructure/scripts/deploy/verify-health-gates.mjs", `--environment=${environment}`, ...(execute ? [] : ["--preflight"])]],
];

for (const [command, commandArgs] of validationCommands) {
  run(command, commandArgs);
}

if (execute) {
  const timestamp = Date.now();
  await postOperations("/runtime/readiness-gates", {
    gate_run_id: `phase4-ultimate-${environment}-${timestamp}`,
    environment,
    version,
    status: "passed",
    gates: validationCommands.map(([command, commandArgs]) => ({
      command,
      args: commandArgs,
      status: "passed",
    })),
  });
  await postOperations("/runtime/deployment-health-gates", {
    gate_id: `phase4-cloudflare-provider-${environment}-${timestamp}`,
    runtime_root: "services/queue-workers",
    environment,
    gate_name: "cloudflare-provider-contracts",
    status: "passed",
    observed_value: { passed: true },
    threshold: { expected: true },
    evidence_url: null,
  });
  await postOperations("/runtime/dashboards", {
    snapshot_id: `phase4-dashboards-${environment}-${timestamp}`,
    dashboard_name: "phase4-ultimate-operational-dashboards",
    environment,
    status: "healthy",
    source_api: "/v1/operations/runtime/overview",
    source_projection: "operational_dashboard_snapshots",
    panels: [
      { name: "runtime", status: "validated" },
      { name: "queue", status: "validated" },
      { name: "incident", status: "validated" },
      { name: "deployment", status: "validated" },
    ],
  });
  await postOperations("/runtime/security/enforcement-events", {
    enforcement_id: `phase4-security-${environment}-${timestamp}`,
    environment,
    control_name: "phase4-ultimate-security-gates",
    runtime_root: "services/api-gateway",
    status: "passed",
    severity: "high",
    evidence: {
      securityGateScript: "infrastructure/scripts/security/verify-security-gates.mjs",
      secretRotationScript: "infrastructure/scripts/security/rotate-secrets.mjs",
    },
  });
}

console.log(`[phase4-ultimate] ${environment} ${execute ? "live" : "preflight"} validation passed`);
