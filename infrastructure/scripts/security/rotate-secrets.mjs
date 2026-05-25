#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const environment = valueFor("--environment") || "production";

const workerSecretConfigs = [
  "services/api-gateway/wrangler.toml",
  "services/webhook-service/wrangler.toml",
  "services/queue-workers/wrangler.toml",
];

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

function valueFor(prefix) {
  const arg = process.argv.slice(2).find((candidate) => candidate.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(environment === "staging" || environment === "production", "--environment must be staging or production");

for (const secretName of requiredSecretNames) {
  const envName = `ROTATE_SECRET_${secretName}`;
  if (!execute) {
    console.log(`[secret-rotation] planned ${secretName} from ${envName}`);
    continue;
  }

  const secretValue = process.env[envName];
  assert(secretValue && secretValue.length >= 16, `Missing or too-short ${envName} for --execute`);

  for (const config of workerSecretConfigs) {
    const result = spawnSync("npx", ["wrangler", "secret", "put", secretName, "--config", config, "--env", environment], {
      input: `${secretValue}\n`,
      stdio: ["pipe", "inherit", "inherit"],
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || "/tmp/letbuyy-wrangler-logs",
      },
    });
    assert(result.status === 0, `Wrangler secret rotation failed for ${secretName} in ${config}`);
  }
}

console.log(`[secret-rotation] ${execute ? "executed" : "planned"} ${requiredSecretNames.length} governed secrets for ${environment}`);
