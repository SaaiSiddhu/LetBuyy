#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const requestedMode = valueFor("--mode") || (args.has("--execute") ? "execute" : "auto");
const environment = valueFor("--environment") || "production";
const version = valueFor("--version") || process.env.GITHUB_SHA || `local-${Date.now()}`;

const requiredSecretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_SECRET",
  "CSRF_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "RAZORPAY_KEY_SECRET",
  "STRIPE_WEBHOOK_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "PAYPAL_WEBHOOK_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_API_KEY",
];

const capabilityGroups = [
  {
    name: "cloudflare",
    env: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "TF_VAR_cloudflare_api_token", "TF_VAR_cloudflare_account_id"],
    tools: ["npx", "terraform"],
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
    name: "operations",
    env: ["LETBUYY_OPERATIONS_TOKEN"],
  },
  {
    name: "vercel",
    env: ["VERCEL_TOKEN", "VERCEL_ORG_ID"],
    tools: ["npx"],
  },
  {
    name: "secret-rotation",
    env: requiredSecretNames.map((secretName) => `ROTATE_SECRET_${secretName}`),
    tools: ["npx"],
  },
  {
    name: "load-testing",
    tools: ["k6"],
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
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], { stdio: "ignore" });
  return result.status === 0;
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
    return {
      name: group.name,
      ready: missingEnv.length === 0 && missingTools.length === 0,
      missingEnv,
      missingTools,
    };
  });
}

function run(command, commandArgs) {
  const printable = [command, ...commandArgs].join(" ");
  console.log(`[phase4-live] ${printable}`);
  const result = spawnSync(command, commandArgs, { stdio: "inherit", env: process.env });
  assert(result.status === 0, `${printable} failed with status ${result.status}`);
}

assert(environment === "staging" || environment === "production", "--environment must be staging or production");
assert(["auto", "plan", "execute"].includes(requestedMode), "--mode must be auto, plan, or execute");

const capabilities = evaluateCapabilities();
const executeReady = capabilities.every((capability) => capability.ready);

if (requestedMode === "execute" && !executeReady) {
  const missing = capabilities
    .filter((capability) => !capability.ready)
    .map((capability) => `${capability.name}: env=[${capability.missingEnv.join(",") || "ok"}] tools=[${capability.missingTools.join(",") || "ok"}]`)
    .join("; ");
  throw new Error(`Cannot run Phase 4 live certification in execute mode. Missing capabilities: ${missing}`);
}

const mode = requestedMode === "auto" ? (executeReady ? "execute" : "plan") : requestedMode;

console.log(`[phase4-live] environment=${environment} mode=${mode} version=${version}`);
for (const capability of capabilities) {
  console.log(
    `[phase4-live] capability ${capability.name}: ${capability.ready ? "ready" : "plan-only"} env=${capability.missingEnv.join(",") || "ok"} tools=${capability.missingTools.join(",") || "ok"}`,
  );
}

const commonArgs = [`--environment=${environment}`, `--version=${version}`];

if (mode === "execute") {
  run("node", ["infrastructure/scripts/security/rotate-secrets.mjs", `--environment=${environment}`, "--execute"]);
  run("node", ["infrastructure/scripts/operations/phase4-ultimate-validate.mjs", ...commonArgs, "--execute"]);
  run("node", ["infrastructure/scripts/deploy/production-deploy.mjs", `--environment=${environment}`, "--target=all", "--execute", "--skip-validation"]);
  run("node", ["infrastructure/scripts/operations/verify-live-operations.mjs", `--environment=${environment}`, "--execute"]);
  run("node", ["infrastructure/scripts/operations/run-live-drills.mjs", ...commonArgs, "--execute"]);
  console.log(`[phase4-live] ${environment} live production certification executed`);
} else {
  run("node", ["infrastructure/scripts/security/rotate-secrets.mjs", `--environment=${environment}`]);
  run("node", ["infrastructure/scripts/operations/phase4-ultimate-validate.mjs", ...commonArgs]);
  run("node", ["infrastructure/scripts/operations/verify-live-operations.mjs", `--environment=${environment}`]);
  run("node", ["infrastructure/scripts/operations/run-live-drills.mjs", ...commonArgs]);
  run("node", ["infrastructure/scripts/deploy/production-deploy.mjs", `--environment=${environment}`, "--target=workers", "--skip-validation"]);
  console.log(`[phase4-live] ${environment} live certification plan passed; execute mode remains credential-gated`);
}
