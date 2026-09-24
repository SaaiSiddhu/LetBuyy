#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const skipValidation = args.has("--skip-validation");
const environment = valueFor("--environment") || "production";
const target = valueFor("--target") || "all";
const wranglerLogPath = process.env.WRANGLER_LOG_PATH || path.join(os.tmpdir(), "letbuyy-wrangler-logs");
const supportedEnvironments = ["staging", "production"];

fs.mkdirSync(wranglerLogPath, { recursive: true });

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
    env: { ...process.env, WRANGLER_LOG_PATH: wranglerLogPath },
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

if (!supportedEnvironments.includes(environment)) {
  throw new Error("--environment must be staging or production");
}

cleanWranglerArtifacts();
if (!skipValidation) {
  run("pnpm", ["run", "validate:governance"]);
  run("node", [
    "infrastructure/scripts/operations/phase4-ultimate-validate.mjs",
    `--environment=${environment}`,
    ...(execute ? ["--execute"] : []),
  ]);
}

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
  for (const config of [
    "services/api-gateway/wrangler.toml",
    "services/webhook-service/wrangler.toml",
    "services/queue-workers/wrangler.toml",
  ]) {
    let deployConfig = config;
    if (config === "services/api-gateway/wrangler.toml") {
      deployConfig = `services/api-gateway/.wrangler/api-gateway-${environment}.wrangler.toml`;
      run("node", [
        "infrastructure/scripts/cloudflare/materialize-wrangler-config.mjs",
        `--config=${config}`,
        `--environment=${environment}`,
        `--output=${deployConfig}`,
        ...(execute ? ["--require-real-bindings"] : []),
      ]);
    }
    const deployCommand = ["infrastructure/scripts/deploy/deploy-worker-runtime.mjs", "--config", deployConfig, "--env", environment];
    if (!execute) {
      console.log(`[production-deploy] planned node ${deployCommand.join(" ")} --dry-run`);
      continue;
    }
    run("node", deployCommand);
  }
  cleanWranglerArtifacts();

  if (execute) {
    run("pnpm", ["--dir", "services/api-gateway", "exec", "wrangler", "triggers", "deploy", "--config", "wrangler.toml", "--env", environment]);
  }
}

if (shouldRun("apps")) {
  if (execute) requireEnv(["VERCEL_TOKEN", "VERCEL_ORG_ID"]);
  const appRoots = [
    "apps/platform/identity",
    "apps/merchant/web",
    "apps/commerce/web",
    "apps/frozen/app-store",
    "apps/frozen/theme-store",
    "apps/marketing/web",
    "apps/internal/console",
    "apps/frozen/operations-portal",
  ];

  for (const appRoot of appRoots) {
    if (!fs.existsSync(`${appRoot}/package.json`)) continue;
    if (!execute) {
      console.log(`[production-deploy] planned pnpm dlx vercel deploy --cwd ${appRoot} --yes${environment === "production" ? " --prod" : ""}`);
      continue;
    }
    const deployArgs = ["dlx", "vercel", "deploy", "--cwd", appRoot, "--yes"];
    if (environment === "production") deployArgs.push("--prod");
    run("pnpm", deployArgs);
  }
}

if (execute) {
  run("node", ["infrastructure/scripts/deploy/verify-health-gates.mjs", `--environment=${environment}`]);
}
