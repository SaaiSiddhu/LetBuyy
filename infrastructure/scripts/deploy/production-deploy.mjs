#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const environment = valueFor("--environment") || "production";
const target = valueFor("--target") || "all";

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function run(command, commandArgs, options = {}) {
  const printable = [command, ...commandArgs].join(" ");
  console.log(`[production-deploy] ${printable}`);

  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    cwd: options.cwd || process.cwd(),
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for --execute: ${missing.join(", ")}`);
  }
}

function shouldRun(name) {
  return target === "all" || target === name;
}

function cleanWranglerArtifacts() {
  for (const dir of [
    "services/api-gateway/.wrangler",
    "services/webhook-service/.wrangler",
    "services/queue-workers/.wrangler",
  ]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (!["staging", "production"].includes(environment)) {
  throw new Error("--environment must be staging or production");
}

cleanWranglerArtifacts();
run("npm", ["run", "validate:governance"]);
run("node", ["infrastructure/scripts/deploy/verify-health-gates.mjs", `--environment=${environment}`, "--preflight"]);

if (shouldRun("cloudflare")) {
  if (execute) requireEnv(["CLOUDFLARE_API_TOKEN", "TF_VAR_cloudflare_account_id", "TF_VAR_cloudflare_api_token"]);
  const hasTerraformCredentials = Boolean(process.env.TF_VAR_cloudflare_account_id && process.env.TF_VAR_cloudflare_api_token);
  if (!execute && !hasTerraformCredentials) {
    console.log("[production-deploy] planned terraform -chdir=infrastructure/cloudflare init -input=false");
    console.log("[production-deploy] planned terraform -chdir=infrastructure/cloudflare plan -input=false -out=tfplan");
  } else {
    run("terraform", ["-chdir=infrastructure/cloudflare", "init", "-input=false"]);
    run("terraform", ["-chdir=infrastructure/cloudflare", "plan", "-input=false", "-out=tfplan"]);
    if (execute) {
      run("terraform", ["-chdir=infrastructure/cloudflare", "apply", "-input=false", "-auto-approve", "tfplan"]);
    }
  }
}

if (shouldRun("workers")) {
  if (execute) requireEnv(["CLOUDFLARE_API_TOKEN"]);
  const deployFlag = execute ? [] : ["--dry-run"];
  for (const config of [
    "services/api-gateway/wrangler.toml",
    "services/webhook-service/wrangler.toml",
    "services/queue-workers/wrangler.toml",
  ]) {
    run("npx", ["wrangler", "deploy", "--config", config, "--env", environment, "--keep-vars", ...deployFlag]);
  }
  cleanWranglerArtifacts();

  if (execute) {
    run("npx", ["wrangler", "triggers", "deploy", "--config", "services/api-gateway/wrangler.toml", "--env", environment]);
  }
}

if (shouldRun("apps")) {
  if (execute) requireEnv(["VERCEL_TOKEN", "VERCEL_ORG_ID"]);
  const appRoots = [
    "apps/identity-platform",
    "apps/merchant-control-plane",
    "apps/storefront-runtime",
    "apps/app-marketplace",
    "apps/theme-marketplace",
    "apps/marketing-site",
    "apps/platform-console",
    "apps/platform-operations-portal",
  ];

  for (const appRoot of appRoots) {
    if (!fs.existsSync(`${appRoot}/package.json`)) continue;
    if (!execute) {
      console.log(`[production-deploy] planned npx vercel deploy --cwd ${appRoot} --yes${environment === "production" ? " --prod" : ""}`);
      continue;
    }
    const deployArgs = ["vercel", "deploy", "--cwd", appRoot, "--yes"];
    if (environment === "production") deployArgs.push("--prod");
    run("npx", deployArgs);
  }
}

if (execute) {
  run("node", ["infrastructure/scripts/deploy/verify-health-gates.mjs", `--environment=${environment}`]);
}
